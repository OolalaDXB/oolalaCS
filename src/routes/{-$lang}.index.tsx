import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowUpRight, ArrowDown, Building2, BriefcaseBusiness, ShieldCheck, UserRound, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContactBand, DaryaSection, Eyebrow } from '@/components/oolala/shared';
import { countryKeys as keys, countryPaths } from '@/lib/oolala';
import { localeHead, useT } from '@/lib/i18n';
import dubai from '@/assets/dubai.jpg.asset.json';
import tbilisi from '@/assets/tbilisi.jpg.asset.json';
import paris from '@/assets/paris.jpg.asset.json';

const photos = { emirats: dubai, georgie: tbilisi, france: paris };
export const Route = createFileRoute('/{-$lang}/')({
  component: Index,
  head: ({ params }) => localeHead(params.lang, 'home', '/'),
});
function Index() {
  const { t, lp } = useT(); const h = t.home; const countries = t.countries;
  const icons = [Building2, UserRound, ShieldCheck];
  return <>
    <section className="home-hero"><img className="hero-photo" src={dubai.url} alt={h.heroAlt} fetchPriority="high" /><div className="hero-shade" /><span className="hero-caption"><MapPin size={11} /> {h.caption}</span><div className="site-wrap hero-content"><div className="reveal"><Eyebrow>Oolala Corporate Services · UAE / Georgia / France</Eyebrow><h1 className="hero-heading">{h.heading1}<br />{h.heading2}</h1><p className="hero-lead">{h.lead1}<br />{h.lead2}</p><div className="hero-buttons"><Button asChild variant="hero"><Link to="/{-$lang}/contact" params={lp}>{h.cta} <ArrowUpRight /></Link></Button><Button asChild variant="heroOutline"><a href="#destinations">{h.explore} <ArrowDown /></a></Button></div></div><div className="hero-bottom"><div className="hero-note"><span className="eyebrow-dot" /> {h.note}</div><div className="hero-destinations">{keys.map(key => <Link key={key} to={countryPaths[key]} params={lp} className="hero-destination"><img src={photos[key].url} alt="" /><span>{countries[key].short}<small>{countries[key].city}</small></span></Link>)}</div></div></div></section>
    <div className="site-wrap intro-strip"><p><strong>{h.stripTitle}</strong><br />{h.stripText}</p><div className="intro-services">{h.strip.map((label, i) => { const Icon = icons[i] ?? Building2; return <span key={label}><Icon size={15} /> {label}</span>; })}</div></div>
    <section id="destinations" className="section-space site-wrap"><div className="section-heading"><div><Eyebrow>{h.destEyebrow}</Eyebrow><h2 className="section-title">{h.destTitle}</h2></div><p className="section-description">{h.destText}</p></div><div className="country-grid">{keys.map(key => <Link key={key} to={countryPaths[key]} params={lp} className="country-card"><div className="country-card-photo"><img src={photos[key].url} alt={`${countries[key].city}, ${countries[key].name}`} loading="lazy" /></div><div className="country-card-info"><div className="country-card-title"><h3>{countries[key].name}</h3><ArrowUpRight size={20} /></div><p>{countries[key].label}</p><div className="country-card-tags">{countries[key].tags.map(tag => <span key={tag}>{tag}</span>)}</div></div></Link>)}</div></section>
    <section className="audience-section section-space"><div className="site-wrap"><Eyebrow>{h.audEyebrow}</Eyebrow><h2 className="section-title">{h.audTitle}</h2><div className="audience-grid"><div className="audience-item"><BriefcaseBusiness size={25} strokeWidth={1.3} /><h3>{h.bizTitle}</h3><p>{h.bizText}</p><Link to="/{-$lang}/contact" params={lp} className="text-link">{h.bizCta} <ArrowUpRight size={15} /></Link></div><div className="audience-item"><UserRound size={25} strokeWidth={1.3} /><h3>{h.perTitle}</h3><p>{h.perText}</p><Link to="/{-$lang}/contact" params={lp} className="text-link">{h.perCta} <ArrowUpRight size={15} /></Link></div></div></div></section>
    <section className="section-space site-wrap"><div className="section-heading"><div><Eyebrow>{h.methodEyebrow}</Eyebrow><h2 className="section-title">{h.methodTitle}</h2></div><p className="section-description">{h.methodText1}<br />{h.methodText2}</p></div><div className="process-grid">{h.steps.map((step, i) => <div className="process-step" key={step.title}><span className="step-number">0{i + 1}</span><h3>{step.title}</h3><p>{step.text}</p></div>)}</div></section>
    <DaryaSection /><ContactBand />
  </>;
}
