import { z } from 'zod';
import { ok, handleError, readJson, requireAuth } from '@/server/http';
import { createDeployment, listDeployments } from '@/server/services/deployments';
import { getDefaultWorkspace } from '@/server/services/workspace';

export async function GET() {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  const ws = getDefaultWorkspace();
  return ok({ deployments: listDeployments(ws.id) });
}

const schema = z.object({
  architectureId: z.string().nullable().default(null),
});

export async function POST(req: Request) {
  const auth = await requireAuth('deploy.run');
  if ('response' in auth) return auth.response;
  try {
    const body = schema.parse(await readJson(req));
    const ws = getDefaultWorkspace();
    const job = createDeployment({ workspaceId: ws.id, architectureId: body.architectureId, actor: auth.user.username });
    return ok({ deployment: job }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
