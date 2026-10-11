import { useState, type FormEvent } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappUrl } from '@/lib/oolala';
import { useT } from '@/lib/i18n';

export function ContactForm({ investment = false }: { investment?: boolean }) {
  const { t } = useT(); const f = t.form;
  const [prepared, setPrepared] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get('website')) return;
    const lines = [f.hello, investment ? f.introInvest : f.intro, ...Array.from(data.entries()).filter(([key, value]) => key !== 'website' && String(value).trim()).map(([key, value]) => `${key}: ${value}`)];
    window.open(`${whatsappUrl}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer');
    setPrepared(true);
  }
  return <form className="contact-form" onSubmit={submit} key={t.locale}>
    <input className="hidden" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
    <div className="form-two"><div className="field"><label htmlFor="name">{f.name} *</label><input id="name" name={f.name} autoComplete="name" placeholder={f.namePh} required /></div><div className="field"><label htmlFor="email">{f.email} *</label><input type="email" id="email" name={f.email} autoComplete="email" placeholder={f.emailPh} required /></div></div>
    <div className="form-two"><div className="field"><label htmlFor="phone">{f.phone}</label><input type="tel" id="phone" name={f.phone} autoComplete="tel" placeholder="+33 …" /></div><div className="field"><label htmlFor="country">{f.country} *</label><select id="country" name={f.country} defaultValue={investment ? f.countries[1] : ''} required><option value="" disabled>{f.chooseCountry}</option>{f.countries.map(o => <option key={o}>{o}</option>)}</select></div></div>
    {investment ? <><div className="form-two"><div className="field"><label htmlFor="budget">{f.budget}</label><input id="budget" name={f.budget} placeholder={f.budgetPh} /></div><div className="field"><label htmlFor="goal">{f.goal}</label><select id="goal" name={f.goal}>{f.goals.map(o => <option key={o}>{o}</option>)}</select></div></div><div className="field"><label htmlFor="zone">{f.zone}</label><select id="zone" name={f.zone}>{f.zones.map(o => <option key={o}>{o}</option>)}</select></div></> : <div className="field"><label htmlFor="need">{f.need}</label><select id="need" name={f.need}>{f.needs.map(o => <option key={o}>{o}</option>)}</select></div>}
    <div className="field"><label htmlFor="message">{f.project} *</label><textarea id="message" name={f.project} placeholder={f.projectPh} required /></div>
    <p className="form-consent">{f.consent}</p>
    <Button type="submit" className="form-submit">{f.submit} <ArrowUpRight /></Button>
    {prepared && <p role="status" className="form-status">{f.status}</p>}
  </form>;
}
