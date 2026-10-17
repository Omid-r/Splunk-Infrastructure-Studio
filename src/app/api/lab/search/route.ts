import { z } from 'zod';
import { ok, handleError, readJson, requireAuth } from '@/server/http';
import { searchNodes } from '@/server/services/labNodes';
import { getDefaultWorkspace } from '@/server/services/workspace';

const schema = z.object({
  query: z.string().max(512).default(''),
  nodes: z.array(z.string().max(128)).default([]),
  limit: z.number().int().min(1).max(200).default(50),
});

export async function POST(req: Request) {
  const auth = await requireAuth('lab.search');
  if ('response' in auth) return auth.response;
  try {
    const body = schema.parse(await readJson(req));
    const ws = getDefaultWorkspace();
    return ok({ result: searchNodes(ws.id, body.query, body.nodes, body.limit) });
  } catch (e) {
    return handleError(e);
  }
}
