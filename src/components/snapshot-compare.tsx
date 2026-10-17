'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, GitCompareArrows } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Spinner, type BadgeTone } from '@/components/ui';
import { api } from '@/lib/api';
import { faDate, faNum } from '@/lib/utils';
import type { SnapshotDiff, SnapshotPort, SnapshotSummary } from '@/lib/types';

const PROFILE_LABEL: Record<string, string> = {
  quick: 'کشف سریع',
  standard: 'موجودی استاندارد',
  credentialed: 'با اعتبارنامه',
};

const SELECT_CLS =
  'focus-ring h-10 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm dark:border-white/10 dark:bg-ink-900';

function snapLabel(s: SnapshotSummary): string {
  return `${PROFILE_LABEL[s.profile] ?? s.profile} — ${faDate(s.created_at)} · ${s.job_id.slice(-6)}${s.demo === 1 ? ' (DEMO)' : ''}`;
}

function PortChips({ ports, tone }: { ports: SnapshotPort[]; tone: BadgeTone }) {
  if (ports.length === 0) return <span className="text-[11px] text-ink-400">بدون پورت</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {ports.map((p) => (
        <Badge key={p.port} tone={tone}>
          {p.port}
          {p.service !== 'unknown' ? `/${p.service}` : ''}
        </Badge>
      ))}
    </div>
  );
}

