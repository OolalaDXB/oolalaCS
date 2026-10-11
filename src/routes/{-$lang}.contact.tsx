import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowUpRight, CalendarDays, MapPin, Phone, MessageCircle } from 'lucide-react';
import { ContactForm } from '@/components/oolala/contact-form';
import { Eyebrow } from '@/components/oolala/shared';
import { whatsappUrl } from '@/lib/oolala';
import { localeHead, useT } from '@/lib/i18n';
import portrait from '@/assets/darya.png.asset.json';
export const Route = createFileRoute('/{-$lang}/contact')({ head: ({ params }) => localeHead(params.lang, 'contact', '/contact'), component: ContactPage });
function ContactPage() {
  const { t, lp } = useT(); const c = t.contact;
  return <><section className="site-wrap page-intro"><Eyebrow>{c.eyebrow}</Eyebrow><h1 className="page-title">{c.title}</h1><p className="page-lead">{c.lead}</p></section><div className="site-wrap contact-grid"><div><div className="contact-details"><a className="contact-detail" href="tel:+971506838777"><Phone size={19} /><span><small>{c.phone}</small>+971 50 683 8777</span></a><a className="contact-detail" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={19} /><span><small>{c.direct}</small>{c.whatsapp}</span></a><div className="contact-detail"><MapPin size={19} /><span><small>{c.city}</small>The Sustainable City<br />PO 506575, Dubai, UAE</span></div></div><div className="contact-person"><img src={portrait.url} alt="Darya" /><span><strong>{c.person}</strong><small>Français · English · Русский</small></span></div><aside className="contact-booking"><CalendarDays size={22} strokeWidth={1.4} aria-hidden="true" /><h2>{c.bookTitle}</h2><p>{c.bookText}</p><Link className="text-link" to="/{-$lang}/rendez-vous" params={lp}>{c.bookCta} <ArrowUpRight size={15} /></Link></aside></div><ContactForm /></div></>;
}
