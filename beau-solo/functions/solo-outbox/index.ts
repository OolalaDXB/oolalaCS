// BEAU Solo — sends the queued notifications through Resend.
// Called every minute by pg_cron (anon key). It takes no input: it claims queued
// messages from the database, renders them, sends them and reports back.
// Without RESEND_API_KEY it does nothing and says so.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = Deno.env.get('SOLO_MAIL_FROM') ?? 'Darya · Oolala <darya@oolala.ae>';
const REPLY_TO = Deno.env.get('SOLO_REPLY_TO') ?? 'darya@oolala.ae';
const SITE = (Deno.env.get('SOLO_SITE_URL') ?? 'https://oolala.ae').replace(/\/+$/, '');

type Lang = 'fr' | 'en' | 'ru';
type Booking = { ref: string; title: string; starts_at: string; ends_at: string; status: string; mode: string; name: string; email: string | null; phone: string | null;
  lang: Lang; client_tz: string | null; message: string | null; location_name: string | null; location_address: string | null; meeting_url: string | null; cancel_reason: string | null };
type Enquiry = { name: string; email: string; phone: string | null; country: string | null; need: string | null; message: string; lang: string | null; details: Record<string, string> };
type Msg = { id: string; kind: string; recipient: 'client' | 'staff'; to_email: string; lang: string; payload: Record<string, string>; timezone: string;
  booking: Booking | null; location: { maps_url: string | null; client_note: string | null } | null; enquiry: Enquiry | null };

