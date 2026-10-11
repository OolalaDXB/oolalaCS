// BEAU Solo — public endpoint for the host website.
// POST { action, ... } → types | slots | book | booking | cancel | enquiry.
// Public by design (no JWT): it only reaches the service-role functions
// public.solo_public_*, which validate every field and rate-limit by email and
// by a salted hash of the caller's IP. CORS is limited to the host's origins.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const IP_SALT = Deno.env.get('SOLO_IP_SALT') ?? SUPABASE_URL;
// Comma-separated exact origins, added to the defaults below.
const EXTRA_ORIGINS = (Deno.env.get('SOLO_ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean);

const ORIGIN_PATTERNS = [
  /^https:\/\/([a-z0-9-]+\.)*oolala\.ae$/,
  /^https:\/\/([a-z0-9-]+\.)*lovable\.app$/,
  /^https:\/\/([a-z0-9-]+\.)*lovableproject\.com$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (EXTRA_ORIGINS.includes(origin) || ORIGIN_PATTERNS.some(p => p.test(origin))) return origin;
  return null;
}

function reply(body: unknown, status: number, origin: string | null): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'content-type, authorization, apikey, x-client-info';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

async function ipHash(req: Request): Promise<string | null> {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || '';
  if (!ip) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${IP_SALT}|${ip}`));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Database error messages that are safe to return, with their HTTP status.
const KNOWN: Record<string, number> = {
  unknown_type: 404, not_found: 404,
  invalid_name: 422, invalid_email: 422, invalid_message: 422,
  slot_unavailable: 409, not_cancellable: 409,
  too_many_bookings: 429, too_many_requests: 429,
};

async function rpc(fn: string, args: Record<string, unknown>): Promise<{ ok: true; data: unknown } | { ok: false; error: string; status: number }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (res.ok) return { ok: true, data: body };
  const message = typeof body?.message === 'string' ? body.message : '';
  if (message in KNOWN) return { ok: false, error: message, status: KNOWN[message] };
  console.error('solo-public rpc failed', fn, res.status, message);
  return { ok: false, error: 'server_error', status: 500 };
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : undefined);
const lang = (v: unknown) => (v === 'en' || v === 'ru' ? v : 'fr');
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

Deno.serve(async req => {
  const origin = allowedOrigin(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return origin ? reply(null, 204, origin) : new Response(null, { status: 403 });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405, origin);
  if (!origin) return reply({ error: 'forbidden_origin' }, 403, null);
  if (!SUPABASE_URL || !SERVICE_KEY) return reply({ error: 'not_configured' }, 503, origin);

  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return reply({ error: 'invalid_json' }, 400, origin);
  }
  // honeypot: bots fill every field
  if (typeof input.website === 'string' && input.website.trim()) return reply({ ok: true }, 200, origin);

  let result;
  switch (input.action) {
    case 'types':
      result = await rpc('solo_public_types', { p_lang: lang(input.lang) });
      break;
    case 'slots':
      if (!isDate(input.from) || !isDate(input.to)) return reply({ error: 'invalid_dates' }, 422, origin);
      result = await rpc('solo_public_slots', { p_type: str(input.type, 40), p_from: input.from, p_to: input.to });
      break;
    case 'book':
      result = await rpc('solo_public_book', { p: {
        type: str(input.type, 40), starts_at: str(input.starts_at, 40), name: str(input.name, 120), email: str(input.email, 200),
        phone: str(input.phone, 40), lang: lang(input.lang), message: str(input.message, 3000), client_tz: str(input.client_tz, 60),
        ip_hash: await ipHash(req),
      } });
      break;
    case 'booking':
      result = await rpc('solo_public_booking', { p_ref: str(input.ref, 20), p_token: str(input.token, 100) });
      break;
    case 'cancel':
      result = await rpc('solo_public_cancel', { p_ref: str(input.ref, 20), p_token: str(input.token, 100), p_reason: str(input.reason, 1000) ?? null });
      break;
    case 'enquiry': {
      const details = input.details && typeof input.details === 'object' && !Array.isArray(input.details)
        ? Object.fromEntries(Object.entries(input.details as Record<string, unknown>).slice(0, 10).map(([k, v]) => [k.slice(0, 40), str(v, 200)]))
        : {};
      result = await rpc('solo_public_enquiry', { p: {
        name: str(input.name, 120), email: str(input.email, 200), phone: str(input.phone, 40), country: str(input.country, 80),
        need: str(input.need, 120), message: str(input.message, 5000), lang: lang(input.lang), page: str(input.page, 200), details,
        ip_hash: await ipHash(req),
      } });
      break;
    }
    default:
      return reply({ error: 'unknown_action' }, 400, origin);
  }
  return result.ok ? reply(result.data, 200, origin) : reply({ error: result.error }, result.status, origin);
});
