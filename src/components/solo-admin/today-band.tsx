import { useEffect, useState } from 'react';
import { airUrl, aqiBand, DEFAULT_PLACES, findPlaces, forecastUrl, greeting, KIND_LABEL, parseAir, parseForecast, readClock, readPlaces, writePlaces, type Found, type Kind, type Place, type Weather } from '@/lib/today';

// The same eight kinds as small drawings, read at a glance in a row of days.
const SUN = <><circle cx="12" cy="12" r="4.2" fill="#f5b301" /><g stroke="#f5b301" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></g></>;
const cloud = (fill: string) => <path d="M7.5 19h9.2a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.7 1.4A3.3 3.3 0 0 0 7.5 19z" fill={fill} />;
const drops = (c: string) => <g stroke={c} strokeWidth="1.8" strokeLinecap="round"><path d="M9 20.5l-1 2M13 20.5l-1 2M17 20.5l-1 2" /></g>;
const DRAW: Record<Kind, React.ReactNode> = {
  clear: SUN,
  partly: <><g transform="translate(-3 -3) scale(.8)">{SUN}</g>{cloud('#cfd6e2')}</>,
  cloudy: cloud('#aab3c2'),
  fog: <g stroke="#9aa3b2" strokeWidth="2" strokeLinecap="round"><path d="M4 9h16M3 13h18M5 17h14" /></g>,
  drizzle: <><g transform="translate(0 -3)">{cloud('#aab3c2')}</g>{drops('#3b82f6')}</>,
  rain: <><g transform="translate(0 -3)">{cloud('#8f9bb0')}</g>{drops('#1d6fe6')}</>,
  snow: <><g transform="translate(0 -3)">{cloud('#c6d0dd')}</g><g fill="#7cc4f2"><circle cx="9" cy="21" r="1.2" /><circle cx="13" cy="22" r="1.2" /><circle cx="17" cy="21" r="1.2" /></g></>,
  storm: <><g transform="translate(0 -3)">{cloud('#7d879a')}</g><path d="M12.5 15l-2.5 4h2.5l-1.5 4 4.5-5.5h-2.6l1.6-2.5z" fill="#8b5cf6" /></>,
};
const Icon = ({ kind, size = 28 }: { kind: Kind | null; size?: number }) => kind ? <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">{DRAW[kind]}</svg> : null;

