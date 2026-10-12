import fs from 'node:fs';
import path from 'node:path';
import { all, get, run } from '@/server/db';
import { newId } from '@/server/core/crypto';
import { audit } from '@/server/core/audit';
import { BEST_PRACTICE_RULES, RULES_VERSION } from '@/server/catalog/bestPractices';
import { labExists, readManifest } from '@/server/adapters/localLab';
import type { BestPracticeRule, BestPracticeRun } from '@/lib/types';

export function listRules(): (BestPracticeRule & { applies_to: string[] })[] {
  return BEST_PRACTICE_RULES.map((r) => ({ ...r, applies_to: JSON.parse(r.applies_to as unknown as string) }));
}

export function listRuns(): BestPracticeRun[] {
  return all<BestPracticeRun>('SELECT * FROM best_practice_runs ORDER BY created_at DESC LIMIT 100');
}

export interface PlanResult {
  targetPath: string;
  current: string;
  desired: string;
  diff: string;
  applicable: boolean;
  reason?: string;
}

function labEtc(workspaceId: string): string {
  return path.join(process.cwd(), 'data', 'local-lab', workspaceId, 'etc');
}

function targetForRule(rule: BestPracticeRule, workspaceId: string): { file: string; desired: string } | null {
  const etc = labEtc(workspaceId);
  switch (rule.code) {
    case 'BP-SPL-SSL-001':
      return { file: path.join(etc, 'server-lab.conf'), desired: `${rule.sample_config}\n` };
    case 'BP-SPL-AUTH-002':
      return { file: path.join(etc, 'authentication-lab.conf'), desired: `${rule.sample_config}\n` };
    case 'BP-SPL-IDX-003':
      return { file: path.join(etc, 'clustering-lab.conf'), desired: `${rule.sample_config}\n` };
    case 'BP-SPL-FWD-004':
      return { file: path.join(etc, 'outputs.conf'), desired: `${rule.sample_config}\n` };
    case 'BP-SPL-TIME-005':
      return { file: path.join(etc, 'chrony-lab.conf'), desired: `${rule.sample_config}\n` };
    case 'BP-SPL-RET-006':
      return { file: path.join(etc, 'indexes-lab.conf'), desired: `${rule.sample_config}\n` };
    default:
      return null;
  }
}

function simpleDiff(current: string, desired: string): string {
  const cur = current ? current.split('\n') : ['(خالی)'];
  const des = desired.split('\n');
  const out: string[] = [];
  const curSet = new Set(cur);
  const desSet = new Set(des);
  for (const line of des) if (!curSet.has(line)) out.push(`+ ${line}`);
  for (const line of cur) if (!desSet.has(line)) out.push(`- ${line}`);
  return out.length ? out.join('\n') : '(بدون تغییر)';
}

export function planRule(ruleId: string, workspaceId: string, actor: string): PlanResult & { rule: BestPracticeRule } {
  const rule = BEST_PRACTICE_RULES.find((r) => r.id === ruleId);
  if (!rule) throw new Error('قانون یافت نشد');
  if (!labExists(workspaceId)) {
    return {
      targetPath: '', current: '', desired: '', diff: '',
      applicable: false, reason: 'محیط Local Lab ساخته نشده است؛ ابتدا یک استقرار Local Lab اجرا کنید',
      rule,
    };
  }
  const target = targetForRule(rule, workspaceId)!;
  const current = fs.existsSync(target.file) ? fs.readFileSync(target.file, 'utf8') : '';
  const diff = simpleDiff(current, target.desired);
  return { targetPath: target.file, current, desired: target.desired, diff, applicable: true, rule };
}

export function applyRule(ruleId: string, workspaceId: string, actor: string): BestPracticeRun {
  const plan = planRule(ruleId, workspaceId, actor);
  const runId = newId('bpr');
  if (!plan.applicable) {
    run(
      'INSERT INTO best_practice_runs (id, rule_id, target, state, result, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      runId, ruleId, 'local_lab', 'skipped', plan.reason ?? 'غیرقابل اعمال', actor, new Date().toISOString()
    );
    return get<BestPracticeRun>('SELECT * FROM best_practice_runs WHERE id = ?', runId)!;
  }
  try {
    if (fs.existsSync(plan.targetPath)) {
      fs.copyFileSync(plan.targetPath, `${plan.targetPath}.bak`);
    }
    fs.mkdirSync(path.dirname(plan.targetPath), { recursive: true });
    fs.writeFileSync(plan.targetPath, plan.desired);
    run(
      'INSERT INTO best_practice_runs (id, rule_id, target, state, diff, result, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      runId, ruleId, 'local_lab', 'applied', plan.diff, `اعمال شد روی ${path.basename(plan.targetPath)} (نسخه پشتیبان .bak ساخته شد)`, actor, new Date().toISOString()
    );
    audit(actor, 'bestpractice.apply', `rule:${ruleId}`, 'success', newId('corr'));
  } catch (e) {
    run(
      'INSERT INTO best_practice_runs (id, rule_id, target, state, result, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      runId, ruleId, 'local_lab', 'failed', String((e as Error).message), actor, new Date().toISOString()
    );
    audit(actor, 'bestpractice.apply', `rule:${ruleId}`, 'failed', newId('corr'));
  }
  return get<BestPracticeRun>('SELECT * FROM best_practice_runs WHERE id = ?', runId)!;
}

export function labStatusForRules(workspaceId: string): { labExists: boolean; nodes: number; manifestAt: string | null } {
  const manifest = readManifest(workspaceId);
  return {
    labExists: labExists(workspaceId),
    nodes: manifest?.nodes.length ?? 0,
    manifestAt: manifest?.created_at ?? null,
  };
}

export { RULES_VERSION };
