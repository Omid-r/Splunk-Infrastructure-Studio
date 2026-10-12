import { ok, requireAuth } from '@/server/http';
import { verifyChain } from '@/server/core/audit';

export async function GET() {
  const auth = await requireAuth('audit.view');
  if ('response' in auth) return auth.response;
  return ok(verifyChain());
}
