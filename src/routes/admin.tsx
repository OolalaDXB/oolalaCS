import { createFileRoute } from '@tanstack/react-router';
import { AdminApp } from '@/components/solo-admin/app';

// Darya's back office (BEAU Solo). Data access is decided by the database:
// every call is a permission-checked solo_admin_* function.
export const Route = createFileRoute('/admin')({
  head: () => ({ meta: [{ title: 'Back-office | Oolala' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  ssr: false,
  component: AdminApp,
});
