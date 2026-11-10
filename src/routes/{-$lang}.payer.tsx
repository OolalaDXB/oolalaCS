import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { CreditCard, MessageCircle, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/oolala/shared';
import { InvoiceDocument } from '@/components/invoice-document';
import { localeHead, useT } from '@/lib/i18n';
import { money, type InvoiceDoc } from '@/lib/invoice';
import { whatsappUrl } from '@/lib/oolala';
import { payEndpoint, solo } from '@/lib/solo';

// The client's invoice page: /payer?n=<number>&t=<token>, sent by Darya.
type Search = { n?: string | undefined; t?: string | undefined; paid?: string | undefined };
export const Route = createFileRoute('/{-$lang}/payer')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    n: typeof search['n'] === 'string' ? search['n'].slice(0, 40) : undefined,
    t: typeof search['t'] === 'string' ? search['t'].slice(0, 64) : undefined,
    paid: search['paid'] === '1' || search['paid'] === 1 ? '1' : undefined,
  }),
  head: ({ params }) => { const head = localeHead(params.lang, 'pay', '/payer'); return { ...head, meta: [...head.meta, { name: 'robots', content: 'noindex, nofollow' }] }; },
  component: PayPage,
});

function PayPage() {
  const { t, lang } = useT(); const p = t.pay;
  const { n, t: token, paid } = Route.useSearch();
  const [doc, setDoc] = useState<InvoiceDoc | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cardError, setCardError] = useState(false);

  useEffect(() => {
    if (!n || !token) { setMissing(true); return; }
    let alive = true; let tries = 0;
    const load = () => solo<InvoiceDoc>('invoice', { number: n, token }, payEndpoint).then(d => {
      if (!alive) return; setDoc(d);
      // back from the card page: the confirmation arrives a few seconds later
      if (paid && d.state !== 'paid' && tries++ < 10) setTimeout(load, 3000);
    }).catch(() => alive && setMissing(true));
    load();
    return () => { alive = false; };
  }, [n, token, paid]);

  async function card() {
    if (!n || !token) return;
    setBusy(true); setCardError(false);
    try { const r = await solo<{ url: string }>('checkout', { number: n, token, lang }, payEndpoint); window.location.assign(r.url); }
    catch { setCardError(true); setBusy(false); }
  }
  function print() {
    document.body.dataset['print'] = 'invoice';
    const done = () => { delete document.body.dataset['print']; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  }

  const open = doc && doc.state !== 'paid' && doc.state !== 'cancelled' && doc.balance > 0;
  return <section className="page-intro site-wrap pay-page">
    <Eyebrow>{p.eyebrow}</Eyebrow>
    {missing ? <><h1 className="page-title">{t.meta.pay[0]}.</h1><p className="page-lead">{p.missing}</p>
      <Button asChild variant="outline" className="mt-8"><a href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle /> {p.whatsapp}</a></Button></>
      : !doc ? <p className="page-lead">{p.loading}</p>
      : <>
        <div className="pay-summary">
          <div><h1 className="page-title">{doc.number}</h1>
            {doc.state === 'paid' ? <p className="page-lead">{paid ? p.thanks : p.paid}</p>
              : doc.state === 'cancelled' ? <p className="page-lead">{p.cancelled}</p>
              : paid ? <p className="page-lead">{p.confirming}</p>
              : <p className="pay-balance"><span>{p.balance}</span><strong>{money(doc.balance, doc.currency, lang)}</strong></p>}</div>
          <div className="pay-actions">
            {open && doc.card && !paid && <><Button size="lg" onClick={card} disabled={busy}><CreditCard /> {busy ? p.redirecting : p.card}</Button><small>{p.cardNote}</small></>}
            {cardError && <p className="booking-error">{p.cardError}</p>}
            {open && doc.issuer.iban && <small>{p.transfer}</small>}
            <div className="pay-secondary"><Button variant="ghost" size="sm" onClick={print}><Printer /> {p.print}</Button>
              <Button variant="ghost" size="sm" asChild><a href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle /> {p.question}</a></Button></div>
          </div>
        </div>
        <InvoiceDocument doc={doc} lang={lang} />
      </>}
  </section>;
}
