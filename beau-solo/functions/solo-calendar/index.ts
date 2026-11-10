// BEAU Solo — calendar sync, both ways.
//  GET  ?t=<token>  the staff member's private iCal feed (Proton, Google, Apple
//                   subscribe to it); the token is checked by its hash in the database.
//  POST             (pg_cron, every 15 minutes) reads the external calendars that
//                   are due — their secret iCal address — and stores their busy
//                   times, which the site's booking slots then avoid.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const HOST = 'oolala.ae';
const AHEAD_DAYS = 120;

/* ---------- writing iCalendar (RFC 5545) ---------- */
export const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// lines of at most 75 octets, continued with a leading space
export function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = []; let cur = ''; let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; size = 0; }
    cur += ch; size += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

type FeedBooking = { id: string; ref: string; title: string; starts_at: string; ends_at: string; status: string; mode: string; name: string; email: string | null;
  phone: string | null; meeting_url: string | null; location: string | null; message: string | null; note: string | null; updated_at: string };
export function buildIcs(feed: { name: string; bookings: FeedBooking[] }, now = new Date()) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BEAU Solo//Oolala//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(`Oolala · ${feed.name}`)}`, 'X-PUBLISHED-TTL:PT15M', 'REFRESH-INTERVAL;VALUE=DURATION:PT15M'];
  for (const b of feed.bookings) {
    const pending = b.status === 'pending';
    const desc = [b.name, b.phone, b.email, b.meeting_url ? `Visio : ${b.meeting_url}` : null, b.message ? `Message : ${b.message}` : null, b.note ? `Note : ${b.note}` : null, `Réf. ${b.ref}`]
      .filter(Boolean).join('\n');
    L.push('BEGIN:VEVENT', `UID:${b.id}@${HOST}`, `DTSTAMP:${stamp(now.toISOString())}`, `LAST-MODIFIED:${stamp(b.updated_at)}`,
      `DTSTART:${stamp(b.starts_at)}`, `DTEND:${stamp(b.ends_at)}`,
      `SUMMARY:${icsEscape(`${pending ? '[À confirmer] ' : ''}${b.title} · ${b.name}`)}`,
      `DESCRIPTION:${icsEscape(desc)}`, `STATUS:${pending ? 'TENTATIVE' : 'CONFIRMED'}`);
    if (b.location) L.push(`LOCATION:${icsEscape(b.location)}`);
    else if (b.mode === 'video' && b.meeting_url) L.push(`LOCATION:${icsEscape(b.meeting_url)}`);
    if (b.meeting_url) L.push(`URL:${b.meeting_url}`);
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}

/* ---------- reading iCalendar: busy times ---------- */
type Prop = { name: string; params: Record<string, string>; value: string };
export function unfold(ics: string) { return ics.replace(/\r\n[ \t]|\n[ \t]/g, '').split(/\r?\n/); }
function prop(line: string): Prop | null {
  const i = line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  if (i < 0) return null;
  const [name = '', ...ps] = line.slice(0, i).split(';');
  const params: Record<string, string> = {};
  for (const p of ps) { const [k, v = ''] = p.split('='); if (k) params[k.toUpperCase()] = v.replace(/^"|"$/g, ''); }
  return { name: name.toUpperCase(), params, value: line.slice(i + 1) };
}

function offsetMinutes(instant: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(instant));
  const g = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0);
  return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - instant) / 60000;
}
// a wall-clock time in a zone → epoch milliseconds
export function zoned(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let t = guess - offsetMinutes(guess, tz) * 60000;
  t = guess - offsetMinutes(t, tz) * 60000;
  return t;
}
const validZone = (z: string | undefined) => { if (!z) return false; try { new Intl.DateTimeFormat('en', { timeZone: z }); return true; } catch { return false; } };

