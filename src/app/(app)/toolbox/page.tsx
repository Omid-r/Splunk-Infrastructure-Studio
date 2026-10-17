'use client';

import * as React from 'react';
import { api } from '@/lib/api';
import { PageHeader, Card, Button, Badge, Input, Spinner, FadeIn, EmptyState } from '@/components/ui';
import { useToast } from '@/components/toast';
import { Terminal, Play, History } from 'lucide-react';
import type { ToolboxRun } from '@/lib/types';

const TOOL_META: Record<ToolboxRun['tool'], { label: string; target: string; needsTarget: boolean; needsPort?: boolean }> = {
  ping: { label: 'پینگ (ICMP)', target: 'IP یا نام میزبان', needsTarget: true },
  traceroute: { label: 'تریس‌روت (tracert)', target: 'IP یا نام میزبان', needsTarget: true },
  dns: { label: 'حل DNS', target: 'نام میزبان', needsTarget: true },
  tcp: { label: 'پروب TCP پورت', target: 'IP یا نام میزبان', needsTarget: true, needsPort: true },
  http: { label: 'بررسی HTTP(S)', target: 'آدرس کامل http(s)://...', needsTarget: true },
  ports: { label: 'پورت‌های گوش‌دهنده محلی', target: '', needsTarget: false },
  interfaces: { label: 'اینترفیس‌های شبکه', target: '', needsTarget: false },
};

export default function ToolboxPage() {
  const toast = useToast();
  const [tool, setTool] = React.useState<ToolboxRun['tool']>('ping');
  const [target, setTarget] = React.useState('127.0.0.1');
  const [port, setPort] = React.useState('9997');
  const [runs, setRuns] = React.useState<ToolboxRun[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [last, setLast] = React.useState<ToolboxRun | null>(null);

  const reload = React.useCallback(() => {
    api<{ runs: ToolboxRun[] }>('/api/toolbox').then((d) => setRuns(d.runs)).catch(() => setRuns([]));
  }, []);

  React.useEffect(() => { reload(); }, [reload]);

  const meta = TOOL_META[tool];

  const execute = async () => {
    setBusy(true);
    try {
      const d = await api<{ run: ToolboxRun }>('/api/toolbox', {
        method: 'POST',
        body: JSON.stringify({ tool, target, ...(meta.needsPort ? { port: Number(port) } : {}) }),
      });
      setLast(d.run);
      setRuns((r) => [d.run, ...(r ?? [])].slice(0, 25));
      if (!d.run.ok) toast.push({ tone: 'warning', title: 'پاسخ ناموفق', message: d.run.summary });
    } catch (e) {
      toast.push({ tone: 'danger', title: 'رد یا خطا', message: e instanceof Error ? e.message : 'خطا' });
    } finally { setBusy(false); }
  };

  if (!runs) return <div className="flex items-center justify-center py-32"><Spinner /></div>;

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Terminal className="size-6 text-brand-500" />
            جعبه‌ابزار شبکه
          </span>
        }
        subtitle="ابزارهای شبکه با فرمان ثابت (بدون shell) و مهلت زمانی. مقصودهای غیرمحلی باید در allowlist محیط باشند؛ هر فراخوانی در حسابرسی ثبت می‌شود."
      />

      <FadeIn>
        <Card className="mb-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-44">
              <div className="mb-1 text-xs text-ink-500">ابزار</div>
              <select
                value={tool}
                onChange={(e) => setTool(e.target.value as ToolboxRun['tool'])}
                className="focus-ring h-10 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm dark:border-white/10 dark:bg-ink-900"
              >
                {(Object.keys(TOOL_META) as ToolboxRun['tool'][]).map((t) => (
                  <option key={t} value={t}>{TOOL_META[t].label}</option>
                ))}
              </select>
            </div>
            {meta.needsTarget && (
              <div className="min-w-56 flex-1">
                <div className="mb-1 text-xs text-ink-500">مقصود</div>
                <Input dir="ltr" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={meta.target} onKeyDown={(e) => e.key === 'Enter' && execute()} />
              </div>
            )}
            {meta.needsPort && (
              <div className="w-28">
                <div className="mb-1 text-xs text-ink-500">پورت</div>
                <Input dir="ltr" value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))} />
              </div>
            )}
            <Button icon={<Play className="size-4" />} loading={busy} onClick={execute}>اجرا</Button>
          </div>
          {tool === 'traceroute' && <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">تریس‌روت می‌تواند تا ۴۵ ثانیه طول بکشد.</div>}

          {last && (
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={last.ok ? 'green' : 'rose'}>{last.ok ? 'موفق' : 'ناموفق'}</Badge>
                <span className="font-semibold">{last.summary}</span>
                <span className="text-xs text-ink-500" dir="ltr">{last.target}</span>
              </div>
              {last.detail && (
                <pre dir="ltr" className="max-h-72 overflow-auto rounded-xl bg-ink-950 p-3 font-mono text-[11px] leading-5 text-ink-200">{last.detail}</pre>
              )}
            </div>
          )}
        </Card>
      </FadeIn>

      <div className="mb-2 flex items-center gap-2 text-sm font-bold"><History className="size-4 text-brand-500" /> آخرین اجراها</div>
      {runs.length === 0 ? (
        <EmptyState title="هنوز اجرایی ثبت نشده است" hint="یک ابزار را اجرا کنید تا سابقهٔ آن (با ثبت در حسابرسی) اینجا نمایش داده شود." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200/60 dark:border-white/8">
          <table className="w-full min-w-[720px] text-right text-xs">
            <thead className="bg-white/60 text-ink-500 backdrop-blur dark:bg-ink-900/60">
              <tr>
                <th className="px-3 py-2 font-semibold">زمان</th>
                <th className="px-3 py-2 font-semibold">ابزار</th>
                <th className="px-3 py-2 font-semibold">مقصود</th>
                <th className="px-3 py-2 font-semibold">نتیجه</th>
                <th className="px-3 py-2 font-semibold">کاربر</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="cursor-pointer border-t border-ink-200/40 hover:bg-ink-900/5 dark:border-white/6 dark:hover:bg-white/5" onClick={() => setLast(r)}>
                  <td className="whitespace-nowrap px-3 py-2 text-ink-500">{new Date(r.created_at).toLocaleString('fa-IR')}</td>
                  <td className="px-3 py-2">{TOOL_META[r.tool]?.label ?? r.tool}</td>
                  <td className="px-3 py-2 font-mono text-[11px]" dir="ltr">{r.target}</td>
                  <td className="px-3 py-2"><Badge tone={r.ok ? 'green' : 'rose'}>{r.ok ? 'موفق' : 'ناموفق'}</Badge> <span className="text-ink-500">{r.summary}</span></td>
                  <td className="px-3 py-2">{r.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
