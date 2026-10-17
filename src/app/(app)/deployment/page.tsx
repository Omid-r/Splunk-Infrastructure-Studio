'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, CheckCircle2, XCircle, AlertTriangle, Info, FlaskConical } from 'lucide-react';
import { PageHeader, Card, Button, Badge, ProgressBar, Spinner, EmptyState } from '@/components/ui';
import { api, subscribeEvents } from '@/lib/api';
import { cn, faDate, faNum, timeAgo } from '@/lib/utils';
import { useToast } from '@/components/toast';
import type { ArchitectureDesign, DeploymentJob, PreflightItem } from '@/lib/types';

const SEV = {
  critical: { icon: XCircle, tone: 'rose' as const, label: 'بحرانی' },
  warning: { icon: AlertTriangle, tone: 'amber' as const, label: 'هشدار' },
  info: { icon: Info, tone: 'zinc' as const, label: 'اطلاعات' },
};

export default function DeploymentPage() {
  const toast = useToast();
  const [architectures, setArchitectures] = useState<ArchitectureDesign[] | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [deployments, setDeployments] = useState<DeploymentJob[] | null>(null);
  const [active, setActive] = useState<DeploymentJob | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(() => {
    api<{ architectures: ArchitectureDesign[] }>('/api/architectures').then((r) => setArchitectures(r.architectures)).catch(() => {});
    api<{ deployments: DeploymentJob[] }>('/api/deployments').then((r) => {
      setDeployments(r.deployments);
      setActive((cur) => (cur ? r.deployments.find((d) => d.id === cur.id) ?? cur : r.deployments[0] ?? null));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  const start = async () => {
    setStarting(true);
    try {
      const r = await api<{ deployment: DeploymentJob }>('/api/deployments', {
        method: 'POST',
        body: JSON.stringify({ architectureId: selected || null }),
      });
      setActive(r.deployment);
      toast('success', 'استقرار Local Lab در صف قرار گرفت');
      load();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="استقرار و اعتبارسنجی"
        subtitle="Local Lab یک sandbox واقعی روی همین ماشین است — همه بررسی‌ها و نتایج، واقعی‌اند و ادعای نصب Splunk Enterprise ندارند"
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold"><FlaskConical className="size-4 text-brand-500" /> هدف استقرار</h3>
          <p className="mb-4 text-[11px] leading-5 text-ink-400">
            مسیرهای Bare Metal / VM / Docker / Kubernetes / Remote-OS در این نسخه Coming later هستند و دکمه نمایشی ندارند.
            تنها مسیر فعال: Local Lab — ساخت مصنوعات واقعی (پیکربندی، مانیفست، گیرنده رویداد) و اعتبارسنجی آن‌ها.
          </p>

          <label className="mb-1.5 block text-xs font-bold text-ink-500">طراحی معماری</label>
          {!architectures ? <Spinner /> : (
            <div className="space-y-2">
              <button
                onClick={() => setSelected('')}
                className={cn('focus-ring flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-right text-xs transition-colors',
                  selected === '' ? 'border-brand-500/60 bg-brand-500/8' : 'border-ink-200 hover:border-brand-500/30 dark:border-white/10')}
              >
                <span className="font-bold">بدون طراحی — ۱ نود Standalone پیش‌فرض</span>
              </button>
              {architectures.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelected(a.id)}
                  className={cn('focus-ring flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-right text-xs transition-colors',
                    selected === a.id ? 'border-brand-500/60 bg-brand-500/8' : 'border-ink-200 hover:border-brand-500/30 dark:border-white/10')}
                >
                  <div>
                    <div className="font-bold">{a.name}</div>
                    <div className="mt-0.5 text-[10px] text-ink-400">{a.nodes.length} نقش — ingest {faNum(a.ingest_gb_day ?? 0)} GB/day</div>
                  </div>
                  <Badge tone="brand">{faNum(a.nodes.reduce((x, n) => x + n.count, 0))} نود</Badge>
                </button>
              ))}
            </div>
          )}

          <Button className="mt-4 w-full" onClick={start} loading={starting} icon={<Rocket className="size-4" />}>
            اجرای preflight و شروع استقرار
          </Button>
          <p className="mt-2 text-[10px] text-ink-400">اجرای idempotent — cancel/retry امن — هیچ secret در log ثبت نمی‌شود.</p>
        </Card>

        <div className="lg:col-span-3">
          {!active ? (
            <Card>
              <EmptyState
                title="استقراری اجرا نشده"
                hint="یک طراحی معماری انتخاب کنید تا گزارش preflight و جریان اجرای زنده اینجا نمایش داده شود."
              />
            </Card>
          ) : (
            <DeploymentMonitor job={active} onChange={setActive} onDone={load} />
          )}

          {deployments && deployments.filter((d) => !active || d.id !== active.id).length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-xs font-bold text-ink-400">تاریخچه استقرار</h3>
              <div className="space-y-2">
                {deployments.filter((d) => !active || d.id !== active.id).slice(0, 4).map((d) => (
                  <button key={d.id} onClick={() => setActive(d)}
                    className="focus-ring flex w-full items-center justify-between rounded-xl border border-ink-200 px-3 py-2 text-xs hover:border-brand-500/40 dark:border-white/8">
                    <span className="font-bold">{d.plan_summary}</span>
                    <span className="text-ink-400">{faDate(d.created_at)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeploymentMonitor({ job, onChange, onDone }: { job: DeploymentJob; onChange: (d: DeploymentJob) => void; onDone: () => void }) {
  const [events, setEvents] = useState<{ id: string; message: string; level: string; created_at: string }[]>([]);
  const [tab, setTab] = useState<'run' | 'preflight' | 'validation'>('run');
  const live = job.status === 'running' || job.status === 'queued';

  useEffect(() => {
    setEvents([]);
    const unsub = subscribeEvents(`/api/deployments/${job.id}/events`, {
      snapshot: ((d: { deployment: DeploymentJob }) => onChange(d.deployment)) as never,
      event: ((ev: { id: string; message: string; level: string; created_at: string }) => {
        setEvents((p) => (p.some((x) => x.id === ev.id) ? p : [...p.slice(-150), ev]));
      }) as never,
      done: (() => onDone()) as never,
      onError: () => {},
    });
    return unsub;
  }, [job.id, onChange, onDone]);

  const cancel = async () => {
    await api(`/api/deployments/${job.id}`, { method: 'DELETE' }).catch(() => {});
  };

  const tone = job.status === 'success' ? 'green' : job.status === 'failed' ? 'rose' : job.status === 'warning' ? 'amber' : 'cyan';

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn('size-2.5 rounded-full', live ? 'animate-pulse-soft bg-cyan-400' : job.status === 'success' ? 'bg-emerald-500' : job.status === 'warning' ? 'bg-amber-500' : job.status === 'failed' ? 'bg-rose-500' : 'bg-ink-400')} />
          <span className="text-sm font-bold">{job.plan_summary}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={tone as 'green'}>
            {job.status === 'success' ? 'موفق' : job.status === 'warning' ? 'با هشدار' : job.status === 'failed' ? 'ناموفق' : job.status === 'cancelled' ? 'لغو شده' : job.status === 'running' ? 'در حال اجرا' : 'در صف'}
          </Badge>
          {live && <Button size="sm" variant="danger" onClick={cancel}>لغو</Button>}
        </div>
      </div>

      <div className="mb-3 flex rounded-xl bg-ink-900/5 p-1 dark:bg-white/5">
        {([['run', 'اجرای زنده'], ['preflight', 'Preflight'], ['validation', 'اعتبارسنجی']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn('focus-ring flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-colors',
              tab === id ? 'bg-white shadow dark:bg-ink-800' : 'text-ink-400 hover:text-ink-600')}>
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'run' && (
          <motion.div key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mb-1 flex justify-between text-[11px] text-ink-400">
              <span>پیشرفت</span>
              <span>{faNum(Math.round(job.progress))}٪</span>
            </div>
            <ProgressBar value={job.progress} tone={tone as 'brand'} />
            <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-xl bg-ink-950/4 p-3 font-mono text-[11px] leading-5 dark:bg-black/30">
              {events.length === 0 && <div className="text-ink-400">در انتظار رویداد…</div>}
              {events.map((ev) => (
                <motion.div key={ev.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                  className={ev.level === 'error' ? 'text-rose-500' : ev.level === 'warning' ? 'text-amber-500' : ev.level === 'success' ? 'text-emerald-500' : 'text-ink-500 dark:text-ink-300'}>
                  <span className="text-ink-400">[{new Date(ev.created_at).toLocaleTimeString('fa-IR')}]</span> {ev.message}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {tab === 'preflight' && (
          <motion.div key="pf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            {(job.preflight ?? []).map((p: PreflightItem) => {
              const meta = SEV[p.severity];
              return (
                <div key={p.id} className="flex items-start gap-2.5 rounded-xl border border-ink-200/70 px-3 py-2.5 dark:border-white/8">
                  <meta.icon className={cn('mt-0.5 size-4 shrink-0',
                    p.severity === 'critical' ? 'text-rose-500' : p.severity === 'warning' ? 'text-amber-500' : 'text-ink-400')} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{p.check}</span>
                      <div className="flex items-center gap-2">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        {p.passed ? <Badge tone="green">برقرار</Badge> : <Badge tone="rose">ناموفق</Badge>}
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-ink-500 dark:text-ink-400">{p.detail}</p>
                  </div>
                </div>
              );
            })}
            {(!job.preflight || job.preflight.length === 0) && <div className="py-6 text-center text-xs text-ink-400">گزارش preflight در دسترس نیست</div>}
          </motion.div>
        )}

        {tab === 'validation' && (
          <motion.div key="val" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            {job.status === 'running' || job.status === 'queued' ? (
              <div className="py-8 text-center text-xs text-ink-400">اعتبارسنجی پس از پایان اجرا انجام می‌شود…</div>
            ) : (job.validation ?? []).length === 0 ? (
              <div className="py-8 text-center text-xs text-ink-400">نتیجه‌ای ثبت نشده — هیچ Success ساختگی نمایش داده نمی‌شود</div>
            ) : (
              (job.validation ?? []).map((v) => (
                <div key={v.check} className="flex items-center justify-between rounded-xl border border-ink-200/70 px-3 py-2.5 text-xs dark:border-white/8">
                  <div>
                    <div className="font-bold">{v.check}</div>
                    <div className="mt-0.5 text-[10px] text-ink-400">{v.detail}</div>
                  </div>
                  {v.status === 'pass' ? <Badge tone="green">Pass</Badge> : v.status === 'fail' ? <Badge tone="rose">Fail</Badge> : <Badge tone="zinc">Not verified</Badge>}
                </div>
              ))
            )}
            {job.error && <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">{job.error}</div>}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3 text-[10px] text-ink-400">شروع: {timeAgo(job.created_at)} {job.finished_at && `— پایان: ${timeAgo(job.finished_at)}`}</div>
    </Card>
  );
}
