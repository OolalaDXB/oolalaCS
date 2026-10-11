import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { countries, type CountryKey } from '@/lib/oolala';
import { ContactBand, DaryaSection, Eyebrow } from './shared';
import dubai from '@/assets/dubai.jpg.asset.json';
import tbilisi from '@/assets/tbilisi.jpg.asset.json';
import paris from '@/assets/paris.jpg.asset.json';

const photos = { emirats: dubai, georgie: tbilisi, france: paris };
export function CountryPage({ country }: { country: CountryKey }) {
  const data = countries[country];
  const [audience, setAudience] = useState<'business' | 'personal'>('business');
  const services = audience === 'business' ? data.services : data.services.filter(service => service.title.includes('Banque') || service.title.includes('séjour') || service.title.includes('Séjour') || service.title.includes('Visas'));
  return <><section className="page-intro site-wrap reveal"><Eyebrow>Oolala · {data.city}</Eyebrow><h1 className="page-title">Votre projet aux Émirats.</h1>{country !== 'emirats' && <h2 className="sr-only">{data.name}</h2>}<p className="page-lead">{data.intro}</p></section><div className="site-wrap country-hero-grid"><img className="country-main-photo" src={photos[country].url} alt={`Vue de ${data.city}`} /><div className="country-facts"><div className="country-fact"><strong>{data.city}</strong><span>Entreprendre, s’installer et construire la suite.</span></div>{data.tags.map((tag, i) => <div className="country-fact" key={tag}><strong>{tag}</strong><span>{['Une solution étudiée selon votre activité.', 'Des démarches coordonnées avec les acteurs locaux.', 'Un accompagnement personnel dans la durée.'][i]}</span></div>)}</div></div><section className="site-wrap section-space"><div className="section-heading"><div><Eyebrow>Les services Oolala</Eyebrow><h2 className="section-title">Ce dont vous avez besoin, au bon moment.</h2></div></div><div role="tablist" aria-label="Votre profil" className="service-tabs"><Button id="tab-business" role="tab" aria-selected={audience === 'business'} aria-controls="services" variant={audience === 'business' ? 'default' : 'ghost'} onClick={() => setAudience('business')}>Entreprises</Button><Button id="tab-personal" role="tab" aria-selected={audience === 'personal'} aria-controls="services" variant={audience === 'personal' ? 'default' : 'ghost'} onClick={() => setAudience('personal')}>Particuliers</Button></div><div id="services" role="tabpanel" aria-labelledby={`tab-${audience}`}>
    {country === 'georgie' && audience === 'personal' && <InvestmentTeaser />}
    {services.map(service => <article className="service-row" key={service.title}><div><h3>{service.title}</h3><p>{service.description}</p></div><div><ul>{service.items.map(item => <li key={item}><Check size={15} /><span>{item}</span></li>)}</ul><div className="outcome"><strong>Vous obtenez</strong>{service.outcome}</div></div></article>)}
    {audience === 'personal' && <article className="service-row"><div><h3>Votre installation, coordonnée</h3><p>Votre projet de vie et celui de votre famille, préparés ensemble.</p></div><div><p>Nous précisons votre situation, vos priorités et les démarches adaptées à votre séjour. Darya coordonne les partenaires locaux selon les besoins de votre dossier.</p><Link className="text-link" to="/contact">Parler de votre installation <ArrowUpRight size={15} /></Link></div></article>}
    </div>{country === 'georgie' && <InvestmentTeaser />}</section><DaryaSection /><ContactBand /></>;
}
function InvestmentTeaser() { return <aside className="investment-teaser"><div><h3>Investir en Géorgie</h3><p>Des biens achevés à Gudauri et Tbilissi, sélectionnés selon votre projet. De la recherche à la transaction, puis à la gestion locative.</p></div><Button asChild><Link to="/georgie/investir">Découvrir <ArrowUpRight /></Link></Button></aside>; }