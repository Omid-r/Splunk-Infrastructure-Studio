'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Server, Network, Radar, Globe2, Clock, PlusCircle, ChevronLeft, Activity, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, PageHeader, Badge, Button, Spinner, EmptyState } from '@/components/ui';
import { CountUp, Donut, Spark } from '@/components/charts';
import { api } from '@/lib/api';
import { cn, faDate, faNum, timeAgo } from '@/lib/utils';
import type { DashboardStats } from '@/lib/types';

interface Overview {
  stats: DashboardStats;
  recentScans: { id: string; profile: string; status: string; progress: number; created_at: string; demo: number }[];
  recentDeployments: { id: string; status: string; plan_summary: string; created_at: string }[];
  recentRuns: { id: string; rule_id: string; state: string; created_at: string }[];
  recentHosts: { id: string; hostname: string; ip: string; health: string; is_demo: number; last_seen_at: string }[];
}

const PROFILE_LABELS: Record<string, string> = { quick: 'کشف سریع', standard: 'موجودی استاندارد', credentialed: 'با اعتبارنامه' };
const STATUS_TONE: Record<string, 'green' | 'amber' | 'rose' | 'zinc' | 'cyan'> = {
  success: 'green', warning: 'amber', failed: 'rose', running: 'cyan', queued: 'zinc', cancelled: 'zinc',
};
const STATUS_LABELS: Record<string, string> = {
  success: 'موفق', warning: 'با هشدار', failed: 'ناموفق', running: 'در حال اجرا', queued: 'در صف', cancelled: 'لغو شده',
};
const HEALTH_TONE: Record<string, 'green' | 'amber' | 'rose' | 'zinc'> = { healthy: 'green', warning: 'amber', critical: 'rose', unknown: 'zinc' };
const HEALTH_LABELS: Record<string, string> = { healthy: 'سالم', warning: 'هشدار', critical: 'بحرانی', unknown: 'نامشخص' };

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    api<Overview>('/api/overview').then(setData).catch(() => {});
    const t = setInterval(() => api<Overview>('/api/overview').then(setData).catch(() => {}), 8000);
    return () => clearInterval(t);
  }, []);

  if (!data) {
    return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  }

  const { stats } = data;
  const spark = [12, 19, 14, 22, 18, 30, 26, 34, 29, 38, 41, 36];

  return (
    <div>
      <PageHeader
        title="داشبورد عملیاتی"
        subtitle={`آخرین کشف: ${timeAgo(stats.last_scan_at)} — وضعیت زیرساخت در یک نگاه`}
        actions={
          <Link href="/discovery">
            <Button icon={<PlusCircle className="size-4" />}>شروع کشف جدید</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'هاست‌های شناخته‌شده', value: stats.hosts, icon: Server, hint: `${faNum(stats.demo_hosts)} دمویی`, tone: 'text-brand-500' },
          { label: 'هاست‌های فعال', value: stats.hosts_up, icon: Activity, hint: `${faNum(stats.stale_hosts)} stale`, tone: 'text-emerald-500' },
          { label: 'پورت/سرویس باز', value: stats.open_ports, icon: Globe2, hint: `${faNum(stats.networks)} شبکه`, tone: 'text-cyan-500' },
          { label: 'تغییرات ۷ روز اخیر', value: stats.recent_changes, icon: Clock, hint: `${faNum(stats.scans_total)} اسکن کل`, tone: 'text-amber-500' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Card className="card-hover relative overflow-hidden">
              <div className="absolute -left-6 -top-6 size-24 rounded-full bg-gradient-to-br from-brand-500/10 to-cyan-500/10 blur-xl" />
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-bold text-ink-400">{s.label}</div>
                  <div className="mt-2 text-3xl font-extrabold">
                    <CountUp value={s.value} />
                  </div>
                  <div className="mt-1 text-[11px] text-ink-400">{s.hint}</div>
                </div>
                <div className={cn('flex size-11 items-center justify-center rounded-xl bg-ink-900/5 dark:bg-white/6', s.tone)}>
                  <s.icon className="size-5" />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold">سلامت کلی هاست‌ها</h3>
            <Badge tone="brand">زنده</Badge>
          </div>
          <div className="flex items-center justify-center">
            <Donut
              size={170}
              parts={[
                { value: Math.max(0, stats.hosts_up - stats.stale_hosts), color: 'var(--color-brand-500)', label: 'سالم' },
                { value: stats.stale_hosts, color: '#f59e0b', label: 'stale' },
                { value: Math.max(0, stats.hosts - stats.hosts_up), color: 'var(--color-ink-400)', label: 'نامشخص' },
              ]}
              centerLabel={faNum(stats.hosts)}
              centerSub="هاست"
            />
          </div>
          <div className="mt-4 flex justify-center gap-4 text-[11px] text-ink-400">
            <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-brand-500" /> فعال</span>
            <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-amber-500" /> stale</span>
            <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-ink-400" /> سایر</span>
          </div>
        </Card>

        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold">روند فعالیت کشف</h3>
            <Badge tone="cyan">SSE زنده</Badge>
          </div>
          <Spark data={spark} width={300} height={90} />
          <div className="mt-4 space-y-2.5">
            {data.recentScans.length === 0 && <EmptyState title="هنوز اسکنی اجرا نشده" hint="از صفحه کشف، یک اسکن محدود و مجاز اجرا کنید یا دیتاست دمو را بارگذاری کنید." />}
            {data.recentScans.map((s) => (
              <Link key={s.id} href="/discovery" className="flex items-center justify-between rounded-xl border border-ink-200/70 px-3 py-2 text-xs transition-colors hover:border-brand-500/40 dark:border-white/8">
                <div className="flex items-center gap-2">
                  {s.status === 'running' ? <Loader2 className="size-3.5 animate-spin text-cyan-500" /> : s.status === 'success' ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : s.status === 'failed' ? <XCircle className="size-3.5 text-rose-500" /> : s.status === 'warning' ? <AlertTriangle className="size-3.5 text-amber-500" /> : <Clock className="size-3.5 text-ink-400" />}
                  <span className="font-semibold">{PROFILE_LABELS[s.profile] ?? s.profile}</span>
                  {s.demo === 1 && <Badge tone="demo">DEMO</Badge>}
                </div>
                <div className="flex items-center gap-2 text-ink-400">
                  <span>{STATUS_LABELS[s.status] ?? s.status}</span>
                  <span>{timeAgo(s.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold">هاست‌های اخیراً مشاهده‌شده</h3>
            <Link href="/topology" className="flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-300">
              نقشه شبکه <ChevronLeft className="size-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {data.recentHosts.length === 0 && <EmptyState title="موردی نیست" hint="پس از اولین اسکن، هاست‌ها اینجا نمایش داده می‌شوند." />}
            {data.recentHosts.map((h) => (
              <Link key={h.id} href={`/hosts/${h.id}`} className="flex items-center justify-between rounded-xl px-3 py-2 transition-colors hover:bg-ink-900/4 dark:hover:bg-white/5">
                <div className="flex items-center gap-2.5">
                  <span className={cn('size-2 rounded-full', h.health === 'healthy' ? 'bg-emerald-500 animate-pulse-soft' : h.health === 'warning' ? 'bg-amber-500' : h.health === 'critical' ? 'bg-rose-500' : 'bg-ink-400')} />
                  <div>
                    <div className="text-xs font-bold">{h.hostname}</div>
                    <div className="text-[10px] text-ink-400" dir="ltr">{h.ip}</div>
                  </div>
                  {h.is_demo === 1 && <Badge tone="demo">DEMO</Badge>}
                </div>
                <Badge tone={HEALTH_TONE[h.health] ?? 'zinc'}>{HEALTH_LABELS[h.health] ?? h.health}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold">آخرین استقرارها</h3>
            <Link href="/deployment" className="flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-300">صف استقرار <ChevronLeft className="size-3.5" /></Link>
          </div>
          {data.recentDeployments.length === 0 && <EmptyState title="استقراری ثبت نشده" hint="از استودیو معماری یک طراحی بسازید و آن را در Local Lab استقرار دهید." />}
          <div className="space-y-2">
            {data.recentDeployments.map((d) => (
              <div key={d.id} className="rounded-xl border border-ink-200/70 px-3 py-2.5 text-xs dark:border-white/8">
                <div className="flex items-center justify-between">
                  <Badge tone={STATUS_TONE[d.status] ?? 'zinc'}>{STATUS_LABELS[d.status] ?? d.status}</Badge>
                  <span className="text-ink-400">{faDate(d.created_at)}</span>
                </div>
                <p className="mt-1.5 leading-5 text-ink-600 dark:text-ink-300">{d.plan_summary}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold">آخرین اقدامات Best Practice</h3>
            <Link href="/best-practices" className="flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-300">کاتالوگ قوانین <ChevronLeft className="size-3.5" /></Link>
          </div>
          {data.recentRuns.length === 0 && <EmptyState title="اقدامی ثبت نشده" hint="پس از ساخت Local Lab، قوانین را Plan و Apply کنید." />}
          <div className="space-y-2">
            {data.recentRuns.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs hover:bg-ink-900/4 dark:hover:bg-white/5">
                <span className="font-semibold" dir="ltr">{r.rule_id}</span>
                <div className="flex items-center gap-2">
                  <Badge tone={r.state === 'applied' ? 'green' : r.state === 'failed' ? 'rose' : r.state === 'skipped' ? 'amber' : 'zinc'}>
                    {r.state === 'applied' ? 'اعمال شد' : r.state === 'failed' ? 'ناموفق' : r.state === 'skipped' ? 'رد شده' : 'در انتظار'}
                  </Badge>
                  <span className="text-ink-400">{timeAgo(r.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
