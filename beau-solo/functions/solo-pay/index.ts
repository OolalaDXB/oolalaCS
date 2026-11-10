// BEAU Solo — the client's payment page and the card checkout.
//  POST { action: 'invoice', number, token }   → the invoice document + whether card payment is on
//  POST { action: 'checkout', number, token }  → a Stripe Checkout URL for the balance
//  POST (Stripe-Signature header)               → Stripe webhook: a paid checkout is recorded once
// Without STRIPE_SECRET_KEY the page shows bank transfer only. CORS is limited to
// the host's origins, as for solo-public. Deployed with JWT verification off.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const SITE = (Deno.env.get('SOLO_SITE_URL') ?? 'https://oolala.ae').replace(/\/+$/, '');
const EXTRA_ORIGINS = (Deno.env.get('SOLO_ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean);
const ORIGIN_PATTERNS = [/^https:\/\/([a-z0-9-]+\.)*oolala\.ae$/, /^https:\/\/([a-z0-9-]+\.)*lovable\.app$/, /^https:\/\/([a-z0-9-]+\.)*lovableproject\.com$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const allowedOrigin = (o: string | null) => (o && (EXTRA_ORIGINS.includes(o) || ORIGIN_PATTERNS.some(p => p.test(o))) ? o : null);

function reply(body: unknown, status: number, origin: string | null): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (origin) { headers['Access-Control-Allow-Origin'] = origin; headers['Access-Control-Allow-Headers'] = 'content-type, authorization, apikey, x-client-info'; headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'; }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

const KNOWN: Record<string, number> = { not_found: 404, card_disabled: 409, already_paid: 409, currency_mismatch: 422 };
// deno-lint-ignore no-explicit-any
async function rpc(fn: string, args: Record<string, unknown>): Promise<{ ok: true; data: any } | { ok: false; error: string; status: number }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (res.ok) return { ok: true, data: body };
  const message = typeof body?.message === 'string' ? body.message : '';
  if (message in KNOWN) return { ok: false, error: message, status: KNOWN[message]! };
  console.error('solo-pay rpc failed', fn, res.status, message);
  return { ok: false, error: 'server_error', status: 500 };
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
// Stripe signs "<timestamp>.<raw body>" with HMAC-SHA256; reject old or forged events
export async function verifyStripe(raw: string, header: string, secret: string, now = Date.now(), toleranceSec = 300) {
  const t = Number(header.split(',').find(kv => kv.startsWith('t='))?.slice(2));
  const sigs = header.split(',').filter(kv => kv.startsWith('v1=')).map(kv => kv.slice(3));
  if (!secret || !Number.isFinite(t) || !sigs.length || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${raw}`)));
  return sigs.some(s => s.length === expected.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const pagePath = (lang: string) => (lang === 'en' || lang === 'ru' ? `/${lang}/payer` : '/payer');

Deno.serve(async req => {
  if (!SUPABASE_URL || !SERVICE_KEY) return new Response('not configured', { status: 503 });
  const signature = req.headers.get('stripe-signature');
  if (req.method === 'POST' && signature) {
    const raw = await req.text();
    if (!(await verifyStripe(raw, signature, STRIPE_WEBHOOK_SECRET))) return new Response('bad signature', { status: 400 });
    const event = JSON.parse(raw);
    const s = event?.data?.object;
    if ((event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') && s?.payment_status === 'paid' && s?.metadata?.invoice) {
      const r = await rpc('solo_card_paid', { p_number: s.metadata.invoice, p_session: s.id, p_amount: s.amount_total, p_currency: s.currency });
      if (!r.ok) return new Response(r.error, { status: r.status === 404 ? 200 : 500 });  // an unknown invoice is not retried
    }
    return new Response('ok', { status: 200 });
  }

  const origin = allowedOrigin(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return origin ? reply(null, 204, origin) : new Response(null, { status: 403 });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405, origin);
  if (!origin) return reply({ error: 'forbidden_origin' }, 403, null);
  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return reply({ error: 'invalid_json' }, 400, origin); }
  const number = str(input.number, 40), token = str(input.token, 64);
  if (!/^[A-Z0-9]{1,8}-\d{4}-\d{4,}$/.test(number) || !/^[0-9a-f]{48}$/.test(token)) return reply({ error: 'not_found' }, 404, origin);

  if (input.action === 'invoice') {
    const r = await rpc('solo_public_invoice', { p_number: number, p_token: token });
    if (!r.ok) return reply({ error: r.error }, r.status, origin);
    return reply({ ...r.data, card: !!STRIPE_KEY && r.data.pay_card !== false }, 200, origin);
  }
  if (input.action === 'checkout') {
    if (!STRIPE_KEY) return reply({ error: 'card_unavailable' }, 503, origin);
    const r = await rpc('solo_public_invoice_checkout', { p_number: number, p_token: token });
    if (!r.ok) return reply({ error: r.error }, r.status, origin);
    const c = r.data as { number: string; amount: number; currency: string; email: string | null; description: string; lang: string };
    const lang = input.lang === 'en' || input.lang === 'ru' || input.lang === 'fr' ? String(input.lang) : c.lang;
    const back = `${SITE}${pagePath(lang)}?n=${encodeURIComponent(c.number)}&t=${token}`;
    const form = new URLSearchParams({
      mode: 'payment', success_url: `${back}&paid=1`, cancel_url: back, client_reference_id: c.number, 'metadata[invoice]': c.number,
      'payment_intent_data[metadata][invoice]': c.number, 'payment_intent_data[description]': c.description, locale: lang === 'ru' ? 'ru' : lang === 'en' ? 'en' : 'fr',
      'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': c.currency.toLowerCase(), 'line_items[0][price_data][unit_amount]': String(c.amount),
      'line_items[0][price_data][product_data][name]': c.description,
    });
    if (c.email) form.set('customer_email', c.email);
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `${c.number}-${c.amount}-${lang}-${Math.floor(Date.now() / 600000)}` }, body: form });
    const body = await res.json();
    if (!res.ok || typeof body?.url !== 'string') { console.error('stripe checkout failed', res.status, body?.error?.message); return reply({ error: 'card_unavailable' }, 502, origin); }
    return reply({ url: body.url }, 200, origin);
  }
  return reply({ error: 'unknown_action' }, 400, origin);
});
