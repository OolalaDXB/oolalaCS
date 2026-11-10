// node --experimental-strip-types beau-solo/functions/tests/solo-pay.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test' };
let handler; globalThis.Deno = { env: { get: k => env[k] }, serve: h => { handler = h; } };
const here = path.dirname(fileURLToPath(import.meta.url));
const mod = await import(pathToFileURL(path.join(here, '../solo-pay/index.ts')).href);
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const token = 'a'.repeat(48), number = 'OCS-2026-0001';
const calls = []; let stripeBody = null;
globalThis.fetch = async (url, init) => {
  if (url.endsWith('/rpc/solo_public_invoice')) { const b = JSON.parse(init.body); calls.push(['view', b]); return b.p_token === token ? new Response(JSON.stringify({ number, total: 329166, balance: 229166, pay_card: true })) : new Response(JSON.stringify({ message: 'not_found' }), { status: 400 }); }
  if (url.endsWith('/rpc/solo_public_invoice_checkout')) return new Response(JSON.stringify({ number, amount: 229166, currency: 'USD', email: 'anna@ex.com', description: 'Oolala Corporate Services · OCS-2026-0001', lang: 'fr' }));
  if (url.endsWith('/rpc/solo_card_paid')) { calls.push(['paid', JSON.parse(init.body)]); return new Response('{}'); }
  if (url === 'https://api.stripe.com/v1/checkout/sessions') { stripeBody = new URLSearchParams(init.body); return new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/cs_test' })); }
  throw new Error('unexpected ' + url);
};
const post = (body, origin = 'https://www.oolala.ae') => handler(new Request('https://fn/solo-pay', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const view = await post({ action: 'invoice', number, token });
const vb = await view.json();
ok(view.status === 200 && vb.balance === 229166 && vb.card === true, 'the page gets the invoice and card availability');
ok((await post({ action: 'invoice', number, token: 'b'.repeat(48) })).status === 404, 'a wrong token gets nothing');
ok((await post({ action: 'invoice', number: "x'; select", token })).status === 404 && calls.length === 2, 'a malformed number never reaches the database');
ok((await post({ action: 'invoice', number, token }, 'https://evil.example')).status === 403, 'other sites are refused');
const co = await (await post({ action: 'checkout', number, token, lang: 'en' })).json();
ok(co.url === 'https://checkout.stripe.com/c/pay/cs_test', 'checkout returns the Stripe page');
ok(stripeBody.get('line_items[0][price_data][unit_amount]') === '229166' && stripeBody.get('line_items[0][price_data][currency]') === 'usd', 'Stripe charges the balance, in the invoice currency');
ok(stripeBody.get('metadata[invoice]') === number && stripeBody.get('success_url') === `https://oolala.ae/en/payer?n=${number}&t=${token}&paid=1`, 'the session points back to the localized page');
const event = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_1', payment_status: 'paid', amount_total: 229166, currency: 'usd', metadata: { invoice: number } } } });
const t = Math.floor(Date.now() / 1000);
const sig = crypto.createHmac('sha256', 'whsec_test').update(`${t}.${event}`).digest('hex');
const hook = h => handler(new Request('https://fn/solo-pay', { method: 'POST', headers: { 'stripe-signature': h }, body: event }));
ok((await hook(`t=${t},v1=${sig}`)).status === 200 && calls.at(-1)[0] === 'paid' && calls.at(-1)[1].p_session === 'cs_test_1', 'a signed paid session is recorded');
const before = calls.length;
ok((await hook(`t=${t},v1=${'0'.repeat(64)}`)).status === 400 && calls.length === before, 'a forged signature is refused');
ok((await hook(`t=${t - 3600},v1=${crypto.createHmac('sha256', 'whsec_test').update(`${t - 3600}.${event}`).digest('hex')}`)).status === 400, 'an old event is refused');
ok(await mod.verifyStripe(event, `t=${t},v1=bad,v1=${sig}`, 'whsec_test'), 'one valid signature among several is enough');
console.log('SOLO_PAY ok=' + n);
