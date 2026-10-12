import { ok, requireAuth } from '@/server/http';
import { listHosts } from '@/server/services/hosts';
import { getDefaultWorkspace } from '@/server/services/workspace';

export async function GET() {
  const auth = await requireAuth('host.view');
  if ('response' in auth) return auth.response;
  const ws = getDefaultWorkspace();
  return ok({ hosts: listHosts(ws.id) });
}
