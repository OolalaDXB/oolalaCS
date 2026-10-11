-- BEAU Solo 0002 — notification sender support. The `solo-outbox` Edge Function
-- claims queued messages with their booking or enquiry, sends them, and reports
-- back. Service role only. Same file rules as 0001 (no DROP, no DELETE, no
-- UPDATE without WHERE, no percent sign).

alter table beau_solo.outbox add column if not exists claimed_at timestamptz;

-- Claims up to p_limit queued messages (5 attempts at most). A claim holds a
-- message for 10 minutes, so overlapping runs never send it twice. Messages
-- with no recipient address are marked skipped.
create or replace function public.solo_outbox_claim(p_limit int default 20)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ids uuid[];
begin
  update beau_solo.outbox set status = 'skipped', last_error = 'no recipient'
  where status = 'queued' and to_email is null;
  select array_agg(id) into v_ids from (
    select id from beau_solo.outbox
    where status = 'queued' and attempts < 5 and (claimed_at is null or claimed_at < now() - interval '10 minutes')
    order by created_at limit greatest(1, least(p_limit, 50))
    for update skip locked) c;
  if v_ids is null then return '[]'::jsonb; end if;
  update beau_solo.outbox set attempts = attempts + 1, claimed_at = now() where id = any(v_ids);
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'kind', o.kind, 'recipient', o.recipient, 'to_email', o.to_email, 'lang', o.lang, 'payload', o.payload,
      'timezone', (select timezone from beau_solo.settings),
      'booking', (select to_jsonb(b) - 'manage_token_hash' - 'ip_hash' - 'internal_note' from beau_solo.bookings b
                  where b.ref = o.payload ->> 'ref' or b.id::text = o.payload ->> 'booking_id' limit 1),
      'location', (select jsonb_build_object('maps_url', l.maps_url, 'client_note', l.client_note) from beau_solo.bookings b
                   join beau_solo.locations l on l.id = b.location_id where b.ref = o.payload ->> 'ref' limit 1),
      'enquiry', (select to_jsonb(e) - 'ip_hash' from beau_solo.enquiries e where e.id::text = o.payload ->> 'enquiry_id')
    ) order by o.created_at), '[]'::jsonb)
    from beau_solo.outbox o where o.id = any(v_ids));
end $$;

-- Reports the result. A sent message loses its one-time manage token.
create or replace function public.solo_outbox_done(p_id uuid, p_ok boolean, p_error text default null)
returns void language sql security definer set search_path = '' as $$
  update beau_solo.outbox set
    status = case when p_ok then 'sent' when attempts >= 5 then 'failed' else 'queued' end,
    sent_at = case when p_ok then now() else sent_at end,
    last_error = case when p_ok then null else left(p_error, 500) end,
    claimed_at = null,
    payload = case when p_ok then payload - 'token' else payload end
  where id = p_id
$$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('solo_outbox_claim', 'solo_outbox_done') loop
    execute 'revoke all on function ' || f.sig::text || ' from public, anon, authenticated';
    execute 'grant execute on function ' || f.sig::text || ' to service_role';
  end loop;
end $$;

insert into beau_solo.schema_versions (version, note) values ('0002_outbox_sender', 'Notification sender support') on conflict do nothing;
