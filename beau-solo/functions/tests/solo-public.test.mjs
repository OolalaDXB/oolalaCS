// Unit test for functions/solo-public without Deno or network:
// node --experimental-strip-types beau-solo/functions/tests/solo-public.test.mjs
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-key', SOLO_IP_SALT: 'salt' };
let handler;
globalThis.Deno = { env: { get: k => env[k] }, serve: h => { handler = h; } };
const calls = [];
let next = { status: 200, body: [] };
globalThis.fetch = async (url, init) => {
  calls.push({ url, init, body: JSON.parse(init.body) });
  return new Response(JSON.stringify(next.body), { status: next.status });
};
const here = path.dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(path.join(here, '../solo-public/index.ts')).href);

const post = (body, origin = 'https://id-preview--abc.lovable.app', headers = {}) =>
  handler(new Request('https://fn/solo-public', { method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }));
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

let r = await post({ action: 'types', lang: 'ru' });
ok(r.status === 200 && r.headers.get('access-control-allow-origin') === 'https://id-preview--abc.lovable.app', 'allowed origin is echoed');
ok(calls.at(-1).url.endsWith('/rest/v1/rpc/solo_public_types') && calls.at(-1).body.p_lang === 'ru', 'types forwards the language');
ok(calls.at(-1).init.headers.Authorization === 'Bearer service-key', 'the service key is used server-side only');

r = await post({ action: 'types' }, 'https://evil.example');
ok(r.status === 403 && !r.headers.get('access-control-allow-origin'), 'a foreign origin is refused');
r = await handler(new Request('https://fn/solo-public', { method: 'OPTIONS', headers: { origin: 'https://www.oolala.ae' } }));
ok(r.status === 204 && r.headers.get('access-control-allow-methods') === 'POST, OPTIONS', 'preflight from oolala.ae passes');

r = await post({ action: 'slots', type: 'decouverte', from: '2026-10-19', to: 'tomorrow' });
ok(r.status === 422, 'invalid dates are refused before the database');

const before = calls.length;
r = await post({ action: 'enquiry', website: 'http://spam', name: 'Bot' });
ok(r.status === 200 && calls.length === before, 'the honeypot short-circuits without touching the database');

next = { status: 200, body: { ok: true } };
r = await post({ action: 'book', type: 'decouverte', starts_at: '2026-10-19T05:00:00Z', name: 'A', email: 'a@b.co', lang: 'xx' }, 'http://localhost:8080', { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' });
const p = calls.at(-1).body.p;
ok(p.lang === 'fr' && /^[0-9a-f]{64}$/.test(p.ip_hash) && !JSON.stringify(p).includes('1.2.3.4'), 'booking sends a hashed IP and a safe language');

next = { status: 400, body: { message: 'slot_unavailable', code: 'P0001' } };
r = await post({ action: 'book', type: 'decouverte', starts_at: 'x', name: 'A', email: 'a@b.co' });
ok(r.status === 409 && (await r.json()).error === 'slot_unavailable', 'a taken slot maps to 409');
next = { status: 500, body: { message: 'relation "beau_solo.secret" does not exist' } };
r = await post({ action: 'booking', ref: 'AB', token: 't' });
ok(r.status === 500 && (await r.json()).error === 'server_error', 'unknown database errors are not leaked');

next = { status: 200, body: { ok: true } };
await post({ action: 'enquiry', name: 'A', email: 'a@b.co', message: 'Hi', details: { budget: '100k', zone: 'Gudauri', nested: { x: 1 } } });
ok(calls.at(-1).body.p.details.budget === '100k' && calls.at(-1).body.p.details.nested === undefined, 'enquiry details keep only short strings');

r = await post({ action: 'drop_tables' });
ok(r.status === 400, 'unknown actions are refused');
console.log(`SOLO_PUBLIC ok=${n}`);
