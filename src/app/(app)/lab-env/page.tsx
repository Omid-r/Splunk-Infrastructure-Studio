'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Workflow, Play, Check, X, AlertTriangle, ChevronDown, ExternalLink, Square } from 'lucide-react';
import { Badge, Button, Card, FadeIn, PageHeader, Spinner } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { faNum } from '@/lib/utils';

type StepKey = 'seed-demo' | 'design' | 'deploy' | 'provision' | 'start-nodes' | 'traffic' | 'bundle' | 'stop-nodes';

interface StepResult {
  step: StepKey;
  ok: boolean;
  title: string;
  detail: string;
  metrics: { label: string; value: string }[];
  evidence: string[];
  warnings: string[];
}

interface Status {
  hosts: number;
  demo_hosts: number;
  scans: number;
  snapshots: number;
  architectures: number;
  deployments: number;
  lab_nodes: number;
  running_nodes: number;
  events_stored: number;
  bundles: number;
  sample_files: { name: string; bytes: number; lines: number }[];
}

const STEPS: { key: StepKey; label: string; hint: string; destructive?: boolean }[] = [
  { key: 'seed-demo', label: 'موجودی نمایشی', hint: 'یک اسکن DEMO با برچسب واضح + اسنپ‌شات قابل‌مقایسه' },
  { key: 'design', label: 'طراحی معماری', hint: 'معماری POC از فرمول‌های sizing واقعی (۵ گیگ/روز)' },
  { key: 'deploy', label: 'استقرار Local Lab', hint: 'پیش‌نیازها بررسی و مانیفست نودها روی دیسک نوشته می‌شود' },
  { key: 'provision', label: 'ساخت نودهای زنده', hint: 'گیرندهٔ TCP واقعی + کانف‌های each نود روی ۱۲۷.۰.۰.۱' },
  { key: 'start-nodes', label: 'روشن کردن نودها', hint: 'پورت اینجست و مدیریت هر نود به‌صورت واقعی باز می‌شود' },
  { key: 'traffic', label: 'تزریق لاگ نمونه', hint: 'خط‌های واقعی از lab/sample-data → فوروادر → ایندکسر → جستجو' },
  { key: 'bundle', label: 'بستهٔ شواهد', hint: 'tar.gz واقعی از کانف/spool/لاگ با manifest و sha256' },
  { key: 'stop-nodes', label: 'خاموش کردن نودها', hint: 'آزادسازی پورت‌ها — داده‌ها روی دیسک می‌مانند', destructive: true },
];

const RESULT_LINKS: Partial<Record<StepKey, { href: string; label: string }[]>> = {
  'seed-demo': [{ href: '/hosts', label: 'هاست‌ها' }, { href: '/discovery', label: 'مقایسه اسنپ‌شات' }],
  design: [{ href: '/architecture', label: 'استودیو معماری' }],
  deploy: [{ href: '/deployment', label: 'استقرار و اعتبارسنجی' }],
  'start-nodes': [{ href: '/lab', label: 'آزمایشگاه زنده' }],
  traffic: [{ href: '/lab', label: 'جستجوی توزیع‌شده' }],
  bundle: [{ href: '/lab', label: 'دانلود بسته' }],
};

