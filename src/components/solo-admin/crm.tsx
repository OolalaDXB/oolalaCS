import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, CalendarPlus, Mail, MessageCircle, Phone, Pin, Upload, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  adminRpc, can, destinationLabel, errorLabel, serviceLabel, shortDateTime, stageLabel,
  type Booking, type Contact, type ContactProfile, type Enquiry, type Stage, type Staff,
} from '@/lib/solo-admin';
import { BookingCard, type EditorSeed } from './booking-editor';
import { ContactForm } from './contact-form';
import { ContactImport } from './contact-import';
import { Invoices } from './invoices';

const shortDay = (d: string) => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));

const enquiryStatus: Record<Enquiry['status'], string> = { new: 'Nouvelles', handled: 'Traitées', archived: 'Archivées', spam: 'Indésirables' };
const contactStatus: Record<Contact['status'], string> = { lead: 'Prospect', client: 'Client', archived: 'Archivé' };
const waLink = (phone: string) => `https://wa.me/${phone.replace(/[^0-9]/g, '')}`;
const detailLabel: Record<string, string> = { budget: 'Budget', goal: 'Objectif', zone: 'Zone' };

function Reach({ email, phone }: { email: string | null; phone: string | null }) {
  return <div className="admin-actions">
    {phone && <Button size="sm" variant="ghost" asChild><a href={waLink(phone)} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a></Button>}
    {phone && <Button size="sm" variant="ghost" asChild><a href={`tel:${phone}`}><Phone /> Appeler</a></Button>}
    {email && <Button size="sm" variant="ghost" asChild><a href={`mailto:${email}`}><Mail /> Email</a></Button>}
  </div>;
}

export function Enquiries({ staff, onPlan }: { staff: Staff; onPlan: (seed: EditorSeed) => void }) {
  const [status, setStatus] = useState<Enquiry['status']>('new');
  const [list, setList] = useState<Enquiry[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => { setList(null); adminRpc<Enquiry[]>('solo_admin_enquiries', { p_status: status }).then(setList).catch(e => setError(errorLabel(e.message))); }, [status]);
  useEffect(load, [load]);
  async function set(id: string, next: Enquiry['status']) {
    try { await adminRpc('solo_admin_enquiry_status', { p_id: id, p_status: next }); setList(l => l?.filter(e => e.id !== id) ?? null); } catch (e) { setError(errorLabel((e as Error).message)); }
  }
  return <>
    <div className="admin-subtabs" role="tablist">{(Object.keys(enquiryStatus) as Enquiry['status'][]).map(s => <button key={s} type="button" role="tab" aria-selected={s === status} onClick={() => setStatus(s)}>{enquiryStatus[s]}</button>)}</div>
    {error && <p role="alert" className="booking-error">{error}</p>}
    {!list ? <p className="booking-muted">Chargement…</p> : list.length === 0 ? <p className="booking-muted">Rien ici pour le moment.</p> : <div className="admin-list">{list.map(e =>
      <article key={e.id} className="admin-card">
        <div className="admin-card-when"><strong>{shortDateTime(e.created_at, staff.timezone).split(' ').slice(0, 2).join(' ')}</strong><span>{shortDateTime(e.created_at, staff.timezone).split(' ').slice(2).join(' ')}</span></div>
        <div className="admin-card-body">
          <div className="admin-card-title"><h3>{e.name}</h3>{e.lang && <span className="status-pill">{e.lang.toUpperCase()}</span>}</div>
          <p className="type-meta">{[e.need, e.country, e.email, e.phone].filter(Boolean).join(' · ')}</p>
          {Object.entries(e.details ?? {}).filter(([, v]) => v).length > 0 && <p className="type-meta">{Object.entries(e.details).filter(([, v]) => v).map(([k, v]) => `${detailLabel[k] ?? k} : ${v}`).join(' · ')}</p>}
          <p className="admin-quote">{e.message}</p>
          <Reach email={e.email} phone={e.phone} />
          <div className="admin-actions">
            <Button size="sm" onClick={() => onPlan({ contact: { id: e.crm_contact_id ?? undefined, name: e.name, email: e.email, phone: e.phone } })}><CalendarPlus /> Planifier</Button>
            {status !== 'handled' && <Button size="sm" variant="ghost" onClick={() => set(e.id, 'handled')}>Traitée</Button>}
            {status !== 'archived' && <Button size="sm" variant="ghost" onClick={() => set(e.id, 'archived')}>Archiver</Button>}
            {status === 'new' && <Button size="sm" variant="ghost" onClick={() => set(e.id, 'spam')}>Indésirable</Button>}
            {status !== 'new' && <Button size="sm" variant="ghost" onClick={() => set(e.id, 'new')}>Remettre en nouvelles</Button>}
          </div>
        </div>
      </article>)}</div>}
  </>;
}

