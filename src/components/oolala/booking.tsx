import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Building2, CalendarDays, Check, ChevronLeft, ChevronRight, Copy, MapPin, MessageCircle, Phone, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { localizedPath, useT, type Lang } from '@/lib/i18n';
import { whatsappUrl } from '@/lib/oolala';
import { dayKey, isoDate, solo, SoloError, visitorTimeZone, type SoloBooked, type SoloSlot, type SoloType } from '@/lib/solo';

const locales: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB', ru: 'ru-RU' };
const WINDOW_DAYS = 14;

export function ModeIcon({ mode }: { mode: SoloType['mode'] }) {
  if (mode === 'phone') return <Phone size={15} aria-hidden="true" />;
  if (mode === 'in_person') return <Building2 size={15} aria-hidden="true" />;
  return <Video size={15} aria-hidden="true" />;
}

export function formatWhen(iso: string, lang: Lang, timeZone: string, withYear = false) {
  return new Intl.DateTimeFormat(locales[lang], { timeZone, weekday: 'long', day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}), hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function BookingFlow() {
  const { t, lang } = useT(); const b = t.booking;
  const tz = useMemo(() => (typeof window === 'undefined' ? 'Asia/Dubai' : visitorTimeZone()), []);
  const [types, setTypes] = useState<SoloType[] | null>(null);
  const [typeSlug, setTypeSlug] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const [slots, setSlots] = useState<SoloSlot[] | null>(null);
  const [day, setDay] = useState('');
  const [slot, setSlot] = useState<SoloSlot | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState<SoloBooked | null>(null);

  useEffect(() => {
    let live = true;
    solo<SoloType[]>('types', { lang }).then(list => {
      if (!live) return;
      setTypes(list);
      setTypeSlug(current => (list.some(item => item.slug === current) ? current : list[0]?.slug ?? ''));
    }).catch(() => live && setUnavailable(true));
    return () => { live = false; };
  }, [lang]);

  useEffect(() => {
    if (!typeSlug) return;
    let live = true;
    setSlots(null); setSlot(null);
    const from = new Date(Date.now() + offset * WINDOW_DAYS * 86400000);
    const to = new Date(from.getTime() + (WINDOW_DAYS - 1) * 86400000);
    solo<{ slots: SoloSlot[] }>('slots', { type: typeSlug, from: isoDate(from), to: isoDate(to) })
      .then(r => { if (live) { setSlots(r.slots); setDay(r.slots[0] ? dayKey(r.slots[0].starts_at, tz) : ''); } })
      .catch(() => live && setUnavailable(true));
    return () => { live = false; };
  }, [typeSlug, offset, tz]);

  const type = types?.find(item => item.slug === typeSlug) ?? null;
  const days = useMemo(() => {
    const map = new Map<string, SoloSlot[]>();
    for (const s of slots ?? []) { const k = dayKey(s.starts_at, tz); map.set(k, [...(map.get(k) ?? []), s]); }
    return map;
  }, [slots, tz]);
  const needsApproval = !!type?.requires_approval;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!type || !slot) return;
    const data = new FormData(event.currentTarget);
    if (data.get('website')) return;
    setSending(true); setError('');
    try {
      const result = await solo<SoloBooked>('book', {
        type: type.slug, starts_at: slot.starts_at, name: data.get('name'), email: data.get('email'), phone: data.get('phone'),
        message: data.get('message'), lang, client_tz: tz,
      });
      setBooked(result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      const code = e instanceof SoloError ? e.message : 'generic';
      setError(code in b.errors ? b.errors[code as keyof typeof b.errors] : b.errors.generic);
      if (code === 'slot_unavailable') { setSlot(null); setSlots(s => s?.filter(x => x.starts_at !== slot.starts_at) ?? null); }
    } finally {
      setSending(false);
    }
  }

  if (booked) return <BookingDone booked={booked} tz={tz} />;
  if (unavailable) return <div className="booking-notice"><p>{b.unavailable}</p><Button asChild><a href={whatsappUrl} target="_blank" rel="noreferrer">{b.whatsapp} <ArrowUpRight /></a></Button></div>;

  return <div className="booking-layout">
    <div className="booking-steps">
      <section className="booking-step" aria-labelledby="step-type">
        <h2 id="step-type"><span>01</span>{b.step1}</h2>
        {!types ? <p className="booking-muted">{b.loading}</p> : <div className="type-grid">{types.map(item =>
          <button type="button" key={item.slug} className="type-option" aria-pressed={item.slug === typeSlug} onClick={() => { setTypeSlug(item.slug); setOffset(0); }}>
            <strong>{item.title}</strong>
            {item.description && <span className="type-description">{item.description}</span>}
            <span className="type-meta"><ModeIcon mode={item.mode} />{item.duration_min} {b.minutes} · {item.mode === 'in_person' ? (item.location?.city ?? b.inPerson) : item.mode === 'phone' ? b.phone : b.video} · {item.price_amount > 0 ? `${item.price_amount} ${item.currency}` : item.requires_approval ? b.onRequest : b.free}</span>
          </button>)}</div>}
      </section>

      <section className="booking-step" aria-labelledby="step-time">
        <h2 id="step-time"><span>02</span>{b.step2}</h2>
        <div className="booking-range">
          <Button type="button" variant="ghost" size="sm" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - 1))}><ChevronLeft /> {b.earlier}</Button>
          <Button type="button" variant="ghost" size="sm" disabled={offset >= 3} onClick={() => setOffset(o => o + 1)}>{b.later} <ChevronRight /></Button>
        </div>
        {!slots ? <p className="booking-muted">{b.loading}</p> : days.size === 0 ? <p className="booking-muted">{b.noSlots}</p> : <>
          <div className="day-strip" role="listbox" aria-label={b.step2}>{[...days.keys()].map(k => {
            const date = new Date(`${k}T12:00:00Z`);
            return <button type="button" role="option" aria-selected={k === day} key={k} className="day-chip" onClick={() => { setDay(k); setSlot(null); }}>
              <small>{new Intl.DateTimeFormat(locales[lang], { weekday: 'short', timeZone: 'UTC' }).format(date)}</small>
              <strong>{new Intl.DateTimeFormat(locales[lang], { day: 'numeric', timeZone: 'UTC' }).format(date)}</strong>
              <small>{new Intl.DateTimeFormat(locales[lang], { month: 'short', timeZone: 'UTC' }).format(date)}</small>
            </button>;
          })}</div>
          <div className="time-grid">{(days.get(day) ?? []).map(s =>
            <button type="button" key={s.starts_at} className="time-chip" aria-pressed={slot?.starts_at === s.starts_at} onClick={() => setSlot(s)}>
              {new Intl.DateTimeFormat(locales[lang], { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(s.starts_at))}
            </button>)}</div>
          <p className="booking-tz">{b.tzNote} · {tz.replace('_', ' ')}</p>
        </>}
      </section>

      <section className="booking-step" aria-labelledby="step-details">
        <h2 id="step-details"><span>03</span>{b.step3}</h2>
        <form className="contact-form" onSubmit={submit}>
          <input className="hidden" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <div className="form-two"><div className="field"><label htmlFor="b-name">{b.name} *</label><input id="b-name" name="name" autoComplete="name" required maxLength={120} /></div><div className="field"><label htmlFor="b-email">{b.email} *</label><input id="b-email" name="email" type="email" autoComplete="email" required maxLength={200} /></div></div>
          <div className="field"><label htmlFor="b-phone">{b.phoneField}</label><input id="b-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} placeholder="+971 …" /></div>
          <div className="field"><label htmlFor="b-message">{b.message}</label><textarea id="b-message" name="message" maxLength={3000} /></div>
          <p className="form-consent">{b.consent}</p>
          {error && <p role="alert" className="booking-error">{error}</p>}
          <Button type="submit" className="form-submit" disabled={!slot || sending}>{sending ? b.sending : needsApproval ? b.submitRequest : b.submit} <ArrowUpRight /></Button>
          {!slot && <p className="booking-muted">{type ? b.pickSlot : b.pickType}</p>}
        </form>
      </section>
    </div>

    <aside className="booking-summary" aria-live="polite">
      <span className="zone-place">{b.summary}</span>
      {type ? <>
        <h3>{type.title}</h3>
        <p className="type-meta"><ModeIcon mode={type.mode} />{type.duration_min} {b.minutes} · {type.price_amount > 0 ? `${type.price_amount} ${type.currency}` : type.requires_approval ? b.onRequest : b.free}</p>
        {type.location && <p className="type-meta"><MapPin size={15} aria-hidden="true" />{[type.location.name, type.location.city].filter(Boolean).join(', ')}</p>}
        <p className="type-meta"><CalendarDays size={15} aria-hidden="true" />{slot ? formatWhen(slot.starts_at, lang, tz) : b.pickSlot}</p>
      </> : <p className="booking-muted">{b.pickType}</p>}
    </aside>
  </div>;
}

