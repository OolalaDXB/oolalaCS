// The back office's "Today" band, after Coach Gari's (admin/today.js): date,
// greeting, weather and air where Darya meets clients, and the clocks of the
// three countries. Weather and air come from Open-Meteo (free, no key), called
// from the browser: only each city's coordinates leave. An answer that does
// not look as expected becomes null and the band says nothing for that city.

export type Place = { name: string; latitude: number; longitude: number; tz: string };
// Where Darya meets clients and skis: Dubai, Vannes, Gudauri (Georgia). Chosen
// again in the band; the choice stays in this browser.
export const DEFAULT_PLACES: Place[] = [
  { name: 'Dubai', latitude: 25.2048, longitude: 55.2708, tz: 'Asia/Dubai' },
  { name: 'Vannes', latitude: 47.6582, longitude: -2.7608, tz: 'Europe/Paris' },
  { name: 'Gudauri', latitude: 42.4776, longitude: 44.4785, tz: 'Asia/Tbilisi' },
];
const PLACES_KEY = 'oolala-today-places';
export const isZone = (z: unknown): z is string => { if (typeof z !== 'string' || !/^[A-Za-z]+\/[A-Za-z0-9_+\-/]+$/.test(z)) return false; try { new Intl.DateTimeFormat('en', { timeZone: z }); return true; } catch { return false; } };
export const isPlace = (p: unknown): p is Place => { const x = p as Place; return !!x && typeof x.name === 'string' && x.name.trim() !== '' && x.name.length <= 60
  && Number.isFinite(x.latitude) && Number.isFinite(x.longitude) && Math.abs(x.latitude) <= 90 && Math.abs(x.longitude) <= 180 && isZone(x.tz); };
export function readPlaces(): Place[] {
  try { const v = JSON.parse(localStorage.getItem(PLACES_KEY) ?? 'null'); if (Array.isArray(v) && v.length >= 1 && v.length <= 4 && v.every(isPlace)) return v; } catch { /* default */ }
  return DEFAULT_PLACES;
}
export function writePlaces(list: Place[]) { try { localStorage.setItem(PLACES_KEY, JSON.stringify(list)); } catch { /* this browser only */ } }

// any town by name (Open-Meteo geocoding): name, region, country, coordinates, zone
export type Found = Place & { label: string };
export async function findPlaces(query: string): Promise<Found[]> {
  const q = new URLSearchParams({ name: query.trim().slice(0, 80), count: '6', language: 'fr', format: 'json' });
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${q}`);
  if (!r.ok) return [];
  const body = await r.json() as { results?: { name?: string; admin1?: string; country?: string; latitude?: number; longitude?: number; timezone?: string }[] };
  return (body.results ?? []).map(x => ({ name: String(x.name ?? '').slice(0, 60), latitude: Number(x.latitude), longitude: Number(x.longitude), tz: String(x.timezone ?? ''),
    label: [x.name, x.admin1 && x.admin1 !== x.name ? x.admin1 : '', x.country].filter(Boolean).join(', ') })).filter(isPlace);
}
export type Kind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';
export const KIND_LABEL: Record<Kind, string> = { clear: 'Dégagé', partly: 'Éclaircies', cloudy: 'Couvert', fog: 'Brouillard', drizzle: 'Bruine', rain: 'Pluie', snow: 'Neige', storm: 'Orage' };

const finite = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// WMO weather codes (Open-Meteo documentation) → eight kinds. Unknown → null.
export function weatherKind(code: number | null): Kind | null {
  if (code == null) return null;
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'storm';
  return null;
}

export function forecastUrl(p: Place) {
  const q = new URLSearchParams({
    latitude: String(p.latitude), longitude: String(p.longitude),
    current: 'temperature_2m,apparent_temperature,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: p.tz, forecast_days: '3',
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}
export function airUrl(p: Place) {
  const q = new URLSearchParams({ latitude: String(p.latitude), longitude: String(p.longitude), current: 'us_aqi', timezone: p.tz });
  return `https://air-quality-api.open-meteo.com/v1/air-quality?${q}`;
}

export type Day = { date: string; kind: Kind | null; min: number | null; max: number | null; rain: number | null };
export type Weather = { temperature: number; feels: number | null; kind: Kind | null; days: Day[] };

export function parseForecast(body: unknown): Weather | null {
  const b = body as { current?: Record<string, unknown>; daily?: Record<string, unknown[] | undefined> } | null;
  const c = b?.current, d = b?.daily;
  const temperature = finite(c?.['temperature_2m']);
  if (!c || !d || !Array.isArray(d['time']) || temperature == null) return null;
  return {
    temperature, feels: finite(c['apparent_temperature']), kind: weatherKind(finite(c['weather_code'])),
    days: d['time'].map((date, i) => ({ date: String(date), kind: weatherKind(finite(d['weather_code']?.[i])), min: finite(d['temperature_2m_min']?.[i]), max: finite(d['temperature_2m_max']?.[i]), rain: finite(d['precipitation_probability_max']?.[i]) })),
  };
}
export function parseAir(body: unknown): number | null {
  return finite((body as { current?: Record<string, unknown> } | null)?.current?.['us_aqi']);
}

// US AQI bands
export function aqiBand(aqi: number | null) {
  if (aqi == null) return null;
  if (aqi <= 50) return { key: 'good', label: 'bon' };
  if (aqi <= 100) return { key: 'moderate', label: 'moyen' };
  if (aqi <= 150) return { key: 'sensitive', label: 'mauvais pour les personnes sensibles' };
  if (aqi <= 200) return { key: 'unhealthy', label: 'mauvais' };
  return { key: 'hazardous', label: 'très mauvais' };
}

export function greeting(hour: number) {
  if (hour < 5 || hour >= 18) return 'Bonsoir';
  return 'Bonjour';
}

export function readClock(now: Date, zone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' })
    .formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  const h = (parts['hour'] ?? 0) % 24, m = parts['minute'] ?? 0, s = parts['second'] ?? 0;
  return { h, m, hourAngle: (h % 12) * 30 + m / 2, minuteAngle: m * 6 + s / 10, night: h < 7 || h >= 20 };
}
