-- BEAU Solo 0004 — invoices and payment links. A draft is free to change; on
-- issue it gets its number (PREFIX-YEAR-0001, no gaps: drafts have none) and
-- freezes who issues it and who it is for. Payments are recorded by hand
-- (transfer, cash) or arrive from the card checkout; an invoice is paid when
-- they cover its total. Each issued invoice has a private payment link.
-- Amounts are in minor units (cents, fils). Same file rules as 0001:
-- idempotent, no DROP, no DELETE, no UPDATE without WHERE, no percent sign.

/* ------------------------------------------------------------------ */
/* who issues: the business profile printed on every invoice           */
/* ------------------------------------------------------------------ */
create table if not exists beau_solo.billing_profile (
  id              boolean primary key default true check (id),
  trade_name      text,
  legal_name      text,
  address         text,
  licence         text,             -- licence number and issuing authority
  trn             text,             -- UAE tax registration number (or other VAT number)
  vat_rate        numeric(5,2) check (vat_rate is null or vat_rate between 0 and 30),
  vat_note        text,             -- printed when no VAT is charged
  email           text,
  phone           text,
  website         text,
  bank_name       text,
  account_name    text,
  iban            text,
  swift           text,
  bank_note       text,
  payment_terms   text,
  legal_mentions  text,
  invoice_prefix  text not null default 'INV' check (invoice_prefix ~ '^[A-Z0-9]{1,8}$'),
  default_currency text not null default 'USD' check (default_currency ~ '^[A-Z]{3}$'),
  due_days        int not null default 7 check (due_days between 0 and 120),
  updated_at      timestamptz not null default now(),
  updated_by      text
);
alter table beau_solo.billing_profile enable row level security;
insert into beau_solo.billing_profile (id) values (true) on conflict do nothing;

create table if not exists beau_solo.invoice_counters (
  year int primary key,
  last int not null default 0
);
alter table beau_solo.invoice_counters enable row level security;

/* ------------------------------------------------------------------ */
/* invoices, their lines (kept on the row) and payments                 */
/* ------------------------------------------------------------------ */
create table if not exists beau_solo.invoices (
  id             uuid primary key default gen_random_uuid(),
  number         text unique,
  status         text not null default 'draft' check (status in ('draft','issued','cancelled')),
  crm_contact_id uuid references beau_solo.crm_contacts(id),
  client         jsonb not null default '{}',   -- name, company, email, phone, address, trn
  issuer         jsonb,                          -- frozen billing profile, set on issue
  currency       text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  issue_date     date,
  due_date       date,
  lines          jsonb not null default '[]',   -- [{label, quantity, unit_amount, vat_rate, net, vat, total}]
  subtotal       bigint not null default 0,
  vat_total      bigint not null default 0,
  total          bigint not null default 0,
  paid_total     bigint not null default 0,
  notes          text,
  lang           text not null default 'fr' check (lang in ('fr','en','ru')),
  pay_token      text unique,
  pay_card       boolean not null default true,  -- offer card payment on the link
  created_by     text,
  created_at     timestamptz not null default now(),
  issued_at      timestamptz,
  issued_by      text,
  cancelled_at   timestamptz,
  cancel_reason  text,
  updated_at     timestamptz not null default now()
);
create index if not exists invoices_contact on beau_solo.invoices (crm_contact_id);
create or replace trigger invoices_touch before update on beau_solo.invoices
  for each row execute function beau_solo.touch();
alter table beau_solo.invoices enable row level security;

create table if not exists beau_solo.invoice_payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references beau_solo.invoices(id),
  amount       bigint not null check (amount > 0),
  currency     text not null,
  method       text not null check (method in ('bank_transfer','card','cash','other')),
  reference    text,
  provider_ref text unique,          -- the card checkout session: a payment never counts twice
  paid_at      timestamptz not null default now(),
  recorded_by  text,
  voided_at    timestamptz,
  voided_by    text,
  created_at   timestamptz not null default now()
);
create index if not exists invoice_payments_invoice on beau_solo.invoice_payments (invoice_id);
alter table beau_solo.invoice_payments enable row level security;

