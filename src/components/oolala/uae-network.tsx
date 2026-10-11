import { Eyebrow } from './shared';
import { useT } from '@/lib/i18n';
const mashreq = { url: '/images/mashreq.png' };
const rakbank = { url: '/images/rakbank.png' };

export function UaeBankNetwork() {
  const { t } = useT(); const u = t.uae;
  return <section className="investment-network section-space" aria-labelledby="uae-banks-title">
    <div className="site-wrap">
      <div className="network-heading">
        <div><Eyebrow>{u.eyebrow}</Eyebrow><h2 className="section-title" id="uae-banks-title">{u.title}</h2></div>
        <p className="section-description">{u.text}</p>
      </div>
      <div className="bank-network">
        <div className="bank-contact">
          <div className="bank-logos"><img className="bank-symbol" src={mashreq.url} alt={`${u.logo} Mashreq`} width="176" height="36" /></div>
          <h3>Mashreq</h3>
          <p>{u.mashreq}</p>
        </div>
        <div className="bank-contact">
          <div className="bank-logos"><img className="bank-symbol" src={rakbank.url} alt={`${u.logo} RAKBANK`} width="144" height="33" /></div>
          <h3>RAKBANK</h3>
          <p>{u.rakbank}</p>
        </div>
      </div>
      <p className="network-caveat">{u.caveat}</p>
    </div>
  </section>;
}
