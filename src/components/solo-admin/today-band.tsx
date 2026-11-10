import { useEffect, useState } from 'react';
import { airUrl, aqiBand, CLOCKS, forecastUrl, greeting, KIND_LABEL, parseAir, parseForecast, PLACES, readClock, type Kind, type Place, type Weather } from '@/lib/today';

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

export function TodayBand({ name, timeZone }: { name: string; timeZone: string }) {
  const [now, setNow] = useState(() => new Date());
  const [reports, setReports] = useState<Record<string, Report>>({});
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 20_000); return () => clearInterval(t); }, []);
  useEffect(() => {
    let alive = true;
    const load = () => PLACES.forEach(p => report(p).then(r => { if (alive) setReports(x => ({ ...x, [p.key]: r })); }));
    load();
    const t = setInterval(load, 30 * 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const hour = readClock(now, timeZone).h;
  const date = new Intl.DateTimeFormat('fr-FR', { timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(now);

  return <section className="today-band" aria-label="Aujourd’hui">
    <div className="today-hello"><p className="today-date">{date}</p><p className="today-greet">{greeting(hour)} {name.split(' ')[0]}</p></div>
    <div className="today-places">{PLACES.map(p => {
      const r = reports[p.key], w = r?.weather, band = aqiBand(r?.aqi ?? null);
      const local = new Intl.DateTimeFormat('fr-FR', { timeZone: p.tz, weekday: 'short' });
      return <div className="today-place" key={p.key}>
        <div className="today-now"><Icon kind={w?.kind ?? null} size={34} /><div><strong>{p.name}</strong><span>{w ? `${Math.round(w.temperature)}° · ${w.kind ? KIND_LABEL[w.kind] : ''}${w.feels != null && Math.abs(w.feels - w.temperature) >= 3 ? ` · ressenti ${Math.round(w.feels)}°` : ''}` : r ? 'Météo indisponible' : 'Météo…'}</span>
          {band && <span className={`today-aqi is-${band.key}`}>Air {Math.round(r!.aqi!)} · {band.label}</span>}</div></div>
        {w && <ol className="today-days">{w.days.map((d, i) => <li key={d.date}><span>{i === 0 ? 'Auj.' : local.format(new Date(d.date + 'T12:00:00Z'))}</span><Icon kind={d.kind} size={20} /><span>{d.max != null ? Math.round(d.max) + '°' : '–'}<small> {d.min != null ? Math.round(d.min) + '°' : ''}</small></span>{d.rain != null && d.rain >= 30 && <small className="today-rain">{d.rain} %</small>}</li>)}</ol>}
      </div>;
    })}</div>
    <div className="today-clocks">{CLOCKS.map(([label, zone]) => {
      const c = readClock(now, zone);
      const hand = (a: number, len: number, w: number, cls: string) => <line className={cls} x1="32" y1="32" x2="32" y2={32 - len} strokeWidth={w} strokeLinecap="round" transform={`rotate(${a} 32 32)`} />;
      return <figure key={zone} className={c.night ? 'is-night' : ''}>
        <svg viewBox="0 0 64 64" role="img" aria-label={`${label} ${String(c.h).padStart(2, '0')}:${String(c.m).padStart(2, '0')}`}>
          <circle cx="32" cy="32" r="30" className="today-rim" />
          <g className="today-ticks">{Array.from({ length: 12 }, (_, i) => <line key={i} x1="32" y1="5" x2="32" y2={i % 3 === 0 ? 10 : 8} strokeWidth={i % 3 === 0 ? 2 : 1} transform={`rotate(${i * 30} 32 32)`} />)}</g>
          {hand(c.hourAngle, 14, 3, 'today-hand')}{hand(c.minuteAngle, 21, 2, 'today-hand')}<circle cx="32" cy="32" r="2" className="today-pin" />
        </svg>
        <figcaption><strong>{String(c.h).padStart(2, '0')}:{String(c.m).padStart(2, '0')}</strong>{label}</figcaption>
      </figure>;
    })}</div>
    <p className="today-source">Météo et air : Open-Meteo, modèle (pas une station).</p>
  </section>;
}
