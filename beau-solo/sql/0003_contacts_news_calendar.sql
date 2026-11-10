-- BEAU Solo 0003 — richer contacts, an actionable news feed (France / UAE),
-- calendar sync (a private iCal feed out, busy times in from Proton, Google
-- or any calendar that publishes a secret iCal address). Same file rules as
-- 0001: idempotent, no DROP, no DELETE, no UPDATE without WHERE, no percent sign.

/* ------------------------------------------------------------------ */
/* contacts: what Darya needs to know about a person                   */
/* ------------------------------------------------------------------ */
alter table beau_solo.crm_contacts
  add column if not exists first_name       text,
  add column if not exists last_name        text,
  add column if not exists role             text,
  add column if not exists website          text,
  add column if not exists linkedin         text,
  add column if not exists whatsapp         boolean not null default false,
  add column if not exists city             text,
  add column if not exists address_line     text,
  add column if not exists postal_code      text,
  add column if not exists nationality      text,
  add column if not exists timezone         text,
  add column if not exists destinations     text[] not null default '{}',
  add column if not exists services         text[] not null default '{}',
  add column if not exists stage            text not null default 'new',
  add column if not exists budget           text,
  add column if not exists referred_by      text,
  add column if not exists tags             text[] not null default '{}',
  add column if not exists next_action      text,
  add column if not exists next_action_on   date,
  add column if not exists created_by       text;

do $$ begin
  alter table beau_solo.crm_contacts add constraint contacts_stage_check
    check (stage in ('new','qualified','proposal','negotiation','won','lost'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table beau_solo.crm_contacts add constraint contacts_destinations_check
    check (destinations <@ array['emirats','georgie','france']::text[]);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table beau_solo.crm_contacts add constraint contacts_services_check
    check (services <@ array['societe','visa','banque','immobilier','comptabilite','installation']::text[]);
exception when duplicate_object then null; end $$;

-- a text[] from a json array of strings, trimmed, empty values dropped
create or replace function beau_solo.text_list(p jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct btrim(v)) filter (where btrim(v) <> ''), '{}')
  from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) v
$$;

create or replace function public.solo_admin_contact_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor text := beau_solo.require('solo:crm');
  c beau_solo.crm_contacts;
  v_first text := nullif(btrim(p ->> 'first_name'), '');
  v_last text := nullif(btrim(p ->> 'last_name'), '');
  v_name text := coalesce(nullif(btrim(p ->> 'name'), ''), nullif(btrim(concat_ws(' ', v_first, v_last)), ''));
  v_email text := nullif(lower(btrim(p ->> 'email')), '');
begin
  if v_name is null and v_email is null and nullif(btrim(p ->> 'company'), '') is null then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if nullif(p ->> 'id', '') is null then
    insert into beau_solo.crm_contacts (name, email, status, source, created_by) values (v_name, v_email, 'lead', 'admin', v_actor) returning * into c;
  else
    select * into c from beau_solo.crm_contacts where id = (p ->> 'id')::uuid;
    if c.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  end if;
  update beau_solo.crm_contacts set
    name = v_name, first_name = v_first, last_name = v_last, email = v_email,
    phone = nullif(btrim(p ->> 'phone'), ''), whatsapp = coalesce((p ->> 'whatsapp')::boolean, false),
    company = nullif(btrim(p ->> 'company'), ''), role = nullif(btrim(p ->> 'role'), ''),
    website = nullif(btrim(p ->> 'website'), ''), linkedin = nullif(btrim(p ->> 'linkedin'), ''),
    country = nullif(btrim(p ->> 'country'), ''), city = nullif(btrim(p ->> 'city'), ''),
    address_line = nullif(btrim(p ->> 'address_line'), ''), postal_code = nullif(btrim(p ->> 'postal_code'), ''),
    nationality = nullif(btrim(p ->> 'nationality'), ''), timezone = nullif(p ->> 'timezone', ''),
    lang = nullif(p ->> 'lang', ''),
    destinations = beau_solo.text_list(p -> 'destinations'), services = beau_solo.text_list(p -> 'services'),
    stage = coalesce(nullif(p ->> 'stage', ''), stage), status = coalesce(nullif(p ->> 'status', ''), status),
    budget = nullif(btrim(p ->> 'budget'), ''), source = coalesce(nullif(btrim(p ->> 'source'), ''), source),
    referred_by = nullif(btrim(p ->> 'referred_by'), ''), tags = beau_solo.text_list(p -> 'tags'),
    next_action = nullif(btrim(p ->> 'next_action'), ''), next_action_on = nullif(p ->> 'next_action_on', '')::date,
    needs_review = coalesce((p ->> 'needs_review')::boolean, needs_review)
  where id = c.id returning * into c;
  perform beau_solo.log('crm', 'contact_save', c.id::text, '{}');
  -- a first note typed in the creation form
  if nullif(p ->> 'id', '') is null and nullif(btrim(p ->> 'note'), '') is not null then
    insert into beau_solo.crm_notes (crm_contact_id, body, author) values (c.id, btrim(p ->> 'note'), v_actor);
  end if;
  return to_jsonb(c);
