import { createFileRoute, Outlet } from '@tanstack/react-router';
export const Route = createFileRoute('/{-$lang}/rendez-vous')({ component: () => <Outlet /> });
