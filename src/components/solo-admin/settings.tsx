import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminRpc, errorLabel, modeLabel, placeKindLabel, type ApptType, type Catalog, type Hours, type Place, type Staff } from '@/lib/solo-admin';

type View = 'places' | 'types' | 'general';
const LANGS = [['fr', 'Français'], ['en', 'English'], ['ru', 'Русский']] as const;

export function SettingsPanel({ staff }: { staff: Staff }) {
  const [view, setView] = useState<View>('places');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => { adminRpc<Catalog>('solo_admin_catalog').then(setCatalog).catch(e => setError(errorLabel(e.message))); }, []);
  useEffect(load, [load]);
  return <>
    <div className="admin-subtabs" role="tablist">{([['places', 'Lieux'], ['types', 'Types de rendez-vous'], ['general', 'Général']] as [View, string][]).map(([k, l]) =>
      <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}>{l}</button>)}</div>
    {error && <p role="alert" className="booking-error">{error}</p>}
    {!catalog ? <p className="booking-muted">Chargement…</p> : <>
      {view === 'places' && <Places places={catalog.locations} onSaved={load} />}
      {view === 'types' && <Types catalog={catalog} onSaved={load} />}
      {view === 'general' && <General staff={staff} />}
    </>}
  </>;
}

function Places({ places, onSaved }: { places: Place[]; onSaved: () => void }) {
  const [edit, setEdit] = useState<Partial<Place> | null>(null);
  const [error, setError] = useState('');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await adminRpc('solo_admin_location_save', { p: { ...f, id: edit?.id ?? '', active: f['active'] === 'on' } }); setEdit(null); onSaved(); }
    catch (e) { setError(errorLabel((e as Error).message)); }
  }
  if (edit) return <form className="contact-form admin-panel" onSubmit={save}>
    <h2>{edit.id ? 'Modifier le lieu' : 'Nouveau lieu'}</h2>
    <div className="form-two"><div className="field"><label htmlFor="p-name">Nom *</label><input id="p-name" name="name" required maxLength={120} defaultValue={edit.name ?? ''} placeholder="Cabinet Me X, Bank of Georgia…" /></div>
      <div className="field"><label htmlFor="p-kind">Type</label><select id="p-kind" name="kind" defaultValue={edit.kind ?? 'partner'}>{(Object.keys(placeKindLabel) as Place['kind'][]).map(k => <option key={k} value={k}>{placeKindLabel[k]}</option>)}</select></div></div>
    <div className="field"><label htmlFor="p-address">Adresse</label><input id="p-address" name="address" defaultValue={edit.address ?? ''} /></div>
    <div className="form-two"><div className="field"><label htmlFor="p-city">Ville</label><input id="p-city" name="city" defaultValue={edit.city ?? ''} /></div><div className="field"><label htmlFor="p-country">Pays</label><input id="p-country" name="country" defaultValue={edit.country ?? ''} /></div></div>
    <div className="field"><label htmlFor="p-maps">Lien Google Maps</label><input id="p-maps" name="maps_url" type="url" placeholder="https://" defaultValue={edit.maps_url ?? ''} /></div>
    <div className="field"><label htmlFor="p-client">Note pour le client</label><textarea id="p-client" name="client_note" defaultValue={edit.client_note ?? ''} placeholder="Accès, parking, documents à apporter…" /></div>
    <div className="field"><label htmlFor="p-notes">Note interne</label><textarea id="p-notes" name="notes" defaultValue={edit.notes ?? ''} placeholder="Contact sur place, horaires…" /></div>
    <label className="admin-check"><input type="checkbox" name="active" defaultChecked={edit.active ?? true} /> Lieu actif</label>
    {error && <p role="alert" className="booking-error">{error}</p>}
    <div className="form-actions"><Button type="submit">Enregistrer</Button><Button type="button" variant="ghost" onClick={() => setEdit(null)}>Annuler</Button></div>
  </form>;
  return <>
    <p className="booking-muted">Bureau, partenaires (avocat, notaire, banque, free zone), biens à visiter : l’adresse d’un lieu est reprise sur le rendez-vous et envoyée au client.</p>
    <Button size="sm" onClick={() => setEdit({})}><Plus /> Nouveau lieu</Button>
    <div className="admin-list admin-gap">{places.map(p => <button type="button" key={p.id} className="admin-row admin-row-button" onClick={() => setEdit(p)}>
      <span><strong>{p.name}</strong><br /><small>{[p.address, p.city, p.country].filter(Boolean).join(', ') || 'Adresse à compléter'}</small></span>
      <span className="admin-row-meta"><span className="status-pill">{placeKindLabel[p.kind]}</span>{!p.active && <small>inactif</small>}</span></button>)}</div>
  </>;
}

