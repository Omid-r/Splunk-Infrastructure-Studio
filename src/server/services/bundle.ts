import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { all, get } from '@/server/db';
import { audit } from '@/server/core/audit';
import { newId } from '@/server/core/crypto';
import { labRoot } from '@/server/lab/runtime';
import { createTarGz, type TarEntry } from '@/server/lab/tar';

const MAX_FILE_BYTES = 8 * 1024 * 1024;

interface NodeRow {
  id: string;
  name: string;
  role: string;
  conf_dir: string;
  status: string;
  ingest_port: number | null;
  mgmt_port: number | null;
  events_stored: number;
}

export interface BundleEntryInfo {
  path: string;
  bytes: number;
  truncated: boolean;
}

export interface BundleResult {
  file: string;
  bytes: number;
  sha256: string;
  generated_at: string;
  node_count: number;
  entries: BundleEntryInfo[];
  skipped: { path: string; reason: string }[];
}

function bundlesDir(workspaceId: string): string {
  return path.join(labRoot(workspaceId), 'bundles');
}

function readBounded(abs: string): { buffer: Buffer; truncated: boolean } {
  const stat = fs.statSync(abs);
  if (stat.size <= MAX_FILE_BYTES) return { buffer: fs.readFileSync(abs), truncated: false };
  const fd = fs.openSync(abs, 'r');
  try {
    const buf = Buffer.alloc(MAX_FILE_BYTES);
    fs.readSync(fd, buf, 0, MAX_FILE_BYTES, stat.size - MAX_FILE_BYTES);
    return { buffer: buf, truncated: true };
  } finally {
    fs.closeSync(fd);
  }
}

function relFromRoot(workspaceId: string, abs: string): string | null {
  const rel = path.relative(labRoot(workspaceId), abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

export function buildLabBundle(workspaceId: string, actor: string): BundleResult {
  const nodes = all<NodeRow>('SELECT * FROM lab_nodes WHERE workspace_id = ? ORDER BY name', workspaceId);
  if (nodes.length === 0) {
    const e = new Error('هنوز نود آزمایشگاهی در این Workspace ساخته نشده است — bundle چیزی برای بسته‌بندی ندارد') as Error & { code: string };
    e.code = 'INVALID_INPUT';
    throw e;
  }

  const entries: TarEntry[] = [];
  const infos: BundleEntryInfo[] = [];
  const skipped: { path: string; reason: string }[] = [];

  const addFile = (archivePath: string, abs: string) => {
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      skipped.push({ path: archivePath, reason: 'روی دیسک وجود ندارد (نود هرگز این فایل را نساخته است)' });
      return;
    }
    const { buffer, truncated } = readBounded(abs);
    entries.push({ path: archivePath, content: buffer });
    infos.push({ path: archivePath, bytes: buffer.length, truncated });
  };

  for (const node of nodes) {
    const confRel = relFromRoot(workspaceId, node.conf_dir);
    if (!confRel) {
      skipped.push({ path: node.conf_dir, reason: 'خارج از ریشهٔ محلی آزمایشگاه است' });
      continue;
    }
    if (fs.existsSync(node.conf_dir)) {
      for (const f of fs.readdirSync(node.conf_dir).sort((a, b) => a.localeCompare(b, 'en'))) {
        const abs = path.join(node.conf_dir, f);
        if (f.endsWith('.conf')) addFile(`${confRel}/${f}`, abs);
      }
    } else {
      skipped.push({ path: confRel, reason: ' پوشهٔ conf ساخته نشده است' });
    }
    const spoolRel = relFromRoot(workspaceId, path.join(labRoot(workspaceId), 'var', 'spool', node.name, 'events.jsonl'));
    if (spoolRel) addFile(spoolRel, path.join(labRoot(workspaceId), 'var', 'spool', node.name, 'events.jsonl'));
    const logRel = relFromRoot(workspaceId, path.join(labRoot(workspaceId), 'var', 'log', 'splunk-lab', node.name, 'splunkd-lab.log'));
    if (logRel) addFile(logRel, path.join(labRoot(workspaceId), 'var', 'log', 'splunk-lab', node.name, 'splunkd-lab.log'));
  }

  const ws = get<{ name: string }>('SELECT name FROM workspaces WHERE id = ?', workspaceId);
  const manifest = {
    generator: 'splunk-infrastructure-studio',
    bundle_kind: 'local-lab-artifacts',
    workspace_id: workspaceId,
    workspace_name: ws?.name ?? 'unknown',
    generated_at: new Date().toISOString(),
    generated_by: actor,
    notice: [
      'این بسته فقط شواهد واقعی تولیدشده توسط Lab Runtime همین پروژه است.',
      'نودهای داخل آن Splunk Enterprise واقعی نیستند؛ پورت‌ها، کانف‌ها و رویدادها توسط این برنامه روی 127.0.0.1 ساخته شده‌اند.',
      'هیچ لاگ یا کانفی از بیرون به بسته اضافه نشده است؛ فایل‌های غایب در بخش skipped با دلیل ثبت شده‌اند.',
    ],
    nodes: nodes.map((n) => ({
      name: n.name,
      role: n.role,
      status_in_db: n.status,
      ingest_port: n.ingest_port,
      mgmt_port: n.mgmt_port,
      events_stored: n.events_stored,
      conf_dir: relFromRoot(workspaceId, n.conf_dir) ?? n.conf_dir,
    })),
    limits: { max_file_bytes: MAX_FILE_BYTES },
  };
  const manifestJson = JSON.stringify(manifest, null, 2);
  entries.push({ path: 'manifest.json', content: manifestJson });
  infos.push({ path: 'manifest.json', bytes: Buffer.byteLength(manifestJson), truncated: false });
  const readme = `${manifest.notice.join('\n')}\n\nتاریخ تولید: ${manifest.generated_at}\n`;
  entries.push({ path: 'README.txt', content: readme });
  infos.push({ path: 'README.txt', bytes: Buffer.byteLength(readme), truncated: false });

  const archive = createTarGz(entries);
  const dir = bundlesDir(workspaceId);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = manifest.generated_at.replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const file = `sis-lab-${stamp}.tar.gz`;
  const abs = path.join(dir, file);
  fs.writeFileSync(abs, archive);

  const result: BundleResult = {
    file,
    bytes: archive.length,
    sha256: crypto.createHash('sha256').update(archive).digest('hex'),
    generated_at: manifest.generated_at,
    node_count: nodes.length,
    entries: infos,
    skipped,
  };
  audit(actor, 'lab.bundle', `workspace:${workspaceId}`, 'success', newId('corr'));
  return result;
}

export interface BundleListing {
  name: string;
  bytes: number;
  mtime: string;
}

export function listBundles(workspaceId: string): BundleListing[] {
  const dir = bundlesDir(workspaceId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^sis-lab-[\w.-]+\.tar\.gz$/.test(f))
    .map((name) => {
      const st = fs.statSync(path.join(dir, name));
      return { name, bytes: st.size, mtime: st.mtime.toISOString() };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
}

/** Resolves a download name to an existing bundle path, rejecting anything outside the bundles dir. */
export function resolveBundlePath(workspaceId: string, name: string): string | null {
  if (!/^sis-lab-[\w.-]+\.tar\.gz$/.test(name)) return null;
  const dir = bundlesDir(workspaceId);
  const abs = path.resolve(dir, name);
  if (path.dirname(abs) !== path.resolve(dir)) return null;
  if (!fs.existsSync(abs)) return null;
  return abs;
}
