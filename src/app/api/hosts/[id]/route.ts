import { ok, fail, handleError, requireAuth } from '@/server/http';
import { getHost } from '@/server/services/hosts';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth('host.view');
  if ('response' in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const host = getHost(id);
    if (!host) return fail('NOT_FOUND', 'هاست یافت نشد', 404);
    return ok({ host });
  } catch (e) {
    return handleError(e);
  }
}
