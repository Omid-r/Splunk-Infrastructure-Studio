import { ok, handleError, requireAuth } from '@/server/http';
import { listNodes, provisionNodes } from '@/server/services/labNodes';
import { getDefaultWorkspace } from '@/server/services/workspace';

export async function GET() {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  const ws = getDefaultWorkspace();
  return ok({ nodes: listNodes(ws.id) });
}

export async function POST() {
  const auth = await requireAuth('lab.operate');
  if ('response' in auth) return auth.response;
  try {
    const ws = getDefaultWorkspace();
    return ok(provisionNodes(ws.id, auth.user.username));
  } catch (e) {
    return handleError(e);
  }
}
