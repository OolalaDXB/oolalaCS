// Back-office client for BEAU Solo: every call goes through the permission-checked
// public.solo_admin_* functions with the signed-in staff member's session.
import { supabase } from '@/integrations/supabase/client';

type RpcResult = { data: unknown; error: { message: string } | null };
type RpcClient = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult> };

export class AdminError extends Error {}

export async function adminRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as unknown as RpcClient).rpc(fn, args);
  if (error) throw new AdminError(error.message);
  return data as T;
}

export type Staff = { email: string; name: string; permissions: string[]; timezone: string };
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type Booking = {
  id: string; ref: string; type_id: string; title: string; starts_at: string; ends_at: string; status: BookingStatus;
  mode: 'video' | 'phone' | 'in_person'; location_id: string | null; location_name: string | null; location_address: string | null;
  meeting_url: string | null; crm_contact_id: string | null; name: string; email: string | null; phone: string | null; lang: string;
  message: string | null; internal_note: string | null; price_amount: number; currency: string; source: 'site' | 'admin';
  cancel_reason: string | null; cancelled_by: string | null; created_at: string;
};
export type Place = {
  id: string; name: string; kind: 'office' | 'partner' | 'property' | 'other'; address: string | null; city: string | null; country: string | null;
  maps_url: string | null; client_note: string | null; notes: string | null; active: boolean;
};
export type ApptType = {
  id: string; slug: string; title: Record<string, string>; description: Record<string, string>; mode: Booking['mode'];
  location_policy: 'fixed' | 'to_define'; location_id: string | null; duration_min: number; buffer_min: number; min_notice_hours: number;
  max_days_ahead: number; price_amount: number; currency: string; requires_approval: boolean; public: boolean; active: boolean; sort: number;
};
export type Catalog = { types: ApptType[]; locations: Place[] };
export type Enquiry = {
  id: string; crm_contact_id: string | null; name: string; email: string; phone: string | null; country: string | null; need: string | null;
  message: string; details: Record<string, string>; lang: string | null; page: string | null; status: 'new' | 'handled' | 'archived' | 'spam'; created_at: string;
};
export type Contact = {
  id: string; name: string | null; email: string | null; phone: string | null; company: string | null; country: string | null; lang: string | null;
  status: 'lead' | 'client' | 'archived'; source: string | null; needs_review: boolean; first_seen_at: string; last_seen_at: string;
  enquiries?: number; bookings?: number;
};
export type Note = { id: string; body: string; pinned: boolean; author: string | null; created_at: string };
export type ContactProfile = Contact & { enquiries: Enquiry[]; bookings: Booking[]; notes: Note[] };
export type Exception = { id: string; kind: 'closed' | 'open'; starts_at: string; ends_at: string; reason: string | null; created_by: string | null };
export type Hours = { settings: { timezone: string; slot_step_min: number; notify_email: string | null }; rules: { weekday: number; start: string; end: string }[] };
export type Overview = { timezone: string; upcoming: Booking[] | null; pending: number | null; new_enquiries: number | null; needs_review: number | null };

export const can = (staff: Staff, permission: string) => staff.permissions.includes(permission) || staff.permissions.includes('solo:admin');

/* ---------- time zones without a library ---------- */
function offsetMinutes(instant: Date, timeZone: string) {
  const part = (type: string) => Number(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(instant).find(p => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  return (asUtc - instant.getTime()) / 60000;
}

/** "2026-10-19" + "09:30" in a zone → ISO instant (UTC). */
export function zonedToIso(date: string, time: string, timeZone: string) {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  const [hh = 0, mm = 0] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let instant = guess - offsetMinutes(new Date(guess), timeZone) * 60000;
  instant = guess - offsetMinutes(new Date(instant), timeZone) * 60000;
  return new Date(instant).toISOString();
}

export function localDate(iso: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(typeof iso === 'string' ? new Date(iso) : iso);
}
export function localTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
export function longDay(dateKey: string) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${dateKey}T12:00:00Z`));
}
export function addDays(dateKey: string, days: number) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function shortDateTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export const statusLabel: Record<BookingStatus, string> = { pending: 'À confirmer', confirmed: 'Confirmé', cancelled: 'Annulé', completed: 'Terminé', no_show: 'Absent' };
export const modeLabel: Record<Booking['mode'], string> = { video: 'Visio', phone: 'Téléphone', in_person: 'En personne' };
export const placeKindLabel: Record<Place['kind'], string> = { office: 'Bureau', partner: 'Partenaire', property: 'Bien', other: 'Autre' };
export const errorLabel = (message: string) => ({
  slot_unavailable: 'Ce créneau chevauche un autre rendez-vous.', forbidden: 'Vous n’avez pas accès à cette action.', invalid_name: 'Indiquez un nom.',
  not_found: 'Élément introuvable.', invalid_duration: 'Durée invalide.', unknown_type: 'Type de rendez-vous inconnu.',
} as Record<string, string>)[message] ?? `Erreur : ${message}`;
