-- Oolala — starting billing profile. Darya completes it in Réglages → Facturation
-- (licence number, TRN if VAT-registered, bank details). Re-runnable: only empty fields are filled.
update beau_solo.billing_profile set
  trade_name = coalesce(trade_name, 'Oolala Corporate Services'),
  legal_name = coalesce(legal_name, 'Oolala Next FZ-LLC'),
  address = coalesce(address, 'The Sustainable City, PO 506575, Dubai, United Arab Emirates'),
  licence = coalesce(licence, 'RAKEZ'),
  email = coalesce(email, 'darya@oolala.ae'),
  phone = coalesce(phone, '+971 50 683 8777'),
  website = coalesce(website, 'oolala.ae'),
  legal_mentions = coalesce(legal_mentions, 'Oolala Next FZ-LLC, société de free zone enregistrée à RAKEZ.'),
  invoice_prefix = case when invoice_prefix = 'INV' then 'OCS' else invoice_prefix end
where id;
