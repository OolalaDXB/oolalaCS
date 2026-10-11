import { createFileRoute } from '@tanstack/react-router';
import { CountryPage } from '@/components/oolala/country-page';
import { pageHead } from '@/lib/oolala';
export const Route = createFileRoute('/emirats')({ head: () => pageHead('Votre société et votre résidence aux Émirats', 'Création de société en free zone, banque, visas et suivi aux Émirats arabes unis avec Darya et Oolala Next FZ-LLC.', '/emirats'), component: () => <CountryPage country="emirats" /> });