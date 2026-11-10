-- BEAU Solo 0003 contract: richer contacts, news feed, calendar sync. One transaction, rolled back.
-- Local: … -f 0003_contacts_news_calendar.sql -f tests/p3_contacts_news_calendar.sql → "SOLO_P3 ok=<n>"
begin;
set local client_min_messages = warning;
create temp table _r (n int); insert into _r values (0);
create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'FAIL: %', label; end if; update _r set n = n + 1; end $$;
create or replace function pg_temp.as_staff(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'email', p_email, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create or replace function pg_temp.reset_role() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', true); end $$;

update beau_solo.availability_rules set active = false where active;
insert into beau_solo.availability_rules (weekday, start_time, end_time) select d, '09:00', '18:00' from generate_series(0, 6) d
  on conflict (weekday, start_time) do update set active = true, end_time = '18:00';
update beau_solo.settings set timezone = 'Asia/Dubai', slot_step_min = 30 where id;
insert into beau_solo.appointment_types (id, slug, title, mode, duration_min, buffer_min, min_notice_hours, max_days_ahead, public) values
  ('00000000-0000-0000-0000-0000000000c1', 't3-call', '{"fr":"Appel"}', 'video', 30, 0, 0, 60, true) on conflict do nothing;
insert into beau_solo.staff (email, name, permissions) values ('d3@example.com', 'Darya', array['solo:admin']), ('crm3@example.com', 'CRM', array['solo:crm'])
  on conflict (email) do update set active = true, permissions = excluded.permissions;
create temp table _ctx as select ((now() at time zone 'Asia/Dubai')::date + 3) as d;
create temp table _v (k text primary key, v text);
grant all on _r, _ctx, _v to authenticated, service_role;

/* contacts */
select pg_temp.as_staff('crm3@example.com');
insert into _v select 'c', public.solo_admin_contact_save(jsonb_build_object('first_name', 'Anna', 'last_name', 'Petrova', 'email', 'Anna@Example.com ',
  'company', 'Petrova LLC', 'role', 'CEO', 'whatsapp', true, 'destinations', jsonb_build_array('emirats', 'georgie', ''), 'services', jsonb_build_array('societe', 'visa'),
  'stage', 'qualified', 'tags', jsonb_build_array('vip', ' vip '), 'next_action', 'Envoyer le devis', 'next_action_on', (current_date + 2)::text, 'note', 'Rencontrée au salon.')) ->> 'id';
select pg_temp.reset_role();
select pg_temp.ok((select name = 'Anna Petrova' and email = 'anna@example.com' and whatsapp and destinations = '{emirats,georgie}' and tags = '{vip}' and stage = 'qualified'
  from beau_solo.crm_contacts where id = (select v from _v where k = 'c')::uuid), 'a new contact keeps every field, name built from first and last name');
select pg_temp.ok((select count(*) = 1 from beau_solo.crm_notes where crm_contact_id = (select v from _v where k = 'c')::uuid and body = 'Rencontrée au salon.'), 'the creation note becomes a note');
select pg_temp.ok((select created_by = 'crm3@example.com' and source = 'admin' from beau_solo.crm_contacts where id = (select v from _v where k = 'c')::uuid), 'who created it is kept');
select pg_temp.as_staff('crm3@example.com');
select pg_temp.ok(jsonb_array_length(public.solo_admin_contacts('petrova llc', null)) = 1 and jsonb_array_length(public.solo_admin_contacts('vip', null)) = 1
  and jsonb_array_length(public.solo_admin_contacts(null, 'qualified')) = 1, 'the list finds a company, a tag, and filters by stage');
do $$ begin perform public.solo_admin_contact_save('{"destinations":["mars"],"name":"X"}'); raise exception 'FAIL: unknown destination saved'; exception when check_violation then null; end $$;
select pg_temp.ok(true, 'an unknown destination is refused');
do $$ begin perform public.solo_admin_contact_save('{"email":"not-an-email"}'); raise exception 'FAIL: bad email saved'; exception when sqlstate '22023' then null; end $$;
select pg_temp.ok(true, 'a malformed email is refused');
do $$ begin perform public.solo_admin_contact_save('{}'); raise exception 'FAIL: empty contact saved'; exception when sqlstate '22023' then null; end $$;
select pg_temp.ok(true, 'a contact needs a name, an email or a company');
select public.solo_admin_contact_save(jsonb_build_object('id', (select v from _v where k = 'c'), 'name', 'Anna P.', 'email', 'anna@example.com', 'stage', 'won', 'status', 'client'));
select pg_temp.reset_role();
select pg_temp.ok((select name = 'Anna P.' and stage = 'won' and status = 'client' and company is null from beau_solo.crm_contacts where id = (select v from _v where k = 'c')::uuid), 'an edit rewrites the card');

/* news */
insert into beau_solo.news_sources (id, region, name, url) values
  ('00000000-0000-0000-0000-0000000000f1', 'ae', 'Test UAE', 'https://example.com/ae.xml'),
  ('00000000-0000-0000-0000-0000000000f2', 'fr', 'Test FR', 'https://example.com/fr.xml');
select pg_temp.ok(jsonb_array_length(public.solo_news_due(10)) >= 2, 'new sources are due');
select pg_temp.ok(public.solo_news_ingest('00000000-0000-0000-0000-0000000000f1', jsonb_build_array(
  jsonb_build_object('guid', 'a1', 'title', 'Golden visa rules eased for investors', 'link', 'https://example.com/a1', 'published_at', now() - interval '1 hour'),
  jsonb_build_object('guid', 'a2', 'title', 'Dubai weather: a sunny week', 'link', 'javascript:alert(1)', 'published_at', now() - interval '2 hours'),
  jsonb_build_object('guid', 'a3', 'title', 'Corporate tax: new deadline for free zone companies', 'published_at', now() + interval '3 days'),
  jsonb_build_object('guid', '', 'title', 'no guid'))) = 3, 'three valid items stored, one without guid skipped');
select pg_temp.ok(public.solo_news_ingest('00000000-0000-0000-0000-0000000000f1', jsonb_build_array(jsonb_build_object('guid', 'a1', 'title', 'changed'))) = 0, 'a known item is not stored twice');
select pg_temp.ok((select topics from beau_solo.news_items where guid = 'a1') = '{visa}', 'a visa headline is tagged visa');
select pg_temp.ok((select topics @> '{fiscalité,société}' from beau_solo.news_items where guid = 'a3'), 'a corporate tax headline about free zones is tagged twice');
select pg_temp.ok((select link is null from beau_solo.news_items where guid = 'a2'), 'a non-web link is dropped');
select pg_temp.ok((select published_at <= now() from beau_solo.news_items where guid = 'a3'), 'a date in the future is brought back to now');
select pg_temp.ok(jsonb_array_length(public.solo_news_due(10)) = 1 and (public.solo_news_due(10) -> 0 ->> 'id') = '00000000-0000-0000-0000-0000000000f2', 'a fetched source is not due again at once');
select public.solo_news_ingest('00000000-0000-0000-0000-0000000000f2', null, 'HTTP 404');
select pg_temp.ok((select last_error = 'HTTP 404' and last_ok_at is null from beau_solo.news_sources where id = '00000000-0000-0000-0000-0000000000f2'), 'a failing source keeps its error');
select pg_temp.as_staff('crm3@example.com');
create temp table _n as select public.solo_admin_news('ae') as r;
select pg_temp.ok(jsonb_array_length((select r -> 'items' from _n)) = 3, 'the UAE inbox shows its three items');
select pg_temp.ok((select r -> 'items' -> 2 ->> 'title' from _n) = 'Dubai weather: a sunny week', 'an item matching no topic comes last');
select pg_temp.ok(jsonb_array_length(public.solo_admin_news('fr') -> 'items') = 0 and (public.solo_admin_news('fr') -> 'sources' ->> 'failing')::int = 1, 'the French feed is separate and says a source fails');
select pg_temp.reset_role();
insert into _v select 'a1', id from beau_solo.news_items where guid = 'a1';
select pg_temp.as_staff('crm3@example.com');
select public.solo_admin_news_set((select v from _v where k = 'a1')::uuid, 'todo', 'À envoyer à Anna', (select v from _v where k = 'c')::uuid);
select pg_temp.ok((public.solo_admin_news('ae') -> 'items' -> 0 ->> 'status') = 'todo' and (public.solo_admin_news('ae') -> 'items' -> 0 ->> 'contact_name') = 'Anna P.', 'an item to act on comes first, with its client');
select pg_temp.ok((public.solo_admin_news('ae') -> 'counts' ->> 'todo')::int = 1, 'the to-do count');
select pg_temp.reset_role();
select pg_temp.ok(exists (select 1 from beau_solo.crm_notes where crm_contact_id = (select v from _v where k = 'c')::uuid and left(body, 24) = 'Actualité : Golden visa '), 'the item lands in the client''s notes');
insert into _v select 'a2', id from beau_solo.news_items where guid = 'a2';
select pg_temp.as_staff('crm3@example.com');
select public.solo_admin_news_set((select v from _v where k = 'a2')::uuid, 'dismissed');
select pg_temp.ok(jsonb_array_length(public.solo_admin_news('ae') -> 'items') = 2 and jsonb_array_length(public.solo_admin_news('ae', 'dismissed') -> 'items') = 1, 'a dismissed item leaves the inbox');
do $$ begin perform public.solo_admin_news_sources(); raise exception 'FAIL: crm read sources'; exception when sqlstate '42501' then null; end $$;
select pg_temp.ok(true, 'sources are a settings matter');
select pg_temp.reset_role();
select pg_temp.as_staff('stranger@example.com');
do $$ begin perform public.solo_admin_news('ae'); raise exception 'FAIL: stranger read news'; exception when sqlstate '42501' then null; end $$;
select pg_temp.ok(true, 'a signed-in stranger reads no news');
select pg_temp.reset_role();
set local role authenticated;
do $$ begin perform public.solo_news_ingest('00000000-0000-0000-0000-0000000000f1', '[]'); raise exception 'FAIL: authenticated ingested'; exception when insufficient_privilege then null; end $$;
reset role;
select pg_temp.ok(true, 'only the service role ingests');

/* calendar: the feed out */
select pg_temp.as_staff('d3@example.com');
insert into _v select 't', public.solo_admin_calendar_feed_issue();
select pg_temp.reset_role();
select pg_temp.as_staff('d3@example.com');
insert into _v select 'b', public.solo_admin_booking_save(jsonb_build_object('type_id', '00000000-0000-0000-0000-0000000000c1', 'name', 'Client feed',
  'starts_at', ((select d from _ctx) + time '10:00') at time zone 'Asia/Dubai', 'duration_min', 30)) ->> 'id';
select pg_temp.reset_role();
select pg_temp.ok((public.solo_calendar_feed((select v from _v where k = 't')) -> 'bookings') @> jsonb_build_array(jsonb_build_object('name', 'Client feed')), 'the feed lists the booking');
select pg_temp.ok((select fetches = 1 from beau_solo.calendar_feeds where email = 'd3@example.com'), 'a fetch is counted');
select pg_temp.ok(public.solo_calendar_feed('wrong') is null, 'a wrong token reads nothing');
select pg_temp.ok((select token_sha256 <> extensions.digest((select v from _v where k = 't'), 'sha256') is false from beau_solo.calendar_feeds where email = 'd3@example.com'), 'only the hash is stored');
select pg_temp.as_staff('d3@example.com');
select public.solo_admin_calendar_feed_revoke();
select pg_temp.reset_role();
select pg_temp.ok(public.solo_calendar_feed((select v from _v where k = 't')) is null, 'a revoked feed reads nothing');

/* calendar: busy times in */
select pg_temp.as_staff('d3@example.com');
do $$ begin perform public.solo_admin_calendar_add('Proton', 'http://calendar.proton.me/x'); raise exception 'FAIL: http accepted'; exception when sqlstate '22023' then null; end $$;
select pg_temp.ok(true, 'only https (or webcal) addresses');
insert into _v select 'k', public.solo_admin_calendar_add('Proton', 'webcal://calendar.proton.me/api/calendar/v1/url/secret/calendar.ics') ->> 'id';
select pg_temp.ok((select (public.solo_admin_calendar_feed() -> 'calendars' -> 0 ->> 'host') = 'calendar.proton.me'
  and not ((public.solo_admin_calendar_feed() -> 'calendars' -> 0) ? 'url')), 'the back office sees the host, never the secret address');
select pg_temp.reset_role();
select pg_temp.ok((public.solo_calendar_due(10) -> 0 ->> 'url') like 'https://calendar.proton.me/%', 'the sync gets the address, webcal turned to https');
create temp table _slots0 as select count(*) n from beau_solo.available_slots('00000000-0000-0000-0000-0000000000c1', (select d from _ctx), (select d from _ctx));
select pg_temp.ok(public.solo_calendar_store((select v from _v where k = 'k')::uuid, jsonb_build_array(
  jsonb_build_object('start', ((select d from _ctx) + time '14:00') at time zone 'Asia/Dubai', 'end', ((select d from _ctx) + time '15:00') at time zone 'Asia/Dubai', 'summary', 'Dentiste'),
  jsonb_build_object('start', now() - interval '3 hours', 'end', now() - interval '2 hours', 'summary', 'Passé'))) = 1, 'a past event is not kept');
select pg_temp.ok((select n from _slots0) - (select count(*) from beau_solo.available_slots('00000000-0000-0000-0000-0000000000c1', (select d from _ctx), (select d from _ctx))) = 2,
  'a busy hour removes the starts that overlap it (14:00 and 14:30)');
select public.solo_calendar_store((select v from _v where k = 'k')::uuid, null, 'HTTP 500');
select pg_temp.ok((select n from _slots0) - (select count(*) from beau_solo.available_slots('00000000-0000-0000-0000-0000000000c1', (select d from _ctx), (select d from _ctx))) = 2,
  'a failed sync keeps the busy times');
select pg_temp.as_staff('d3@example.com');
select pg_temp.ok((public.solo_admin_busy(now(), now() + interval '10 days') -> 0 ->> 'summary') = 'Dentiste', 'the diary sees the busy time');
select public.solo_admin_calendar_set((select v from _v where k = 'k')::uuid, false);
select pg_temp.reset_role();
select pg_temp.ok((select n from _slots0) = (select count(*) from beau_solo.available_slots('00000000-0000-0000-0000-0000000000c1', (select d from _ctx), (select d from _ctx))), 'a paused calendar blocks nothing');
select pg_temp.as_staff('crm3@example.com');
do $$ begin perform public.solo_admin_calendar_feed(); raise exception 'FAIL: crm read calendars'; exception when sqlstate '42501' then null; end $$;
select pg_temp.ok(true, 'calendars are an agenda matter');
select pg_temp.reset_role();

select 'SOLO_P3 ok=' || n from _r;
rollback;
