'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Activity, Globe2, History, ShieldCheck } from 'lucide-react';
import { PageHeader, Card, Badge, Spinner, Button } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, faDate, timeAgo, uptimeText, bytesToGb } from '@/lib/utils';
import type { Host, HostPort, Observation } from '@/lib/types';

export default function HostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [host, setHost] = useState<(Host & { ports: HostPort[]; observations: Observation[] }) | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ host: Host & { ports: HostPort[]; observations: Observation[] } }>(`/api/hosts/${id}`)
      .then((r) => setHost(r.host))
      .catch((e) => setError((e as Error).message));
  }, [id]);

  if (error) return <Card><div className="py-10 text-center text-sm text-rose-500">{error}</div></Card>;
  if (!host) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;

  return (
    <div>
      <Link href="/hosts" className="mb-4 inline-flex items-center gap-1 text-xs text-ink-400 hover:text-brand-500">
        <ArrowRight className="size-3.5" /> بازگشت به فهرست هاست‌ها
      </Link>
      <PageHeader
        title={<span className="flex items-center gap-3" dir="ltr">{host.hostname} {host.is_demo === 1 && <Badge tone="demo">DEMO DATA</Badge>}</span>}
        subtitle={`${host.ip} — منبع: ${host.source === 'demo' ? 'دیتاست نمایشی' : 'اسکن واقعی'} — آخرین مشاهده ${timeAgo(host.last_seen_at)}`}
        actions={<Badge tone={host.health === 'healthy' ? 'green' : host.health === 'warning' ? 'amber' : host.health === 'critical' ? 'rose' : 'zinc'}>{host.status_label}</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><Activity className="size-4 text-brand-500" /> نمای کلی</h3>
          <div className="space-y-2 text-xs">
            {[
              ['سیستم‌عامل', host.os !== 'Unknown' ? `${host.os} ${host.os_version ?? ''}` : 'نامشخص'],
              ['معماری', host.arch ?? 'نامشخص'],
              ['CPU', host.cpu ?? 'نامشخص'],
              ['RAM', host.ram_gb ? `${host.ram_gb} GB` : 'نامشخص'],
              ['دیسک', host.disk_total_gb ? `${bytesToGb(host.disk_total_gb)} — آزاد ${bytesToGb(host.disk_free_gb)}` : 'نامشخص'],
              ['Uptime', uptimeText(host.uptime_sec)],
              ['نقش', host.role ?? '—'],
              ['مالک', host.owner ?? '—'],
              ['اولین مشاهده', faDate(host.first_seen_at)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 rounded-lg bg-ink-900/4 px-3 py-2 dark:bg-white/4">
                <span className="text-ink-400">{k}</span>
                <span className="text-left font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><Globe2 className="size-4 text-cyan-500" /> شبکه و پورت‌ها</h3>
          <div className="space-y-2">
            {host.ports.length === 0 && <div className="rounded-lg bg-ink-900/4 p-4 text-center text-xs text-ink-400 dark:bg-white/4">پورتی ثبت نشده</div>}
            {host.ports.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink-200/70 px-3 py-2 text-xs dark:border-white/8">
                <div className="flex items-center gap-2">
                  <Badge tone="brand" className="dir-ltr">:{p.port}</Badge>
                  <span className="font-bold" dir="ltr">{p.service}</span>
                  <span className="text-[10px] text-ink-400">({p.protocol})</span>
                </div>
                <span className="text-[10px] text-ink-400">{timeAgo(p.observed_at)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-5 text-ink-400">
            وجود پورت باز به‌تنهایی اثبات نوع دقیق سرویس یا firewall خاص نیست؛ نام سرویس از نگاشت پورت استنباط شده است.
          </p>
        </Card>

        <Card>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><History className="size-4 text-amber-500" /> شواهد و تاریخچه مشاهده</h3>
          <div className="max-h-80 space-y-2 overflow-y-auto pl-1">
            {host.observations.map((o) => (
              <div key={o.id} className="rounded-lg bg-ink-900/4 px-3 py-2 text-[11px] dark:bg-white/4">
                <div className="flex items-center justify-between">
                  <span className="font-bold" dir="ltr">{o.kind}:{o.key}</span>
                  <Badge tone={o.confidence === 'observed' ? 'green' : o.confidence === 'inferred' ? 'amber' : 'zinc'}>
                    {o.confidence === 'observed' ? 'مشاهده‌شده' : o.confidence === 'inferred' ? 'استنباط' : 'نامشخص'}
                  </Badge>
                </div>
                <div className="mt-1">{o.value}</div>
                <div className="mt-1 text-[10px] text-ink-400">{o.source} — {faDate(o.observed_at)}</div>
              </div>
            ))}
            {host.observations.length === 0 && <div className="py-6 text-center text-xs text-ink-400">شواهدی ثبت نشده</div>}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><ShieldCheck className="size-4 text-violet-500" /> اقدامات</h3>
        <div className="flex flex-wrap gap-2">
          <Link href="/topology"><Button variant="outline" size="sm">مشاهده در نقشه شبکه</Button></Link>
          <Link href="/discovery"><Button variant="outline" size="sm">Refresh Inventory (اسکن مجدد)</Button></Link>
          <span className={cn('inline-flex items-center rounded-lg bg-ink-900/5 px-3 py-1.5 text-xs text-ink-400 dark:bg-white/6')}>
            Validate Access / Deploy Splunk — نیازمند credential و adapter SSH/WinRM (Coming later)
          </span>
        </div>
      </Card>
    </div>
  );
}