/* ------------------------------------------------------------------ */
/* arithmetic and the document                                         */
/* ------------------------------------------------------------------ */
-- Lines as entered → cleaned lines with their net, VAT and total (minor units).
-- Unit amounts are before VAT; each line carries its own rate (government fees: 0).
create or replace function beau_solo.invoice_lines(p_lines jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'label', l.label, 'quantity', l.qty, 'unit_amount', l.unit, 'vat_rate', l.rate,
      'net', round(l.qty * l.unit), 'vat', round(round(l.qty * l.unit) * l.rate / 100),
      'total', round(l.qty * l.unit) + round(round(l.qty * l.unit) * l.rate / 100)) order by l.n), '[]'::jsonb)
  from (select n, left(btrim(x ->> 'label'), 300) as label,
               coalesce(nullif(x ->> 'quantity', '')::numeric, 1) as qty,
               coalesce(nullif(x ->> 'unit_amount', '')::bigint, 0) as unit,
               coalesce(nullif(x ->> 'vat_rate', '')::numeric, 0) as rate
        from jsonb_array_elements(case when jsonb_typeof(p_lines) = 'array' then p_lines else '[]'::jsonb end) with ordinality as e(x, n)) l
  where l.label <> ''
$$;

-- paid / partial / overdue / unpaid / draft / cancelled, as Darya reads it
create or replace function beau_solo.invoice_state(i beau_solo.invoices)
returns text language sql stable set search_path = '' as $$
  select case
    when i.status = 'draft' then 'draft'
    when i.status = 'cancelled' then 'cancelled'
    when i.total > 0 and i.paid_total >= i.total then 'paid'
    when i.total = 0 then 'paid'
    when i.paid_total > 0 then 'partial'
    when i.due_date < (now() at time zone coalesce((select timezone from beau_solo.settings), 'UTC'))::date then 'overdue'
    else 'unpaid' end
$$;

create or replace function beau_solo.profile_json() returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(p) - 'id' - 'updated_at' - 'updated_by' from beau_solo.billing_profile p
$$;

-- The document both the back office and the client's page draw.
create or replace function beau_solo.invoice_doc(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', i.id, 'number', i.number, 'status', i.status, 'state', beau_solo.invoice_state(i), 'lang', i.lang,
    'currency', i.currency, 'issue_date', i.issue_date, 'due_date', i.due_date,
    'issuer', coalesce(i.issuer, beau_solo.profile_json()), 'client', i.client,
    'lines', i.lines, 'subtotal', i.subtotal, 'vat_total', i.vat_total, 'total', i.total,
    'vat_breakdown', coalesce((select jsonb_agg(jsonb_build_object('rate', r.rate, 'net', r.net, 'vat', r.vat) order by r.rate)
       from (select (l ->> 'vat_rate')::numeric as rate, sum((l ->> 'net')::bigint) as net, sum((l ->> 'vat')::bigint) as vat
             from jsonb_array_elements(i.lines) l group by 1) r), '[]'::jsonb),
    'paid', i.paid_total, 'balance', greatest(i.total - i.paid_total, 0), 'notes', i.notes,
    'payments', coalesce((select jsonb_agg(jsonb_build_object('amount', p.amount, 'method', p.method, 'paid_at', p.paid_at) order by p.paid_at)
       from beau_solo.invoice_payments p where p.invoice_id = i.id and p.voided_at is null), '[]'::jsonb),
    'pay_card', i.pay_card, 'cancelled_at', i.cancelled_at)
  from beau_solo.invoices i where i.id = p_id
$$;

