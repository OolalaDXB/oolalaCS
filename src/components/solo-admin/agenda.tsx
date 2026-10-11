import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  addDays, adminRpc, errorLabel, localDate, localTime, longDay, zonedToIso,
  type Booking, type Exception, type Hours, type Staff,
} from '@/lib/solo-admin';
import { BookingCard, type EditorSeed } from './booking-editor';

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const dayName = (d: number) => WEEKDAYS[d] ?? '';
const ORDER = [1, 2, 3, 4, 5, 6, 0];

type View = 'diary' | 'days' | 'hours' | 'blocks';

export function Agenda({ staff, refresh, onEdit, onChanged }: { staff: Staff; refresh: number; onEdit: (seed: EditorSeed) => void; onChanged: () => void }) {
  const [view, setView] = useState<View>('diary');
  return <>
    <div className="admin-subtabs" role="tablist">{([['diary', 'Rendez-vous'], ['days', 'Jours bloqués'], ['hours', 'Horaires'], ['blocks', 'Blocages']] as [View, string][]).map(([k, label]) =>
      <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}>{label}</button>)}</div>
    {view === 'diary' && <Diary staff={staff} refresh={refresh} onEdit={onEdit} onChanged={onChanged} />}
    {view === 'days' && <DaysOff staff={staff} />}
    {view === 'hours' && <WeeklyHours />}
    {view === 'blocks' && <Blocks staff={staff} />}
  </>;
}

function Diary({ staff, refresh, onEdit, onChanged }: { staff: Staff; refresh: number; onEdit: (seed: EditorSeed) => void; onChanged: () => void }) {
  const tz = staff.timezone;
  const today = localDate(new Date(), tz);
  const [start, setStart] = useState(today);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [blocks, setBlocks] = useState<Exception[]>([]);
  const [showCancelled, setShowCancelled] = useState(false);
  const [error, setError] = useState('');
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const load = useCallback(() => {
    const from = zonedToIso(start, '00:00', tz); const to = zonedToIso(addDays(start, 7), '00:00', tz);
    Promise.all([adminRpc<Booking[]>('solo_admin_bookings', { p_from: from, p_to: to }), adminRpc<Exception[]>('solo_admin_exceptions', { p_from: from, p_to: to })])
      .then(([b, e]) => { setBookings(b); setBlocks(e); }).catch(e => setError(errorLabel(e.message)));
  }, [start, tz]);
  useEffect(load, [load, refresh]);

  async function toggle(day: string) {
    try { await adminRpc('solo_admin_day_toggle', { p_day: day }); load(); } catch (e) { setError(errorLabel((e as Error).message)); }
  }

  return <>
    <div className="admin-range">
      <Button variant="ghost" size="sm" onClick={() => setStart(addDays(start, -7))}><ChevronLeft /> Semaine précédente</Button>
      {start !== today && <Button variant="ghost" size="sm" onClick={() => setStart(today)}>Aujourd’hui</Button>}
      <Button variant="ghost" size="sm" onClick={() => setStart(addDays(start, 7))}>Semaine suivante <ChevronRight /></Button>
    </div>
    <label className="admin-check"><input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} /> Afficher les annulations</label>
    {error && <p role="alert" className="booking-error">{error}</p>}
    {!bookings ? <p className="booking-muted">Chargement…</p> : days.map(day => {
      const list = bookings.filter(b => localDate(b.starts_at, tz) === day && (showCancelled || b.status !== 'cancelled'));
      const dayBlocks = blocks.filter(e => e.kind === 'closed' && localDate(e.starts_at, tz) <= day && localDate(new Date(new Date(e.ends_at).getTime() - 1), tz) >= day);
      const off = dayBlocks.some(e => e.reason === 'day_off');
      return <section key={day} className={`admin-day${off ? ' is-off' : ''}`}>
        <div className="admin-day-head"><h2>{longDay(day)}{day === today ? ' · aujourd’hui' : ''}</h2>
          <div className="admin-actions"><Button size="sm" variant="ghost" onClick={() => toggle(day)}>{off ? 'Rouvrir la journée' : 'Bloquer la journée'}</Button><Button size="sm" variant="ghost" aria-label={`Ajouter un rendez-vous le ${longDay(day)}`} onClick={() => onEdit({ date: day })}><Plus /></Button></div></div>
        {dayBlocks.filter(e => e.reason !== 'day_off').map(e => <p key={e.id} className="admin-block">Bloqué {localTime(e.starts_at, tz)}–{localTime(e.ends_at, tz)}{e.reason ? ` · ${e.reason}` : ''}</p>)}
        {off && <p className="admin-block">Journée bloquée : aucune réservation possible en ligne.</p>}
        {list.length === 0 ? <p className="booking-muted">Aucun rendez-vous.</p> : <div className="admin-list">{list.map(b => <BookingCard key={b.id} booking={b} timeZone={tz} onEdit={() => onEdit({ booking: b })} onChanged={() => { onChanged(); load(); }} />)}</div>}
      </section>;
    })}
  </>;
}

