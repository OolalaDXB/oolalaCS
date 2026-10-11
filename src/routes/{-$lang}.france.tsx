import { createFileRoute } from '@tanstack/react-router';
import { CountryPage } from '@/components/oolala/country-page';
import { localeHead } from '@/lib/i18n';
export const Route = createFileRoute('/{-$lang}/france')({ head: ({ params }) => localeHead(params.lang, 'france', '/france'), component: () => <CountryPage country="france" /> });
