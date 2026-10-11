import { createFileRoute, Outlet } from '@tanstack/react-router';
export const Route = createFileRoute('/{-$lang}/georgie')({ component: () => <Outlet /> });
