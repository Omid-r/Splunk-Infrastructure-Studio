import { all, get } from '@/server/db';
import type { DashboardStats, Host, HostPort, Observation, TopologySnapshot } from '@/lib/types';

export function listHosts(workspaceId: string): Host[] {
  return all<Host>(
    `SELECT id, workspace_id, hostname, ip, os, os_version, arch, cpu, ram_gb, disk_total_gb, disk_free_gb,
            uptime_sec, role, health, status_label, tags, owner, is_demo, first_seen_at, last_seen_at, source
     FROM hosts WHERE workspace_id = ? ORDER BY ip`, workspaceId
  );
}

export function getHost(hostId: string): (Host & { ports: HostPort[]; observations: Observation[] }) | null {
  const host = get<Host>(
    `SELECT id, workspace_id, hostname, ip, os, os_version, arch, cpu, ram_gb, disk_total_gb, disk_free_gb,
            uptime_sec, role, health, status_label, tags, owner, is_demo, first_seen_at, last_seen_at, source
     FROM hosts WHERE id = ?`, hostId
  );
  if (!host) return null;
  const ports = all<HostPort>('SELECT * FROM host_ports WHERE host_id = ? ORDER BY port', hostId);
  const observations = all<Observation>('SELECT * FROM observations WHERE host_id = ? ORDER BY observed_at DESC LIMIT 100', hostId);
  return { ...host, ports, observations };
}

export function dashboardStats(workspaceId: string): DashboardStats {
  const hosts = get<{ n: number; demo: number }>('SELECT COUNT(*) AS n, COALESCE(SUM(is_demo),0) AS demo FROM hosts WHERE workspace_id = ?', workspaceId);
  const openPorts = get<{ n: number }>('SELECT COUNT(*) AS n FROM host_ports p JOIN hosts h ON h.id = p.host_id WHERE h.workspace_id = ?', workspaceId);
  const lastScan = get<{ created_at: string }>("SELECT created_at FROM scan_jobs WHERE workspace_id = ? AND demo = 0 ORDER BY created_at DESC LIMIT 1", workspaceId);
  const stale = get<{ n: number }>("SELECT COUNT(*) AS n FROM hosts WHERE workspace_id = ? AND last_seen_at < datetime('now', '-1 day')", workspaceId);
  const networks = get<{ n: number }>("SELECT COUNT(DISTINCT rtrim(ip, '0123456789')) AS n FROM hosts WHERE workspace_id = ?", workspaceId);
  const deployments = get<{ total: number; failed: number }>("SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END),0) AS failed FROM deployment_jobs WHERE workspace_id = ?", workspaceId);
  const scans = get<{ n: number }>('SELECT COUNT(*) AS n FROM scan_jobs WHERE workspace_id = ?', workspaceId);
  const hostsUp = get<{ n: number }>("SELECT COUNT(*) AS n FROM hosts WHERE workspace_id = ? AND health IN ('healthy','warning','critical')", workspaceId);
  const recentChanges = get<{ n: number }>("SELECT COUNT(*) AS n FROM hosts WHERE workspace_id = ? AND first_seen_at > datetime('now', '-7 day')", workspaceId);
  return {
    hosts: hosts?.n ?? 0,
    hosts_up: hostsUp?.n ?? 0,
    networks: networks?.n ?? 0,
    open_ports: openPorts?.n ?? 0,
    last_scan_at: lastScan?.created_at ?? null,
    stale_hosts: stale?.n ?? 0,
    recent_changes: recentChanges?.n ?? 0,
    demo_hosts: hosts?.demo ?? 0,
    deployments_total: deployments?.total ?? 0,
    deployments_failed: deployments?.failed ?? 0,
    scans_total: scans?.n ?? 0,
  };
}

export function latestTopology(workspaceId: string): TopologySnapshot | null {
  const snap = get<{ nodes: string; edges: string; generated_at: string }>(
    'SELECT nodes, edges, generated_at FROM topology_snapshots WHERE workspace_id = ? ORDER BY generated_at DESC LIMIT 1', workspaceId
  );
  if (!snap) return null;
  return { nodes: JSON.parse(snap.nodes), edges: JSON.parse(snap.edges), generated_at: snap.generated_at };
}
