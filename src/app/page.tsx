import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/core/session';
import { needsSetup } from '@/server/services/users';
import { bootstrap } from '@/server/bootstrap';

export const dynamic = 'force-dynamic';

export default async function Home() {
  bootstrap();
  if (needsSetup()) redirect('/setup');
  const user = await getSessionUser();
  if (!user) redirect('/login');
  redirect('/dashboard');
}
