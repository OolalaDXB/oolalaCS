-- Oolala Corporate Services — starting data for BEAU Solo. Operational data, not
-- schema: Darya edits all of it from the back-office afterwards. Re-runnable.

-- Business timezone and slot grid
update beau_solo.settings set timezone = 'Asia/Dubai', slot_step_min = 30 where id;

-- The office address published on the contact page (to confirm)
insert into beau_solo.locations (id, name, kind, address, city, country, client_note)
values ('6f1d7c2e-0b1a-4c3e-9a51-0000000000a1', 'Oolala · The Sustainable City', 'office', 'The Sustainable City, PO 506575', 'Dubai', 'UAE',
        'Merci de vous présenter à l’accueil quelques minutes avant l’heure du rendez-vous.')
on conflict (id) do nothing;

-- Appointment types. Physical meetings at a partner, a property or elsewhere
-- carry their place and address per booking (location_policy = to_define) and
-- are booked by Darya, not from the website.
insert into beau_solo.appointment_types (slug, title, description, mode, location_policy, location_id, duration_min, buffer_min, min_notice_hours, price_amount, requires_approval, public, sort)
values
  ('decouverte',
   '{"fr":"Appel découverte","en":"Discovery call","ru":"Ознакомительный звонок"}',
   '{"fr":"Un premier échange de 30 minutes, en visio, pour comprendre votre projet et vous orienter.","en":"A first 30-minute video call to understand your project and point you in the right direction.","ru":"Первый 30-минутный видеозвонок, чтобы понять ваш проект и сориентировать вас."}',
   'video', 'fixed', null, 30, 15, 12, 0, false, true, 10),
  ('consultation',
   '{"fr":"Consultation approfondie","en":"In-depth consultation","ru":"Подробная консультация"}',
   '{"fr":"Une heure pour étudier votre situation en détail et bâtir votre plan d’action.","en":"One hour to review your situation in detail and build your action plan.","ru":"Час на детальный разбор вашей ситуации и составление плана действий."}',
   'video', 'fixed', null, 60, 15, 24, 0, true, false, 20),
  ('rdv-bureau',
   '{"fr":"Rendez-vous au bureau","en":"Meeting at the office","ru":"Встреча в офисе"}',
   '{"fr":"Un rendez-vous en personne à Dubai.","en":"An in-person meeting in Dubai.","ru":"Личная встреча в Дубае."}',
   'in_person', 'fixed', '6f1d7c2e-0b1a-4c3e-9a51-0000000000a1', 60, 30, 24, 0, true, true, 30),
  ('rdv-partenaire',
   '{"fr":"Rendez-vous chez un partenaire","en":"Meeting at a partner’s office","ru":"Встреча у партнёра"}',
   '{"fr":"Avocat, notaire, banque ou free zone : le lieu et l’adresse sont précisés pour chaque rendez-vous.","en":"Lawyer, notary, bank or free zone: the place and address are set for each meeting.","ru":"Юрист, нотариус, банк или фризона: место и адрес указываются для каждой встречи."}',
   'in_person', 'to_define', null, 60, 30, 24, 0, true, false, 40),
  ('visite-bien',
   '{"fr":"Visite de bien","en":"Property viewing","ru":"Просмотр объекта"}',
   '{"fr":"Visite d’un bien sur place, à l’adresse précisée pour le rendez-vous.","en":"An on-site property viewing at the address set for the appointment.","ru":"Просмотр объекта на месте по адресу, указанному для встречи."}',
   'in_person', 'to_define', null, 90, 30, 24, 0, true, false, 50),
  ('rdv-sur-place',
   '{"fr":"Rendez-vous sur place","en":"In-person meeting","ru":"Личная встреча"}',
   '{"fr":"Tout autre rendez-vous physique, à l’adresse précisée pour le rendez-vous.","en":"Any other in-person meeting, at the address set for the appointment.","ru":"Любая другая личная встреча по указанному адресу."}',
   'in_person', 'to_define', null, 60, 30, 24, 0, true, false, 60)
on conflict (slug) do nothing;

-- Placeholder hours: Monday to Friday, 09:00–18:00 Dubai. Darya adjusts them.
insert into beau_solo.availability_rules (weekday, start_time, end_time)
select d, '09:00', '18:00' from generate_series(1, 5) d
on conflict (weekday, start_time) do nothing;

-- Staff access is granted once the person's sign-in email is known, e.g.:
-- insert into beau_solo.staff (email, name, permissions) values ('<email>', 'Darya', array['solo:admin']);
-- update beau_solo.settings set notify_email = '<email>' where id;
