import { createFileRoute } from '@tanstack/react-router';
import { Check, Building2, ClipboardCheck, Scale } from 'lucide-react';
import { ContactForm } from '@/components/oolala/contact-form';
import { DaryaSection, Eyebrow } from '@/components/oolala/shared';
import { pageHead } from '@/lib/oolala';
export const Route = createFileRoute('/georgie/investir')({ head: () => pageHead('Investir dans l’immobilier en Géorgie', 'Acquisition de biens existants à Gudauri et Tbilissi, juridique, banque et gestion locative. Votre investissement coordonné par Darya depuis Dubai.', '/georgie/investir'), component: InvestPage });
function InvestPage() {
  return <>
    <section className="page-intro site-wrap">
      <Eyebrow>Géorgie · Acquisition immobilière</Eyebrow>
      <h1 className="page-title">Un bien en Géorgie.<br />Un projet accompagné de bout en bout.</h1>
      <p className="page-lead">Des biens achevés sur le marché de la revente, sélectionnés à Gudauri et Tbilissi selon votre projet. Avec Darya et un réseau local de confiance, vous avancez avec les bons interlocuteurs et une lecture claire de chaque opportunité.</p>
    </section>
    <GeorgiaNetwork />
    <section className="site-wrap section-space investment-layout">
      <div>
        <Eyebrow>Les lieux, le projet, la réalité du bien</Eyebrow>
        <h2 className="section-title">Une sélection à votre mesure.</h2>
        <div className="investment-zone"><h3>Gudauri</h3><p>Des biens existants dans une station de montagne. Une recherche adaptée à votre usage et à la saisonnalité de la location.</p></div>
        <div className="investment-zone"><h3>Tbilissi & Tbilisi Hills</h3><p>Un projet en ville, pour un usage personnel ou la location à l’année. Nous étudions chaque bien et son environnement.</p></div>
        <div className="investment-zone"><h3>Votre recherche sur mesure</h3><p>Une autre zone en tête ? Votre budget, vos objectifs et votre horizon orientent la sélection.</p></div>
      </div>
      <div className="investment-summary">
        <h3>Du brief à la gestion</h3>
        {['Sourcing et vérification des biens achevés et de leur titre', 'Travail juridique, notaire et vérification préalable', 'Contrats en géorgien avec traduction assermentée', 'Dossier bancaire et création de LLC si pertinente', 'Dossier de résidence lorsque vous êtes éligible', 'Conciergerie et gestion locative'].map(item => <p key={item} className="flex gap-3 mb-4"><Check size={16} className="shrink-0 mt-1" />{item}</p>)}
        <div className="outcome"><strong>Une décision éclairée</strong>Les valeurs immobilières, le change et l’occupation locative peuvent évoluer. Les estimations sont étudiées selon les coûts réels et les caractéristiques de chaque bien. Tout dossier de banque ou de résidence reste soumis aux acteurs compétents.</div>
      </div>
    </section>
    <section className="audience-section section-space">
      <div className="site-wrap"><Eyebrow>Le parcours</Eyebrow><h2 className="section-title">De votre idée aux clés.</h2>
        <div className="country-facts mt-10">{[
          { title: 'Échange initial', description: 'Votre budget, votre objectif et les zones qui vous intéressent.' },
          { title: 'Sélection & visite', description: 'Bilan détaillé des projets, suivi des opportunités et visite sur place ou en vidéo.' },
          { title: 'Transaction', description: 'Vérifications avec nos professionnels de confiance, contrats traduits et formalités d’acquisition.' },
          { title: 'Gestion & installation', description: 'Mise en location et préparation de la résidence, selon éligibilité.' },
        ].map((step, i) => <div className="country-fact" key={step.title}><span>0{i + 1}</span><strong>{step.title}</strong><span>{step.description}</span></div>)}</div>
      </div>
    </section>
    <section className="site-wrap section-space contact-grid"><div><Eyebrow>Votre projet immobilier</Eyebrow><h2 className="section-title">Dites-nous ce que<br />vous recherchez.</h2><p className="section-description mt-6">Une première discussion pour préciser votre budget, votre objectif et les prochaines étapes.</p></div><ContactForm investment /></section>
    <DaryaSection />
  </>;
}

function GeorgiaNetwork() {
  return <section className="investment-network section-space" aria-labelledby="network-title">
    <div className="site-wrap">
      <div className="network-heading">
        <div><Eyebrow>Notre réseau en Géorgie</Eyebrow><h2 className="section-title" id="network-title">Les bons contacts.<br />Une décision éclairée.</h2></div>
        <p className="section-description">Investir sur un marché que l’on connaît peu demande des repères solides. Nos contacts privilégiés auprès des banques et nos professionnels locaux de confiance vous accompagnent à chaque étape.</p>
      </div>
      <BankContacts />
      <div className="network-professionals">
        <div className="network-professional"><Scale aria-hidden="true" /><h3>Des professionnels de confiance</h3><p>Agents immobiliers, notaires, avocats et traducteurs : un réseau local mobilisé pour vérifier les biens, comprendre les contrats et coordonner votre acquisition en toute clarté.</p></div>
        <div className="network-professional"><Building2 aria-hidden="true" /><h3>Une sélection resserrée</h3><p>Nous travaillons avec un nombre limité de développeurs immobiliers qualifiés. Chaque projet fait l’objet d’un bilan détaillé pour vous permettre d’en apprécier les caractéristiques, les points de vigilance et l’adéquation avec votre objectif.</p></div>
        <div className="network-professional"><ClipboardCheck aria-hidden="true" /><h3>Les opportunités, suivies</h3><p>Notre outil de suivi développé en interne centralise les opportunités et leur évolution. Vous disposez d’informations organisées pour comparer les projets et vous positionner lorsqu’une opportunité correspond à votre recherche.</p></div>
      </div>
    </div>
  </section>;
}

function BankContacts() {
  return <>
    <div className="bank-network">
      <div className="bank-contact"><h3>Bank of Georgia · SOLO</h3><p>Des contacts privilégiés auprès de Bank of Georgia, y compris pour son service premium SOLO, pour préparer et suivre votre dossier bancaire.</p></div>
      <div className="bank-contact"><h3>TBC Bank · TBC Concept</h3><p>Des interlocuteurs auprès de TBC Bank et de son service premium TBC Concept pour accompagner vos démarches selon votre profil et votre projet.</p></div>
    </div>
    <p className="network-caveat">L’ouverture d’un compte et l’accès aux services premium restent soumis aux conditions d’éligibilité et à la décision de chaque banque. Ces contacts ne constituent ni une garantie d’acceptation ni une garantie sur l’investissement.</p>
  </>;
}