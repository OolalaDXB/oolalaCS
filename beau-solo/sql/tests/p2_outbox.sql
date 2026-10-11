-- Outbox sender contract. One transaction, rolled back.
begin;
create temp table _r (n int); insert into _r values (0);
create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'FAIL: %', label; end if; update _r set n = n + 1; end $$;
update beau_solo.settings set notify_email = null where id;
insert into beau_solo.availability_rules (weekday, start_time, end_time) select d, '09:00', '18:00' from generate_series(0, 6) d on conflict (weekday, start_time) do update set active = true, end_time = '18:00';
insert into beau_solo.appointment_types (slug, title, mode, duration_min, min_notice_hours, public) values ('t-out', '{"fr":"Appel"}', 'video', 30, 0, true) on conflict (slug) do nothing;
create temp table _b as select public.solo_public_book(jsonb_build_object('type', 't-out', 'name', 'Alice', 'email', 'alice@example.com', 'lang', 'en',
  'starts_at', (select (s ->> 'starts_at') from jsonb_array_elements(public.solo_public_slots('t-out', current_date + 5, current_date + 5) -> 'slots') s limit 1))) as r;
create temp table _c as select public.solo_outbox_claim(10) as r;
select pg_temp.ok(jsonb_array_length((select r from _c)) = 1, 'only the client message is claimed when no staff address is set');
select pg_temp.ok((select count(*) from beau_solo.outbox where kind = 'booking_new' and status = 'skipped') = 1, 'a message without recipient is skipped');
select pg_temp.ok((select r -> 0 -> 'booking' ->> 'name' from _c) = 'Alice', 'the claimed message carries its booking');
select pg_temp.ok((select r -> 0 -> 'payload' ->> 'token' from _c) = (select r ->> 'token' from _b), 'the client message carries the manage token');
select pg_temp.ok(not ((select r -> 0 -> 'booking' from _c) ? 'manage_token_hash'), 'no token hash leaves the database');
select pg_temp.ok(jsonb_array_length(public.solo_outbox_claim(10)) = 0, 'a claimed message is not claimed twice while pending');
select public.solo_outbox_done(((select r -> 0 ->> 'id' from _c))::uuid, true);
select pg_temp.ok((select status = 'sent' and not (payload ? 'token') from beau_solo.outbox where id = ((select r -> 0 ->> 'id' from _c))::uuid), 'a sent message forgets the token');
update beau_solo.outbox set status = 'queued', attempts = 4, claimed_at = null where id = ((select r -> 0 ->> 'id' from _c))::uuid;
select public.solo_outbox_claim(10);
select public.solo_outbox_done(((select r -> 0 ->> 'id' from _c))::uuid, false, 'smtp down');
select pg_temp.ok((select status from beau_solo.outbox where id = ((select r -> 0 ->> 'id' from _c))::uuid) = 'failed', 'a fifth failure gives up');
set local role authenticated;
do $$ begin perform public.solo_outbox_claim(1); raise exception 'FAIL: authenticated claimed'; exception when insufficient_privilege then null; end $$;
reset role;
select pg_temp.ok(true, 'only the service role can claim');
select 'SOLO_P2 ok=' || n from _r;
rollback;
