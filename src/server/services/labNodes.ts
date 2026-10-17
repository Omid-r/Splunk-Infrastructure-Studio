import fs from 'node:fs';
import path from 'node:path';
import { all, get, run } from '@/server/db';
import { newId } from '@/server/core/crypto';
import { audit } from '@/server/core/audit';
import { readManifest } from '@/server/adapters/localLab';
import * as rt from '@/server/lab/runtime';
import { diffConf, formatDiff, parseConf, serializeConf, btoolView, type ConfDiffEntry } from '@/server/lab/conf';
import type { LabNode, LabSearchResult, ValidationItem } from '@/lib/types';

type Row = LabNode & { conf_dir: string };

function rowsToNodes(rows: Row[]): LabNode[] {
  return rows.map((r) => {
    const live = rt.liveOf(r.id);
    return {
      ...r,
      status: live ? 'running' : r.status === 'running' ? 'stopped' : r.status,
      ingest_port: live?.ingestPort ?? null,
      mgmt_port: live?.mgmtPort ?? null,
      events_received: live?.eventsReceived ?? 0,
      events_forwarded: live?.eventsForwarded ?? 0,
      mode: live?.mode ?? null,
      forward_stats: live?.forwardStats ?? [],
      started_at: live?.startedAt ?? null,
    };
  });
}

export function listNodes(workspaceId: string): LabNode[] {
  const rows = all<Row>('SELECT * FROM lab_nodes WHERE workspace_id = ? ORDER BY name', workspaceId);
  return rowsToNodes(rows);
}

function confDirFor(workspaceId: string, name: string): string {
  return path.join(rt.labRoot(workspaceId), 'etc', name, 'system', 'local');
}

function serverConf(name: string, role: string): string {
  return [
    `# server.conf — نود آزمایشگاهی ${name} (نقش: ${role})`,
    '# این فایل توسط Lab Runtime ساخته شده و Splunk Enterprise واقعی نیست.',
    '[general]',
    `serverName = ${name}`,
    'site = lab',
    '',
    '[sslConfig]',
    'enableSplunkdSSL = false',
    '',
  ].join('\n');
}

function inputsConf(): string {
  return ['# inputs.conf — نود آزمایشگاهی', '[splunktcp://9997]', 'disabled = 0', ''].join('\n');
}

function outputsConf(indexerNames: string[]): string {
  if (indexerNames.length === 0) return '# outputs.conf — بدون هدف فوروارد (این نود خودشان داده را ذخیره می‌کند)\n';
  return [
    '# outputs.conf — فوروارد به ایندکسرهای آزمایشگاهی',
    '[tcpout]',
    'defaultGroup = default-autolb-group',
    '',
    '[tcpout:default-autolb-group]',
    `server = ${indexerNames.map((n) => `${n}:9997`).join(', ')}`,
    '',
  ].join('\n');
}

export function provisionNodes(workspaceId: string, actor: string): { created: number; nodes: LabNode[]; note: string } {
  const existing = all<Row>('SELECT * FROM lab_nodes WHERE workspace_id = ?', workspaceId);
  if (existing.length > 0) {
    return { created: 0, nodes: rowsToNodes(existing), note: 'نودهای آزمایشگاهی از قبل وجود دارند؛ فهرست فعلی نمایش داده می‌شود' };
  }
  const manifest = readManifest(workspaceId);
  if (!manifest || manifest.nodes.length === 0) {
    throw new Error('هنوز محیط آزمایشگاهی ساخته نشده است — ابتدا از صفحهٔ «استقرار و اعتبارسنجی» یک Local Lab مستقر کنید');
  }
  const indexers = manifest.nodes
    .filter((n) => /indexer/i.test(n.role) || n.role === 'Standalone')
    .map((n) => n.name);
  const created: Row[] = [];
  const now = new Date().toISOString();
  for (const spec of manifest.nodes) {
    const id = newId('lab');
    const isForwarder = !indexers.includes(spec.name);
    const dir = confDirFor(workspaceId, spec.name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'server.conf'), serverConf(spec.name, spec.role));
    fs.writeFileSync(path.join(dir, 'inputs.conf'), inputsConf());
    fs.writeFileSync(path.join(dir, 'outputs.conf'), outputsConf(isForwarder ? indexers : []));
    run(
      `INSERT INTO lab_nodes (id, workspace_id, name, role, conf_dir, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'stopped', ?)`,
      id, workspaceId, spec.name, spec.role, dir, now
    );
    const row = get<Row>('SELECT * FROM lab_nodes WHERE id = ?', id);
    if (row) created.push(row);
  }
  audit(actor, 'lab.provision', `workspace:${workspaceId}`, 'success', newId('corr'));
  return {
    created: created.length,
    nodes: rowsToNodes(created),
    note: `${created.length} نود از مانیفست محیط آزمایشگاهی ساخته شد (ایندکسر/استندالون: ${indexers.length}، فوروادر: ${created.length - indexers.length})`,
  };
}

