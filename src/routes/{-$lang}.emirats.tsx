import { createFileRoute } from '@tanstack/react-router';
import { CountryPage } from '@/components/oolala/country-page';
import { localeHead } from '@/lib/i18n';
export const Route = createFileRoute('/{-$lang}/emirats')({ head: ({ params }) => localeHead(params.lang, 'emirats', '/emirats'), component: () => <CountryPage country="emirats" /> });
