import { createFileRoute } from '@tanstack/react-router';
import { CountryPage } from '@/components/oolala/country-page';
import { pageHead } from '@/lib/oolala';
export const Route = createFileRoute('/france')({ head: () => pageHead('Créer et développer votre société en France', 'SAS, SASU, SARL, EURL, domiciliation, banque et coordination comptable. Préparez votre implantation avec Oolala France SAS.', '/france'), component: () => <CountryPage country="france" /> });