type When = { t: number; allDay: boolean; wall: [number, number, number, number, number, number]; tz: string | null };
export function parseWhen(p: Prop, fallbackTz: string): When | null {
  const v = p.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!m[4] || p.params['VALUE'] === 'DATE') return { t: zoned(y, mo, d, 0, 0, 0, fallbackTz), allDay: true, wall: [y, mo, d, 0, 0, 0], tz: fallbackTz };
  const [h, mi, s] = [Number(m[4]), Number(m[5]), Number(m[6])];
  if (m[7]) return { t: Date.UTC(y, mo - 1, d, h, mi, s), allDay: false, wall: [y, mo, d, h, mi, s], tz: null };
  const tz = validZone(p.params['TZID']) ? p.params['TZID']! : fallbackTz;
  return { t: zoned(y, mo, d, h, mi, s, tz), allDay: false, wall: [y, mo, d, h, mi, s], tz };
}
export function durationMs(v: string) {
  const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const ms = (((Number(m[2] ?? 0) * 7 + Number(m[3] ?? 0)) * 24 + Number(m[4] ?? 0)) * 60 + Number(m[5] ?? 0)) * 60000 + Number(m[6] ?? 0) * 1000;
  return m[1] === '-' ? -ms : ms;
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
// the starts of a recurring event within [from, to): DAILY, WEEKLY (BYDAY), MONTHLY and YEARLY,
// with INTERVAL, COUNT and UNTIL. Each occurrence keeps the first one's wall-clock time in its zone.
export function occurrences(start: When, rrule: string, from: number, to: number, fallbackTz: string): number[] {
  const r: Record<string, string> = Object.fromEntries(rrule.split(';').map(x => x.split('=') as [string, string]).filter(([k]) => k).map(([k, v]) => [k.toUpperCase(), v]));
  const freq = r['FREQ']; const interval = Math.max(1, Number(r['INTERVAL'] ?? 1) || 1);
  const count = r['COUNT'] ? Number(r['COUNT']) : Infinity;
  const untilProp = r['UNTIL'] ? parseWhen({ name: 'UNTIL', params: {}, value: r['UNTIL'] }, fallbackTz) : null;
  const until = untilProp ? untilProp.t + (untilProp.allDay ? 86400000 - 1 : 0) : Infinity;
  const [y0, mo0, d0, h, mi, s] = start.wall; const tz = start.tz;
  const at = (y: number, mo: number, d: number) => tz ? zoned(y, mo, d, h, mi, s, tz) : Date.UTC(y, mo - 1, d, h, mi, s);
  const out: number[] = []; let n = 0;
  const base = new Date(Date.UTC(y0, mo0 - 1, d0));
  const push = (t: number) => { if (t < start.t) return true; n++; if (n > count || t > until) return false; if (t >= from && t < to) out.push(t); return t < to; };
  for (let k = 0; k < 2000; k++) {
    if (freq === 'DAILY' || freq === 'MONTHLY' || freq === 'YEARLY') {
      const d = new Date(base);
      if (freq === 'DAILY') d.setUTCDate(d.getUTCDate() + k * interval);
      else if (freq === 'MONTHLY') { d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + k * interval); if (new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate() < d0) continue; d.setUTCDate(d0); }
      else { d.setUTCFullYear(d.getUTCFullYear() + k * interval); if (d.getUTCMonth() !== mo0 - 1) continue; }
      if (!push(at(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()))) break;
    } else if (freq === 'WEEKLY') {
      const days = (r['BYDAY'] ? r['BYDAY'].split(',').map(x => DAYS.indexOf(x.replace(/^[+-]?\d+/, ''))).filter(x => x >= 0) : [base.getUTCDay()]).sort();
      const weekStart = new Date(base); weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay() + k * 7 * interval);
      let go = true;
      for (const wd of days) { const d = new Date(weekStart); d.setUTCDate(d.getUTCDate() + wd); if (!push(at(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()))) { go = false; break; } }
      if (!go) break;
    } else break;
  }
  return out;
}

