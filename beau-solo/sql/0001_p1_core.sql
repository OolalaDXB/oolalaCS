-- BEAU Solo 0001 — P1 core: staff access, places, appointment types, hours,
-- bookings, CRM (contacts, enquiries, notes), notification outbox, audit.
--
-- Installed into a host database as its own schema (`beau_solo`) with its own
-- version ledger. Nothing in `beau_solo` is reachable through the API: anon and
-- authenticated hold no privilege on the schema. Every read and write goes
-- through SECURITY DEFINER functions in `public` prefixed `solo_`:
--   * solo_public_*  — service role only (called by the `solo-public` Edge Function)
--   * solo_admin_*   — authenticated, each one checks the caller's staff permission
-- Times are stored in UTC; the business timezone lives in beau_solo.settings.
-- No DROP, no DELETE, no UPDATE without a WHERE, no percent sign: the Supabase SQL tools stall on them.
-- Hours and blocks are therefore switched off (active / deleted_at), never deleted.

create schema if not exists beau_solo;
revoke all on schema beau_solo from public, anon, authenticated;

create table if not exists beau_solo.schema_versions (
  version    text primary key,
  applied_at timestamptz not null default now(),
  note       text
);

create or replace function beau_solo.touch() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

/* ------------------------------------------------------------------ */
/* staff access                                                        */
/* ------------------------------------------------------------------ */
-- Permissions: solo:agenda (hours, bookings), solo:crm (enquiries, contacts,
-- notes), solo:settings (appointment types, places), solo:admin (everything).
create table if not exists beau_solo.staff (
  email       text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  name        text not null,
  active      boolean not null default true,
  permissions text[] not null default '{}'
              check (permissions <@ array['solo:agenda','solo:crm','solo:settings','solo:admin']),
  created_at  timestamptz not null default now()
);

create or replace function beau_solo.current_email() returns text
language sql stable set search_path = '' as $$
  select nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
$$;

create or replace function beau_solo.can(p_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from beau_solo.staff s
    where s.email = beau_solo.current_email() and s.active
      and (p_permission = any(s.permissions) or 'solo:admin' = any(s.permissions)))
$$;

create or replace function beau_solo.require(p_permission text) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not beau_solo.can(p_permission) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return beau_solo.current_email();
end $$;

create table if not exists beau_solo.audit (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  actor   text,
  area    text not null,
  action  text not null,
  target  text,
  meta    jsonb not null default '{}'
);

create or replace function beau_solo.log(p_area text, p_action text, p_target text, p_meta jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into beau_solo.audit (actor, area, action, target, meta)
  values (beau_solo.current_email(), p_area, p_action, p_target, coalesce(p_meta, '{}'))
$$;

/* ------------------------------------------------------------------ */
/* settings, places, appointment types                                 */
/* ------------------------------------------------------------------ */
create table if not exists beau_solo.settings (
  id             boolean primary key default true check (id),
  timezone       text not null default 'Asia/Dubai',
  slot_step_min  int  not null default 30 check (slot_step_min in (15, 20, 30, 45, 60)),
  notify_email   text,
  updated_at     timestamptz not null default now()
);
insert into beau_solo.settings (id) values (true) on conflict do nothing;

create or replace function beau_solo.check_timezone() returns trigger
language plpgsql set search_path = '' as $$
declare v timestamp;
begin
  v := now() at time zone new.timezone;
  return new;
exception when others then
  raise exception using message = 'invalid timezone ' || new.timezone, errcode = '22023';
end $$;
create or replace trigger settings_tz before insert or update on beau_solo.settings
  for each row execute function beau_solo.check_timezone();

-- A place: the office, a partner's premises (lawyer, notary, bank, free zone),
-- a property, or anywhere else. The address is what the client receives.
create table if not exists beau_solo.locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 120),
  kind        text not null check (kind in ('office','partner','property','other')),
  address     text,
  city        text,
  country     text,
  maps_url    text check (maps_url is null or maps_url ~ '^https://'),
  client_note text,          -- sent to the client (access, parking, documents to bring)
  notes       text,          -- internal only
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create or replace trigger locations_touch before update on beau_solo.locations
  for each row execute function beau_solo.touch();

create table if not exists beau_solo.appointment_types (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  title             jsonb not null check (jsonb_typeof(title) = 'object' and title ? 'fr'),
  description       jsonb not null default '{}' check (jsonb_typeof(description) = 'object'),
  mode              text not null check (mode in ('video','phone','in_person')),
  -- fixed: the place is location_id; to_define: the place is set per booking
  location_policy   text not null default 'fixed' check (location_policy in ('fixed','to_define')),
  location_id       uuid references beau_solo.locations(id),
  duration_min      int  not null check (duration_min between 10 and 480),
  buffer_min        int  not null default 0 check (buffer_min between 0 and 240),
  min_notice_hours  int  not null default 12 check (min_notice_hours between 0 and 720),
  max_days_ahead    int  not null default 60 check (max_days_ahead between 1 and 365),
  price_amount      numeric(12,2) not null default 0 check (price_amount >= 0),
  currency          text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  requires_approval boolean not null default false,
  public            boolean not null default true,   -- bookable on the website
  active            boolean not null default true,
  sort              int  not null default 100,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (mode <> 'in_person' or location_policy = 'to_define' or location_id is not null)
);
create or replace trigger types_touch before update on beau_solo.appointment_types
  for each row execute function beau_solo.touch();

/* ------------------------------------------------------------------ */
/* hours                                                               */
/* ------------------------------------------------------------------ */
create table if not exists beau_solo.availability_rules (
  id         uuid primary key default gen_random_uuid(),
  weekday    smallint not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_time time not null,
  end_time   time not null check (end_time > start_time),
  active     boolean not null default true,     -- rules are switched off, never deleted
  unique (weekday, start_time)
);
alter table beau_solo.availability_rules add column if not exists active boolean not null default true;

