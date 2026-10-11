import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type CountryKey, pillarSlugs } from '@/lib/oolala';
import { useT } from '@/lib/i18n';
import { ContactBand, DaryaSection, Eyebrow, Testimonials } from './shared';
import { UaeBankNetwork } from './uae-network';
const photos = { emirats: { url: '/images/dubai.jpg' }, georgie: { url: '/images/tbilisi.jpg' }, france: { url: '/images/paris.jpg' } };

export function CountryPage({ country }: { country: CountryKey }) {
  const { t, lp } = useT(); const c = t.country; const o = t.offer; const L = o.labels;
  const data = t.countries[country];
  const [tab, setTab] = useState(0);
  useEffect(() => {
    const sync = () => { const i = pillarSlugs.indexOf(window.location.hash.slice(1) as (typeof pillarSlugs)[number]); if (i >= 0) { setTab(i); document.getElementById('services')?.scrollIntoView(); } };
    sync(); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync);
  }, []);
  const select = (i: number) => { setTab(i); history.replaceState(null, '', `#${pillarSlugs[i]}`); };
  const p = o.countries[country].pillars[tab] ?? o.countries[country].pillars[0]!;
  const list = (items: string[]) => <ul>{items.map(item => <li key={item}><Check size={15} /><span>{item}</span></li>)}</ul>;
  return <><section className="page-intro site-wrap reveal"><Eyebrow>Oolala · {data.city}</Eyebrow><h1 className="page-title">{data.title}</h1><p className="page-lead">{data.intro}</p></section>
    <div className="site-wrap country-hero-grid"><img className="country-main-photo" src={photos[country].url} alt={`${c.photoAlt} ${data.city}`} /><div className="country-facts">{o.tabs.map((label, i) => <a href={`#${pillarSlugs[i]}`} className="country-fact" key={label}><strong>{label}</strong><span>{o.countries[country].cards[i]}</span></a>)}</div></div>
    <section id="services" className="site-wrap section-space"><div className="section-heading"><div><Eyebrow>{c.servicesEyebrow}</Eyebrow><h2 className="section-title">{c.servicesTitle}</h2></div></div>
      <div role="tablist" aria-label={L.tablist} className="service-tabs">{o.tabs.map((label, i) => <Button key={label} id={`tab-${pillarSlugs[i]}`} role="tab" aria-selected={tab === i} aria-controls="pillar-panel" variant={tab === i ? 'default' : 'ghost'} onClick={() => select(i)}>{label}</Button>)}</div>
      <div id="pillar-panel" role="tabpanel" aria-labelledby={`tab-${pillarSlugs[tab]}`} key={tab}>
        <article className="service-row"><div><h3>{o.tabs[tab]}</h3><p>{p.intro}</p></div><div><strong className="pillar-label">{L.audience}</strong><p>{p.audience}</p></div></article>
        {p.blocks.map(block => <article className="service-row" key={block.title}><div><span className="pillar-label">{L.handled}</span><h3>{block.title}</h3></div><div>{list(block.items)}</div></article>)}
        <article className="service-row"><div><h3>{L.partners}</h3></div><div>{list(p.partners)}</div></article>
        <article className="service-row"><div><h3>{L.deliverables}</h3></div><div>{list(p.deliverables)}<div className="outcome"><strong>{L.next}</strong>{p.next}</div>
          {country === 'georgie' && tab === 2
            ? <Button asChild><Link to="/{-$lang}/georgie/investir" params={lp}>{L.investLink} <ArrowUpRight /></Link></Button>
            : <Link className="text-link" to="/{-$lang}/contact" params={lp}>{L.start} <ArrowUpRight size={15} /></Link>}
        </div></article>
      </div>
    </section>{'plans' in data && <CountryPlans plans={data.plans} />}<CountryVisas visas={data.visas} />{'zones' in data && <FreeZones zones={data.zones} />}{country === 'emirats' && <UaeBankNetwork />}<Testimonials country={country} />{'faq' in data && <CountryFaq faq={data.faq} />}<DaryaSection /><ContactBand /></>;
}
type Plan = { name: string; lead: string; price: string; priceNote: string; items: string[] };
type Visas = { intro: string; types: { name: string; audience: string; text: string }[]; steps?: string[] };
type FreeZone = { name: string; place: string; lead: string; text: string; points: string[]; fit: string };
type Faq = { question: string; answer: string };
function CountryPlans({ plans }: { plans: Plan[] }) { const { t, lp } = useT(); const c = t.country; return <section className="audience-section section-space" aria-labelledby="plans-title"><div className="site-wrap"><div className="section-heading"><div><Eyebrow>{c.plansEyebrow}</Eyebrow><h2 className="section-title" id="plans-title">{c.plansTitle}</h2></div><p className="section-description">{c.plansText}</p></div><div className="plan-grid">{plans.map(plan => <article className="plan-card" key={plan.name}><h3>{plan.name}</h3><p>{plan.lead}</p><div className="plan-price"><strong>{plan.price}</strong><span>{plan.priceNote}</span></div><ul>{plan.items.map(item => <li key={item}><Check size={15} /><span>{item}</span></li>)}</ul><Link className="text-link" to="/{-$lang}/contact" params={lp}>{c.quote} <ArrowUpRight size={15} /></Link></article>)}</div><p className="network-caveat">{c.plansNote}</p></div></section>; }
function CountryVisas({ visas }: { visas: Visas }) { const { t } = useT(); const c = t.country; return <section className="audience-section section-space" aria-labelledby="visas-title"><div className="site-wrap"><div className="section-heading"><div><Eyebrow>{c.visasEyebrow}</Eyebrow><h2 className="section-title" id="visas-title">{c.visasTitle}</h2></div><p className="section-description">{visas.intro}</p></div><div className="visa-grid">{visas.types.map(visa => <article className="visa-card" key={visa.name}><span className="zone-place">{visa.audience}</span><h3>{visa.name}</h3><p>{visa.text}</p></article>)}</div>{visas.steps && <ol className="visa-steps">{visas.steps.map((step, i) => <li key={step}><span>0{i + 1}</span>{step}</li>)}</ol>}<p className="network-caveat">{c.visasNote}</p></div></section>; }
function FreeZones({ zones }: { zones: FreeZone[] }) { const { t } = useT(); const c = t.country; return <section className="audience-section section-space" aria-labelledby="zones-title"><div className="site-wrap"><div className="section-heading"><div><Eyebrow>{c.zonesEyebrow}</Eyebrow><h2 className="section-title" id="zones-title">{c.zonesTitle}</h2></div><p className="section-description">{c.zonesText}</p></div><div className="zone-grid">{zones.map(zone => <article className="zone-card" key={zone.name}><span className="zone-place">{zone.place}</span><h3>{zone.name}</h3><p className="zone-lead">{zone.lead}</p><p>{zone.text}</p><ul>{zone.points.map(point => <li key={point}><Check size={15} /><span>{point}</span></li>)}</ul><div className="outcome"><strong>{c.zoneFit}</strong>{zone.fit}</div></article>)}</div><p className="network-caveat">{c.zonesNote}</p></div></section>; }
function CountryFaq({ faq }: { faq: Faq[] }) { const { t, lp } = useT(); const c = t.country; return <section className="site-wrap section-space faq-layout" aria-labelledby="faq-title"><div><Eyebrow>{c.faqEyebrow}</Eyebrow><h2 className="section-title" id="faq-title">{c.faqTitle}</h2><Link className="text-link" to="/{-$lang}/contact" params={lp}>{c.faqCta} <ArrowUpRight size={15} /></Link></div><div>{faq.map(item => <details className="faq-item" key={item.question}><summary>{item.question}<Plus size={18} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div></section>; }
