import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, Flag, Link2, X } from 'lucide-react';
import { adminRpc, errorLabel, shortDateTime, type Contact, type NewsFeed, type NewsItem, type Staff } from '@/lib/solo-admin';

// The news beside the Today band, as in Sillon: France and UAE apart, each
// headline something to act on (to do, done, dismissed, sent to a client).
type Region = 'fr' | 'ae';
type View = 'inbox' | 'todo' | 'done' | 'dismissed';
const REGIONS: [Region, string][] = [['ae', 'Émirats'], ['fr', 'France']];
const VIEWS: [View, string][] = [['inbox', 'À lire'], ['todo', 'À traiter'], ['done', 'Faits'], ['dismissed', 'Ignorés']];

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `il y a ${Math.max(1, min)} min`;
  if (min < 48 * 60) return `il y a ${Math.round(min / 60)} h`;
  return `il y a ${Math.round(min / 1440)} j`;
}

function LinkClient({ item, onDone }: { item: NewsItem; onDone: () => void }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<Contact[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (q.trim().length < 2) { setList([]); return; }
    const t = setTimeout(() => adminRpc<Contact[]>('solo_admin_contacts', { p_search: q, p_status: null }).then(l => setList(l.slice(0, 6))).catch(() => setList([])), 250);
    return () => clearTimeout(t);
  }, [q]);
  async function link(c: Contact) {
    try { await adminRpc('solo_admin_news_set', { p_id: item.id, p_status: 'todo', p_note: note || null, p_contact: c.id }); onDone(); }
    catch (e) { setError(errorLabel((e as Error).message)); }
  }
  return <div className="news-link">
    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Client concerné…" aria-label="Chercher un client" autoFocus />
    <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ce qu’il faut lui dire (facultatif)" aria-label="Note" />
    {list.length > 0 && <div className="news-link-list">{list.map(c => <button key={c.id} type="button" onClick={() => link(c)}>{c.name ?? c.email}{c.company ? ` · ${c.company}` : ''}</button>)}</div>}
    {error && <p className="booking-error">{error}</p>}
  </div>;
}

export function NewsPanel({ staff }: { staff: Staff }) {
  const [region, setRegion] = useState<Region>(() => { try { return (localStorage.getItem('oolala-news-region') as Region) || 'ae'; } catch { return 'ae'; } });
  const [view, setView] = useState<View>('inbox');
  const [feed, setFeed] = useState<NewsFeed | null>(null);
  const [error, setError] = useState('');
  const [linking, setLinking] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => {
    setError('');
    adminRpc<NewsFeed>('solo_admin_news', { p_region: region, p_view: view, p_limit: 40 }).then(setFeed).catch(e => setError(errorLabel(e.message)));
  }, [region, view]);
  useEffect(() => { setFeed(null); load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 10 * 60_000); return () => clearInterval(t); }, [load]);
  const pick = (r: Region) => { setRegion(r); try { localStorage.setItem('oolala-news-region', r); } catch { /* this browser only */ } };
  async function set(item: NewsItem, status: NewsItem['status']) {
    setFeed(f => f && { ...f, items: view === 'inbox' && (status === 'done' || status === 'dismissed') ? f.items.filter(i => i.id !== item.id) : f.items.map(i => i.id === item.id ? { ...i, status } : i) });
    try { await adminRpc('solo_admin_news_set', { p_id: item.id, p_status: status }); load(); } catch (e) { setError(errorLabel((e as Error).message)); load(); }
  }

  return <section className="news-panel" aria-label="Actualités">
    <div className="news-head"><h2>Actualités</h2>
      <div className="news-regions" role="tablist">{REGIONS.map(([r, l]) => <button key={r} type="button" role="tab" aria-selected={region === r} onClick={() => pick(r)}>{l}</button>)}</div></div>
    <div className="news-views">{VIEWS.map(([v, l]) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{l}{v === 'todo' && feed?.counts.todo ? <b>{feed.counts.todo}</b> : null}</button>)}</div>
    {error && <p role="alert" className="booking-error">{error}</p>}
    {!feed ? <p className="booking-muted">Chargement…</p> : feed.items.length === 0 ? <p className="booking-muted news-empty">{
      feed.sources.total === 0 ? 'Aucune source pour cette zone. Ajoutez-en dans Réglages → Actualités.'
        : !feed.sources.last ? 'Les sources n’ont pas encore été lues. Les premiers articles arrivent dans la demi-heure.'
          : view === 'inbox' ? 'Rien de nouveau. Tout est lu.' : 'Rien ici.'}</p>
      : <ol className="news-list">{feed.items.map(item => <li key={item.id} className={`news-item is-${item.status}`}>
        <div className="news-meta"><span>{item.source.replace(/^Google (News|Actualités) · /, '')}</span><span>{ago(item.published_at)}</span>{item.status === 'todo' && <span className="news-flag">À traiter</span>}</div>
        <button type="button" className="news-title" onClick={() => setOpen(o => o === item.id ? null : item.id)} aria-expanded={open === item.id}>{item.title}</button>
        {item.topics.length > 0 && <div className="news-topics">{item.topics.map(t => <span key={t}>{t}</span>)}</div>}
        {open === item.id && item.summary && <p className="news-summary">{item.summary}</p>}
        {(item.contact_name || item.note) && <p className="news-note">{item.contact_name && <>Pour <strong>{item.contact_name}</strong>{item.note ? ' · ' : ''}</>}{item.note}</p>}
        <div className="news-actions">
          {item.link && <a href={item.link} target="_blank" rel="noreferrer noopener"><ExternalLink size={14} /> Lire</a>}
          {item.status !== 'todo' && <button type="button" onClick={() => set(item, 'todo')}><Flag size={14} /> À traiter</button>}
          {item.status !== 'done' && <button type="button" onClick={() => set(item, 'done')}><Check size={14} /> Fait</button>}
          <button type="button" onClick={() => setLinking(l => l === item.id ? null : item.id)} aria-expanded={linking === item.id}><Link2 size={14} /> Client</button>
          {item.status !== 'dismissed' && <button type="button" onClick={() => set(item, 'dismissed')} aria-label="Ignorer"><X size={14} /></button>}
        </div>
        {linking === item.id && <LinkClient item={item} onDone={() => { setLinking(null); load(); }} />}
        {item.acted_by && item.status !== 'new' && <small className="news-by">{item.status === 'done' ? 'Fait' : item.status === 'dismissed' ? 'Ignoré' : 'Marqué'} par {item.acted_by === staff.email ? 'vous' : item.acted_by} · {shortDateTime(item.acted_at!, staff.timezone)}</small>}
      </li>)}</ol>}
    {feed && feed.sources.failing > 0 && <p className="news-foot">{feed.sources.failing} source{feed.sources.failing > 1 ? 's' : ''} ne répond{feed.sources.failing > 1 ? 'ent' : ''} pas : voir Réglages → Actualités.</p>}
  </section>;
}
