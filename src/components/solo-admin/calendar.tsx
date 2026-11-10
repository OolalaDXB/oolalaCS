import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  addDays, adminRpc, errorLabel, localDate, localTime, longDay, statusLabel, zonedToIso,
  type Booking, type BusyTime, type Exception, type Staff,
} from '@/lib/solo-admin';
import { BookingCard, type EditorSeed } from './booking-editor';
import { BlockForm } from './block-form';

// The calendar: one day by default (what Darya opens on her phone), then the
// week, the month, or a plain list. Bookings, blocks and the busy times read
// from her other calendars, all in the business time zone.
type View = 'day' | 'week' | 'month' | 'list';
const VIEWS: [View, string][] = [['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois'], ['list', 'Liste']];
const HOUR = 52; // px per hour in the day and week grids
const VIEW_KEY = 'oolala-calendar-view';

type Entry = { key: string; kind: 'booking' | 'block' | 'busy' | 'open'; start: string; end: string; title: string; sub?: string | undefined; booking?: Booking | undefined; status?: string | undefined };

const minutesIn = (iso: string, tz: string) => { const [h = 0, m = 0] = localTime(iso, tz).split(':').map(Number); return h * 60 + m; };
const mondayOf = (d: string) => { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); return addDays(d, -((w + 6) % 7)); };
const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...o }).format(new Date(`${d}T12:00:00Z`));
// the days an entry touches, in the business zone
const touches = (e: { start: string; end: string }, day: string, tz: string) => localDate(e.start, tz) <= day && localDate(new Date(new Date(e.end).getTime() - 1), tz) >= day;

// side-by-side columns for entries that overlap: each cluster of overlapping
// entries is split into as many lanes as it needs
function lanes(list: Entry[]) {
  const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  const out = new Map<string, [number, number]>();
  let cluster: string[] = [], laneEnds: string[] = [], clusterEnd = '';
  const close = () => { for (const k of cluster) out.set(k, [out.get(k)![0], laneEnds.length]); cluster = []; laneEnds = []; clusterEnd = ''; };
  for (const e of sorted) {
    if (cluster.length && e.start >= clusterEnd) close();
    let lane = laneEnds.findIndex(x => x <= e.start);
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(e.end); } else laneEnds[lane] = e.end;
    out.set(e.key, [lane, 1]); cluster.push(e.key); if (e.end > clusterEnd) clusterEnd = e.end;
  }
  if (cluster.length) close();
  return out;
}

function DayColumn({ day, entries, tz, from, to, onSlot, onOpen, today }: { day: string; entries: Entry[]; tz: string; from: number; to: number; onSlot: (time: string) => void; onOpen: (e: Entry) => void; today: string }) {
  const list = entries.filter(e => touches(e, day, tz));
  const pos = lanes(list);
  const nowMin = day === today ? minutesIn(new Date().toISOString(), tz) : null;
  return <div className="cal-col" style={{ height: (to - from) * HOUR }}>
    {Array.from({ length: to - from }, (_, i) => <button key={i} type="button" className="cal-slot" style={{ top: i * HOUR, height: HOUR }} aria-label={`Ajouter le ${longDay(day)} à ${from + i} h`} onClick={() => onSlot(`${String(from + i).padStart(2, '0')}:00`)} />)}
    {list.map(e => {
      const s = localDate(e.start, tz) < day ? 0 : minutesIn(e.start, tz);
      const en = localDate(new Date(new Date(e.end).getTime() - 1), tz) > day ? 24 * 60 : minutesIn(e.end, tz) || 24 * 60;
      const top = Math.max(0, (s / 60 - from) * HOUR), bottom = Math.min((to - from) * HOUR, (en / 60 - from) * HOUR);
      if (bottom <= 0 || top >= (to - from) * HOUR) return null;
      const [lane, n] = pos.get(e.key) ?? [0, 1];
      return <button key={e.key} type="button" className={`cal-ev is-${e.kind}${e.status ? ` st-${e.status}` : ''}`} disabled={e.kind !== 'booking'}
        style={{ top, height: Math.max(20, bottom - top - 2), left: `calc(${(lane / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)` }} onClick={() => onOpen(e)}>
        <strong>{e.kind === 'booking' ? localTime(e.start, tz) + ' ' : ''}{e.title}</strong>{e.sub && <span>{e.sub}</span>}
      </button>;
    })}
    {nowMin != null && nowMin / 60 >= from && nowMin / 60 <= to && <div className="cal-now" style={{ top: (nowMin / 60 - from) * HOUR }} />}
  </div>;
}