const T = {
  fr: { hello: (n: string) => `Bonjour ${n},`, when: 'Date et heure', place: 'Lieu', ref: 'Référence', video: 'Visio — le lien vous sera envoyé avant l’échange', phone: 'Par téléphone',
    placeLater: 'Le lieu exact vous sera précisé à la confirmation', manage: 'Consulter ou annuler mon rendez-vous', map: 'Voir sur la carte', join: 'Rejoindre la visio',
    sign: 'À très vite,\nDarya — Oolala Corporate Services', reply: 'Une question ? Répondez simplement à cet email.', rebook: 'Reprendre rendez-vous',
    receivedConfirmed: ['Votre rendez-vous est confirmé', 'Votre rendez-vous est bien réservé.'], receivedPending: ['Demande de rendez-vous reçue', 'J’ai bien reçu votre demande de rendez-vous. Je reviens vers vous très vite pour la confirmer.'],
    confirmed: ['Votre rendez-vous est confirmé', 'Votre rendez-vous est confirmé.'], scheduled: ['Votre rendez-vous', 'Voici les détails de notre rendez-vous.'],
    cancelled: ['Votre rendez-vous est annulé', 'Votre rendez-vous a été annulé.'], reason: 'Motif', locale: 'fr-FR' },
  en: { hello: (n: string) => `Hello ${n},`, when: 'Date and time', place: 'Place', ref: 'Reference', video: 'Video call — the link will be sent before the meeting', phone: 'By phone',
    placeLater: 'The exact place will be given when the meeting is confirmed', manage: 'View or cancel my appointment', map: 'View on the map', join: 'Join the video call',
    sign: 'Speak soon,\nDarya — Oolala Corporate Services', reply: 'Any question? Just reply to this email.', rebook: 'Book a new appointment',
    receivedConfirmed: ['Your appointment is confirmed', 'Your appointment is booked.'], receivedPending: ['Appointment request received', 'I have received your appointment request and will get back to you shortly to confirm it.'],
    confirmed: ['Your appointment is confirmed', 'Your appointment is confirmed.'], scheduled: ['Your appointment', 'Here are the details of our meeting.'],
    cancelled: ['Your appointment is cancelled', 'Your appointment has been cancelled.'], reason: 'Reason', locale: 'en-GB' },
  ru: { hello: (n: string) => `Здравствуйте, ${n}!`, when: 'Дата и время', place: 'Место', ref: 'Номер', video: 'Видеозвонок — ссылку пришлю до встречи', phone: 'По телефону',
    placeLater: 'Точное место сообщу при подтверждении', manage: 'Посмотреть или отменить встречу', map: 'Открыть карту', join: 'Подключиться к видеозвонку',
    sign: 'До скорой встречи,\nДарья — Oolala Corporate Services', reply: 'Есть вопрос? Просто ответьте на это письмо.', rebook: 'Записаться снова',
    receivedConfirmed: ['Ваша встреча подтверждена', 'Ваша встреча забронирована.'], receivedPending: ['Запрос на встречу получен', 'Я получила ваш запрос на встречу и скоро свяжусь с вами для подтверждения.'],
    confirmed: ['Ваша встреча подтверждена', 'Ваша встреча подтверждена.'], scheduled: ['Ваша встреча', 'Детали нашей встречи.'],
    cancelled: ['Ваша встреча отменена', 'Ваша встреча отменена.'], reason: 'Причина', locale: 'ru-RU' },
};

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const prefix = (lang: Lang) => (lang === 'fr' ? '' : `/${lang}`);
function when(iso: string, lang: Lang, tz: string) {
  const text = new Intl.DateTimeFormat(T[lang].locale, { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  return `${text} (${tz.split('/').pop()?.replace('_', ' ')})`;
}

function layout(title: string, rows: [string, string][], paragraphs: string[], button?: [string, string], footer?: string) {
  const table = rows.map(([k, v]) => `<tr><td style="padding:8px 16px 8px 0;color:#5d6b68;font-size:13px;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;font-size:14px">${v}</td></tr>`).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#fbfaf6;font-family:Helvetica,Arial,sans-serif;color:#1f3b38">
<div style="max-width:560px;margin:0 auto;padding:32px 24px"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5d6b68">Oolala Corporate Services</div>
<h1 style="font-size:24px;font-weight:500;margin:18px 0 16px">${esc(title)}</h1>${paragraphs.map(p => `<p style="font-size:14px;line-height:1.7;margin:0 0 14px;white-space:pre-line">${p}</p>`).join('')}
${rows.length ? `<table style="border-top:1px solid #e3e0d6;border-bottom:1px solid #e3e0d6;margin:18px 0;width:100%">${table}</table>` : ''}
${button ? `<p style="margin:24px 0"><a href="${button[1]}" style="background:#1f3b38;color:#fbfaf6;text-decoration:none;padding:12px 18px;border-radius:4px;font-size:13px">${esc(button[0])}</a></p>` : ''}
${footer ? `<p style="font-size:12px;line-height:1.7;color:#5d6b68;white-space:pre-line">${footer}</p>` : ''}</div></body></html>`;
  const text = [title, '', ...paragraphs.map(p => p.replace(/<[^>]+>/g, '')), '', ...rows.map(([k, v]) => `${k}: ${v.replace(/<br>/g, ', ').replace(/<[^>]+>/g, '')}`), button ? `\n${button[0]}: ${button[1]}` : '', footer ? `\n${footer.replace(/<[^>]+>/g, '')}` : ''].join('\n');
  return { html, text };
}

function render(m: Msg): { subject: string; html: string; text: string } | null {
  const b = m.booking;
  if (m.recipient === 'client') {
    if (!b) return null;
    const lang = (['fr', 'en', 'ru'].includes(b.lang) ? b.lang : 'fr') as Lang;
    const t = T[lang];
    const tz = b.client_tz || m.timezone;
    const place = b.mode === 'in_person'
      ? (b.location_name || b.location_address ? esc([b.location_name, b.location_address].filter(Boolean).join(' — ')) + (m.location?.client_note ? `<br><span style="color:#5d6b68">${esc(m.location.client_note)}</span>` : '') : esc(t.placeLater))
      : b.mode === 'phone' ? esc(t.phone) : b.meeting_url ? `<a href="${esc(b.meeting_url)}">${esc(t.join)}</a>` : esc(t.video);
    const rows: [string, string][] = [[t.when, esc(when(b.starts_at, lang, tz))], [t.place, place], [t.ref, esc(b.ref)]];
    const footer = `${esc(t.reply)}\n\n${esc(t.sign)}`;
    let head: string[];
    let button: [string, string] | undefined;
    if (m.kind === 'booking_received') {
      head = b.status === 'confirmed' ? t.receivedConfirmed : t.receivedPending;
      if (m.payload.token) button = [t.manage, `${SITE}${prefix(lang)}/rendez-vous/gerer?ref=${encodeURIComponent(b.ref)}&token=${encodeURIComponent(m.payload.token)}`];
    } else if (m.kind === 'booking_confirmed') head = t.confirmed;
    else if (m.kind === 'booking_scheduled') head = t.scheduled;
    else if (m.kind === 'booking_cancelled') {
      head = t.cancelled;
      if (b.cancel_reason) rows.push([t.reason, esc(b.cancel_reason)]);
      button = [t.rebook, `${SITE}${prefix(lang)}/rendez-vous`];
    } else return null;
    if (m.location?.maps_url && b.mode === 'in_person' && m.kind !== 'booking_cancelled') rows.push(['', `<a href="${esc(m.location.maps_url)}">${esc(t.map)}</a>`]);
    const { html, text } = layout(head[0]!, rows, [esc(t.hello(b.name)), esc(head[1]!)], button, footer);
    return { subject: `${head[0]} · ${b.title}`, html, text };
  }
  // staff notifications, in French
  const admin = `${SITE}/admin`;
  if ((m.kind === 'booking_new' || m.kind === 'booking_cancelled') && b) {
    const isNew = m.kind === 'booking_new';
    const rows: [string, string][] = [['Rendez-vous', esc(b.title)], ['Quand', esc(when(b.starts_at, 'fr', m.timezone))], ['Client', esc([b.name, b.email, b.phone].filter(Boolean).join(' · '))]];
    if (b.message) rows.push(['Message', esc(b.message)]);
    if (!isNew && b.cancel_reason) rows.push(['Motif', esc(b.cancel_reason)]);
    const title = isNew ? (b.status === 'pending' ? 'Rendez-vous à confirmer' : 'Nouveau rendez-vous') : 'Rendez-vous annulé par le client';
    const { html, text } = layout(title, rows, [], ['Ouvrir le back-office', `${admin}#agenda`]);
    return { subject: `${title} · ${b.name} · ${when(b.starts_at, 'fr', m.timezone)}`, html, text };
  }
  if (m.kind === 'enquiry_new' && m.enquiry) {
    const e = m.enquiry;
    const rows: [string, string][] = [['De', esc([e.name, e.email, e.phone].filter(Boolean).join(' · '))], ['Besoin', esc([e.need, e.country].filter(Boolean).join(' · ') || '—')]];
    for (const [k, v] of Object.entries(e.details ?? {})) if (v) rows.push([k, esc(String(v))]);
    const { html, text } = layout('Nouvelle demande', rows, [esc(e.message)], ['Ouvrir le back-office', `${admin}#enquiries`]);
    return { subject: `Nouvelle demande · ${e.name}`, html, text };
  }
  return null;
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`${fn} ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

Deno.serve(async () => {
  if (!RESEND_KEY) return Response.json({ configured: false, sent: 0 });
  const messages: Msg[] = await rpc('solo_outbox_claim', { p_limit: 20 });
  let sent = 0;
  for (const m of messages) {
    const mail = render(m);
    if (!mail) { await rpc('solo_outbox_done', { p_id: m.id, p_ok: false, p_error: 'no template or missing data' }); continue; }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `solo-${m.id}` },
        body: JSON.stringify({ from: FROM, to: [m.to_email], reply_to: m.recipient === 'client' ? REPLY_TO : (m.booking?.email ?? m.enquiry?.email ?? REPLY_TO), subject: mail.subject, html: mail.html, text: mail.text }),
      });
      if (res.ok) { sent++; await rpc('solo_outbox_done', { p_id: m.id, p_ok: true }); }
      else await rpc('solo_outbox_done', { p_id: m.id, p_ok: false, p_error: `resend ${res.status} ${(await res.text()).slice(0, 300)}` });
    } catch (e) {
      await rpc('solo_outbox_done', { p_id: m.id, p_ok: false, p_error: String(e).slice(0, 300) });
    }
  }
  return Response.json({ configured: true, claimed: messages.length, sent });
});