end $$;

-- the list also finds a city, a tag or a role, and filters by stage
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
    where (p_status is null or x.status = p_status or x.stage = p_status)
      and (v_q is null or strpos(lower(concat_ws(' ', x.name, x.company, x.role, x.city, x.country, array_to_string(x.tags, ' '))), v_q) > 0
           or strpos(coalesce(x.email_norm, ''), v_q) > 0
           or (regexp_replace(v_q, '[^0-9]', '', 'g') <> '' and strpos(coalesce(x.phone_norm, ''), regexp_replace(v_q, '[^0-9]', '', 'g')) > 0))
    order by x.last_seen_at desc limit 300) s), '[]'::jsonb);
end $$;

-- Import a list of people (CSV or vCard read in the browser). A row matching
-- exactly one contact by email, else by phone, fills that card's empty fields;
-- otherwise it becomes a new contact. Nothing already on a card is overwritten.
create or replace function public.solo_admin_contacts_import(p_rows jsonb, p_source text default 'Import')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor text := beau_solo.require('solo:crm');
  r jsonb; v_ids uuid[]; v_id uuid;
  v_email text; v_phone text; v_first text; v_last text; v_name text;
  v_created int := 0; v_merged int := 0; v_skipped int := 0; v_ambiguous int := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then raise exception 'invalid_import' using errcode = '22023'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_email := nullif(lower(btrim(r ->> 'email')), '');
    if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then v_email := null; end if;
    v_phone := nullif(btrim(r ->> 'phone'), '');
    v_first := nullif(btrim(r ->> 'first_name'), ''); v_last := nullif(btrim(r ->> 'last_name'), '');
    v_name := coalesce(nullif(btrim(r ->> 'name'), ''), nullif(btrim(concat_ws(' ', v_first, v_last)), ''));
    if v_name is null and v_email is null and v_phone is null then v_skipped := v_skipped + 1; continue; end if;
    v_ids := null;
    if v_email is not null then select array_agg(id) into v_ids from beau_solo.crm_contacts where email_norm = v_email; end if;
    -- the same number written +33 6…, 0033 6… or 06…: its last nine digits
    if coalesce(cardinality(v_ids), 0) = 0 and v_phone is not null and length(regexp_replace(v_phone, '[^0-9]', '', 'g')) >= 9 then
      select array_agg(id) into v_ids from beau_solo.crm_contacts
      where length(phone_norm) >= 9 and right(phone_norm, 9) = right(regexp_replace(v_phone, '[^0-9]', '', 'g'), 9);
    end if;
    if cardinality(v_ids) = 1 then
      update beau_solo.crm_contacts set
        name = coalesce(name, v_name), first_name = coalesce(first_name, v_first), last_name = coalesce(last_name, v_last),
        email = coalesce(email, v_email), phone = coalesce(phone, v_phone),
        company = coalesce(company, nullif(btrim(r ->> 'company'), '')), role = coalesce(role, nullif(btrim(r ->> 'role'), '')),
        city = coalesce(city, nullif(btrim(r ->> 'city'), '')), country = coalesce(country, nullif(btrim(r ->> 'country'), '')),
        address_line = coalesce(address_line, nullif(btrim(r ->> 'address_line'), '')), postal_code = coalesce(postal_code, nullif(btrim(r ->> 'postal_code'), '')),
        website = coalesce(website, nullif(btrim(r ->> 'website'), '')), linkedin = coalesce(linkedin, nullif(btrim(r ->> 'linkedin'), '')),
        tags = (select coalesce(array_agg(distinct t), '{}') from unnest(tags || beau_solo.text_list(r -> 'tags')) t)
      where id = v_ids[1];
      v_id := v_ids[1]; v_merged := v_merged + 1;
    else
      insert into beau_solo.crm_contacts (name, first_name, last_name, email, phone, company, role, city, country, address_line, postal_code, website, linkedin,
        tags, source, created_by, needs_review)
      values (v_name, v_first, v_last, v_email, v_phone, nullif(btrim(r ->> 'company'), ''), nullif(btrim(r ->> 'role'), ''), nullif(btrim(r ->> 'city'), ''),
        nullif(btrim(r ->> 'country'), ''), nullif(btrim(r ->> 'address_line'), ''), nullif(btrim(r ->> 'postal_code'), ''), nullif(btrim(r ->> 'website'), ''),
        nullif(btrim(r ->> 'linkedin'), ''), beau_solo.text_list(r -> 'tags'), coalesce(nullif(btrim(p_source), ''), 'Import'), v_actor, coalesce(cardinality(v_ids), 0) > 1)
      returning id into v_id;
      v_created := v_created + 1;
      if coalesce(cardinality(v_ids), 0) > 1 then v_ambiguous := v_ambiguous + 1; end if;
    end if;
    if nullif(btrim(r ->> 'note'), '') is not null then
      insert into beau_solo.crm_notes (crm_contact_id, body, author) values (v_id, left(btrim(r ->> 'note'), 5000), v_actor);
    end if;
  end loop;
  perform beau_solo.log('crm', 'contacts_import', null, jsonb_build_object('created', v_created, 'merged', v_merged, 'skipped', v_skipped));
  return jsonb_build_object('created', v_created, 'merged', v_merged, 'skipped', v_skipped, 'to_review', v_ambiguous);
