import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, Inbox, LogOut, Plus, Settings2, Sun, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
const logo = { url: '/images/oolala-cs-horizontal-dark.svg' };
import { adminRpc, can, type Booking, type Overview, type Staff } from '@/lib/solo-admin';
import { BookingCard, BookingEditor, type EditorSeed } from './booking-editor';
import { Agenda } from './agenda';
import { Clients, Enquiries } from './crm';
import { SettingsPanel } from './settings';

type Tab = 'today' | 'agenda' | 'enquiries' | 'clients' | 'settings';
const tabs: { key: Tab; label: string; icon: typeof Sun; permission: string }[] = [
  { key: 'today', label: 'Aujourd’hui', icon: Sun, permission: '' },
  { key: 'agenda', label: 'Agenda', icon: CalendarDays, permission: 'solo:agenda' },
  { key: 'enquiries', label: 'Demandes', icon: Inbox, permission: 'solo:crm' },
  { key: 'clients', label: 'Clients', icon: Users, permission: 'solo:crm' },
  { key: 'settings', label: 'Réglages', icon: Settings2, permission: 'solo:settings' },
];

export function AdminApp() {
  const [session, setSession] = useState<'loading' | 'out' | 'in'>('loading');
  const [staff, setStaff] = useState<Staff | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ? 'in' : 'out'));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ? 'in' : 'out'));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session !== 'in') { setStaff(undefined); return; }
    adminRpc<Staff | null>('solo_admin_me').then(setStaff).catch(() => setStaff(null));
  }, [session]);

  if (session === 'loading' || (session === 'in' && staff === undefined)) return <div className="admin-center"><p className="booking-muted">Chargement…</p></div>;
  if (session === 'out') return <SignIn />;
  if (!staff) return <div className="admin-center"><img className="admin-logo" src={logo.url} alt="Oolala" /><p>Ce compte n’a pas accès au back-office.</p><Button variant="ghost" onClick={() => supabase.auth.signOut()}><LogOut /> Se déconnecter</Button></div>;
  return <Shell staff={staff} />;
}

function SignIn() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [reason, setReason] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim().toLowerCase();
    setState('sending');
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/admin` } });
    setReason(error ? signInError(error) : '');
    setState(error ? 'error' : 'sent');
  }
  return <div className="admin-center">
    <img className="admin-logo" src={logo.url} alt="Oolala Corporate Services" />
    <h1 className="section-title">Back-office</h1>
    {state === 'sent' ? <p className="page-lead">Un lien de connexion vient d’être envoyé. Ouvrez-le depuis cet appareil.</p> : <form className="contact-form admin-signin" onSubmit={submit}>
      <div className="field"><label htmlFor="admin-email">Email</label><input id="admin-email" name="email" type="email" autoComplete="email" required /></div>
      <Button type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Envoi…' : 'Recevoir un lien de connexion'}</Button>
      {state === 'error' && <p role="alert" className="booking-error">{reason}</p>}
    </form>}
  </div>;
}

// Supabase Auth answers 422 or 400 for an unknown address (no sign-up here),
// 429 when the email limit is reached and 500 when its mail server fails.
function signInError(error: { status?: number | undefined; message: string }) {
  if (error.status === 429) return 'Trop de demandes de lien. Réessayez dans quelques minutes.';
  if (error.status === 422 || error.status === 400 || /signups not allowed/i.test(error.message)) return 'Cette adresse n’a pas de compte. Seuls les comptes créés pour l’équipe peuvent se connecter.';
  if (!error.status || error.status >= 500) return 'Le lien n’a pas pu être envoyé : le service d’email ne répond pas (réglage SMTP de Supabase). Réessayez plus tard.';
  return `Envoi impossible : ${error.message}`;
}

function Shell({ staff }: { staff: Staff }) {
  const visible = tabs.filter(t => !t.permission || can(staff, t.permission));
  const initial = (typeof window !== 'undefined' && (window.location.hash.slice(1) as Tab)) || 'today';
  const [tab, setTab] = useState<Tab>(visible.some(t => t.key === initial) ? initial : 'today');
  const [editor, setEditor] = useState<EditorSeed | null>(null);
  const [refresh, setRefresh] = useState(0);
  const go = (key: Tab) => { setTab(key); history.replaceState(null, '', `#${key}`); window.scrollTo({ top: 0 }); };
  const saved = () => { setEditor(null); setRefresh(r => r + 1); };
  const current = visible.find(t => t.key === tab) ?? visible[0] ?? tabs[0]!;

  return <div className="admin">
    <header className="admin-top">
      <img className="admin-logo" src={logo.url} alt="Oolala" />
      <nav className="admin-tabs" aria-label="Back-office">{visible.map(t => <button key={t.key} type="button" aria-current={t.key === tab ? 'page' : undefined} onClick={() => go(t.key)}><t.icon size={18} aria-hidden="true" /><span>{t.label}</span></button>)}</nav>
      <div className="admin-account"><span>{staff.name}</span><Button variant="ghost" size="icon" aria-label="Se déconnecter" onClick={() => supabase.auth.signOut()}><LogOut /></Button></div>
    </header>
    <main className="admin-main">
      <div className="admin-heading"><h1>{current.label}</h1>{can(staff, 'solo:agenda') && <Button size="sm" onClick={() => setEditor({})}><Plus /> Rendez-vous</Button>}</div>
      {tab === 'today' && <Today staff={staff} refresh={refresh} onEdit={setEditor} onChanged={saved} go={go} />}
      {tab === 'agenda' && <Agenda staff={staff} refresh={refresh} onEdit={setEditor} onChanged={saved} />}
      {tab === 'enquiries' && <Enquiries staff={staff} onPlan={seed => setEditor(seed)} />}
      {tab === 'clients' && <Clients staff={staff} refresh={refresh} onPlan={seed => setEditor(seed)} onEdit={setEditor} onChanged={saved} />}
      {tab === 'settings' && <SettingsPanel staff={staff} />}
    </main>
    {editor && <BookingEditor staff={staff} seed={editor} onClose={() => setEditor(null)} onSaved={saved} />}
  </div>;
}

function Today({ staff, refresh, onEdit, onChanged, go }: { staff: Staff; refresh: number; onEdit: (seed: EditorSeed) => void; onChanged: () => void; go: (tab: Tab) => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => { adminRpc<Overview>('solo_admin_overview').then(setData).catch(e => setError(String(e.message))); }, []);
  useEffect(load, [load, refresh]);
  if (error) return <p className="booking-error">{error}</p>;
  if (!data) return <p className="booking-muted">Chargement…</p>;
  return <>
    <div className="admin-stats">
      {data.pending !== null && <button type="button" onClick={() => go('agenda')}><strong>{data.pending}</strong><span>à confirmer</span></button>}
      {data.new_enquiries !== null && <button type="button" onClick={() => go('enquiries')}><strong>{data.new_enquiries}</strong><span>nouvelles demandes</span></button>}
      {data.needs_review !== null && data.needs_review > 0 && <button type="button" onClick={() => go('clients')}><strong>{data.needs_review}</strong><span>fiches à vérifier</span></button>}
    </div>
    {data.upcoming && <section className="admin-section"><h2>Prochains rendez-vous</h2>
      {data.upcoming.length === 0 ? <p className="booking-muted">Aucun rendez-vous à venir.</p> : <div className="admin-list">{data.upcoming.map((b: Booking) => <BookingCard key={b.id} booking={b} timeZone={staff.timezone} onEdit={() => onEdit({ booking: b })} onChanged={onChanged} />)}</div>}
    </section>}
  </>;
}
