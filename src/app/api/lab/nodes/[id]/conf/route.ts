import { z } from 'zod';
import { ok, fail, handleError, readJson, requireAuth } from '@/server/http';
import { btoolNodeConf, listConfFiles, readNodeConf, saveNodeConf } from '@/server/services/labNodes';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const name = url.searchParams.get('name');
    if (!name) return ok({ files: listConfFiles(id) });
    if (url.searchParams.get('btool') === '1') return ok({ name, view: 'btool', text: btoolNodeConf(id, name) });
    const conf = readNodeConf(id, name);
    return ok({ name, view: 'raw', ...conf });
  } catch (e) {
    return handleError(e);
  }
}

const schema = z.object({ name: z.string(), text: z.string().max(64_000) });

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth('lab.operate');
  if ('response' in auth) return auth.response;
  try {
    const { id } = await params;
    const body = schema.parse(await readJson(req));
    return ok(saveNodeConf(id, body.name, body.text, auth.user.username));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST() {
  return fail('METHOD_NOT_ALLOWED', 'برای ذخیره conf از PUT استفاده کنید', 405);
}
