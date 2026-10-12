'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { GitBranch, ShieldCheck, Radar, Lock, CheckCircle2 } from 'lucide-react';
import { Button, Input, Card, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import type { User, Workspace } from '@/lib/types';

const STEPS = [
  { n: '۱', title: 'حساب مدیر', desc: 'ساخت اولین حساب administrator' },
  { n: '۲', title: 'Workspace', desc: 'نام محیط کاری' },
  { n: '۳', title: 'محدوده مجاز', desc: 'CIDRهای قابل اسکن' },
  { n: '۴', title: 'بازبینی', desc: 'تأیید و شروع' },
];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: 'admin', password: '', confirm: '', displayName: '', workspaceName: 'محیط تولید', scopes: '192.168.1.0/24' });

  useEffect(() => {
    api<{ needsSetup: boolean }>('/api/setup').then((r) => {
      if (!r.needsSetup) router.replace('/login');
    }).catch(() => {});
  }, [router]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const canNext = () => {
    if (step === 0) return form.username.length >= 3 && form.password.length >= 10 && form.password === form.confirm && form.displayName.length >= 2;
    if (step === 1) return form.workspaceName.length >= 2;
    if (step === 2) return form.scopes.trim().length > 0;
    return true;
  };

  const finish = async () => {
    setLoading(true);
    setError('');
    try {
      await api<{ user: User; workspace: Workspace }>('/api/setup', {
        method: 'POST',
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          displayName: form.displayName,
          workspaceName: form.workspaceName,
          scopes: form.scopes.split(/[\s،,]+/).filter(Boolean),
        }),
      });
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="mesh-bg flex min-h-screen items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-500 text-white shadow-2xl shadow-brand-600/30">
            <GitBranch className="size-8" />
          </div>
          <h1 className="text-2xl font-extrabold">راه‌اندازی اولیه پلتفرم</h1>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">چهار گام تا شروع کار امن</p>
        </div>

        <div className="mb-6 flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${i <= step ? 'bg-brand-500/15 text-brand-700 ring-1 ring-brand-500/40 dark:text-brand-300' : 'bg-ink-900/5 text-ink-400 dark:bg-white/5 dark:text-ink-500'}`}>
                <span className="flex size-5 items-center justify-center rounded-full bg-brand-500 text-[10px] text-white">{s.n}</span>
                {s.title}
              </div>
              {i < STEPS.length - 1 && <div className="h-px w-6 bg-ink-300 dark:bg-white/10" />}
            </div>
          ))}
        </div>

        <Card className="p-6">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">ساخت حساب مدیر ارشد</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-ink-500">نام کاربری</label>
                  <Input value={form.username} onChange={set('username')} dir="ltr" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-ink-500">نام نمایشی</label>
                  <Input value={form.displayName} onChange={set('displayName')} placeholder="مثلاً: امید رحیم‌زاده" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-ink-500">رمز عبور (حداقل ۱۰ کاراکتر)</label>
                  <Input type="password" value={form.password} onChange={set('password')} dir="ltr" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-ink-500">تکرار رمز عبور</label>
                  <Input type="password" value={form.confirm} onChange={set('confirm')} dir="ltr" />
                  {form.confirm && form.password !== form.confirm && (
                    <p className="mt-1 text-[11px] text-rose-500">رمزها یکسان نیستند</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">تعریف Workspace</h2>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-ink-500">نام محیط</label>
                <Input value={form.workspaceName} onChange={set('workspaceName')} />
              </div>
              <div className="rounded-xl bg-ink-900/5 p-3 text-xs leading-6 text-ink-500 dark:bg-white/5 dark:text-ink-400">
                هر Workspace یک محدوده مجاز کشف (scope) دارد. اسکن هرگز خارج از این محدوده انجام نمی‌شود — حتی با فراخوانی مستقیم API.
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">محدوده مجاز کشف (Allowlist)</h2>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-ink-500">CIDR یا IPهای مجاز (با فاصله یا ویرگول جدا کنید)</label>
                <Input value={form.scopes} onChange={set('scopes')} dir="ltr" placeholder="192.168.1.0/24 10.0.0.0/26" />
              </div>
              <div className="flex flex-wrap gap-2">
                {form.scopes.split(/[\s،,]+/).filter(Boolean).map((s) => (
                  <Badge key={s} tone="brand" className="dir-ltr">{s}</Badge>
                ))}
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs leading-6 text-amber-700 dark:text-amber-300">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                پیش‌فرض هرگز 0.0.0.0/0 نیست و اسکن اینترنت عمومی رد می‌شود. پوشش CIDR بیش از /8 پذیرفته نمی‌شود.
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">بازبینی نهایی</h2>
              <div className="space-y-2 rounded-xl border border-ink-200 p-4 text-sm dark:border-white/10">
                {[
                  ['مدیر', `${form.displayName} (${form.username})`],
                  ['محیط', form.workspaceName],
                  ['محدوده مجاز', form.scopes],
                  ['پورت سرویس', '8443 (قابل تغییر با APP_PORT)'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <span className="text-ink-400">{k}</span>
                    <span className="font-semibold">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-brand-500/10 p-3 text-xs leading-6 text-brand-700 dark:text-brand-300">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                با شروع کار، تنظیمات TLS، retention لاگ audit و بررسی اتصال worker از صفحه تنظیمات قابل مدیریت است.
              </div>
            </div>
          )}

          {error && <div className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">{error}</div>}

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || loading}>قبلی</Button>
            {step < 3 ? (
              <Button onClick={() => canNext() && setStep((s) => s + 1)} disabled={!canNext()} icon={<Radar className="size-4" />}>بعدی</Button>
            ) : (
              <Button onClick={finish} loading={loading} icon={<Lock className="size-4" />}>شروع کار امن</Button>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
