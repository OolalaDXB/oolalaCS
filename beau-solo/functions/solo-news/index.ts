// BEAU Solo — fetches the news sources (RSS or Atom) that are due and stores
// their new items. Called every 30 minutes by pg_cron (anon key); each source
// is fetched at most every two hours. It takes no input.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export type Item = { guid: string; title: string; link: string | null; summary: string | null; published_at: string | null };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', hellip: '…', ndash: '–', mdash: '—' };
export function decode(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}
// the text of an element: CDATA unwrapped, tags removed, entities decoded, spaces folded
export function text(raw: string | undefined) {
  if (raw == null) return '';
  const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return decode(decode(unwrapped).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function tag(block: string, name: string) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : undefined;
}
function date(raw: string) {
  const t = Date.parse(text(raw));
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

// RSS 2.0 <item> and Atom <entry>, enough of both for official and press feeds
export function parseFeed(xml: string): Item[] {
  const out: Item[] = [];
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  for (const b of blocks.slice(0, 100)) {
    const title = text(tag(b, 'title')).slice(0, 400);
    let link = text(tag(b, 'link'));
    if (!link) link = (b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ?? b.match(/<link[^>]*href=["']([^"']+)["']/i))?.[1] ?? '';
    link = decode(link).trim();
    if (!/^https?:\/\//.test(link)) link = '';
    const guid = (text(tag(b, 'guid')) || text(tag(b, 'id')) || link || title).slice(0, 500);
    const summary = text(tag(b, 'description') ?? tag(b, 'summary') ?? tag(b, 'content')).slice(0, 1200) || null;
    const published = tag(b, 'pubDate') ?? tag(b, 'published') ?? tag(b, 'updated') ?? tag(b, 'dc:date');
    if (!title || !guid) continue;
    out.push({ guid, title, link: link || null, summary: summary && summary !== title ? summary : null, published_at: published ? date(published) : null });
  }
  return out;
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`${fn} ${res.status} ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

Deno.serve(async () => {
  const due: { id: string; url: string }[] = await rpc('solo_news_due', { p_limit: 12 });
  let stored = 0, failed = 0;
  await Promise.all(due.map(async s => {
    try {
      const res = await fetch(s.url, { headers: { 'User-Agent': 'BEAU Solo news reader (oolala.ae)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.text()).slice(0, 3_000_000);
      const items = parseFeed(body);
      if (!items.length && !/<(rss|feed|rdf)/i.test(body)) throw new Error('not a feed');
      stored += Number(await rpc('solo_news_ingest', { p_source: s.id, p_items: items })) || 0;
    } catch (e) {
      failed++;
      await rpc('solo_news_ingest', { p_source: s.id, p_items: [], p_error: String(e instanceof Error ? e.message : e).slice(0, 300) }).catch(() => {});
    }
  }));
  return Response.json({ sources: due.length, stored, failed });
});
