'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, Zap, ListChecks, KeyRound, Sparkles, ShieldAlert, Ban, ChevronDown } from 'lucide-react';
import { Card, Button, Input, Badge, ProgressBar } from '@/components/ui';
import { api, subscribeEvents } from '@/lib/api';
import { faNum, timeAgo } from '@/lib/utils';
import type { ScanJob } from '@/lib/types';

const PROFILES = [
  {
    id: 'quick' as const,
    icon: Zap,
    title: 'کشف سریع',
    desc: 'TCP connect روی پورت‌های منتخب و رایج (۱۲ پورت) — سریع و کم‌اثر',
    scope: 'فقط وجود host و پورت‌های شناخته‌شده',
    effect: 'اثر بسیار کم روی شبکه',
  },
  {
    id: 'standard' as const,
    icon: ListChecks,
    title: 'موجودی استاندارد',
    desc: 'پوشش ۲۷ پورت + DNS reverse lookup — شناسایی سرویس‌های بیشتر',
    scope: 'هاست، پورت باز، hostname از DNS',
    effect: 'اثر کم، duration بیشتر',
  },
  {
    id: 'credentialed' as const,
    icon: KeyRound,
    title: 'موجودی با اعتبارنامه',
    desc: 'استاندارد + آماده‌سازی برای SSH/WinRM inventory با credential ثبت‌شده',
    scope: 'همه موارد بالا؛ موجودی سیستم‌عامل فقط با credential معتبر',
    effect: 'در این نسخه، inventory credentialed Coming later — شواهد پورت ثبت می‌شود',
  },
];

