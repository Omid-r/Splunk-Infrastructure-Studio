'use client';

import * as React from 'react';
import { api } from '@/lib/api';
import { PageHeader, Card, Button, Badge, Spinner, FadeIn, EmptyState, Modal } from '@/components/ui';
import { useToast } from '@/components/toast';
import { Stethoscope, Wrench, RefreshCw, History } from 'lucide-react';
import type { DiagnosticItem, DiagnosticRun, Role } from '@/lib/types';

const OPERATOR_ROLES: Role[] = ['splunk_admin', 'infra_admin', 'admin'];
const DESTRUCTIVE: DiagnosticItem['fixKind'][] = ['restart-node', 'enable-splunktcp', 'start-target-node'];

const CHECK_LABEL: Record<string, string> = {
  'start-node': 'شروع نود',
  'restart-node': 'ری‌استارت نود',
  'enable-splunktcp': 'فعال‌سازی splunktcp در inputs.conf',
  'start-target-node': 'شروع نود هدف',
  'create-spool-dir': 'ساخت دایرکتوری spool',
};

export default function DiagnosticsPage() {
  const toast = useToast();
  const [role, setRole] = React.useState<Role | null>(null);
  const [run, setRun] = React.useState<DiagnosticRun | null>(null);
  const [history, setHistory] = React.useState<DiagnosticRun[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirmFix, setConfirmFix] = React.useState<DiagnosticItem | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);

  React.useEffect(() => {
    api<{ user: { role: Role } | null }>('/api/auth/me').then((d) => setRole(d.user?.role ?? null)).catch(() => {});
    api<{ runs: DiagnosticRun[] }>('/api/diagnostics').then((d) => setHistory(d.runs)).catch(() => {});
  }, []);

  const canOperate = role !== null && OPERATOR_ROLES.includes(role);

  const execute = async () => {
    setBusy('run');
    try {
      const d = await api<{ run: DiagnosticRun }>('/api/diagnostics', { method: 'POST' });
      setRun(d.run);
      setHistory((h) => [d.run, ...h].slice(0, 20));
      const fails = d.run.items.filter((i) => i.status === 'fail').length;
      toast.push({ tone: fails === 0 ? 'success' : 'warning', title: 'عیب‌یاری کامل شد', message: d.run.summary });
    } catch (e) {
      toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : 'خطا' });
    } finally { setBusy(null); }
  };

  const fix = async (item: DiagnosticItem) => {
    if (!item.nodeId || !item.fixKind) return;
    setBusy(item.id);
    try {
      const d = await api<{ result: { ok: boolean; message: string } }>('/api/diagnostics/fix', {
        method: 'POST',
        body: JSON.stringify({ nodeId: item.nodeId, fixKind: item.fixKind, fixTarget: item.fixTarget }),
      });
      toast.push({ tone: d.result.ok ? 'success' : 'danger', title: d.result.ok ? 'رفع انجام شد' : 'رفع ناموفق', message: d.result.message });
      if (d.result.ok) {
        setConfirmFix(null);
        await execute();
      }
    } catch (e) {
      toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : 'خطا' });
    } finally { setBusy(null); }
  };

  const requestFix = (item: DiagnosticItem) => {
    if (item.fixKind && DESTRUCTIVE.includes(item.fixKind)) setConfirmFix(item);
    else fix(item);
  };

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Stethoscope className="size-6 text-brand-500" />
            عیب‌یاری و ترمیم آزمایشگاه
          </span>
        }
        subtitle="بررسی‌های واقعی روی نودهای زنده: رسایی TCP، صحت conf، مسیر فوروارد، نوشتن در spool و اینگست سرتاسری. رفع‌ها با پشتیبان‌گیری و حسابرسی انجام می‌شوند."
        actions={
          <>
            <Button variant="outline" icon={<History className="size-4" />} onClick={() => setShowHistory(true)}>تاریخچه</Button>
            <Button icon={<RefreshCw className="size-4" />} loading={busy === 'run'} disabled={!canOperate} onClick={execute}>اجرای عیب‌یاری کامل</Button>
          </>
        }
      />

      {!canOperate && (
        <div className="mb-4 rounded-xl bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          عیب‌یاری فقط برای نقش‌های مدیریتی (splunk_admin / infra_admin / admin) فعال است؛ نتیجه‌های اجراهای قبلی در تاریخچه قابل مشاهده‌اند.
        </div>
      )}

      {!run ? (
        <EmptyState
          title="هنوز عیب‌یاری اجرا نشده است"
          hint="با دکمهٔ «اجرای عیب‌یاری کامل» همهٔ بررسی‌ها روی نودهای محیط آزمایشگاهی اجرا می‌شود — فقط نودهای متوقف یا دارای مشکل واقعی گزارش می‌شوند."
          action={canOperate ? <Button loading={busy === 'run'} onClick={execute}>اجرای عیب‌یاری کامل</Button> : undefined}
        />
      ) : (
        <FadeIn>
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold">{run.summary}</div>
              <div className="text-xs text-ink-500">{new Date(run.created_at).toLocaleString('fa-IR')} — by {run.created_by}</div>
            </div>
            <div className="space-y-1.5">
              {run.items.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-200/50 px-3 py-2 text-xs dark:border-white/8">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={i.status === 'pass' ? 'green' : i.status === 'warn' ? 'amber' : 'rose'}>
                      {i.status === 'pass' ? 'موفق' : i.status === 'warn' ? 'هشدار' : 'ناموفق'}
                    </Badge>
                    {i.node && <span className="font-mono text-[11px] text-ink-500">{i.node}</span>}
                    <span className="font-semibold">{i.check}</span>
                    <span className="max-w-[640px] leading-5 text-ink-600 dark:text-ink-300">{i.detail}</span>
                  </div>
                  {i.fixKind && canOperate && (
                    <Button size="sm" variant="outline" icon={<Wrench className="size-3" />} loading={busy === i.id} onClick={() => requestFix(i)}>
                      {CHECK_LABEL[i.fixKind] ?? 'رفع'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </FadeIn>
      )}

      <Modal open={showHistory} onClose={() => setShowHistory(false)} title="تاریخچهٔ عیب‌یاری" wide>
        {history.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-500">هنوز اجرایی ثبت نشده است.</div>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <button
                key={h.id}
                className="focus-ring w-full rounded-xl border border-ink-200/60 px-3 py-2 text-right text-xs hover:bg-ink-900/5 dark:border-white/8 dark:hover:bg-white/5"
                onClick={() => { setRun(h); setShowHistory(false); }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{h.summary}</span>
                  <span className="text-[10px] text-ink-400">{new Date(h.created_at).toLocaleString('fa-IR')}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={confirmFix !== null} onClose={() => setConfirmFix(null)} title="تأیید عملیات تغییردهنده">
        {confirmFix && (
          <div className="space-y-4 text-sm">
            <div>
              این رفع وضعیت نود را تغییر می‌دهد{confirmFix.fixKind === 'enable-splunktcp' ? ' و فایل inputs.conf را بازنویسی می‌کند (بکاپ .bak گرفته می‌شود)' : ''}:
            </div>
            <div className="rounded-xl bg-ink-900/5 p-3 text-xs leading-6 dark:bg-white/5">
              <div><b>نود:</b> {confirmFix.node}</div>
              <div><b>بررسی:</b> {confirmFix.check}</div>
              <div><b>اقدام:</b> {CHECK_LABEL[confirmFix.fixKind ?? ''] ?? confirmFix.fixKind}</div>
              {confirmFix.fixTarget && <div><b>هدف:</b> {confirmFix.fixTarget}</div>}
            </div>
            <div className="text-[11px] text-ink-500">عملیات در فهرست حسابرسی با نام کاربری شما ثبت می‌شود.</div>
            <div className="flex gap-2">
              <Button variant="danger" loading={busy === confirmFix.id} onClick={() => fix(confirmFix)}>تأیید و اجرا</Button>
              <Button variant="ghost" onClick={() => setConfirmFix(null)}>انصراف</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
