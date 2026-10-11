import { useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappUrl } from '@/lib/oolala';
import { useT } from '@/lib/i18n';
import { solo, SoloError } from '@/lib/solo';

// Enquiries are saved in the Oolala back office (BEAU Solo CRM). WhatsApp stays
// one tap away and carries the same message if saving fails.
export function ContactForm({ investment = false }: { investment?: boolean }) {
  const { t, lang } = useT(); const f = t.form;
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error' | 'invalid_email'>('idle');

  function values() {
    const data = new FormData(formRef.current ?? undefined);
    const get = (key: string) => String(data.get(key) ?? '').trim();
    return { get, website: get('website') };
  }

  function openWhatsApp() {
    const { get } = values();
    const rows: [string, string][] = [[f.name, get('name')], [f.email, get('email')], [f.phone, get('phone')], [f.country, get('country')],
      [f.need, get('need')], [f.budget, get('budget')], [f.goal, get('goal')], [f.zone, get('zone')], [f.project, get('message')]];
    const lines = [f.hello, investment ? f.introInvest : f.intro, ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)];
    window.open(`${whatsappUrl}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { get, website } = values();
    if (website) return;
    setState('sending');
    try {
      await solo('enquiry', {
        name: get('name'), email: get('email'), phone: get('phone'), country: get('country'),
        need: investment ? f.needs[4] : get('need'), message: get('message'), lang,
        page: typeof window === 'undefined' ? '' : window.location.pathname,
        details: investment ? { budget: get('budget'), goal: get('goal'), zone: get('zone') } : {},
      });
      setState('sent');
      formRef.current?.reset();
    } catch (e) {
      if (e instanceof SoloError && e.message === 'invalid_email') { setState('invalid_email'); return; }
      setState('error');
    }
  }

  return <form ref={formRef} className="contact-form" onSubmit={submit} key={t.locale}>
    <input className="hidden" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
    <div className="form-two"><div className="field"><label htmlFor="name">{f.name} *</label><input id="name" name="name" autoComplete="name" placeholder={f.namePh} required maxLength={120} /></div><div className="field"><label htmlFor="email">{f.email} *</label><input type="email" id="email" name="email" autoComplete="email" placeholder={f.emailPh} required maxLength={200} aria-invalid={state === 'invalid_email' || undefined} /></div></div>
    <div className="form-two"><div className="field"><label htmlFor="phone">{f.phone}</label><input type="tel" id="phone" name="phone" autoComplete="tel" placeholder="+33 …" maxLength={40} /></div><div className="field"><label htmlFor="country">{f.country} *</label><select id="country" name="country" defaultValue={investment ? f.countries[1] : ''} required><option value="" disabled>{f.chooseCountry}</option>{f.countries.map(o => <option key={o}>{o}</option>)}</select></div></div>
    {investment ? <><div className="form-two"><div className="field"><label htmlFor="budget">{f.budget}</label><input id="budget" name="budget" placeholder={f.budgetPh} maxLength={120} /></div><div className="field"><label htmlFor="goal">{f.goal}</label><select id="goal" name="goal">{f.goals.map(o => <option key={o}>{o}</option>)}</select></div></div><div className="field"><label htmlFor="zone">{f.zone}</label><select id="zone" name="zone">{f.zones.map(o => <option key={o}>{o}</option>)}</select></div></> : <div className="field"><label htmlFor="need">{f.need}</label><select id="need" name="need">{f.needs.map(o => <option key={o}>{o}</option>)}</select></div>}
    <div className="field"><label htmlFor="message">{f.project} *</label><textarea id="message" name="message" placeholder={f.projectPh} required maxLength={5000} /></div>
    <p className="form-consent">{f.consent}</p>
    <div className="form-actions">
      <Button type="submit" className="form-submit" disabled={state === 'sending'}>{state === 'sending' ? f.sending : f.submit} <ArrowUpRight /></Button>
      <Button type="button" variant="ghost" className="form-whatsapp" onClick={openWhatsApp}><MessageCircle /> {f.whatsappAlt}</Button>
    </div>
    {state === 'sent' && <p role="status" className="form-status">{f.status}</p>}
    {state === 'error' && <p role="alert" className="form-status">{f.error}</p>}
    {state === 'invalid_email' && <p role="alert" className="form-status booking-error">{t.booking.errors.invalid_email}</p>}
  </form>;
}
