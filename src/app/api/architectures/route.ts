import { z } from 'zod';
import { ok, fail, handleError, readJson, requireAuth } from '@/server/http';
import { listArchitectures, saveArchitecture, deleteArchitecture, getArchitecture } from '@/server/services/architectures';
import { getDefaultWorkspace } from '@/server/services/workspace';

export async function GET() {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  const ws = getDefaultWorkspace();
  return ok({ architectures: listArchitectures(ws.id) });
}

const schema = z.object({
  goal: z.enum(['poc', 'small', 'enterprise', 'ha', 'dr']),
  ingest_gb_day: z.number().min(0).max(1000000),
  peak_gb_day: z.number().min(0).max(1000000).default(0),
  retention_days: z.number().min(1).max(36500),
  search_users: z.number().min(0).max(100000).default(0),
  workload: z.enum(['light', 'mixed', 'heavy']).default('mixed'),
  growth_pct_year: z.number().min(0).max(1000).default(0),
  sites: z.number().int().min(1).max(10).default(1),
  name: z.string().max(128).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuth('architecture.design');
  if ('response' in auth) return auth.response;
  try {
    const body = schema.parse(await readJson(req));
    const ws = getDefaultWorkspace();
    const design = saveArchitecture(ws.id, auth.user.username, body);
    return ok({ architecture: design }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAuth('architecture.design');
  if ('response' in auth) return auth.response;
  try {
    const body = z.object({ id: z.string() }).parse(await readJson(req));
    if (!getArchitecture(body.id)) return fail('NOT_FOUND', 'طراحی یافت نشد', 404);
    deleteArchitecture(body.id, auth.user.username);
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
