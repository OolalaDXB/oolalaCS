import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';
const portrait = { url: '/images/darya.png' };

export function Eyebrow({ children }: { children: React.ReactNode }) { return <div className="eyebrow"><span className="eyebrow-dot" />{children}</div>; }
export function ContactBand() { const { t, lp } = useT(); return <section className="cta-band"><div className="site-wrap cta-inner"><div><h2>{t.band.title}</h2><p>{t.band.text}</p></div><Button size="lg" asChild><Link to="/{-$lang}/contact" params={lp}>{t.band.cta} <ArrowUpRight /></Link></Button></div></section>; }
export function DaryaSection() { const { t, lp } = useT(); const d = t.darya; return <section className="darya-section section-space"><div className="site-wrap darya-grid"><img src={portrait.url} alt={d.alt} className="darya-photo" loading="lazy" /><div className="darya-copy"><Eyebrow>{d.eyebrow}</Eyebrow><h2 className="section-title">{d.title1}<br />{d.title2}</h2><p>{d.p1}</p><p>{d.p2}</p><div className="signature">Darya</div><span className="darya-role">{d.role}</span><Button asChild><Link to="/{-$lang}/contact" params={lp}>{d.cta} <ArrowUpRight /></Link></Button></div></div></section>; }
