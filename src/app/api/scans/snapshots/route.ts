import { ok, handleError, requireAuth } from '@/server/http';
import { getDefaultWorkspace } from '@/server/services/workspace';
import { listSnapshots } from '@/server/services/snapshots';

export async function GET() {
  const auth = await requireAuth('host.view');
  if ('response' in auth) return auth.response;
  try {
    const ws = getDefaultWorkspace();
    return ok({ snapshots: listSnapshots(ws.id) });
  } catch (e) {
    return handleError(e);
  }
}
