import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type CountryKey } from '@/lib/oolala';
import { useT } from '@/lib/i18n';
import { ContactBand, DaryaSection, Eyebrow } from './shared';
import { UaeBankNetwork } from './uae-network';
import dubai from '@/assets/dubai.jpg.asset.json';
import tbilisi from '@/assets/tbilisi.jpg.asset.json';
import paris from '@/assets/paris.jpg.asset.json';

const photos = { emirats: dubai, georgie: tbilisi, france: paris };
export function CountryPage({ country }: { country: CountryKey }) {
  const { t, lp } = useT(); const c = t.country;
  const data = t.countries[country];
  const [audience, setAudience] = useState<'business' | 'personal'>('business');
  const services = audience === 'business' ? data.services : data.services.filter(service => (service as { personal?: boolean }).personal);
  return <><section className="page-intro site-wrap reveal"><Eyebrow>Oolala · {data.city}</Eyebrow><h1 className="page-title">{data.title}</h1><p className="page-lead">{data.intro}</p></section><div className="site-wrap country-hero-grid"><img className="country-main-photo" src={photos[country].url} alt={`${c.photoAlt} ${data.city}`} /><div className="country-facts"><div className="country-fact"><strong>{data.city}</strong><span>{c.factCity}</span></div>{data.tags.map((tag, i) => <div className="country-fact" key={tag}><strong>{tag}</strong><span>{c.facts[i]}</span></div>)}</div></div><section className="site-wrap section-space"><div className="section-heading"><div><Eyebrow>{c.servicesEyebrow}</Eyebrow><h2 className="section-title">{c.servicesTitle}</h2></div></div><div role="tablist" aria-label={c.profile} className="service-tabs"><Button id="tab-business" role="tab" aria-selected={audience === 'business'} aria-controls="services" variant={audience === 'business' ? 'default' : 'ghost'} onClick={() => setAudience('business')}>{c.business}</Button><Button id="tab-personal" role="tab" aria-selected={audience === 'personal'} aria-controls="services" variant={audience === 'personal' ? 'default' : 'ghost'} onClick={() => setAudience('personal')}>{c.personal}</Button></div><div id="services" role="tabpanel" aria-labelledby={`tab-${audience}`}>
    {country === 'georgie' && audience === 'personal' && <InvestmentTeaser />}
    {audience === 'personal' && country !== 'france' && <article className="service-row"><div><h3>{c.bankTitle}</h3><p>{c.bankDesc}</p></div><div><p>{c.bankText}</p></div></article>}
    {services.map(service => <article className="service-row" key={service.title}><div><h3>{service.title}</h3><p>{service.description}</p></div><div><ul>{service.items.map(item => <li key={item}><Check size={15} /><span>{item}</span></li>)}</ul><div className="outcome"><strong>{c.outcome}</strong>{service.outcome}</div></div></article>)}
    {audience === 'personal' && <article className="service-row"><div><h3>{c.installTitle}</h3><p>{c.installDesc}</p></div><div><p>{c.installText}</p><Link className="text-link" to="/{-$lang}/contact" params={lp}>{c.installCta} <ArrowUpRight size={15} /></Link></div></article>}
    </div>{country === 'georgie' && <InvestmentTeaser />}</section>{country === 'emirats' && <UaeBankNetwork />}<DaryaSection /><ContactBand /></>;
}
function InvestmentTeaser() { const { t, lp } = useT(); const c = t.country; return <aside className="investment-teaser"><div><h3>{c.teaserTitle}</h3><p>{c.teaserText}</p></div><Button asChild><Link to="/{-$lang}/georgie/investir" params={lp}>{c.discover} <ArrowUpRight /></Link></Button></aside>; }
