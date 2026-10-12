import { all, get, run, tx } from '@/server/db';
import { newId } from '@/server/core/crypto';
import { audit } from '@/server/core/audit';
import type { Host } from '@/lib/types';

interface DemoHost {
  hostname: string;
  ip: string;
  os: string;
  osVersion: string;
  role: string;
  health: Host['health'];
  statusLabel: string;
  cpu: string;
  ramGb: number;
  diskTotal: number;
  diskFree: number;
  uptimeSec: number;
  ports: number[];
  tags: string[];
  owner: string;
}

const DEMO_HOSTS: DemoHost[] = [
  {
    hostname: 'fw-core-01', ip: '10.10.0.1', os: 'Unknown', osVersion: '', role: 'firewall',
    health: 'healthy', statusLabel: 'Healthy', cpu: 'Unknown', ramGb: 0, diskTotal: 0, diskFree: 0,
    uptimeSec: 86400 * 41, ports: [443, 8443], tags: ['edge', 'security'], owner: 'تیم شبکه',
  },
  {
    hostname: 'splunk-idx-01', ip: '10.10.1.11', os: 'RHEL', osVersion: '9.4', role: 'indexer',
    health: 'healthy', statusLabel: 'Healthy', cpu: '16 vCPU', ramGb: 64, diskTotal: 4096, diskFree: 2912,
    uptimeSec: 86400 * 12, ports: [22, 8000, 8089, 9997, 8191], tags: ['splunk', 'core'], owner: 'تیم پلتفرم',
  },
  {
    hostname: 'splunk-idx-02', ip: '10.10.1.12', os: 'RHEL', osVersion: '9.4', role: 'indexer',
    health: 'warning', statusLabel: 'Warning', cpu: '16 vCPU', ramGb: 64, diskTotal: 4096, diskFree: 780,
    uptimeSec: 86400 * 12, ports: [22, 8000, 8089, 9997, 8191], tags: ['splunk', 'core'], owner: 'تیم پلتفرم',
  },
  {
    hostname: 'splunk-shc-01', ip: '10.10.1.21', os: 'RHEL', osVersion: '9.4', role: 'search-head',
    health: 'healthy', statusLabel: 'Healthy', cpu: '8 vCPU', ramGb: 32, diskTotal: 500, diskFree: 390,
    uptimeSec: 86400 * 12, ports: [22, 8000, 8089, 8191], tags: ['splunk', 'search'], owner: 'تیم پلتفرم',
  },
  {
    hostname: 'splunk-hf-01', ip: '10.10.2.31', os: 'Ubuntu', osVersion: '22.04', role: 'heavy-forwarder',
    health: 'healthy', statusLabel: 'Healthy', cpu: '4 vCPU', ramGb: 16, diskTotal: 200, diskFree: 150,
    uptimeSec: 86400 * 5, ports: [22, 8089, 9997], tags: ['splunk', 'forwarder'], owner: 'تیم پلتفرم',
  },
  {
    hostname: 'dc-01', ip: '10.10.0.10', os: 'Windows Server', osVersion: '2022', role: 'domain-controller',
    health: 'healthy', statusLabel: 'Healthy', cpu: '8 vCPU', ramGb: 32, diskTotal: 600, diskFree: 410,
    uptimeSec: 86400 * 90, ports: [53, 88, 135, 139, 389, 445, 464, 636, 3389], tags: ['ad', 'identity'], owner: 'تیم هویت',
  },
];

const PORT_SERVICE: Record<number, string> = {
  22: 'ssh', 53: 'dns', 80: 'http', 88: 'kerberos', 135: 'msrpc', 139: 'netbios', 389: 'ldap',
  443: 'https', 445: 'smb', 464: 'kpasswd', 636: 'ldaps', 3389: 'rdp', 8000: 'splunk-web',
  8089: 'splunkd', 8191: 'splunk-kvstore', 8443: 'https-alt', 9997: 'splunk-s2s',
};

export function loadDemoDataset(workspaceId: string, actor: string): number {
  const existing = get<{ n: number }>('SELECT COUNT(*) AS n FROM hosts WHERE workspace_id = ? AND is_demo = 1', workspaceId);
  if (existing && existing.n > 0) return 0;
  const now = new Date().toISOString();
  tx(() => {
    for (const d of DEMO_HOSTS) {
      const hostId = newId('h');
      run(
        `INSERT INTO hosts (id, workspace_id, hostname, ip, os, os_version, arch, cpu, ram_gb, disk_total_gb, disk_free_gb,
          uptime_sec, role, health, status_label, tags, owner, is_demo, first_seen_at, last_seen_at, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'demo')`,
        hostId, workspaceId, d.hostname, d.ip, d.os, d.osVersion, 'x86_64', d.cpu, d.ramGb, d.diskTotal, d.diskFree,
        d.uptimeSec, d.role, d.health, d.statusLabel, JSON.stringify(d.tags), d.owner, now, now
      );
      for (const p of d.ports) {
        run(
          'INSERT INTO host_ports (id, host_id, port, protocol, service, state, observed_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          newId('hp'), hostId, p, 'tcp', PORT_SERVICE[p] ?? 'unknown', 'open', now, 'demo-seed'
        );
      }
      run(
        'INSERT INTO observations (id, host_id, kind, key, value, source, confidence, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        newId('ob'), hostId, 'note', 'origin', 'داده نمایشی DEMO DATA — برای مشاهده UI بدون شبکه واقعی', 'demo-seed', 'observed', now
      );
    }
  });
  audit(actor, 'demo.load', `workspace:${workspaceId}`, 'success', newId('corr'));
  return DEMO_HOSTS.length;
}

export function demoHostCount(workspaceId: string): number {
  return get<{ n: number }>('SELECT COUNT(*) AS n FROM hosts WHERE workspace_id = ? AND is_demo = 1', workspaceId)?.n ?? 0;
}

export function removeDemoDataset(workspaceId: string, actor: string): void {
  const demoHosts = all<{ id: string }>('SELECT id FROM hosts WHERE workspace_id = ? AND is_demo = 1', workspaceId);
  tx(() => {
    for (const h of demoHosts) {
      run('DELETE FROM host_ports WHERE host_id = ?', h.id);
      run('DELETE FROM observations WHERE host_id = ?', h.id);
      run('DELETE FROM hosts WHERE id = ?', h.id);
    }
  });
  audit(actor, 'demo.remove', `workspace:${workspaceId}`, 'success', newId('corr'));
}

export { DEMO_HOSTS };
