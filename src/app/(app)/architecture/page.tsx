'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Boxes, Save, Trash2, Cpu, HardDrive, MemoryStick, Info } from 'lucide-react';
import { PageHeader, Card, Button, Input, Badge, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, faNum, faDate } from '@/lib/utils';
import { useToast } from '@/components/toast';
import type { ArchitectureDesign, SplunkNodeSpec } from '@/lib/types';

const GOALS = [
  { id: 'poc', label: 'Lab / POC', desc: 'یادگیری و اعتبارسنجی' },
  { id: 'small', label: 'Small Production', desc: 'حجم کم، ساده' },
  { id: 'enterprise', label: 'Medium/Large Enterprise', desc: 'مقیاس سازمانی' },
  { id: 'ha', label: 'High Availability', desc: 'کلاسترینگ و redundancy' },
  { id: 'dr', label: 'Disaster Recovery', desc: 'چند سایته' },
] as const;

const ROLE_COLORS: Record<string, string> = {
  Standalone: 'from-emerald-500 to-teal-500',
  'Search Head': 'from-cyan-500 to-sky-500',
  'Search Head Cluster': 'from-cyan-500 to-sky-500',
  Indexer: 'from-brand-500 to-emerald-600',
  'Indexer Cluster Peer': 'from-brand-500 to-emerald-600',
  'Indexer Cluster Manager': 'from-violet-500 to-purple-500',
  Deployer: 'from-fuchsia-500 to-pink-500',
  'Monitoring Console': 'from-amber-500 to-orange-500',
  'Universal Forwarder': 'from-ink-500 to-ink-600',
  'Heavy Forwarder': 'from-ink-500 to-ink-600',
};

