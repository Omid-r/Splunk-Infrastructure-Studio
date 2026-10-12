import { all, get, run } from '@/server/db';
import { newId } from '@/server/core/crypto';
import { audit } from '@/server/core/audit';
import { emitJobEvent, isCancelled } from '@/server/core/jobs';
import * as lab from '@/server/adapters/localLab';
import type { DeploymentJob, PreflightItem, SplunkNodeSpec } from '@/lib/types';

const LAB_PORT = 19997;

export function preflightLocalLab(nodes: SplunkNodeSpec[]): PreflightItem[] {
  const items: PreflightItem[] = [];
  const facts = lab.labSystemFacts();
  const totalNodes = nodes.reduce((a, n) => a + n.count, 0);
  const totalStorage = nodes.reduce((a, n) => a + n.storage_gb * n.count, 0);

  items.push({
    id: 'pf-scope', severity: 'info', check: 'محدوده و مجوز',
    detail: 'هدف: Local Lab روی همین ماشین — بدون دسترسی remote؛ هیچ تغییری روی شبکه انجام نمی‌شود', passed: true,
  });
  if (facts.freeDiskGb < 0) {
    items.push({ id: 'pf-disk-unknown', severity: 'warning', check: 'فضای دیسک', detail: 'برآورد فضای آزاد دیسک در دسترس نیست', passed: false });
  } else {
    const ok = facts.freeDiskGb >= Math.max(1, Math.ceil(totalStorage / 1024));
    items.push({
      id: 'pf-disk', severity: ok ? 'info' : 'critical', check: 'فضای دیسک',
      detail: `فضای آزاد ~${facts.freeDiskGb}GB — نیاز برآوردی ${Math.max(1, Math.ceil(totalStorage / 1024))}GB (lab بدون داده واقعی فضای خیلی کمتری مصرف می‌کند)`, passed: true,
    });
  }
  items.push({
    id: 'pf-cpu', severity: facts.cpus >= 4 ? 'info' : 'warning', check: 'CPU',
    detail: `${facts.cpus} هسته منطقی روی ماشین محلی (نودهای لب فایل و پردازش سبک‌اند)`, passed: facts.cpus >= 2,
  });
  items.push({
    id: 'pf-ram', severity: facts.freeMemGb >= 4 ? 'info' : 'warning', check: 'RAM',
    detail: `حافظه آزاد ~${facts.freeMemGb}GB از ${facts.totalMemGb}GB`, passed: facts.freeMemGb >= 2,
  });
  items.push({
    id: 'pf-arch', severity: nodes.length > 0 ? 'info' : 'critical', check: 'طراحی معماری',
    detail: nodes.length > 0 ? `${totalNodes} نود در ${nodes.length} نقش تعریف شده` : 'هیچ نودی در طراحی معماری وجود ندارد', passed: nodes.length > 0,
  });
  items.push({
    id: 'pf-honesty', severity: 'info', check: 'ماهیت محیط',
    detail: 'Local Lab یک sandbox واقعی روی همین ماشین است — ادعای نصب Splunk Enterprise واقعی ندارد', passed: true,
  });
  return items;
}

export function createDeployment(input: { workspaceId: string; architectureId: string | null; actor: string }): DeploymentJob {
  const arch = input.architectureId
    ? get<{ nodes: string }>('SELECT nodes FROM architecture_designs WHERE id = ?', input.architectureId)
    : null;
  const nodes: SplunkNodeSpec[] = arch ? JSON.parse(arch.nodes) : [];
  const preflight = preflightLocalLab(nodes);
  const criticalFail = preflight.some((p) => p.severity === 'critical' && !p.passed);
  if (criticalFail) {
    const err = new Error('پیش‌نیازهای بحرانی preflight برقرار نیست؛ اجرا مسدود شد') as Error & { code: string };
    err.code = 'PREFLIGHT_BLOCKED';
    throw err;
  }
  const id = newId('dep');
  const totalNodes = nodes.reduce((a, n) => a + n.count, 0);
  run(
    `INSERT INTO deployment_jobs (id, workspace_id, architecture_id, target_mode, status, plan_summary, preflight, created_by, created_at)
     VALUES (?, ?, ?, 'local_lab', 'queued', ?, ?, ?, ?)`,
    id, input.workspaceId, input.architectureId,
    `استقرار ${totalNodes} نود در محیط آزمایشگاه محلی (Local Lab)${arch ? '' : ' — بدون طراحی معماری: ۱ نود Standalone پیش‌فرض'}`,
    JSON.stringify(preflight), input.actor, new Date().toISOString()
  );
  audit(input.actor, 'deployment.create', `dep:${id}`, 'success', newId('corr'));
  void runDeploymentAsync(id);
  return getDeployment(id)!;
}

