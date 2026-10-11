import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Building2, Check, Mail, MapPin, MessageCircle, Pencil, Phone, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  adminRpc, errorLabel, localDate, localTime, modeLabel, statusLabel, zonedToIso,
  type ApptType, type Booking, type BookingStatus, type Catalog, type Staff,
} from '@/lib/solo-admin';

export type EditorSeed = { booking?: Booking; contact?: { id?: string | undefined; name?: string | null; email?: string | null; phone?: string | null }; date?: string };

const waLink = (phone: string) => `https://wa.me/${phone.replace(/[^0-9]/g, '')}`;

export function BookingCard({ booking: b, timeZone, onEdit, onChanged }: { booking: Booking; timeZone: string; onEdit: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function set(status: BookingStatus) {
    let note: string | null = null;
    if (status === 'cancelled') { note = window.prompt('Motif de l’annulation (facultatif)', '') ; if (note === null) return; }
    setBusy(true); setError('');
    try { await adminRpc('solo_admin_booking_status', { p_id: b.id, p_status: status, p_note: note }); onChanged(); }
    catch (e) { setError(errorLabel((e as Error).message)); }
    finally { setBusy(false); }
  }
  const upcoming = new Date(b.ends_at) > new Date();
  const Icon = b.mode === 'in_person' ? Building2 : b.mode === 'phone' ? Phone : Video;
  return <article className={`admin-card is-${b.status}`}>
    <div className="admin-card-when"><strong>{localTime(b.starts_at, timeZone)}</strong><span>{new Intl.DateTimeFormat('fr-FR', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(b.starts_at))}</span></div>
    <div className="admin-card-body">
      <div className="admin-card-title"><h3>{b.name}</h3><span className={`status-pill is-${b.status}`}>{statusLabel[b.status]}</span></div>
      <p className="type-meta"><Icon size={14} aria-hidden="true" />{b.title} · {Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000)} min{b.source === 'site' ? ' · réservé en ligne' : ''}</p>
      {(b.location_name || b.location_address) && <p className="type-meta"><MapPin size={14} aria-hidden="true" />{[b.location_name, b.location_address].filter(Boolean).join(' — ')}</p>}
      {b.message && <p className="admin-quote">{b.message}</p>}
      {b.internal_note && <p className="admin-note">{b.internal_note}</p>}
      <div className="admin-actions">
        {b.status === 'pending' && <Button size="sm" disabled={busy} onClick={() => set('confirmed')}><Check /> Confirmer</Button>}
        {b.status === 'confirmed' && !upcoming && <><Button size="sm" variant="ghost" disabled={busy} onClick={() => set('completed')}>Terminé</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => set('no_show')}>Absent</Button></>}
        {['pending', 'confirmed'].includes(b.status) && <Button size="sm" variant="ghost" disabled={busy} onClick={() => set('cancelled')}><X /> Annuler</Button>}
        <Button size="sm" variant="ghost" onClick={onEdit}><Pencil /> Modifier</Button>
        {b.phone && <Button size="sm" variant="ghost" asChild><a href={waLink(b.phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle /></a></Button>}
        {b.email && <Button size="sm" variant="ghost" asChild><a href={`mailto:${b.email}`} aria-label="Email"><Mail /></a></Button>}
      </div>
      {error && <p role="alert" className="booking-error">{error}</p>}
    </div>
  </article>;
}

export function BookingEditor({ staff, seed, onClose, onSaved }: { staff: Staff; seed: EditorSeed; onClose: () => void; onSaved: () => void }) {
  const tz = staff.timezone;
  const b = seed.booking;
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [typeId, setTypeId] = useState(b?.type_id ?? '');
  const [placeId, setPlaceId] = useState(b?.location_id ?? (b?.location_name ? 'custom' : ''));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminRpc<Catalog>('solo_admin_catalog').then(c => {
      setCatalog(c);
      if (!b) { const first = c.types.find(t => t.active); if (first) { setTypeId(first.id); setPlaceId(first.location_id ?? ''); } }
    }).catch(e => setError(errorLabel(e.message)));
  }, [b]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onClose]);

  const type: ApptType | undefined = catalog?.types.find(t => t.id === typeId);
  const places = useMemo(() => catalog?.locations.filter(l => l.active || l.id === placeId) ?? [], [catalog, placeId]);
  const known = !!seed.contact?.id || !!b?.crm_contact_id;
  const defaultDate = b ? localDate(b.starts_at, tz) : seed.date ?? localDate(new Date(Date.now() + 86400000), tz);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!type) return;
    const f = new FormData(event.currentTarget);
    const get = (k: string) => String(f.get(k) ?? '').trim();
    const custom = placeId === 'custom';
    setBusy(true); setError('');
    try {
      await adminRpc('solo_admin_booking_save', { p: {
        id: b?.id ?? '', type_id: type.id, starts_at: zonedToIso(get('date'), get('time'), tz), duration_min: Number(get('duration')) || type.duration_min,
        status: get('status') || undefined, location_id: custom ? '' : placeId,
        location_name: custom ? get('location_name') : '', location_address: custom ? get('location_address') : '',
        meeting_url: get('meeting_url'), crm_contact_id: seed.contact?.id ?? b?.crm_contact_id ?? '',
        name: get('name'), email: get('email'), phone: get('phone'), lang: get('lang') || 'fr', internal_note: get('internal_note'),
        notify_client: f.get('notify') === 'on',
      } });
      onSaved();
    } catch (e) { setError(errorLabel((e as Error).message)); }
    finally { setBusy(false); }
  }

  return <div className="admin-overlay" role="dialog" aria-modal="true" aria-labelledby="editor-title" onClick={e => e.target === e.currentTarget && onClose()}>
    <form className="admin-sheet contact-form" onSubmit={submit}>
      <div className="admin-sheet-head"><h2 id="editor-title">{b ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}</h2><Button type="button" variant="ghost" size="icon" aria-label="Fermer" onClick={onClose}><X /></Button></div>
      {!catalog ? <p className="booking-muted">Chargement…</p> : <>
        <div className="field"><label htmlFor="e-type">Type</label><select id="e-type" value={typeId} onChange={e => { setTypeId(e.target.value); const t = catalog.types.find(x => x.id === e.target.value); setPlaceId(t?.location_id ?? ''); }}>
          {catalog.types.filter(t => t.active || t.id === typeId).map(t => <option key={t.id} value={t.id}>{t.title['fr']} · {modeLabel[t.mode]}</option>)}</select></div>
        <div className="form-three">
          <div className="field"><label htmlFor="e-date">Date</label><input id="e-date" name="date" type="date" required defaultValue={defaultDate} /></div>
          <div className="field"><label htmlFor="e-time">Heure ({tz.split('/').pop()?.replace('_', ' ')})</label><input id="e-time" name="time" type="time" step={300} required defaultValue={b ? localTime(b.starts_at, tz) : '10:00'} /></div>
          <div className="field"><label htmlFor="e-duration">Durée (min)</label><input id="e-duration" name="duration" type="number" min={10} max={720} step={5} key={typeId} defaultValue={b ? Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000) : type?.duration_min} /></div>
        </div>
        {type?.mode === 'in_person' && <div className="field"><label htmlFor="e-place">Lieu</label><select id="e-place" value={placeId} onChange={e => setPlaceId(e.target.value)}>
          <option value="">Choisir un lieu</option>{places.map(l => <option key={l.id} value={l.id}>{l.name}{l.city ? ` · ${l.city}` : ''}</option>)}<option value="custom">Autre adresse…</option></select></div>}
        {type?.mode === 'in_person' && placeId === 'custom' && <div className="form-two">
          <div className="field"><label htmlFor="e-lname">Nom du lieu</label><input id="e-lname" name="location_name" defaultValue={b?.location_name ?? ''} placeholder="Cabinet, résidence…" /></div>
          <div className="field"><label htmlFor="e-laddr">Adresse</label><input id="e-laddr" name="location_address" defaultValue={b?.location_address ?? ''} /></div></div>}
        {type?.mode !== 'in_person' && <div className="field"><label htmlFor="e-url">Lien de visio</label><input id="e-url" name="meeting_url" type="url" placeholder="https://" defaultValue={b?.meeting_url ?? ''} /></div>}
        {known ? <p className="type-meta">Client : <strong>{seed.contact?.name ?? b?.name}</strong></p> : <>
          <div className="form-two"><div className="field"><label htmlFor="e-name">Nom du client *</label><input id="e-name" name="name" required defaultValue={seed.contact?.name ?? ''} /></div>
            <div className="field"><label htmlFor="e-email">Email</label><input id="e-email" name="email" type="email" defaultValue={seed.contact?.email ?? ''} /></div></div>
          <div className="form-two"><div className="field"><label htmlFor="e-phone">Téléphone</label><input id="e-phone" name="phone" type="tel" defaultValue={seed.contact?.phone ?? ''} /></div>
            <div className="field"><label htmlFor="e-lang">Langue</label><select id="e-lang" name="lang" defaultValue="fr"><option value="fr">Français</option><option value="en">English</option><option value="ru">Русский</option></select></div></div>
        </>}
        {known && <><input type="hidden" name="name" value={seed.contact?.name ?? b?.name ?? ''} /><input type="hidden" name="email" value={seed.contact?.email ?? b?.email ?? ''} /><input type="hidden" name="phone" value={seed.contact?.phone ?? b?.phone ?? ''} /><input type="hidden" name="lang" value={b?.lang ?? 'fr'} /></>}
        {b && <div className="field"><label htmlFor="e-status">Statut</label><select id="e-status" name="status" defaultValue={b.status}>{(Object.keys(statusLabel) as BookingStatus[]).map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}</select></div>}
        <div className="field"><label htmlFor="e-note">Note interne</label><textarea id="e-note" name="internal_note" defaultValue={b?.internal_note ?? ''} placeholder="Documents à apporter, partenaire présent…" /></div>
        <label className="admin-check"><input type="checkbox" name="notify" defaultChecked={!b} /> Prévenir le client par email (dès que l’envoi des emails est activé)</label>
        {error && <p role="alert" className="booking-error">{error}</p>}
        <div className="form-actions"><Button type="submit" disabled={busy || !type}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button><Button type="button" variant="ghost" onClick={onClose}>Annuler</Button></div>
      </>}
    </form>
  </div>;
}
