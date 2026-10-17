import fs from 'node:fs';
import { fail, handleError, requireAuth } from '@/server/http';
import { audit } from '@/server/core/audit';
import { newId } from '@/server/core/crypto';
import { getDefaultWorkspace } from '@/server/services/workspace';
import { resolveBundlePath } from '@/server/services/bundle';

export async function GET(req: Request) {
  const auth = await requireAuth('lab.operate');
  if ('response' in auth) return auth.response;
  try {
    const name = new URL(req.url).searchParams.get('file') ?? '';
    const ws = getDefaultWorkspace();
    const abs = resolveBundlePath(ws.id, name);
    if (!abs) return fail('NOT_FOUND', 'این bundle پیدا نشد — فقط فایل‌های تولیدشده در پوشهٔ bundles این Workspace قابل دانلود است', 404);
    const buffer = fs.readFileSync(abs);
    audit(auth.user.username, 'lab.bundle.download', `bundle:${name}`, 'success', newId('corr'));
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