export default function ArchitecturePage() {
  const toast = useToast();
  const [designs, setDesigns] = useState<ArchitectureDesign[] | null>(null);
  const [goal, setGoal] = useState<string>('small');
  const [ingest, setIngest] = useState(50);
  const [peak, setPeak] = useState(0);
  const [retention, setRetention] = useState(90);
  const [users, setUsers] = useState(10);
  const [workload, setWorkload] = useState<'light' | 'mixed' | 'heavy'>('mixed');
  const [sites, setSites] = useState(1);
  const [preview, setPreview] = useState<ArchitectureDesign | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => api<{ architectures: ArchitectureDesign[] }>('/api/architectures').then((r) => setDesigns(r.architectures)).catch(() => {});
  useEffect(() => { load(); }, []);

  const generate = async () => {
    try {
      const r = await api<{ architecture: ArchitectureDesign }>('/api/architectures', {
        method: 'POST',
        body: JSON.stringify({ goal: goal as never, ingest_gb_day: ingest, peak_gb_day: peak, retention_days: retention, search_users: users, workload, growth_pct_year: 20, sites }),
      });
      setPreview(r.architecture);
      load();
      toast('success', 'طراحی معماری ساخته و ذخیره شد');
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  const remove = async (id: string) => {
    await api('/api/architectures', { method: 'DELETE', body: JSON.stringify({ id }) }).catch(() => {});
    load();
  };

  const nodes = preview?.nodes ?? [];

  return (
    <div>
      <PageHeader title="استودیو معماری Splunk" subtitle="پاسخ به پرسش‌های واقعی → پیشنهاد توپولوژی با دلیل هر نود — برآوردها تقریبی‌اند و تضمین performance نیستند" />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-bold">پرسش‌نامه sizing</h3>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={cn(
                  'focus-ring rounded-xl border p-3 text-right transition-all',
                  goal === g.id ? 'border-brand-500/60 bg-brand-500/8' : 'border-ink-200 hover:border-brand-500/30 dark:border-white/10'
                )}
              >
                <div className="text-xs font-bold">{g.label}</div>
                <div className="mt-0.5 text-[10px] text-ink-400">{g.desc}</div>
              </button>
            ))}
          </div>

          <div className="space-y-3.5">
            {[
              { label: 'میانگین ingest (GB/day)', value: ingest, set: setIngest, min: 0, max: 5000 },
              { label: 'Peak ingest (GB/day) — اگر کمتر از میانگین است ۰ بماند', value: peak, set: setPeak, min: 0, max: 10000 },
              { label: 'نگهداری داده (روز)', value: retention, set: setRetention, min: 1, max: 3650 },
              { label: 'کاربران هم‌زمان جستجو', value: users, set: setUsers, min: 0, max: 5000 },
              { label: 'تعداد سایت‌ها', value: sites, set: setSites, min: 1, max: 5 },
            ].map((f) => (
              <div key={f.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-500 dark:text-ink-400">{f.label}</span>
                  <Badge tone="brand">{faNum(f.value)}</Badge>
                </div>
                <input
                  type="range" min={f.min} max={f.max} value={f.value}
                  onChange={(e) => f.set(Number(e.target.value))}
                  className="w-full accent-brand-500"
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-500 dark:text-ink-400">نوع بار جستجو</label>
              <div className="flex gap-2">
                {(['light', 'mixed', 'heavy'] as const).map((w) => (
                  <button key={w} onClick={() => setWorkload(w)}
                    className={cn('focus-ring flex-1 rounded-lg border py-1.5 text-xs font-bold transition-colors',
                      workload === w ? 'border-brand-500/60 bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'border-ink-200 text-ink-400 dark:border-white/10')}>
                    {w === 'light' ? 'سبک' : w === 'mixed' ? 'ترکیبی' : 'سنگین'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button className="mt-5 w-full" onClick={generate} loading={saving} icon={<Boxes className="size-4" />}>تولید و ذخیره طراحی</Button>
          <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-5 text-ink-400">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            فرضیات به‌صورت صریح ثبت می‌شوند؛ هیچ برآوردی به‌عنوان sizing قطعی نمایش داده نمی‌شود.
          </p>
        </Card>

        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {!preview ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card className="flex h-full min-h-[420px] flex-col items-center justify-center text-center">
                  <Boxes className="mb-3 size-10 text-ink-300 dark:text-ink-600" />
                  <div className="text-sm font-bold text-ink-400">پرسش‌نامه را تکمیل و طراحی را تولید کنید</div>
                  <div className="mt-1 text-xs text-ink-400">یا از طراحی‌های ذخیره‌شده انتخاب کنید</div>
                  {designs && designs.length > 0 && (
                    <div className="mt-4 w-full max-w-sm space-y-2">
                      {designs.map((d) => (
                        <button key={d.id} onClick={() => setPreview(d)}
                          className="focus-ring flex w-full items-center justify-between rounded-xl border border-ink-200 px-3 py-2 text-xs hover:border-brand-500/40 dark:border-white/10">
                          <span className="font-bold">{d.name}</span>
                          <span className="text-ink-400">{faDate(d.created_at)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              </motion.div>
            ) : (
              <motion.div key={preview.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="mb-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-extrabold">{preview.name}</h3>
                      <p className="mt-0.5 text-xs text-ink-400">ingest: {faNum(preview.ingest_gb_day ?? 0)} GB/day — {faDate(preview.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="brand">JSON/PNG در فاز بعد</Badge>
                      <button onClick={() => remove(preview.id)} className="focus-ring rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/10">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {nodes.map((n: SplunkNodeSpec, i: number) => (
                      <motion.div
                        key={`${n.role}-${i}`}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.08 }}
                        className="relative overflow-hidden rounded-xl border border-ink-200/80 p-4 dark:border-white/8"
                      >
                        <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-l', ROLE_COLORS[n.role] ?? 'from-ink-400 to-ink-500')} />
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-extrabold" dir="ltr">{n.role}</span>
                          <Badge tone="cyan">×{faNum(n.count)}</Badge>
                        </div>
                        <p className="mt-2 text-[11px] leading-5 text-ink-500 dark:text-ink-400">{n.reason}</p>
                        <div className="mt-3 flex items-center gap-4 text-[11px] text-ink-400">
                          <span className="flex items-center gap-1"><Cpu className="size-3.5" /> {faNum(n.cpu)} core</span>
                          <span className="flex items-center gap-1"><MemoryStick className="size-3.5" /> {faNum(n.ram_gb)} GB</span>
                          <span className="flex items-center gap-1"><HardDrive className="size-3.5" /> {faNum(n.storage_gb)} GB</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {preview.assumptions.length > 0 && (
                    <div className="mt-4 rounded-xl bg-amber-500/8 p-3">
                      <div className="mb-1 text-xs font-bold text-amber-700 dark:text-amber-300">فرضیات ثبت‌شده</div>
                      <ul className="list-inside list-disc space-y-1 text-[11px] leading-5 text-amber-800 dark:text-amber-200/90">
                        {preview.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between rounded-xl bg-ink-900/4 p-3 text-[11px] dark:bg-white/4">
                    <span className="text-ink-500 dark:text-ink-300">گام بعد: انتخاب این طراحی در صفحه استقرار و اجرای preflight</span>
                    <a href="/deployment" className="font-bold text-brand-600 hover:underline dark:text-brand-300">رفتن به استقرار ←</a>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {!designs && <div className="flex justify-center py-6"><Spinner /></div>}
        </div>
      </div>
    </div>
  );
}