end $$;

/* ------------------------------------------------------------------ */
/* news: official and press feeds, France and UAE, each item triaged    */
/* ------------------------------------------------------------------ */
create table if not exists beau_solo.news_sources (
  id              uuid primary key default gen_random_uuid(),
  region          text not null check (region in ('fr','ae')),
  name            text not null,
  url             text not null unique check (url ~ '^https://'),
  active          boolean not null default true,
  last_fetched_at timestamptz,
  last_ok_at      timestamptz,
  last_error      text,
  created_at      timestamptz not null default now()
);

create table if not exists beau_solo.news_items (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid not null references beau_solo.news_sources(id),
  region       text not null check (region in ('fr','ae')),
  guid         text not null,
  title        text not null,
  link         text,
  summary      text,
  published_at timestamptz,
  topics       text[] not null default '{}',
  status       text not null default 'new' check (status in ('new','todo','done','dismissed')),
  note         text,
  crm_contact_id uuid references beau_solo.crm_contacts(id),
  acted_by     text,
  acted_at     timestamptz,
  fetched_at   timestamptz not null default now(),
  unique (source_id, guid)
);
create index if not exists news_region_date on beau_solo.news_items (region, published_at desc);
alter table beau_solo.news_sources enable row level security;
alter table beau_solo.news_items enable row level security;

