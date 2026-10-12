import { z } from 'zod';
import { ok, handleError, readJson, requireAuth } from '@/server/http';
import { all } from '@/server/db';
import { listRules, listRuns, planRule, applyRule, labStatusForRules, RULES_VERSION } from '@/server/services/bestPractices';
import { getDefaultWorkspace } from '@/server/services/workspace';
import type { BestPracticeRule } from '@/lib/types';

export async function GET() {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  const ws = getDefaultWorkspace();
  const rules = all<BestPracticeRule & { applies_to: string }>('SELECT * FROM best_practice_rules ORDER BY severity, code')
    .map((r) => ({ ...r, applies_to: JSON.parse(r.applies_to as unknown as string) }));
  return ok({
    rules: rules.length ? rules : listRules(),
    runs: listRuns(),
    lab: labStatusForRules(ws.id),
    rules_version: RULES_VERSION,
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth('bestpractice.apply');
  if ('response' in auth) return auth.response;
  try {
    const body = z.object({ ruleId: z.string(), action: z.enum(['plan', 'apply']) }).parse(await readJson(req));
    const ws = getDefaultWorkspace();
    if (body.action === 'plan') {
      return ok({ plan: planRule(body.ruleId, ws.id, auth.user.username) });
    }
    return ok({ run: applyRule(body.ruleId, ws.id, auth.user.username) });
  } catch (e) {
    return handleError(e);
  }
}
