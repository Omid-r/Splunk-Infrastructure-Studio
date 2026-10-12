'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Server, Search, ArrowLeft } from 'lucide-react';
import { PageHeader, Card, Badge, Input, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, faNum, timeAgo, uptimeText } from '@/lib/utils';
import type { Host } from '@/lib/types';

const HEALTH_TONE: Record<string, 'green' | 'amber' | 'rose' | 'zinc'> = { healthy: 'green', warning: 'amber', critical: 'rose', unknown: 'zinc' };
const HEALTH_LABELS: Record<string, string> = { healthy: 'سالم', warning: 'هشدار', critical: 'بحرانی', unknown: 'نامشخص' };

export default function HostsPage() {
  const [hosts, setHosts] = useState<Host[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api<{ hosts: Host[] }>('/api/hosts').then((r) => setHosts(r.hosts)).catch(() => {});
  }, []);

  const filtered = (hosts ?? []).filter((h) =>
    h.hostname.includes(query) || h.ip.includes(query) || (h.role ?? '').includes(query)
  );

  return (
    <div>
      <PageHeader
        title="هاست‌های کشف‌شده"
        subtitle="موجودی زیرساخت با شواهد مشاهده — مشخصات بدون credential معتبر «نامشخص» می‌مانند"
        actions={
          <div className="relative">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} className="w-64 pr-9" placeholder="جستجو: hostname، IP، نقش…" />
          </div>
        }
      />

      {!hosts ? (
        <div className="flex h-64 items-center justify-center"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <Card><div className="py-10 text-center text-sm text-ink-400">موردی یافت نشد — ابتدا یک اسکن اجرا کنید.</div></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((h, i) => (
            <motion.div key={h.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link href={`/hosts/${h.id}`}>
                <Card className="card-hover group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-xl bg-ink-900/5 dark:bg-white/6">
                        <Server className={cn('size-5',
                          h.health === 'healthy' ? 'text-emerald-500' :
                          h.health === 'warning' ? 'text-amber-500' :
                          h.health === 'critical' ? 'text-rose-500' : 'text-ink-400')} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold" dir="ltr">{h.hostname}</span>
                          {h.is_demo === 1 && <Badge tone="demo">DEMO</Badge>}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-400" dir="ltr">{h.ip}</div>
                      </div>
                    </div>
                    <ArrowLeft className="size-4 text-ink-300 transition-transform group-hover:-translate-x-1 dark:text-ink-600" />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] text-ink-400">
                    <span>{h.os !== 'Unknown' ? `${h.os} ${h.os_version ?? ''}` : 'OS: نامشخص'}</span>
                    <span>uptime: {uptimeText(h.uptime_sec)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-ink-200/60 pt-3 dark:border-white/6">
                    <div className="flex gap-1.5">
                      {h.role && <Badge tone="zinc">{h.role}</Badge>}
                      {JSON.parse(h.tags || '[]').slice(0, 2).map((t: string) => <Badge key={t} tone="brand">{t}</Badge>)}
                    </div>
                    <Badge tone={HEALTH_TONE[h.health]}>{HEALTH_LABELS[h.health]}</Badge>
                  </div>
                  <div className="mt-2 text-[10px] text-ink-400">آخرین مشاهده: {timeAgo(h.last_seen_at)} — RAM: {h.ram_gb ? faNum(h.ram_gb) + 'GB' : 'نامشخص'}</div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
