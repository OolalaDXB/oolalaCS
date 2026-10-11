import { createFileRoute } from '@tanstack/react-router';
import { Check, Building2, ClipboardCheck, Scale } from 'lucide-react';
import { ContactForm } from '@/components/oolala/contact-form';
import { DaryaSection, Eyebrow } from '@/components/oolala/shared';
import { localeHead, useT } from '@/lib/i18n';
const bankOfGeorgia = { url: '/images/bank-of-georgia.svg' };
const solo = { url: '/images/solo.svg' };
const tbcBank = { url: '/images/tbc-bank.svg' };
const tbcConcept = { url: '/images/tbc-concept.svg' };
export const Route = createFileRoute('/{-$lang}/georgie/investir')({ head: ({ params }) => localeHead(params.lang, 'invest', '/georgie/investir'), component: InvestPage });
function InvestPage() {
  const { t } = useT(); const v = t.invest;
  return <>
    <section className="page-intro site-wrap">
      <Eyebrow>{v.eyebrow}</Eyebrow>
      <h1 className="page-title">{v.title1}<br />{v.title2}</h1>
      <p className="page-lead">{v.lead}</p>
    </section>
    <GeorgiaNetwork />
    <section className="site-wrap section-space investment-layout">
      <div>
        <Eyebrow>{v.zonesEyebrow}</Eyebrow>
        <h2 className="section-title">{v.zonesTitle}</h2>
        {v.zones.map(zone => <div className="investment-zone" key={zone.title}><h3>{zone.title}</h3><p>{zone.text}</p></div>)}
      </div>
      <div className="investment-summary">
        <h3>{v.summaryTitle}</h3>
        {v.summary.map(item => <p key={item} className="flex gap-3 mb-4"><Check size={16} className="shrink-0 mt-1" />{item}</p>)}
        <div className="outcome"><strong>{v.decisionTitle}</strong>{v.decisionText}</div>
      </div>
    </section>
    <section className="audience-section section-space">
      <div className="site-wrap"><Eyebrow>{v.pathEyebrow}</Eyebrow><h2 className="section-title">{v.pathTitle}</h2>
        <div className="country-facts mt-10">{v.steps.map((step, i) => <div className="country-fact" key={step.title}><span>0{i + 1}</span><strong>{step.title}</strong><span>{step.description}</span></div>)}</div>
      </div>
    </section>
    <section className="site-wrap section-space contact-grid"><div><Eyebrow>{v.formEyebrow}</Eyebrow><h2 className="section-title">{v.formTitle1}<br />{v.formTitle2}</h2><p className="section-description mt-6">{v.formText}</p></div><ContactForm investment /></section>
    <DaryaSection />
  </>;
}

function GeorgiaNetwork() {
  const { t } = useT(); const v = t.invest; const icons = [Scale, Building2, ClipboardCheck];
  return <section className="investment-network section-space" aria-labelledby="network-title">
    <div className="site-wrap">
      <div className="network-heading">
        <div><Eyebrow>{v.netEyebrow}</Eyebrow><h2 className="section-title" id="network-title">{v.netTitle1}<br />{v.netTitle2}</h2></div>
        <p className="section-description">{v.netText}</p>
      </div>
      <div className="bank-network">
        <div className="bank-contact">
          <div className="bank-logos"><div className="bank-brand"><img className="bank-symbol" src={bankOfGeorgia.url} alt={`${t.uae.logo} Bank of Georgia`} width="60" height="52" /><span>Bank of<br />Georgia</span></div><div className="bank-brand"><img className="bank-symbol" src={solo.url} alt={`${t.uae.logo} SOLO`} width="44" height="44" /><span>SOLO</span></div></div>
          <h3>Bank of Georgia · SOLO</h3><p>{v.bog}</p>
        </div>
        <div className="bank-contact">
          <div className="bank-logos"><div className="bank-brand"><img className="bank-symbol" src={tbcBank.url} alt={`${t.uae.logo} TBC Bank`} width="54" height="48" /><span>TBC Bank</span></div><img className="bank-logo-premium" src={tbcConcept.url} alt={`${t.uae.logo} TBC Concept`} width="149" height="40" /></div>
          <h3>TBC Bank · TBC Concept</h3><p>{v.tbc}</p>
        </div>
      </div>
      <p className="network-caveat">{v.caveat}</p>
      <div className="network-professionals">
        {v.pros.map((pro, i) => { const Icon = icons[i] ?? Building2; return <div className="network-professional" key={pro.title}><Icon aria-hidden="true" /><h3>{pro.title}</h3><p>{pro.text}</p></div>; })}
      </div>
    </div>
  </section>;
}
