// Lab Runtime: in-process, real TCP+HTTP lab nodes on 127.0.0.1 only.
// Behavior is driven by each node's .conf files (inputs/outputs) — a lab
// simulator, NOT real Splunk. No outbound connections beyond running lab nodes.

import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { dataDir } from '@/server/db';
import { parseConf, type ConfDoc } from '@/server/lab/conf';

export interface NodeDef {
  id: string;
  workspaceId: string;
  name: string;
  role: string;
  confDir: string; // absolute path containing inputs.conf / outputs.conf / server.conf
}

export interface ForwardStat {
  target: string;
  ok: number;
  fail: number;
  lastError: string | null;
}

export interface LiveState {
  nodeId: string;
  name: string;
  role: string;
  workspaceId: string;
  ingestPort: number | null;
  mgmtPort: number;
  startedAt: string;
  eventsReceived: number;
  eventsStored: number;
  eventsForwarded: number;
  forwardStats: ForwardStat[];
  mode: 'store' | 'forward';
}

interface Running extends LiveState {
  tcp: net.Server | null;
  mgmt: http.Server;
  confDir: string;
  workspacePath: string;
}

// Next.js server bundling can instantiate this module separately per route;
// anchor the registry on globalThis so all routes share one live runtime.
const g = globalThis as unknown as { __sisLabRegistry?: Map<string, Running> };
const registry: Map<string, Running> = (g.__sisLabRegistry ??= new Map<string, Running>());

export function labRoot(workspaceId: string): string {
  return path.join(dataDir(), 'local-lab', workspaceId);
}

export function spoolPath(def: { id: string; name: string }, workspaceId: string): string {
  return path.join(labRoot(workspaceId), 'var', 'spool', def.name, 'events.jsonl');
}

export function nodeLogPath(name: string, workspaceId: string): string {
  return path.join(labRoot(workspaceId), 'var', 'log', 'splunk-lab', name, 'splunkd-lab.log');
}

export function isRunning(nodeId: string): boolean {
  return registry.has(nodeId);
}

export function liveOf(nodeId: string): LiveState | null {
  const r = registry.get(nodeId);
  if (!r) return null;
  return snapshot(r);
}

export function listLive(workspaceId?: string): LiveState[] {
  const arr = [...registry.values()];
  return (workspaceId ? arr.filter((r) => r.workspaceId === workspaceId) : arr).map(snapshot);
}

function snapshot(r: Running): LiveState {
  const { tcp, mgmt, confDir, workspacePath, ...rest } = r;
  void tcp; void mgmt; void confDir; void workspacePath;
  return { ...rest, forwardStats: r.forwardStats.map((f) => ({ ...f })) };
}

function appendNodeLog(r: { name: string; workspacePath: string }, line: string): void {
  try {
    const p = path.join(r.workspacePath, 'var', 'log', 'splunk-lab', r.name, 'splunkd-lab.log');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, `[${new Date().toISOString()}] ${line}\n`);
  } catch {
    /* logging must never break the runtime */
  }
}

