import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Copy, FileText, Link2, Mail, MessageCircle, Plus, Printer, Send, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvoiceDocument } from '@/components/invoice-document';
import { adminRpc, errorLabel, type Contact, type Staff } from '@/lib/solo-admin';
import { CURRENCIES, day, fromMinor, methodLabel, money, stateLabel, toMinor, type Client, type InvoiceDoc, type InvoiceState, type Party } from '@/lib/invoice';

// Invoices and payment links: drafts, issue (number + frozen parties), the
// private link to send, payments recorded by hand or arriving by card.
type Row = { id: string; number: string | null; state: InvoiceState; client: Client; crm_contact_id: string | null; currency: string; total: number; paid: number; issue_date: string | null; due_date: string | null; label: string | null };
type List = { items: Row[]; totals: { currency: string; due: number | null; overdue: number | null; paid_30d: number }[]; drafts: number };
type Full = InvoiceDoc & { id: string; crm_contact_id: string | null; has_link: boolean; cancel_reason: string | null; issued_by: string | null;
  all_payments: { id: string; amount: number; method: string; reference: string | null; paid_at: string; recorded_by: string | null; voided_at: string | null; provider_ref?: string }[] };
type EditLine = { label: string; quantity: string; unit: string; vat: string };
type Link = { number: string; token: string; lang: string };
export type InvoiceContact = { id: string; name: string | null; email: string | null; phone: string | null; company?: string | null };
export type InvoiceSeed = { contact?: InvoiceContact | undefined; quick?: boolean; invoice?: Full | undefined };

const FILTERS: [string, string][] = [['open', 'À encaisser'], ['overdue', 'En retard'], ['draft', 'Brouillons'], ['paid', 'Payées'], ['', 'Toutes']];
const payUrl = (l: Link) => `${window.location.origin}${l.lang === 'fr' ? '' : `/${l.lang}`}/payer?n=${encodeURIComponent(l.number)}&t=${l.token}`;
const errors: Record<string, string> = {
  missing_profile: 'Renseignez d’abord la raison sociale dans Réglages → Facturation.', missing_trn: 'Une facture avec TVA doit porter votre TRN : Réglages → Facturation.',
  missing_client: 'Indiquez le client.', empty_invoice: 'Ajoutez au moins une ligne avec un montant.', invalid_line: 'Une ligne a une quantité ou un taux de TVA invalide.',
  not_editable: 'Une facture émise ne se modifie plus : annulez-la et refaites-la.', has_payments: 'Cette facture a déjà reçu un paiement : elle ne peut plus être annulée.',
  invalid_amount: 'Montant invalide.', not_issued: 'La facture doit d’abord être émise.' };
const err = (e: unknown) => errors[(e as Error).message] ?? errorLabel((e as Error).message);

