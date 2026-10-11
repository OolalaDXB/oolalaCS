export type CountryKey = 'emirats' | 'georgie' | 'france';
export type Service = { title: string; description: string; items: string[]; outcome: string };
export const countries: Record<CountryKey, { name: string; city: string; label: string; intro: string; tags: string[]; services: Service[] }> = {
  emirats: {
    name: 'Émirats arabes unis', city: 'Dubai', label: 'Un nouvel élan pour votre activité.',
    intro: 'Créez et développez votre société en free zone. Installez-vous aux Émirats avec un accompagnement personnel, du premier échange au suivi de vos obligations.',
    tags: ['Free zones', 'Banque & résidence', 'Suivi annuel'],
    services: [
      { title: 'Création de société', description: 'La bonne structure commence par la compréhension de votre activité.', items: ['Choix de la free zone et de la licence : RAKEZ, Meydan, DMCC et autres', 'Statuts, structure des associés et dépôt du dossier', 'Licence et certificat de constitution'], outcome: 'Une société et sa licence en free zone, prêtes à exercer.' },
      { title: 'Banque & domiciliation', description: 'Une adresse officielle et un dossier bancaire complet pour démarrer.', items: ['Bureau, flexi-desk ou adresse adaptée à votre zone', 'Préparation et suivi du dossier bancaire'], outcome: 'Une adresse officielle et un dossier bancaire déposé. Ouverture soumise à la décision de la banque.' },
      { title: 'Visas & résidence', description: 'Un accompagnement pour les fondateurs, les équipes et les familles.', items: ['Visas investisseur, partenaire, employés et dépendants', 'Examen médical et Emirates ID', 'Renouvellements et annulations'], outcome: 'Des dossiers de visa et d’Emirates ID préparés et suivis, sous réserve de la décision des autorités.' },
      { title: 'Comptabilité & suivi', description: 'Les obligations de votre entreprise, suivies année après année.', items: ['Enregistrement à l’impôt sur les sociétés et à la TVA', 'Suivi des déclarations et renouvellement de licence', 'Changement d’associés, modification, transfert ou liquidation'], outcome: 'Un calendrier administratif clair et une société suivie dans la durée.' },
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