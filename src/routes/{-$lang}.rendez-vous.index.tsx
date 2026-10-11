import { createFileRoute } from '@tanstack/react-router';
import { BookingFlow } from '@/components/oolala/booking';
import { DaryaSection, Eyebrow } from '@/components/oolala/shared';
import { localeHead, useT } from '@/lib/i18n';

export const Route = createFileRoute('/{-$lang}/rendez-vous/')({ head: ({ params }) => localeHead(params.lang, 'booking', '/rendez-vous'), component: BookingPage });
function BookingPage() {
  const { t } = useT(); const b = t.booking;
  return <><section className="page-intro site-wrap"><Eyebrow>{b.eyebrow}</Eyebrow><h1 className="page-title">{b.title}</h1><p className="page-lead">{b.lead}</p></section><div className="site-wrap booking-page"><BookingFlow /></div><DaryaSection /></>;
}
