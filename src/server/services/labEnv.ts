import fs from 'node:fs';
import path from 'node:path';
import { get } from '@/server/db';
import { createDemoScan } from '@/server/services/scans';
import { getSnapshot } from '@/server/services/snapshots';
import { saveArchitecture, listArchitectures } from '@/server/services/architectures';
import { createDeployment, getDeployment } from '@/server/services/deployments';
import { provisionNodes, listNodes, controlNode, searchNodes } from '@/server/services/labNodes';
import { buildLabBundle, listBundles } from '@/server/services/bundle';
import { liveOf, sendEventToNode, spoolPath } from '@/server/lab/runtime';
import type { LabNode } from '@/lib/types';

export type LabEnvStep =
  | 'seed-demo'
  | 'design'
  | 'deploy'
  | 'provision'
  | 'start-nodes'
  | 'traffic'
  | 'bundle'
  | 'stop-nodes';

export interface LabEnvStepResult {
  step: LabEnvStep;
  ok: boolean;
  title: string;
  detail: string;
  metrics: { label: string; value: string }[];
  evidence: string[];
  warnings: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function step(step: LabEnvStep, title: string, ok: boolean, detail: string, extra: Partial<LabEnvStepResult> = {}): LabEnvStepResult {
  return { step, title, ok, detail, metrics: extra.metrics ?? [], evidence: extra.evidence ?? [], warnings: extra.warnings ?? [] };
}

export function sampleDataDir(): string {
  return path.join(process.cwd(), 'lab', 'sample-data');
}

export interface SampleFile {
  name: string;
  bytes: number;
  lines: number;
}

export function listSampleFiles(): SampleFile[] {
  const dir = sampleDataDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.log'))
    .map((name) => {
      const raw = fs.readFileSync(path.join(dir, name), 'utf8');
      const lines = raw.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
      return { name, bytes: Buffer.byteLength(raw), lines: lines.length };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

function readSampleLines(name: string): string[] {
  const dir = sampleDataDir();
  const abs = path.resolve(dir, name);
  if (path.dirname(abs) !== dir) throw new Error('نام فایل نمونه مجاز نیست');
  const raw = fs.readFileSync(abs, 'utf8');
  return raw.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
}

function spoolLineCount(node: LabNode, workspaceId: string): number {
  const p = spoolPath({ id: node.id, name: node.name }, workspaceId);
  if (!fs.existsSync(p)) return 0;
  return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter((l) => l.trim()).length;
}

export function labEnvStatus(workspaceId: string) {
  const hosts = get<{ n: number }>('SELECT COUNT(*) AS n FROM hosts WHERE workspace_id = ?', workspaceId)?.n ?? 0;
  const demoHosts = get<{ n: number }>('SELECT COUNT(*) AS n FROM hosts WHERE workspace_id = ? AND is_demo = 1', workspaceId)?.n ?? 0;
  const scans = get<{ n: number }>('SELECT COUNT(*) AS n FROM scan_jobs WHERE workspace_id = ?', workspaceId)?.n ?? 0;
  const snapshots = get<{ n: number }>('SELECT COUNT(*) AS n FROM scan_snapshots s JOIN scan_jobs j ON j.id = s.job_id WHERE j.workspace_id = ?', workspaceId)?.n ?? 0;
  const nodes = listNodes(workspaceId);
  const architectures = listArchitectures(workspaceId);
  const deployments = get<{ n: number }>('SELECT COUNT(*) AS n FROM deployment_jobs WHERE workspace_id = ?', workspaceId)?.n ?? 0;
  return {
    hosts,
    demo_hosts: demoHosts,
    scans,
    snapshots,
    architectures: architectures.length,
    deployments,
    lab_nodes: nodes.length,
    running_nodes: nodes.filter((n) => n.status === 'running').length,
    events_stored: nodes.reduce((a, n) => a + (n.mode === 'store' ? spoolLineCount(n, workspaceId) : 0), 0),
    sample_files: listSampleFiles(),
    bundles: listBundles(workspaceId).length,
  };
}

export async function runLabEnvStep(workspaceId: string, actor: string, which: LabEnvStep): Promise<LabEnvStepResult> {
  switch (which) {
    case 'seed-demo': {
      const job = createDemoScan(workspaceId, actor);
      const snap = getSnapshot(job.id);
      return step('seed-demo', 'موجودی نمایشی (DEMO DATA)', job.status === 'success',
        `دیتاست نمایشی بارگذاری شد و اسنپ‌شات این job ثبت گردید — ${snap?.host_count ?? 0} هاست / ${snap?.port_count ?? 0} پورت`,
        {
          metrics: [
            { label: 'job', value: job.id },
            { label: 'هاست‌ها', value: String(snap?.host_count ?? 0) },
            { label: 'پورت‌ها', value: String(snap?.port_count ?? 0) },
          ],
          evidence: (snap?.hosts ?? []).slice(0, 4).map((h) => `${h.hostname} (${h.ip}) — ${h.ports.length} پورت — DEMO`),
          warnings: ['همهٔ داده‌های این مرحله ساختگی و برچسب‌دار (DEMO) هستند؛ از هیچ دستگاه واقعی خوانده نشده‌اند.'],
        });
    }

    case 'design': {
      const design = saveArchitecture(workspaceId, actor, {
        goal: 'poc',
        ingest_gb_day: 5,
        peak_gb_day: 8,
        retention_days: 7,
        search_users: 3,
        workload: 'light',
        growth_pct_year: 20,
        sites: 1,
        name: 'معماری آزمایشگاهی (POC)',
      });
      return step('design', 'طراحی معماری Splunk', true,
        `یک معماری POC کوچک برای ۵ گیگ/روز ساخته شد: ${design.nodes.reduce((a, n) => a + n.count, 0)} نود — فرضیه‌ها ثبت شده‌اند`,
        {
          metrics: [
            { label: 'طرح', value: design.id },
            { label: 'نودها', value: String(design.nodes.reduce((a, n) => a + n.count, 0)) },
            { label: 'فرضیه‌ها', value: String(design.assumptions.length) },
          ],
          evidence: design.nodes.map((n) => `${n.role} × ${n.count} — ${n.cpu}vCPU/${n.ram_gb}GB/${n.storage_gb}GB — ${n.reason}`),
          warnings: design.assumptions.slice(0, 3),
        });
    }

    case 'deploy': {
      const arch = listArchitectures(workspaceId)[0];
      if (!arch) {
        return step('deploy', 'استقرار Local Lab', false, 'ابتدا مرحلهٔ «طراحی معماری» را اجرا کنید — مانیفستی برای استقرار وجود ندارد.');
      }
      const job = createDeployment({ workspaceId, architectureId: arch.id, actor });
      let final = job;
      for (let i = 0; i < 40; i++) {
        await sleep(700);
        const d = getDeployment(job.id);
        if (!d) break;
        final = d;
        if (['success', 'failed', 'cancelled'].includes(d.status)) break;
      }
      const failed = final.status !== 'success';
      const validations = final.validation ?? [];
      return step('deploy', 'استقرار Local Lab', !failed,
        failed
          ? `استقرار به وضعیت ${final.status} رسید${final.error ? ` — ${final.error}` : ''}`
          : `مانیفست محیط آزمایشگاهی نوشته شد — ${final.plan_summary}`,
        {
          metrics: [
            { label: 'job', value: final.id },
            { label: 'وضعیت', value: final.status },
            { label: 'پیشرفت', value: `${final.progress}%` },
            { label: 'اعتبارسنجی', value: `${validations.filter((v) => v.status === 'pass').length}/${validations.length} pass` },
          ],
          evidence: validations.slice(0, 5).map((v) => `${v.status}: ${v.check} — ${v.detail}`),
          warnings: failed ? ['مانیفست کامل نوشته نشده است؛ مراحل بعدی ممکن است رد شوند.'] : [],
        });
    }

    case 'provision': {
      const r = provisionNodes(workspaceId, actor);
      return step('provision', 'ساخت نودهای زندهٔ آزمایشگاه', true,
        r.note,
        {
          metrics: [
            { label: 'نودهای ساخته‌شده', value: String(r.created) },
            { label: 'مجموع نودها', value: String(r.nodes.length) },
          ],
          evidence: r.nodes.slice(0, 6).map((n) => `${n.name} — ${n.role} — conf: ${path.relative(process.cwd(), n.conf_dir).split(path.sep).join('/')}`),
          warnings: r.created === 0 ? ['نودها از قبل وجود داشتند؛ چیزی دوباره ساخته نشد.'] : [],
        });
    }

    case 'start-nodes': {
      const nodes = listNodes(workspaceId);
      if (nodes.length === 0) {
        return step('start-nodes', 'روشن کردن نودها', false, 'نودی برای روشن‌کردن وجود ندارد — ابتدا مرحلهٔ «ساخت نودها».');
      }
      const started: string[] = [];
      const warnings: string[] = [];
      for (const n of nodes) {
        if (n.status === 'running') {
          warnings.push(`${n.name} از قبل روشن بود.`);
          continue;
        }
        const after = await controlNode(n.id, 'start', actor);
        if (after?.status === 'running') {
          started.push(`${after.name} → ingest 127.0.0.1:${after.ingest_port} / mgmt ${after.mgmt_port} (${after.mode === 'store' ? 'ایندکسر' : 'فوروادر'})`);
        } else {
          warnings.push(`${n.name} روشن نشد.`);
        }
      }
      const live = listNodes(workspaceId).filter((n) => n.status === 'running');
      return step('start-nodes', 'روشن کردن نودها', live.length > 0,
        `${started.length} نود تازه روشن شد — ${live.length} نود در حال اجرا روی 127.0.0.1`,
        {
          metrics: [
            { label: 'روشن', value: String(live.length) },
            { label: 'خاموش', value: String(listNodes(workspaceId).length - live.length) },
          ],
          evidence: started,
          warnings,
        });
    }

    case 'traffic': {
      const nodes = listNodes(workspaceId);
      const forwarders = nodes.filter((n) => n.status === 'running' && n.mode === 'forward');
      const indexers = nodes.filter((n) => n.status === 'running' && n.mode === 'store');
      if (indexers.length === 0) {
        return step('traffic', 'تزریق لاگ نمونه به زنجیرهٔ فوروارد', false,
          `حداقل یک ایندکسر/استندالون روشن لازم است تا رویداد ذخیره شود — ایندکسر روشن: ${indexers.length}.`);
      }
      const files = listSampleFiles();
      if (files.length === 0) {
        return step('traffic', 'تزریق لاگ نمونه به زنجیرهٔ فوروارد', false,
          `پوشهٔ ${sampleDataDir()} خالی یا در دسترس نیست — فایل‌های نمونه واقعی لازم است، نه دادهٔ ساخته‌شده در کد.`);
      }
      const useForwarder = forwarders.length > 0;
      const target = useForwarder ? forwarders[0] : indexers[0];
      const before = indexers.map((n) => ({ name: n.name, count: spoolLineCount(n, workspaceId) }));
      const sent: { file: string; lines: number; delivered: boolean }[] = [];
      for (const f of files) {
        const lines = readSampleLines(f.name);
        let delivered = 0;
        for (const line of lines) {
          if (await sendEventToNode(target.id, `demo_file=${f.name} ${line}`)) delivered++;
          await sleep(8);
        }
        sent.push({ file: f.name, lines: lines.length, delivered: delivered === lines.length });
      }
      await sleep(600);
      const after = indexers.map((n) => ({ name: n.name, count: spoolLineCount(n, workspaceId) }));
      const grew = after.map((a, i) => ({ name: a.name, delta: a.count - (before[i]?.count ?? 0) }));
      const totalSent = sent.reduce((s, x) => s + (x.delivered ? x.lines : 0), 0);
      const totalGrown = grew.reduce((s, x) => s + Math.max(0, x.delta), 0);
      const search = searchNodes(workspaceId, 'demo_file=', indexers.map((n) => n.name), 3);
      const pathNote = useForwarder
        ? `مسیر زنجیره‌ای: ${target.name} (فوروادر) ← ${indexers.map((n) => n.name).join('، ')}`
        : `فوروادر روشنی وجود نداشت؛ خطوط مستقیم به گیرندهٔ ${target.name} (حالت ذخیره) داده شد`;
      const honest = totalGrown >= totalSent
        ? `${totalSent} خط از ${sent.length} فایل نمونه به ${target.name} داده شد و ${totalGrown} خط در spool ایندکسرها ظاهر شد`
        : `${totalSent} خط ارسال شد ولی فقط ${totalGrown} خط در spool دیده شد — تحویل کامل نبوده است`;
      return step('traffic', 'تزریق لاگ نمونه به زنجیرهٔ فوروارد', totalGrown > 0, honest, {
        metrics: [
          { label: 'فایل‌ها', value: String(sent.length) },
          { label: 'خط‌های ارسال‌شده', value: String(totalSent) },
          { label: 'افزایش spool', value: String(totalGrown) },
          { label: 'بازگشت جستجو', value: `${search.matched}` },
        ],
        evidence: [
          pathNote,
          ...sent.map((s) => `${s.file}: ${s.lines} خط — ${s.delivered ? 'همه تحویل شد' : 'تحویل ناقص'}`),
          ...grew.map((g) => `${g.name}: +${g.delta} خط در events.jsonl`),
          ...search.events.slice(0, 2).map((e) => `hit @${e.node}: ${e.raw.slice(0, 110)}`),
        ],
        warnings: ['خط‌های ارسالی از فایل‌های lab/sample-data هستند و در خود فایل با DEMO DATA برچسب خورده‌اند.'],
      });
    }

    case 'bundle': {
      const b = buildLabBundle(workspaceId, actor);
      return step('bundle', 'بستهٔ قابل‌انتقال شواهد', true,
        `فایل ${b.file} ساخته شد (${b.bytes} بایت، ${b.entries.length} فایل، ${b.skipped.length} مورد skip)`,
        {
          metrics: [
            { label: 'حجم', value: `${b.bytes} B` },
            { label: 'فایل‌ها', value: String(b.entries.length) },
            { label: 'skipped', value: String(b.skipped.length) },
          ],
          evidence: [`sha256 ${b.sha256}`, ...b.entries.slice(0, 4).map((e) => `${e.path} (${e.bytes} B)`)],
          warnings: b.skipped.slice(0, 3).map((s) => `skip: ${s.path} — ${s.reason}`),
        });
    }

    case 'stop-nodes': {
      const running = listNodes(workspaceId).filter((n) => n.status === 'running');
      if (running.length === 0) return step('stop-nodes', 'خاموش کردن نودها', true, 'نود روشن دیگری وجود ندارد.');
      const stopped: string[] = [];
      for (const n of running) {
        const after = await controlNode(n.id, 'stop', actor);
        if (after?.status === 'stopped') stopped.push(`${after.name} (رویداد دریافتی: ${after.events_received || after.events_stored})`);
      }
      return step('stop-nodes', 'خاموش کردن نودها', stopped.length === running.length,
        `${stopped.length} نود متوقف شد — پورت‌ها آزاد شدند؛ کانف‌ها، spool و لاگ‌ها روی دیسک باقی می‌مانند`,
        { metrics: [{ label: 'متوقف‌شده', value: String(stopped.length) }], evidence: stopped, warnings: ['داده‌ها حذف نشده‌اند؛ برای پاک‌کردن کامل از CLI با --reset استفاده کنید.'] });
    }

    default:
      return step(which, 'مرحلهٔ ناشناخته', false, 'این مرحله پیاده‌سازی نشده است.');
  }
}