export function Clients({ staff, refresh, onPlan, onEdit, onChanged }: { staff: Staff; refresh: number; onPlan: (seed: EditorSeed) => void; onEdit: (seed: EditorSeed) => void; onChanged: () => void }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | Contact['status'] | Stage>('');
  const [list, setList] = useState<Contact[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    const id = setTimeout(() => adminRpc<Contact[]>('solo_admin_contacts', { p_search: search || null, p_status: status || null }).then(setList).catch(e => setError(errorLabel(e.message))), 250);
    return () => clearTimeout(id);
  }, [search, status, refresh, reload]);
  if (open) return <ContactPanel id={open} staff={staff} refresh={refresh} onBack={() => setOpen(null)} onPlan={onPlan} onEdit={onEdit} onChanged={onChanged} />;
  return <>
    <div className="admin-filters"><input type="search" placeholder="Nom, email, téléphone, société…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Rechercher un client" />
      <select value={status} onChange={e => setStatus(e.target.value as typeof status)} aria-label="Statut ou étape"><option value="">Tous</option>{(Object.keys(contactStatus) as Contact['status'][]).map(s => <option key={s} value={s}>{contactStatus[s]}</option>)}
        <optgroup label="Étape">{(Object.keys(stageLabel) as Stage[]).map(s => <option key={s} value={s}>{stageLabel[s]}</option>)}</optgroup></select>
      <div className="admin-actions"><Button size="sm" onClick={() => setCreating(true)}><UserPlus /> Nouveau contact</Button><Button size="sm" variant="outline" onClick={() => setImporting(true)}><Upload /> Importer</Button></div></div>
    {importing && <ContactImport onClose={() => setImporting(false)} onDone={() => setReload(r => r + 1)} />}
    {creating && <ContactForm onClose={() => setCreating(false)} onSaved={c => { setCreating(false); setOpen(c.id); }} />}
    {error && <p role="alert" className="booking-error">{error}</p>}
    {!list ? <p className="booking-muted">Chargement…</p> : list.length === 0 ? <p className="booking-muted">Aucun contact.</p> : <div className="admin-list">{list.map(c =>
      <button key={c.id} type="button" className="admin-row admin-row-button" onClick={() => setOpen(c.id)}>
        <span><strong>{c.name ?? c.email ?? c.company ?? 'Sans nom'}</strong>{c.needs_review && <span className="status-pill is-pending"> à vérifier</span>}<br /><small>{[c.company && c.role ? `${c.role}, ${c.company}` : c.company, c.city ?? c.country, c.email, c.phone].filter(Boolean).join(' · ')}</small>
          {c.next_action && <><br /><small className="contact-next">→ {c.next_action}{c.next_action_on ? ` · ${shortDay(c.next_action_on)}` : ''}</small></>}</span>
        <span className="admin-row-meta"><span className={`status-pill is-${c.status === 'client' ? 'confirmed' : c.status === 'archived' ? 'cancelled' : 'pending'}`}>{contactStatus[c.status]}</span>{c.stage && c.stage !== 'new' && <span className={`stage-pill is-${c.stage}`}>{stageLabel[c.stage]}</span>}<small>{c.enquiries} demande(s) · {c.bookings} RDV</small></span>
      </button>)}</div>}
  </>;
}