function inputError(message: string): never {
  const e = new Error(message) as Error & { code: string };
  e.code = 'INVALID_INPUT';
  throw e;
}

function forbiddenError(message: string): never {
  const e = new Error(message) as Error & { code: string };
  e.code = 'FORBIDDEN';
  throw e;
}

function mustGet(nodeId: string): Row {
  const row = get<Row>('SELECT * FROM lab_nodes WHERE id = ?', nodeId);
  if (!row) {
    const e = new Error('نود آزمایشگاهی یافت نشد') as Error & { code: string };
    e.code = 'NOT_FOUND';
    throw e;
  }
  return row;
}

function defOf(row: Row): rt.NodeDef {
  return { id: row.id, workspaceId: row.workspace_id, name: row.name, role: row.role, confDir: row.conf_dir };
}

export async function controlNode(nodeId: string, action: 'start' | 'stop' | 'restart', actor: string): Promise<LabNode | null> {
  const row = mustGet(nodeId);
  let live: rt.LiveState | null = null;
  if (action === 'start') {
    if (!rt.isRunning(row.id)) live = await rt.startNode(defOf(row));
    else live = rt.liveOf(row.id);
    run('UPDATE lab_nodes SET status = ?, ingest_port = ?, mgmt_port = ?, last_started_at = ? WHERE id = ?',
      'running', live?.ingestPort ?? null, live?.mgmtPort ?? null, new Date().toISOString(), row.id);
  } else if (action === 'stop') {
    const stopped = await rt.stopNode(row.id);
    run('UPDATE lab_nodes SET status = ?, ingest_port = NULL, mgmt_port = NULL, events_stored = ? WHERE id = ?',
      'stopped', stopped?.eventsStored ?? row.events_stored, row.id);
  } else {
    live = await rt.restartNode(defOf(row));
    run('UPDATE lab_nodes SET status = ?, ingest_port = ?, mgmt_port = ?, last_started_at = ? WHERE id = ?',
      'running', live?.ingestPort ?? null, live?.mgmtPort ?? null, new Date().toISOString(), row.id);
  }
  audit(actor, `lab.${action}`, `node:${row.name}`, 'success', newId('corr'));
  return rowsToNodes([mustGet(nodeId)])[0];
}

export function listConfFiles(nodeId: string): string[] {
  const row = mustGet(nodeId);
  try {
    return fs.readdirSync(row.conf_dir).filter((f) => f.endsWith('.conf')).sort();
  } catch {
    return [];
  }
}

export function readNodeConf(nodeId: string, name: string): { raw: string; doc: Record<string, Record<string, string>>; files: string[] } {
  const row = mustGet(nodeId);
  if (!/^[\w.-]+\.conf$/.test(name)) throw inputError('نام فایل conf مجاز نیست');
  const file = path.resolve(row.conf_dir, name);
  if (!file.startsWith(path.resolve(row.conf_dir))) throw forbiddenError('مسیر خارج از دایرکتوری پیکربندی مجاز نیست');
  if (!fs.existsSync(file)) {
    const e = new Error(`${name} در این نود وجود ندارد`) as Error & { code: string };
    e.code = 'NOT_FOUND';
    throw e;
  }
  const raw = fs.readFileSync(file, 'utf8');
  return { raw, doc: parseConf(raw), files: listConfFiles(nodeId) };
}

export function saveNodeConf(nodeId: string, name: string, text: string, actor: string): { diff: ConfDiffEntry[]; diffText: string; running: boolean; applied: 'immediate' | 'after_restart' } {
  const row = mustGet(nodeId);
  if (!/^[\w.-]+\.conf$/.test(name)) throw inputError('نام فایل conf مجاز نیست');
  parseConf(text); // validate parseability before writing
  const file = path.resolve(row.conf_dir, name);
  if (!file.startsWith(path.resolve(row.conf_dir))) throw forbiddenError('مسیر خارج از دایرکتوری پیکربندی مجاز نیست');
  const before = fs.existsSync(file) ? parseConf(fs.readFileSync(file, 'utf8')) : {};
  const backup = `${file}.${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
  if (fs.existsSync(file)) fs.copyFileSync(file, backup);
  fs.writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`);
  const diff = diffConf(before, parseConf(text));
  const corr = newId('corr');
  audit(actor, 'lab.conf.save', `node:${row.name}/${name}`, 'success', corr);
  const live = rt.liveOf(nodeId);
  const needsRestart = live !== null && (name === 'inputs.conf' || name === 'outputs.conf');
  return { diff, diffText: formatDiff(diff), running: live !== null, applied: needsRestart ? 'after_restart' : 'immediate' };
}

