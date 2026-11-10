import { day, money, T, type InvoiceDoc, type Lang } from '@/lib/invoice';

// The invoice sheet: the same drawing in the back office and on the client's
// payment page, printable as a PDF from the browser.
export function InvoiceDocument({ doc, lang = doc.lang }: { doc: InvoiceDoc; lang?: Lang }) {
  const t = T[lang]; const m = (n: number) => money(n, doc.currency, lang);
  const i = doc.issuer; const c = doc.client;
  const hasVat = doc.vat_total > 0;
  const title = doc.status === 'draft' ? `${t.invoice} · ${t.draft}` : hasVat ? t.taxInvoice : t.invoice;
  return <article className={`invoice-doc is-${doc.state}`} lang={lang}>
    <header className="invoice-head">
      <div><img src="/images/oolala-cs-horizontal-dark.svg" alt={i.trade_name ?? 'Oolala'} className="invoice-logo" />
        <p className="invoice-issuer"><strong>{i.legal_name ?? i.trade_name}</strong>{i.legal_name && i.trade_name && i.trade_name !== i.legal_name && <><br />{i.trade_name}</>}
          {i.address && <><br />{i.address}</>}{i.licence && <><br />{t.licence} {i.licence}</>}{i.trn && <><br />{t.trn} {i.trn}</>}
          {(i.email || i.phone) && <><br />{[i.email, i.phone].filter(Boolean).join(' · ')}</>}</p></div>
      <div className="invoice-title"><h1>{title}</h1>
        <dl>{doc.number && <><dt>{t.number}</dt><dd>{doc.number}</dd></>}{doc.issue_date && <><dt>{t.issued}</dt><dd>{day(doc.issue_date, lang)}</dd></>}{doc.due_date && <><dt>{t.due}</dt><dd>{day(doc.due_date, lang)}</dd></>}</dl>
        {doc.state !== 'draft' && <span className={`invoice-stamp is-${doc.state}`}>{t.stamp[doc.state]}</span>}</div>
    </header>
    <section className="invoice-to"><h2>{t.to}</h2><p><strong>{c.company || c.name}</strong>{c.company && c.name && <><br />{c.name}</>}{c.address && <><br />{c.address}</>}
      {c.trn && <><br />{t.trn} {c.trn}</>}{(c.email || c.phone) && <><br />{[c.email, c.phone].filter(Boolean).join(' · ')}</>}</p></section>
    <div className="invoice-table-wrap"><table className="invoice-table">
      <thead><tr><th>{t.item}</th><th>{t.qty}</th><th>{t.unit}</th>{hasVat && <th>{t.vat}</th>}<th>{t.amount}</th></tr></thead>
      <tbody>{doc.lines.map((l, k) => <tr key={k}><td>{l.label}</td><td>{Number(l.quantity)}</td><td>{m(l.unit_amount)}</td>{hasVat && <td>{Number(l.vat_rate)} %</td>}<td>{m(l.net)}</td></tr>)}</tbody>
    </table></div>
    <div className="invoice-totals">
      {hasVat && <><p><span>{t.subtotal}</span><span>{m(doc.subtotal)}</span></p>{doc.vat_breakdown.filter(b => b.vat > 0).map(b => <p key={b.rate}><span>{t.vatTotal} {Number(b.rate)} %</span><span>{m(b.vat)}</span></p>)}</>}
      <p className="is-total"><span>{hasVat ? t.total : t.totalNoVat}</span><span>{m(doc.total)}</span></p>
      {doc.paid > 0 && <><p><span>{t.paid}</span><span>− {m(doc.paid)}</span></p><p className="is-total"><span>{t.balance}</span><span>{m(doc.balance)}</span></p></>}
    </div>
    {!hasVat && i.vat_note && <p className="invoice-note">{i.vat_note}</p>}
    {doc.notes && <p className="invoice-note"><strong>{t.notes} :</strong> {doc.notes}</p>}
    {i.iban && doc.state !== 'paid' && doc.state !== 'cancelled' && <section className="invoice-bank"><h2>{t.bank}</h2>
      <dl>{i.account_name && <><dt>{t.accountName}</dt><dd>{i.account_name}</dd></>}{i.bank_name && <><dt>{t.bankName}</dt><dd>{i.bank_name}</dd></>}
        <dt>{t.iban}</dt><dd>{i.iban.replace(/(.{4})/g, '$1 ').trim()}</dd>{i.swift && <><dt>{t.swift}</dt><dd>{i.swift}</dd></>}
        {doc.number && <><dt>{t.reference}</dt><dd>{doc.number}</dd></>}</dl>{i.bank_note && <p>{i.bank_note}</p>}</section>}
    {(i.payment_terms || i.legal_mentions) && <footer className="invoice-foot">{i.payment_terms && <p>{i.payment_terms}</p>}{i.legal_mentions && <p>{i.legal_mentions}</p>}</footer>}
  </article>;
}
