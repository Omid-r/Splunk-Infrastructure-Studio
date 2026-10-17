import { ok, fail, handleError, requireAuth } from '@/server/http';
import { getScan } from '@/server/services/scans';
import { getSnapshot } from '@/server/services/snapshots';
import { getDefaultWorkspace } from '@/server/services/workspace';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth('host.view');
  if ('response' in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const job = getScan(id);
    if (!job || job.workspace_id !== getDefaultWorkspace().id) return fail('NOT_FOUND', 'Job یافت نشد', 404);
    const snapshot = getSnapshot(id);
    if (!snapshot) return fail('NOT_FOUND', 'برای این job اسنپ‌شافتی ثبت نشده است (فقط jobهای موفق اسنپ‌شات دارند)', 404);
    return ok({ snapshot });
  } catch (e) {
    return handleError(e);
  }
}