function DaysOff({ staff }: { staff: Staff }) {
  const tz = staff.timezone;
  const today = localDate(new Date(), tz);
  const monday = useMemo(() => { const d = new Date(`${today}T12:00:00Z`); return addDays(today, -((d.getUTCDay() + 6) % 7)); }, [today]);
  const days = useMemo(() => Array.from({ length: 56 }, (_, i) => addDays(monday, i)), [monday]);
  const [off, setOff] = useState<Set<string> | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    adminRpc<Exception[]>('solo_admin_exceptions', { p_from: zonedToIso(monday, '00:00', tz), p_to: zonedToIso(addDays(monday, 56), '00:00', tz) })
      .then(list => setOff(new Set(list.filter(e => e.reason === 'day_off').map(e => localDate(e.starts_at, tz))))).catch(e => setError(errorLabel(e.message)));
  }, [monday, tz]);
  useEffect(load, [load]);
  async function toggle(day: string) {
    setOff(prev => { const next = new Set(prev); if (next.has(day)) next.delete(day); else next.add(day); return next; });
    try { await adminRpc('solo_admin_day_toggle', { p_day: day }); } catch (e) { setError(errorLabel((e as Error).message)); load(); }
  }
  return <>
    <p className="booking-muted">Un appui bloque toute la journée pour les réservations en ligne, un second la rouvre. Les rendez-vous déjà pris restent en place.</p>
    {error && <p role="alert" className="booking-error">{error}</p>}
    <div className="admin-calendar" role="grid" aria-label="Huit prochaines semaines">
      {ORDER.map(d => <span key={d} className="admin-calendar-head">{dayName(d).slice(0, 3)}</span>)}
      {days.map(day => <button key={day} type="button" className="admin-calendar-day" aria-pressed={off?.has(day) ?? false} disabled={day < today || !off} onClick={() => toggle(day)} title={longDay(day)}>
        <strong>{Number(day.slice(8))}</strong>{day.slice(8) === '01' || day === monday ? <small>{new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))}</small> : null}
      </button>)}
    </div>
  </>;
}

function WeeklyHours() {
  const [hours, setHours] = useState<Hours | null>(null);
  const [rows, setRows] = useState<{ weekday: number; start: string; end: string }[]>([]);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | string>('idle');
  useEffect(() => { adminRpc<Hours>('solo_admin_hours').then(h => { setHours(h); setRows(h.rules); }).catch(e => setState(errorLabel(e.message))); }, []);
  const update = (i: number, key: 'start' | 'end', value: string) => setRows(r => r.map((row, j) => (j === i ? { ...row, [key]: value } : row)));
  async function save() {
    if (rows.some(r => r.end <= r.start)) { setState('Chaque plage doit finir après son début.'); return; }
    setState('saving');
    try { const h = await adminRpc<Hours>('solo_admin_hours_set', { p_rules: rows }); setRows(h.rules); setState('saved'); } catch (e) { setState(errorLabel((e as Error).message)); }
  }
  if (!hours) return <p className="booking-muted">{state === 'idle' ? 'Chargement…' : state}</p>;
  return <div className="admin-hours">
    <p className="booking-muted">Horaires proposés à la réservation en ligne, heure de {hours.settings.timezone.split('/').pop()?.replace('_', ' ')}. Plusieurs plages par jour sont possibles.</p>
    {ORDER.map(d => {
      const dayRows = rows.map((r, i) => ({ r, i })).filter(x => x.r.weekday === d);
      return <div key={d} className="admin-hours-day">
        <strong>{dayName(d)}</strong>
        <div>{dayRows.length === 0 ? <span className="booking-muted">Fermé</span> : dayRows.map(({ r, i }) => <div key={i} className="admin-hours-row">
          <input type="time" step={900} value={r.start} aria-label={`${dayName(d)} début`} onChange={e => update(i, 'start', e.target.value)} />
          <span>–</span>
          <input type="time" step={900} value={r.end} aria-label={`${dayName(d)} fin`} onChange={e => update(i, 'end', e.target.value)} />
          <Button variant="ghost" size="icon" aria-label="Retirer la plage" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}><Trash2 /></Button>
        </div>)}</div>
        <Button variant="ghost" size="sm" onClick={() => setRows(rs => [...rs, { weekday: d, start: dayRows.at(-1)?.r.end ?? '09:00', end: '18:00' }])}><Plus /> Plage</Button>
      </div>;
    })}
    <div className="form-actions"><Button onClick={save} disabled={state === 'saving'}>{state === 'saving' ? 'Enregistrement…' : 'Enregistrer les horaires'}</Button>{state === 'saved' && <span className="booking-muted">Horaires enregistrés.</span>}</div>
    {!['idle', 'saving', 'saved'].includes(state) && <p role="alert" className="booking-error">{state}</p>}
  </div>;
}

