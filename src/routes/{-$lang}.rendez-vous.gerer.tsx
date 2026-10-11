import { useEffect, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowUpRight, CalendarDays, MapPin, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/oolala/shared';
import { formatWhen, ModeIcon } from '@/components/oolala/booking';
import { localeHead, useT } from '@/lib/i18n';
import { solo, visitorTimeZone, type SoloBooking } from '@/lib/solo';

type Search = { ref?: string | undefined; token?: string | undefined };
export const Route = createFileRoute('/{-$lang}/rendez-vous/gerer')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ref: typeof search['ref'] === 'string' ? search['ref'].slice(0, 20) : undefined,
    token: typeof search['token'] === 'string' ? search['token'].slice(0, 100) : undefined,
  }),
  head: ({ params }) => { const head = localeHead(params.lang, 'manage', '/rendez-vous/gerer'); return { ...head, meta: [...head.meta, { name: 'robots', content: 'noindex, nofollow' }] }; },
  component: ManagePage,
});

function ManagePage() {
  const { t, lang, lp } = useT(); const m = t.manage;
  const { ref, token } = Route.useSearch();
  const [booking, setBooking] = useState<SoloBooking | null>(null);
  const [missing, setMissing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const tz = typeof window === 'undefined' ? 'Asia/Dubai' : visitorTimeZone();

  useEffect(() => {
    if (!ref || !token) { setMissing(true); return; }
    solo<SoloBooking>('booking', { ref, token }).then(setBooking).catch(() => setMissing(true));
  }, [ref, token]);

  async function cancel(reason: string) {
    if (!ref || !token) return;
    setBusy(true);
    try {
      await solo('cancel', { ref, token, reason });
      setBooking(await solo<SoloBooking>('booking', { ref, token }));
      setAsking(false);
    } catch {
      setMissing(true);
    } finally {
      setBusy(false);
    }
  }

  return <section className="page-intro site-wrap">
    <Eyebrow>{m.eyebrow}</Eyebrow>
    {missing ? <><h1 className="page-title">{t.meta.manage[0]}.</h1><p className="page-lead">{m.missing}</p><Button asChild className="mt-8"><Link to="/{-$lang}/rendez-vous" params={lp}>{m.rebook} <ArrowUpRight /></Link></Button></>
      : !booking ? <p className="page-lead">{t.booking.loading}</p>
      : <>
        <h1 className="page-title">{booking.title}</h1>
        <dl className="booking-facts">
          <div><dt>{m.statusLabel}</dt><dd><span className={`status-pill is-${booking.status}`}>{m.status[booking.status]}</span></dd></div>
          <div><dt>{m.when}</dt><dd><CalendarDays size={15} aria-hidden="true" /> {formatWhen(booking.starts_at, lang, tz, true)}</dd></div>
          <div><dt>{t.booking.place}</dt><dd><ModeIcon mode={booking.mode} /> {booking.location_name ?? (booking.mode === 'phone' ? t.booking.phone : t.booking.video)}{booking.location_address && <><br />{booking.location_address}</>}{booking.client_note && <><br /><small>{booking.client_note}</small></>}</dd></div>
          <div><dt>{t.booking.ref}</dt><dd>{booking.ref}</dd></div>
        </dl>
        {booking.status === 'cancelled' && <p className="booking-muted">{m.cancelled}</p>}
        <div className="hero-buttons">
          {booking.maps_url && <Button asChild variant="ghost"><a href={booking.maps_url} target="_blank" rel="noreferrer"><MapPin /> {m.map}</a></Button>}
          {booking.meeting_url && booking.status === 'confirmed' && <Button asChild><a href={booking.meeting_url} target="_blank" rel="noreferrer"><Video /> {m.join}</a></Button>}
          {booking.status === 'cancelled' && <Button asChild><Link to="/{-$lang}/rendez-vous" params={lp}>{m.rebook} <ArrowUpRight /></Link></Button>}
          {booking.can_cancel && !asking && <Button type="button" variant="ghost" onClick={() => setAsking(true)}>{m.cancel}</Button>}
        </div>
        {booking.can_cancel && asking && <form className="contact-form booking-cancel" onSubmit={e => { e.preventDefault(); cancel(String(new FormData(e.currentTarget).get('reason') ?? '')); }}>
          <div className="field"><label htmlFor="reason">{m.cancelReason}</label><textarea id="reason" name="reason" maxLength={1000} /></div>
          <div className="hero-buttons"><Button type="submit" disabled={busy}>{m.cancelConfirm}</Button><Button type="button" variant="ghost" onClick={() => setAsking(false)}>{m.keep}</Button></div>
        </form>}
      </>}
  </section>;
}
