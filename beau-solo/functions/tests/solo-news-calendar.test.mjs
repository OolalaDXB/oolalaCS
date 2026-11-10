// node --experimental-strip-types beau-solo/functions/tests/solo-news-calendar.test.mjs
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
const handlers = [];
globalThis.Deno = { env: { get: k => env[k] }, serve: h => { handlers.push(h); } };
const here = path.dirname(fileURLToPath(import.meta.url));
const news = await import(pathToFileURL(path.join(here, '../solo-news/index.ts')).href);
const cal = await import(pathToFileURL(path.join(here, '../solo-calendar/index.ts')).href);
const [newsHandler, calHandler] = handlers;
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

/* news parsing */
const rss = `<?xml version="1.0"?><rss><channel><title>T</title>
<item><title><![CDATA[Golden visa : nouvelles règles &amp; délais]]></title><link>https://ex.com/a?x=1&amp;y=2</link><guid isPermaLink="false">g1</guid>
<description>&lt;p&gt;Les &lt;b&gt;investisseurs&lt;/b&gt; &#233;ligibles&lt;/p&gt;</description><pubDate>Tue, 10 Nov 2026 08:00:00 +0400</pubDate></item>
<item><title>Sans lien</title><link>javascript:alert(1)</link></item>
<item><title></title><guid>empty</guid></item></channel></rss>`;
const items = news.parseFeed(rss);
ok(items.length === 2, 'two items with a title');
ok(items[0].title === 'Golden visa : nouvelles règles & délais' && items[0].guid === 'g1', 'CDATA and entities decoded');
ok(items[0].link === 'https://ex.com/a?x=1&y=2', 'link entities decoded');
ok(items[0].summary === 'Les investisseurs éligibles', 'summary stripped of tags, numeric entities decoded');
ok(items[0].published_at === '2026-11-10T04:00:00.000Z', 'RFC 822 date with offset');
ok(items[1].link === null && items[1].guid === 'Sans lien', 'a non-web link is dropped, the title stands in as guid');
const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title type="html">Corporate tax update</title><link rel="alternate" href="https://ex.com/ct"/><id>urn:1</id><updated>2026-11-09T10:00:00Z</updated><summary>FTA guidance</summary></entry></feed>`;
const a = news.parseFeed(atom);
ok(a.length === 1 && a[0].link === 'https://ex.com/ct' && a[0].guid === 'urn:1' && a[0].summary === 'FTA guidance', 'Atom entries read');

const calls = [];
globalThis.fetch = async (url, init) => {
  if (url.endsWith('/rpc/solo_news_due')) return new Response(JSON.stringify([{ id: 's1', url: 'https://feeds.ex.com/ok.xml' }, { id: 's2', url: 'https://feeds.ex.com/404.xml' }, { id: 's3', url: 'https://feeds.ex.com/html' }]));
  if (url.endsWith('/rpc/solo_news_ingest')) { const b = JSON.parse(init.body); calls.push(b); return new Response(String(b.p_items.length)); }
  if (url === 'https://feeds.ex.com/ok.xml') return new Response(rss);
  if (url === 'https://feeds.ex.com/404.xml') return new Response('nope', { status: 404 });
  if (url === 'https://feeds.ex.com/html') return new Response('<html><body>hello</body></html>');
  throw new Error('unexpected ' + url);
};
const nr = await (await newsHandler(new Request('https://fn', { method: 'POST' }))).json();
ok(nr.sources === 3 && nr.stored === 2 && nr.failed === 2, 'one feed stored, a 404 and a web page reported');
ok(calls.find(c => c.p_source === 's2').p_error === 'HTTP 404' && calls.find(c => c.p_source === 's3').p_error === 'not a feed', 'each failure says why');

/* calendar: writing */
const feed = { name: 'Darya', bookings: [
  { id: 'b1', ref: 'AB12', title: 'Rendez-vous à Dubai', starts_at: '2026-11-12T06:00:00Z', ends_at: '2026-11-12T07:00:00Z', status: 'pending', mode: 'in_person', name: 'Anna; Petrova, LLC',
    email: 'anna@ex.com', phone: '+971', meeting_url: null, location: 'DMCC, Tower 2', message: 'Ligne 1\nLigne 2 avec un texte assez long pour dépasser soixante-quinze octets, accentué éèà', note: null, updated_at: '2026-11-10T00:00:00Z' }] };
const ics = cal.buildIcs(feed, new Date('2026-11-10T12:00:00Z'));
ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'), 'a calendar with CRLF lines');
ok(ics.includes('DTSTART:20261112T060000Z') && ics.includes('STATUS:TENTATIVE'), 'UTC times, a pending booking is tentative');
ok(ics.includes('SUMMARY:[À confirmer] Rendez-vous à Dubai · Anna\\; Petrova\\, LLC'), 'text escaped');
ok(ics.split('\r\n').every(l => new TextEncoder().encode(l).length <= 75), 'every line folded to 75 octets');
ok(cal.unfold(ics).some(l => l.startsWith('DESCRIPTION:') && l.includes('accentué éèà')), 'folding keeps characters whole');
ok(ics.includes('LOCATION:DMCC\\, Tower 2'), 'the place');

/* calendar: reading */
const now = Date.parse('2026-11-10T00:00:00Z');
const ext = ['BEGIN:VCALENDAR', 'X-WR-TIMEZONE:Europe/Paris',
  'BEGIN:VEVENT', 'UID:u1', 'DTSTART;TZID=Europe/Paris:20261112T100000', 'DTEND;TZID=Europe/Paris:20261112T113000', 'SUMMARY:Dentiste', 'BEGIN:VALARM', 'TRIGGER:-PT15M', 'END:VALARM', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:u2', 'DTSTART:20261113T080000Z', 'DURATION:PT2H', 'SUMMARY:Libre', 'TRANSP:TRANSPARENT', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:u3', 'DTSTART;VALUE=DATE:20261120', 'DTEND;VALUE=DATE:20261122', 'SUMMARY:Vacances', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:u4', 'DTSTART;TZID=Europe/Paris:20261102T090000', 'DTEND;TZID=Europe/Paris:20261102T093000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6',
  'EXDATE;TZID=Europe/Paris:20261111T090000', 'SUMMARY:Point équipe', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:u4', 'RECURRENCE-ID;TZID=Europe/Paris:20261116T090000', 'DTSTART;TZID=Europe/Paris:20261116T150000', 'DTEND;TZID=Europe/Paris:20261116T153000', 'SUMMARY:Point équipe (déplacé)', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:u5', 'DTSTART:20261114T080000Z', 'DTEND:20261114T090000Z', 'STATUS:CANCELLED', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:u6', 'DTSTART:20261001T080000Z', 'DTEND:20261001T090000Z', 'SUMMARY:Passé', 'END:VEVENT',
  'END:VCALENDAR'].join('\r\n');
const busy = cal.busyTimes(ext, 'Asia/Dubai', now);
const by = s => busy.filter(b => b.summary === s);
ok(by('Dentiste')[0]?.start === '2026-11-12T09:00:00.000Z' && by('Dentiste')[0]?.end === '2026-11-12T10:30:00.000Z', 'a zoned time converted to UTC (Paris, winter)');
ok(by('Libre').length === 0 && busy.every(b => b.summary !== null || true), 'a transparent event does not block');
ok(by('Vacances')[0]?.start === '2026-11-19T23:00:00.000Z' && by('Vacances')[0]?.end === '2026-11-21T23:00:00.000Z', 'all-day days in the calendar\'s zone');
// series: Mon 2, Wed 4, Mon 9, Wed 11 (excluded), Mon 16 (moved), Wed 18 → after now: 11 excluded, 16 moved, 18 kept
const team = by('Point équipe').map(b => b.start);
ok(JSON.stringify(team) === JSON.stringify(['2026-11-18T08:00:00.000Z']), 'a weekly series honours COUNT, EXDATE and a moved occurrence');
ok(by('Point équipe (déplacé)')[0]?.start === '2026-11-16T14:00:00.000Z', 'the moved occurrence at its new time');
ok(!busy.some(b => b.summary === null && b.start.startsWith('2026-11-14')), 'a cancelled event does not block');
ok(by('Passé').length === 0, 'a past event is left out');
const daily = cal.occurrences({ t: Date.parse('2026-03-28T08:00:00Z'), allDay: false, wall: [2026, 3, 28, 9, 0, 0], tz: 'Europe/Paris' }, 'FREQ=DAILY;UNTIL=20260330T235959Z', 0, Infinity, 'Europe/Paris');
ok(JSON.stringify(daily.map(t => new Date(t).toISOString())) === JSON.stringify(['2026-03-28T08:00:00.000Z', '2026-03-29T07:00:00.000Z', '2026-03-30T07:00:00.000Z']), 'a daily series keeps 09:00 Paris across the clock change');
ok(cal.durationMs('P1DT2H30M') === (26 * 60 + 30) * 60000, 'durations');

/* calendar: the handler */
globalThis.fetch = async (url, init) => {
  if (url.endsWith('/rpc/solo_calendar_feed')) { const b = JSON.parse(init.body); return new Response(b.p_token === 'a'.repeat(48) ? JSON.stringify(feed) : 'null'); }
  if (url.endsWith('/rpc/solo_calendar_due')) return new Response(JSON.stringify([{ id: 'k1', url: 'https://cal.ex.com/ok.ics', timezone: 'Asia/Dubai' }, { id: 'k2', url: 'https://cal.ex.com/page', timezone: 'Asia/Dubai' }]));
  if (url.endsWith('/rpc/solo_calendar_store')) { calls.push(JSON.parse(init.body)); return new Response('1'); }
  if (url === 'https://cal.ex.com/ok.ics') return new Response(ext);
  if (url === 'https://cal.ex.com/page') return new Response('<html>login</html>');
  throw new Error('unexpected ' + url);
};
const good = await calHandler(new Request('https://fn/solo-calendar?t=' + 'a'.repeat(48)));
ok(good.status === 200 && good.headers.get('content-type').startsWith('text/calendar') && (await good.text()).includes('UID:b1@oolala.ae'), 'a valid token gets the feed');
ok((await calHandler(new Request('https://fn/solo-calendar?t=' + 'b'.repeat(48)))).status === 404, 'an unknown token gets nothing');
ok((await calHandler(new Request('https://fn/solo-calendar?t=../x'))).status === 404, 'a malformed token never reaches the database');
calls.length = 0;
const sync = await (await calHandler(new Request('https://fn/solo-calendar', { method: 'POST' }))).json();
ok(sync.synced === 1 && sync.failed === 1, 'one calendar synced, a web page refused');
ok(calls.find(c => c.p_id === 'k1').p_events.length > 0 && calls.find(c => c.p_id === 'k2').p_error === 'not an iCal calendar', 'busy times stored, the failure explained');

console.log(`SOLO_NEWS_CALENDAR ok=${n}`);
