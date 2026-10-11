// node --experimental-strip-types beau-solo/functions/tests/solo-outbox.test.mjs
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc', RESEND_API_KEY: 're_test' };
let handler; globalThis.Deno = { env: { get: k => env[k] }, serve: h => { handler = h; } };
const booking = { ref: 'AB12CD34', title: 'Rendez-vous à Dubai', starts_at: '2026-10-19T05:00:00Z', ends_at: '2026-10-19T06:00:00Z', status: 'pending', mode: 'in_person', name: 'Иван', email: 'ivan@example.com', phone: '+971500000000', lang: 'ru', client_tz: null, message: 'RAKEZ <script>', location_name: null, location_address: null, meeting_url: null, cancel_reason: null };
const msgs = [
  { id: 'm1', kind: 'booking_received', recipient: 'client', to_email: 'ivan@example.com', lang: 'ru', payload: { ref: 'AB12CD34', token: 'tok' }, timezone: 'Asia/Dubai', booking, location: null, enquiry: null },
  { id: 'm2', kind: 'booking_new', recipient: 'staff', to_email: 'darya@oolala.ae', lang: 'fr', payload: { ref: 'AB12CD34' }, timezone: 'Asia/Dubai', booking, location: null, enquiry: null },
  { id: 'm3', kind: 'enquiry_new', recipient: 'staff', to_email: 'darya@oolala.ae', lang: 'fr', payload: {}, timezone: 'Asia/Dubai', booking: null, location: null, enquiry: { name: 'Marc', email: 'marc@example.com', phone: null, country: 'UAE', need: 'Société', message: 'Bonjour', lang: 'fr', details: { budget: '3k' } } },
  { id: 'm4', kind: 'unknown_kind', recipient: 'staff', to_email: 'darya@oolala.ae', lang: 'fr', payload: {}, timezone: 'Asia/Dubai', booking: null, location: null, enquiry: null },
];
const sent = [], done = [];
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  if (url.endsWith('/rpc/solo_outbox_claim')) return new Response(JSON.stringify(msgs));
  if (url.endsWith('/rpc/solo_outbox_done')) { done.push(body); return new Response(''); }
  if (url === 'https://api.resend.com/emails') { sent.push({ body, key: init.headers['Idempotency-Key'] }); return new Response('{"id":"e"}'); }
  throw new Error('unexpected ' + url);
};
const here = path.dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(path.join(here, '../solo-outbox/index.ts')).href);
const out = await (await handler(new Request('https://fn'))).json();
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
ok(out.claimed === 4 && out.sent === 3, 'three messages sent, one without template');
const [client, staff, enq] = sent.map(s => s.body);
ok(client.to[0] === 'ivan@example.com' && client.subject.startsWith('Запрос на встречу получен'), 'client mail in the client language');
ok(client.html.includes('https://oolala.ae/ru/rendez-vous/gerer?ref=AB12CD34&token=tok'), 'client mail carries the localized manage link');
ok(client.html.includes('Точное место сообщу при подтверждении'), 'a place to define is announced, not invented');
ok(client.reply_to === 'darya@oolala.ae' && client.from.includes('darya@oolala.ae'), 'replies go to Darya');
ok(staff.subject.startsWith('Rendez-vous à confirmer · Иван') && staff.reply_to === 'ivan@example.com', 'staff mail in French, reply goes to the client');
ok(staff.html.includes('RAKEZ &lt;script&gt;') && !staff.html.includes('<script>'), 'client text is escaped');
ok(enq.subject === 'Nouvelle demande · Marc' && enq.html.includes('https://oolala.ae/admin#enquiries'), 'enquiry mail links to the back office');
ok(sent.every(s => s.key.startsWith('solo-m')), 'each send is idempotent per message');
ok(done.filter(d => d.p_ok).length === 3 && done.some(d => d.p_id === 'm4' && !d.p_ok), 'results are reported back');
env.RESEND_API_KEY = '';
console.log(`SOLO_OUTBOX ok=${n}`);
