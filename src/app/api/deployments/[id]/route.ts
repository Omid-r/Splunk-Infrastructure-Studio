import { ok, fail, handleError, requireAuth } from '@/server/http';
import { cancelDeployment, getDeployment } from '@/server/services/deployments';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const d = getDeployment(id);
    if (!d) return fail('NOT_FOUND', 'استقرار یافت نشد', 404);
    return ok({ deployment: d });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth('deploy.run');
  if ('response' in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    cancelDeployment(id, auth.user.username);
    return ok({ deployment: getDeployment(id) });
  } catch (e) {
    return handleError(e);
  }
}
