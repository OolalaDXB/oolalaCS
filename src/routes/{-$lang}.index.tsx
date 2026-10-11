import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowUpRight, ArrowDown, Building2, BriefcaseBusiness, ShieldCheck, UserRound, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContactBand, DaryaSection, Eyebrow, Testimonials } from '@/components/oolala/shared';
import { countryKeys as keys, countryPaths, pillarSlugs } from '@/lib/oolala';
import { localeHead, useT } from '@/lib/i18n';
const dubai = { url: '/images/dubai.jpg' };
const tbilisi = { url: '/images/tbilisi.jpg' };
const paris = { url: '/images/paris.jpg' };

const photos = { emirats: dubai, georgie: tbilisi, france: paris };
export const Route = createFileRoute('/{-$lang}/')({
  component: Index,
  head: ({ params }) => localeHead(params.lang, 'home', '/'),
});
function Index() {
  const { t, lp } = useT(); const h = t.home; const o = t.offer; const countries = t.countries;
  const icons = [Building2, UserRound, ShieldCheck];
  return <>
    <section className="home-hero"><img className="hero-photo" src={dubai.url} alt={h.heroAlt} fetchPriority="high" /><div className="hero-shade" /><span className="hero-caption"><MapPin size={11} /> {h.caption}</span><div className="site-wrap hero-content"><div className="reveal"><Eyebrow>Oolala Corporate Services · UAE / Georgia / France</Eyebrow><h1 className="hero-heading">{h.heading1}<br />{h.heading2}</h1><p className="hero-lead"><strong>{o.heroLead[0]}</strong><br />{o.heroLead[1]}<br />{o.heroLead[2]}</p><div className="hero-buttons"><Button asChild variant="hero"><Link to="/{-$lang}/contact" params={lp}>{h.cta} <ArrowUpRight /></Link></Button><Button asChild variant="heroOutline"><a href="#destinations">{h.explore} <ArrowDown /></a></Button></div></div><div className="hero-bottom"><div className="hero-note"><span className="eyebrow-dot" /> {h.note}</div><div className="hero-destinations">{keys.map(key => <Link key={key} to={countryPaths[key]} params={lp} className="hero-destination"><img src={photos[key].url} alt="" /><span>{countries[key].short}<small>{countries[key].city}</small></span></Link>)}</div></div></div></section>
    <div className="site-wrap intro-strip"><p><strong>{h.stripTitle}</strong><br />{h.stripText}</p><div className="intro-services">{o.strip.map((label, i) => { const Icon = icons[i] ?? Building2; return <span key={label}><Icon size={15} /> {label}</span>; })}</div></div>
    <section id="destinations" className="section-space site-wrap"><div className="section-heading section-heading-stacked"><div><Eyebrow>{h.destEyebrow}</Eyebrow><h2 className="section-title">{h.destTitle}</h2></div><p className="section-description">{h.destText}</p></div><div className="country-grid">{keys.map(key => <Link key={key} to={countryPaths[key]} params={lp} className="country-card"><div className="country-card-photo"><img src={photos[key].url} alt={`${countries[key].city}, ${countries[key].name}`} loading="lazy" /></div><div className="country-card-info"><div className="country-card-title"><h3>{countries[key].name}</h3><ArrowUpRight size={20} /></div><ul className="country-card-offer">{o.tabs.map((label, i) => <li key={label}><strong>{label}</strong><span>{o.countries[key].cards[i]}</span></li>)}</ul></div></Link>)}</div></section>
    <section className="audience-section section-space"><div className="site-wrap"><div className="section-heading section-heading-stacked"><div><Eyebrow>{o.pillarsEyebrow}</Eyebrow><h2 className="section-title">{o.pillarsTitle}</h2></div><p className="section-description">{o.pillarsText}</p></div><div className="pillar-grid">{o.pillars.map((pillar, i) => { const Icon = [BriefcaseBusiness, UserRound, Building2][i] ?? Building2; return <div className="pillar-item" key={pillar.title}><Icon size={25} strokeWidth={1.3} /><h3>{pillar.title}</h3><p>{pillar.text}</p><div className="pillar-links">{keys.map(key => <Link key={key} to={countryPaths[key]} params={lp} hash={pillarSlugs[i] ?? ''} className="text-link">{countries[key].short} <ArrowUpRight size={15} /></Link>)}</div></div>; })}</div></div></section>
    <section className="section-space site-wrap"><div className="section-heading section-heading-stacked"><div><Eyebrow>{h.methodEyebrow}</Eyebrow><h2 className="section-title">{h.methodTitle}</h2></div><p className="section-description">{h.methodText1}<br />{h.methodText2}</p></div><div className="process-grid">{h.steps.map((step, i) => <div className="process-step" key={step.title}><span className="step-number">0{i + 1}</span><h3>{step.title}</h3><p>{step.text}</p></div>)}</div></section>
    <Testimonials /><DaryaSection /><ContactBand />
  </>;
}