export function NewScanForm({ scopes, onCreated }: { scopes: string[]; onCreated: (job: ScanJob) => void }) {
  const [profile, setProfile] = useState<'quick' | 'standard' | 'credentialed'>('quick');
  const [targets, setTargets] = useState('');
  const [exclusions, setExclusions] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useRef<string | null>(null);
  void toast;

  const targetList = targets.split(/[\s،,]+/).filter(Boolean);

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api<{ scan: ScanJob }>('/api/scans', {
        method: 'POST',
        body: JSON.stringify({ profile, targets: targetList, exclusions: exclusions.split(/[\s،,]+/).filter(Boolean) }),
      });
      onCreated(r.scan);
      setConfirmed(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadDemo = async () => {
    setDemoLoading(true);
    setError('');
    try {
      const r = await api<{ scan: ScanJob }>('/api/scans', { method: 'PUT', body: JSON.stringify({ action: 'load-demo' }) });
      onCreated(r.scan);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">اجرای کشف کنترل‌شده</h2>
          <p className="mt-1 text-xs text-ink-400">محدوده مجاز Workspace: <span className="font-semibold text-brand-600 dark:text-brand-300" dir="ltr">{scopes.join(' , ') || '—'}</span></p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDemo} loading={demoLoading} icon={<Sparkles className="size-3.5" />}>
          بارگذاری دیتاست دموی ۶ سروره
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {PROFILES.map((p) => (
          <button
            key={p.id}
            onClick={() => { setProfile(p.id); setConfirmed(false); }}
            className={`focus-ring rounded-2xl border p-4 text-right transition-all duration-200 ${
              profile === p.id
                ? 'border-brand-500/60 bg-brand-500/8 shadow-lg shadow-brand-600/10'
                : 'border-ink-200 hover:border-brand-500/30 dark:border-white/10'
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <p.icon className={`size-5 ${profile === p.id ? 'text-brand-500' : 'text-ink-400'}`} />
              <span className="text-sm font-bold">{p.title}</span>
            </div>
            <p className="text-[11px] leading-5 text-ink-500 dark:text-ink-400">{p.desc}</p>
            <div className="mt-2.5 space-y-1 text-[10px] text-ink-400">
              <div>دامنه: {p.scope}</div>
              <div>اثر: {p.effect}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-ink-500">اهداف (CIDR یا IP — باید داخل allowlist باشند)</label>
          <Input value={targets} onChange={(e) => { setTargets(e.target.value); setConfirmed(false); }} dir="ltr" placeholder="192.168.1.0/24" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {targetList.map((t) => (
              <Badge key={t} tone={scopes.some((s) => t === s || t.startsWith(s.split('/')[0].split('.').slice(0, -1).join('.'))) ? 'brand' : 'amber'}>{t}</Badge>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-ink-500">استثناها (اختیاری)</label>
          <Input value={exclusions} onChange={(e) => { setExclusions(e.target.value); setConfirmed(false); }} dir="ltr" placeholder="192.168.1.10 192.168.1.20/32" />
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-400">
            <Ban className="size-3.5" /> شبکه‌های حساس، printer/OT و IPهای ممنوع را اینجا حذف کنید.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {targetList.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/8 p-4">
              <div className="flex items-start gap-2 text-xs leading-6 text-amber-800 dark:text-amber-200">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <div>
                  <b>خلاصه قبل از اجرا:</b> پروفایل «{PROFILES.find((p) => p.id === profile)?.title}» روی {targetList.join('، ')} —
                  پورت‌های منتخب، سرعت محافظه‌کارانه، timeout و retry خودکار.
                  اسکن هرگز خارج از allowlist اجرا نمی‌شود (اعتبارسنجی server-side). باز بودن پورت به معنای احراز هویت نیست.
                </div>
              </div>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-200">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="size-4 accent-amber-500" />
                scope را بررسی و صریحاً تأیید می‌کنم
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <div className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">{error}</div>}

      <div className="mt-5 flex justify-start">
        <Button onClick={submit} disabled={!confirmed || targetList.length === 0} loading={loading} icon={<Radar className="size-4" />}>
          شروع اسکن کنترل‌شده
        </Button>
      </div>
    </Card>
  );
}

const STATUS_LABELS: Record<string, string> = { queued: 'در صف', running: 'در حال اجرا', success: 'موفق', warning: 'با هشدار', failed: 'ناموفق', cancelled: 'لغو شده', waiting_approval: 'در انتظار تأیید' };

export function ScanMonitor({ job, onChange }: { job: ScanJob; onChange: (job: ScanJob) => void }) {
  const [events, setEvents] = useState<{ id: string; message: string; level: string; created_at: string }[]>([]);
  const [live, setLive] = useState<boolean>(job.status === 'running' || job.status === 'queued');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (job.demo === 1) return;
    const unsub = subscribeEvents(`/api/scans/${job.id}/events`, {
      snapshot: ((d: { scan: ScanJob }) => { onChange(d.scan); }) as never,
      event: ((ev: { id: string; message: string; level: string; created_at: string }) => {
        setEvents((prev) => [...prev.slice(-120), ev]);
      }) as never,
      done: (() => { setLive(false); }) as never,
      onError: () => setLive(false),
    });
    return unsub;
  }, [job.id, job.demo, onChange]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [events.length]);

  const cancel = async () => {
    await api(`/api/scans/${job.id}`, { method: 'DELETE' }).catch(() => {});
  };

  const tone = job.status === 'success' ? 'green' : job.status === 'failed' ? 'rose' : job.status === 'warning' ? 'amber' : job.status === 'running' ? 'cyan' : 'zinc';

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={`size-2.5 rounded-full ${live ? 'animate-pulse-soft bg-cyan-400' : job.status === 'success' ? 'bg-emerald-500' : job.status === 'failed' ? 'bg-rose-500' : job.status === 'cancelled' ? 'bg-ink-400' : 'bg-amber-500'}`} />
          <span className="text-sm font-bold">{job.profile === 'quick' ? 'کشف سریع' : job.profile === 'standard' ? 'موجودی استاندارد' : 'موجودی با اعتبارنامه'}</span>
          {job.demo === 1 && <Badge tone="demo">DEMO DATA</Badge>}
          <Badge tone={tone as 'green'}>{STATUS_LABELS[job.status] ?? job.status}</Badge>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-ink-400">
          <span>شروع: {timeAgo(job.created_at)}</span>
          {(job.status === 'running' || job.status === 'queued') && (
            <Button size="sm" variant="danger" onClick={cancel}>لغو</Button>
          )}
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between text-[11px] text-ink-400">
        <span>پیشرفت: {faNum(Math.round(job.progress))}٪</span>
        <span>هاست‌های بررسی‌شده: {faNum(job.scanned_hosts)}/{faNum(job.total_hosts)} — فعال: {faNum(job.hosts_up)} — پورت باز: {faNum(job.open_ports)}</span>
      </div>
      <ProgressBar value={job.progress} tone={tone as 'brand'} />

      {job.demo === 1 ? (
        <div className="mt-3 rounded-xl bg-fuchsia-500/8 p-3 text-[11px] leading-5 text-fuchsia-700 dark:text-fuchsia-300">
          این job یک دیتاست نمایشی است — هیچ اسکن واقعی روی شبکه انجام نشده. داده‌ها با برچسب DEMO DATA در نقشه و داشبورد قابل تشخیص‌اند.
        </div>
      ) : (
        <div ref={scrollRef} className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-xl bg-ink-950/4 p-3 font-mono text-[11px] leading-5 dark:bg-black/30">
          {events.length === 0 && <div className="text-ink-400">در انتظار رویداد…</div>}
          {events.map((ev) => (
            <motion.div key={ev.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className={
              ev.level === 'error' ? 'text-rose-500' : ev.level === 'warning' ? 'text-amber-500' : ev.level === 'success' ? 'text-emerald-500' : 'text-ink-500 dark:text-ink-300'
            }>
              <span className="text-ink-400">[{new Date(ev.created_at).toLocaleTimeString('fa-IR')}]</span> {ev.message}
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  );
}
