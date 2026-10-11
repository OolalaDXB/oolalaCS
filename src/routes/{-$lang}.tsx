import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';
import { isLangParam } from '@/lib/i18n';

export const Route = createFileRoute('/{-$lang}')({
  beforeLoad: ({ params }) => { if (!isLangParam(params.lang)) throw notFound(); },
  component: () => <Outlet />,
});
