export type CountryKey = 'emirats' | 'georgie' | 'france';
export type Service = { title: string; description: string; items: string[]; outcome: string };
export type FreeZone = { name: string; place: string; lead: string; text: string; points: string[]; fit: string };
export type Faq = { question: string; answer: string };
export type Plan = { name: string; lead: string; items: string[] };
export const countries: Record<CountryKey, { name: string; city: string; label: string; intro: string; tags: string[]; services: Service[]; plans?: Plan[]; zones?: FreeZone[]; faq?: Faq[] }> = {
  emirats: {
    name: 'Émirats arabes unis', city: 'Dubai', label: 'Un nouvel élan pour votre activité.',
    intro: 'Créez votre société en free zone, à RAKEZ, à Dubai Silicon Oasis ou dans la zone la plus adaptée à votre activité. Licence, banque, visas et suivi : un accompagnement personnel, du premier échange au renouvellement.',
    tags: ['RAKEZ & DSO', 'Banque & résidence', 'Suivi annuel'],
    services: [
      { title: 'Création de société', description: 'La bonne structure commence par la compréhension de votre activité.', items: ['Choix de la free zone et de la licence : RAKEZ, Dubai Silicon Oasis, Meydan, DMCC et autres', 'Statuts, structure des associés et dépôt du dossier', 'Licence et certificat de constitution'], outcome: 'Une société et sa licence en free zone, prêtes à exercer.' },
      { title: 'Banque & domiciliation', description: 'Une adresse officielle et un dossier bancaire complet pour démarrer.', items: ['Bureau, flexi-desk ou adresse adaptée à votre zone', 'Préparation et suivi du dossier bancaire'], outcome: 'Une adresse officielle et un dossier bancaire déposé. Ouverture soumise à la décision de la banque.' },
      { title: 'Visas & résidence', description: 'Un accompagnement pour les fondateurs, les équipes et les familles.', items: ['Visas investisseur, partenaire, employés et dépendants', 'Examen médical et Emirates ID', 'Renouvellements et annulations'], outcome: 'Des dossiers de visa et d’Emirates ID préparés et suivis, sous réserve de la décision des autorités.' },
      { title: 'Comptabilité & suivi', description: 'Les obligations de votre entreprise, suivies année après année.', items: ['Enregistrement à l’impôt sur les sociétés et à la TVA', 'Suivi des déclarations et renouvellement de licence', 'Changement d’associés, modification, transfert ou liquidation'], outcome: 'Un calendrier administratif clair et une société suivie dans la durée.' },
    ],
    plans: [
      { name: 'Indépendant & consultant', lead: 'Pour exercer seul, avec une structure simple.', items: ['Licence de free zone et adresse officielle en flexi-desk', 'Visa de résidence et Emirates ID pour le fondateur', 'Dossier bancaire professionnel préparé et suivi', 'Enregistrement à l’impôt sur les sociétés'] },
      { name: 'Start-up & petite équipe', lead: 'Pour lancer une activité avec des associés ou de premiers salariés.', items: ['Licence, statuts et structure des associés', 'Flexi-desk ou bureau partagé selon le nombre de visas', 'Visas des associés, des salariés et de leurs familles', 'Enregistrement à l’impôt sur les sociétés et à la TVA si nécessaire'] },
      { name: 'Société établie & filiale', lead: 'Pour implanter une société existante ou une équipe complète.', items: ['Filiale ou succursale d’une société étrangère', 'Coordination de la légalisation des documents de la société mère', 'Bureau privé et visas pour l’ensemble de l’équipe', 'Calendrier fiscal, renouvellements et suivi annuel'] },
    ],
    zones: [
      { name: 'RAKEZ', place: 'Ras Al Khaimah Economic Zone', lead: 'La free zone que nous avons choisie pour nous-mêmes.', text: 'Oolala Next FZ-LLC est immatriculée à RAKEZ. Nous connaissons son parcours de l’intérieur : dossier, licence, visas et renouvellement.', points: ['Un large choix d’activités : services, conseil, commerce, e-commerce et industrie', 'Des formules flexibles, du flexi-desk au bureau ou à l’entrepôt', 'Une création qui se prépare en grande partie à distance', 'Des visas de résidence valables dans tous les Émirats, y compris pour vivre à Dubai'], fit: 'Consultants, indépendants, sociétés de services et de commerce qui veulent une structure solide avec un budget maîtrisé.' },
      { name: 'Dubai Silicon Oasis', place: 'DSO · Dubai', lead: 'Le pôle technologique de Dubai.', text: 'Free zone et parc technologique intégré, Dubai Silicon Oasis réunit bureaux, campus pour start-up et quartier résidentiel. Une adresse à Dubai, au cœur d’un écosystème tech.', points: ['Une licence et une adresse à Dubai', 'Un environnement tourné vers la tech, le logiciel et l’innovation', 'Dtec, le campus dédié aux start-up et aux entrepreneurs', 'Bureaux, flexi-desks et logements réunis sur un même site'], fit: 'Start-up, sociétés tech et logiciel, fondateurs qui souhaitent une adresse et un écosystème à Dubai.' },
    ],
    faq: [
      { question: 'RAKEZ ou Dubai Silicon Oasis : comment choisir ?', answer: 'Tout part de votre activité. RAKEZ offre un large choix d’activités et des formules flexibles ; Dubai Silicon Oasis apporte une adresse à Dubai et un écosystème tech. Votre budget, le nombre de visas nécessaires et vos besoins de bureau font le reste. Nous vous présentons les options côte à côte avant toute décision.' },
      { question: 'Puis-je vivre à Dubai avec une société à RAKEZ ?', answer: 'Oui. Le visa de résidence obtenu par votre société de free zone est un visa émirien : il vous permet de vivre dans l’émirat de votre choix, Dubai compris.' },
      { question: 'Faut-il être sur place pour créer la société ?', answer: 'La création de la société se prépare en grande partie à distance. Votre présence aux Émirats est en revanche nécessaire pour le visa : entrée sur le territoire, examen médical et biométrie de l’Emirates ID.' },
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
  },
};
export const countryPaths = { emirats: '/emirats', georgie: '/georgie', france: '/france' } as const;
export const whatsappUrl = 'https://wa.me/971506838777';
export function pageHead(title: string, description: string, path: string) {
  return { meta: [{ title: `${title} | Oolala Corporate Services` }, { name: 'description', content: description }, { property: 'og:title', content: `${title} | Oolala Corporate Services` }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { property: 'og:url', content: path }, { name: 'twitter:card', content: 'summary_large_image' }], links: [{ rel: 'canonical', href: path }] };
}