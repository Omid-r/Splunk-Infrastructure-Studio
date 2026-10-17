import { ok, handleError, requireAuth } from '@/server/http';
import { listRuns, runDiagnostics } from '@/server/services/diagnostics';
import { getDefaultWorkspace } from '@/server/services/workspace';

export async function GET() {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  const ws = getDefaultWorkspace();
  return ok({ runs: listRuns(ws.id) });
}

export async function POST() {
  const auth = await requireAuth('lab.operate');
  if ('response' in auth) return auth.response;
  try {
    const ws = getDefaultWorkspace();
    const run = await runDiagnostics(ws.id, auth.user.username);
    return ok({ run }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
