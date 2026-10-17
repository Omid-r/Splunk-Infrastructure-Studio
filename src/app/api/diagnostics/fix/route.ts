import { z } from 'zod';
import { ok, handleError, readJson, requireAuth } from '@/server/http';
import { applyFix } from '@/server/services/diagnostics';

const schema = z.object({
  nodeId: z.string(),
  fixKind: z.enum(['start-node', 'restart-node', 'enable-splunktcp', 'start-target-node', 'create-spool-dir']),
  fixTarget: z.string().max(128).nullable().default(null),
});

export async function POST(req: Request) {
  const auth = await requireAuth('lab.operate');
  if ('response' in auth) return auth.response;
  try {
    const body = schema.parse(await readJson(req));
    const result = await applyFix(body.nodeId, body.fixKind, body.fixTarget, auth.user.username);
    return ok({ result });
  } catch (e) {
    return handleError(e);
  }
}
