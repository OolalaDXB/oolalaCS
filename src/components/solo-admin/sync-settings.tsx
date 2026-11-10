import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { adminRpc, errorLabel, shortDateTime, type CalendarSync, type NewsSource, type Staff } from '@/lib/solo-admin';

const FUNCTIONS = `${String(import.meta.env['VITE_SUPABASE_URL'] ?? '').replace(/\/+$/, '')}/functions/v1`;

async function copy(text: string) { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }

/* ---------- calendar: the feed out, other calendars in ---------- */
export function CalendarSyncPanel({ staff }: { staff: Staff }) {
  const [state, setState] = useState<CalendarSync | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const load = useCallback(() => { adminRpc<CalendarSync>('solo_admin_calendar_feed').then(setState).catch(e => setMessage(errorLabel(e.message))); }, []);
  useEffect(load, [load]);
  async function issue() {
    setMessage('');
    try { const token = await adminRpc<string>('solo_admin_calendar_feed_issue'); setLink(`${FUNCTIONS}/solo-calendar?t=${token}`); load(); }
    catch (e) { setMessage(errorLabel((e as Error).message)); }
  }
  async function revoke() { try { await adminRpc('solo_admin_calendar_feed_revoke'); setLink(null); load(); setMessage('Lien désactivé : les agendas abonnés ne reçoivent plus rien.'); } catch (e) { setMessage(errorLabel((e as Error).message)); } }
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget; const f = new FormData(form);
    try { await adminRpc('solo_admin_calendar_add', { p_label: String(f.get('label') ?? ''), p_url: String(f.get('url') ?? '') }); form.reset(); load(); setMessage('Agenda ajouté : ses créneaux occupés seront lus dans le quart d’heure.'); }
    catch (e) { setMessage(errorLabel((e as Error).message)); }
  }
  async function toggle(id: string, active: boolean) { try { await adminRpc('solo_admin_calendar_set', { p_id: id, p_active: active }); load(); } catch (e) { setMessage(errorLabel((e as Error).message)); } }
  if (!state) return <p className="booking-muted">{message || 'Chargement…'}</p>;

  return <div className="sync-grid">
    <section className="admin-panel sync-card">
      <h2>Vos rendez-vous Oolala dans votre agenda</h2>
      <p className="booking-muted">Un lien privé que Proton, Google ou Apple lisent tout seuls, toutes les 15 minutes environ. Les rendez-vous à confirmer y apparaissent comme « provisoires ». En lecture seule : on les modifie ici.</p>
      {link ? <>
        <div className="sync-link"><code>{link}</code><Button size="sm" type="button" onClick={async () => setMessage(await copy(link) ? 'Lien copié.' : 'Copiez le lien à la main.')}>Copier</Button></div>
        <p className="booking-muted">Ce lien ne sera plus affiché : copiez-le maintenant. Il donne accès à vos rendez-vous, ne le partagez pas.</p>
        <ul className="sync-howto">
          <li><strong>Proton Calendar</strong> : Paramètres → Calendriers → Ajouter un calendrier → « Depuis une URL », collez le lien.</li>
          <li><strong>Google Agenda</strong> (ordinateur) : Autres agendas → + → « À partir de l’URL », collez le lien.</li>
          <li><strong>iPhone, Mac</strong> : <a href={link.replace(/^https:/, 'webcal:')}>ouvrir dans Calendrier</a>, puis « S’abonner ».</li>
        </ul>
      </> : state.feed ? <p>Lien actif, créé le {shortDateTime(state.feed.created_at, staff.timezone)}{state.feed.last_fetched_at ? ` · lu ${state.feed.fetches} fois, dernière fois le ${shortDateTime(state.feed.last_fetched_at, staff.timezone)}` : ' · pas encore lu par un agenda'}.</p>
        : <p>Aucun lien pour l’instant.</p>}
      <div className="admin-actions"><Button size="sm" type="button" onClick={issue}>{state.feed ? 'Créer un nouveau lien' : 'Créer le lien'}</Button>{state.feed && <Button size="sm" variant="ghost" type="button" onClick={revoke}>Désactiver</Button>}</div>
      {state.feed && !link && <p className="booking-muted">Un nouveau lien remplace l’ancien : il faudra le recoller dans vos agendas.</p>}
    </section>

    <section className="admin-panel sync-card">
      <h2>Vos autres agendas bloquent les créneaux</h2>
      <p className="booking-muted">Collez l’adresse iCal secrète de votre agenda : ses moments occupés sont lus toutes les 15 minutes et ne sont plus proposés sur le site. Rien n’est écrit dans votre agenda.</p>
      <ul className="sync-howto">
        <li><strong>Proton</strong> : Paramètres → Calendriers → votre agenda → Partager → « Partager avec n’importe qui » → lien « Accès complet », copiez-le.</li>
        <li><strong>Google</strong> : Paramètres de l’agenda → Intégrer l’agenda → « Adresse secrète au format iCal ».</li>
      </ul>
      {state.calendars.length > 0 && <div className="admin-list">{state.calendars.map(c => <div key={c.id} className="admin-row">
        <span><strong>{c.label}</strong> <small>{c.host}</small><br /><small>{c.last_error ? `Erreur : ${c.last_error}` : c.last_ok_at ? `${c.events} moment(s) occupé(s) à venir · lu le ${shortDateTime(c.last_ok_at, staff.timezone)}` : 'Pas encore lu'}</small></span>
        <span className="admin-row-meta"><Button size="sm" variant="ghost" type="button" onClick={() => toggle(c.id, !c.active)}>{c.active ? 'Mettre en pause' : 'Réactiver'}</Button></span>
      </div>)}</div>}
      <form className="contact-form sync-add" onSubmit={add}>
        <div className="form-two"><div className="field"><label htmlFor="cal-label">Nom</label><input id="cal-label" name="label" placeholder="Proton perso" required /></div>
          <div className="field"><label htmlFor="cal-url">Adresse iCal secrète</label><input id="cal-url" name="url" required placeholder="https://calendar.proton.me/api/calendar/v1/url/…" autoComplete="off" /></div></div>
        <div className="form-actions"><Button type="submit" size="sm">Ajouter l’agenda</Button></div>
      </form>
    </section>
    {message && <p role="status" className="booking-muted">{message}</p>}
  </div>;
}

