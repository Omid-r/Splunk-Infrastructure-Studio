'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PageHeader, Spinner, EmptyState } from '@/components/ui';
import { NewScanForm, ScanMonitor } from '@/components/scans';
import { SnapshotCompare } from '@/components/snapshot-compare';
import { api } from '@/lib/api';
import type { ScanJob } from '@/lib/types';

interface Scopes {
  ranges: string[];
  exclusions: string[];
}

export default function DiscoveryPage() {
  const [scopes, setScopes] = useState<Scopes>({ ranges: [], exclusions: [] });
  const [jobs, setJobs] = useState<ScanJob[] | null>(null);
  const [active, setActive] = useState<ScanJob | null>(null);

  const load = useCallback(() => {
    api<{ scans: ScanJob[] }>('/api/scans').then((r) => {
      setJobs(r.scans);
      setActive((cur) => {
        if (!cur) return r.scans[0] ?? null;
        return r.scans.find((j) => j.id === cur.id) ?? cur;
      });
    }).catch(() => {});
    api<{ scopes: Scopes }>('/api/settings').then((r) => setScopes(r.scopes)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  const onCreated = (job: ScanJob) => {
    setActive(job);
    load();
  };

  if (!jobs) {
    return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="کشف کنترل‌شده"
        subtitle="اسکن فقط روی scope مجاز Workspace — همه رویدادها ثبت و قابل حسابرسی است"
      />

      <NewScanForm scopes={scopes.ranges} onCreated={onCreated} />

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-bold text-ink-500 dark:text-ink-400">مانیتور زنده jobها</h2>
        {jobs.length === 0 && (
          <EmptyState
            title="هنوز jobی اجرا نشده"
            hint="اولین اسکن را بالا تعریف کنید — یا برای مشاهده UI بدون شبکه، دیتاست دمو را بارگذاری کنید."
          />
        )}
        <div className="space-y-3">
          <AnimatePresence>
            {active && (
              <motion.div key={active.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <ScanMonitor job={active} onChange={(j) => setActive(j)} />
              </motion.div>
            )}
          </AnimatePresence>

          {jobs.filter((j) => !active || j.id !== active.id).slice(0, 5).map((j) => (
            <button
              key={j.id}
              onClick={() => setActive(j)}
              className="focus-ring flex w-full items-center justify-between rounded-xl border border-ink-200 px-4 py-3 text-right text-xs transition-colors hover:border-brand-500/40 dark:border-white/8"
            >
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${j.status === 'success' ? 'bg-emerald-500' : j.status === 'failed' ? 'bg-rose-500' : j.status === 'cancelled' ? 'bg-ink-400' : 'bg-cyan-400 animate-pulse-soft'}`} />
                <span className="font-bold">{j.profile === 'quick' ? 'کشف سریع' : j.profile === 'standard' ? 'موجودی استاندارد' : 'با اعتبارنامه'}</span>
                {j.demo === 1 && <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-300">DEMO</span>}
              </div>
              <span className="text-ink-400">
                {new Date(j.created_at).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </button>
          ))}
        </div>
      </div>

      <SnapshotCompare />
    </div>
  );
}
