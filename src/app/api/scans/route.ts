import { z } from 'zod';
import { ok, handleError, readJson, requireAuth } from '@/server/http';
import { createScan, createDemoScan, listScans } from '@/server/services/scans';
import { getDefaultWorkspace } from '@/server/services/workspace';

const createSchema = z.object({
  profile: z.enum(['quick', 'standard', 'credentialed']),
  targets: z.array(z.string()).min(1, 'حداقل یک هدف لازم است').max(50),
  exclusions: z.array(z.string()).max(50).default([]),
});

export async function GET() {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  const ws = getDefaultWorkspace();
  return ok({ scans: listScans(ws.id) });
}

export async function POST(req: Request) {
  const auth = await requireAuth('scan.run');
  if ('response' in auth) return auth.response;
  try {
    const body = createSchema.parse(await readJson(req));
    const ws = getDefaultWorkspace();
    const job = createScan({
      workspaceId: ws.id,
      profile: body.profile,
      targets: body.targets,
      exclusions: body.exclusions,
      actor: auth.user.username,
    });
    return ok({ scan: job }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: Request) {
  const auth = await requireAuth('demo.load');
  if ('response' in auth) return auth.response;
  try {
    const body = z.object({ action: z.enum(['load-demo']) }).parse(await readJson(req));
    void body;
    const ws = getDefaultWorkspace();
    const job = createDemoScan(ws.id, auth.user.username);
    return ok({ scan: job }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
