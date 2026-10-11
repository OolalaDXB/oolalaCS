export type CountryKey = 'emirats' | 'georgie' | 'france';
export type Service = { title: string; description: string; items: string[]; outcome: string };
export type FreeZone = { name: string; place: string; lead: string; text: string; points: string[]; fit: string };
export type Faq = { question: string; answer: string };
export type Plan = { name: string; lead: string; items: string[]; price: string; priceNote: string };
export type Visa = { name: string; audience: string; text: string };
export type Visas = { intro: string; types: Visa[]; steps?: string[] };
export type Testimonial = { quote: string; name: string; context: string; country: CountryKey };
export const countries: Record<CountryKey, { name: string; city: string; label: string; intro: string; tags: string[]; services: Service[]; plans?: Plan[]; visas?: Visas; zones?: FreeZone[]; faq?: Faq[] }> = {
  emirats: {
    name: 'Émirats arabes unis', city: 'Dubai', label: 'Un nouvel élan pour votre activité.',
    intro: 'Créez votre société en free zone, à RAKEZ, à Dubai Silicon Oasis ou dans la zone la plus adaptée à votre activité. Licence, banque, visas et suivi : un accompagnement personnel, du premier échange au renouvellement.',
    tags: ['RAKEZ & DSO', 'Banque & résidence', 'Suivi annuel'],
    services: [
      { title: 'Création de société', description: 'La bonne structure commence par la compréhension de votre activité.', items: ['Choix de la free zone et de la licence : RAKEZ, Dubai Silicon Oasis, Meydan, DMCC et autres', 'Statuts, structure des associés et dépôt du dossier', 'Licence et certificat de constitution'], outcome: 'Une société et sa licence en free zone, prêtes à exercer.' },
      { title: 'Banque & domiciliation', description: 'Une adresse officielle et un dossier bancaire complet pour démarrer.', items: ['Bureau, flexi-desk ou adresse adaptée à votre zone', 'Préparation et suivi du dossier bancaire'], outcome: 'Une adresse officielle et un dossier bancaire déposé. Ouverture soumise à la décision de la banque.' },
      { title: 'Visas & résidence', description: 'Un accompagnement pour les fondateurs, les équipes et les familles.', items: ['Visas investisseur, partenaire, employés et dépendants', 'Examen médical et Emirates ID', 'Renouvellements et annulations'], outcome: 'Des dossiers de visa et d’Emirates ID préparés et suivis, sous réserve de la décision des autorités.' },
      { title: 'Comptabilité & suivi', description: 'Les obligations de votre entreprise, suivies année après année.', items: ['Enregistrement à l’impôt sur les sociétés et à la TVA', 'Tenue comptable et déclarations confiées à nos cabinets partenaires agréés', 'Suivi des déclarations et renouvellement de licence', 'Changement d’associés, modification, transfert ou liquidation'], outcome: 'Un calendrier administratif clair et une société suivie dans la durée.' },
    ],
    plans: [
      { name: 'Indépendant & consultant', lead: 'Pour exercer seul, avec une structure simple.', price: 'À partir de 2\u00a0500\u00a0USD', priceNote: 'Société sans visa · visa du fondateur en option', items: ['Licence de free zone et adresse officielle en flexi-desk', 'Dossier bancaire professionnel préparé et suivi', 'Enregistrement à l’impôt sur les sociétés', 'Visa de résidence et Emirates ID du fondateur, en option'] },
      { name: 'Start-up & petite équipe', lead: 'Pour lancer une activité avec des associés ou de premiers salariés.', price: 'Sur devis', priceNote: 'Selon le nombre d’associés et de visas', items: ['Licence, statuts et structure des associés', 'Flexi-desk ou bureau partagé selon le nombre de visas', 'Visas des associés, des salariés et de leurs familles', 'Enregistrement à l’impôt sur les sociétés et à la TVA si nécessaire'] },
      { name: 'Société établie & filiale', lead: 'Pour implanter une société existante ou une équipe complète.', price: 'Sur devis', priceNote: 'Selon la structure, le bureau et l’équipe', items: ['Filiale ou succursale d’une société étrangère', 'Coordination de la légalisation des documents de la société mère', 'Bureau privé et visas pour l’ensemble de l’équipe', 'Calendrier fiscal, renouvellements et suivi annuel'] },
    ],
    visas: {
      intro: 'Votre société vous ouvre droit à la résidence. Nous choisissons avec vous le visa adapté, pour vous, vos associés, vos salariés et votre famille.',
      types: [
        { name: 'Visa investisseur ou associé', audience: 'Fondateurs et associés', text: 'Rattaché à votre société de free zone, il vous permet de résider aux Émirats et se renouvelle avec votre licence.' },
        { name: 'Visa salarié', audience: 'Vos équipes', text: 'Pour recruter aux Émirats, dans la limite du nombre de visas permis par votre bureau.' },
        { name: 'Visa famille', audience: 'Conjoint, enfants, parents', text: 'Vous parrainez vos proches dès que vous remplissez les conditions de revenus et de logement.' },
        { name: 'Golden Visa', audience: 'Investisseurs, entrepreneurs, talents', text: 'Une résidence de 10 ans, sans parrain, pour les profils éligibles. Nous vérifions votre éligibilité et montons le dossier.' },
        { name: 'Permis freelance', audience: 'Indépendants', text: 'Exercer en votre nom propre avec un visa de résidence, sans créer de société, dans les free zones qui le proposent.' },
      ],
      steps: ['Permis d’entrée, ou changement de statut si vous êtes déjà aux Émirats', 'Examen médical', 'Biométrie et Emirates ID', 'Visa émis, puis renouvellements suivis'],
    },
    zones: [
      { name: 'RAKEZ', place: 'Ras Al Khaimah Economic Zone', lead: 'La free zone que nous avons choisie pour nous-mêmes.', text: 'Oolala Next FZ-LLC est immatriculée à RAKEZ. Nous connaissons son parcours de l’intérieur : dossier, licence, visas et renouvellement.', points: ['Un large choix d’activités : services, conseil, commerce, e-commerce et industrie', 'Des formules flexibles, du flexi-desk au bureau ou à l’entrepôt', 'Une création qui se prépare en grande partie à distance', 'Des visas de résidence valables dans tous les Émirats, y compris pour vivre à Dubai'], fit: 'Consultants, indépendants, sociétés de services et de commerce qui veulent une structure solide avec un budget maîtrisé.' },
      { name: 'Dubai Silicon Oasis', place: 'DSO · Dubai', lead: 'Le pôle technologique de Dubai.', text: 'Free zone et parc technologique intégré, Dubai Silicon Oasis réunit bureaux, campus pour start-up et quartier résidentiel. Une adresse à Dubai, au cœur d’un écosystème tech.', points: ['Une licence et une adresse à Dubai', 'Un environnement tourné vers la tech, le logiciel et l’innovation', 'Dtec, le campus dédié aux start-up et aux entrepreneurs', 'Bureaux, flexi-desks et logements réunis sur un même site'], fit: 'Start-up, sociétés tech et logiciel, fondateurs qui souhaitent une adresse et un écosystème à Dubai.' },
    ],
    faq: [
      { question: 'RAKEZ ou Dubai Silicon Oasis : comment choisir ?', answer: 'Tout part de votre activité. RAKEZ offre un large choix d’activités et des formules flexibles ; Dubai Silicon Oasis apporte une adresse à Dubai et un écosystème tech. Votre budget, le nombre de visas nécessaires et vos besoins de bureau font le reste. Nous vous présentons les options côte à côte avant toute décision.' },
      { question: 'Puis-je vivre à Dubai avec une société à RAKEZ ?', answer: 'Oui. Le visa de résidence obtenu par votre société de free zone est un visa émirien : il vous permet de vivre dans l’émirat de votre choix, Dubai compris.' },
      { question: 'Faut-il être sur place pour créer la société ?', answer: 'La création de la société se prépare en grande partie à distance. Votre présence aux Émirats est en revanche nécessaire pour le visa : entrée sur le territoire, examen médical et biométrie de l’Emirates ID.' },
      { question: 'Combien coûte une société aux Émirats ?', answer: 'À partir de 2\u00a0500\u00a0USD pour une société de free zone sans visa. Le prix final dépend de la free zone, des activités, du type de bureau et du nombre de visas : vous recevez un devis détaillé avant tout engagement.' },
      { question: 'Free zone ou société sur le marché local ?', answer: 'Une société de free zone convient à la plupart des activités de services, de conseil, de tech et de commerce international. Si votre activité suppose de vendre directement sur le marché local émirien ou d’exercer une profession réglementée, une autre structure peut être nécessaire : nous vous le disons dès le premier échange.' },
      { question: 'Ma société sera-t-elle imposée ?', answer: 'Les Émirats appliquent un impôt sur les sociétés et une TVA. Une société de free zone peut bénéficier d’un régime favorable sur ses revenus qualifiants, sous conditions. Nous organisons l’enregistrement fiscal et le suivi des déclarations avec des professionnels agréés.' },
      { question: 'J’ai déjà une société aux Émirats. Pouvez-vous reprendre le suivi ?', answer: 'Oui. Licence, visas, déclarations, changement d’associés ou transfert : nous faisons le point sur votre dossier et reprenons votre calendrier. Si des échéances ont été manquées, nous les identifions et coordonnons leur régularisation avec des professionnels agréés.' },
      { question: 'Combien de temps faut-il ?', answer: 'Une fois votre dossier complet, la licence est délivrée en quelques jours à quelques semaines selon la free zone. Le compte bancaire et les visas demandent ensuite plus de temps : nous vous donnons un calendrier réaliste dès le départ.' },
    ],
  },
  georgie: {
    name: 'Géorgie', city: 'Tbilissi', label: 'De nouvelles perspectives à explorer.',
    intro: 'Société, installation ou acquisition immobilière : construisez votre projet en Géorgie avec Darya et ses partenaires locaux.',
    tags: ['LLC & entrepreneur', 'Virtual Zone IT', 'Immobilier'],
    services: [
      { title: 'Création de société', description: 'Une forme juridique adaptée à votre activité et à votre situation.', items: ['Société à responsabilité limitée ou entrepreneur individuel', 'Statut Virtual Zone pour les activités IT éligibles', 'Immatriculation au registre national et enregistrement fiscal'], outcome: 'Une société ou un statut d’entrepreneur enregistré en Géorgie.' },
      { title: 'Banque & adresse légale', description: 'Une présence locale et un accompagnement auprès des banques géorgiennes.', items: ['Adresse légale en Géorgie', 'Préparation du dossier bancaire et suivi avec les banques locales'], outcome: 'Une adresse légale et un dossier bancaire prêt. Ouverture soumise à la décision de la banque.' },
      { title: 'Séjour & résidence', description: 'Un parcours de séjour cohérent avec votre projet.', items: ['Cadrage du séjour et de ses conditions', 'Permis de résidence lié à l’activité ou à l’investissement, selon éligibilité', 'Constitution des dossiers et suivi des échéances'], outcome: 'Un plan de séjour clair et un dossier de résidence, lorsque vous êtes éligible.' },
      { title: 'Fiscalité & déclarations', description: 'Votre situation fiscale clarifiée dès le départ.', items: ['Enregistrement fiscal et à la TVA si nécessaire', 'Étude du régime selon l’activité et le chiffre d’affaires', 'Suivi des déclarations périodiques'], outcome: 'Un calendrier de déclarations et une situation fiscale suivie.' },
    ],
    visas: {
      intro: 'La Géorgie accueille facilement les ressortissants de nombreux pays. Pour rester durablement, un permis de résidence se construit autour de votre activité ou de votre investissement.',
      types: [
        { name: 'Séjour sans visa', audience: 'De nombreuses nationalités', text: 'Jusqu’à un an de séjour sans visa pour de nombreux passeports, dont les passeports européens. Nous vérifions votre situation.' },
        { name: 'Résidence liée à l’activité', audience: 'Entrepreneurs et salariés', text: 'Un permis de résidence fondé sur votre société, votre activité ou votre emploi en Géorgie, selon les conditions en vigueur.' },
        { name: 'Résidence liée à l’investissement', audience: 'Investisseurs immobiliers', text: 'L’acquisition d’un bien peut ouvrir droit à un permis de résidence, selon sa valeur et votre éligibilité.' },
        { name: 'Famille', audience: 'Conjoint et enfants', text: 'Vos proches peuvent obtenir un permis de résidence rattaché au vôtre.' },
      ],
    },
  },
  france: {
    name: 'France', city: 'Paris', label: 'Votre implantation, en toute clarté.',
    intro: 'Créez votre société et organisez votre installation en France. Oolala France SAS coordonne vos démarches et le suivi avec les professionnels concernés.',
    tags: ['SAS · SASU · SARL · EURL', 'Domiciliation', 'Installation'],
    services: [
      { title: 'Création de société', description: 'Du choix de la forme juridique à l’immatriculation.', items: ['SAS, SASU, SARL ou EURL selon votre situation', 'Préparation des statuts et du dossier d’immatriculation', 'Formalités au guichet unique jusqu’au Kbis'], outcome: 'Une société immatriculée, avec son Kbis.' },
      { title: 'Banque & domiciliation', description: 'Un siège social et un dossier de compte professionnel.', items: ['Domiciliation du siège social', 'Dossier auprès d’une banque traditionnelle ou d’une néobanque'], outcome: 'Un siège social et un dossier bancaire déposé. Ouverture soumise à la décision de la banque.' },
      { title: 'Titres de séjour & installation', description: 'Les démarches pour les dirigeants et leur famille.', items: ['Dossiers de séjour pour créateurs d’entreprise et dirigeants', 'Suivi avec la préfecture', 'Accompagnement à l’installation de la famille'], outcome: 'Un dossier de séjour complet, déposé et suivi, sous réserve de la décision des autorités.' },
      { title: 'Comptabilité & conformité', description: 'Les échéances de votre société française, coordonnées pour vous.', items: ['Coordination avec votre expert-comptable', 'Calendrier fiscal, TVA et obligations sociales', 'Approbation annuelle des comptes et dépôt au greffe'], outcome: 'Un calendrier fiscal et administratif tenu à jour.' },
    ],
    visas: {
      intro: 'Pour créer ou diriger une société en France depuis l’étranger, le titre de séjour dépend de votre projet, de votre investissement et de votre nationalité.',
      types: [
        { name: 'Passeport Talent', audience: 'Créateurs, investisseurs, dirigeants', text: 'Un titre pluriannuel pour les projets d’entreprise innovants, les investisseurs et les mandataires sociaux éligibles.' },
        { name: 'Carte entrepreneur', audience: 'Créateurs d’entreprise', text: 'Pour exercer une activité commerciale ou libérale viable, sur présentation d’un projet solide.' },
        { name: 'Famille accompagnante', audience: 'Conjoint et enfants', text: 'Les proches d’un titulaire du Passeport Talent peuvent l’accompagner avec un titre de séjour dédié.' },
        { name: 'Ressortissants européens', audience: 'UE, EEE et Suisse', text: 'Aucun titre de séjour n’est nécessaire pour vous installer et créer votre société en France.' },
      ],
    },
  },
};
// Published only once real, consented client quotes are added; the section stays hidden while empty.
export const testimonials: Testimonial[] = [];
export const countryPaths = { emirats: '/emirats', georgie: '/georgie', france: '/france' } as const;
export const whatsappUrl = 'https://wa.me/971506838777';
export function pageHead(title: string, description: string, path: string) {
  return { meta: [{ title: `${title} | Oolala Corporate Services` }, { name: 'description', content: description }, { property: 'og:title', content: `${title} | Oolala Corporate Services` }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { property: 'og:url', content: path }, { name: 'twitter:card', content: 'summary_large_image' }], links: [{ rel: 'canonical', href: path }] };
}