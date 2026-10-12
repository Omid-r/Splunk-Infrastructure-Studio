import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/core/session';
import { needsSetup } from '@/server/services/users';
import { bootstrap } from '@/server/bootstrap';
import { AppShell } from '@/components/shell';
import { ToastProvider } from '@/components/toast';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  bootstrap();
  if (needsSetup()) redirect('/setup');
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return (
    <ToastProvider>
      <AppShell user={user}>{children}</AppShell>
    </ToastProvider>
  );
}
