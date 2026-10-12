'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, MarkerType, type Node, type Edge, type NodeProps, Handle, Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, Network, Shield, X, Activity, Globe2, Lock, Package, GitBranch, History } from 'lucide-react';
import { Badge, Button, Card, ProgressBar } from '@/components/ui';
import { cn, faDate, timeAgo, uptimeText, bytesToGb } from '@/lib/utils';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import type { Host, TopologyEdge, TopologyNode } from '@/lib/types';

type FlowNode = Node<{ label: string; sub?: string; kind: string; health?: string; demo?: boolean; hostId?: string }, string>;

function HostNode({ data }: NodeProps<FlowNode>) {
  const health = data.health ?? 'unknown';
  const border =
    health === 'healthy' ? 'border-emerald-500/50' :
    health === 'warning' ? 'border-amber-500/50' :
    health === 'critical' ? 'border-rose-500/50' : 'border-ink-400/40';
  return (
    <div className={`relative min-w-[150px] rounded-xl border ${border} bg-white/90 px-3 py-2 shadow-lg backdrop-blur dark:bg-ink-850/95`}>
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-ink-400" />
      <div className="flex items-center gap-2">
        {data.kind === 'subnet' ? <Network className="size-4 text-cyan-500" /> :
         data.kind === 'firewall' ? <Shield className="size-4 text-amber-500" /> :
         <Server className={cn('size-4', health === 'healthy' ? 'text-emerald-500' : health === 'warning' ? 'text-amber-500' : health === 'critical' ? 'text-rose-500' : 'text-ink-400')} />}
        <div className="min-w-0">
          <div className="truncate text-[11px] font-bold" dir="ltr">{data.label}</div>
          {data.sub && <div className="truncate text-[9px] text-ink-400" dir="ltr">{data.sub}</div>}
        </div>
      </div>
      {data.demo && (
        <div className="absolute -top-2 left-2 rounded-full bg-fuchsia-500 px-1.5 text-[8px] font-bold text-white">DEMO</div>
      )}
      {data.kind === 'host' && (
        <div className="absolute -bottom-1 right-2">
          <span className={cn('block size-2 rounded-full ring-2 ring-white dark:ring-ink-850',
            health === 'healthy' ? 'animate-pulse-soft bg-emerald-500' : health === 'warning' ? 'bg-amber-500' : health === 'critical' ? 'bg-rose-500' : 'bg-ink-400')} />
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-ink-400" />
    </div>
  );
}

const nodeTypes = { infra: HostNode };

function layout(nodes: TopologyNode[]): FlowNode[] {
  const subnets = nodes.filter((n) => n.kind === 'subnet');
  const hosts = nodes.filter((n) => n.kind === 'host');
  return nodes.map((n) => {
    if (n.kind === 'subnet') {
      const idx = subnets.findIndex((s) => s.id === n.id);
      return {
        id: n.id, type: 'infra', position: { x: 140 + idx * 300, y: 60 },
        data: { label: n.label, sub: n.sub, kind: 'subnet' },
        className: 'subnet-node', draggable: true,
      };
    }
    const subnetIdx = Math.floor(hosts.findIndex((h) => h.id === n.id) / 3);
    const inGroup = hosts.filter((h) => Math.floor(hosts.findIndex((x) => x.id === h.id) / 3) === subnetIdx);
    const pos = inGroup.findIndex((h) => h.id === n.id);
    return {
      id: n.id, type: 'infra',
      position: { x: 60 + subnetIdx * 300 + pos * 190, y: 220 + (pos % 2) * 110 },
      data: { label: n.label, sub: n.sub, kind: 'host', demo: n.demo, hostId: n.hostId },
      draggable: true,
    };
  });
}

function edgeStyle(kind: string): { stroke: string; dash?: string; animated?: boolean } {
  switch (kind) {
    case 'membership': return { stroke: '#0ea5e9' };
    case 'dataflow': return { stroke: '#10b981', animated: true };
    case 'management': return { stroke: '#8b5cf6' };
    case 'inferred': return { stroke: '#9ca3af', dash: '6 4' };
    default: return { stroke: '#64748b' };
  }
}

export function TopologyGraph({ snapshot, onSelect }: {
  snapshot: { nodes: TopologyNode[]; edges: TopologyEdge[]; generated_at: string };
  onSelect: (hostId: string) => void;
}) {
  const nodes = useMemo(() => layout(snapshot.nodes), [snapshot.nodes]);
  const edges = useMemo<Edge[]>(() => snapshot.edges.map((e) => {
    const st = edgeStyle(e.kind);
    return {
      id: e.id, source: e.source, target: e.target,
      animated: st.animated,
      style: { stroke: st.stroke, strokeDasharray: st.dash, strokeWidth: 1.6 },
      markerEnd: { type: MarkerType.ArrowClosed, color: st.stroke },
      label: e.label,
      labelStyle: { fontSize: 9, fill: '#94a3b8' },
    };
  }), [snapshot.edges]);

  return (
    <div dir="ltr" className="h-[560px] w-full overflow-hidden rounded-2xl border border-ink-200/80 bg-ink-50/60 dark:border-white/8 dark:bg-ink-900/40">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => {
          const d = node.data as { kind: string; hostId?: string };
          if (d.kind === 'host' && d.hostId) onSelect(d.hostId);
        }}
        fitView
        minZoom={0.35}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
      >
        <Background gap={26} size={1.2} />
        <Controls position="bottom-left" />
        <MiniMap pannable zoomable position="bottom-right" className="!h-28 !w-40" />
      </ReactFlow>
    </div>
  );
}

export function HostSidePanel({ hostId, onClose }: { hostId: string | null; onClose: () => void }) {
  const [host, setHost] = useState<Host & { ports: { id: string; port: number; service: string; observed_at: string; source: string }[]; observations: { id: string; kind: string; key: string; value: string; source: string; confidence: string; observed_at: string }[] } | null>(null);
  const [tab, setTab] = useState<'overview' | 'network' | 'audit'>('overview');
  const toast = useToast();

  const load = useCallback(() => {
    if (!hostId) return;
    api<{ host: NonNullable<typeof host> }>(`/api/hosts/${hostId}`).then((r) => setHost(r.host)).catch((e) => toast('error', (e as Error).message));
  }, [hostId, toast]);

  useEffect(() => {
    setHost(null);
    setTab('overview');
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const TABS = [
    { id: 'overview' as const, label: 'نمای کلی', icon: Activity },
    { id: 'network' as const, label: 'شبکه', icon: Globe2 },
    { id: 'audit' as const, label: 'شواهد', icon: History },
  ];

  return (
    <AnimatePresence>
      {hostId && (
        <motion.aside
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 top-16 z-30 w-full max-w-md overflow-y-auto border-r border-ink-200/80 bg-white/95 p-5 backdrop-blur-xl dark:border-white/8 dark:bg-ink-950/92"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-extrabold">جزئیات هاست</h3>
            <button onClick={onClose} className="focus-ring rounded-lg p-1.5 text-ink-400 hover:bg-ink-900/5 dark:hover:bg-white/10">
              <X className="size-4" />
            </button>
          </div>

          {!host ? (
            <div className="flex justify-center py-10"><div className="size-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-ink-900/5 dark:bg-white/6">
                  <Server className="size-6 text-brand-500" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-extrabold" dir="ltr">{host.hostname}</span>
                    {host.is_demo === 1 && <Badge tone="demo">DEMO DATA</Badge>}
                  </div>
                  <div className="text-xs text-ink-400" dir="ltr">{host.ip}</div>
                </div>
              </div>

              <div className="mb-4 flex rounded-xl bg-ink-900/5 p-1 dark:bg-white/5">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      'focus-ring flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-bold transition-colors',
                      tab === t.id ? 'bg-white shadow dark:bg-ink-800' : 'text-ink-400 hover:text-ink-600'
                    )}
                  >
                    <t.icon className="size-3.5" /> {t.label}
                  </button>
                ))}
              </div>

              {tab === 'overview' && (
                <div className="space-y-2 text-xs">
                  {[
                    ['سیستم‌عامل', host.os !== 'Unknown' ? `${host.os} ${host.os_version ?? ''}` : 'نامشخص (بدون شواهد کافی)'],
                    ['نقش', host.role ?? '—'],
                    ['CPU', host.cpu ?? 'نامشخص'],
                    ['RAM', host.ram_gb ? `${host.ram_gb} GB` : 'نامشخص'],
                    ['دیسک', host.disk_total_gb ? `${bytesToGb(host.disk_total_gb)} (آزاد: ${bytesToGb(host.disk_free_gb)})` : 'نامشخص'],
                    ['Uptime', uptimeText(host.uptime_sec)],
                    ['مالک', host.owner ?? '—'],
                    ['اولین مشاهده', faDate(host.first_seen_at)],
                    ['آخرین مشاهده', `${faDate(host.last_seen_at)} (${timeAgo(host.last_seen_at)})`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 rounded-lg bg-ink-900/4 px-3 py-2 dark:bg-white/4">
                      <span className="text-ink-400">{k}</span>
                      <span className="text-left font-semibold">{v}</span>
                    </div>
                  ))}
                  <div className="rounded-lg bg-amber-500/8 p-2.5 text-[11px] leading-5 text-amber-700 dark:text-amber-300">
                    مشخصات سخت‌افزاری/سیستم‌عاملی که با شواهد credentialed اثبات نشده‌اند «نامشخص» نمایش داده می‌شوند — حدس قطعی ثبت نمی‌شود.
                  </div>
                </div>
              )}

              {tab === 'network' && (
                <div className="space-y-2">
                  {host.ports.length === 0 && <div className="rounded-lg bg-ink-900/4 p-3 text-center text-xs text-ink-400 dark:bg-white/4">پورت بازی ثبت نشده</div>}
                  {host.ports.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink-200/70 px-3 py-2 text-xs dark:border-white/8">
                      <div className="flex items-center gap-2">
                        <Badge tone="brand" className="dir-ltr">:{p.port}</Badge>
                        <span className="font-semibold" dir="ltr">{p.service}</span>
                      </div>
                      <span className="text-[10px] text-ink-400">{timeAgo(p.observed_at)}</span>
                    </div>
                  ))}
                  <p className="flex items-center gap-1.5 text-[10px] text-ink-400">
                    <Lock className="size-3" /> نام سرویس از نگاشت پورت‌های شناخته‌شده استنباط شده و قطعی نیست.
                  </p>
                </div>
              )}

              {tab === 'audit' && (
                <div className="space-y-2">
                  {host.observations.map((o) => (
                    <div key={o.id} className="rounded-lg bg-ink-900/4 px-3 py-2 text-[11px] dark:bg-white/4">
                      <div className="flex items-center justify-between">
                        <span className="font-bold" dir="ltr">{o.kind}:{o.key}</span>
                        <Badge tone={o.confidence === 'observed' ? 'green' : o.confidence === 'inferred' ? 'amber' : 'zinc'}>
                          {o.confidence === 'observed' ? 'مشاهده‌شده' : o.confidence === 'inferred' ? 'استنباط‌شده' : 'نامشخص'}
                        </Badge>
                      </div>
                      <div className="mt-1 text-ink-500 dark:text-ink-300">{o.value}</div>
                      <div className="mt-1 text-[10px] text-ink-400">منبع: {o.source} — {faDate(o.observed_at)}</div>
                    </div>
                  ))}
                  {host.observations.length === 0 && <div className="text-center text-xs text-ink-400">شواهدی ثبت نشده</div>}
                </div>
              )}
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
