import { z } from 'zod';
import { ok, handleError, readJson, requireAuth } from '@/server/http';
import { getDefaultWorkspace } from '@/server/services/workspace';
import { buildLabBundle, listBundles } from '@/server/services/bundle';

export async function GET() {
  const auth = await requireAuth('lab.operate');
  if ('response' in auth) return auth.response;
  try {
    const ws = getDefaultWorkspace();
    return ok({ bundles: listBundles(ws.id) });
  } catch (e) {
    return handleError(e);
  }
}

const schema = z.object({ action: z.enum(['build']) });

export async function POST(req: Request) {
  const auth = await requireAuth('lab.operate');
  if ('response' in auth) return auth.response;
  try {
    const body = schema.parse(await readJson(req));
    void body.action;
    const ws = getDefaultWorkspace();
    return ok({ bundle: buildLabBundle(ws.id, auth.user.username) }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