type Report = { weather: Weather | null; aqi: number | null };
async function getJson(url: string) { const r = await fetch(url); if (!r.ok) throw new Error(String(r.status)); return r.json(); }
async function report(p: Place): Promise<Report> {
  const [w, a] = await Promise.allSettled([getJson(forecastUrl(p)), getJson(airUrl(p))]);
  return { weather: w.status === 'fulfilled' ? parseForecast(w.value) : null, aqi: a.status === 'fulfilled' ? parseAir(a.value) : null };
}
const keyOf = (p: Place) => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`;

function Clock({ now, zone, label }: { now: Date; zone: string; label: string }) {
  const c = readClock(now, zone);
  const hand = (a: number, len: number, w: number) => <line className="today-hand" x1="32" y1="32" x2="32" y2={32 - len} strokeWidth={w} strokeLinecap="round" transform={`rotate(${a} 32 32)`} />;
  return <span className={`today-clock${c.night ? ' is-night' : ''}`}>
    <svg viewBox="0 0 64 64" role="img" aria-label={`${label} ${String(c.h).padStart(2, '0')}:${String(c.m).padStart(2, '0')}`}>
      <circle cx="32" cy="32" r="30" className="today-rim" />
      <g className="today-ticks">{Array.from({ length: 12 }, (_, i) => <line key={i} x1="32" y1="6" x2="32" y2={i % 3 === 0 ? 11 : 9} strokeWidth={i % 3 === 0 ? 2.4 : 1.4} transform={`rotate(${i * 30} 32 32)`} />)}</g>
      {hand(c.hourAngle, 14, 3.4)}{hand(c.minuteAngle, 21, 2.4)}<circle cx="32" cy="32" r="2.4" className="today-pin" />
    </svg>
    <strong>{String(c.h).padStart(2, '0')}:{String(c.m).padStart(2, '0')}</strong>
  </span>;
}

function PlacePicker({ places, onChange, onClose }: { places: Place[]; onChange: (p: Place[]) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Found[] | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setFound(null); return; }
    const t = setTimeout(() => findPlaces(q).then(setFound).catch(() => setFound([])), 300);
    return () => clearTimeout(t);
  }, [q]);
  return <div className="today-picker">
    <ul>{places.map((p, i) => <li key={keyOf(p)}><span>{p.name}</span><small>{p.tz.split('/').pop()?.replace(/_/g, ' ')}</small>
      <button type="button" disabled={i === 0} onClick={() => { const l = [...places]; [l[i - 1], l[i]] = [l[i]!, l[i - 1]!]; onChange(l); }} aria-label={`Monter ${p.name}`}>↑</button>
      <button type="button" disabled={places.length <= 1} onClick={() => onChange(places.filter((_, k) => k !== i))} aria-label={`Retirer ${p.name}`}>×</button></li>)}</ul>
    {places.length < 4 && <div className="field"><label htmlFor="today-find">Ajouter une ville</label><input id="today-find" value={q} onChange={e => setQ(e.target.value)} placeholder="Tbilissi, Courchevel, Abu Dhabi…" autoComplete="off" /></div>}
    {found && (found.length === 0 ? <p className="booking-muted">Aucune ville trouvée.</p> : <div className="today-found">{found.map(f => <button key={keyOf(f) + f.label} type="button" onClick={() => { onChange([...places, { name: f.name, latitude: f.latitude, longitude: f.longitude, tz: f.tz }]); setQ(''); }}>{f.label}</button>)}</div>)}
    <div className="today-picker-foot"><button type="button" className="today-link" onClick={() => onChange(DEFAULT_PLACES)}>Dubai, Vannes, Gudauri</button><button type="button" className="today-link" onClick={onClose}>Terminé</button></div>
  </div>;
}

export function TodayBand({ name, timeZone }: { name: string; timeZone: string }) {
  const [now, setNow] = useState(() => new Date());
  const [places, setPlaces] = useState<Place[]>(DEFAULT_PLACES);
  const [editing, setEditing] = useState(false);
  // on a phone the band shows one city (or all), chosen by a tap; kept in this browser
  const [focus, setFocus] = useState<number | 'all'>(0);
  useEffect(() => { try { const v = localStorage.getItem('oolala-today-focus'); if (v === 'all') setFocus('all'); else if (v) setFocus(Number(v) || 0); } catch { /* default */ } }, []);
  const choose = (f: number | 'all') => { setFocus(f); try { localStorage.setItem('oolala-today-focus', String(f)); } catch { /* this browser only */ } };
  const [reports, setReports] = useState<Record<string, Report>>({});
  useEffect(() => { setPlaces(readPlaces()); }, []);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 20_000); return () => clearInterval(t); }, []);
  const placesKey = places.map(keyOf).join('|');
  useEffect(() => {
    let alive = true;
    const load = () => places.forEach(p => report(p).then(r => { if (alive) setReports(x => ({ ...x, [keyOf(p)]: r })); }));
    load();
    const t = setInterval(load, 30 * 60_000);
    return () => { alive = false; clearInterval(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesKey]);
  const change = (l: Place[]) => { setPlaces(l); writePlaces(l); };
  const hour = readClock(now, timeZone).h;
  const date = new Intl.DateTimeFormat('fr-FR', { timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(now);

  return <section className="today-band" aria-label="Aujourd’hui">
    <div className="today-head"><p><span className="today-date">{date}</span><strong>{greeting(hour)} {name.split(' ')[0]}</strong></p>
      <button type="button" className="today-link" onClick={() => setEditing(e => !e)} aria-expanded={editing}>{editing ? 'Fermer' : 'Villes'}</button></div>
    {editing && <PlacePicker places={places} onChange={change} onClose={() => setEditing(false)} />}
    {places.length > 1 && <div className="today-focus" role="tablist" aria-label="Ville affichée">{places.map((p, i) =>
      <button key={keyOf(p)} type="button" role="tab" aria-selected={focus === i || (focus !== 'all' && focus >= places.length && i === 0)} onClick={() => choose(i)}>{p.name}</button>)}
      <button type="button" role="tab" aria-selected={focus === 'all'} onClick={() => choose('all')}>Toutes</button></div>}
    <ul className={`today-rows${focus === 'all' ? ' is-all' : ''}`}>{places.map((p, i) => {
      const r = reports[keyOf(p)], w = r?.weather, band = aqiBand(r?.aqi ?? null);
      const day = new Intl.DateTimeFormat('fr-FR', { timeZone: p.tz, weekday: 'short' });
      const shown = focus === 'all' || focus === i || (focus >= places.length && i === 0);
      return <li key={keyOf(p)} className={`today-row${shown ? ' is-shown' : ''}`} onClick={() => { if (focus !== 'all') choose((i + 1) % places.length); }}>
        <Clock now={now} zone={p.tz} label={p.name} />
        <div className="today-place"><strong>{p.name}</strong>
          <span className="today-now"><Icon kind={w?.kind ?? null} size={20} />{w ? <>{Math.round(w.temperature)}°<small>{w.kind ? KIND_LABEL[w.kind] : ''}{w.feels != null && Math.abs(w.feels - w.temperature) >= 3 ? ` · ressenti ${Math.round(w.feels)}°` : ''}</small></> : <small>{r ? 'météo indisponible' : '…'}</small>}</span>
          {band && <span className={`today-aqi is-${band.key}`} title={`Qualité de l’air : ${band.label}`}>Air {Math.round(r!.aqi!)}</span>}</div>
        {w && <ol className="today-days" aria-label={`Prévisions ${p.name}`}>{w.days.slice(1, 3).map(d => <li key={d.date}><span>{day.format(new Date(d.date + 'T12:00:00Z')).replace('.', '')}</span><Icon kind={d.kind} size={16} /><span>{d.max != null ? Math.round(d.max) + '°' : '–'}<small>{d.min != null ? Math.round(d.min) + '°' : ''}</small></span></li>)}</ol>}
      </li>;
    })}</ul>
  </section>;
}