function printInvoice() {
  document.body.dataset['print'] = 'invoice';
  const done = () => { delete document.body.dataset['print']; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}

/* ---------- the editor: a draft, or a quick payment link ---------- */
export function InvoiceEditor({ seed, onClose, onSaved }: { seed: InvoiceSeed; onClose: () => void; onSaved: (id: string) => void }) {
  const inv = seed.invoice; const quick = !!seed.quick;
  const [profile, setProfile] = useState<Party | null>(null);
  const [contact, setContact] = useState<InvoiceContact | undefined>(seed.contact ?? (inv?.crm_contact_id ? { id: inv.crm_contact_id, name: inv.client.name ?? null, email: inv.client.email ?? null, phone: inv.client.phone ?? null } : undefined));
  const [search, setSearch] = useState(''); const [found, setFound] = useState<Contact[]>([]);
  const [client, setClient] = useState<Client>(inv?.client ?? {});
  const [currency, setCurrency] = useState(inv?.currency ?? '');
  const [lines, setLines] = useState<EditLine[]>(inv ? inv.lines.map(l => ({ label: l.label, quantity: String(Number(l.quantity)), unit: fromMinor(l.unit_amount), vat: String(Number(l.vat_rate)) })) : [{ label: '', quantity: '1', unit: '', vat: '' }]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const issueRef = useRef(quick);
  useEffect(() => { adminRpc<Party>('solo_admin_billing_profile').then(p => { setProfile(p); setCurrency(c => c || p.default_currency || 'USD'); setLines(ls => ls.map(l => l.vat === '' ? { ...l, vat: String(p.vat_rate ?? 0) } : l)); }).catch(e => setError(err(e))); }, []);
  useEffect(() => {
    if (search.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(() => adminRpc<Contact[]>('solo_admin_contacts', { p_search: search, p_status: null }).then(l => setFound(l.slice(0, 6))).catch(() => setFound([])), 250);
    return () => clearTimeout(t);
  }, [search]);
  const parsed = lines.map(l => ({ label: l.label.trim(), quantity: Number(l.quantity.replace(',', '.')) || 0, unit: toMinor(l.unit || '0'), vat: Number(l.vat.replace(',', '.')) || 0 }));
  const totals = useMemo(() => parsed.reduce((a, l) => { if (!l.label || l.unit == null) return a; const net = Math.round(l.quantity * l.unit); const vat = Math.round(net * l.vat / 100); return { net: a.net + net, vat: a.vat + vat }; }, { net: 0, vat: 0 }), [parsed]);
  const set = (i: number, k: keyof EditLine, v: string) => setLines(ls => ls.map((l, j) => j === i ? { ...l, [k]: v } : l));
  const defaultVat = String(profile?.vat_rate ?? 0);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issue = issueRef.current;
    const f = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    if (parsed.some(l => l.label && l.unit == null)) { setError('Un prix est mal écrit (ex. 2500 ou 2 500,50).'); return; }
    setBusy(true); setError('');
    try {
      const saved = await adminRpc<Full>('solo_admin_invoice_save', { p: { id: inv?.id ?? '', crm_contact_id: contact?.id ?? '', client, currency, due_date: f['due_date'] ?? '', notes: f['notes'] ?? '',
        lang: f['lang'] ?? 'fr', pay_card: f['pay_card'] === 'on', lines: parsed.filter(l => l.label).map(l => ({ label: l.label, quantity: l.quantity, unit_amount: l.unit, vat_rate: l.vat })) } });
      if (issue) await adminRpc('solo_admin_invoice_issue', { p_id: saved.id });
      onSaved(saved.id);
    } catch (e) { setError(err(e)); }
    finally { setBusy(false); }
  }

  return <div className="admin-overlay" role="dialog" aria-modal="true" aria-labelledby="inv-title" onClick={e => e.target === e.currentTarget && onClose()}>
    <form className="admin-sheet contact-form contact-sheet invoice-editor" onSubmit={save}>
      <div className="admin-sheet-head"><h2 id="inv-title">{quick ? 'Lien de paiement' : inv ? 'Modifier le brouillon' : 'Nouvelle facture'}</h2><Button type="button" variant="ghost" size="icon" aria-label="Fermer" onClick={onClose}><X /></Button></div>
      {quick && <p className="booking-muted">Une facture d’une ligne, émise tout de suite, avec son lien de paiement à envoyer.</p>}

      <fieldset><legend>Client</legend>
        {contact ? <div className="invoice-contact"><span><strong>{contact.name ?? contact.email}</strong>{contact.email && <small> · {contact.email}</small>}</span><Button type="button" size="sm" variant="ghost" onClick={() => setContact(undefined)}>Changer</Button></div>
          : <div className="field"><label htmlFor="inv-search">Chercher dans les clients</label><input id="inv-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, société, email…" autoComplete="off" />
            {found.length > 0 && <div className="news-link-list">{found.map(c => <button key={c.id} type="button" onClick={() => { setContact({ id: c.id, name: c.name, email: c.email, phone: c.phone, company: c.company }); setSearch(''); }}>{c.name ?? c.email}{c.company ? ` · ${c.company}` : ''}</button>)}</div>}</div>}
        <div className="form-two"><div className="field"><label htmlFor="inv-cname">Nom {contact ? '(si différent de la fiche)' : ''}</label><input id="inv-cname" value={client.name ?? ''} onChange={e => setClient(c => ({ ...c, name: e.target.value }))} /></div>
          <div className="field"><label htmlFor="inv-ccomp">Société facturée</label><input id="inv-ccomp" value={client.company ?? ''} onChange={e => setClient(c => ({ ...c, company: e.target.value }))} /></div></div>
        {!quick && <><div className="form-two"><div className="field"><label htmlFor="inv-cemail">Email</label><input id="inv-cemail" type="email" value={client.email ?? ''} onChange={e => setClient(c => ({ ...c, email: e.target.value }))} /></div>
          <div className="field"><label htmlFor="inv-ctrn">TRN / n° TVA du client</label><input id="inv-ctrn" value={client.trn ?? ''} onChange={e => setClient(c => ({ ...c, trn: e.target.value }))} /></div></div>
          <div className="field"><label htmlFor="inv-caddr">Adresse de facturation</label><input id="inv-caddr" value={client.address ?? ''} onChange={e => setClient(c => ({ ...c, address: e.target.value }))} placeholder={contact ? 'Vide : celle de la fiche client' : ''} /></div></>}
      </fieldset>

      <fieldset><legend>{quick ? 'Montant' : 'Lignes'}</legend>
        <div className="invoice-lines">
          <div className={`invoice-lines-head${quick ? ' is-quick' : ''}`} aria-hidden="true"><span>Désignation</span>{!quick && <span>Qté</span>}<span>Prix unitaire HT</span><span>TVA %</span>{!quick && <span />}</div>
          {lines.map((l, i) => <div key={i} className={`invoice-line${quick ? ' is-quick' : ''}`}>
            <input aria-label="Désignation" value={l.label} onChange={e => set(i, 'label', e.target.value)} placeholder={i === 0 ? 'Création de société RAKEZ' : ''} required={i === 0} />
            {!quick && <input aria-label="Quantité" inputMode="decimal" value={l.quantity} onChange={e => set(i, 'quantity', e.target.value)} />}
            <input aria-label="Prix unitaire hors taxe" inputMode="decimal" value={l.unit} onChange={e => set(i, 'unit', e.target.value)} placeholder="2500" />
            <input aria-label="Taux de TVA" inputMode="decimal" value={l.vat} onChange={e => set(i, 'vat', e.target.value)} />
            {!quick && <Button type="button" variant="ghost" size="icon" aria-label="Retirer la ligne" disabled={lines.length === 1} onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}><Trash2 /></Button>}
          </div>)}
        </div>
        {!quick && <div className="admin-actions"><Button type="button" size="sm" variant="ghost" onClick={() => setLines(ls => [...ls, { label: '', quantity: '1', unit: '', vat: defaultVat }])}><Plus /> Ligne</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setLines(ls => [...ls, { label: 'Frais gouvernementaux (refacturés au réel)', quantity: '1', unit: '', vat: '0' }])}><Plus /> Frais gouvernementaux, sans TVA</Button></div>}
        <div className="invoice-live"><p><span>Total HT</span><span>{money(totals.net, currency || 'USD')}</span></p>{totals.vat > 0 && <p><span>TVA</span><span>{money(totals.vat, currency || 'USD')}</span></p>}<p className="is-total"><span>Total</span><span>{money(totals.net + totals.vat, currency || 'USD')}</span></p></div>
      </fieldset>

      <fieldset><legend>Conditions</legend>
        <div className="form-three"><div className="field"><label htmlFor="inv-cur">Devise</label><select id="inv-cur" value={currency} onChange={e => setCurrency(e.target.value)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>
          <div className="field"><label htmlFor="inv-lang">Langue de la facture</label><select id="inv-lang" name="lang" defaultValue={inv?.lang ?? 'fr'}><option value="fr">Français</option><option value="en">English</option><option value="ru">Русский</option></select></div>
          <div className="field"><label htmlFor="inv-due">Échéance</label><input id="inv-due" name="due_date" type="date" defaultValue={inv?.due_date ?? ''} /></div></div>
        {!quick && <div className="field"><label htmlFor="inv-notes">Note sur la facture</label><textarea id="inv-notes" name="notes" rows={2} defaultValue={inv?.notes ?? ''} placeholder="Acompte de 50 % à la signature, solde à l’obtention de la licence…" /></div>}
        <label className="admin-check"><input type="checkbox" name="pay_card" defaultChecked={inv?.pay_card ?? true} /> Proposer le paiement par carte sur le lien (si Stripe est branché)</label>
        {!inv?.due_date && <p className="booking-muted">Échéance vide : {profile?.due_days ?? 7} jours après l’émission.</p>}
      </fieldset>
      {error && <p role="alert" className="booking-error">{error}</p>}
      <div className="form-actions">
        {quick ? <Button type="submit" disabled={busy} onClick={() => { issueRef.current = true; }}><Link2 /> Créer le lien</Button> : <>
          <Button type="submit" disabled={busy} onClick={() => { issueRef.current = true; }}><Send /> Émettre</Button>
          <Button type="submit" variant="outline" disabled={busy} onClick={() => { issueRef.current = false; }}>Enregistrer le brouillon</Button></>}
        <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
      </div>
      {!quick && <p className="booking-muted">Émettre donne le numéro et fige la facture ; un brouillon reste modifiable.</p>}
    </form>
  </div>;
}

/* ---------- one invoice ---------- */
function InvoicePanel({ id, staff, onBack, onChanged }: { id: string; staff: Staff; onBack: () => void; onChanged: () => void }) {
  const [inv, setInv] = useState<Full | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [msg, setMsg] = useState(''); const [error, setError] = useState('');
  const load = useCallback(() => { adminRpc<Full>('solo_admin_invoice', { p_id: id }).then(setInv).catch(e => setError(err(e))); }, [id]);
  useEffect(load, [load]);
  useEffect(() => {
    if (inv?.status === 'issued' && inv.has_link) adminRpc<Link>('solo_admin_invoice_link', { p_id: id }).then(l => setLink(payUrl(l))).catch(() => setLink(null));
    else setLink(null);
  }, [inv?.status, inv?.has_link, id]);
  const act = async (fn: string, args: Record<string, unknown>, done?: string) => {
    setError(''); try { setInv(await adminRpc<Full>(fn, args)); onChanged(); if (done) setMsg(done); return true; } catch (e) { setError(err(e)); return false; }
  };
  if (!inv) return <><Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft /> Factures</Button><p className="booking-muted">{error || 'Chargement…'}</p></>;
  const who = inv.client.company || inv.client.name || 'le client';
  const first = inv.client.name?.split(' ')[0];
  const text = link ? `Bonjour${first ? ` ${first}` : ''},\n\nVoici la facture ${inv.number} de ${money(inv.balance, inv.currency)}. Vous pouvez la consulter et la régler ici :\n${link}\n\nMerci,\nDarya — Oolala Corporate Services` : '';
  const phone = (inv.client.phone ?? '').replace(/[^0-9]/g, '');
  async function copy() { if (!link) return; try { await navigator.clipboard.writeText(link); setMsg('Lien copié.'); } catch { setMsg('Copiez le lien ci-dessous à la main.'); } }
  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    const amount = toMinor(f['amount'] ?? ''); if (!amount || amount <= 0) { setError('Montant invalide.'); return; }
    if (await act('solo_admin_invoice_payment', { p_id: id, p_amount: amount, p_method: f['method'], p_reference: f['reference'] || null, p_paid_at: f['paid_at'] ? new Date(`${f['paid_at']}T12:00:00Z`).toISOString() : null }, 'Paiement enregistré.')) setPaying(false);
  }
  async function cancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const reason = String(new FormData(event.currentTarget).get('reason') ?? '');
    if (await act('solo_admin_invoice_cancel', { p_id: id, p_reason: reason }, 'Facture annulée : elle garde son numéro.')) setCancelling(false);
  }
  return <>
    <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft /> Factures</Button>
    <section className="admin-panel invoice-panel">
      <div className="admin-card-title"><h2>{inv.number ?? 'Brouillon'} · {who}</h2><span className={`inv-pill is-${inv.state}`}>{stateLabel[inv.state]}</span></div>
      <p className="booking-muted">{money(inv.total, inv.currency)}{inv.paid > 0 ? ` · réglé ${money(inv.paid, inv.currency)} · reste ${money(inv.balance, inv.currency)}` : ''}{inv.due_date ? ` · échéance ${day(inv.due_date)}` : ''}{inv.cancel_reason ? ` · annulée : ${inv.cancel_reason}` : ''}</p>
      <div className="admin-actions">
        {inv.status === 'draft' && <><Button size="sm" onClick={() => act('solo_admin_invoice_issue', { p_id: id }, 'Facture émise.')}><Send /> Émettre</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Modifier</Button>
          <Button size="sm" variant="ghost" onClick={() => act('solo_admin_invoice_cancel', { p_id: id, p_reason: 'Brouillon abandonné' })}>Abandonner le brouillon</Button></>}
        {inv.status === 'issued' && link && <><Button size="sm" onClick={copy}><Copy /> Copier le lien de paiement</Button>
          {phone && <Button size="sm" variant="outline" asChild><a href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a></Button>}
          <Button size="sm" variant="outline" asChild><a href={`mailto:${inv.client.email ?? ''}?subject=${encodeURIComponent(`Facture ${inv.number}`)}&body=${encodeURIComponent(text)}`}><Mail /> Email</a></Button></>}
        {inv.status === 'issued' && inv.state !== 'paid' && <Button size="sm" variant="outline" onClick={() => setPaying(p => !p)}>Enregistrer un paiement</Button>}
        <Button size="sm" variant="ghost" onClick={printInvoice}><Printer /> Imprimer / PDF</Button>
        {inv.status === 'issued' && <Button size="sm" variant="ghost" onClick={async () => { try { setLink(payUrl(await adminRpc<Link>('solo_admin_invoice_link', { p_id: id, p_renew: true }))); setMsg('Nouveau lien : l’ancien ne fonctionne plus.'); } catch (e) { setError(err(e)); } }}>Nouveau lien</Button>}
        {inv.status === 'issued' && inv.paid === 0 && <Button size="sm" variant="ghost" onClick={() => setCancelling(c => !c)}>Annuler la facture</Button>}
      </div>
      {link && <p className="sync-link"><code>{link}</code></p>}
      {paying && <form className="contact-form invoice-pay" onSubmit={pay}>
        <div className="form-three"><div className="field"><label htmlFor="pay-amount">Montant ({inv.currency})</label><input id="pay-amount" name="amount" inputMode="decimal" required defaultValue={fromMinor(inv.balance)} /></div>
          <div className="field"><label htmlFor="pay-method">Moyen</label><select id="pay-method" name="method" defaultValue="bank_transfer"><option value="bank_transfer">Virement</option><option value="cash">Espèces</option><option value="card">Carte (hors lien)</option><option value="other">Autre</option></select></div>
          <div className="field"><label htmlFor="pay-date">Reçu le</label><input id="pay-date" name="paid_at" type="date" /></div></div>
        <div className="field"><label htmlFor="pay-ref">Référence</label><input id="pay-ref" name="reference" placeholder="Référence du virement, reçu…" /></div>
        <div className="form-actions"><Button type="submit" size="sm">Enregistrer</Button><Button type="button" size="sm" variant="ghost" onClick={() => setPaying(false)}>Annuler</Button></div>
      </form>}
      {cancelling && <form className="contact-form invoice-pay" onSubmit={cancel}>
        <div className="field"><label htmlFor="cancel-reason">Motif de l’annulation</label><input id="cancel-reason" name="reason" required placeholder="Erreur de montant, prestation annulée…" /></div>
        <div className="form-actions"><Button type="submit" size="sm">Annuler la facture</Button><Button type="button" size="sm" variant="ghost" onClick={() => setCancelling(false)}>Garder</Button></div>
      </form>}
      {msg && <p role="status" className="booking-muted">{msg}</p>}
      {error && <p role="alert" className="booking-error">{error}</p>}
      {inv.all_payments.length > 0 && <div className="admin-list invoice-payments">{inv.all_payments.map(p => <div key={p.id} className={`admin-row${p.voided_at ? ' is-voided' : ''}`}>
        <span><strong>{money(p.amount, inv.currency)}</strong> · {methodLabel[p.method] ?? p.method} · {day(p.paid_at.slice(0, 10))}{p.reference ? ` · ${p.reference}` : ''}<br /><small>{p.voided_at ? 'Annulé' : `Saisi par ${p.recorded_by === staff.email ? 'vous' : p.recorded_by ?? '—'}`}</small></span>
        {!p.voided_at && p.recorded_by !== 'card checkout' && <Button size="sm" variant="ghost" onClick={() => act('solo_admin_invoice_payment_void', { p_payment: p.id }, 'Paiement annulé.')}>Annuler</Button>}
      </div>)}</div>}
    </section>
    <div className="invoice-preview"><InvoiceDocument doc={inv} lang="fr" /></div>
    {editing && <InvoiceEditor seed={{ invoice: inv }} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); onChanged(); }} />}
  </>;
}