function Types({ catalog, onSaved }: { catalog: Catalog; onSaved: () => void }) {
  const [edit, setEdit] = useState<Partial<ApptType> | null>(null);
  const [mode, setMode] = useState<ApptType['mode']>('video');
  const [policy, setPolicy] = useState<ApptType['location_policy']>('fixed');
  const [error, setError] = useState('');
  const open = (t: Partial<ApptType>) => { setEdit(t); setMode(t.mode ?? 'video'); setPolicy(t.location_policy ?? 'fixed'); setError(''); };
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget); const get = (k: string) => String(f.get(k) ?? '').trim();
    const title = Object.fromEntries(LANGS.map(([l]) => [l, get(`title_${l}`)]).filter(([, v]) => v));
    const description = Object.fromEntries(LANGS.map(([l]) => [l, get(`desc_${l}`)]).filter(([, v]) => v));
    try {
      await adminRpc('solo_admin_type_save', { p: {
        id: edit?.id ?? '', slug: get('slug'), title, description, mode, location_policy: mode === 'in_person' ? policy : 'fixed',
        location_id: mode === 'in_person' && policy === 'fixed' ? get('location_id') : '', duration_min: Number(get('duration_min')), buffer_min: Number(get('buffer_min')),
        min_notice_hours: Number(get('min_notice_hours')), max_days_ahead: Number(get('max_days_ahead')), price_amount: Number(get('price_amount') || 0),
        currency: get('currency').toUpperCase() || 'USD', requires_approval: f.get('requires_approval') === 'on', public: f.get('public') === 'on',
        active: f.get('active') === 'on', sort: Number(get('sort') || 100),
      } });
      setEdit(null); onSaved();
    } catch (e) { setError(errorLabel((e as Error).message)); }
  }
  if (edit) return <form className="contact-form admin-panel" onSubmit={save}>
    <h2>{edit.id ? 'Modifier le type' : 'Nouveau type de rendez-vous'}</h2>
    {LANGS.map(([l, label]) => <div key={l} className="form-two"><div className="field"><label htmlFor={`t-title-${l}`}>Titre · {label}{l === 'fr' ? ' *' : ''}</label><input id={`t-title-${l}`} name={`title_${l}`} required={l === 'fr'} defaultValue={edit.title?.[l] ?? ''} /></div>
      <div className="field"><label htmlFor={`t-desc-${l}`}>Description · {label}</label><input id={`t-desc-${l}`} name={`desc_${l}`} defaultValue={edit.description?.[l] ?? ''} /></div></div>)}
    <div className="form-three"><div className="field"><label htmlFor="t-slug">Identifiant (URL)</label><input id="t-slug" name="slug" required pattern="[a-z0-9-]{2,40}" defaultValue={edit.slug ?? ''} placeholder="visite-notaire" /></div>
      <div className="field"><label htmlFor="t-mode">Format</label><select id="t-mode" value={mode} onChange={e => setMode(e.target.value as ApptType['mode'])}>{(Object.keys(modeLabel) as ApptType['mode'][]).map(m => <option key={m} value={m}>{modeLabel[m]}</option>)}</select></div>
      {mode === 'in_person' && <div className="field"><label htmlFor="t-policy">Lieu</label><select id="t-policy" value={policy} onChange={e => setPolicy(e.target.value as ApptType['location_policy'])}><option value="fixed">Toujours le même lieu</option><option value="to_define">Défini à chaque rendez-vous</option></select></div>}</div>
    {mode === 'in_person' && policy === 'fixed' && <div className="field"><label htmlFor="t-loc">Lieu habituel</label><select id="t-loc" name="location_id" required defaultValue={edit.location_id ?? ''}><option value="">Choisir</option>{catalog.locations.filter(l => l.active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>}
    <div className="form-three"><div className="field"><label htmlFor="t-dur">Durée (min)</label><input id="t-dur" name="duration_min" type="number" min={10} max={480} step={5} required defaultValue={edit.duration_min ?? 30} /></div>
      <div className="field"><label htmlFor="t-buf">Battement après (min)</label><input id="t-buf" name="buffer_min" type="number" min={0} max={240} step={5} defaultValue={edit.buffer_min ?? 15} /></div>
      <div className="field"><label htmlFor="t-sort">Ordre</label><input id="t-sort" name="sort" type="number" defaultValue={edit.sort ?? 100} /></div></div>
    <div className="form-three"><div className="field"><label htmlFor="t-notice">Délai minimum (h)</label><input id="t-notice" name="min_notice_hours" type="number" min={0} max={720} defaultValue={edit.min_notice_hours ?? 12} /></div>
      <div className="field"><label htmlFor="t-ahead">Réservable jusqu’à (jours)</label><input id="t-ahead" name="max_days_ahead" type="number" min={1} max={365} defaultValue={edit.max_days_ahead ?? 60} /></div>
      <div className="field"><label htmlFor="t-price">Prix</label><div className="admin-inline"><input id="t-price" name="price_amount" type="number" min={0} step="0.01" defaultValue={edit.price_amount ?? 0} /><input name="currency" aria-label="Devise" maxLength={3} defaultValue={edit.currency ?? 'USD'} /></div></div></div>
    <label className="admin-check"><input type="checkbox" name="public" defaultChecked={edit.public ?? false} /> Réservable sur le site</label>
    <label className="admin-check"><input type="checkbox" name="requires_approval" defaultChecked={edit.requires_approval ?? false} /> À confirmer par Darya (toujours le cas si un prix est indiqué)</label>
    <label className="admin-check"><input type="checkbox" name="active" defaultChecked={edit.active ?? true} /> Actif</label>
    {error && <p role="alert" className="booking-error">{error}</p>}
    <div className="form-actions"><Button type="submit">Enregistrer</Button><Button type="button" variant="ghost" onClick={() => setEdit(null)}>Annuler</Button></div>
  </form>;
  return <>
    <p className="booking-muted">Les types « réservables sur le site » apparaissent sur la page Rendez-vous. Les autres servent aux rendez-vous que vous planifiez vous-même.</p>
    <Button size="sm" onClick={() => open({})}><Plus /> Nouveau type</Button>
    <div className="admin-list admin-gap">{catalog.types.map(t => <button type="button" key={t.id} className="admin-row admin-row-button" onClick={() => open(t)}>
      <span><strong>{t.title['fr']}</strong><br /><small>{modeLabel[t.mode]} · {t.duration_min} min{t.price_amount > 0 ? ` · ${t.price_amount} ${t.currency}` : ''}{t.location_policy === 'to_define' ? ' · lieu à définir' : ''}</small></span>
      <span className="admin-row-meta">{t.public && <span className="status-pill is-confirmed">Sur le site</span>}{!t.active && <small>inactif</small>}</span></button>)}</div>
  </>;
}

function General({ staff }: { staff: Staff }) {
  const [hours, setHours] = useState<Hours | null>(null);
  const [state, setState] = useState('');
  useEffect(() => { adminRpc<Hours>('solo_admin_hours').then(setHours).catch(e => setState(errorLabel(e.message))); }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await adminRpc('solo_admin_settings_set', { p: { ...f, slot_step_min: Number(f['slot_step_min']) } }); setState('Réglages enregistrés. Rechargez la page si vous avez changé de fuseau.'); }
    catch (e) { setState(errorLabel((e as Error).message)); }
  }
  if (!hours) return <p className="booking-muted">{state || 'Chargement…'}</p>;
  return <form className="contact-form admin-panel" onSubmit={save}>
    <div className="form-two"><div className="field"><label htmlFor="g-tz">Fuseau horaire de l’agenda</label><select id="g-tz" name="timezone" defaultValue={hours.settings.timezone}>{['Asia/Dubai', 'Asia/Tbilisi', 'Europe/Paris', 'Europe/Moscow'].map(z => <option key={z} value={z}>{z}</option>)}</select></div>
      <div className="field"><label htmlFor="g-step">Pas des créneaux</label><select id="g-step" name="slot_step_min" defaultValue={String(hours.settings.slot_step_min)}>{[15, 20, 30, 45, 60].map(s => <option key={s} value={s}>{s} min</option>)}</select></div></div>
    <div className="field"><label htmlFor="g-notify">Email des notifications</label><input id="g-notify" name="notify_email" type="email" defaultValue={hours.settings.notify_email ?? staff.email} /></div>
    <Button type="submit">Enregistrer</Button>
    {state && <p role="status" className="booking-muted">{state}</p>}
  </form>;
}