function BookingDone({ booked, tz }: { booked: SoloBooked; tz: string }) {
  const { t, lang, lp } = useT(); const b = t.booking;
  const [copied, setCopied] = useState(false);
  const path = localizedPath(lang, '/rendez-vous/gerer');
  const link = typeof window === 'undefined' ? path : `${window.location.origin}${path}?ref=${encodeURIComponent(booked.ref)}&token=${encodeURIComponent(booked.token)}`;
  const confirmed = booked.status === 'confirmed';
  return <div className="booking-done" role="status">
    <Check size={28} aria-hidden="true" />
    <h2 className="section-title">{confirmed ? b.confirmedTitle : b.pendingTitle}</h2>
    <p className="page-lead">{confirmed ? b.confirmedText : b.pendingText}</p>
    <dl className="booking-facts">
      <div><dt>{b.summary}</dt><dd>{booked.title}</dd></div>
      <div><dt>{t.manage.when}</dt><dd>{formatWhen(booked.starts_at, lang, tz, true)}</dd></div>
      {booked.location_name && <div><dt>{b.place}</dt><dd>{booked.location_name}{booked.location_address ? <><br />{booked.location_address}</> : null}</dd></div>}
      <div><dt>{b.ref}</dt><dd>{booked.ref}</dd></div>
    </dl>
    <p className="booking-muted">{b.keepLink}</p>
    <div className="hero-buttons">
      <Button asChild><Link to="/{-$lang}/rendez-vous/gerer" params={lp} search={{ ref: booked.ref, token: booked.token }}>{b.manage} <ArrowUpRight /></Link></Button>
      <Button type="button" variant="ghost" onClick={() => { navigator.clipboard?.writeText(link).then(() => setCopied(true)).catch(() => undefined); }}><Copy /> {copied ? b.copied : b.copy}</Button>
      <Button asChild variant="ghost"><a href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a></Button>
    </div>
  </div>;
}
