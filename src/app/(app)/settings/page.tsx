'use client';

import * as React from 'react';
import { api } from '@/lib/api';
import {
  PageHeader, Card, Button, Badge, Input, Spinner, FadeIn,
} from '@/components/ui';
import { useToast } from '@/components/toast';
import { Plus, X, Save, Globe2, ListChecks, Server, Info } from 'lucide-react';
import type { Workspace } from '@/lib/types';

type SettingsPayload = {
  workspace: Workspace;
  scopes: { ranges: string[]; exclusions: string[] };
  app: { port: string; host: string; audit_retention_days: number; scan_max_hosts: number; tls_in_dev: string };
  settings: Record<string, string>;
};

export default function SettingsPage() {
  const toast = useToast();
  const [data, setData] = React.useState<SettingsPayload | null>(null);
  const [name, setName] = React.useState('');
  const [ranges, setRanges] = React.useState<string[]>([]);
  const [exclusions, setExclusions] = React.useState<string[]>([]);
  const [newRange, setNewRange] = React.useState('');
  const [newExcl, setNewExcl] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    api<SettingsPayload>('/api/settings').then((d) => {
      setData(d); setName(d.workspace.name);
      setRanges(d.scopes.ranges); setExclusions(d.scopes.exclusions);
    }).catch(() => {});
  }, []);

  const saveWorkspace = async () => {
    if (name.trim().length < 2) { toast.push({ tone: 'warning', title: 'نام نامعتبر', message: 'نام محیط باید حداقل ۲ کاراکتر باشد' }); return; }
    setBusy('ws');
    try { await api('/api/settings', { method: 'POST', body: JSON.stringify({ workspaceName: name.trim() }) }); toast.push({ tone: 'success', title: 'ذخیره شد', message: 'نام محیط به‌روزرسانی شد' }); }
    catch (e) { toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : 'خطا' }); }
    finally { setBusy(null); }
  };

  const saveScopes = async () => {
    setBusy('scopes');
    try {
      const res = await api<{ error?: string }>('/api/settings', { method: 'POST', body: JSON.stringify({ scopes: ranges, exclusions }) });
      if (res.error === 'SCOPE_VIOLATION') toast.push({ tone: 'danger', title: 'رد شد', message: 'محدوده /0 مجاز نیست — اسکن اینترنت عمومی مسدود است' });
      else toast.push({ tone: 'success', title: 'ذخیره شد', message: 'محدوده‌های مجاز به‌روزرسانی شدند' });
    } catch (e) { toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : 'خطا' }); }
    finally { setBusy(null); }
  };

  if (!data) return <div className="flex items-center justify-center py-32"><Spinner /></div>;

  const addTo = (list: string[], setList: (v: string[]) => void, value: string, setValue: (v: string) => void) => {
    const v = value.trim();
    if (!v) return;
    if (list.includes(v)) { toast.push({ tone: 'warning', title: 'تکراری', message: 'این مورد از قبل وجود دارد' }); return; }
    setList([...list, v]); setValue('');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="تنظیمات" subtitle="پیکربندی محیط، محدوده‌های مجاز اسکن و اطلاعات برنامه" />

      <div className="grid gap-4 lg:grid-cols-2">
        <FadeIn>
          <Card>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-200"><Globe2 className="h-4 w-4 text-emerald-300" /> مشخصات محیط</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-zinc-900/60 p-3"><div className="text-xs text-zinc-500">سایت</div><div className="mt-1 text-zinc-200">{data.workspace.site}</div></div>
                <div className="rounded-lg bg-zinc-900/60 p-3"><div className="text-xs text-zinc-500">منطقه زمانی</div><div className="mt-1 text-zinc-200">{data.workspace.timezone}</div></div>
                <div className="rounded-lg bg-zinc-900/60 p-3"><div className="text-xs text-zinc-500">مالک</div><div className="mt-1 text-zinc-200">{data.workspace.owner}</div></div>
                <div className="rounded-lg bg-zinc-900/60 p-3"><div className="text-xs text-zinc-500">ایجاد</div><div className="mt-1 text-zinc-200" dir="ltr">{data.workspace.created_at.slice(0, 10)}</div></div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">نام محیط</label>
                <div className="flex gap-2">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                  <Button size="sm" loading={busy === 'ws'} onClick={saveWorkspace}><Save className="h-3.5 w-3.5" /> ذخیره</Button>
                </div>
              </div>
            </div>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Card>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-200"><Server className="h-4 w-4 text-emerald-300" /> اطلاعات برنامه</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-zinc-900/60 p-3"><div className="text-xs text-zinc-500">پورت سرویس</div><div className="mt-1 font-mono text-emerald-200" dir="ltr">{data.app.host}:{data.app.port}</div></div>
                <div className="rounded-lg bg-zinc-900/60 p-3"><div className="text-xs text-zinc-500">سقف host در اسکن</div><div className="mt-1 font-mono text-zinc-200" dir="ltr">{data.app.scan_max_hosts}</div></div>
                <div className="rounded-lg bg-zinc-900/60 p-3"><div className="text-xs text-zinc-500">نگهداری لاگ ممیزی</div><div className="mt-1 text-zinc-200">{data.app.audit_retention_days} روز</div></div>
                <div className="rounded-lg bg-zinc-900/60 p-3"><div className="text-xs text-zinc-500">TLS در توسعه</div><div className="mt-1 text-xs text-zinc-300">{data.app.tls_in_dev}</div></div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-sky-400/20 bg-sky-400/5 p-3 text-xs text-sky-200/80">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                برای محیط واقعی، HTTPS/TLS از طریق reverse proxy معتبر (مثل nginx یا Caddy) الزامی است. self-signed فقط برای آزمایش و با هشدار قابل قبول است.
              </div>
            </div>
          </Card>
        </FadeIn>
      </div>

      <FadeIn delay={0.1}>
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-200"><ListChecks className="h-4 w-4 text-emerald-300" /> محدوده‌های مجاز اسکن (allowlist)</div>
              <Button size="sm" loading={busy === 'scopes'} onClick={saveScopes}><Save className="h-3.5 w-3.5" /> ذخیره محدوده‌ها</Button>
            </div>
            <p className="text-xs leading-relaxed text-zinc-500">backend هر درخواست اسکن را مستقل از UI در برابر این فهرست اعتبارسنجی می‌کند. /0 و اسکن اینترنت عمومی همیشه رد می‌شود.</p>
            <div className="space-y-2">
              {ranges.map((r) => (
                <div key={r} className="flex items-center justify-between rounded-lg bg-zinc-900/60 px-3 py-2">
                  <code className="text-sm text-emerald-200/90" dir="ltr">{r}</code>
                  <button onClick={() => setRanges(ranges.filter((x) => x !== r))} className="rounded p-1 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300" aria-label={`حذف ${r}`}><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={newRange} onChange={(e) => setNewRange(e.target.value)} placeholder="مثال: 192.168.1.0/24" dir="ltr" className="font-mono" />
                <Button variant="outline" size="sm" onClick={() => addTo(ranges, setRanges, newRange, setNewRange)}><Plus className="h-3.5 w-3.5" /> افزودن</Button>
              </div>
            </div>

            <div className="space-y-2 border-t border-zinc-800 pt-4">
              <div className="text-sm font-medium text-zinc-200">محرومیت‌ها (exclude)</div>
              <p className="text-xs text-zinc-500">شبکه‌های حساس، printer/OT یا موارد خارج از scope — حتی داخل allowlist هم اسکن نمی‌شوند.</p>
              {exclusions.map((r) => (
                <div key={r} className="flex items-center justify-between rounded-lg bg-amber-400/5 px-3 py-2 ring-1 ring-amber-400/20">
                  <code className="text-sm text-amber-200/90" dir="ltr">{r}</code>
                  <button onClick={() => setExclusions(exclusions.filter((x) => x !== r))} className="rounded p-1 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300" aria-label={`حذف ${r}`}><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={newExcl} onChange={(e) => setNewExcl(e.target.value)} placeholder="مثال: 192.168.1.10/32" dir="ltr" className="font-mono" />
                <Button variant="outline" size="sm" onClick={() => addTo(exclusions, setExclusions, newExcl, setNewExcl)}><Plus className="h-3.5 w-3.5" /> افزودن</Button>
              </div>
            </div>
          </div>
        </Card>
      </FadeIn>
    </div>
  );
}
