import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { adminRpc, errorLabel, localDate, zonedToIso, type Staff } from '@/lib/solo-admin';

// Block a time (unavailable) or open extra bookable time. Used in Blocages
// and from the calendar's "Ajouter" menu.
export function BlockForm({ staff, onDone, date, title = 'Ajouter un blocage ou une ouverture' }: { staff: Staff; onDone: () => void; date?: string; title?: string }) {
  const tz = staff.timezone;
  const today = localDate(new Date(), tz);
  const [error, setError] = useState('');
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form); const get = (k: string) => String(f.get(k) ?? '');
    const starts = zonedToIso(get('date'), get('start'), tz); const ends = zonedToIso(get('end_date') || get('date'), get('end'), tz);
    if (ends <= starts) { setError('La fin doit être après le début.'); return; }
    setError('');
    try { await adminRpc('solo_admin_exception_add', { p_kind: get('kind'), p_starts: starts, p_ends: ends, p_reason: get('reason') }); form.reset(); onDone(); }
    catch (e) { setError(errorLabel((e as Error).message)); }
  }
  return <form className="contact-form admin-panel" onSubmit={add}>
    <h2>{title}</h2>
    <div className="form-two"><div className="field"><label htmlFor="x-kind">Type</label><select id="x-kind" name="kind"><option value="closed">Bloquer (indisponible)</option><option value="open">Ouvrir (créneaux en plus)</option></select></div>
      <div className="field"><label htmlFor="x-reason">Motif</label><input id="x-reason" name="reason" placeholder="Visite de bien, déplacement, perso…" maxLength={200} /></div></div>
    <div className="form-three"><div className="field"><label htmlFor="x-date">Du</label><input id="x-date" name="date" type="date" required min={today} defaultValue={date && date >= today ? date : today} /></div>
      <div className="field"><label htmlFor="x-start">De</label><input id="x-start" name="start" type="time" step={900} required defaultValue="12:00" /></div>
      <div className="field"><label htmlFor="x-end">À</label><input id="x-end" name="end" type="time" step={900} required defaultValue="14:00" /></div></div>
    <div className="field"><label htmlFor="x-end-date">Jusqu’au (si plusieurs jours)</label><input id="x-end-date" name="end_date" type="date" min={today} /></div>
    {error && <p role="alert" className="booking-error">{error}</p>}
    <Button type="submit">Ajouter</Button>
  </form>;
}