function DiffSection({ title, dot, children }: { title: string; dot: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className={`size-1.5 rounded-full ${dot}`} />
        <h3 className="text-[11px] font-bold text-ink-600 dark:text-ink-300">{title}</h3>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function SnapshotCompare() {
  const [snaps, setSnaps] = useState<SnapshotSummary[] | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [diff, setDiff] = useState<SnapshotDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ snapshots: SnapshotSummary[] }>('/api/scans/snapshots')
      .then((r) => {
        setSnaps(r.snapshots);
        if (r.snapshots.length >= 2) {
          setFrom(r.snapshots[1].job_id);
          setTo(r.snapshots[0].job_id);
        }
      })
      .catch(() => setSnaps([]));
  }, []);

  const compare = async () => {
    setLoading(true);
    setError('');
    setDiff(null);
    try {
      const r = await api<{ diff: SnapshotDiff }>('/api/scans/compare', {
        method: 'POST',
        body: JSON.stringify({ from, to }),
      });
      setDiff(r.diff);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!snaps) {
    return (
      <Card className="mt-6">
        <Spinner />
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <div className="flex items-center gap-2">
        <GitCompareArrows className="size-4 text-brand-500" />
        <h2 className="text-sm font-bold text-ink-900 dark:text-ink-50">مقایسه اسنپ‌شات اسکن‌ها</h2>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-ink-500 dark:text-ink-400">
        هر job موفق اسنپ‌شاتی از شواهد همین job (هاست‌ها و پورت‌های باز مشاهده‌شده) ثبت می‌کند. مقایسه فقط روی
        اسنپ‌شات‌های واقعی انجام می‌شود — نتیجه ساختگی نمایش داده نمی‌شود.
      </p>

      {snaps.length < 2 ? (
        <div className="mt-4">
          <EmptyState
            title="حداقل دو اسنپ‌شات لازم است"
            hint={
              snaps.length === 0
                ? 'هنوز هیچ job موفقی اسنپ‌شات نساخته است. یک اسکن روی scope مجاز اجرا کنید — یا دیتاست دمو را بارگذاری کنید (برچسب DEMO DATA می‌گیرد).'
                : 'یک job موفق دیگر اجرا کنید تا مقایسه فعال شود.'
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto]">
            <label className="block text-right">
              <span className="mb-1 block text-[11px] font-bold text-ink-500 dark:text-ink-400">مبدأ (قدیمی‌تر)</span>
              <select value={from} onChange={(e) => setFrom(e.target.value)} className={SELECT_CLS}>
                {snaps.map((s) => (
                  <option key={s.job_id} value={s.job_id}>{snapLabel(s)}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end justify-center pb-2 text-ink-400">
              <ArrowLeft className="size-4" />
            </div>
            <label className="block text-right">
              <span className="mb-1 block text-[11px] font-bold text-ink-500 dark:text-ink-400">مقصود (تازه‌تر)</span>
              <select value={to} onChange={(e) => setTo(e.target.value)} className={SELECT_CLS}>
                {snaps.map((s) => (
                  <option key={s.job_id} value={s.job_id}>{snapLabel(s)}</option>
                ))}
              </select>
            </label>
            <Button
              loading={loading}
              disabled={!from || !to || from === to}
              onClick={compare}
              icon={<GitCompareArrows className="size-4" />}
            >
              مقایسه
            </Button>
          </div>
          {from === to && (
            <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">دو job برای مقایسه باید متفاوت باشند.</p>
          )}
          {error && <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400">{error}</p>}
        </>
      )}

      {diff && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Badge tone="zinc">مبدأ: {faNum(diff.from.host_count)} هاست / {faNum(diff.from.port_count)} پورت</Badge>
            <Badge tone="cyan">مقصود: {faNum(diff.to.host_count)} هاست / {faNum(diff.to.port_count)} پورت</Badge>
            <Badge tone="green">+{faNum(diff.added.length)} هاست جدید</Badge>
            <Badge tone="rose">−{faNum(diff.removed.length)} هاست ناپدید</Badge>
            <Badge tone="amber">~{faNum(diff.changed.length)} هاست تغییریافته</Badge>
            <Badge tone="zinc">{faNum(diff.unchanged_hosts)} هاست بدون تغییر</Badge>
          </div>

          {diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0 ? (
            <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-700 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300">
              بین شواهد این دو اسکن هیچ تفاوتی ثبت نشده است.
            </p>
          ) : (
            <div className="space-y-3">
              {diff.added.length > 0 && (
                <DiffSection title="هاست‌های جدید" dot="bg-emerald-500">
                  {diff.added.map((h) => (
                    <div key={h.ip} className="flex items-start justify-between gap-3 rounded-lg bg-white/40 px-3 py-2 dark:bg-white/5">
                      <div className="text-right">
                        <div className="text-xs font-bold">
                          {h.hostname} <span className="font-mono text-ink-400">({h.ip})</span>
                        </div>
                        <div className="mt-1">
                          <PortChips ports={h.ports} tone="green" />
                        </div>
                      </div>
                      {h.source === 'demo' && <Badge tone="demo">DEMO</Badge>}
                    </div>
                  ))}
                </DiffSection>
              )}

              {diff.removed.length > 0 && (
                <DiffSection title="هاست‌هایی که در اسکن جدید دیده نشدند" dot="bg-rose-500">
                  {diff.removed.map((h) => (
                    <div key={h.ip} className="rounded-lg bg-white/40 px-3 py-2 dark:bg-white/5">
                      <div className="text-xs font-bold">
                        {h.hostname} <span className="font-mono text-ink-400">({h.ip})</span>
                      </div>
                      <div className="mt-1">
                        <PortChips ports={h.ports} tone="rose" />
                      </div>
                    </div>
                  ))}
                </DiffSection>
              )}

              {diff.changed.length > 0 && (
                <DiffSection title="هاست‌های تغییریافته" dot="bg-amber-500">
                  {diff.changed.map((c) => (
                    <div key={c.ip} className="space-y-1.5 rounded-lg bg-white/40 px-3 py-2 dark:bg-white/5">
                      <div className="text-xs font-bold">
                        {c.hostname_to !== c.hostname_from ? (
                          <>
                            {c.hostname_from} <ArrowLeft className="inline size-3" /> {c.hostname_to}
                          </>
                        ) : (
                          c.hostname_to
                        )}
                        {' '}<span className="font-mono text-ink-400">({c.ip})</span>
                      </div>
                      {c.ports_added.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">پورت باز جدید:</span>
                          <PortChips ports={c.ports_added} tone="green" />
                        </div>
                      )}
                      {c.ports_removed.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] text-rose-600 dark:text-rose-400">پورتی که دیگر باز نیست:</span>
                          <PortChips ports={c.ports_removed} tone="rose" />
                        </div>
                      )}
                      {c.service_changed.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">تغییر سرویس:</span>
                          {c.service_changed.map((s) => (
                            <Badge key={s.port} tone="amber">
                              {s.port}: {s.from} ← {s.to}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </DiffSection>
              )}
            </div>
          )}
        </motion.div>
      )}
    </Card>
  );
}
