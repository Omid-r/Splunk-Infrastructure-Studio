import { z } from 'zod';
import { ok, handleError, readJson, requireAuth } from '@/server/http';
import { getDefaultWorkspace } from '@/server/services/workspace';
import { compareSnapshots } from '@/server/services/snapshots';

const schema = z.object({
  from: z.string().min(1).max(64),
  to: z.string().min(1).max(64),
});

export async function POST(req: Request) {
  const auth = await requireAuth('host.view');
  if ('response' in auth) return auth.response;
  try {
    const body = schema.parse(await readJson(req));
    const ws = getDefaultWorkspace();
    const diff = compareSnapshots(ws.id, body.from, body.to);
    return ok({ diff });
  } catch (e) {
    return handleError(e);
  }
}
