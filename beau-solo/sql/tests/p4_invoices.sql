-- BEAU Solo 0004 contract: invoices, payments, payment link. One transaction, rolled back.
-- Local: … -f 0004_invoices.sql -f tests/p4_invoices.sql → "SOLO_P4 ok=<n>"
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
create or replace function pg_temp.raises(sql text, code text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return sqlerrm = code or sqlstate = code; end $$;

insert into beau_solo.staff (email, name, permissions) values ('d4@example.com', 'Darya', array['solo:admin']), ('crm4@example.com', 'CRM', array['solo:crm'])
  on conflict (email) do update set active = true, permissions = excluded.permissions;
insert into beau_solo.crm_contacts (id, name, email, company, city, country) values ('00000000-0000-0000-0000-0000000000a4', 'Anna Petrova', 'anna@example.com', 'Petrova LLC', 'Dubai', 'UAE');
create temp table _v (k text primary key, v text);
grant all on _r, _v to authenticated, service_role, anon;

select pg_temp.as_staff('d4@example.com');
-- a draft: one VAT line, one government fee without VAT, one empty line
insert into _v select 'i', public.solo_admin_invoice_save(jsonb_build_object('crm_contact_id', '00000000-0000-0000-0000-0000000000a4', 'currency', 'usd',
  'lines', jsonb_build_array(
    jsonb_build_object('label', 'Création de société RAKEZ', 'quantity', 1, 'unit_amount', 250000, 'vat_rate', 5),
    jsonb_build_object('label', 'Frais gouvernementaux', 'quantity', 2, 'unit_amount', 33333, 'vat_rate', 0),
    jsonb_build_object('label', '   ', 'quantity', 1, 'unit_amount', 999)))) ->> 'id';
select pg_temp.reset_role();
select pg_temp.ok((select subtotal = 316666 and vat_total = 12500 and total = 329166 and currency = 'USD' and jsonb_array_length(lines) = 2 and number is null and status = 'draft'
  from beau_solo.invoices where id = (select v from _v where k = 'i')::uuid), 'a draft: two lines, net 3166.66, VAT 125.00, total 3291.66, empty line dropped, no number');
select pg_temp.ok((select client ->> 'name' = 'Anna Petrova' and client ->> 'company' = 'Petrova LLC' and client ->> 'address' = 'Dubai, UAE'
  from beau_solo.invoices where id = (select v from _v where k = 'i')::uuid), 'the client is taken from the contact card');
select pg_temp.as_staff('d4@example.com');
select pg_temp.ok(pg_temp.raises(format('select public.solo_admin_invoice_issue(%L)', (select v from _v where k = 'i')), 'missing_profile'), 'no issue before the business profile is filled');
select public.solo_admin_billing_profile_set('{"trade_name":"Oolala Corporate Services","legal_name":"Oolala Next FZ-LLC","invoice_prefix":"ocs","iban":"ae07 0331 2345 6789 0123 456","due_days":"10"}');
select pg_temp.ok(pg_temp.raises(format('select public.solo_admin_invoice_issue(%L)', (select v from _v where k = 'i')), 'missing_trn'), 'VAT charged needs the TRN');
select public.solo_admin_billing_profile_set('{"trade_name":"Oolala Corporate Services","legal_name":"Oolala Next FZ-LLC","invoice_prefix":"ocs","iban":"ae07 0331 2345 6789 0123 456","due_days":"10","trn":"100000000000003","vat_rate":"5"}');
create temp table _iss as select public.solo_admin_invoice_issue((select v from _v where k = 'i')::uuid) as r;
select pg_temp.ok((select r ->> 'number' from _iss) = 'OCS-' || extract(year from now())::int || '-0001', 'issued with the first number of the year');
select pg_temp.ok((select (r -> 'issuer' ->> 'iban') = 'AE070331234567890123456' and (r -> 'issuer' ->> 'trn') = '100000000000003' from _iss), 'the issuer is frozen, IBAN cleaned');
select pg_temp.ok((select (r ->> 'due_date')::date - (r ->> 'issue_date')::date = 10 and r ->> 'state' = 'unpaid' from _iss), 'due in the profile''s days, unpaid');
select pg_temp.ok((select jsonb_array_length(r -> 'vat_breakdown') = 2 from _iss), 'VAT broken down by rate');
select pg_temp.ok(pg_temp.raises(format('select public.solo_admin_invoice_save(%L)', jsonb_build_object('id', (select v from _v where k = 'i'), 'lines', '[]'::jsonb)), 'not_editable'), 'an issued invoice cannot be edited');
select public.solo_admin_billing_profile_set('{"trade_name":"Changed","legal_name":"Changed","trn":"1"}');
select pg_temp.ok((public.solo_admin_invoice((select v from _v where k = 'i')::uuid) -> 'issuer' ->> 'legal_name') = 'Oolala Next FZ-LLC', 'a later profile change does not touch an issued invoice');
-- a draft in between takes no number
insert into _v select 'd', public.solo_admin_invoice_save('{"client":{"name":"Brouillon"},"lines":[{"label":"x","unit_amount":100}]}') ->> 'id';
insert into _v select 'j', public.solo_admin_invoice_save('{"client":{"name":"Marc"},"currency":"AED","lines":[{"label":"Visa","unit_amount":150000}]}') ->> 'id';
select public.solo_admin_invoice_issue((select v from _v where k = 'j')::uuid);
select pg_temp.ok((public.solo_admin_invoice((select v from _v where k = 'j')::uuid) ->> 'number') = 'OCS-' || extract(year from now())::int || '-0002', 'the next issued invoice is 0002, the draft took no number');
select pg_temp.ok(pg_temp.raises('select public.solo_admin_invoice_save(''{"lines":[{"label":"x","quantity":0,"unit_amount":1}]}'')', 'invalid_line'), 'a zero quantity is refused');

-- payments
select public.solo_admin_invoice_payment((select v from _v where k = 'i')::uuid, 100000, 'bank_transfer', 'Virement 1');
select pg_temp.ok((public.solo_admin_invoice((select v from _v where k = 'i')::uuid) ->> 'state') = 'partial', 'a part payment');
select pg_temp.ok(pg_temp.raises(format('select public.solo_admin_invoice_cancel(%L)', (select v from _v where k = 'i')), 'has_payments'), 'an invoice with payments cannot be cancelled');
create temp table _link as select public.solo_admin_invoice_link((select v from _v where k = 'i')::uuid) as r;
select pg_temp.reset_role();

-- the client's page and the card
select pg_temp.ok((public.solo_public_invoice((select r ->> 'number' from _link), (select r ->> 'token' from _link)) ->> 'balance')::bigint = 229166, 'the link shows the balance');
select pg_temp.ok(not (public.solo_public_invoice((select r ->> 'number' from _link), (select r ->> 'token' from _link)) ? 'id'), 'the page does not see internal ids');
select pg_temp.ok(pg_temp.raises(format('select public.solo_public_invoice(%L, %L)', (select r ->> 'number' from _link), repeat('0', 48)), 'not_found'), 'a wrong token reads nothing');
select pg_temp.ok((public.solo_public_invoice_checkout((select r ->> 'number' from _link), (select r ->> 'token' from _link)) ->> 'amount')::bigint = 229166, 'the card charges the balance');
select public.solo_card_paid((select r ->> 'number' from _link), 'cs_test_123', 229166, 'usd');
select public.solo_card_paid((select r ->> 'number' from _link), 'cs_test_123', 229166, 'usd');
select pg_temp.ok((select paid_total = 329166 from beau_solo.invoices where id = (select v from _v where k = 'i')::uuid), 'a card payment counts once, even if the provider says it twice');
select pg_temp.ok((public.solo_public_invoice((select r ->> 'number' from _link), (select r ->> 'token' from _link)) ->> 'state') = 'paid', 'paid');
select pg_temp.ok(pg_temp.raises(format('select public.solo_public_invoice_checkout(%L, %L)', (select r ->> 'number' from _link), (select r ->> 'token' from _link)), 'already_paid'), 'nothing left to charge');
select pg_temp.ok(pg_temp.raises(format('select public.solo_card_paid(%L, %L, 1, %L)', (select r ->> 'number' from _link), 'cs_2', 'eur'), 'currency_mismatch'), 'a payment in another currency is refused');

-- renew, cancel, void
select pg_temp.as_staff('d4@example.com');
create temp table _link2 as select public.solo_admin_invoice_link((select v from _v where k = 'j')::uuid) as r;
select public.solo_admin_invoice_link((select v from _v where k = 'j')::uuid, true);
select pg_temp.reset_role();
select pg_temp.ok(pg_temp.raises(format('select public.solo_public_invoice(%L, %L)', (select r ->> 'number' from _link2), (select r ->> 'token' from _link2)), 'not_found'), 'a renewed link kills the old one');
select pg_temp.as_staff('d4@example.com');
select public.solo_admin_invoice_cancel((select v from _v where k = 'j')::uuid, 'Erreur de montant');
select pg_temp.ok((public.solo_admin_invoice((select v from _v where k = 'j')::uuid) ->> 'state') = 'cancelled'
  and not (public.solo_admin_invoice((select v from _v where k = 'j')::uuid) ->> 'has_link')::boolean, 'a cancelled invoice keeps its number and loses its link');
select public.solo_admin_invoice_payment_void((select (x ->> 'id')::uuid from jsonb_array_elements(public.solo_admin_invoice((select v from _v where k = 'i')::uuid) -> 'all_payments') x where x ->> 'method' = 'bank_transfer'));
select pg_temp.ok((public.solo_admin_invoice((select v from _v where k = 'i')::uuid) ->> 'state') = 'partial', 'a voided transfer reopens the balance');
select pg_temp.ok(pg_temp.raises(format('select public.solo_admin_invoice_payment_void(%L)', (select (x ->> 'id') from jsonb_array_elements(public.solo_admin_invoice((select v from _v where k = 'i')::uuid) -> 'all_payments') x where x ->> 'method' = 'card')), 'not_found'), 'a card payment from the checkout cannot be voided by hand');
select pg_temp.ok(jsonb_array_length(public.solo_admin_invoices('open') -> 'items') = 1 and (public.solo_admin_invoices() ->> 'drafts')::int = 1, 'the list filters open invoices and counts drafts');
select pg_temp.reset_role();

-- access
select pg_temp.as_staff('crm4@example.com');
select pg_temp.ok(pg_temp.raises('select public.solo_admin_invoices()', 'forbidden'), 'invoices need the billing permission');
select pg_temp.reset_role();
set local role anon;
select pg_temp.ok(pg_temp.raises('select public.solo_public_invoice(''x'', ''y'')', '42501'), 'the public page goes through the service role only');
reset role;

select 'SOLO_P4 ok=' || n from _r;
rollback;
