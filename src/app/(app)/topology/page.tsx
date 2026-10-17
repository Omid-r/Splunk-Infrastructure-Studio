'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader, Spinner, EmptyState, Badge, Card } from '@/components/ui';
import { TopologyGraph, HostSidePanel } from '@/components/topology';
import { api } from '@/lib/api';
import { faDate } from '@/lib/utils';
import type { TopologySnapshot } from '@/lib/types';

export default function TopologyPage() {
  const [topology, setTopology] = useState<TopologySnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'demo' | 'real'>('all');

  const load = useCallback(() => {
    api<{ topology: TopologySnapshot | null }>('/api/topology')
      .then((r) => setTopology(r.topology))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const filtered: TopologySnapshot | null = topology
    ? filter === 'all'
      ? topology
      : {
          ...topology,
          nodes: topology.nodes.filter((n) => (filter === 'demo' ? n.demo === true : n.kind === 'subnet' || !n.demo)),
          edges: topology.edges.filter((e) => {
            if (filter === 'demo') return topology.nodes.find((n) => n.id === e.source)?.demo || topology.nodes.find((n) => n.id === e.target)?.demo;
            return true;
          }),
        }
    : null;

  return (
    <div>
      <PageHeader
        title="نقشه زنده شبکه"
        subtitle={topology ? `آخرین snapshot: ${faDate(topology.generated_at)} — روی نود کلیک کنید تا پنل جزئیات باز شود` : 'در حال بارگذاری'}
        actions={
          <div className="flex items-center gap-1.5">
            {(['all', 'real', 'demo'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`focus-ring rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  filter === f ? 'bg-brand-500/15 text-brand-700 ring-1 ring-brand-500/40 dark:text-brand-300' : 'text-ink-400 hover:bg-ink-900/5 dark:hover:bg-white/8'
                }`}
              >
                {f === 'all' ? 'همه' : f === 'real' ? 'واقعی' : 'دمو'}
              </button>
            ))}
          </div>
        }
      />

      {!loaded ? (
        <div className="flex h-96 items-center justify-center"><Spinner /></div>
      ) : !filtered || filtered.nodes.length === 0 ? (
        <Card>
          <EmptyState
            title="هنوز توپولوژی‌ای ساخته نشده"
            hint="اولین اسکن را از صفحه کشف اجرا کنید یا دیتاست دمو را بارگذاری کنید تا گراف زنده ساخته شود."
            action={<a href="/discovery" className="text-xs font-bold text-brand-600 hover:underline dark:text-brand-300">رفتن به صفحه کشف</a>}
          />
        </Card>
      ) : (
        <TopologyGraph snapshot={filtered} onSelect={setSelected} />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-ink-400">
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-6 bg-cyan-500" /> عضویت در زیرشبکه (observed)</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-6 bg-emerald-500" /> جریان داده Splunk</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-6 bg-violet-500" /> مدیریتی</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-6 border-t-2 border-dashed border-ink-400" /> استنباط‌شده (قابل خاموش‌کردن)</span>
        <Badge tone="demo">DEMO DATA</Badge>
      </div>

      <HostSidePanel hostId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