function ContactPanel({ id, staff, refresh, onBack, onPlan, onEdit, onChanged }: { id: string; staff: Staff; refresh: number; onBack: () => void; onPlan: (seed: EditorSeed) => void; onEdit: (seed: EditorSeed) => void; onChanged: () => void }) {
  const [c, setC] = useState<ContactProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => { adminRpc<ContactProfile>('solo_admin_contact', { p_id: id }).then(setC).catch(e => setError(errorLabel(e.message))); }, [id]);
  useEffect(load, [load, refresh]);
  async function note(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget; const f = new FormData(form);
    const body = String(f.get('body') ?? '').trim(); if (!body) return;
    try { await adminRpc('solo_admin_note_add', { p_contact: id, p_body: body, p_pinned: f.get('pinned') === 'on' }); form.reset(); load(); } catch (e) { setError(errorLabel((e as Error).message)); }
  }
  if (!c) return <><Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft /> Clients</Button><p className="booking-muted">{error || 'Chargement…'}</p></>;
  const upcoming = c.bookings.filter((b: Booking) => new Date(b.ends_at) > new Date());
  const past = c.bookings.filter((b: Booking) => new Date(b.ends_at) <= new Date());
  return <>
    <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft /> Clients</Button>
    <section className="admin-panel">
      <div className="admin-card-title"><h2>{c.name ?? c.email ?? 'Sans nom'}</h2><span className="status-pill">{contactStatus[c.status]}</span></div>
      <>
        {(c.role || c.company) && <p className="contact-org">{[c.role, c.company].filter(Boolean).join(' · ')}</p>}
        {c.stage && <div className="stage-track is-static" aria-label="Étape">{(Object.keys(stageLabel) as Stage[]).map(k => <span key={k} aria-current={c.stage === k ? 'step' : undefined} className={`is-${k}`}>{stageLabel[k]}</span>)}</div>}
        {c.next_action && <p className="contact-next-box">Prochaine action : <strong>{c.next_action}</strong>{c.next_action_on ? ` · ${shortDay(c.next_action_on)}` : ''}</p>}
        <dl className="contact-facts">
          {c.email && <><dt>Email</dt><dd>{c.email}</dd></>}
          {c.phone && <><dt>Téléphone</dt><dd>{c.phone}{c.whatsapp ? ' · WhatsApp' : ''}</dd></>}
          {(c.city || c.country) && <><dt>Vit à</dt><dd>{[c.address_line, c.postal_code, c.city, c.country].filter(Boolean).join(', ')}</dd></>}
          {c.nationality && <><dt>Nationalité</dt><dd>{c.nationality}</dd></>}
          {(c.lang || c.timezone) && <><dt>Langue · fuseau</dt><dd>{[c.lang?.toUpperCase(), c.timezone].filter(Boolean).join(' · ')}</dd></>}
          {(c.destinations?.length ?? 0) > 0 && <><dt>Destinations</dt><dd>{c.destinations!.map(d => <span key={d} className="chip-static">{destinationLabel[d] ?? d}</span>)}</dd></>}
          {(c.services?.length ?? 0) > 0 && <><dt>Besoins</dt><dd>{c.services!.map(d => <span key={d} className="chip-static">{serviceLabel[d] ?? d}</span>)}</dd></>}
          {c.budget && <><dt>Budget</dt><dd>{c.budget}</dd></>}
          {(c.linkedin || c.website) && <><dt>En ligne</dt><dd>{[c.linkedin, c.website].filter(Boolean).map(u => <a key={u!} href={/^https?:/.test(u!) ? u! : `https://${u}`} target="_blank" rel="noreferrer noopener">{u!.replace(/^https?:\/\/(www\.)?/, '')}</a>)}</dd></>}
          {(c.tags?.length ?? 0) > 0 && <><dt>Étiquettes</dt><dd>{c.tags!.map(t => <span key={t} className="chip-static">{t}</span>)}</dd></>}
          <dt>Origine</dt><dd>{[c.source === 'admin' ? 'ajouté au back-office' : c.source, c.referred_by ? `recommandé par ${c.referred_by}` : null, `premier contact ${shortDateTime(c.first_seen_at, staff.timezone)}`].filter(Boolean).join(' · ')}</dd>
        </dl>
        {c.needs_review && <p className="booking-muted">Fiche à vérifier : doublon possible.</p>}
        <Reach email={c.email} phone={c.phone} />
        <div className="admin-actions"><Button size="sm" onClick={() => onPlan({ contact: { id: c.id, name: c.name, email: c.email, phone: c.phone } })}><CalendarPlus /> Planifier</Button><Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Modifier la fiche</Button></div>
      </>
      {editing && <ContactForm contact={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
      {error && <p role="alert" className="booking-error">{error}</p>}
    </section>

    <section className="admin-section"><h2>Notes</h2>
      <form className="contact-form admin-note-form" onSubmit={note}><div className="field"><label htmlFor="n-body" className="sr-only">Nouvelle note</label><textarea id="n-body" name="body" placeholder="Échange du jour, documents reçus, prochaine étape…" required maxLength={5000} /></div>
        <div className="form-actions"><Button type="submit" size="sm">Ajouter la note</Button><label className="admin-check"><input type="checkbox" name="pinned" /> Épingler</label></div></form>
      {c.notes.length === 0 ? <p className="booking-muted">Aucune note.</p> : c.notes.map(n => <div key={n.id} className="admin-note-item">{n.pinned && <Pin size={13} aria-label="Épinglée" />}<p>{n.body}</p><small>{shortDateTime(n.created_at, staff.timezone)} · {n.author}</small></div>)}
    </section>

    <section className="admin-section"><h2>Rendez-vous</h2>
      {c.bookings.length === 0 ? <p className="booking-muted">Aucun rendez-vous.</p> : <div className="admin-list">{[...upcoming.reverse(), ...past].map(b => <BookingCard key={b.id} booking={b} timeZone={staff.timezone} onEdit={() => onEdit({ booking: b })} onChanged={() => { onChanged(); load(); }} />)}</div>}
    </section>

    {can(staff, 'solo:billing') && <section className="admin-section"><h2>Factures</h2>
      <Invoices staff={staff} contact={{ id: c.id, name: c.name, email: c.email, phone: c.phone, company: c.company }} /></section>}

    <section className="admin-section"><h2>Demandes</h2>
      {c.enquiries.length === 0 ? <p className="booking-muted">Aucune demande.</p> : c.enquiries.map(e => <div key={e.id} className="admin-note-item"><small>{shortDateTime(e.created_at, staff.timezone)} · {e.need ?? ''} · {enquiryStatus[e.status]}</small><p>{e.message}</p></div>)}
    </section>
  </>;
}
