import fs from 'node:fs';
import path from 'node:path';
import { all, get, run } from '@/server/db';
import { newId } from '@/server/core/crypto';
import { audit } from '@/server/core/audit';
import { tcpProbe } from '@/server/adapters/tcpScan';
import { parseConf } from '@/server/lab/conf';
import * as rt from '@/server/lab/runtime';
import { labSystemFacts } from '@/server/adapters/localLab';
import { controlNode, listNodes } from '@/server/services/labNodes';
import type { DiagnosticItem, DiagnosticRun, LabNode } from '@/lib/types';

type RunRow = DiagnosticRun & { items: string };

function hydrate(row: RunRow): DiagnosticRun {
  return { ...row, items: JSON.parse(row.items) as DiagnosticItem[] };
}

export function listRuns(workspaceId: string): DiagnosticRun[] {
  return all<RunRow>('SELECT * FROM diagnostic_runs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 20', workspaceId).map(hydrate);
}

export function getRun(id: string): DiagnosticRun | null {
  const row = get<RunRow>('SELECT * FROM diagnostic_runs WHERE id = ?', id);
  return row ? hydrate(row) : null;
}

function item(node: LabNode | null, check: string, status: DiagnosticItem['status'], detail: string, fixKind: DiagnosticItem['fixKind'] = null, fixNote: string | null = null, fixTarget: string | null = null): DiagnosticItem {
  return { id: newId('di'), node: node?.name ?? null, nodeId: node?.id ?? null, check, status, detail, fixKind, fixNote, fixTarget };
}

function readInputs(node: LabNode): { enabled: boolean; exists: boolean; port: number | null } {
  const file = path.join(node.conf_dir, 'inputs.conf');
  if (!fs.existsSync(file)) return { enabled: false, exists: false, port: null };
  const doc = parseConf(fs.readFileSync(file, 'utf8'));
  for (const [stanza, props] of Object.entries(doc)) {
    const m = /^splunktcp:\/\/(\d+)/i.exec(stanza);
    if (!m) continue;
    const dis = (props.disabled ?? '0').toLowerCase();
    return { enabled: !(dis === '1' || dis === 'true'), exists: true, port: Number(m[1]) };
  }
  return { enabled: false, exists: true, port: null };
}