-- What makes a headline worth Darya's time: the subjects her clients ask about.
-- A title and summary matching none of them still shows, lower down.
create or replace function beau_solo.news_topics(p_text text) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(t.topic order by t.topic), '{}') from (values
    ('visa',        '(visa|golden|résiden|residen|residency|emirates id|titre de séjour|passeport|immigration|icp|gdrfa)'),
    ('société',     '(société|entreprise|company|companies|free ?zone|freezone|mainland|licen[cs]e|rakez|dso|dmcc|ifza|meydan|création|incorporation|auto-entrepreneur|micro-entreprise|sasu|eurl)'),
    ('fiscalité',   '(impôt|impot|fiscal|tax|tva|vat|corporate tax|cotisation|urssaf|prélèvement|déclaration|e-invoic|facturation électronique|esr|ubo)'),
    ('banque',      '(banque|bank|compte|account|iban|aml|kyc|crédit|credit|prêt|loan)'),
    ('immobilier',  '(immobilier|real estate|property|properties|off-plan|rera|dld|loyer|rent|achat|mortgage|notaire)'),
    ('emploi',      '(emploi|salari|employ|mohre|work permit|permis de travail|wps|gratuity|end of service|labour|labor)'),
    ('géorgie',     '(géorgie|georgia|tbilisi|tbilissi|batumi)')
  ) as t(topic, pattern)
  where lower(coalesce(p_text, '')) ~ t.pattern
$$;

-- service role: the sources due for a fetch (every 2 hours), oldest first
create or replace function public.solo_news_due(p_limit int default 20)
returns jsonb language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'region', s.region, 'url', s.url) order by s.last_fetched_at nulls first), '[]'::jsonb)
  from (select * from beau_solo.news_sources
        where active and (last_fetched_at is null or last_fetched_at < now() - interval '110 minutes')
        order by last_fetched_at nulls first limit greatest(1, least(p_limit, 50))) s
$$;

-- service role: store what a fetch found (new items only; a known guid is left as it is)
create or replace function public.solo_news_ingest(p_source uuid, p_items jsonb, p_error text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare v_src beau_solo.news_sources; v_n int := 0;
begin
  select * into v_src from beau_solo.news_sources where id = p_source;
  if v_src.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  update beau_solo.news_sources set last_fetched_at = now(),
    last_ok_at = case when p_error is null then now() else last_ok_at end, last_error = left(p_error, 500)
  where id = p_source;
  if p_error is not null then return 0; end if;
  with input as (
    select left(btrim(i ->> 'guid'), 500) as guid, left(btrim(i ->> 'title'), 400) as title,
           nullif(left(btrim(i ->> 'link'), 1000), '') as link, nullif(left(btrim(i ->> 'summary'), 1200), '') as summary,
           case when (i ->> 'published_at') ~ '^[0-9]{4}-' then least((i ->> 'published_at')::timestamptz, now()) end as published_at
    from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) i
    limit 200
  ), ins as (
    insert into beau_solo.news_items (source_id, region, guid, title, link, summary, published_at, topics)
    select p_source, v_src.region, guid, title, case when link ~ '^https?://' then link end, summary,
           coalesce(published_at, now()), beau_solo.news_topics(title || ' ' || coalesce(summary, ''))
    from input where guid <> '' and title <> ''
    on conflict (source_id, guid) do nothing
    returning 1)
  select count(*) into v_n from ins;
  return v_n;
end $$;

-- staff: the feed of one region. 'inbox' = new and to-do; or one status.
-- Relevant items (a topic matched) come first within the last 14 days.
create or replace function public.solo_admin_news(p_region text, p_view text default 'inbox', p_limit int default 40)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if beau_solo.current_email() is null or not exists (select 1 from beau_solo.staff where email = beau_solo.current_email() and active) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(x) order by x.rank, x.published_at desc) from (
      select n.id, n.region, n.title, n.link, n.summary, n.published_at, n.topics, n.status, n.note, n.crm_contact_id, n.acted_by, n.acted_at,
             s.name as source, (select c.name from beau_solo.crm_contacts c where c.id = n.crm_contact_id) as contact_name,
             case when n.status = 'todo' then 0 when cardinality(n.topics) > 0 then 1 else 2 end as rank
      from beau_solo.news_items n join beau_solo.news_sources s on s.id = n.source_id
      where n.region = p_region
        and case p_view when 'inbox' then n.status in ('new','todo') and n.published_at > now() - interval '14 days'
                        when 'all' then true else n.status = p_view end
      order by rank, n.published_at desc limit greatest(1, least(p_limit, 200))) x), '[]'::jsonb),
    'counts', (select jsonb_build_object(
      'todo', count(*) filter (where status = 'todo'),
      'new', count(*) filter (where status = 'new' and published_at > now() - interval '14 days'))
      from beau_solo.news_items where region = p_region),
    'sources', (select jsonb_build_object('total', count(*), 'failing', count(*) filter (where last_error is not null), 'last', max(last_ok_at))
      from beau_solo.news_sources where region = p_region and active));
