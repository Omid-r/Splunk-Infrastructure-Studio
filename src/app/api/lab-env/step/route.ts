import { z } from 'zod';
import { fail, ok, handleError, readJson, requireAuth } from '@/server/http';
import { can, type Action } from '@/server/core/rbac';
import { getDefaultWorkspace } from '@/server/services/workspace';
import { runLabEnvStep, type LabEnvStep } from '@/server/services/labEnv';
import type { Role } from '@/lib/types';

const STEP_ACTION: Record<LabEnvStep, Action> = {
  'seed-demo': 'demo.load',
  design: 'architecture.design',
  deploy: 'deploy.run',
  provision: 'lab.operate',
  'start-nodes': 'lab.operate',
  traffic: 'lab.operate',
  bundle: 'lab.operate',
  'stop-nodes': 'lab.operate',
};

const schema = z.object({
  step: z.enum(['seed-demo', 'design', 'deploy', 'provision', 'start-nodes', 'traffic', 'bundle', 'stop-nodes']),
});

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  try {
    const body = schema.parse(await readJson(req));
    const action = STEP_ACTION[body.step];
    if (!can(auth.user.role as Role, action)) {
      return fail('FORBIDDEN', `نقش شما اجازهٔ اجرای مرحلهٔ «${body.step}» را ندارد (${action})`, 403);
    }
    const ws = getDefaultWorkspace();
    const result = await runLabEnvStep(ws.id, auth.user.username, body.step);
    return ok({ result });
  } catch (e) {
    return handleError(e);
  }
}
