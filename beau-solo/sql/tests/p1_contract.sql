-- BEAU Solo P1 contract suite. Runs in one transaction and rolls back.
-- Local:  psql -v ON_ERROR_STOP=1 -f tests/supabase_stub.sql -f 0001_p1_core.sql -f tests/p1_contract.sql
-- Prints "SOLO_P1 ok=<n>" when every check passes; the first failure aborts.
begin;
set local client_min_messages = warning;
create temp table _r (n int);
insert into _r values (0);
create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', label; end if;
  update _r set n = n + 1;
end $$;
create or replace function pg_temp.as_staff(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'email', p_email, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create or replace function pg_temp.reset_role() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', true); end $$;

-- fixtures: every day 09:00–18:00 Dubai, a free 30-min call with a 15-min buffer
delete from beau_solo.availability_rules;
insert into beau_solo.availability_rules (weekday, start_time, end_time) select d, '09:00', '18:00' from generate_series(0, 6) d;
update beau_solo.settings set timezone = 'Asia/Dubai', slot_step_min = 30, notify_email = 'staff@example.com';
insert into beau_solo.locations (id, name, kind, address, city, country) values
  ('00000000-0000-0000-0000-00000000000a', 'Bureau test', 'office', '1 Test Street', 'Dubai', 'AE'),
  ('00000000-0000-0000-0000-00000000000b', 'Notaire test', 'partner', '2 Partner Road', 'Tbilisi', 'GE');
insert into beau_solo.appointment_types (id, slug, title, mode, duration_min, buffer_min, min_notice_hours, max_days_ahead, public) values
  ('00000000-0000-0000-0000-000000000001', 't-call', '{"fr":"Appel","en":"Call","ru":"Звонок"}', 'video', 30, 15, 0, 60, true);
insert into beau_solo.appointment_types (id, slug, title, mode, location_id, duration_min, price_amount, min_notice_hours, public) values
  ('00000000-0000-0000-0000-000000000002', 't-paid', '{"fr":"Consultation"}', 'in_person', '00000000-0000-0000-0000-00000000000a', 60, 300, 0, true);
insert into beau_solo.appointment_types (id, slug, title, mode, location_policy, duration_min, public) values
  ('00000000-0000-0000-0000-000000000003', 't-visit', '{"fr":"Visite partenaire"}', 'in_person', 'to_define', 60, false);
insert into beau_solo.staff (email, name, permissions) values
  ('darya@example.com', 'Darya', array['solo:admin']),
  ('crm@example.com', 'CRM only', array['solo:crm']);

create temp table _ctx as select ((now() at time zone 'Asia/Dubai')::date + 3) as d;
grant all on _r, _ctx to authenticated, service_role;

-- 1. availability
select pg_temp.ok((select count(*) from beau_solo.available_slots('00000000-0000-0000-0000-000000000001', (select d from _ctx), (select d from _ctx))) = 18, 'a day 09:00–18:00 offers 18 half-hour starts');
select pg_temp.ok((select min(starts_at) from beau_solo.available_slots('00000000-0000-0000-0000-000000000001', (select d from _ctx), (select d from _ctx)))
  = ((select d from _ctx) + time '09:00') at time zone 'Asia/Dubai', 'first slot is 09:00 Dubai time');
select pg_temp.ok(jsonb_array_length(public.solo_public_types('en')) = 2, 'only active public types are listed');
select pg_temp.ok(public.solo_public_types('en') -> 0 ->> 'title' = 'Call', 'type title follows the language');
select pg_temp.ok((public.solo_public_types('en') -> 1 ->> 'requires_approval')::boolean, 'a priced type is announced as needing confirmation');

-- 2. booking from the site
create temp table _b as select public.solo_public_book(jsonb_build_object('type', 't-call',
  'starts_at', ((select d from _ctx) + time '09:00') at time zone 'Asia/Dubai', 'name', 'Alice Martin', 'email', 'Alice@Example.com',
  'phone', '+33 6 12 34 56 78', 'lang', 'en', 'message', 'Hello')) as r;
grant all on _b to authenticated, service_role;
select pg_temp.ok((select r ->> 'status' from _b) = 'confirmed', 'a free call is confirmed at once');
select pg_temp.ok((select length(r ->> 'token') from _b) = 48, 'a 48-char manage token is returned once');
select pg_temp.ok((select manage_token_hash from beau_solo.bookings where ref = (select r ->> 'ref' from _b)) <> (select r ->> 'token' from _b), 'only the token hash is stored');
select pg_temp.ok((select count(*) from beau_solo.available_slots('00000000-0000-0000-0000-000000000001', (select d from _ctx), (select d from _ctx))) = 16,
  'the booking and its buffer remove 09:00 and 09:30');
do $$ begin
  perform public.solo_public_book(jsonb_build_object('type', 't-call', 'starts_at', ((select d from _ctx) + time '09:00') at time zone 'Asia/Dubai', 'name', 'Bob', 'email', 'bob@example.com'));
  raise exception 'FAIL: double booking accepted';
exception when others then
  if sqlerrm <> 'slot_unavailable' then raise; end if;
end $$;
select pg_temp.ok(true, 'the same time cannot be booked twice');
do $$ begin
  perform public.solo_public_book(jsonb_build_object('type', 't-call', 'starts_at', ((select d from _ctx) + time '09:10') at time zone 'Asia/Dubai', 'name', 'Bob', 'email', 'bob@example.com'));
  raise exception 'FAIL: off-grid time accepted';
exception when others then
  if sqlerrm <> 'slot_unavailable' then raise; end if;
end $$;
select pg_temp.ok(true, 'a time that is not an offered slot is refused');
do $$ begin
  perform public.solo_public_book(jsonb_build_object('type', 't-visit', 'starts_at', ((select d from _ctx) + time '11:00') at time zone 'Asia/Dubai', 'name', 'Bob', 'email', 'bob@example.com'));
  raise exception 'FAIL: private type bookable';
exception when others then
  if sqlerrm <> 'unknown_type' then raise; end if;
end $$;
select pg_temp.ok(true, 'a type not published on the site cannot be booked from it');
select pg_temp.ok((select public.solo_public_book(jsonb_build_object('type', 't-paid', 'starts_at', ((select d from _ctx) + time '14:00') at time zone 'Asia/Dubai',
  'name', 'Carla', 'email', 'carla@example.com')) ->> 'status') = 'pending', 'a priced appointment waits for confirmation');
select pg_temp.ok((select location_address from beau_solo.bookings where email = 'carla@example.com') = '1 Test Street, Dubai, AE', 'the place address is snapshotted on the booking');
select pg_temp.ok((select count(*) from beau_solo.outbox where kind in ('booking_received','booking_new')) = 4, 'client and staff notifications are queued');
select pg_temp.ok((select to_email from beau_solo.outbox where kind = 'booking_new' limit 1) = 'staff@example.com', 'staff notification goes to the notify address');

-- 3. blocks
insert into beau_solo.availability_exceptions (kind, starts_at, ends_at, reason)
values ('closed', ((select d from _ctx) + time '12:00') at time zone 'Asia/Dubai', ((select d from _ctx) + time '13:00') at time zone 'Asia/Dubai', 'lunch');
select pg_temp.ok(not exists (select 1 from beau_solo.available_slots('00000000-0000-0000-0000-000000000001', (select d from _ctx), (select d from _ctx)) s
  where s.starts_at in (((select d from _ctx) + time '12:00') at time zone 'Asia/Dubai', ((select d from _ctx) + time '12:30') at time zone 'Asia/Dubai')), 'a closed block removes its slots');
insert into beau_solo.availability_exceptions (kind, starts_at, ends_at)
values ('open', ((select d from _ctx) + time '19:00') at time zone 'Asia/Dubai', ((select d from _ctx) + time '20:00') at time zone 'Asia/Dubai');
select pg_temp.ok(exists (select 1 from beau_solo.available_slots('00000000-0000-0000-0000-000000000001', (select d from _ctx), (select d from _ctx)) s
  where s.starts_at = ((select d from _ctx) + time '19:30') at time zone 'Asia/Dubai'), 'an open window adds evening slots');

-- 4. client manage link
select pg_temp.ok((select public.solo_public_booking((select r ->> 'ref' from _b), (select r ->> 'token' from _b)) ->> 'title') = 'Call', 'the manage link shows the booking');
do $$ begin
  perform public.solo_public_booking((select r ->> 'ref' from _b), 'wrong');
  raise exception 'FAIL: wrong token accepted';
exception when others then if sqlerrm <> 'not_found' then raise; end if;
end $$;
select pg_temp.ok(true, 'a wrong token reveals nothing');
select pg_temp.ok((select public.solo_public_cancel((select r ->> 'ref' from _b), (select r ->> 'token' from _b), 'changed plans') ->> 'status') = 'cancelled', 'the client can cancel');
select pg_temp.ok((select count(*) from beau_solo.available_slots('00000000-0000-0000-0000-000000000001', (select d from _ctx), (select d from _ctx))
  where starts_at = ((select d from _ctx) + time '09:00') at time zone 'Asia/Dubai') = 1, 'a cancelled slot is free again');

-- 5. CRM
select pg_temp.ok((public.solo_public_enquiry(jsonb_build_object('name', 'Alice M.', 'email', 'alice@example.com', 'message', 'Company in RAKEZ', 'lang', 'en', 'need', 'Company'))) ->> 'ok' = 'true', 'an enquiry is accepted');
select pg_temp.ok((select count(*) from beau_solo.crm_contacts where email_norm = 'alice@example.com') = 1, 'booking and enquiry from the same email are one person');
select pg_temp.ok((select phone from beau_solo.crm_contacts where email_norm = 'alice@example.com') = '+33 6 12 34 56 78', 'the person keeps the phone given at booking');
insert into beau_solo.crm_contacts (name, email) values ('Dup 1', 'dup@example.com'), ('Dup 2', 'dup@example.com');
create temp table _dup as select beau_solo.link_contact('Dup 3', 'dup@example.com', null, 'fr', 'test') as id;
select pg_temp.ok((select c.needs_review from beau_solo.crm_contacts c join _dup on _dup.id = c.id), 'an ambiguous email creates a person flagged for review');
select pg_temp.ok((select count(*) from beau_solo.crm_contacts where email_norm = 'dup@example.com') = 3, 'an ambiguous email never merges into an existing person');
do $$ begin
  perform public.solo_public_enquiry(jsonb_build_object('name', 'X', 'email', 'not-an-email', 'message', 'hi'));
  raise exception 'FAIL: invalid email accepted';
exception when others then if sqlerrm <> 'invalid_email' then raise; end if;
end $$;
select pg_temp.ok(true, 'an invalid email is refused');

-- 6. staff back-office
select pg_temp.as_staff('darya@example.com');
select pg_temp.ok(public.solo_admin_me() ->> 'name' = 'Darya', 'staff see their profile');
select pg_temp.ok((public.solo_admin_day_toggle((select d from _ctx) + 1) ->> 'blocked')::boolean, 'one tap blocks a whole day');
select pg_temp.reset_role();
select pg_temp.ok((select count(*) from beau_solo.available_slots('00000000-0000-0000-0000-000000000001', (select d from _ctx) + 1, (select d from _ctx) + 1)) = 0, 'a blocked day offers nothing');
select pg_temp.as_staff('darya@example.com');
select pg_temp.ok(not (public.solo_admin_day_toggle((select d from _ctx) + 1) ->> 'blocked')::boolean, 'a second tap frees it');
select pg_temp.ok(jsonb_array_length(public.solo_admin_hours_set('[{"weekday":1,"start":"10:00","end":"12:00"},{"weekday":1,"start":"14:00","end":"18:00"}]') -> 'rules') = 2, 'weekly hours are replaced by the new pattern');
select pg_temp.ok((public.solo_admin_hours_set('[{"weekday":1,"start":"10:00","end":"13:00"}]') -> 'rules' -> 0 ->> 'end') = '13:00', 'an existing slot of hours is updated in place');
create temp table _v as select public.solo_admin_booking_save(jsonb_build_object('type_id', '00000000-0000-0000-0000-000000000003',
  'starts_at', ((select d from _ctx) + time '20:30') at time zone 'Asia/Dubai', 'location_id', '00000000-0000-0000-0000-00000000000b',
  'name', 'Alice M.', 'email', 'alice@example.com', 'notify_client', true)) as r;
create temp table _cid as select (r ->> 'crm_contact_id')::uuid as id from _v;
select pg_temp.ok((select r ->> 'location_address' from _v) = '2 Partner Road, Tbilisi, GE', 'a partner visit carries the partner address');
select pg_temp.ok((select r ->> 'status' from _v) = 'confirmed' and (select r ->> 'source' from _v) = 'admin', 'staff can book outside published hours');
select pg_temp.ok(jsonb_array_length(public.solo_admin_bookings(now(), now() + interval '30 days')) >= 3, 'staff list the diary');
select pg_temp.ok(not (public.solo_admin_bookings(now(), now() + interval '30 days') -> 0 ? 'manage_token_hash'), 'the diary never exposes token hashes');
select pg_temp.ok(jsonb_array_length(public.solo_admin_contact((select id from _cid)) -> 'bookings') = 2,
  'the client profile shows site and staff bookings');
select pg_temp.ok((public.solo_admin_note_add((select id from _cid), 'Wants RAKEZ, 2 visas') ->> 'author') = 'darya@example.com', 'notes record their author');
select pg_temp.reset_role();

-- 7. boundaries
select pg_temp.as_staff('crm@example.com');
do $$ begin
  perform public.solo_admin_bookings(now(), now() + interval '1 day');
  raise exception 'FAIL: crm-only staff read the diary';
exception when others then if sqlerrm <> 'forbidden' then raise; end if;
end $$;
select pg_temp.ok(true, 'CRM-only staff cannot read the diary');
select pg_temp.ok(jsonb_array_length(public.solo_admin_enquiries('new')) = 1, 'CRM-only staff read enquiries');
select pg_temp.reset_role();
select pg_temp.as_staff('stranger@example.com');
do $$ begin
  perform public.solo_admin_contacts(null, null);
  raise exception 'FAIL: non-staff read contacts';
exception when others then if sqlerrm <> 'forbidden' then raise; end if;
end $$;
select pg_temp.ok(true, 'a signed-in non-staff account reads nothing');
select pg_temp.ok(public.solo_admin_me() is null, 'a non-staff account has no profile');
do $$ begin
  perform public.solo_public_book('{}'::jsonb);
  raise exception 'FAIL: authenticated called the public API';
exception when insufficient_privilege then null;
end $$;
select pg_temp.ok(true, 'signed-in users cannot call the service-only API');
do $$ begin
  perform count(*) from beau_solo.bookings;
  raise exception 'FAIL: authenticated read the table';
exception when insufficient_privilege then null;
end $$;
select pg_temp.ok(true, 'tables are unreachable directly');
select pg_temp.reset_role();
set local role anon;
do $$ begin
  perform public.solo_admin_me();
  raise exception 'FAIL: anon called the admin API';
exception when insufficient_privilege then null;
end $$;
reset role;
select pg_temp.ok(true, 'anon cannot call the admin API');

select 'SOLO_P1 ok=' || n from _r;
rollback;