end $$;

create or replace function public.solo_admin_news_set(p_id uuid, p_status text, p_note text default null, p_contact uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor text := beau_solo.require('solo:crm'); n beau_solo.news_items;
begin
  if p_status not in ('new','todo','done','dismissed') then raise exception 'invalid_status' using errcode = '22023'; end if;
  update beau_solo.news_items set status = p_status, note = coalesce(nullif(btrim(p_note), ''), note),
    crm_contact_id = coalesce(p_contact, crm_contact_id), acted_by = v_actor, acted_at = now()
  where id = p_id returning * into n;
  if n.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  -- an item tied to a client also lands in that client's notes
  if p_contact is not null then
    insert into beau_solo.crm_notes (crm_contact_id, body, author)
    values (p_contact, 'Actualité : ' || n.title || coalesce(E'\n' || n.link, '') || coalesce(E'\n' || nullif(btrim(p_note), ''), ''), v_actor);
  end if;
  perform beau_solo.log('news', 'set', p_id::text, jsonb_build_object('status', p_status));
  return to_jsonb(n);
end $$;

create or replace function public.solo_admin_news_sources()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform beau_solo.require('solo:settings');
  return coalesce((select jsonb_agg(to_jsonb(s) order by s.region, s.name) from beau_solo.news_sources s), '[]'::jsonb);
end $$;

create or replace function public.solo_admin_news_source_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s beau_solo.news_sources;
begin
  perform beau_solo.require('solo:settings');
  if coalesce(p ->> 'url', '') !~ '^https://' then raise exception 'invalid_url' using errcode = '22023'; end if;
  if nullif(p ->> 'id', '') is null then
    insert into beau_solo.news_sources (region, name, url) values (p ->> 'region', btrim(p ->> 'name'), btrim(p ->> 'url')) returning * into s;
  else
    update beau_solo.news_sources set region = p ->> 'region', name = btrim(p ->> 'name'), url = btrim(p ->> 'url'),
      active = coalesce((p ->> 'active')::boolean, active), last_fetched_at = null
    where id = (p ->> 'id')::uuid returning * into s;
  end if;
  perform beau_solo.log('news', 'source_save', s.id::text, '{}');
  return to_jsonb(s);
end $$;

/* ------------------------------------------------------------------ */
/* calendar: a private iCal feed out, busy times in                     */
/* ------------------------------------------------------------------ */
-- One feed per staff member; only the SHA-256 of its token is kept.
create table if not exists beau_solo.calendar_feeds (
  email           text primary key,
  token_sha256    bytea not null unique,
  created_at      timestamptz not null default now(),
  last_fetched_at timestamptz,
  fetches         int not null default 0
);
alter table beau_solo.calendar_feeds enable row level security;

-- Calendars Darya already keeps elsewhere (Proton, Google, Apple): their
-- secret iCal address is read every 15 minutes and their busy times block
-- the site's slots. The address is a secret: it never leaves the database
-- except to the sync function, and the back office only sees its host.
create table if not exists beau_solo.external_calendars (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  label          text not null,
  url            text not null check (url ~ '^https://'),
  active         boolean not null default true,
  last_synced_at timestamptz,
  last_ok_at     timestamptz,
  last_error     text,
  events         int not null default 0,
  -- what the last good sync read, from now on: the busy times as one value
  -- (rewritten whole at each sync, so nothing piles up) and their titles
  busy           tstzmultirange not null default '{}',
  busy_events    jsonb not null default '[]',
  created_at     timestamptz not null default now()
);
alter table beau_solo.external_calendars enable row level security;

create or replace function public.solo_admin_calendar_feed()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_actor text := beau_solo.require('solo:agenda');
begin
  return jsonb_build_object(
    'feed', (select jsonb_build_object('created_at', created_at, 'last_fetched_at', last_fetched_at, 'fetches', fetches) from beau_solo.calendar_feeds where email = v_actor),
    'calendars', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'label', label, 'host', substring(url from '^https://([^/]+)'), 'active', active,
        'last_synced_at', last_synced_at, 'last_ok_at', last_ok_at, 'last_error', last_error, 'events', events) order by created_at)
      from beau_solo.external_calendars where email = v_actor), '[]'::jsonb));