export default function LabEnvPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [results, setResults] = useState<Partial<Record<StepKey, StepResult>>>({});
  const [open, setOpen] = useState<StepKey | null>(null);
  const [busy, setBusy] = useState<StepKey | 'all' | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const toast = useToast();

  const reload = useCallback(() => {
    api<{ status: Status }>('/api/lab-env')
      .then((r) => setStatus(r.status))
      .catch((e) => toast.push({ tone: 'error', title: 'وضعیت آزمایشگاه خوانده نشد', message: (e as Error).message }));
  }, [toast]);

  useEffect(reload, [reload]);

  const runStep = useCallback(async (key: StepKey): Promise<StepResult | null> => {
    setBusy(key);
    try {
      const r = await api<{ result: StepResult }>('/api/lab-env/step', {
        method: 'POST',
        body: JSON.stringify({ step: key }),
      });
      setResults((cur) => ({ ...cur, [key]: r.result }));
      setOpen(key);
      reload();
      return r.result;
    } catch (e) {
      const failed: StepResult = {
        step: key,
        ok: false,
        title: STEPS.find((s) => s.key === key)?.label ?? key,
        detail: (e as Error).message,
        metrics: [],
        evidence: [],
        warnings: ['این مرحله اجرا نشد؛ پیام خطا عیناً از backend آمده است.'],
      };
      setResults((cur) => ({ ...cur, [key]: failed }));
      setOpen(key);
      return failed;
    } finally {
      setBusy(null);
    }
  }, [reload]);

  const runAll = useCallback(async () => {
    setAutoRun(true);
    setBusy('all');
    for (const s of STEPS) {
      if (s.destructive) continue;
      const r = await runStep(s.key);
      if (!r?.ok) break;
    }
    setBusy(null);
  }, [runStep]);

  useEffect(() => {
    if (autoRun && busy === null) setAutoRun(false);
  }, [autoRun, busy]);

  if (!status) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="محیط آزمایشگاهی"
        subtitle="یک زنجیرهٔ کامل و واقعی: موجودی → معماری → استقرار → نودهای زنده → لاگ نمونه → جستجو و بستهٔ شواهد. هیچ نتیجه‌ای جعل نمی‌شود؛ اگر مرحله‌ای داده نداشته باشد، صریح رد می‌شود."
        actions={
          <>
            <Button variant="outline" onClick={reload}>بازخوانی وضعیت</Button>
            <Button icon={<Play className="size-4" />} loading={busy === 'all'} onClick={runAll}>اجرای همهٔ مراحل</Button>
          </>
        }
      />

      <FadeIn>
        <Card className="mb-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: 'هاست‌ها (دمو/کل)', v: `${faNum(status.demo_hosts)}/${faNum(status.hosts)}` },
              { k: 'اسکن / اسنپ‌شات', v: `${faNum(status.scans)}/${faNum(status.snapshots)}` },
              { k: 'معماری / استقرار', v: `${faNum(status.architectures)}/${faNum(status.deployments)}` },
              { k: 'نود روشن / کل', v: `${faNum(status.running_nodes)}/${faNum(status.lab_nodes)}` },
              { k: 'رویداد در spool', v: faNum(status.events_stored) },
              { k: 'بسته‌ها', v: faNum(status.bundles) },
              { k: 'فایل نمونه', v: faNum(status.sample_files.length) },
              { k: 'خط نمونه', v: faNum(status.sample_files.reduce((a, f) => a + f.lines, 0)) },
            ].map((c) => (
              <div key={c.k} className="rounded-xl bg-ink-900/5 px-3 py-2 dark:bg-white/5">
                <div className="text-base font-extrabold">{c.v}</div>
                <div className="text-[10px] text-ink-500">{c.k}</div>
              </div>
            ))}
          </div>
          {status.sample_files.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {status.sample_files.map((f) => (
                <Badge key={f.name} tone="demo">{f.name} · {faNum(f.lines)} خط · DEMO DATA</Badge>
              ))}
            </div>
          )}
        </Card>
      </FadeIn>

      <div className="space-y-2.5">
        {STEPS.map((s, i) => {
          const r = results[s.key];
          const running = busy === s.key || (busy === 'all' && !r);
          return (
            <FadeIn key={s.key} delay={i * 0.04}>
              <Card className="p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-full bg-brand-500/12 text-xs font-bold text-brand-700 dark:text-brand-300">
                      {i + 1}
                    </span>
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-sm font-bold">
                        {s.label}
                        {r && (
                          <Badge tone={r.ok ? 'green' : 'rose'}>
                            {r.ok ? <Check className="size-3" /> : <X className="size-3" />}
                            {r.ok ? 'انجام شد' : 'رد شد'}
                          </Badge>
                        )}
                        {s.destructive && <Badge tone="amber">توقف نودها</Badge>}
                      </div>
                      <div className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">{s.hint}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r && (
                      <Button variant="ghost" size="sm" onClick={() => setOpen(open === s.key ? null : s.key)}
                        icon={<ChevronDown className={`size-3.5 transition-transform ${open === s.key ? 'rotate-180' : ''}`} />}>
                        نتیجه
                      </Button>
                    )}
                    {s.destructive ? (
                      <Button variant="outline" size="sm" icon={<Square className="size-3.5" />} loading={running}
                        onClick={() => setConfirmStop(true)}>اجرا</Button>
                    ) : (
                      <Button size="sm" icon={<Play className="size-3.5" />} loading={running} onClick={() => runStep(s.key)}>اجرا</Button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {r && open === s.key && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-ink-200/70 dark:border-white/8">
                      <div className="space-y-3 px-4 py-3">
                        <p className="text-xs leading-6 text-ink-700 dark:text-ink-200">{r.detail}</p>
                        {r.metrics.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {r.metrics.map((m) => (
                              <Badge key={m.label} tone="zinc">{m.label}: <span className="font-mono">{m.value}</span></Badge>
                            ))}
                          </div>
                        )}
                        {r.evidence.length > 0 && (
                          <div>
                            <div className="mb-1 text-[10px] font-bold text-ink-500">شواهد</div>
                            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-ink-900/5 p-2 dark:bg-white/5">
                              {r.evidence.map((e, idx) => (
                                <div key={idx} className="font-mono text-[10px] leading-5 text-ink-700 dark:text-ink-300" dir="ltr">
                                  {e}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {r.warnings.length > 0 && (
                          <div className="space-y-1">
                            {r.warnings.map((w, idx) => (
                              <div key={idx} className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                                {w}
                              </div>
                            ))}
                          </div>
                        )}
                        {RESULT_LINKS[s.key] && (
                          <div className="flex flex-wrap gap-2">
                            {RESULT_LINKS[s.key]!.map((l) => (
                              <a key={l.href} href={l.href}
                                className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-500/12 px-3 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-500/30 hover:bg-brand-500/20 dark:text-brand-300">
                                <ExternalLink className="size-3.5" />
                                {l.label}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </FadeIn>
          );
        })}
      </div>

      <Card className="mt-5">
        <div className="flex items-center gap-2">
          <Workflow className="size-4 text-brand-500" />
          <h2 className="text-sm font-bold">اجرا از بیرون برنامه (بدون UI)</h2>
        </div>
        <p className="mt-1 text-[11px] leading-5 text-ink-500 dark:text-ink-400">
          همین آزمایشگاه را می‌توانید با یک نمونهٔ کاملاً جدا از داده‌های توسعه اجرا کنید:
        </p>
        <pre dir="ltr" className="mt-2 overflow-x-auto rounded-xl bg-ink-900/8 p-3 text-[11px] leading-6 dark:bg-white/6">
{`node lab/start-lab.mjs            # http://127.0.0.1:8553 با ./lab/.lab-data
node lab/start-lab.mjs --port=8600
node lab/start-lab.mjs --prod      # بعد از npm run build
node lab/start-lab.mjs --reset     # حذف کامل داده‌های آزمایشگاه`}
        </pre>
        <p className="mt-2 text-[11px] text-ink-500 dark:text-ink-400">
          فایل‌های نمونه در <span className="font-mono" dir="ltr">lab/sample-data/</span> هستند و همه با برچسب DEMO DATA؛
          رازهای این نمونه به‌صورت تصادفی در <span className="font-mono" dir="ltr">lab/.lab-data/lab-secrets.json</span> ساخته می‌شود و لاگ نمی‌شود.
        </p>
      </Card>

      {confirmStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmStop(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-ink-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              <h3 className="text-sm font-bold">تأیید توقف نودها</h3>
            </div>
            <p className="mt-2 text-xs leading-6 text-ink-600 dark:text-ink-300">
              این عمل همهٔ نودهای روشن را متوقف و پورت‌های ۱۲۷.۰.۰.۱ را آزاد می‌کند. کانف‌ها، spool رویدادها و لاگ‌ها
              حذف نمی‌شوند — فقط اجرا قطع می‌شود. برای پاک‌کردن فایلی باید خودتان
              <span className="font-mono" dir="ltr"> --reset</span> را اجرا کنید.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmStop(false)}>انصراف</Button>
              <Button variant="danger" size="sm" loading={busy === 'stop-nodes'} onClick={async () => {
                setConfirmStop(false);
                await runStep('stop-nodes');
              }}>توقف نودها</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
