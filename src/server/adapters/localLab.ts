import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { dataDir } from '@/server/db';
import type { SplunkNodeSpec, ValidationItem } from '@/lib/types';

export interface LabContext {
  workspaceId: string;
  jobId: string;
  nodes: SplunkNodeSpec[];
}

const listeners = new Map<string, net.Server>();

function labRoot(workspaceId: string): string {
  return path.join(dataDir(), 'local-lab', workspaceId);
}

export function labExists(workspaceId: string): boolean {
  return fs.existsSync(path.join(labRoot(workspaceId), 'manifest.json'));
}

export function readManifest(workspaceId: string): { created_at: string; nodes: { name: string; role: string }[] } | null {
  const p = path.join(labRoot(workspaceId), 'manifest.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function confServerXml(nodeName: string, role: string): string {
  return `# Local Lab generated configuration — node: ${nodeName} (role: ${role})
# This is a lab sandbox artifact, NOT a real Splunk installation.
[general]
serverName = ${nodeName}
site = lab

[sslConfig]
enableSplunkdSSL = false
`;
}

function confInputs(role: string): string {
  const stanzas = role.includes('Indexer') || role === 'Standalone'
    ? '[splunktcp://9997]\ndisabled = false\n'
    : '[monitor://$SPLUNK_HOME/var/log/lab/*.log]\ndisabled = false\n';
  return `# inputs.conf (lab)\n${stanzas}`;
}

function confOutputs(indexers: string[]): string {
  if (indexers.length === 0) return '# outputs.conf (lab) — no indexers configured\n';
  return `# outputs.conf (lab)\n[tcpout]\ndefaultGroup = default-autolb-group\n\n[tcpout:default-autolb-group]\nserver = ${indexers.map((i) => `${i}:9997`).join(', ')}\n`;
}

export function nodeName(spec: SplunkNodeSpec, idx: number): string {
  const slug = spec.role.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${slug}-${idx + 1}`;
}

export async function provisionLab(ctx: LabContext, onProgress: (pct: number, msg: string) => void, isCancelled: () => boolean): Promise<void> {
  const root = labRoot(ctx.workspaceId);
  const etc = path.join(root, 'etc');
  fs.mkdirSync(etc, { recursive: true });

  const indexers: string[] = [];
  const allNodes: { name: string; role: string }[] = [];
  let i = 0;
  for (const spec of ctx.nodes) {
    for (let c = 0; c < spec.count; c++) {
      if (isCancelled()) throw new Error('cancelled');
      const name = nodeName(spec, i);
      const roleIsIndexer = spec.role.toLowerCase().includes('indexer') || spec.role === 'Standalone';
      if (roleIsIndexer) indexers.push(name);
      allNodes.push({ name, role: spec.role });
      const nodeEtc = path.join(etc, name, 'system', 'local');
      const nodeVar = path.join(root, 'var', 'log', 'splunk-lab', name);
      fs.mkdirSync(nodeEtc, { recursive: true });
      fs.mkdirSync(nodeVar, { recursive: true });
      fs.writeFileSync(path.join(nodeEtc, 'server.conf'), confServerXml(name, spec.role));
      fs.writeFileSync(path.join(nodeEtc, 'inputs.conf'), confInputs(spec.role));
      fs.mkdirSync(path.join(nodeEtc, '..', '..'), { recursive: true });
      i++;
      onProgress(Math.round((i / Math.max(1, allNodes.length)) * 90), `ساخت نود آزمایشگاهی ${name}`);
      await new Promise((r) => setTimeout(r, 120));
    }
  }
  fs.writeFileSync(path.join(etc, 'outputs.conf'), confOutputs(indexers));
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ created_at: new Date().toISOString(), nodes: allNodes, target: 'local-lab (sandbox)' }, null, 2));
  fs.writeFileSync(path.join(root, 'var', 'log', 'splunk-lab', 'splunkd-lab.log'), `[${new Date().toISOString()}] lab environment provisioned: ${allNodes.length} node(s)\n`);
  onProgress(95, 'محیط آزمایشگاهی محلی ساخته شد');
}

function bindServer(server: net.Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => {
      server.close();
      reject(err);
    };
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onError);
      server.on('error', () => {});
      const addr = server.address();
      resolve(typeof addr === 'object' && addr ? addr.port : port);
    });
  });
}

export async function startLabListener(workspaceId: string, port: number): Promise<number> {
  const eventsLog = path.join(labRoot(workspaceId), 'var', 'log', 'splunk-lab', 'lab-events.log');
  fs.mkdirSync(path.dirname(eventsLog), { recursive: true });
  await stopLabListener(workspaceId);
  const onConnection = (sock: net.Socket) => {
    sock.on('data', (chunk) => {
      fs.appendFileSync(eventsLog, chunk.toString());
    });
  };
  let server = net.createServer(onConnection);
  let bound: number;
  try {
    bound = await bindServer(server, port);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw e;
    server = net.createServer(onConnection);
    bound = await bindServer(server, 0);
  }
  listeners.set(workspaceId, server);
  return bound;
}

export async function stopLabListener(workspaceId: string): Promise<void> {
  const s = listeners.get(workspaceId);
  if (s) {
    await new Promise<void>((resolve) => s.close(() => resolve()));
    listeners.delete(workspaceId);
  }
}

function sendOnce(port: number, payload: string): Promise<boolean> {
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
    sock.setTimeout(1200);
    sock.once('connect', () => {
      sock.write(payload, (err) => finish(!err));
    });
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

export async function sendLabEvent(workspaceId: string, port: number, line: string): Promise<boolean> {
  const payload = line.endsWith('\n') ? line : `${line}\n`;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await sendOnce(port, payload)) return true;
    await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
  }
  return false;
}

export async function validateLab(workspaceId: string, listenerPort: number): Promise<ValidationItem[]> {
  const out: ValidationItem[] = [];
  const manifest = readManifest(workspaceId);
  out.push({
    check: 'وجود مانیفست محیط آزمایشگاهی',
    status: manifest ? 'pass' : 'fail',
    detail: manifest ? `مانیفست با ${manifest.nodes.length} نود یافت شد (${new Date(manifest.created_at).toLocaleString('fa-IR')})` : 'مانیفست یافت نشد',
  });
  if (manifest) {
    let confOk = 0;
    for (const n of manifest.nodes) {
      const p = path.join(labRoot(workspaceId), 'etc', n.name, 'system', 'local', 'server.conf');
      if (fs.existsSync(p)) confOk++;
    }
    out.push({
      check: 'فایل‌های پیکربندی نودها',
      status: confOk === manifest.nodes.length ? 'pass' : 'fail',
      detail: `${confOk}/${manifest.nodes.length} نود فایل server.conf دارند`,
    });
  }
  const marker = `validation-probe-${Date.now().toString(36)}`;
  const sent = await sendLabEvent(workspaceId, listenerPort, `<14>1 ${new Date().toISOString()} lab.test splunk-lab - - - ${marker}`);
  const eventsLog = path.join(labRoot(workspaceId), 'var', 'log', 'splunk-lab', 'lab-events.log');
  let received = false;
  for (let i = 0; i < 10 && !received; i++) {
    try {
      received = fs.readFileSync(eventsLog, 'utf8').includes(marker);
    } catch {
      received = false;
    }
    if (!received) await new Promise((r) => setTimeout(r, 100));
  }
  out.push({
    check: 'جریان داده آزمایشی (test event ingest)',
    status: received ? 'pass' : 'fail',
    detail: received
      ? `رویداد آزمایشی روی گیرنده محلی (127.0.0.1:${listenerPort}) دریافت و در lab-events.log ثبت شد`
      : sent
        ? 'اتصال به گیرنده محلی برقرار شد اما رویداد در lab-events.log ثبت نشد'
        : `گیرنده محلی روی پورت ${listenerPort} پاسخ نداد`,
  });
  const outOk = fs.existsSync(path.join(labRoot(workspaceId), 'etc', 'outputs.conf'));
  out.push({ check: 'پیکربندی outputs.conf', status: outOk ? 'pass' : 'not_verified', detail: outOk ? 'فایل یافت شد' : 'اجرای تست جریان داده واقعی در دسترس نیست' });
  return out;
}

export function labSystemFacts(): { cpus: number; totalMemGb: number; freeMemGb: number; freeDiskGb: number; dataDir: string } {
  let freeDiskGb = -1;
  try {
    const s = fs.statfsSync(dataDir());
    freeDiskGb = Math.round((s.bavail * s.bsize) / 1024 ** 3);
  } catch {
    freeDiskGb = -1;
  }
  return {
    cpus: os.cpus().length,
    totalMemGb: Math.round(os.totalmem() / 1024 ** 3),
    freeMemGb: Math.round(os.freemem() / 1024 ** 3),
    freeDiskGb,
    dataDir: dataDir(),
  };
}