function loadConf(confDir: string, name: string): ConfDoc {
  const p = path.join(confDir, name);
  try {
    return parseConf(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function ingestConfig(conf: ConfDoc): { enabled: boolean; port: number | null } {
  for (const [stanza, props] of Object.entries(conf)) {
    const m = /^splunktcp:\/\/(\d+)/i.exec(stanza);
    if (!m) continue;
    const dis = (props.disabled ?? '0').toLowerCase();
    if (dis === '1' || dis === 'true') return { enabled: false, port: Number(m[1]) };
    return { enabled: true, port: Number(m[1]) };
  }
  return { enabled: false, port: null };
}

function forwardTargets(conf: ConfDoc): string[] {
  const group = conf['tcpout:default-autolb-group'] ?? {};
  const tcpout = conf['tcpout'] ?? {};
  if ((tcpout.disabled ?? '0').toLowerCase() === '1') return [];
  const servers = (group.server ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return servers;
}

// Resolve a "host:port" target: lab node names resolve to that node's LIVE
// ingest port; literal 127.0.0.1 is allowed; anything else is refused.
function resolveTarget(r: Running, target: string): { port: number; label: string } | null {
  const m = /^(.+):(\d+)$/.exec(target);
  if (!m) return null;
  const host = m[1];
  const literalPort = Number(m[2]);
  for (const peer of registry.values()) {
    if (peer.workspaceId === r.workspaceId && peer.name === host && peer.ingestPort) {
      return { port: peer.ingestPort, label: `${host} (node:${peer.name})` };
    }
  }
  if ((host === '127.0.0.1' || host === 'localhost') && Number.isInteger(literalPort)) {
    return { port: literalPort, label: `${host}:${literalPort}` };
  }
  return null;
}

function tcpSendLine(port: number, payload: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const sock = new net.Socket();
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (ok) sock.end();
      else sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(1500);
    sock.once('connect', () => sock.write(payload, (err) => finish(!err)));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
    sock.once('close', () => finish(false));
    try {
      sock.connect(port, '127.0.0.1');
    } catch {
      finish(false);
    }
  });
}

function storeEvent(r: Running, raw: string): void {
  const p = spoolPath({ id: r.nodeId, name: r.name }, r.workspaceId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify({ ts: new Date().toISOString(), node: r.name, role: r.role, raw }) + '\n');
  r.eventsStored += 1;
}

async function handleLine(r: RunningExt, raw: string): Promise<void> {
  r.eventsReceived += 1;
  const trimmed = raw.trim();
  if (!trimmed) return;
  if (r.mode === 'forward' && r.targets.length > 0) {
    for (const target of r.targets) {
      const res = resolveTarget(r, target);
      const stat = r.forwardStats.find((f) => f.target === target) ?? pushStat(r, target);
      if (!res) {
        stat.fail += 1;
        stat.lastError = 'هدف خارج از نودهای زندهٔ آزمایشگاه است (فقط نام نود یا 127.0.0.1 مجاز است)';
        continue;
      }
      const ok = await tcpSendLine(res.port, `${trimmed}\n`);
      if (ok) {
        stat.ok += 1;
        stat.lastError = null;
        r.eventsForwarded += 1;
      } else {
        stat.fail += 1;
        stat.lastError = `ارسال به ${res.label} ناموفق بود (گیرنده در دسترس نیست)`;
      }
    }
    return;
  }
  storeEvent(r, trimmed);
}

function pushStat(r: Running, target: string): ForwardStat {
  const s: ForwardStat = { target, ok: 0, fail: 0, lastError: null };
  r.forwardStats.push(s);
  return s;
}

// extended fields kept outside LiveState
type RunningExt = Running & { targets: string[] };

function listenTcp(onConnection: (s: net.Socket) => void, requested: number | null): Promise<{ server: net.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const tryBind = (port: number) => {
      const server = net.createServer(onConnection);
      server.once('error', (e) => {
        server.close();
        if ((e as NodeJS.ErrnoException).code === 'EADDRINUSE' && port !== 0) {
          const next = port + 1;
          if (next > port + 20) reject(e);
          else tryBind(next);
        } else reject(e);
      });
      server.listen({ host: '127.0.0.1', port }, () => {
        const addr = server.address();
        resolve({ server, port: typeof addr === 'object' && addr ? addr.port : port });
      });
    };
    tryBind(requested ?? 0);
  });
}

export async function startNode(def: NodeDef): Promise<LiveState> {
  const existing = registry.get(def.id);
  if (existing) return snapshot(existing);

  if (!fs.existsSync(def.confDir)) {
    throw new Error(`پیکربندی نود ${def.name} یافت نشد؛ ابتدا محیط آزمایشگاهی را بسازید`);
  }
  const inputs = loadConf(def.confDir, 'inputs.conf');
  const outputs = loadConf(def.confDir, 'outputs.conf');
  const ing = ingestConfig(inputs);
  const targets = forwardTargets(outputs);
  const mode: 'store' | 'forward' = targets.length > 0 ? 'forward' : 'store';

  const workspacePath = labRoot(def.workspaceId);
  const run = {
    nodeId: def.id,
    name: def.name,
    role: def.role,
    workspaceId: def.workspaceId,
    confDir: def.confDir,
    workspacePath,
    ingestPort: null as number | null,
    mgmtPort: 0,
    startedAt: new Date().toISOString(),
    eventsReceived: 0,
    eventsStored: 0,
    eventsForwarded: 0,
    forwardStats: targets.map((t) => ({ target: t, ok: 0, fail: 0, lastError: null })),
    mode,
    targets,
    tcp: null as net.Server | null,
    mgmt: null as unknown as http.Server,
  } as RunningExt;

  // A running node always listens on TCP so the lab pipeline is exercisable;
  // the conf port is the preference, with +1..+20 then ephemeral fallback.
  const desired = ing.port ?? 0;
  const tcpRes = await listenTcp((sock) => {
    let buf = '';
    sock.on('data', (chunk) => {
      buf += chunk.toString();
      let idx: number;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        void handleLine(run, line);
      }
    });
    sock.on('end', () => {
      if (buf.trim()) void handleLine(run, buf);
    });
  }, desired);
  run.tcp = tcpRes.server;
  run.ingestPort = tcpRes.port;

  const mgmt = http.createServer((req, res) => void handleMgmt(run, req, res));
  const mgmtPort = await new Promise<number>((resolve, reject) => {
    mgmt.once('error', reject);
    mgmt.listen({ host: '127.0.0.1', port: 0 }, () => {
      const addr = mgmt.address();
      resolve(typeof addr === 'object' && addr ? addr.port : 0);
    });
  });
  run.mgmt = mgmt;
  run.mgmtPort = mgmtPort;

  registry.set(def.id, run);
  appendNodeLog(run, `node started: mode=${mode} ingest=127.0.0.1:${run.ingestPort} mgmt=127.0.0.1:${mgmtPort} targets=[${targets.join(', ')}]`);
  return snapshot(run);
}

