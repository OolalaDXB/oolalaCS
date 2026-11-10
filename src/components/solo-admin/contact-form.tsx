import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminRpc, destinationLabel, errorLabel, serviceLabel, stageLabel, type Contact, type Stage } from '@/lib/solo-admin';

// The contact card, in one sheet for creating and editing: who, how to reach,
// where they live, what they want from Oolala, and what comes next.
const COUNTRIES = ['Émirats arabes unis', 'France', 'Géorgie', 'Royaume-Uni', 'Belgique', 'Suisse', 'Russie', 'Ukraine', 'Kazakhstan', 'Arménie', 'Turquie', 'Arabie saoudite', 'Qatar', 'Inde', 'Liban', 'Maroc', 'États-Unis', 'Canada', 'Allemagne', 'Italie', 'Espagne'];
const ZONES = ['Asia/Dubai', 'Europe/Paris', 'Asia/Tbilisi', 'Europe/London', 'Europe/Moscow', 'Asia/Almaty', 'Europe/Istanbul', 'Asia/Kolkata', 'America/New_York'];
const SOURCES = ['Site', 'WhatsApp', 'Recommandation', 'Partenaire', 'LinkedIn', 'Instagram', 'Salon / événement', 'Réseau personnel'];

function Chips({ name, options, value, onChange }: { name: string; options: Record<string, string>; value: string[]; onChange: (v: string[]) => void }) {
  return <div className="chip-set" role="group" aria-label={name}>{Object.entries(options).map(([k, l]) =>
    <button key={k} type="button" aria-pressed={value.includes(k)} onClick={() => onChange(value.includes(k) ? value.filter(x => x !== k) : [...value, k])}>{l}</button>)}</div>;
}

