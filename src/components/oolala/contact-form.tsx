import { useState, type FormEvent } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappUrl } from '@/lib/oolala';

export function ContactForm({ investment = false }: { investment?: boolean }) {
  const [prepared, setPrepared] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get('website')) return;
    const lines = ['Bonjour Darya,', investment ? 'Je souhaite parler d’un investissement immobilier en Géorgie.' : 'Je souhaite vous parler de mon projet.', ...Array.from(data.entries()).filter(([key, value]) => key !== 'website' && String(value).trim()).map(([key, value]) => `${key} : ${value}`)];
    window.open(`${whatsappUrl}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer');
    setPrepared(true);
  }
  return <form className="contact-form" onSubmit={submit}>
    <input className="hidden" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
    <div className="form-two"><div className="field"><label htmlFor="name">Nom complet *</label><input id="name" name="Nom" autoComplete="name" placeholder="Votre nom" required /></div><div className="field"><label htmlFor="email">Email *</label><input type="email" id="email" name="Email" autoComplete="email" placeholder="vous@entreprise.com" required /></div></div>
    <div className="form-two"><div className="field"><label htmlFor="phone">Téléphone / WhatsApp</label><input type="tel" id="phone" name="Téléphone" autoComplete="tel" placeholder="+33 …" /></div><div className="field"><label htmlFor="country">Pays concerné *</label><select id="country" name="Pays" defaultValue={investment ? 'Géorgie' : ''} required><option value="" disabled>Choisir un pays</option><option>Émirats arabes unis</option><option>Géorgie</option><option>France</option><option>Plusieurs pays</option><option>À définir ensemble</option></select></div></div>
    {investment ? <><div className="form-two"><div className="field"><label htmlFor="budget">Budget envisagé</label><input id="budget" name="Budget" placeholder="Montant et devise" /></div><div className="field"><label htmlFor="goal">Votre objectif</label><select id="goal" name="Objectif"><option>Revenu locatif</option><option>Résidence</option><option>Résidence secondaire</option><option>À définir</option></select></div></div><div className="field"><label htmlFor="zone">Zone d’intérêt</label><select id="zone" name="Zone"><option>Gudauri</option><option>Tbilissi</option><option>Tbilisi Hills</option><option>Recherche sur mesure</option></select></div></> : <div className="field"><label htmlFor="need">Votre besoin</label><select id="need" name="Besoin"><option>Création ou gestion de société</option><option>Comptabilité et fiscalité</option><option>Résidence et visas</option><option>Installation et relocation</option><option>Investissement immobilier en Géorgie</option><option>Autre</option></select></div>}
    <div className="field"><label htmlFor="message">Votre projet *</label><textarea id="message" name="Projet" placeholder="Votre activité, votre situation, vos envies…" required /></div>
    <p className="form-consent">Vos informations sont utilisées uniquement pour répondre à votre demande. Votre message sera préparé dans WhatsApp ; vous pourrez le relire avant de l’envoyer.</p>
    <Button type="submit" className="form-submit">Continuer sur WhatsApp <ArrowUpRight /></Button>
    {prepared && <p role="status" className="form-status">Votre message est prêt dans WhatsApp. Validez son envoi pour contacter Darya.</p>}
  </form>;
}