export async function runDiagnostics(workspaceId: string, actor: string): Promise<DiagnosticRun> {
  const items: DiagnosticItem[] = [];
  const nodes = listNodes(workspaceId);
  if (nodes.length === 0) {
    items.push(item(null, 'نودهای آزمایشگاهی', 'warn', 'هنوز هیچ نود آزمایشگاهی ساخته نشده است — از صفحهٔ «آزمایشگاه زنده» نودها را بسازید'));
  }

  const facts = labSystemFacts();
  if (facts.freeDiskGb >= 0 && facts.freeDiskGb < 2) {
    items.push(item(null, 'فضای دیسک', 'warn', `فضای آزاد دیسک (~${facts.freeDiskGb}GB) کم است؛ spool آزمایشگاه ممکن است پر شود`));
  } else if (facts.freeDiskGb >= 0) {
    items.push(item(null, 'فضای دیسک', 'pass', `فضای آزاد ~${facts.freeDiskGb}GB در ${facts.dataDir}`));
  } else {
    items.push(item(null, 'فضای دیسک', 'warn', 'برآورد فضای آزاد دیسک ممکن نیست'));
  }

  for (const n of nodes) {
    if (n.status !== 'running') {
      items.push(item(n, 'نود در حال اجرا', 'warn', `${n.name} متوقف است — بررسی‌های عمیق‌تر برای نود متوقف انجام نمی‌شود`, 'start-node', 'شروع نود'));
      continue;
    }

    const reachable = await tcpProbe('127.0.0.1', n.ingest_port ?? 0, 1200);
    items.push(
      reachable
        ? item(n, 'رسایی گیرنده TCP', 'pass', `پورت ${n.ingest_port} روی 127.0.0.1 پاسخ می‌دهد`)
        : item(n, 'رسایی گیرنده TCP', 'fail', `پورت ${n.ingest_port} پاسخ نمی‌دهد (نود در رجیستری زنده است اما گیرنده TCP پاسخگو نیست)`, 'restart-node', 'ری‌استارت نود')
    );

    const inputs = readInputs(n);
    if (!inputs.exists) {
      items.push(item(n, 'اعتبار inputs.conf', 'fail', 'فایل inputs.conf در نود وجود ندارد', 'enable-splunktcp', 'ساخت inputs.conf با splunktcp فعال'));
    } else if (!inputs.enabled) {
      items.push(item(n, 'اعتبار inputs.conf', 'fail', `stanza splunktcp در inputs.conf غیرفعال است (${inputs.port ?? '?'})`, 'enable-splunktcp', 'فعال‌سازی splunktcp و ری‌استارت'));
    } else {
      items.push(item(n, 'اعتبار inputs.conf', 'pass', `stanza [splunktcp://${inputs.port}] فعال و پارس‌شدنی است`));
    }

    if (n.mode === 'forward') {
      const broken = n.forward_stats.filter((f) => f.lastError);
      const stoppedTargets = n.forward_stats
        .filter((f) => f.lastError && /خارج از نودهای زنده/.test(f.lastError))
        .map((f) => f.target.split(':')[0]);
      if (n.forward_stats.length === 0) {
        items.push(item(n, 'هدف فوروارد', 'warn', 'فوروادر هیچ هدفی در outputs.conf ندارد؛ رویدادهای دریافتی فقط شمارش می‌شوند'));
      } else if (stoppedTargets.length > 0) {
        items.push(item(n, 'هدف فوروارد', 'warn', `این ایندکسرها در outputs.conf هدف گرفته‌اند اما در حال اجرا نیستند: ${stoppedTargets.join('، ')}`, 'start-target-node', `شروع ${stoppedTargets[0]}`, stoppedTargets[0]));
      } else if (broken.length > 0) {
        items.push(item(n, 'هدف فوروارد', 'fail', broken.map((b) => `${b.target}: ${b.lastError}`).join(' | '), 'restart-node', 'ری‌استارت نود برای اعمال مجدد conf'));
      } else {
        items.push(item(n, 'هدف فوروارد', 'pass', `همه ${n.forward_stats.length} هدف زنده و قابل‌ارسال‌اند`));
      }
    }

    if (n.mode === 'store') {
      const sp = rt.spoolPath({ id: n.id, name: n.name }, workspaceId);
      const dir = path.dirname(sp);
      let writable = false;
      const probeFile = path.join(dir, '.diag-probe');
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(probeFile, 'probe');
        fs.unlinkSync(probeFile);
        writable = true;
      } catch {
        writable = false;
      }
      items.push(
        writable
          ? item(n, 'قابل‌نوشت بودن spool', 'pass', `دایرکتوری spool قابل نوشتن است (${dir})`)
          : item(n, 'قابل‌نوشت بودن spool', 'fail', `نوشتن در spool نود (${dir}) ناموفق بود — دسترسی دیسک بررسی شود`, 'create-spool-dir', 'ساخت/ترمیم دایرکتوری spool')
      );

      const marker = `diag-e2e-${Date.now().toString(36)}-${n.name.replace(/[^a-z0-9]/gi, '')}`;
      const sent = await rt.sendEventToNode(n.id, `<14>1 ${new Date().toISOString()} lab.diag ${n.name} - - - ${marker}`);
      await new Promise((r) => setTimeout(r, 250));
      let stored = false;
      try {
        stored = sent && fs.existsSync(sp) && fs.readFileSync(sp, 'utf8').includes(marker);
      } catch {
        stored = false;
      }
      items.push(
        stored
          ? item(n, 'اینگست سرتاسری', 'pass', 'رویداد نمونه روی TCP دریافت و در spool ثبت شد')
          : item(n, 'اینگست سرتاسری', 'fail', sent ? 'رویداد ارسال شد اما در spool ثبت نشد' : 'اتصال TCP به گیرنده نود ناموفق بود', 'restart-node', 'ری‌استارت نود و تکرار تست')
      );
    }
  }

  const fails = items.filter((i) => i.status === 'fail').length;
  const warns = items.filter((i) => i.status === 'warn').length;
  const summary = `${items.length} بررسی — ${items.length - fails - warns} موفق، ${warns} هشدار، ${fails} ناموفق`;
  const id = newId('dia');
  run(
    `INSERT INTO diagnostic_runs (id, workspace_id, items, summary, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    id, workspaceId, JSON.stringify(items), summary, actor, new Date().toISOString()
  );
  audit(actor, 'diagnostics.run', `workspace:${workspaceId}`, fails === 0 ? 'success' : 'warning', newId('corr'));
  return getRun(id)!;
}

const FIXES = ['start-node', 'restart-node', 'enable-splunktcp', 'start-target-node', 'create-spool-dir'] as const;
type FixKind = (typeof FIXES)[number];

export interface FixResult {
  ok: boolean;
  message: string;
}

export async function applyFix(nodeId: string, fixKind: FixKind, fixTarget: string | null, actor: string): Promise<FixResult> {
  const nodes = listNodes(nodeWorkspace(nodeId));
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return { ok: false, message: 'نود یافت نشد' };

  switch (fixKind) {
    case 'start-node':
    case 'restart-node': {
      const started = await controlNode(node.id, fixKind === 'start-node' ? 'start' : 'restart', actor);
      return { ok: true, message: started?.status === 'running' ? `نود ${node.name} در حال اجراست (ingest 127.0.0.1:${started.ingest_port})` : `وضعیت نود ${node.name}: ${started?.status ?? 'نامشخص'}` };
    }
    case 'start-target-node': {
      const target = nodes.find((n) => n.name === fixTarget);
      if (!target) return { ok: false, message: `نود هدف «${fixTarget}» در این محیط یافت نشد` };
      if (target.status === 'running') return { ok: true, message: `${target.name} از قبل در حال اجراست` };
      const started = await controlNode(target.id, 'start', actor);
      return { ok: true, message: `نود ${target.name} شروع شد (ingest 127.0.0.1:${started?.ingest_port ?? 'نامشخص'})` };
    }
    case 'enable-splunktcp': {
      const file = path.join(node.conf_dir, 'inputs.conf');
      const backup = `${file}.${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
      if (fs.existsSync(file)) fs.copyFileSync(file, backup);
      const text = ['# inputs.conf — نود آزمایشگاهی', '[splunktcp://9997]', 'disabled = 0', ''].join('\n');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
      audit(actor, 'lab.fix.enable_splunktcp', `node:${node.name}`, 'success', newId('corr'));
      if (node.status === 'running') {
        await controlNode(node.id, 'restart', actor);
        return { ok: true, message: `inputs.conf با splunktcp فعال نوشته شد (بکاپ: ${path.basename(backup)}) و نود ری‌استارت شد` };
      }
      return { ok: true, message: `inputs.conf با splunktcp فعال نوشته شد (بکاپ: ${path.basename(backup)}) — نود را شروع کنید` };
    }
    case 'create-spool-dir': {
      const dir = path.dirname(rt.spoolPath({ id: node.id, name: node.name }, node.workspace_id));
      try {
        fs.mkdirSync(dir, { recursive: true });
        const probe = path.join(dir, '.fix-probe');
        fs.writeFileSync(probe, 'ok');
        fs.unlinkSync(probe);
        audit(actor, 'lab.fix.create_spool', `node:${node.name}`, 'success', newId('corr'));
        return { ok: true, message: `دایرکتوری spool ساخته و قابل نوشتن شد: ${dir}` };
      } catch (e) {
        return { ok: false, message: `ساخت spool ناموفق بود: ${(e as Error).message}` };
      }
    }
    default:
      return { ok: false, message: 'نوع رفع ناشناخته است' };
  }
}

function nodeWorkspace(nodeId: string): string {
  const row = get<{ workspace_id: string }>('SELECT workspace_id FROM lab_nodes WHERE id = ?', nodeId);
  if (!row) {
    const e = new Error('نود آزمایشگاهی یافت نشد') as Error & { code: string };
    e.code = 'NOT_FOUND';
    throw e;
  }
  return row.workspace_id;
}