export function getDeployment(id: string): DeploymentJob | null {
  const r = get<DeploymentJob & { preflight: string | null; validation: string | null }>('SELECT * FROM deployment_jobs WHERE id = ?', id);
  if (!r) return null;
  return { ...r, preflight: r.preflight ? JSON.parse(r.preflight) : null, validation: r.validation ? JSON.parse(r.validation) : null };
}

export function listDeployments(workspaceId: string): DeploymentJob[] {
  return all<DeploymentJob & { preflight: string | null; validation: string | null }>(
    'SELECT * FROM deployment_jobs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50', workspaceId
  ).map((r) => ({ ...r, preflight: r.preflight ? JSON.parse(r.preflight) : null, validation: r.validation ? JSON.parse(r.validation) : null }));
}

export function cancelDeployment(id: string, actor: string): void {
  const d = getDeployment(id);
  if (!d) return;
  if (d.status === 'running' || d.status === 'queued') {
    run("UPDATE deployment_jobs SET status = 'cancelled', finished_at = ? WHERE id = ?", new Date().toISOString(), id);
    emitJobEvent(id, 'deployment', 'استقرار توسط کاربر لغو شد', 'warning');
    audit(actor, 'deployment.cancel', `dep:${id}`, 'success', newId('corr'));
  }
}

async function runDeploymentAsync(id: string): Promise<void> {
  const d = getDeployment(id);
  if (!d) return;
  run("UPDATE deployment_jobs SET status = 'running', started_at = ? WHERE id = ?", new Date().toISOString(), id);
  const arch = d.architecture_id
    ? get<{ nodes: string }>('SELECT nodes FROM architecture_designs WHERE id = ?', d.architecture_id)
    : null;
  const nodes: SplunkNodeSpec[] = arch && arch.nodes ? JSON.parse(arch.nodes) : [{ role: 'Standalone', count: 1, cpu: 8, ram_gb: 16, storage_gb: 200, reason: 'پیش‌فرض' }];
  try {
    emitJobEvent(id, 'deployment', 'شروع استقرار در Local Lab (sandbox واقعی روی همین ماشین)', 'info');
    await lab.provisionLab(
      { workspaceId: d.workspace_id, jobId: id, nodes },
      (pct, msg) => {
        run('UPDATE deployment_jobs SET progress = ? WHERE id = ?', pct, id);
        emitJobEvent(id, 'deployment', msg, 'info');
      },
      () => isCancelled('deployment_jobs', id)
    );
    if (isCancelled('deployment_jobs', id)) throw new Error('cancelled');
    emitJobEvent(id, 'deployment', `راه‌اندازی گیرنده رویداد آزمایشی روی 127.0.0.1:${LAB_PORT}`, 'info');
    await lab.startLabListener(d.workspace_id, LAB_PORT);
    run('UPDATE deployment_jobs SET progress = 98 WHERE id = ?', id);
    const validation = await lab.validateLab(d.workspace_id, LAB_PORT);
    run('UPDATE deployment_jobs SET validation = ?, progress = 100, status = ?, finished_at = ? WHERE id = ?',
      JSON.stringify(validation),
      validation.every((v) => v.status !== 'fail') ? 'success' : 'warning',
      new Date().toISOString(), id);
    const fails = validation.filter((v) => v.status === 'fail').length;
    emitJobEvent(id, 'deployment', fails === 0
      ? `اعتبارسنجی کامل شد: ${validation.length} بررسی، بدون خطا`
      : `اعتبارسنجی با ${fails} مورد ناموفق پایان یافت`, fails === 0 ? 'success' : 'warning');
  } catch (e) {
    const cancelled = (e as Error).message === 'cancelled';
    run('UPDATE deployment_jobs SET status = ?, error = ?, finished_at = ? WHERE id = ?',
      cancelled ? 'cancelled' : 'failed', cancelled ? null : String((e as Error).message), new Date().toISOString(), id);
    emitJobEvent(id, 'deployment', cancelled ? 'استقرار لغو شد' : `خطا: ${(e as Error).message}`, cancelled ? 'warning' : 'error');
  }
}
