import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { adminRpc, errorLabel } from '@/lib/solo-admin';
import { CURRENCIES, type Party } from '@/lib/invoice';

// Who issues the invoices: printed on every invoice, frozen into each one when it is issued.
export function BillingSettings() {
  const [p, setP] = useState<Party | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { adminRpc<Party>('solo_admin_billing_profile').then(setP).catch(e => setMsg(errorLabel(e.message))); }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { setP(await adminRpc<Party>('solo_admin_billing_profile_set', { p: f })); setMsg('Enregistré. Les factures déjà émises gardent les informations du jour de leur émission.'); }
    catch (e) { setMsg(errorLabel((e as Error).message)); }
  }
  if (!p) return <p className="booking-muted">{msg || 'Chargement…'}</p>;
  const field = (name: keyof Party, label: string, extra: Record<string, string> = {}) =>
    <div className="field"><label htmlFor={`bp-${name}`}>{label}</label><input id={`bp-${name}`} name={name} defaultValue={String(p[name] ?? '')} {...extra} /></div>;
  return <form className="contact-form admin-panel contact-sheet billing-settings" onSubmit={save}>
    <fieldset><legend>Société</legend>
      <div className="form-two">{field('legal_name', 'Raison sociale (sur la facture)', { placeholder: 'Oolala … FZ-LLC' })}{field('trade_name', 'Nom commercial')}</div>
      {field('address', 'Adresse')}
      <div className="form-two">{field('licence', 'Licence (numéro et autorité)', { placeholder: '12345678 · RAKEZ' })}{field('trn', 'TRN (n° TVA)', { placeholder: '15 chiffres, si enregistré à la TVA' })}</div>
      <div className="form-three">{field('email', 'Email')}{field('phone', 'Téléphone')}{field('website', 'Site')}</div>
    </fieldset>
    <fieldset><legend>TVA et numérotation</legend>
      <div className="form-three"><div className="field"><label htmlFor="bp-vat">TVA par défaut (%)</label><input id="bp-vat" name="vat_rate" inputMode="decimal" defaultValue={p.vat_rate ?? ''} placeholder="5 (vide : pas de TVA)" /></div>
        {field('invoice_prefix', 'Préfixe des numéros', { placeholder: 'OCS', maxLength: '8' })}
        <div className="field"><label htmlFor="bp-cur">Devise par défaut</label><select id="bp-cur" name="default_currency" defaultValue={p.default_currency}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div></div>
      <div className="form-two"><div className="field"><label htmlFor="bp-due">Délai de paiement (jours)</label><input id="bp-due" name="due_days" type="number" min="0" max="120" defaultValue={p.due_days} /></div>
        {field('vat_note', 'Mention quand il n’y a pas de TVA', { placeholder: 'Non soumis à la TVA' })}</div>
      <p className="booking-muted">Numéros : {p.invoice_prefix}-{new Date().getFullYear()}-0001, 0002… attribués à l’émission, sans trou. Chaque ligne garde son taux : les frais gouvernementaux se facturent à 0 %.</p>
    </fieldset>
    <fieldset><legend>Virement</legend>
      <div className="form-two">{field('account_name', 'Titulaire du compte')}{field('bank_name', 'Banque')}</div>
      <div className="form-two">{field('iban', 'IBAN')}{field('swift', 'SWIFT / BIC')}</div>
      {field('bank_note', 'Note de virement', { placeholder: 'Frais bancaires à la charge du client' })}
    </fieldset>
    <fieldset><legend>Bas de facture</legend>
      <div className="field"><label htmlFor="bp-terms">Conditions de paiement</label><textarea id="bp-terms" name="payment_terms" rows={2} defaultValue={p.payment_terms ?? ''} /></div>
      <div className="field"><label htmlFor="bp-legal">Mentions légales</label><textarea id="bp-legal" name="legal_mentions" rows={2} defaultValue={p.legal_mentions ?? ''} /></div>
    </fieldset>
    <div className="form-actions"><Button type="submit">Enregistrer</Button></div>
    {msg && <p role="status" className="booking-muted">{msg}</p>}
    <p className="booking-muted">Paiement par carte : il s’active quand les clés Stripe sont enregistrées dans Supabase (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET). Sans elles, le lien propose le virement.</p>
  </form>;
}