export type Busy = { start: string; end: string; summary: string | null };
export function busyTimes(ics: string, fallbackTz: string, now = Date.now(), aheadDays = AHEAD_DAYS): Busy[] {
  const lines = unfold(ics);
  const calTz = lines.map(prop).find(p => p?.name === 'X-WR-TIMEZONE')?.value;
  const tzDefault = validZone(calTz) ? calTz! : fallbackTz;
  const from = now, to = now + aheadDays * 86400000;
  type Ev = { uid: string; start: When; end: number | null; dur: number | null; rrule: string | null; exdates: Set<number>; recurrenceId: number | null; summary: string | null; skip: boolean };
  const evs: Ev[] = []; let cur: Ev | null = null; let depth = 0;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { uid: '', start: null as unknown as When, end: null, dur: null, rrule: null, exdates: new Set(), recurrenceId: null, summary: null, skip: false }; depth = 0; continue; }
    if (!cur) continue;
    if (line.startsWith('BEGIN:')) { depth++; continue; }       // VALARM and the like
    if (line.startsWith('END:') && depth > 0) { depth--; continue; }
    if (line === 'END:VEVENT') { if (cur.start) evs.push(cur); cur = null; continue; }
    if (depth > 0) continue;
    const p = prop(line); if (!p) continue;
    if (p.name === 'UID') cur.uid = p.value;
    else if (p.name === 'DTSTART') cur.start = parseWhen(p, tzDefault) as When;
    else if (p.name === 'DTEND') cur.end = parseWhen(p, tzDefault)?.t ?? null;
    else if (p.name === 'DURATION') cur.dur = durationMs(p.value);
    else if (p.name === 'RRULE') cur.rrule = p.value;
    else if (p.name === 'EXDATE') for (const v of p.value.split(',')) { const w = parseWhen({ ...p, value: v }, tzDefault); if (w) cur.exdates.add(w.t); }
    else if (p.name === 'RECURRENCE-ID') cur.recurrenceId = parseWhen(p, tzDefault)?.t ?? null;
    else if (p.name === 'SUMMARY') cur.summary = p.value.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').slice(0, 200);
    else if (p.name === 'STATUS' && p.value.toUpperCase() === 'CANCELLED') cur.skip = true;
    else if (p.name === 'TRANSP' && p.value.toUpperCase() === 'TRANSPARENT') cur.skip = true;
  }
  // an edited occurrence replaces the one its series would have produced
  const moved = new Map<string, Set<number>>();
  for (const e of evs) if (e.recurrenceId != null) { const s = moved.get(e.uid) ?? new Set(); s.add(e.recurrenceId); moved.set(e.uid, s); }
  const out: Busy[] = [];
  for (const e of evs) {
    if (e.skip) continue;
    const length = e.end != null ? e.end - e.start.t : e.dur != null ? e.dur : e.start.allDay ? 86400000 : 0;
    if (length <= 0) continue;
    const starts = e.rrule && e.recurrenceId == null ? occurrences(e.start, e.rrule, from - length, to, tzDefault) : [e.start.t];
    for (const t of starts) {
      if (e.rrule && (e.exdates.has(t) || moved.get(e.uid)?.has(t))) continue;
      if (t + length <= from || t >= to) continue;
      out.push({ start: new Date(t).toISOString(), end: new Date(t + length).toISOString(), summary: e.summary });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start)).slice(0, 2000);
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`${fn} ${res.status} ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

Deno.serve(async (req) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    const token = new URL(req.url).searchParams.get('t') ?? '';
    if (!/^[0-9a-f]{48}$/.test(token)) return new Response('Not found', { status: 404 });
    const feed = await rpc('solo_calendar_feed', { p_token: token });
    if (!feed) return new Response('Not found', { status: 404 });
    return new Response(req.method === 'HEAD' ? null : buildIcs(feed), { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300', 'Content-Disposition': 'inline; filename="oolala.ics"' } });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const due: { id: string; url: string; timezone: string }[] = await rpc('solo_calendar_due', { p_limit: 10 });
  let synced = 0, failed = 0;
  await Promise.all(due.map(async c => {
    try {
      const res = await fetch(c.url, { headers: { Accept: 'text/calendar, */*;q=0.5', 'User-Agent': 'BEAU Solo calendar sync (oolala.ae)' }, signal: AbortSignal.timeout(20000), redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.text()).slice(0, 8_000_000);
      if (!body.includes('BEGIN:VCALENDAR')) throw new Error('not an iCal calendar');
      await rpc('solo_calendar_store', { p_id: c.id, p_events: busyTimes(body, c.timezone || 'Asia/Dubai') });
      synced++;
    } catch (e) {
      failed++;
      await rpc('solo_calendar_store', { p_id: c.id, p_events: null, p_error: String(e instanceof Error ? e.message : e).slice(0, 300) }).catch(() => {});
    }
  }));
  return Response.json({ calendars: due.length, synced, failed });
});
