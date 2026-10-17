import { ok, handleError, requireAuth } from '@/server/http';
import { getDefaultWorkspace } from '@/server/services/workspace';
import { labEnvStatus } from '@/server/services/labEnv';

export async function GET() {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  try {
    const ws = getDefaultWorkspace();
    return ok({ status: labEnvStatus(ws.id) });
  } catch (e) {
    return handleError(e);
  }
}
