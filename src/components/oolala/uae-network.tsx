import { pageHead } from '@/lib/oolala';

import mashreq from '@/assets/mashreq.png.asset.json';
import rakbank from '@/assets/rakbank.png.asset.json';

export function UaeBankNetwork() {
  return <section className="investment-network section-space" aria-labelledby="uae-banks-title">
    <div className="site-wrap">
      <div className="network-heading">
        <div><Eyebrow>Nos contacts aux Émirats</Eyebrow><h2 className="section-title" id="uae-banks-title">Des contacts bancaires établis.</h2></div>
        <p className="section-description">Ouvrir un compte aux Émirats demande un dossier complet et des interlocuteurs qui connaissent votre structure. Nous préparons votre dossier et le suivons avec nos contacts privilégiés auprès des banques.</p>
      </div>
      <div className="bank-network">
        <div className="bank-contact">
          <div className="bank-logos"><img className="bank-symbol" src={mashreq.url} alt="Logo Mashreq" width="176" height="36" /></div>
          <h3>Mashreq</h3>
          <p>Des contacts privilégiés auprès de Mashreq pour préparer et suivre votre dossier bancaire, pour votre société et vos comptes personnels aux Émirats.</p>
        </div>
        <div className="bank-contact">
          <div className="bank-logos"><img className="bank-symbol" src={rakbank.url} alt="Logo RAKBANK" width="144" height="33" /></div>
          <h3>RAKBANK</h3>
          <p>Des interlocuteurs auprès de RAKBANK pour accompagner vos démarches selon votre profil, votre activité et votre projet d’installation.</p>
        </div>
      </div>
      <p className="network-caveat">L’ouverture d’un compte reste soumise aux conditions d’éligibilité et à la décision de chaque banque. Ces contacts ne constituent ni une garantie d’acceptation ni une garantie sur vos démarches.</p>
    </div>
  </section>;
}
