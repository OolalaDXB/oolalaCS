import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Globe2, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/oolala-cs-horizontal-dark.svg.asset.json';
import { whatsappUrl } from '@/lib/oolala';
import { langLabels, langParam, langs, useT } from '@/lib/i18n';

const navigation = [{ to: '/{-$lang}/emirats', key: 'emirats' }, { to: '/{-$lang}/georgie', key: 'georgie' }, { to: '/{-$lang}/france', key: 'france' }, { to: '/{-$lang}/georgie/investir', key: 'invest' }] as const;

function LanguageSwitcher({ onPick }: { onPick?: () => void }) {
  const { t, lang } = useT();
  return <nav className="locale-switch" aria-label={t.nav.language}><Globe2 size={14} aria-hidden="true" />{langs.map(l => <Link key={l} to="." params={(prev: Record<string, unknown>) => ({ ...prev, lang: langParam(l) })} hrefLang={l} lang={l} aria-current={l === lang ? 'true' : undefined} className={l === lang ? 'is-active' : undefined} onClick={onPick}>{langLabels[l]}</Link>)}</nav>;
}

export function SiteHeader() {
  const { t, lp } = useT(); const n = t.nav;
  const [open, setOpen] = useState(false);
  return <><a href="#main" className="skip-link">{n.skip}</a><header className="site-header"><div className="site-wrap header-inner">
    <Link to="/{-$lang}" params={lp} aria-label={n.homeAria} onClick={() => setOpen(false)}><img className="brand-logo" src={logo.url} alt="Oolala Corporate Services" /></Link>
    <nav className="desktop-nav" aria-label={n.main}>{navigation.map(item => <Link key={item.to} to={item.to} params={lp}>{n[item.key]}</Link>)}</nav>
    <div className="header-actions"><LanguageSwitcher /><Button asChild className="header-cta"><Link to="/{-$lang}/contact" params={lp}>{n.cta} <ArrowUpRight size={14} /></Link></Button><Button variant="ghost" size="icon" className="mobile-toggle" aria-label={open ? n.close : n.open} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</Button></div>
  </div>{open && <nav id="mobile-nav" className="mobile-nav" aria-label={n.mobile}>{navigation.map(item => <Link key={item.to} to={item.to} params={lp} onClick={() => setOpen(false)}>{n[item.key]}</Link>)}<Link to="/{-$lang}/contact" params={lp} onClick={() => setOpen(false)}>{n.cta} <ArrowUpRight size={14} className="inline" /></Link><LanguageSwitcher onPick={() => setOpen(false)} /></nav>}</header></>;
}

export function SiteFooter() {
  const { t, lp } = useT(); const f = t.footer;
  return <footer className="site-footer"><div className="site-wrap"><div className="footer-top"><div className="footer-brand"><Link to="/{-$lang}" params={lp} aria-label={t.nav.homeAria}><img className="brand-logo" src={logo.url} alt="Oolala Corporate Services" /></Link><p className="footer-tagline">{f.tagline}<br />{f.countries}</p></div><nav className="footer-links" aria-label={f.destinations}><strong>{f.destinations}</strong>{navigation.map(item => <Link to={item.to} params={lp} key={item.to}>{t.nav[item.key]}</Link>)}</nav><div className="footer-links"><strong>{f.talk}</strong><Link to="/{-$lang}/contact" params={lp}>{f.contactDarya} <ArrowUpRight size={12} className="inline" /></Link><a href="tel:+971506838777">+971 50 683 8777</a><a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a><span>Français · English · Русский</span></div></div><div className="footer-legal"><p>{f.legal1}</p><p className="mt-3">{f.legal2}</p></div><div className="footer-bottom"><span>© 2026 Oolala Corporate Services</span><span>The Sustainable City · Dubai, UAE</span></div></div></footer>;
}
