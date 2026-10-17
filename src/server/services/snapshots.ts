import { all, get, run } from '@/server/db';
import { audit } from '@/server/core/audit';
import { newId } from '@/server/core/crypto';

export interface SnapshotPort {
  port: number;
  service: string;
}

export interface SnapshotHost {
  ip: string;
  hostname: string;
  os: string;
  source: 'scan' | 'demo';
  ports: SnapshotPort[];
}

export interface ScanSnapshot {
  job_id: string;
  workspace_id: string;
  created_at: string;
  host_count: number;
  port_count: number;
  hosts: SnapshotHost[];
}

interface SnapshotRow {
  job_id: string;
  workspace_id: string;
  created_at: string;
  host_count: number;
  port_count: number;
  payload: string;
}

function toSnapshot(r: SnapshotRow): ScanSnapshot {
  return { ...r, hosts: JSON.parse(r.payload) as SnapshotHost[] };
}

function codedError(code: string, message: string): never {
  const e = new Error(message) as Error & { code: string };
  e.code = code;
  throw e;
}

export function saveScanSnapshot(
  workspaceId: string,
  jobId: string,
  hosts: SnapshotHost[],
  actor: string
): ScanSnapshot {
  const sorted = [...hosts].sort((a, b) => a.ip.localeCompare(b.ip, 'en')).map((h) => ({
    ...h,
    ports: [...h.ports].sort((a, b) => a.port - b.port),
  }));
  const portCount = sorted.reduce((s, h) => s + h.ports.length, 0);
  const now = new Date().toISOString();
  run(
    `INSERT INTO scan_snapshots (job_id, workspace_id, created_at, host_count, port_count, payload)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(job_id) DO UPDATE SET created_at = excluded.created_at, host_count = excluded.host_count,
       port_count = excluded.port_count, payload = excluded.payload`,
    jobId, workspaceId, now, sorted.length, portCount, JSON.stringify(sorted)
  );
  audit(actor, 'scan.snapshot', `scan:${jobId}`, 'success', newId('corr'));
  return { job_id: jobId, workspace_id: workspaceId, created_at: now, host_count: sorted.length, port_count: portCount, hosts: sorted };
}

export function getSnapshot(jobId: string): ScanSnapshot | null {
  const r = get<SnapshotRow>('SELECT * FROM scan_snapshots WHERE job_id = ?', jobId);
  return r ? toSnapshot(r) : null;
}

export interface SnapshotSummary {
  job_id: string;
  created_at: string;
  host_count: number;
  port_count: number;
  profile: string;
  status: string;
  demo: number;
}

export function listSnapshots(workspaceId: string): SnapshotSummary[] {
  return all<SnapshotSummary & { payload: string }>(
    `SELECT s.job_id, s.created_at, s.host_count, s.port_count, j.profile, j.status, j.demo
     FROM scan_snapshots s JOIN scan_jobs j ON j.id = s.job_id
     WHERE s.workspace_id = ? ORDER BY s.created_at DESC LIMIT 50`,
    workspaceId
  ).map(({ payload: _payload, ...rest }) => rest);
}

function mustGetSnapshot(jobId: string): ScanSnapshot {
  const snap = getSnapshot(jobId);
  if (!snap) return codedError('NOT_FOUND', `برای job «${jobId}» snapshot ثبت نشده است`);
  return snap;
}

export interface HostChange {
  ip: string;
  hostname_from: string;
  hostname_to: string;
  ports_added: SnapshotPort[];
  ports_removed: SnapshotPort[];
  service_changed: { port: number; from: string; to: string }[];
}

export interface SnapshotDiff {
  from: { job_id: string; created_at: string; host_count: number; port_count: number; profile: string };
  to: { job_id: string; created_at: string; host_count: number; port_count: number; profile: string };
  added: SnapshotHost[];
  removed: SnapshotHost[];
  changed: HostChange[];
  unchanged_hosts: number;
}

export function compareSnapshots(workspaceId: string, fromJobId: string, toJobId: string): SnapshotDiff {
  if (fromJobId === toJobId) return codedError('INVALID_INPUT', 'دو job برای مقایسه باید متفاوت باشند');
  const from = mustGetSnapshot(fromJobId);
  const to = mustGetSnapshot(toJobId);
  if (from.workspace_id !== workspaceId || to.workspace_id !== workspaceId) {
    return codedError('FORBIDDEN', 'این jobها متعلق به Workspace فعلی نیستند');
  }
  if (from.workspace_id !== to.workspace_id) return codedError('INVALID_INPUT', 'مقایسه فقط بین jobهای یک Workspace مجاز است');

  const fromHosts = new Map(from.hosts.map((h) => [h.ip, h]));
  const toHosts = new Map(to.hosts.map((h) => [h.ip, h]));

  const added: SnapshotHost[] = [];
  const removed: SnapshotHost[] = [];
  const changed: HostChange[] = [];
  let unchanged = 0;

  for (const [ip, h] of toHosts) {
    const old = fromHosts.get(ip);
    if (!old) {
      added.push(h);
      continue;
    }
    const oldPorts = new Map(old.ports.map((p) => [p.port, p.service]));
    const newPorts = new Map(h.ports.map((p) => [p.port, p.service]));
    const ports_added = h.ports.filter((p) => !oldPorts.has(p.port));
    const ports_removed = old.ports.filter((p) => !newPorts.has(p.port));
    const service_changed = h.ports
      .filter((p) => oldPorts.has(p.port) && oldPorts.get(p.port) !== p.service)
      .map((p) => ({ port: p.port, from: String(oldPorts.get(p.port)), to: p.service }));
    if (old.hostname !== h.hostname || ports_added.length || ports_removed.length || service_changed.length) {
      changed.push({ ip, hostname_from: old.hostname, hostname_to: h.hostname, ports_added, ports_removed, service_changed });
    } else {
      unchanged++;
    }
  }
  for (const [ip, h] of fromHosts) {
    if (!toHosts.has(ip)) removed.push(h);
  }

  const meta = (s: ScanSnapshot) => {
    const job = get<{ profile: string }>('SELECT profile FROM scan_jobs WHERE id = ?', s.job_id);
    return {
      job_id: s.job_id,
      created_at: s.created_at,
      host_count: s.host_count,
      port_count: s.port_count,
      profile: job?.profile ?? 'unknown',
    };
  };

  return {
    from: meta(from),
    to: meta(to),
    added: added.sort((a, b) => a.ip.localeCompare(b.ip, 'en')),
    removed: removed.sort((a, b) => a.ip.localeCompare(b.ip, 'en')),
    changed: changed.sort((a, b) => a.ip.localeCompare(b.ip, 'en')),
    unchanged_hosts: unchanged,
  };
}