-- closed: time off or a block in the diary; open: extra bookable window.
create table if not exists beau_solo.availability_exceptions (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('closed','open')),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null check (ends_at > starts_at),
  reason     text,
  created_by text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz                          -- removed blocks are kept for the record
);
alter table beau_solo.availability_exceptions add column if not exists deleted_at timestamptz;
create index if not exists exceptions_range on beau_solo.availability_exceptions (starts_at, ends_at);

/* ------------------------------------------------------------------ */
/* CRM                                                                 */
/* ------------------------------------------------------------------ */
create table if not exists beau_solo.crm_contacts (
  id            uuid primary key default gen_random_uuid(),
  name          text,
  email         text,
  email_norm    text generated always as (nullif(lower(btrim(email)), '')) stored,
  phone         text,
  phone_norm    text generated always as (nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '')) stored,
  company       text,
  country       text,
  lang          text check (lang is null or lang in ('fr','en','ru')),
  status        text not null default 'lead' check (status in ('lead','client','archived')),
  source        text,
  needs_review  boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists contacts_email on beau_solo.crm_contacts (email_norm);
create index if not exists contacts_phone on beau_solo.crm_contacts (phone_norm);
create or replace trigger contacts_touch before update on beau_solo.crm_contacts
  for each row execute function beau_solo.touch();

-- Conservative matching: a single contact with that email, else a single one
-- with that phone, else a new person. An ambiguous match never merges.
create or replace function beau_solo.link_contact(p_name text, p_email text, p_phone text, p_lang text, p_source text, p_country text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  v_ids uuid[];
  v_id uuid;
begin
  if v_email is not null then
    select array_agg(id) into v_ids from beau_solo.crm_contacts where email_norm = v_email and status <> 'archived';
  end if;
  if coalesce(cardinality(v_ids), 0) = 0 and v_phone is not null and length(v_phone) >= 7 then
    select array_agg(id) into v_ids from beau_solo.crm_contacts where phone_norm = v_phone and status <> 'archived';
  end if;
  if cardinality(v_ids) = 1 then
    v_id := v_ids[1];
    update beau_solo.crm_contacts set
      last_seen_at = now(),
      name = coalesce(name, nullif(btrim(p_name), '')),
      phone = coalesce(phone, nullif(btrim(p_phone), '')),
      email = coalesce(email, v_email),
      lang = coalesce(lang, p_lang),
      country = coalesce(country, nullif(btrim(p_country), ''))
    where id = v_id;
    return v_id;
  end if;
  insert into beau_solo.crm_contacts (name, email, phone, lang, source, country, needs_review)
  values (nullif(btrim(p_name), ''), v_email, nullif(btrim(p_phone), ''), p_lang, p_source, nullif(btrim(p_country), ''), coalesce(cardinality(v_ids), 0) > 1)
  returning id into v_id;
  return v_id;
end $$;

create table if not exists beau_solo.enquiries (
  id             uuid primary key default gen_random_uuid(),
  crm_contact_id uuid references beau_solo.crm_contacts(id) on delete set null,
  name           text not null,
  email          text not null,
  phone          text,
  country        text,
  need           text,
  message        text not null,
  details        jsonb not null default '{}',   -- budget, goal, zone…
  lang           text check (lang is null or lang in ('fr','en','ru')),
  page           text,
  status         text not null default 'new' check (status in ('new','handled','archived','spam')),
  ip_hash        text,
  created_at     timestamptz not null default now()
);
create index if not exists enquiries_status on beau_solo.enquiries (status, created_at desc);
create index if not exists enquiries_ip on beau_solo.enquiries (ip_hash, created_at);

create table if not exists beau_solo.crm_notes (
  id             uuid primary key default gen_random_uuid(),
  crm_contact_id uuid not null references beau_solo.crm_contacts(id) on delete cascade,
  body           text not null check (length(btrim(body)) between 1 and 5000),
  pinned         boolean not null default false,
  author         text,
  created_at     timestamptz not null default now(),
  edited_at      timestamptz
);

/* ------------------------------------------------------------------ */
/* bookings                                                            */
/* ------------------------------------------------------------------ */
create table if not exists beau_solo.bookings (
  id               uuid primary key default gen_random_uuid(),
  ref              text not null unique default upper(encode(extensions.gen_random_bytes(4), 'hex')),
  type_id          uuid not null references beau_solo.appointment_types(id),
  title            text not null,            -- type title at booking time, in the client's language
  starts_at        timestamptz not null,
  ends_at          timestamptz not null check (ends_at > starts_at),
  blocked_until    timestamptz not null check (blocked_until >= ends_at),   -- ends_at + buffer
  status           text not null check (status in ('pending','confirmed','cancelled','completed','no_show')),
  mode             text not null check (mode in ('video','phone','in_person')),
  location_id      uuid references beau_solo.locations(id),
  location_name    text,                     -- snapshot sent to the client
  location_address text,
  meeting_url      text check (meeting_url is null or meeting_url ~ '^https://'),
  crm_contact_id   uuid references beau_solo.crm_contacts(id) on delete set null,
  name             text not null,
  email            text,
  phone            text,
  lang             text not null default 'fr' check (lang in ('fr','en','ru')),
  client_tz        text,
  message          text,
  price_amount     numeric(12,2) not null default 0,
  currency         text not null default 'USD',
  source           text not null check (source in ('site','admin')),
  manage_token_hash text,
  cancel_reason    text,
  cancelled_by     text check (cancelled_by is null or cancelled_by in ('client','staff')),
  internal_note    text,
  ip_hash          text,
  created_by       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (source = 'admin' or email is not null),
  constraint bookings_no_overlap exclude using gist (tstzrange(starts_at, blocked_until, '[)') with &&)
    where (status in ('pending','confirmed'))
);
create index if not exists bookings_starts on beau_solo.bookings (starts_at);
create index if not exists bookings_contact on beau_solo.bookings (crm_contact_id);
create or replace trigger bookings_touch before update on beau_solo.bookings
  for each row execute function beau_solo.touch();

/* ------------------------------------------------------------------ */
/* notification outbox (sent by a worker once an email sender is set)  */
/* ------------------------------------------------------------------ */
create table if not exists beau_solo.outbox (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,
  recipient  text not null check (recipient in ('client','staff')),
  to_email   text,
  lang       text not null default 'fr',
  payload    jsonb not null default '{}',
  dedupe_key text unique,
  status     text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  attempts   int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index if not exists outbox_queued on beau_solo.outbox (status, created_at);

create or replace function beau_solo.notify(p_kind text, p_recipient text, p_to text, p_lang text, p_payload jsonb, p_key text)
returns void language sql security definer set search_path = '' as $$
  insert into beau_solo.outbox (kind, recipient, to_email, lang, payload, dedupe_key)
  values (p_kind, p_recipient,
          case when p_recipient = 'staff' then (select notify_email from beau_solo.settings) else p_to end,
          coalesce(p_lang, 'fr'), coalesce(p_payload, '{}'), p_key)
  on conflict (dedupe_key) do nothing
$$;

/* ------------------------------------------------------------------ */
/* availability                                                        */
/* ------------------------------------------------------------------ */
-- Free start times for one appointment type between two local dates
-- (inclusive), at most 62 days. Respects weekly hours, open/closed
-- exceptions, notice, horizon and every pending/confirmed booking + buffer.
create or replace function beau_solo.available_slots(p_type_id uuid, p_from date, p_to date)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with s as (select timezone, slot_step_min from beau_solo.settings),
  t as (select * from beau_solo.appointment_types where id = p_type_id and active),
  days as (
    select d::date as d
    from s, generate_series(greatest(p_from, (now() at time zone s.timezone)::date),
                            least(p_to, p_from + 62), interval '1 day') d
  ),
  windows as (
    select (days.d + r.start_time) at time zone s.timezone as w_start,
           (days.d + r.end_time)   at time zone s.timezone as w_end
    from days, s, beau_solo.availability_rules r
    where r.active and r.weekday = extract(dow from days.d)
    union all
    select e.starts_at, e.ends_at
    from beau_solo.availability_exceptions e, s
    where e.kind = 'open' and e.deleted_at is null
      and e.ends_at > (p_from::timestamp at time zone s.timezone)
      and e.starts_at < ((p_to + 1)::timestamp at time zone s.timezone)
  ),
  cand as (
    select distinct g as st
    from windows w, t, s,
         generate_series(w.w_start, w.w_end - make_interval(mins => t.duration_min), make_interval(mins => s.slot_step_min)) g
  )
  select c.st, c.st + make_interval(mins => t.duration_min)
  from cand c, t
  where c.st >= now() + make_interval(hours => t.min_notice_hours)
    and c.st <= now() + make_interval(days => t.max_days_ahead)
    and not exists (
      select 1 from beau_solo.availability_exceptions e
      where e.kind = 'closed' and e.deleted_at is null
        and tstzrange(e.starts_at, e.ends_at, '[)') && tstzrange(c.st, c.st + make_interval(mins => t.duration_min), '[)'))
    and not exists (
      select 1 from beau_solo.bookings b
      where b.status in ('pending','confirmed')
        and tstzrange(b.starts_at, b.blocked_until, '[)')
            && tstzrange(c.st, c.st + make_interval(mins => t.duration_min + t.buffer_min), '[)'))
  order by 1
$$;

create or replace function beau_solo.type_title(p_title jsonb, p_lang text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(p_title ->> p_lang, p_title ->> 'fr')
$$;

/* ------------------------------------------------------------------ */
/* public API — service role only (solo-public Edge Function)          */
/* ------------------------------------------------------------------ */
create or replace function public.solo_public_types(p_lang text default 'fr')
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', t.slug,
    'title', beau_solo.type_title(t.title, p_lang),
    'description', coalesce(t.description ->> p_lang, t.description ->> 'fr'),
    'mode', t.mode,
    'duration_min', t.duration_min,
    'price_amount', t.price_amount,
    'currency', t.currency,
    'requires_approval', t.requires_approval or t.price_amount > 0,
    'location', case when t.mode = 'in_person' and t.location_policy = 'fixed' then
      (select jsonb_build_object('name', l.name, 'city', l.city, 'country', l.country) from beau_solo.locations l where l.id = t.location_id)
      end
  ) order by t.sort, t.duration_min), '[]'::jsonb)
  from beau_solo.appointment_types t
  where t.active and t.public
