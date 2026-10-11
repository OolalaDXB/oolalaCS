import { createFileRoute } from '@tanstack/react-router';
import { CountryPage } from '@/components/oolala/country-page';
import { localeHead } from '@/lib/i18n';
export const Route = createFileRoute('/{-$lang}/georgie/')({ head: ({ params }) => localeHead(params.lang, 'georgie', '/georgie'), component: () => <CountryPage country="georgie" /> });