/* ---------- news sources ---------- */
export function NewsSourcesPanel({ staff }: { staff: Staff }) {
  const [list, setList] = useState<NewsSource[] | null>(null);
  const [message, setMessage] = useState('');
  const load = useCallback(() => { adminRpc<NewsSource[]>('solo_admin_news_sources').then(setList).catch(e => setMessage(errorLabel(e.message))); }, []);
  useEffect(load, [load]);
  async function save(p: Partial<NewsSource>) { try { await adminRpc('solo_admin_news_source_save', { p }); load(); return true; } catch (e) { setMessage(errorLabel((e as Error).message)); return false; } }
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget; const f = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    if (await save({ region: f['region'] as NewsSource['region'], name: f['name'] ?? '', url: f['url'] ?? '' })) { form.reset(); setMessage('Source ajoutée : elle sera lue dans la demi-heure.'); }
  }
  if (!list) return <p className="booking-muted">{message || 'Chargement…'}</p>;
  return <section className="admin-panel">
    <p className="booking-muted">Les flux RSS lus toutes les deux heures pour la zone Actualités. Une recherche Google Actualités fait une bonne source : news.google.com/rss/search?q=…</p>
    {(['ae', 'fr'] as const).map(r => <div key={r} className="admin-section"><h2>{r === 'ae' ? 'Émirats' : 'France'}</h2>
      <div className="admin-list">{list.filter(s => s.region === r).map(s => <div key={s.id} className="admin-row">
        <span><strong>{s.name}</strong>{!s.active && <span className="status-pill is-cancelled"> en pause</span>}<br />
          <small className={s.last_error ? 'booking-error' : ''}>{s.last_error ? `Erreur : ${s.last_error}` : s.last_ok_at ? `Lue le ${shortDateTime(s.last_ok_at, staff.timezone)}` : 'Pas encore lue'}</small></span>
        <span className="admin-row-meta"><Button size="sm" variant="ghost" type="button" onClick={() => save({ ...s, active: !s.active })}>{s.active ? 'Pause' : 'Reprendre'}</Button></span>
      </div>)}</div></div>)}
    <form className="contact-form admin-section" onSubmit={add}>
      <h2>Ajouter une source</h2>
      <div className="form-three"><div className="field"><label htmlFor="ns-region">Zone</label><select id="ns-region" name="region"><option value="ae">Émirats</option><option value="fr">France</option></select></div>
        <div className="field"><label htmlFor="ns-name">Nom</label><input id="ns-name" name="name" required /></div>
        <div className="field"><label htmlFor="ns-url">Adresse du flux</label><input id="ns-url" name="url" type="url" required placeholder="https://…" /></div></div>
      <div className="form-actions"><Button type="submit" size="sm">Ajouter</Button></div>
    </form>
    {message && <p role="status" className="booking-muted">{message}</p>}
  </section>;
}
