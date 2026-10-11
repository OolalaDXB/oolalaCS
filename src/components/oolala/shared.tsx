import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import portrait from '@/assets/darya.png.asset.json';
import { testimonials, type CountryKey } from '@/lib/oolala';

export function Eyebrow({ children }: { children: React.ReactNode }) { return <div className="eyebrow"><span className="eyebrow-dot" />{children}</div>; }
export function ContactBand() { return <section className="cta-band"><div className="site-wrap cta-inner"><div><h2>Votre prochain chapitre commence ici.</h2><p>Un projet précis, une idée ou plusieurs pays en tête ? Parlons-en.</p></div><Button size="lg" asChild><Link to="/contact">Parler de votre projet <ArrowUpRight /></Link></Button></div></section>; }
export function DaryaSection() { return <section className="darya-section section-space"><div className="site-wrap darya-grid"><img src={portrait.url} alt="Darya, fondatrice d’Oolala Corporate Services" className="darya-photo" loading="lazy" /><div className="darya-copy"><Eyebrow>Une relation, avant tout</Eyebrow><h2 className="section-title">Votre projet.<br />Une interlocutrice dédiée.</h2><p>Bonjour, je suis Darya, fondatrice d’Oolala. Vous travaillez directement avec moi, de la première discussion au suivi de votre société.</p><p>Je prends le temps de comprendre votre projet, de vous expliquer vos options et de coordonner les bons partenaires locaux, dans le bon ordre. Vous gardez vos documents, vos accès et une vision claire de vos prochaines étapes.</p><div className="signature">Darya</div><span className="darya-role">Fondatrice · Français, anglais et russe</span><Button asChild><Link to="/contact">Échanger avec Darya <ArrowUpRight /></Link></Button></div></div></section>; }
export function Testimonials({ country }: { country?: CountryKey }) {
  const items = country ? testimonials.filter(item => item.country === country) : testimonials;
  if (!items.length) return null;
  return <section className="audience-section section-space" aria-labelledby="testimonials-title"><div className="site-wrap"><Eyebrow>Ils nous ont fait confiance</Eyebrow><h2 className="section-title" id="testimonials-title">Leurs mots, leur projet.</h2><div className="testimonial-grid">{items.map(item => <figure className="testimonial" key={item.name + item.quote}><blockquote>{item.quote}</blockquote><figcaption><strong>{item.name}</strong>{item.context}</figcaption></figure>)}</div></div></section>;
}
