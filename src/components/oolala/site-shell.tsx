import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Globe2, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/oolala-cs-horizontal-dark.svg.asset.json';
import { whatsappUrl } from '@/lib/oolala';

const navigation = [{ to: '/emirats', label: 'Émirats' }, { to: '/georgie', label: 'Géorgie' }, { to: '/france', label: 'France' }, { to: '/georgie/investir', label: 'Investir en Géorgie' }] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <><a href="#main" className="skip-link">Aller au contenu</a><header className="site-header"><div className="site-wrap header-inner">
    <Link to="/" aria-label="Oolala Corporate Services, accueil" onClick={() => setOpen(false)}><img className="brand-logo" src={logo.url} alt="Oolala Corporate Services" /></Link>
    <nav className="desktop-nav" aria-label="Navigation principale">{navigation.map(item => <Link key={item.to} to={item.to}>{item.label}</Link>)}</nav>
    <div className="header-actions"><span className="locale-label"><Globe2 size={14} /> FR</span><Button asChild className="header-cta"><Link to="/contact">Parlons de votre projet <ArrowUpRight size={14} /></Link></Button><Button variant="ghost" size="icon" className="mobile-toggle" aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</Button></div>
  </div>{open && <nav id="mobile-nav" className="mobile-nav" aria-label="Navigation mobile">{navigation.map(item => <Link key={item.to} to={item.to} onClick={() => setOpen(false)}>{item.label}</Link>)}<Link to="/contact" onClick={() => setOpen(false)}>Parlons de votre projet <ArrowUpRight size={14} className="inline" /></Link></nav>}</header></>;
}

export function SiteFooter() {
  return <footer className="site-footer"><div className="site-wrap"><div className="footer-top"><div className="footer-brand"><Link to="/" aria-label="Accueil Oolala"><img className="brand-logo" src={logo.url} alt="Oolala Corporate Services" /></Link><p className="footer-tagline">Votre projet international, accompagné personnellement.<br />Émirats · Géorgie · France</p></div><nav className="footer-links" aria-label="Pays"><strong>Vos destinations</strong>{navigation.map(item => <Link to={item.to} key={item.to}>{item.label}</Link>)}</nav><div className="footer-links"><strong>Parlons ensemble</strong><Link to="/contact">Contacter Darya <ArrowUpRight size={12} className="inline" /></Link><a href="tel:+971506838777">+971 50 683 8777</a><a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a><span>Français · English · Русский</span></div></div><div className="footer-legal"><p>Émirats : Oolala Next FZ-LLC, société de free zone enregistrée à RAKEZ. France : Oolala France SAS.</p><p className="mt-3">Les informations de ce site sont données à titre indicatif. Elles ne constituent ni un conseil juridique, ni un conseil fiscal, ni une mission d’expertise comptable. L’ouverture d’un compte bancaire, l’octroi d’un visa ou d’un permis de résidence dépendent des banques et des autorités compétentes.</p></div><div className="footer-bottom"><span>© 2026 Oolala Corporate Services</span><span>The Sustainable City · Dubai, UAE</span></div></div></footer>;
}