import { ok, requireAuth } from '@/server/http';
import { securityStatus } from '@/server/services/security';

export async function GET() {
  const auth = await requireAuth('admin.users');
  if ('response' in auth) return auth.response;
  return ok({ status: securityStatus() });
}
