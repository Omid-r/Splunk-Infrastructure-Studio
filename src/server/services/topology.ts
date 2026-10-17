import { all, run } from '@/server/db';
import { newId } from '@/server/core/crypto';
import type { TopologyEdge, TopologyNode } from '@/lib/types';

export function buildTopologySnapshot(workspaceId: string): void {
  const hosts = all<{ id: string; ip: string; hostname: string; role: string | null; health: string; is_demo: number; last_seen_at: string }>(
    'SELECT id, ip, hostname, role, health, is_demo, last_seen_at FROM hosts WHERE workspace_id = ?', workspaceId
  );
  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];
  const subnets = new Map<string, string>();
  hosts.forEach((h) => {
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
  });
  run('INSERT INTO topology_snapshots (id, workspace_id, nodes, edges, generated_at) VALUES (?, ?, ?, ?, ?)',
    newId('snap'), workspaceId, JSON.stringify(nodes), JSON.stringify(edges), new Date().toISOString());
}