export function Calendar({ staff, refresh, onEdit, onChanged }: { staff: Staff; refresh: number; onEdit: (seed: EditorSeed) => void; onChanged: () => void }) {
  const tz = staff.timezone;
  const today = localDate(new Date(), tz);
  const [view, setView] = useState<View>(() => { try { const v = localStorage.getItem(VIEW_KEY) as View; return VIEWS.some(([k]) => k === v) ? v : 'day'; } catch { return 'day'; } });
  const [anchor, setAnchor] = useState(today);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [blocks, setBlocks] = useState<Exception[]>([]);
  const [busy, setBusy] = useState<BusyTime[]>([]);
  const [showCancelled, setShowCancelled] = useState(false);
  const [adding, setAdding] = useState(false);
  const [blocking, setBlocking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const menu = useRef<HTMLDivElement>(null);

  const range = useMemo((): [string, string] => {
    if (view === 'day') return [anchor, addDays(anchor, 1)];
    if (view === 'week') { const m = mondayOf(anchor); return [m, addDays(m, 7)]; }
    if (view === 'month') { const m = mondayOf(monthStart(anchor)); return [m, addDays(m, 42)]; }
    return [anchor, addDays(anchor, 60)];
  }, [view, anchor]);
  const load = useCallback(() => {
    const from = zonedToIso(range[0], '00:00', tz), to = zonedToIso(range[1], '00:00', tz);
    Promise.all([adminRpc<Booking[]>('solo_admin_bookings', { p_from: from, p_to: to }), adminRpc<Exception[]>('solo_admin_exceptions', { p_from: from, p_to: to })])
      .then(([b, e]) => { setBookings(b); setBlocks(e); setError(''); }).catch(e => setError(errorLabel(e.message)));
    adminRpc<BusyTime[]>('solo_admin_busy', { p_from: from, p_to: to }).then(setBusy).catch(() => setBusy([]));
  }, [range, tz]);
  useEffect(load, [load, refresh]);
  useEffect(() => {
    if (!adding) return;
    const close = (e: MouseEvent) => { if (menu.current && !menu.current.contains(e.target as Node)) setAdding(false); };
    document.addEventListener('click', close); return () => document.removeEventListener('click', close);
  }, [adding]);

  const pick = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* this browser only */ } };
  const step = (dir: number) => setAnchor(a => view === 'day' ? addDays(a, dir) : view === 'week' ? addDays(a, 7 * dir) : view === 'month'
    ? (() => { const d = new Date(`${monthStart(a)}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + dir); return d.toISOString().slice(0, 10); })() : addDays(a, 30 * dir));
  const label = view === 'day' ? longDay(anchor) : view === 'week' ? `${fmt(range[0], { day: 'numeric', month: 'short' })} – ${fmt(addDays(range[1], -1), { day: 'numeric', month: 'short', year: 'numeric' })}`
    : view === 'month' ? fmt(anchor, { month: 'long', year: 'numeric' }) : `À partir du ${fmt(anchor, { day: 'numeric', month: 'long' })}`;

  const entries: Entry[] = useMemo(() => [
    ...(bookings ?? []).filter(b => showCancelled || b.status !== 'cancelled').map(b => ({ key: b.id, kind: 'booking' as const, start: b.starts_at, end: b.ends_at, title: b.name,
      sub: [b.title, b.location_name].filter(Boolean).join(' · '), booking: b, status: b.status })),
    ...blocks.map(e => ({ key: e.id, kind: e.kind === 'open' ? 'open' as const : 'block' as const, start: e.starts_at, end: e.ends_at,
      title: e.kind === 'open' ? 'Ouvert en plus' : e.reason === 'day_off' ? 'Journée bloquée' : 'Bloqué', sub: e.reason && e.reason !== 'day_off' ? e.reason : undefined })),
    ...busy.map(x => ({ key: `${x.calendar}${x.starts_at}`, kind: 'busy' as const, start: x.starts_at, end: x.ends_at, title: x.summary ?? 'Occupé', sub: x.calendar })),
  ], [bookings, blocks, busy, showCancelled]);

  // hours shown: 08–20, widened to whatever the visible entries need
  const [from, to] = useMemo(() => {
    let a = 8, b = 20;
    for (const e of entries) { if (e.kind === 'block' && e.title === 'Journée bloquée') continue; const s = minutesIn(e.start, tz) / 60, en = minutesIn(e.end, tz) / 60;
      if (localDate(e.start, tz) === localDate(e.end, tz)) { a = Math.min(a, Math.floor(s)); b = Math.max(b, Math.ceil(en)); } }
    return [Math.max(0, a), Math.min(24, b)];
  }, [entries, tz]);

  const open = (e: Entry) => { if (e.booking) onEdit({ booking: e.booking }); };
  const dayOff = (day: string) => blocks.some(e => e.reason === 'day_off' && touches({ start: e.starts_at, end: e.ends_at }, day, tz));
  async function toggleDay(day: string) { try { await adminRpc('solo_admin_day_toggle', { p_day: day }); load(); } catch (e) { setError(errorLabel((e as Error).message)); } }
  const hours = Array.from({ length: to - from }, (_, i) => from + i);

  return <div className="cal">
    <div className="cal-bar">
      <div className="cal-nav"><Button variant="ghost" size="icon" aria-label="Précédent" onClick={() => step(-1)}><ChevronLeft /></Button>
        <Button variant="ghost" size="sm" onClick={() => setAnchor(today)} disabled={anchor === today && view !== 'month'}>Aujourd’hui</Button>
        <Button variant="ghost" size="icon" aria-label="Suivant" onClick={() => step(1)}><ChevronRight /></Button>
        <h2 className="cal-label">{label}{view === 'day' && anchor === today ? ' · aujourd’hui' : ''}</h2></div>
      <div className="cal-tools">
        <label className="cal-select"><span className="sr-only">Vue</span><select value={view} onChange={e => pick(e.target.value as View)}>{VIEWS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></label>
        <div className="cal-add" ref={menu}><Button size="sm" onClick={() => setAdding(a => !a)} aria-expanded={adding} aria-haspopup="menu"><Plus /> Ajouter</Button>
          {adding && <div className="cal-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setAdding(false); onEdit({ date: view === 'day' ? anchor : today }); }}>Rendez-vous<small>client, partenaire, visite de bien…</small></button>
            <button type="button" role="menuitem" onClick={() => { setAdding(false); setBlocking(view === 'day' ? anchor : today); }}>Moment bloqué<small>indisponible, déplacement, perso</small></button>
            <button type="button" role="menuitem" onClick={() => { setAdding(false); toggleDay(view === 'day' ? anchor : today); }}>{dayOff(view === 'day' ? anchor : today) ? 'Rouvrir la journée' : 'Bloquer toute la journée'}<small>{longDay(view === 'day' ? anchor : today)}</small></button>
          </div>}</div>
      </div>
    </div>
    <label className="admin-check cal-cancelled"><input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} /> Afficher les annulations</label>
    {error && <p role="alert" className="booking-error">{error}</p>}
    {blocking && <div className="admin-overlay" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setBlocking(null)}>
      <div className="admin-sheet"><BlockForm staff={staff} date={blocking} title="Bloquer un moment" onDone={() => { setBlocking(null); load(); }} />
        <Button variant="ghost" onClick={() => setBlocking(null)}>Annuler</Button></div></div>}

    {!bookings ? <p className="booking-muted">Chargement…</p> : <>
      {view === 'day' && <>
        {dayOff(anchor) && <p className="admin-block">Journée bloquée : aucune réservation possible en ligne. <button type="button" className="today-link" onClick={() => toggleDay(anchor)}>Rouvrir</button></p>}
        <div className="cal-grid is-day"><div className="cal-hours">{hours.map(h => <span key={h} style={{ height: HOUR }}>{String(h).padStart(2, '0')}:00</span>)}</div>
          <DayColumn day={anchor} entries={entries} tz={tz} from={from} to={to} today={today} onOpen={open} onSlot={time => onEdit({ date: anchor, time })} /></div>
        {(() => { const list = entries.filter(e => e.booking && touches(e, anchor, tz)); return list.length > 0 && <section className="admin-section"><h2>Rendez-vous du jour</h2>
          <div className="admin-list">{list.map(e => <BookingCard key={e.key} booking={e.booking!} timeZone={tz} onEdit={() => open(e)} onChanged={() => { onChanged(); load(); }} />)}</div></section>; })()}
      </>}

      {view === 'week' && <div className="cal-scroll"><div className="cal-week">
        <div className="cal-week-head"><span />{Array.from({ length: 7 }, (_, i) => addDays(range[0], i)).map(d =>
          <button key={d} type="button" className={`${d === today ? 'is-today' : ''}${dayOff(d) ? ' is-off' : ''}`} onClick={() => { setAnchor(d); pick('day'); }}><small>{fmt(d, { weekday: 'short' })}</small><strong>{fmt(d, { day: 'numeric' })}</strong></button>)}</div>
        <div className="cal-grid"><div className="cal-hours">{hours.map(h => <span key={h} style={{ height: HOUR }}>{String(h).padStart(2, '0')}:00</span>)}</div>
          {Array.from({ length: 7 }, (_, i) => addDays(range[0], i)).map(d => <DayColumn key={d} day={d} entries={entries} tz={tz} from={from} to={to} today={today} onOpen={open} onSlot={time => onEdit({ date: d, time })} />)}</div>
      </div></div>}

      {view === 'month' && <div className="cal-month">
        {['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'].map(d => <span key={d} className="cal-month-dow">{d}</span>)}
        {Array.from({ length: 42 }, (_, i) => addDays(range[0], i)).map(d => {
          const list = entries.filter(e => e.kind !== 'block' && touches(e, d, tz)).sort((a, b) => a.start.localeCompare(b.start));
          return <button key={d} type="button" className={`cal-month-day${d.slice(0, 7) !== anchor.slice(0, 7) ? ' is-other' : ''}${d === today ? ' is-today' : ''}${dayOff(d) ? ' is-off' : ''}`} onClick={() => { setAnchor(d); pick('day'); }}>
            <strong>{Number(d.slice(8))}</strong>
            {list.slice(0, 3).map(e => <span key={e.key} className={`cal-chip is-${e.kind}`}>{e.kind === 'booking' ? `${localTime(e.start, tz)} ` : ''}{e.title}</span>)}
            {list.length > 3 && <small>+{list.length - 3}</small>}
          </button>;
        })}
      </div>}

      {view === 'list' && (() => {
        const days = Array.from({ length: 60 }, (_, i) => addDays(anchor, i)).filter(d => entries.some(e => touches(e, d, tz)));
        return days.length === 0 ? <p className="booking-muted">Rien de prévu sur les 60 prochains jours.</p> : days.map(d => <section key={d} className="admin-day">
          <div className="admin-day-head"><h2>{longDay(d)}{d === today ? ' · aujourd’hui' : ''}</h2></div>
          {entries.filter(e => !e.booking && touches(e, d, tz)).map(e => <p key={e.key} className={`admin-block${e.kind === 'busy' ? ' is-external' : ''}`}>{e.title} · {localTime(e.start, tz)}–{localTime(e.end, tz)}{e.sub ? ` · ${e.sub}` : ''}</p>)}
          <div className="admin-list">{entries.filter(e => e.booking && localDate(e.start, tz) === d).map(e => <BookingCard key={e.key} booking={e.booking!} timeZone={tz} onEdit={() => open(e)} onChanged={() => { onChanged(); load(); }} />)}</div>
        </section>);
      })()}
    </>}
    {view !== 'list' && <p className="cal-legend"><span className="is-booking" />rendez-vous <span className="is-block" />bloqué <span className="is-busy" />autres agendas · {statusLabel.pending.toLowerCase()} en pointillés</p>}
  </div>;
}