// btool-style merged view: defaults (generated template) + local overrides.
export function btoolNodeConf(nodeId: string, name: string): string {
  const row = mustGet(nodeId);
  if (!/^[\w.-]+\.conf$/.test(name)) throw inputError('نام فایل conf مجاز نیست');
  const file = path.resolve(row.conf_dir, name);
  const locals = fs.existsSync(file) ? parseConf(fs.readFileSync(file, 'utf8')) : {};
  const defaults = name === 'server.conf' ? parseConf(serverConf(row.name, row.role))
    : name === 'inputs.conf' ? parseConf(inputsConf())
    : name === 'outputs.conf' ? { tcpout: { defaultGroup: 'default-autolb-group' } }
    : {};
  return btoolView(defaults, locals);
}

export function nodeLogs(nodeId: string, tail: number): { path: string; lines: string[]; size_bytes: number } {
  const row = mustGet(nodeId);
  const p = rt.nodeLogPath(row.name, row.workspace_id);
  try {
    const stat = fs.statSync(p);
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).slice(-Math.min(500, Math.max(1, tail)));
    return { path: p, lines, size_bytes: stat.size };
  } catch {
    return { path: p, lines: [], size_bytes: 0 };
  }
}

export async function ingestTest(nodeId: string, actor: string): Promise<ValidationItem> {
  const row = mustGet(nodeId);
  const live = rt.liveOf(nodeId);
  if (!live || !live.ingestPort) {
    return { check: 'ارسال رویداد آزمایشی', status: 'fail', detail: `نود ${row.name} در حال اجرا نیست — ابتدا آن را شروع کنید` };
  }
  const marker = `lab-probe-${Date.now().toString(36)}`;
  const line = `<14>1 ${new Date().toISOString()} lab.local ${row.name} - - - ${marker}`;
  const before = live.eventsReceived;
  const sent = await rt.sendEventToNode(nodeId, line);
  await new Promise((r) => setTimeout(r, 150));
  const after = rt.liveOf(nodeId);
  const received = (after?.eventsReceived ?? 0) > before;
  if (!sent || !received) {
    return { check: 'ارسال رویداد آزمایشی', status: 'fail', detail: sent ? 'رویداد ارسال شد اما نود آن را پردازش نکرد' : `اتصال TCP به 127.0.0.1:${live.ingestPort} ناموفق بود` };
  }
  if (after!.mode === 'store') {
    const spool = rt.spoolPath({ id: row.id, name: row.name }, row.workspace_id);
    const inSpool = fs.existsSync(spool) && fs.readFileSync(spool, 'utf8').includes(marker);
    return {
      check: 'ارسال رویداد آزمایشی',
      status: inSpool ? 'pass' : 'fail',
      detail: inSpool ? `رویداد روی پورت ${live.ingestPort} دریافت و در spool نود ثبت شد (${spool})` : 'رویداد دریافت شد اما در spool ثبت نشد',
    };
  }
  const fwdOk = after!.eventsForwarded > (live.eventsForwarded ?? 0);
  const stat = after!.forwardStats.map((f) => `${f.target}: ${f.lastError ?? `ok=${f.ok}`}`).join(' | ');
  return {
    check: 'ارسال رویداد آزمایشی',
    status: fwdOk ? 'pass' : 'fail',
    detail: fwdOk ? `رویداد دریافت و به ایندکسر فوروارد شد (${stat})` : `رویداد دریافت شد اما فوروارد موفق نبود (${stat || 'بدون هدف'})`,
  };
}

export function searchNodes(workspaceId: string, query: string, nodeNames: string[], limit: number): LabSearchResult {
  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const live = rt.listLive(workspaceId).filter((n) => nodeNames.length === 0 || nodeNames.includes(n.name));
  const events: { ts: string; node: string; raw: string }[] = [];
  const perNode: Record<string, number> = {};
  const searched: string[] = [];
  for (const node of live) {
    if (node.mode !== 'store') continue;
    searched.push(node.name);
    const sp = rt.spoolPath({ id: node.nodeId, name: node.name }, workspaceId);
    if (!fs.existsSync(sp)) {
      perNode[node.name] = 0;
      continue;
    }
    const lines = fs.readFileSync(sp, 'utf8').split(/\r?\n/).filter(Boolean);
    let matched = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (events.length >= limit) break;
      try {
        const e = JSON.parse(lines[i]) as { ts: string; node: string; raw: string };
        const hay = `${e.raw} ${e.node}`.toLowerCase();
        if (terms.length === 0 || terms.every((t) => hay.includes(t))) {
          events.push(e);
          matched += 1;
        }
      } catch {
        /* skip malformed line */
      }
    }
    perNode[node.name] = matched;
  }
  return {
    query,
    searched_nodes: searched,
    skipped_forwarders: live.filter((n) => n.mode === 'forward').map((n) => n.name),
    matched: events.length,
    events: events.slice(0, limit),
    per_node: perNode,
    completed_at: new Date().toISOString(),
  };
}