end $$;

-- a new private address; the previous one stops working. The token is returned once.
create or replace function public.solo_admin_calendar_feed_issue()
returns text language plpgsql security definer set search_path = '' as $$
declare v_actor text := beau_solo.require('solo:agenda'); v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  insert into beau_solo.calendar_feeds (email, token_sha256) values (v_actor, extensions.digest(v_token, 'sha256'))
  on conflict (email) do update set token_sha256 = excluded.token_sha256, created_at = now(), last_fetched_at = null, fetches = 0;
  perform beau_solo.log('calendar', 'feed_issue', v_actor, '{}');
  return v_token;
end $$;

create or replace function public.solo_admin_calendar_feed_revoke()
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor text := beau_solo.require('solo:agenda');
begin
  -- no DELETE in these files: an unusable random hash replaces the token
  update beau_solo.calendar_feeds set token_sha256 = extensions.gen_random_bytes(32) where email = v_actor;
  perform beau_solo.log('calendar', 'feed_revoke', v_actor, '{}');
end $$;

create or replace function public.solo_admin_calendar_add(p_label text, p_url text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor text := beau_solo.require('solo:agenda'); v_url text := btrim(regexp_replace(coalesce(p_url, ''), '^webcal://', 'https://')); c beau_solo.external_calendars;
begin
  if v_url !~ '^https://[^/[:space:]]+/' then raise exception 'invalid_url' using errcode = '22023'; end if;
  insert into beau_solo.external_calendars (email, label, url) values (v_actor, coalesce(nullif(btrim(p_label), ''), 'Agenda'), v_url) returning * into c;
  perform beau_solo.log('calendar', 'external_add', c.id::text, jsonb_build_object('host', substring(v_url from '^https://([^/]+)')));
  return jsonb_build_object('id', c.id);
end $$;

create or replace function public.solo_admin_calendar_set(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor text := beau_solo.require('solo:agenda');
begin
  update beau_solo.external_calendars set active = p_active, last_synced_at = null where id = p_id and email = v_actor;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

-- service role: the feed behind a token (bookings 60 days back, a year ahead)
create or replace function public.solo_calendar_feed(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
  update beau_solo.calendar_feeds set last_fetched_at = now(), fetches = fetches + 1
  where token_sha256 = extensions.digest(coalesce(p_token, ''), 'sha256') returning email into v_email;
  if v_email is null or not exists (select 1 from beau_solo.staff where email = v_email and active) then return null; end if;
  return jsonb_build_object('name', (select name from beau_solo.staff where email = v_email), 'timezone', (select timezone from beau_solo.settings),
    'bookings', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'ref', b.ref, 'title', b.title, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'status', b.status, 'mode', b.mode, 'name', b.name, 'email', b.email, 'phone', b.phone, 'meeting_url', b.meeting_url,
        'location', nullif(concat_ws(', ', b.location_name, b.location_address), ''), 'message', b.message, 'note', b.internal_note,
        'updated_at', b.updated_at) order by b.starts_at)
      from beau_solo.bookings b
      where b.status in ('pending','confirmed','completed') and b.starts_at > now() - interval '60 days' and b.starts_at < now() + interval '366 days'), '[]'::jsonb));