function Blocks({ staff }: { staff: Staff }) {
  const tz = staff.timezone;
  const today = localDate(new Date(), tz);
  const [list, setList] = useState<Exception[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    adminRpc<Exception[]>('solo_admin_exceptions', { p_from: new Date().toISOString(), p_to: new Date(Date.now() + 365 * 86400000).toISOString() })
      .then(l => setList(l.filter(e => e.reason !== 'day_off'))).catch(e => setError(errorLabel(e.message)));
  }, []);
  useEffect(load, [load]);
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget); const get = (k: string) => String(f.get(k) ?? '');
    const starts = zonedToIso(get('date'), get('start'), tz); const ends = zonedToIso(get('end_date') || get('date'), get('end'), tz);
    if (ends <= starts) { setError('La fin doit être après le début.'); return; }
    setError('');
    try { await adminRpc('solo_admin_exception_add', { p_kind: get('kind'), p_starts: starts, p_ends: ends, p_reason: get('reason') }); event.currentTarget.reset(); load(); }
    catch (e) { setError(errorLabel((e as Error).message)); }
  }
  async function remove(id: string) { try { await adminRpc('solo_admin_exception_delete', { p_id: id }); load(); } catch (e) { setError(errorLabel((e as Error).message)); } }
  return <>
    <form className="contact-form admin-panel" onSubmit={add}>
      <h2>Ajouter un blocage ou une ouverture</h2>
      <div className="form-two"><div className="field"><label htmlFor="x-kind">Type</label><select id="x-kind" name="kind"><option value="closed">Bloquer (indisponible)</option><option value="open">Ouvrir (créneaux en plus)</option></select></div>
        <div className="field"><label htmlFor="x-reason">Motif</label><input id="x-reason" name="reason" placeholder="Déplacement, rendez-vous perso…" maxLength={200} /></div></div>
      <div className="form-three"><div className="field"><label htmlFor="x-date">Du</label><input id="x-date" name="date" type="date" required min={today} defaultValue={today} /></div>
        <div className="field"><label htmlFor="x-start">De</label><input id="x-start" name="start" type="time" step={900} required defaultValue="12:00" /></div>
        <div className="field"><label htmlFor="x-end">À</label><input id="x-end" name="end" type="time" step={900} required defaultValue="14:00" /></div></div>
      <div className="field"><label htmlFor="x-end-date">Jusqu’au (si plusieurs jours)</label><input id="x-end-date" name="end_date" type="date" min={today} /></div>
      <Button type="submit">Ajouter</Button>
    </form>
    {error && <p role="alert" className="booking-error">{error}</p>}
    <section className="admin-section"><h2>À venir</h2>
      {!list ? <p className="booking-muted">Chargement…</p> : list.length === 0 ? <p className="booking-muted">Aucun blocage prévu.</p> : <div className="admin-list">{list.map(e =>
        <div key={e.id} className="admin-row"><span className={`status-pill is-${e.kind === 'closed' ? 'blocked' : 'confirmed'}`}>{e.kind === 'closed' ? 'Bloqué' : 'Ouvert'}</span>
          <span>{longDay(localDate(e.starts_at, tz))} {localTime(e.starts_at, tz)} → {localDate(e.ends_at, tz) !== localDate(e.starts_at, tz) ? `${longDay(localDate(e.ends_at, tz))} ` : ''}{localTime(e.ends_at, tz)}{e.reason ? ` · ${e.reason}` : ''}</span>
          <Button variant="ghost" size="icon" aria-label="Supprimer" onClick={() => remove(e.id)}><Trash2 /></Button></div>)}</div>}
    </section>
  </>;
}
