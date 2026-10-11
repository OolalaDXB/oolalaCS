import { createFileRoute } from '@tanstack/react-router';
import { CountryPage } from '@/components/oolala/country-page';
import { pageHead } from '@/lib/oolala';
export const Route = createFileRoute('/emirats')({ head: () => pageHead('Votre société et votre résidence aux Émirats', 'Création de société en free zone à RAKEZ, Dubai Silicon Oasis (DSO) et ailleurs aux Émirats : licence, banque, visas et suivi avec Darya et Oolala Next FZ-LLC.', '/emirats'), component: () => <CountryPage country="emirats" /> });