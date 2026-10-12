import { ok, fail, handleError, requireAuth } from '@/server/http';
import { cancelScan, getScan } from '@/server/services/scans';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const scan = getScan(id);
    if (!scan) return fail('NOT_FOUND', 'Job یافت نشد', 404);
    return ok({ scan });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth('scan.run');
  if ('response' in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    cancelScan(id, auth.user.username);
    return ok({ scan: getScan(id) });
  } catch (e) {
    return handleError(e);
  }
}
