// Client for the BEAU Solo public endpoint (Supabase Edge Function `solo-public`).
const base = (import.meta.env['VITE_SUPABASE_URL'] as string | undefined)?.replace(/\/+$/, '');
export const soloEndpoint = base ? `${base}/functions/v1/solo-public` : '';

export type SoloType = {
  slug: string; title: string; description: string | null; mode: 'video' | 'phone' | 'in_person';
  duration_min: number; price_amount: number; currency: string; requires_approval: boolean;
  location: { name: string; city: string | null; country: string | null } | null;
};
export type SoloSlot = { starts_at: string; ends_at: string };
export type SoloBooked = {
  ref: string; token: string; status: 'pending' | 'confirmed'; starts_at: string; ends_at: string; title: string;
  mode: SoloType['mode']; location_name: string | null; location_address: string | null;
};
export type SoloBooking = {
  ref: string; status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'; title: string; starts_at: string; ends_at: string;
  mode: SoloType['mode']; name: string; timezone: string; location_name: string | null; location_address: string | null;
  maps_url: string | null; client_note: string | null; meeting_url: string | null; can_cancel: boolean;
};

export class SoloError extends Error {}

export async function solo<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!soloEndpoint) throw new SoloError('not_configured');
  let res: Response;
  try {
    res = await fetch(soloEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) });
  } catch {
    throw new SoloError('network');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new SoloError(typeof body?.error === 'string' ? body.error : 'server_error');
  return body as T;
}

export const visitorTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function dayKey(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