create or replace function beau_solo.invoice_recount(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update beau_solo.invoices set paid_total = coalesce((select sum(amount) from beau_solo.invoice_payments where invoice_id = p_id and voided_at is null), 0)
  where id = p_id
$$;

/* ------------------------------------------------------------------ */
/* back office                                                         */
/* ------------------------------------------------------------------ */
create or replace function public.solo_admin_billing_profile()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform beau_solo.require('solo:billing');
  return beau_solo.profile_json();
end $$;

create or replace function public.solo_admin_billing_profile_set(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor text := beau_solo.require('solo:settings');
  t text[] := array['trade_name','legal_name','address','licence','trn','vat_note','email','phone','website','bank_name','account_name','iban','swift','bank_note','payment_terms','legal_mentions'];
  k text; v jsonb := '{}';
begin
  foreach k in array t loop v := v || jsonb_build_object(k, nullif(btrim(p ->> k), '')); end loop;
  update beau_solo.billing_profile set
    trade_name = v ->> 'trade_name', legal_name = v ->> 'legal_name', address = v ->> 'address', licence = v ->> 'licence', trn = v ->> 'trn',
    vat_rate = nullif(p ->> 'vat_rate', '')::numeric, vat_note = v ->> 'vat_note', email = v ->> 'email', phone = v ->> 'phone', website = v ->> 'website',
    bank_name = v ->> 'bank_name', account_name = v ->> 'account_name', iban = upper(replace(v ->> 'iban', ' ', '')), swift = upper(v ->> 'swift'),
    bank_note = v ->> 'bank_note', payment_terms = v ->> 'payment_terms', legal_mentions = v ->> 'legal_mentions',
    invoice_prefix = coalesce(nullif(upper(btrim(p ->> 'invoice_prefix')), ''), invoice_prefix),
    default_currency = coalesce(nullif(upper(btrim(p ->> 'default_currency')), ''), default_currency),
    due_days = coalesce(nullif(p ->> 'due_days', '')::int, due_days), updated_at = now(), updated_by = v_actor
  where id;
  perform beau_solo.log('billing', 'profile_set', null, '{}');
  return beau_solo.profile_json();
end $$;

create or replace function public.solo_admin_invoices(p_state text default null, p_contact uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform beau_solo.require('solo:billing');
  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(x order by x ->> 'sort' desc) from (
      select jsonb_build_object('id', i.id, 'number', i.number, 'state', beau_solo.invoice_state(i), 'client', i.client, 'crm_contact_id', i.crm_contact_id,
        'currency', i.currency, 'total', i.total, 'paid', i.paid_total, 'issue_date', i.issue_date, 'due_date', i.due_date,
        'label', (i.lines -> 0 ->> 'label'), 'sort', coalesce(i.issued_at, i.created_at)) as x
      from beau_solo.invoices i
      where (p_contact is null or i.crm_contact_id = p_contact)
        and (p_state is null or beau_solo.invoice_state(i) = p_state or (p_state = 'open' and beau_solo.invoice_state(i) in ('unpaid','partial','overdue')))
      order by coalesce(i.issued_at, i.created_at) desc limit 300) s), '[]'::jsonb),
    'totals', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'due', due, 'overdue', overdue, 'paid_30d', paid_30d)) from (
      select i.currency,
        sum(greatest(i.total - i.paid_total, 0)) filter (where beau_solo.invoice_state(i) in ('unpaid','partial','overdue')) as due,
        sum(greatest(i.total - i.paid_total, 0)) filter (where beau_solo.invoice_state(i) = 'overdue') as overdue,
        (select coalesce(sum(p.amount), 0) from beau_solo.invoice_payments p join beau_solo.invoices j on j.id = p.invoice_id
          where j.currency = i.currency and p.voided_at is null and p.paid_at > now() - interval '30 days') as paid_30d
      from beau_solo.invoices i where i.status = 'issued' group by i.currency) t), '[]'::jsonb),
    'drafts', (select count(*) from beau_solo.invoices where status = 'draft'));
end $$;

