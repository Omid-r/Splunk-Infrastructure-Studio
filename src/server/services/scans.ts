import dns from 'node:dns/promises';
import { all, get, run, tx } from '@/server/db';
import { newId } from '@/server/core/crypto';
import { audit } from '@/server/core/audit';
import { assertAllowed, cidrContainsIp, expandCidr, isIPv4, ScopeError } from '@/server/core/scope';
import { emitJobEvent, isCancelled } from '@/server/core/jobs';
import { QUICK_PORTS, STANDARD_PORTS, mapLimit, serviceGuess, tcpProbe } from '@/server/adapters/tcpScan';
import { workspaceScopes } from '@/server/services/workspace';
import { loadDemoDataset } from '@/server/services/demo';
import type { ScanJob, ScanProfile } from '@/lib/types';

const MAX_HOSTS = () => Number(process.env.SCAN_MAX_HOSTS ?? 1024);
const PROFILES: Record<ScanProfile, { ports: number[]; concurrency: number; reverseDns: boolean; label: string }> = {
  quick: { ports: QUICK_PORTS, concurrency: 128, reverseDns: false, label: 'کشف سریع' },
  standard: { ports: STANDARD_PORTS, concurrency: 96, reverseDns: true, label: 'موجودی استاندارد' },
  credentialed: { ports: STANDARD_PORTS, concurrency: 64, reverseDns: true, label: 'موجودی با اعتبارنامه' },
};

export function profileMeta(profile: ScanProfile) {
  return PROFILES[profile];
}

export function listScans(workspaceId: string): ScanJob[] {
  return all<ScanJob & { targets: string; exclusions: string; ports: string }>(
    'SELECT * FROM scan_jobs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50', workspaceId
  ).map((r) => ({ ...r, targets: JSON.parse(r.targets), exclusions: JSON.parse(r.exclusions), ports: JSON.parse(r.ports) }));
}

export function getScan(jobId: string): ScanJob | null {
  const r = get<ScanJob & { targets: string; exclusions: string; ports: string }>('SELECT * FROM scan_jobs WHERE id = ?', jobId);
  if (!r) return null;
  return { ...r, targets: JSON.parse(r.targets), exclusions: JSON.parse(r.exclusions), ports: JSON.parse(r.ports) };
}