/* ---------- the list (all, or one client's) ---------- */
export function Invoices({ staff, contact }: { staff: Staff; contact?: InvoiceContact }) {
  const contactId = contact?.id;
  const [filter, setFilter] = useState(contactId ? '' : 'open');
  const [list, setList] = useState<List | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [editor, setEditor] = useState<InvoiceSeed | null>(null);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => { adminRpc<List>('solo_admin_invoices', { p_state: filter || null, p_contact: contactId ?? null }).then(setList).catch(e => setError(err(e))); }, [filter, contactId, reload]);
  const done = (id: string) => { setEditor(null); setReload(r => r + 1); setOpen(id); };
  if (open) return <InvoicePanel id={open} staff={staff} onBack={() => { setOpen(null); setReload(r => r + 1); }} onChanged={() => setReload(r => r + 1)} />;
  return <>
    {!contactId && list && list.totals.length > 0 && <div className="admin-stats">{list.totals.map(t => <div key={t.currency} className="inv-stat">
      <strong>{money(t.due ?? 0, t.currency)}</strong><span>à encaisser{t.overdue ? ` · dont ${money(t.overdue, t.currency)} en retard` : ''}</span><small>encaissé sur 30 jours : {money(t.paid_30d, t.currency)}</small></div>)}</div>}
    <div className="admin-filters invoice-filters">
      {!contactId && <div className="news-views">{FILTERS.map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}{k === 'draft' && list?.drafts ? <b>{list.drafts}</b> : null}</button>)}</div>}
      <div className="admin-actions"><Button size="sm" onClick={() => setEditor({ contact })}><FileText /> Nouvelle facture</Button><Button size="sm" variant="outline" onClick={() => setEditor({ quick: true, contact })}><Link2 /> Lien de paiement</Button></div>
    </div>
    {error && <p role="alert" className="booking-error">{error}</p>}
    {!list ? <p className="booking-muted">Chargement…</p> : list.items.length === 0 ? <p className="booking-muted">Aucune facture{filter ? ' ici' : ''}.</p>
      : <div className="admin-list">{list.items.map(r => <button key={r.id} type="button" className="admin-row admin-row-button" onClick={() => setOpen(r.id)}>
        <span><strong>{r.number ?? 'Brouillon'}</strong> · {r.client.company || r.client.name || '—'}<br /><small>{[r.label, r.issue_date ? day(r.issue_date) : null, r.due_date && r.state !== 'paid' ? `échéance ${day(r.due_date)}` : null].filter(Boolean).join(' · ')}</small></span>
        <span className="admin-row-meta"><span className={`inv-pill is-${r.state}`}>{stateLabel[r.state]}</span><small>{money(r.total, r.currency)}{r.paid > 0 && r.paid < r.total ? ` · reste ${money(r.total - r.paid, r.currency)}` : ''}</small></span>
      </button>)}</div>}
    {editor && <InvoiceEditor seed={editor} onClose={() => setEditor(null)} onSaved={done} />}
  </>;
}