end $$;

-- service role: the calendars due for a sync (every 15 minutes), with their address
create or replace function public.solo_calendar_due(p_limit int default 10)
returns jsonb language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'url', c.url, 'timezone', (select timezone from beau_solo.settings))), '[]'::jsonb)
  from (select id, url from beau_solo.external_calendars
        where active and (last_synced_at is null or last_synced_at < now() - interval '14 minutes')
        order by last_synced_at nulls first limit greatest(1, least(p_limit, 20))) c
$$;

-- service role: replace a calendar's busy times with what the sync read.
-- An error keeps the previous busy times, so a failing calendar never opens the diary.
create or replace function public.solo_calendar_store(p_id uuid, p_events jsonb, p_error text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare v_events jsonb; v_n int;
begin
  if p_error is not null then
    update beau_solo.external_calendars set last_synced_at = now(), last_error = left(p_error, 500) where id = p_id;
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    return 0;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('start', s, 'end', e, 'summary', left(x ->> 'summary', 200)) order by s), '[]'::jsonb), count(*)
  into v_events, v_n
  from (select (x ->> 'start')::timestamptz s, (x ->> 'end')::timestamptz e, x
        from jsonb_array_elements(case when jsonb_typeof(p_events) = 'array' then p_events else '[]'::jsonb end) x
        limit 2000) ev
  where e > s and e > now();
  update beau_solo.external_calendars set last_synced_at = now(), last_ok_at = now(), last_error = null, events = v_n, busy_events = v_events,
    busy = coalesce((select range_agg(tstzrange((v ->> 'start')::timestamptz, (v ->> 'end')::timestamptz, '[)')) from jsonb_array_elements(v_events) v), '{}')
  where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return v_n;
end $$;

-- availability now also skips the busy times of active external calendars
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
      select 1 from beau_solo.external_calendars k
      where k.active and k.busy && tstzrange(c.st, c.st + make_interval(mins => t.duration_min + t.buffer_min), '[)'))
    and not exists (
      select 1 from beau_solo.bookings b
      where b.status in ('pending','confirmed')
        and tstzrange(b.starts_at, b.blocked_until, '[)')
            && tstzrange(c.st, c.st + make_interval(mins => t.duration_min + t.buffer_min), '[)'))
  order by 1
$$;

-- the diary shows the external busy times beside the bookings
create or replace function public.solo_admin_busy(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform beau_solo.require('solo:agenda');
  return coalesce((select jsonb_agg(jsonb_build_object('calendar', k.label, 'starts_at', v ->> 'start', 'ends_at', v ->> 'end', 'summary', v ->> 'summary') order by v ->> 'start')
    from beau_solo.external_calendars k, jsonb_array_elements(k.busy_events) v
    where k.active and (v ->> 'end')::timestamptz > p_from and (v ->> 'start')::timestamptz < p_to), '[]'::jsonb);
end $$;

/* ------------------------------------------------------------------ */
/* grants                                                              */
/* ------------------------------------------------------------------ */
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in (
             'solo_admin_contact_save','solo_admin_contacts','solo_admin_contacts_import','solo_admin_news','solo_admin_news_set','solo_admin_news_sources','solo_admin_news_source_save',
             'solo_admin_calendar_feed','solo_admin_calendar_feed_issue','solo_admin_calendar_feed_revoke','solo_admin_calendar_add','solo_admin_calendar_set','solo_admin_busy',
             'solo_news_due','solo_news_ingest','solo_calendar_feed','solo_calendar_due','solo_calendar_store') loop
    execute 'revoke all on function ' || f.sig::text || ' from public, anon, authenticated';
    if left(f.proname::text, 11) = 'solo_admin_' then
      execute 'grant execute on function ' || f.sig::text || ' to authenticated';
    else
      execute 'grant execute on function ' || f.sig::text || ' to service_role';
    end if;
  end loop;
end $$;

insert into beau_solo.schema_versions (version, note) values ('0003_contacts_news_calendar', 'Richer contacts, news feed, calendar sync') on conflict do nothing;
