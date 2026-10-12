'use client';

import * as React from 'react';
import { api } from '@/lib/api';
import {
  PageHeader, Card, Button, Badge, Spinner, FadeIn, EmptyState, Input,
} from '@/components/ui';
import { useToast } from '@/components/toast';
import { ShieldCheck, ShieldAlert, Link2 } from 'lucide-react';
import type { AuditEvent } from '@/lib/types';

export default function AuditPage() {
  const toast = useToast();
  const [data, setData] = React.useState<{ events: AuditEvent[]; total: number; page: number; page_size: number } | null>(null);
  const [chain, setChain] = React.useState<{ ok: boolean; broken_at: string | null } | null>(null);
  const [verifyBusy, setVerifyBusy] = React.useState(false);
  const [actor, setActor] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), page_size: '30' });
      if (actor) q.set('actor', actor);
      setData(await api(`/api/audit?${q}`));
    } catch { /* noop */ } finally { setLoading(false); }
  }, [page, actor]);
  React.useEffect(() => { load(); }, [load]);

  const verify = async () => {
    setVerifyBusy(true);
    try { setChain(await api('/api/audit/verify')); }
    catch (e) { toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : 'خطا' }); }
    finally { setVerifyBusy(false); }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="لاگ ممیزی"
        subtitle="ثبت append-only با زنجیره هش — هر رویداد با هش رویداد قبلی مهروموم می‌شود"
        actions={
          <div className="flex items-center gap-2">
            <Input value={actor} onChange={(e) => { setActor(e.target.value); setPage(1); }} placeholder="فیلتر actor…" className="w-44" />
            <Button variant="outline" size="sm" onClick={verify} loading={verifyBusy}>
              <Link2 className="h-3.5 w-3.5" /> بررسی یکپارچگی زنجیره
            </Button>
          </div>
        }
      />

      {chain && (
        <FadeIn>
          <div className={`glass flex items-center gap-3 rounded-xl border p-4 text-sm ${chain.ok ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-200' : 'border-red-400/30 bg-red-400/5 text-red-200'}`}>
            {chain.ok ? <ShieldCheck className="h-5 w-5 shrink-0" /> : <ShieldAlert className="h-5 w-5 shrink-0" />}
            {chain.ok
              ? 'زنجیره هش سالم است — هیچ دست‌کاری‌ای در لاگ ممیزی تشخیص داده نشد.'
              : `زنجیره خراب است — رویداد ${chain.broken_at ?? ''} با هش قبلی هم‌خوانی ندارد؛ احتمال دست‌کاری!`}
          </div>
        </FadeIn>
      )}

      <Card>
        {loading ? <div className="flex justify-center py-16"><Spinner /></div> : !data || data.events.length === 0 ? (
          <EmptyState title="رویدادی ثبت نشده" hint="رویدادهای ممیزی اینجا نمایش داده می‌شوند" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-zinc-800 text-right text-xs text-zinc-500">
                <th className="px-3 py-2 font-medium">#</th><th className="px-3 py-2 font-medium">زمان</th>
                <th className="px-3 py-2 font-medium">Actor</th><th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Target</th><th className="px-3 py-2 font-medium">نتیجه</th>
              </tr></thead>
              <tbody>
                {data.events.map((e) => (
                  <tr key={e.id} className="border-b border-zinc-800/50 text-zinc-300 transition hover:bg-zinc-800/30">
                    <td className="px-3 py-2 font-mono text-xs text-zinc-500">{e.id.slice(-8)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs" dir="ltr">{e.created_at}</td>
                    <td className="px-3 py-2 text-xs">{e.actor}</td>
                    <td className="px-3 py-2"><code className="text-[11px] text-emerald-200/80">{e.action}</code></td>
                    <td className="max-w-56 truncate px-3 py-2 text-xs text-zinc-400" title={e.target ?? ''}>{e.target ?? '—'}</td>
                    <td className="px-3 py-2"><Badge tone={e.outcome === 'success' ? 'green' : e.outcome === 'denied' ? 'amber' : e.outcome === 'failure' || e.outcome === 'failed' ? 'rose' : 'zinc'}>{e.outcome}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-zinc-800 pt-4">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>قبلی</Button>
            <span className="text-xs text-zinc-500">{page} / {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>بعدی</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