export function createScan(input: {
  workspaceId: string;
  profile: ScanProfile;
  targets: string[];
  exclusions: string[];
  actor: string;
}): ScanJob {
  const cfg = PROFILES[input.profile];
  if (!cfg) throw new Error('پروفایل نامعتبر است');
  const { ranges, exclusions: wsExclusions } = workspaceScopes(input.workspaceId);
  const mergedExclusions = [...new Set([...wsExclusions, ...input.exclusions])];
  const normalized = assertAllowed(input.targets, ranges, mergedExclusions, MAX_HOSTS());
  const jobId = newId('scan');
  const now = new Date().toISOString();
  run(
    `INSERT INTO scan_jobs (id, workspace_id, profile, targets, exclusions, ports, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
    jobId, input.workspaceId, input.profile, JSON.stringify(normalized.map((n) => n.value)),
    JSON.stringify(mergedExclusions), JSON.stringify(cfg.ports), input.actor, now
  );
  audit(input.actor, 'scan.create', `scan:${jobId}`, 'success', newId('corr'));
  void runScanAsync(jobId);
  return getScan(jobId)!;
}

export function createDemoScan(workspaceId: string, actor: string): ScanJob {
  const jobId = newId('scan');
  const now = new Date().toISOString();
  run(
    `INSERT INTO scan_jobs (id, workspace_id, profile, targets, exclusions, ports, status, demo, created_by, created_at, started_at, finished_at)
     VALUES (?, ?, 'quick', '["DEMO"]', '[]', '[]', 'success', 1, ?, ?, ?, ?)`,
    jobId, workspaceId, actor, now, now, now
  );
  const loaded = loadDemoDataset(workspaceId, actor);
  emitJobEvent(jobId, 'scan', `دیتاست نمایشی با ${loaded} سرور بارگذاری شد — DEMO DATA`, 'success');
  audit(actor, 'scan.demo', `scan:${jobId}`, 'success', newId('corr'));
  return getScan(jobId)!;
}

export function cancelScan(jobId: string, actor: string): void {
  const job = getScan(jobId);
  if (!job) return;
  if (job.status === 'running' || job.status === 'queued') {
    run("UPDATE scan_jobs SET status = 'cancelled', finished_at = ? WHERE id = ?", new Date().toISOString(), jobId);
    emitJobEvent(jobId, 'scan', 'اسکن توسط کاربر لغو شد', 'warning');
    audit(actor, 'scan.cancel', `scan:${jobId}`, 'success', newId('corr'));
  }
}

async function runScanAsync(jobId: string): Promise<void> {
  const job = getScan(jobId);
  if (!job) return;
  const cfg = PROFILES[job.profile];
  const started = new Date().toISOString();
  run("UPDATE scan_jobs SET status = 'running', started_at = ? WHERE id = ?", started, jobId);
  emitJobEvent(jobId, 'scan', `شروع اسکن ${cfg.label} روی ${job.targets.join(', ')}`, 'info');

  try {
    const exclusions: string[] = job.exclusions;
    const hosts: string[] = [];
    for (const t of job.targets) {
      if (t.includes('/')) {
        hosts.push(...expandCidr(t, MAX_HOSTS()).filter((ip) => !exclusions.some((e) => { try { return cidrContainsIp(e, ip); } catch { return false; } })));
      } else if (isIPv4(t) && !exclusions.some((e) => { try { return cidrContainsIp(e, t); } catch { return false; } })) {
        hosts.push(t);
      }
    }
    const uniqueHosts = [...new Set(hosts)];
    run('UPDATE scan_jobs SET total_hosts = ? WHERE id = ?', uniqueHosts.length, jobId);
    emitJobEvent(jobId, 'scan', `${uniqueHosts.length} هاست در scope قرار گرفت؛ پورت‌های بررسی: ${job.ports.length}`, 'info');

    let scanned = 0;
    let hostsUp = 0;
    let openPortCount = 0;

    await mapLimit(uniqueHosts, cfg.concurrency, async (ip) => {
      if (isCancelled('scan_jobs', jobId)) throw new Error('cancelled');
      const open = await mapLimit(job.ports, 24, async (port) => ((await tcpProbe(ip, port)) ? port : 0));
      const openPorts = open.filter((p) => p > 0);
      scanned++;
      if (openPorts.length > 0) {
        hostsUp++;
        openPortCount += openPorts.length;
        let hostname = ip;
        if (cfg.reverseDns) {
          try {
            const names = await dns.reverse(ip);
            if (names && names.length > 0) hostname = names[0];
          } catch {
            /* reverse lookup failed — keep IP as hostname */
          }
        }
        upsertHostFromScan(job.workspace_id, jobId, ip, hostname, openPorts, job.profile);
      }
      if (scanned % 8 === 0 || scanned === uniqueHosts.length) {
        run('UPDATE scan_jobs SET scanned_hosts = ?, hosts_up = ?, open_ports = ?, progress = ? WHERE id = ?', scanned, hostsUp, openPortCount, Math.round((scanned / uniqueHosts.length) * 100), jobId);
      }
    });

    if (job.profile === 'credentialed') {
      emitJobEvent(jobId, 'scan', 'این نسخه: موجودی‌گیری credentialed از طریق SSH/WinRM Coming later است — فقط شواهد پورت ثبت شد', 'warning');
    }

    const finished = new Date().toISOString();
    run("UPDATE scan_jobs SET status = 'success', progress = 100, finished_at = ? WHERE id = ?", finished, jobId);
    emitJobEvent(jobId, 'scan', `اسکن کامل شد: ${hostsUp} هاست فعال، ${openPortCount} پورت باز`, 'success');
    buildTopologySnapshot(job.workspace_id);
  } catch (e) {
    const finished = new Date().toISOString();
    const cancelled = (e as Error).message === 'cancelled';
    run('UPDATE scan_jobs SET status = ?, error = ?, finished_at = ? WHERE id = ?', cancelled ? 'cancelled' : 'failed', cancelled ? null : String((e as Error).message), finished, jobId);
    emitJobEvent(jobId, 'scan', cancelled ? 'اسکن لغو شد' : `خطا در اسکن: ${(e as Error).message}`, cancelled ? 'warning' : 'error');
  }
}

function upsertHostFromScan(workspaceId: string, jobId: string, ip: string, hostname: string, openPorts: number[], profile: ScanProfile): void {
  const now = new Date().toISOString();
  tx(() => {
    let host = get<{ id: string }>('SELECT id FROM hosts WHERE workspace_id = ? AND ip = ? AND is_demo = 0', workspaceId, ip);
    if (!host) {
      const id = newId('h');
      run(
        `INSERT INTO hosts (id, workspace_id, hostname, ip, os, health, status_label, is_demo, first_seen_at, last_seen_at, source)
         VALUES (?, ?, ?, ?, 'Unknown', 'unknown', 'نامشخص', 0, ?, ?, 'scan')`,
        id, workspaceId, hostname, ip, now, now
      );
      host = { id };
      emitJobEvent(jobId, 'scan', `هاست جدید: ${hostname} (${ip})`, 'success');
    } else {
      run('UPDATE hosts SET hostname = ?, last_seen_at = ? WHERE id = ?', hostname, now, host.id);
    }
    for (const port of openPorts) {
      const exists = get('SELECT id FROM host_ports WHERE host_id = ? AND port = ?', host.id, port);
      const service = serviceGuess(port);
      if (exists) {
        run('UPDATE host_ports SET service = ?, observed_at = ? WHERE host_id = ? AND port = ?', service, now, host.id, port);
      } else {
        run(
          "INSERT INTO host_ports (id, host_id, port, protocol, service, state, observed_at, source) VALUES (?, ?, ?, 'tcp', ?, 'open', ?, ?)",
          newId('hp'), host.id, port, service, now, `scan:${profile}`
        );
      }
      run(
        'INSERT INTO observations (id, host_id, kind, key, value, source, confidence, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        newId('ob'), host.id, 'port', String(port), `open (${service})`, `scan:${profile}`, service === 'unknown' ? 'observed' : 'inferred', now
      );
    }
  });
}

export function buildTopologySnapshot(workspaceId: string): void {
  const hosts = all<{ id: string; ip: string; hostname: string; role: string | null; health: string; is_demo: number; last_seen_at: string }>(
    'SELECT id, ip, hostname, role, health, is_demo, last_seen_at FROM hosts WHERE workspace_id = ?', workspaceId
  );
  const nodes: { id: string; kind: string; label: string; sub?: string; hostId?: string; demo?: boolean }[] = [];
  const edges: { id: string; source: string; target: string; kind: string; label?: string }[] = [];
  const subnets = new Map<string, string>();
  hosts.forEach((h, i) => {
    const parts = h.ip.split('.');
    const subnetKey = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    if (!subnets.has(subnetKey)) {
      const sid = `subnet-${subnets.size + 1}`;
      subnets.set(subnetKey, sid);
      nodes.push({ id: sid, kind: 'subnet', label: subnetKey, sub: 'زیرشبکه کشف‌شده' });
    }
    const nid = `host-${h.id}`;
    nodes.push({ id: nid, kind: 'host', label: h.hostname, sub: h.ip, hostId: h.id, demo: h.is_demo === 1 });
    edges.push({ id: `e-${nid}-${subnets.get(subnetKey)}`, source: nid, target: subnets.get(subnetKey)!, kind: 'membership' });
    void i;
  });
  run('INSERT INTO topology_snapshots (id, workspace_id, nodes, edges, generated_at) VALUES (?, ?, ?, ?, ?)',
    newId('snap'), workspaceId, JSON.stringify(nodes), JSON.stringify(edges), new Date().toISOString());
}

export { ScopeError };