export function ContactForm({ contact, onSaved, onClose }: { contact?: Contact; onSaved: (c: Contact) => void; onClose: () => void }) {
  const c = contact;
  const [destinations, setDestinations] = useState<string[]>(c?.destinations ?? []);
  const [services, setServices] = useState<string[]>(c?.services ?? []);
  const [stage, setStage] = useState<Stage>(c?.stage ?? 'new');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // older cards have one name: split it once at the first space
  const split = !c?.first_name && !c?.last_name && c?.name ? [c.name.split(' ')[0] ?? '', c.name.split(' ').slice(1).join(' ')] : null;
  const first = c?.first_name ?? split?.[0] ?? '';
  const last = c?.last_name ?? split?.[1] ?? '';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    const tags = (f['tags'] ?? '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    setBusy(true); setError('');
    try {
      const saved = await adminRpc<Contact>('solo_admin_contact_save', { p: { ...f, id: c?.id ?? '', name: '', whatsapp: f['whatsapp'] === 'on', needs_review: f['needs_review'] === 'on',
        destinations, services, stage, tags } });
      onSaved(saved);
    } catch (e) { setError(errorLabel((e as Error).message)); }
    finally { setBusy(false); }
  }

  return <div className="admin-overlay" role="dialog" aria-modal="true" aria-labelledby="contact-title" onClick={e => e.target === e.currentTarget && onClose()}>
    <form className="admin-sheet contact-form contact-sheet" onSubmit={submit}>
      <div className="admin-sheet-head"><h2 id="contact-title">{c ? 'Modifier la fiche' : 'Nouveau contact'}</h2><Button type="button" variant="ghost" size="icon" aria-label="Fermer" onClick={onClose}><X /></Button></div>

      <fieldset><legend>Personne</legend>
        <div className="form-two"><div className="field"><label htmlFor="cf-first">Prénom</label><input id="cf-first" name="first_name" defaultValue={first} autoComplete="off" autoFocus={!c} /></div>
          <div className="field"><label htmlFor="cf-last">Nom</label><input id="cf-last" name="last_name" defaultValue={last} autoComplete="off" /></div></div>
        <div className="form-two"><div className="field"><label htmlFor="cf-company">Société</label><input id="cf-company" name="company" defaultValue={c?.company ?? ''} /></div>
          <div className="field"><label htmlFor="cf-role">Fonction</label><input id="cf-role" name="role" defaultValue={c?.role ?? ''} placeholder="Fondateur, directrice financière…" /></div></div>
      </fieldset>

      <fieldset><legend>Le joindre</legend>
        <div className="form-two"><div className="field"><label htmlFor="cf-email">Email</label><input id="cf-email" name="email" type="email" defaultValue={c?.email ?? ''} /></div>
          <div className="field"><label htmlFor="cf-phone">Téléphone</label><input id="cf-phone" name="phone" type="tel" defaultValue={c?.phone ?? ''} placeholder="+971 50 …" /></div></div>
        <label className="admin-check"><input type="checkbox" name="whatsapp" defaultChecked={c?.whatsapp ?? false} /> Joignable sur WhatsApp à ce numéro</label>
        <div className="form-two"><div className="field"><label htmlFor="cf-linkedin">LinkedIn</label><input id="cf-linkedin" name="linkedin" defaultValue={c?.linkedin ?? ''} placeholder="linkedin.com/in/…" /></div>
          <div className="field"><label htmlFor="cf-website">Site web</label><input id="cf-website" name="website" defaultValue={c?.website ?? ''} /></div></div>
        <div className="form-two"><div className="field"><label htmlFor="cf-lang">Langue</label><select id="cf-lang" name="lang" defaultValue={c?.lang ?? ''}><option value="">—</option><option value="fr">Français</option><option value="en">English</option><option value="ru">Русский</option></select></div>
          <div className="field"><label htmlFor="cf-tz">Fuseau horaire</label><input id="cf-tz" name="timezone" list="cf-zones" defaultValue={c?.timezone ?? ''} placeholder="Asia/Dubai" /></div></div>
      </fieldset>

      <fieldset><legend>Où il vit</legend>
        <div className="form-two"><div className="field"><label htmlFor="cf-country">Pays de résidence</label><input id="cf-country" name="country" list="cf-countries" defaultValue={c?.country ?? ''} /></div>
          <div className="field"><label htmlFor="cf-city">Ville</label><input id="cf-city" name="city" defaultValue={c?.city ?? ''} /></div></div>
        <div className="field"><label htmlFor="cf-address">Adresse</label><input id="cf-address" name="address_line" defaultValue={c?.address_line ?? ''} /></div>
        <div className="form-two"><div className="field"><label htmlFor="cf-postal">Code postal</label><input id="cf-postal" name="postal_code" defaultValue={c?.postal_code ?? ''} /></div>
          <div className="field"><label htmlFor="cf-nat">Nationalité</label><input id="cf-nat" name="nationality" list="cf-countries" defaultValue={c?.nationality ?? ''} /></div></div>
      </fieldset>

      <fieldset><legend>Son projet</legend>
        <div className="field"><span className="field-label">Destinations</span><Chips name="Destinations" options={destinationLabel} value={destinations} onChange={setDestinations} /></div>
        <div className="field"><span className="field-label">Besoins</span><Chips name="Besoins" options={serviceLabel} value={services} onChange={setServices} /></div>
        <div className="field"><span className="field-label">Où en est-on</span><div className="stage-track" role="radiogroup" aria-label="Étape">{(Object.keys(stageLabel) as Stage[]).map(k =>
          <button key={k} type="button" role="radio" aria-checked={stage === k} className={`is-${k}`} onClick={() => setStage(k)}>{stageLabel[k]}</button>)}</div></div>
        <div className="form-two"><div className="field"><label htmlFor="cf-budget">Budget</label><input id="cf-budget" name="budget" defaultValue={c?.budget ?? ''} placeholder="ex. 15 000 USD, bien à 2 M AED" /></div>
          <div className="field"><label htmlFor="cf-status">Statut</label><select id="cf-status" name="status" defaultValue={c?.status ?? 'lead'}><option value="lead">Prospect</option><option value="client">Client</option><option value="archived">Archivé</option></select></div></div>
        <div className="form-two"><div className="field"><label htmlFor="cf-source">Source</label><input id="cf-source" name="source" list="cf-sources" defaultValue={c?.source && c.source !== 'admin' ? c.source : ''} /></div>
          <div className="field"><label htmlFor="cf-ref">Recommandé par</label><input id="cf-ref" name="referred_by" defaultValue={c?.referred_by ?? ''} /></div></div>
        <div className="field"><label htmlFor="cf-tags">Étiquettes (séparées par des virgules)</label><input id="cf-tags" name="tags" defaultValue={(c?.tags ?? []).join(', ')} placeholder="vip, famille, urgent" /></div>
      </fieldset>

      <fieldset><legend>Suite</legend>
        <div className="form-two"><div className="field"><label htmlFor="cf-next">Prochaine action</label><input id="cf-next" name="next_action" defaultValue={c?.next_action ?? ''} placeholder="Envoyer le devis RAKEZ" /></div>
          <div className="field"><label htmlFor="cf-next-on">Pour le</label><input id="cf-next-on" name="next_action_on" type="date" defaultValue={c?.next_action_on ?? ''} /></div></div>
        {!c && <div className="field"><label htmlFor="cf-note">Première note</label><textarea id="cf-note" name="note" rows={3} placeholder="Comment vous vous êtes connus, ce qu’il cherche…" maxLength={5000} /></div>}
        {c && <label className="admin-check"><input type="checkbox" name="needs_review" defaultChecked={c.needs_review} /> Fiche à vérifier (doublon possible)</label>}
      </fieldset>

      <datalist id="cf-countries">{COUNTRIES.map(x => <option key={x} value={x} />)}</datalist>
      <datalist id="cf-zones">{ZONES.map(x => <option key={x} value={x} />)}</datalist>
      <datalist id="cf-sources">{SOURCES.map(x => <option key={x} value={x} />)}</datalist>
      {error && <p role="alert" className="booking-error">{error}</p>}
      <div className="form-actions"><Button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : c ? 'Enregistrer' : 'Créer le contact'}</Button><Button type="button" variant="ghost" onClick={onClose}>Annuler</Button></div>
    </form>
  </div>;
}
