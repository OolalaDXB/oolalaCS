import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type CountryKey, pillarSlugs } from '@/lib/oolala';
import { useT } from '@/lib/i18n';
import { ContactBand, DaryaSection, Eyebrow } from './shared';
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
    </section>{country === 'emirats' && <UaeBankNetwork />}<DaryaSection /><ContactBand /></>;
}
