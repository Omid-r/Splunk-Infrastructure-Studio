import { z } from 'zod';
import { ok, fail, handleError, readJson, requireAuth } from '@/server/http';
import { controlNode, ingestTest, listNodes } from '@/server/services/labNodes';
import { getDefaultWorkspace } from '@/server/services/workspace';

const schema = z.object({ action: z.enum(['start', 'stop', 'restart', 'ingest-test']) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth('lab.operate');
  if ('response' in auth) return auth.response;
  try {
    const { id } = await params;
    const body = schema.parse(await readJson(req));
    if (body.action === 'ingest-test') {
      const result = await ingestTest(id, auth.user.username);
      return ok({ result });
    }
    const node = await controlNode(id, body.action, auth.user.username);
    if (!node) return fail('NOT_FOUND', 'نود یافت نشد', 404);
    return ok({ node });
  } catch (e) {
    return handleError(e);
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  const { id } = await params;
  const ws = getDefaultWorkspace();
  const node = listNodes(ws.id).find((n) => n.id === id) ?? null;
  if (!node) return fail('NOT_FOUND', 'نود یافت نشد', 404);
  return ok({ node });
}
