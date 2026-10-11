import { createFileRoute } from '@tanstack/react-router';
import { CountryPage } from '@/components/oolala/country-page';
import { pageHead } from '@/lib/oolala';
export const Route = createFileRoute('/georgie/')({ head: () => pageHead('Entreprendre et s’installer en Géorgie', 'LLC, entrepreneur individuel, Virtual Zone IT, banque, résidence et investissement immobilier en Géorgie avec Oolala.', '/georgie'), component: () => <CountryPage country="georgie" /> });