export async function stopNode(nodeId: string): Promise<LiveState | null> {
  const r = registry.get(nodeId);
  if (!r) return null;
  registry.delete(nodeId);
  appendNodeLog(r, `node stopping (received=${r.eventsReceived} stored=${r.eventsStored} forwarded=${r.eventsForwarded})`);
  if (r.tcp) await new Promise<void>((res) => r.tcp!.close(() => res()));
  await new Promise<void>((res) => r.mgmt.close(() => res()));
  return snapshot(r);
}

export async function restartNode(def: NodeDef): Promise<LiveState> {
  await stopNode(def.id);
  return startNode(def);
}

function json(res: http.ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function handleMgmt(r: RunningExt, req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const p = url.pathname;
  if (req.method === 'GET' && p === '/health') {
    return json(res, 200, { status: 'up', ...snapshot(r), conf_dir: r.confDir });
  }
  if (req.method === 'GET' && p === '/stats') {
    return json(res, 200, snapshot(r));
  }
  if (req.method === 'GET' && p.startsWith('/conf/')) {
    const name = decodeURIComponent(p.slice('/conf/'.length));
    if (!/^[\w.-]+\.conf$/.test(name)) return json(res, 400, { error: 'نام conf مجاز نیست' });
    const file = path.join(r.confDir, name);
    const resolved = path.resolve(file);
    if (!resolved.startsWith(path.resolve(r.confDir))) return json(res, 403, { error: 'خارج از دایرکتوری پیکربندی' });
    if (!fs.existsSync(resolved)) return json(res, 404, { error: `${name} وجود ندارد` });
    return json(res, 200, { name, raw: fs.readFileSync(resolved, 'utf8') });
  }
  if (req.method === 'GET' && p === '/logs') {
    const tail = Math.min(500, Math.max(1, Number(url.searchParams.get('tail') ?? 100)));
    const logFile = nodeLogPath(r.name, r.workspaceId);
    let lines: string[] = [];
    try {
      lines = fs.readFileSync(logFile, 'utf8').split(/\r?\n/).filter(Boolean).slice(-tail);
    } catch {
      lines = [];
    }
    return json(res, 200, { path: logFile, lines });
  }
  if (req.method === 'POST' && p === '/event') {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 64_000) req.destroy();
    });
    req.on('end', () => {
      let line = body;
      try {
        const parsed = JSON.parse(body) as { line?: string };
        line = parsed.line ?? body;
      } catch {
        /* raw text body */
      }
      void handleLine(r, String(line));
      json(res, 202, { accepted: true, ...snapshot(r) });
    });
    return;
  }
  if (req.method === 'GET' && p === '/search') {
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));
    const terms = q.split(/\s+/).filter(Boolean);
    const sp = spoolPath({ id: r.nodeId, name: r.name }, r.workspaceId);
    const events: { ts: string; node: string; raw: string }[] = [];
    if (fs.existsSync(sp)) {
      const lines = fs.readFileSync(sp, 'utf8').split(/\r?\n/).filter(Boolean);
      for (let i = lines.length - 1; i >= 0 && events.length < limit; i--) {
        try {
          const e = JSON.parse(lines[i]) as { ts: string; node: string; raw: string };
          const hay = `${e.raw} ${e.node}`.toLowerCase();
          if (terms.length === 0 || terms.every((t) => hay.includes(t))) events.push(e);
        } catch {
          /* skip malformed spool line */
        }
      }
    }
    return json(res, 200, { node: r.name, mode: r.mode, matched: events.length, events, spool: fs.existsSync(sp) ? sp : null });
  }
  json(res, 404, { error: 'مسیر ناشناخته — /health /stats /conf/<name>.conf /logs /search /event' });
}

export async function sendEventToNode(nodeId: string, line: string): Promise<boolean> {
  const r = registry.get(nodeId);
  if (!r || !r.ingestPort) return false;
  return tcpSendLine(r.ingestPort, line.endsWith('\n') ? line : `${line}\n`);
}