create or replace function public.solo_admin_invoice(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform beau_solo.require('solo:billing');
  return (select beau_solo.invoice_doc(i.id) || jsonb_build_object(
      'crm_contact_id', i.crm_contact_id, 'has_link', i.pay_token is not null, 'cancel_reason', i.cancel_reason,
      'created_by', i.created_by, 'issued_by', i.issued_by, 'issued_at', i.issued_at,
      'all_payments', coalesce((select jsonb_agg(to_jsonb(p) - 'provider_ref' order by p.paid_at) from beau_solo.invoice_payments p where p.invoice_id = i.id), '[]'::jsonb))
    from beau_solo.invoices i where i.id = p_id);
end $$;

-- create or change a draft (an issued invoice is never edited)
create or replace function public.solo_admin_invoice_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor text := beau_solo.require('solo:billing');
  i beau_solo.invoices; v_lines jsonb := beau_solo.invoice_lines(p -> 'lines');
  v_contact uuid := nullif(p ->> 'crm_contact_id', '')::uuid; c beau_solo.crm_contacts;
  v_client jsonb;
begin
  if exists (select 1 from jsonb_array_elements(v_lines) l where (l ->> 'quantity')::numeric <= 0 or (l ->> 'vat_rate')::numeric not between 0 and 30) then
    raise exception 'invalid_line' using errcode = '22023';
  end if;
  if v_contact is not null then select * into c from beau_solo.crm_contacts where id = v_contact; end if;
  -- what is typed wins; empty fields fall back to the contact card
  v_client := jsonb_strip_nulls(jsonb_build_object(
    'name', coalesce(nullif(btrim(p -> 'client' ->> 'name'), ''), c.name), 'company', coalesce(nullif(btrim(p -> 'client' ->> 'company'), ''), c.company),
    'email', coalesce(nullif(lower(btrim(p -> 'client' ->> 'email')), ''), c.email), 'phone', coalesce(nullif(btrim(p -> 'client' ->> 'phone'), ''), c.phone),
    'address', coalesce(nullif(btrim(p -> 'client' ->> 'address'), ''), nullif(concat_ws(', ', c.address_line, c.postal_code, c.city, c.country), '')),
    'trn', nullif(btrim(p -> 'client' ->> 'trn'), '')));
  if nullif(p ->> 'id', '') is null then
    insert into beau_solo.invoices (crm_contact_id, client, currency, due_date, lines, notes, lang, pay_card, created_by)
    values (v_contact, v_client, coalesce(nullif(upper(p ->> 'currency'), ''), (select default_currency from beau_solo.billing_profile)), nullif(p ->> 'due_date', '')::date,
            v_lines, nullif(btrim(p ->> 'notes'), ''), case when p ->> 'lang' in ('en','ru') then p ->> 'lang' else 'fr' end, coalesce((p ->> 'pay_card')::boolean, true), v_actor)
    returning * into i;
  else
    update beau_solo.invoices set crm_contact_id = v_contact, client = v_client, currency = coalesce(nullif(upper(p ->> 'currency'), ''), currency),
      due_date = nullif(p ->> 'due_date', '')::date, lines = v_lines, notes = nullif(btrim(p ->> 'notes'), ''),
      lang = case when p ->> 'lang' in ('en','ru') then p ->> 'lang' else 'fr' end, pay_card = coalesce((p ->> 'pay_card')::boolean, pay_card)
    where id = (p ->> 'id')::uuid and status = 'draft' returning * into i;
    if i.id is null then raise exception 'not_editable' using errcode = '55000'; end if;
  end if;
  update beau_solo.invoices set subtotal = coalesce((select sum((l ->> 'net')::bigint) from jsonb_array_elements(i.lines) l), 0),
    vat_total = coalesce((select sum((l ->> 'vat')::bigint) from jsonb_array_elements(i.lines) l), 0),
    total = coalesce((select sum((l ->> 'total')::bigint) from jsonb_array_elements(i.lines) l), 0)
  where id = i.id;
  perform beau_solo.log('billing', 'invoice_save', i.id::text, '{}');
  return public.solo_admin_invoice(i.id);
end $$;

-- issue: number, frozen parties, dates, private link
create or replace function public.solo_admin_invoice_issue(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor text := beau_solo.require('solo:billing'); i beau_solo.invoices; pr beau_solo.billing_profile;
  v_today date := (now() at time zone coalesce((select timezone from beau_solo.settings), 'UTC'))::date; v_n int;
begin
  select * into i from beau_solo.invoices where id = p_id for update;
  if i.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if i.status <> 'draft' then raise exception 'not_editable' using errcode = '55000'; end if;
  if jsonb_array_length(i.lines) = 0 or i.total <= 0 then raise exception 'empty_invoice' using errcode = '22023'; end if;
  if coalesce(i.client ->> 'name', i.client ->> 'company', '') = '' then raise exception 'missing_client' using errcode = '22023'; end if;
  select * into pr from beau_solo.billing_profile;
  if coalesce(pr.legal_name, pr.trade_name, '') = '' then raise exception 'missing_profile' using errcode = '22023'; end if;
  if i.vat_total > 0 and coalesce(pr.trn, '') = '' then raise exception 'missing_trn' using errcode = '22023'; end if;
  insert into beau_solo.invoice_counters (year, last) values (extract(year from v_today)::int, 1)
  on conflict (year) do update set last = beau_solo.invoice_counters.last + 1 returning last into v_n;
  update beau_solo.invoices set status = 'issued',
    number = pr.invoice_prefix || '-' || extract(year from v_today)::int || '-' || lpad(v_n::text, 4, '0'),
    issuer = beau_solo.profile_json(), issue_date = v_today, due_date = coalesce(due_date, v_today + pr.due_days),
    pay_token = encode(extensions.gen_random_bytes(24), 'hex'), issued_at = now(), issued_by = v_actor
  where id = p_id;
  if i.crm_contact_id is not null then
    update beau_solo.crm_contacts set last_seen_at = now(), status = case when status = 'archived' then status else 'client' end where id = i.crm_contact_id;
  end if;
  perform beau_solo.log('billing', 'invoice_issue', p_id::text, '{}');
  return public.solo_admin_invoice(p_id);
end $$;

-- the private link's two parts; the page is /payer?n=<number>&t=<token>
create or replace function public.solo_admin_invoice_link(p_id uuid, p_renew boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare i beau_solo.invoices;
begin
  perform beau_solo.require('solo:billing');
  if p_renew then
    update beau_solo.invoices set pay_token = encode(extensions.gen_random_bytes(24), 'hex') where id = p_id and status = 'issued';
    perform beau_solo.log('billing', 'link_renew', p_id::text, '{}');
  end if;
  select * into i from beau_solo.invoices where id = p_id;
  if i.id is null or i.status <> 'issued' or i.pay_token is null then raise exception 'not_issued' using errcode = '55000'; end if;
  return jsonb_build_object('number', i.number, 'token', i.pay_token, 'lang', i.lang);
end $$;

create or replace function public.solo_admin_invoice_cancel(p_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor text := beau_solo.require('solo:billing'); i beau_solo.invoices;
begin
  select * into i from beau_solo.invoices where id = p_id for update;
  if i.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if i.status = 'cancelled' then return public.solo_admin_invoice(p_id); end if;
  if i.paid_total > 0 then raise exception 'has_payments' using errcode = '55000'; end if;
  update beau_solo.invoices set status = 'cancelled', cancelled_at = now(), cancel_reason = nullif(btrim(p_reason), ''), pay_token = null where id = p_id;
  perform beau_solo.log('billing', 'invoice_cancel', p_id::text, jsonb_build_object('reason', p_reason));
  return public.solo_admin_invoice(p_id);
end $$;

-- a payment received by transfer, cash or otherwise
create or replace function public.solo_admin_invoice_payment(p_id uuid, p_amount bigint, p_method text, p_reference text default null, p_paid_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor text := beau_solo.require('solo:billing'); i beau_solo.invoices;
begin
  select * into i from beau_solo.invoices where id = p_id for update;
  if i.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if i.status <> 'issued' then raise exception 'not_issued' using errcode = '55000'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount' using errcode = '22023'; end if;
  if p_method not in ('bank_transfer','card','cash','other') then raise exception 'invalid_method' using errcode = '22023'; end if;
  insert into beau_solo.invoice_payments (invoice_id, amount, currency, method, reference, paid_at, recorded_by)
  values (p_id, p_amount, i.currency, p_method, nullif(btrim(p_reference), ''), coalesce(p_paid_at, now()), v_actor);
  perform beau_solo.invoice_recount(p_id);
  perform beau_solo.log('billing', 'payment_add', p_id::text, jsonb_build_object('amount', p_amount, 'method', p_method));
  return public.solo_admin_invoice(p_id);
end $$;

create or replace function public.solo_admin_invoice_payment_void(p_payment uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor text := beau_solo.require('solo:billing'); v_inv uuid;
begin
  update beau_solo.invoice_payments set voided_at = now(), voided_by = v_actor where id = p_payment and voided_at is null and provider_ref is null returning invoice_id into v_inv;
  if v_inv is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform beau_solo.invoice_recount(v_inv);
  perform beau_solo.log('billing', 'payment_void', p_payment::text, '{}');
  return public.solo_admin_invoice(v_inv);
end $$;

/* ------------------------------------------------------------------ */
/* the client's page and the card checkout (service role)              */
/* ------------------------------------------------------------------ */
create or replace function beau_solo.invoice_by_link(p_number text, p_token text) returns beau_solo.invoices
language sql stable security definer set search_path = '' as $$
  select i.* from beau_solo.invoices i
  where i.number = p_number and i.status = 'issued' and i.pay_token is not null
    and length(coalesce(p_token, '')) = 48 and i.pay_token = p_token
$$;

create or replace function public.solo_public_invoice(p_number text, p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare i beau_solo.invoices := beau_solo.invoice_by_link(p_number, p_token);
begin
  if i.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  return beau_solo.invoice_doc(i.id) - 'id';
end $$;

-- what the card checkout must charge: the balance, in the invoice's currency
create or replace function public.solo_public_invoice_checkout(p_number text, p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare i beau_solo.invoices := beau_solo.invoice_by_link(p_number, p_token);
begin
  if i.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not i.pay_card then raise exception 'card_disabled' using errcode = '55000'; end if;
  if i.total - i.paid_total <= 0 then raise exception 'already_paid' using errcode = '55000'; end if;
  return jsonb_build_object('number', i.number, 'amount', i.total - i.paid_total, 'currency', i.currency, 'email', i.client ->> 'email',
    'description', coalesce((i.issuer ->> 'trade_name'), (i.issuer ->> 'legal_name'), 'Invoice') || ' · ' || i.number, 'lang', i.lang);
end $$;

-- the card payment confirmed by the provider: recorded once per checkout session
create or replace function public.solo_card_paid(p_number text, p_session text, p_amount bigint, p_currency text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare i beau_solo.invoices;
begin
  select * into i from beau_solo.invoices where number = p_number for update;
  if i.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if upper(p_currency) <> i.currency then raise exception 'currency_mismatch' using errcode = '22023'; end if;
  insert into beau_solo.invoice_payments (invoice_id, amount, currency, method, reference, provider_ref, recorded_by)
  values (i.id, p_amount, i.currency, 'card', 'Carte · ' || right(p_session, 10), p_session, 'card checkout')
  on conflict (provider_ref) do nothing;
  perform beau_solo.invoice_recount(i.id);
  insert into beau_solo.audit (actor, area, action, target, meta) values ('card checkout', 'billing', 'card_paid', i.id::text, jsonb_build_object('amount', p_amount));
  return jsonb_build_object('number', i.number, 'state', (select beau_solo.invoice_state(x) from beau_solo.invoices x where x.id = i.id));
end $$;

/* ------------------------------------------------------------------ */
/* grants                                                              */
/* ------------------------------------------------------------------ */
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in (
             'solo_admin_billing_profile','solo_admin_billing_profile_set','solo_admin_invoices','solo_admin_invoice','solo_admin_invoice_save',
             'solo_admin_invoice_issue','solo_admin_invoice_link','solo_admin_invoice_cancel','solo_admin_invoice_payment','solo_admin_invoice_payment_void',
             'solo_public_invoice','solo_public_invoice_checkout','solo_card_paid') loop
    execute 'revoke all on function ' || f.sig::text || ' from public, anon, authenticated';
    if left(f.proname::text, 11) = 'solo_admin_' then
      execute 'grant execute on function ' || f.sig::text || ' to authenticated';
    else
      execute 'grant execute on function ' || f.sig::text || ' to service_role';
    end if;
  end loop;
end $$;

insert into beau_solo.schema_versions (version, note) values ('0004_invoices', 'Invoices, payments and payment links') on conflict do nothing;