$$;

create or replace function public.solo_public_slots(p_type text, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'timezone', (select timezone from beau_solo.settings),
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object('starts_at', s.starts_at, 'ends_at', s.ends_at) order by s.starts_at)
      from beau_solo.appointment_types t, beau_solo.available_slots(t.id, p_from, p_to) s
      where t.slug = p_type and t.active and t.public), '[]'::jsonb))
$$;

-- p: {type, starts_at, name, email, phone, lang, message, client_tz, ip_hash}
create or replace function public.solo_public_book(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t beau_solo.appointment_types;
  v_start timestamptz := (p ->> 'starts_at')::timestamptz;
  v_email text := nullif(lower(btrim(coalesce(p ->> 'email', ''))), '');
  v_name text := nullif(btrim(coalesce(p ->> 'name', '')), '');
  v_lang text := case when p ->> 'lang' in ('fr','en','ru') then p ->> 'lang' else 'fr' end;
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_contact uuid;
  v_status text;
  b beau_solo.bookings;
  l beau_solo.locations;
begin
  select * into t from beau_solo.appointment_types where slug = p ->> 'type' and active and public;
  if not found then raise exception 'unknown_type' using errcode = 'P0002'; end if;
  if v_name is null or length(v_name) > 120 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then raise exception 'invalid_email' using errcode = '22023'; end if;
  if length(coalesce(p ->> 'message', '')) > 3000 then raise exception 'invalid_message' using errcode = '22023'; end if;
  -- anti-abuse: at most 3 upcoming bookings per email, 10 per IP and day
  if (select count(*) from beau_solo.bookings where lower(email) = v_email and status in ('pending','confirmed') and starts_at > now()) >= 3
     or (p ->> 'ip_hash' is not null and (select count(*) from beau_solo.bookings where ip_hash = p ->> 'ip_hash' and created_at > now() - interval '1 day') >= 10) then
    raise exception 'too_many_bookings' using errcode = 'P0001';
  end if;
  -- serialise bookings so two visitors cannot take the same time
  perform pg_advisory_xact_lock(hashtext('beau_solo.bookings'));
  if not exists (select 1 from beau_solo.available_slots(t.id, (v_start at time zone (select timezone from beau_solo.settings))::date,
                                                          (v_start at time zone (select timezone from beau_solo.settings))::date) s
                 where s.starts_at = v_start) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;
  v_status := case when t.requires_approval or t.price_amount > 0 then 'pending' else 'confirmed' end;
  v_contact := beau_solo.link_contact(v_name, v_email, p ->> 'phone', v_lang, 'booking');
  if t.location_id is not null then select * into l from beau_solo.locations where id = t.location_id; end if;
  insert into beau_solo.bookings (type_id, title, starts_at, ends_at, blocked_until, status, mode,
    location_id, location_name, location_address, crm_contact_id, name, email, phone, lang, client_tz, message,
    price_amount, currency, source, manage_token_hash, ip_hash)
  values (t.id, beau_solo.type_title(t.title, v_lang), v_start, v_start + make_interval(mins => t.duration_min),
    v_start + make_interval(mins => t.duration_min + t.buffer_min), v_status, t.mode,
    l.id, l.name, concat_ws(', ', l.address, l.city, l.country), v_contact, v_name, v_email,
    nullif(btrim(coalesce(p ->> 'phone', '')), ''), v_lang, nullif(p ->> 'client_tz', ''), nullif(btrim(coalesce(p ->> 'message', '')), ''),
    t.price_amount, t.currency, 'site', encode(extensions.digest(v_token, 'sha256'), 'hex'), p ->> 'ip_hash')
  returning * into b;
  perform beau_solo.notify('booking_received', 'client', b.email, b.lang, jsonb_build_object('ref', b.ref, 'token', v_token), 'booking_received:' || b.id);
  perform beau_solo.notify('booking_new', 'staff', null, 'fr', jsonb_build_object('ref', b.ref, 'booking_id', b.id), 'booking_new:' || b.id);
  return jsonb_build_object('ref', b.ref, 'token', v_token, 'status', b.status, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
                            'title', b.title, 'mode', b.mode, 'location_name', b.location_name, 'location_address', nullif(b.location_address, ''));
exception
  when exclusion_violation then raise exception 'slot_unavailable' using errcode = 'P0001';
end $$;

create or replace function beau_solo.find_booking(p_ref text, p_token text) returns beau_solo.bookings
language sql stable security definer set search_path = '' as $$
  select * from beau_solo.bookings
  where ref = upper(btrim(p_ref)) and manage_token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

create or replace function public.solo_public_booking(p_ref text, p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare b beau_solo.bookings; l beau_solo.locations;
begin
  b := beau_solo.find_booking(p_ref, p_token);
  if b.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if b.location_id is not null then select * into l from beau_solo.locations where id = b.location_id; end if;
  return jsonb_build_object('ref', b.ref, 'status', b.status, 'title', b.title, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
    'mode', b.mode, 'name', b.name, 'lang', b.lang, 'timezone', (select timezone from beau_solo.settings),
    'location_name', b.location_name, 'location_address', nullif(b.location_address, ''), 'maps_url', l.maps_url,
    'client_note', l.client_note, 'meeting_url', b.meeting_url,
    'can_cancel', b.status in ('pending','confirmed') and b.starts_at > now());
end $$;

create or replace function public.solo_public_cancel(p_ref text, p_token text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b beau_solo.bookings;
begin
  b := beau_solo.find_booking(p_ref, p_token);
  if b.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if b.status not in ('pending','confirmed') or b.starts_at <= now() then raise exception 'not_cancellable' using errcode = 'P0001'; end if;
  update beau_solo.bookings set status = 'cancelled', cancelled_by = 'client', cancel_reason = left(nullif(btrim(p_reason), ''), 1000)
  where id = b.id;
  perform beau_solo.notify('booking_cancelled', 'staff', null, 'fr', jsonb_build_object('ref', b.ref, 'booking_id', b.id, 'by', 'client'), 'booking_cancelled:' || b.id);
  return jsonb_build_object('ref', b.ref, 'status', 'cancelled');
end $$;

-- p: {name, email, phone, country, need, message, lang, page, details, ip_hash}
create or replace function public.solo_public_enquiry(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := nullif(lower(btrim(coalesce(p ->> 'email', ''))), '');
  v_name text := nullif(btrim(coalesce(p ->> 'name', '')), '');
  v_msg text := nullif(btrim(coalesce(p ->> 'message', '')), '');
  v_lang text := case when p ->> 'lang' in ('fr','en','ru') then p ->> 'lang' else 'fr' end;
  v_contact uuid;
  v_id uuid;
begin
  if v_name is null or length(v_name) > 120 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then raise exception 'invalid_email' using errcode = '22023'; end if;
  if v_msg is null or length(v_msg) > 5000 then raise exception 'invalid_message' using errcode = '22023'; end if;
  if (select count(*) from beau_solo.enquiries where lower(email) = v_email and created_at > now() - interval '1 hour') >= 3
     or (p ->> 'ip_hash' is not null and (select count(*) from beau_solo.enquiries where ip_hash = p ->> 'ip_hash' and created_at > now() - interval '1 hour') >= 5) then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;
  v_contact := beau_solo.link_contact(v_name, v_email, p ->> 'phone', v_lang, 'enquiry', p ->> 'country');
  insert into beau_solo.enquiries (crm_contact_id, name, email, phone, country, need, message, details, lang, page, ip_hash)
  values (v_contact, v_name, v_email, left(nullif(btrim(coalesce(p ->> 'phone', '')), ''), 40), left(p ->> 'country', 80), left(p ->> 'need', 120),
          v_msg, case when jsonb_typeof(p -> 'details') = 'object' then p -> 'details' else '{}' end, v_lang, left(p ->> 'page', 200), p ->> 'ip_hash')
  returning id into v_id;
  perform beau_solo.notify('enquiry_new', 'staff', null, 'fr', jsonb_build_object('enquiry_id', v_id), 'enquiry_new:' || v_id);
  return jsonb_build_object('ok', true);
end $$;

/* ------------------------------------------------------------------ */
/* back-office API — authenticated staff, permission-checked           */
/* ------------------------------------------------------------------ */
create or replace function public.solo_admin_me()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('email', s.email, 'name', s.name, 'permissions', to_jsonb(s.permissions),
                            'timezone', (select timezone from beau_solo.settings))
  from beau_solo.staff s where s.email = beau_solo.current_email() and s.active and auth.uid() is not null
$$;

-- bookings between two instants, with the contact
create or replace function public.solo_admin_bookings(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform beau_solo.require('solo:agenda');
  return coalesce((select jsonb_agg(to_jsonb(b) - 'manage_token_hash' - 'ip_hash' order by b.starts_at)
    from beau_solo.bookings b where b.starts_at < p_to and b.ends_at > p_from), '[]'::jsonb);
end $$;

create or replace function public.solo_admin_booking_status(p_id uuid, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor text := beau_solo.require('solo:agenda'); b beau_solo.bookings;
begin
  if p_status not in ('pending','confirmed','cancelled','completed','no_show') then raise exception 'invalid_status' using errcode = '22023'; end if;
  update beau_solo.bookings set status = p_status,
    cancelled_by = case when p_status = 'cancelled' then 'staff' else cancelled_by end,
    cancel_reason = case when p_status = 'cancelled' then left(nullif(btrim(p_note), ''), 1000) else cancel_reason end
  where id = p_id returning * into b;
  if b.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_status in ('confirmed','cancelled') and b.email is not null then
    perform beau_solo.notify('booking_' || p_status, 'client', b.email, b.lang, jsonb_build_object('ref', b.ref), 'booking_' || p_status || ':' || b.id || ':' || extract(epoch from now())::bigint);
  end if;
  if p_status = 'completed' and b.crm_contact_id is not null then
    update beau_solo.crm_contacts set status = 'client' where id = b.crm_contact_id and status = 'lead';
  end if;
  perform beau_solo.log('booking', 'status', b.ref, jsonb_build_object('status', p_status));
  return to_jsonb(b) - 'manage_token_hash' - 'ip_hash';
exception when exclusion_violation then raise exception 'slot_unavailable' using errcode = 'P0001';
end $$;

-- Darya books (or reschedules) herself: any type, any place, optionally
-- outside her published hours. p: {id?, type_id, starts_at, duration_min?, status?,
-- location_id?, location_name?, location_address?, meeting_url?, crm_contact_id?,
-- name, email?, phone?, lang?, message?, internal_note?, notify_client?}
create or replace function public.solo_admin_booking_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor text := beau_solo.require('solo:agenda');
  t beau_solo.appointment_types;
  l beau_solo.locations;
  b beau_solo.bookings;
  v_start timestamptz := (p ->> 'starts_at')::timestamptz;
  v_dur int;
  v_lang text := case when p ->> 'lang' in ('fr','en','ru') then p ->> 'lang' else 'fr' end;
  v_contact uuid := nullif(p ->> 'crm_contact_id', '')::uuid;
  v_name text := nullif(btrim(coalesce(p ->> 'name', '')), '');
begin
  select * into t from beau_solo.appointment_types where id = (p ->> 'type_id')::uuid;
  if not found then raise exception 'unknown_type' using errcode = 'P0002'; end if;
  v_dur := coalesce((p ->> 'duration_min')::int, t.duration_min);
  if v_dur not between 10 and 720 then raise exception 'invalid_duration' using errcode = '22023'; end if;
  if nullif(p ->> 'location_id', '') is not null then
    select * into l from beau_solo.locations where id = (p ->> 'location_id')::uuid;
  elsif t.location_policy = 'fixed' and t.location_id is not null then
    select * into l from beau_solo.locations where id = t.location_id;
  end if;
  if v_contact is null and v_name is not null then
    v_contact := beau_solo.link_contact(v_name, p ->> 'email', p ->> 'phone', v_lang, 'admin');
  elsif v_contact is not null and v_name is null then
    select name into v_name from beau_solo.crm_contacts where id = v_contact;
  end if;
  if v_name is null then raise exception 'invalid_name' using errcode = '22023'; end if;
  if nullif(p ->> 'id', '') is null then
    insert into beau_solo.bookings (type_id, title, starts_at, ends_at, blocked_until, status, mode, location_id, location_name,
      location_address, meeting_url, crm_contact_id, name, email, phone, lang, message, internal_note, price_amount, currency, source, created_by)
    values (t.id, beau_solo.type_title(t.title, v_lang), v_start, v_start + make_interval(mins => v_dur),
      v_start + make_interval(mins => v_dur + t.buffer_min), coalesce(p ->> 'status', 'confirmed'), t.mode, l.id,
      coalesce(nullif(btrim(p ->> 'location_name'), ''), l.name),
      coalesce(nullif(btrim(p ->> 'location_address'), ''), nullif(concat_ws(', ', l.address, l.city, l.country), '')),
      nullif(btrim(coalesce(p ->> 'meeting_url', '')), ''), v_contact, v_name, nullif(lower(btrim(coalesce(p ->> 'email', ''))), ''),
      nullif(btrim(coalesce(p ->> 'phone', '')), ''), v_lang, nullif(btrim(coalesce(p ->> 'message', '')), ''),
      nullif(btrim(coalesce(p ->> 'internal_note', '')), ''), t.price_amount, t.currency, 'admin', v_actor)
    returning * into b;
    perform beau_solo.log('booking', 'create', b.ref, '{}');
  else
    update beau_solo.bookings set type_id = t.id, starts_at = v_start, ends_at = v_start + make_interval(mins => v_dur),
      blocked_until = v_start + make_interval(mins => v_dur + t.buffer_min), mode = t.mode, location_id = l.id,
      location_name = coalesce(nullif(btrim(p ->> 'location_name'), ''), l.name),
      location_address = coalesce(nullif(btrim(p ->> 'location_address'), ''), nullif(concat_ws(', ', l.address, l.city, l.country), '')),
      meeting_url = nullif(btrim(coalesce(p ->> 'meeting_url', '')), ''), crm_contact_id = v_contact, name = v_name,
      email = nullif(lower(btrim(coalesce(p ->> 'email', ''))), ''), phone = nullif(btrim(coalesce(p ->> 'phone', '')), ''), lang = v_lang,
      internal_note = nullif(btrim(coalesce(p ->> 'internal_note', '')), ''), status = coalesce(p ->> 'status', status)
    where id = (p ->> 'id')::uuid returning * into b;
    if b.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    perform beau_solo.log('booking', 'update', b.ref, '{}');
  end if;
  if coalesce((p ->> 'notify_client')::boolean, false) and b.email is not null then
    perform beau_solo.notify('booking_scheduled', 'client', b.email, b.lang, jsonb_build_object('ref', b.ref), 'booking_scheduled:' || b.id || ':' || extract(epoch from now())::bigint);
  end if;
  return to_jsonb(b) - 'manage_token_hash' - 'ip_hash';
exception when exclusion_violation then raise exception 'slot_unavailable' using errcode = 'P0001';
end $$;

/* hours and blocks */
create or replace function public.solo_admin_hours()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform beau_solo.require('solo:agenda');
  return jsonb_build_object(
    'settings', (select to_jsonb(s) - 'id' from beau_solo.settings s),
    'rules', coalesce((select jsonb_agg(jsonb_build_object('weekday', weekday, 'start', to_char(start_time, 'HH24:MI'), 'end', to_char(end_time, 'HH24:MI')) order by weekday, start_time) from beau_solo.availability_rules where active), '[]'::jsonb));
end $$;

-- replaces the whole weekly pattern: [{weekday, start: 'HH:MI', end: 'HH:MI'}]
create or replace function public.solo_admin_hours_set(p_rules jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform beau_solo.require('solo:agenda');
  -- upsert the new pattern, then switch off the rules it no longer contains
  insert into beau_solo.availability_rules (weekday, start_time, end_time, active)
  select (r ->> 'weekday')::smallint, (r ->> 'start')::time, (r ->> 'end')::time, true from jsonb_array_elements(p_rules) r
  on conflict (weekday, start_time) do update set end_time = excluded.end_time, active = true;
  update beau_solo.availability_rules a set active = false
  where a.active and not exists (select 1 from jsonb_array_elements(p_rules) r
                    where (r ->> 'weekday')::smallint = a.weekday and (r ->> 'start')::time = a.start_time);
  perform beau_solo.log('hours', 'set', null, jsonb_build_object('rules', jsonb_array_length(p_rules)));
  return public.solo_admin_hours();
end $$;

create or replace function public.solo_admin_settings_set(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform beau_solo.require('solo:settings');
  update beau_solo.settings set
    timezone = coalesce(nullif(p ->> 'timezone', ''), timezone),
    slot_step_min = coalesce((p ->> 'slot_step_min')::int, slot_step_min),
    notify_email = case when p ? 'notify_email' then nullif(lower(btrim(p ->> 'notify_email')), '') else notify_email end,
    updated_at = now()
  where id;
  perform beau_solo.log('settings', 'set', null, '{}');
  return (select to_jsonb(s) - 'id' from beau_solo.settings s);
end $$;

create or replace function public.solo_admin_exceptions(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform beau_solo.require('solo:agenda');
  return coalesce((select jsonb_agg(to_jsonb(e) - 'deleted_at' order by e.starts_at) from beau_solo.availability_exceptions e
    where e.deleted_at is null and e.starts_at < p_to and e.ends_at > p_from), '[]'::jsonb);
end $$;

create or replace function public.solo_admin_exception_add(p_kind text, p_starts timestamptz, p_ends timestamptz, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor text := beau_solo.require('solo:agenda'); e beau_solo.availability_exceptions;
begin
  insert into beau_solo.availability_exceptions (kind, starts_at, ends_at, reason, created_by)
  values (p_kind, p_starts, p_ends, left(nullif(btrim(p_reason), ''), 200), v_actor) returning * into e;
  perform beau_solo.log('hours', 'exception_add', e.id::text, jsonb_build_object('kind', p_kind));
  return to_jsonb(e);
end $$;

create or replace function public.solo_admin_exception_delete(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform beau_solo.require('solo:agenda');
  update beau_solo.availability_exceptions set deleted_at = now() where id = p_id and deleted_at is null;
  perform beau_solo.log('hours', 'exception_delete', p_id::text, '{}');
end $$;

-- One tap blocks a whole local day; a second tap frees it (only blocks made this way).
create or replace function public.solo_admin_day_toggle(p_day date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor text := beau_solo.require('solo:agenda');
  v_tz text := (select timezone from beau_solo.settings);
  v_start timestamptz := p_day::timestamp at time zone v_tz;
  v_end timestamptz := (p_day + 1)::timestamp at time zone v_tz;
  v_id uuid;
begin
  select id into v_id from beau_solo.availability_exceptions
  where kind = 'closed' and starts_at = v_start and ends_at = v_end and reason = 'day_off' and deleted_at is null;
  if v_id is not null then
    update beau_solo.availability_exceptions set deleted_at = now() where id = v_id;
    perform beau_solo.log('hours', 'day_open', p_day::text, '{}');
    return jsonb_build_object('day', p_day, 'blocked', false);
  end if;
  insert into beau_solo.availability_exceptions (kind, starts_at, ends_at, reason, created_by) values ('closed', v_start, v_end, 'day_off', v_actor);
  perform beau_solo.log('hours', 'day_off', p_day::text, '{}');
  return jsonb_build_object('day', p_day, 'blocked', true);
end $$;

/* places and appointment types */
create or replace function public.solo_admin_catalog()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not (beau_solo.can('solo:agenda') or beau_solo.can('solo:settings')) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'types', coalesce((select jsonb_agg(to_jsonb(t) order by t.sort, t.created_at) from beau_solo.appointment_types t), '[]'::jsonb),
    'locations', coalesce((select jsonb_agg(to_jsonb(l) order by l.kind, l.name) from beau_solo.locations l), '[]'::jsonb));
end $$;

create or replace function public.solo_admin_location_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare l beau_solo.locations;
begin
  perform beau_solo.require('solo:settings');
  if nullif(p ->> 'id', '') is null then
    insert into beau_solo.locations (name, kind, address, city, country, maps_url, client_note, notes, active)
    values (btrim(p ->> 'name'), p ->> 'kind', nullif(btrim(p ->> 'address'), ''), nullif(btrim(p ->> 'city'), ''), nullif(btrim(p ->> 'country'), ''),
            nullif(btrim(p ->> 'maps_url'), ''), nullif(btrim(p ->> 'client_note'), ''), nullif(btrim(p ->> 'notes'), ''), coalesce((p ->> 'active')::boolean, true))
    returning * into l;
  else
    update beau_solo.locations set name = btrim(p ->> 'name'), kind = p ->> 'kind', address = nullif(btrim(p ->> 'address'), ''),
      city = nullif(btrim(p ->> 'city'), ''), country = nullif(btrim(p ->> 'country'), ''), maps_url = nullif(btrim(p ->> 'maps_url'), ''),
      client_note = nullif(btrim(p ->> 'client_note'), ''), notes = nullif(btrim(p ->> 'notes'), ''), active = coalesce((p ->> 'active')::boolean, active)
    where id = (p ->> 'id')::uuid returning * into l;
    if l.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  end if;
  perform beau_solo.log('settings', 'location_save', l.id::text, '{}');
  return to_jsonb(l);
end $$;

create or replace function public.solo_admin_type_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t beau_solo.appointment_types;
begin
  perform beau_solo.require('solo:settings');
  if nullif(p ->> 'id', '') is null then
    insert into beau_solo.appointment_types (slug, title, description, mode, location_policy, location_id, duration_min, buffer_min,
      min_notice_hours, max_days_ahead, price_amount, currency, requires_approval, public, active, sort)
    values (p ->> 'slug', p -> 'title', coalesce(p -> 'description', '{}'), p ->> 'mode', coalesce(p ->> 'location_policy', 'fixed'),
      nullif(p ->> 'location_id', '')::uuid, (p ->> 'duration_min')::int, coalesce((p ->> 'buffer_min')::int, 0),
      coalesce((p ->> 'min_notice_hours')::int, 12), coalesce((p ->> 'max_days_ahead')::int, 60), coalesce((p ->> 'price_amount')::numeric, 0),
      coalesce(nullif(p ->> 'currency', ''), 'USD'), coalesce((p ->> 'requires_approval')::boolean, false), coalesce((p ->> 'public')::boolean, true),
      coalesce((p ->> 'active')::boolean, true), coalesce((p ->> 'sort')::int, 100))
    returning * into t;
  else
    update beau_solo.appointment_types set slug = p ->> 'slug', title = p -> 'title', description = coalesce(p -> 'description', '{}'),
      mode = p ->> 'mode', location_policy = coalesce(p ->> 'location_policy', 'fixed'), location_id = nullif(p ->> 'location_id', '')::uuid,
      duration_min = (p ->> 'duration_min')::int, buffer_min = coalesce((p ->> 'buffer_min')::int, 0),
      min_notice_hours = coalesce((p ->> 'min_notice_hours')::int, 12), max_days_ahead = coalesce((p ->> 'max_days_ahead')::int, 60),
      price_amount = coalesce((p ->> 'price_amount')::numeric, 0), currency = coalesce(nullif(p ->> 'currency', ''), 'USD'),
      requires_approval = coalesce((p ->> 'requires_approval')::boolean, false), public = coalesce((p ->> 'public')::boolean, true),
      active = coalesce((p ->> 'active')::boolean, true), sort = coalesce((p ->> 'sort')::int, 100)
    where id = (p ->> 'id')::uuid returning * into t;
    if t.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  end if;
  perform beau_solo.log('settings', 'type_save', t.slug, '{}');
  return to_jsonb(t);
end $$;

/* CRM */
create or replace function public.solo_admin_enquiries(p_status text default 'new')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform beau_solo.require('solo:crm');
  return coalesce((select jsonb_agg(to_jsonb(e) - 'ip_hash' order by e.created_at desc) from (
    select * from beau_solo.enquiries where p_status is null or status = p_status order by created_at desc limit 200) e), '[]'::jsonb);
end $$;

create or replace function public.solo_admin_enquiry_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform beau_solo.require('solo:crm');
  if p_status not in ('new','handled','archived','spam') then raise exception 'invalid_status' using errcode = '22023'; end if;
  update beau_solo.enquiries set status = p_status where id = p_id;
  perform beau_solo.log('enquiry', 'status', p_id::text, jsonb_build_object('status', p_status));
end $$;

create or replace function public.solo_admin_contacts(p_search text default null, p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_q text := nullif(lower(btrim(coalesce(p_search, ''))), '');
begin
  perform beau_solo.require('solo:crm');
  return coalesce((select jsonb_agg(c order by c ->> 'last_seen_at' desc) from (
    select to_jsonb(x) || jsonb_build_object(
      'enquiries', (select count(*) from beau_solo.enquiries e where e.crm_contact_id = x.id),
      'bookings', (select count(*) from beau_solo.bookings b where b.crm_contact_id = x.id)) c
    from beau_solo.crm_contacts x
    where (p_status is null or x.status = p_status)
      and (v_q is null or strpos(lower(coalesce(x.name, '')), v_q) > 0 or strpos(coalesce(x.email_norm, ''), v_q) > 0
           or (regexp_replace(v_q, '[^0-9]', '', 'g') <> '' and strpos(coalesce(x.phone_norm, ''), regexp_replace(v_q, '[^0-9]', '', 'g')) > 0)
           or strpos(lower(coalesce(x.company, '')), v_q) > 0)
    order by x.last_seen_at desc limit 200) s), '[]'::jsonb);
end $$;

create or replace function public.solo_admin_contact(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform beau_solo.require('solo:crm');
  return (select to_jsonb(c) || jsonb_build_object(
    'enquiries', coalesce((select jsonb_agg(to_jsonb(e) - 'ip_hash' order by e.created_at desc) from beau_solo.enquiries e where e.crm_contact_id = c.id), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(to_jsonb(b) - 'manage_token_hash' - 'ip_hash' order by b.starts_at desc) from beau_solo.bookings b where b.crm_contact_id = c.id), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(to_jsonb(n) order by n.pinned desc, n.created_at desc) from beau_solo.crm_notes n where n.crm_contact_id = c.id), '[]'::jsonb))
  from beau_solo.crm_contacts c where c.id = p_id);
end $$;

create or replace function public.solo_admin_contact_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c beau_solo.crm_contacts;
begin
  perform beau_solo.require('solo:crm');
  if nullif(p ->> 'id', '') is null then
    insert into beau_solo.crm_contacts (name, email, phone, company, country, lang, status, source)
    values (nullif(btrim(p ->> 'name'), ''), nullif(lower(btrim(p ->> 'email')), ''), nullif(btrim(p ->> 'phone'), ''), nullif(btrim(p ->> 'company'), ''),
            nullif(btrim(p ->> 'country'), ''), nullif(p ->> 'lang', ''), coalesce(nullif(p ->> 'status', ''), 'lead'), 'admin')
    returning * into c;
  else
    update beau_solo.crm_contacts set name = nullif(btrim(p ->> 'name'), ''), email = nullif(lower(btrim(p ->> 'email')), ''),
      phone = nullif(btrim(p ->> 'phone'), ''), company = nullif(btrim(p ->> 'company'), ''), country = nullif(btrim(p ->> 'country'), ''),
      lang = nullif(p ->> 'lang', ''), status = coalesce(nullif(p ->> 'status', ''), status), needs_review = coalesce((p ->> 'needs_review')::boolean, needs_review)
    where id = (p ->> 'id')::uuid returning * into c;
    if c.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  end if;
  perform beau_solo.log('crm', 'contact_save', c.id::text, '{}');
  return to_jsonb(c);
end $$;

create or replace function public.solo_admin_note_add(p_contact uuid, p_body text, p_pinned boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor text := beau_solo.require('solo:crm'); n beau_solo.crm_notes;
begin
  insert into beau_solo.crm_notes (crm_contact_id, body, pinned, author) values (p_contact, btrim(p_body), coalesce(p_pinned, false), v_actor) returning * into n;
  perform beau_solo.log('crm', 'note_add', p_contact::text, '{}');
  return to_jsonb(n);
end $$;

create or replace function public.solo_admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_tz text := (select timezone from beau_solo.settings);
begin
  if beau_solo.current_email() is null or not exists (select 1 from beau_solo.staff where email = beau_solo.current_email() and active) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'timezone', v_tz,
    'upcoming', case when beau_solo.can('solo:agenda') then coalesce((select jsonb_agg(to_jsonb(b) - 'manage_token_hash' - 'ip_hash' order by b.starts_at) from (
        select * from beau_solo.bookings where status in ('pending','confirmed') and ends_at > now() order by starts_at limit 12) b), '[]'::jsonb) end,
    'pending', case when beau_solo.can('solo:agenda') then (select count(*) from beau_solo.bookings where status = 'pending' and starts_at > now()) end,
    'new_enquiries', case when beau_solo.can('solo:crm') then (select count(*) from beau_solo.enquiries where status = 'new') end,
    'needs_review', case when beau_solo.can('solo:crm') then (select count(*) from beau_solo.crm_contacts where needs_review) end);
end $$;

/* ------------------------------------------------------------------ */
/* privileges                                                          */
/* ------------------------------------------------------------------ */
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and starts_with(p.proname, 'solo_') loop
    execute 'revoke all on function ' || f.sig::text || ' from public, anon, authenticated';
    if starts_with(f.proname, 'solo_public_') then
      execute 'grant execute on function ' || f.sig::text || ' to service_role';
    else
      execute 'grant execute on function ' || f.sig::text || ' to authenticated';
    end if;
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'beau_solo' loop
    execute 'revoke all on function ' || f.sig::text || ' from public, anon, authenticated';
  end loop;
end $$;

revoke all on all tables in schema beau_solo from public, anon, authenticated;
alter default privileges in schema beau_solo revoke all on tables from public, anon, authenticated;
alter default privileges in schema beau_solo revoke all on functions from public, anon, authenticated;

-- holds no rows until staff are granted; row level security as a second wall
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'beau_solo' loop
    execute 'alter table beau_solo.' || quote_ident(t.tablename) || ' enable row level security';
  end loop;
end $$;

insert into beau_solo.schema_versions (version, note) values ('0001_p1_core', 'P1: agenda, booking, CRM') on conflict do nothing;
