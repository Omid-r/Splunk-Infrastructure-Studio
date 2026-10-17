import { z } from 'zod';
import { ok, handleError, readJson, requireAuth } from '@/server/http';
import { listRuns, runToolbox, TOOLS } from '@/server/services/toolbox';
import { getDefaultWorkspace } from '@/server/services/workspace';

export async function GET() {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  return ok({ tools: TOOLS, runs: listRuns() });
}

const schema = z.object({
  tool: z.enum(TOOLS),
  target: z.string().max(512).default(''),
  port: z.number().int().min(1).max(65535).optional(),
  count: z.number().int().min(1).max(10).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuth('toolbox.run');
  if ('response' in auth) return auth.response;
  try {
    const body = schema.parse(await readJson(req));
    const ws = getDefaultWorkspace();
    const runResult = await runToolbox(body.tool, body.target, { port: body.port, count: body.count }, ws.id, auth.user.username);
    return ok({ run: runResult });
  } catch (e) {
    return handleError(e);
  }
}
