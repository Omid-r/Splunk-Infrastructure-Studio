import { ok, handleError, requireAuth } from '@/server/http';
import { nodeLogs } from '@/server/services/labNodes';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  try {
    const { id } = await params;
    const tail = Number(new URL(req.url).searchParams.get('tail') ?? 200);
    return ok(nodeLogs(id, tail));
  } catch (e) {
    return handleError(e);
  }
}
