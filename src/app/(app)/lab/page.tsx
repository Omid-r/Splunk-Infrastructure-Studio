'use client';

import * as React from 'react';
import { api } from '@/lib/api';
import { PageHeader, Card, Button, Badge, Input, Spinner, FadeIn, EmptyState, Modal } from '@/components/ui';
import { useToast } from '@/components/toast';
import { Boxes, Play, Square, RotateCcw, FileCog, ScrollText, Send, Search, FlaskConical, Terminal } from 'lucide-react';
import type { LabNode, LabSearchResult, Role, ValidationItem } from '@/lib/types';

const OPERATOR_ROLES: Role[] = ['splunk_admin', 'infra_admin', 'admin'];

export default function LabPage() {
  const toast = useToast();
  const [nodes, setNodes] = React.useState<LabNode[] | null>(null);
  const [role, setRole] = React.useState<Role | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [provisionNote, setProvisionNote] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<Record<string, ValidationItem>>({});

  const [confNode, setConfNode] = React.useState<LabNode | null>(null);
  const [logNode, setLogNode] = React.useState<LabNode | null>(null);

  React.useEffect(() => {
    api<{ user: { role: Role } | null }>('/api/auth/me').then((d) => setRole(d.user?.role ?? null)).catch(() => {});
  }, []);

  const reload = React.useCallback(() => {
    api<{ nodes: LabNode[] }>('/api/lab/nodes').then((d) => setNodes(d.nodes)).catch((e) => {
      toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : 'خطا' });
      setNodes([]);
    });
  }, [toast]);

  React.useEffect(() => { reload(); }, [reload]);

  // live counters refresh while any node runs
  React.useEffect(() => {
    if (!nodes?.some((n) => n.status === 'running')) return;
    const t = setInterval(reload, 4000);
    return () => clearInterval(t);
  }, [nodes, reload]);

  const canOperate = role && OPERATOR_ROLES.includes(role);

  const provision = async () => {
    setBusy('provision');
    try {
      const d = await api<{ created: number; nodes: LabNode[]; note: string }>('/api/lab/nodes', { method: 'POST' });
      setNodes(d.nodes);
      setProvisionNote(d.note);
      toast.push({ tone: 'success', title: 'نودهای آزمایشگاهی', message: d.note });
    } catch (e) {
      toast.push({ tone: 'danger', title: 'ساخت نودها ناموفق بود', message: e instanceof Error ? e.message : 'خطا' });
    } finally { setBusy(null); }
  };

  const control = async (node: LabNode, action: 'start' | 'stop' | 'restart') => {
    setBusy(`${node.id}:${action}`);
    try {
      const d = await api<{ node: LabNode }>(`/api/lab/nodes/${node.id}`, { method: 'POST', body: JSON.stringify({ action }) });
      setNodes((prev) => (prev ?? []).map((n) => (n.id === d.node.id ? d.node : n)));
      toast.push({
        tone: 'success',
        title: action === 'start' ? 'نود شروع شد' : action === 'stop' ? 'نود متوقف شد' : 'نود ری‌استارت شد',
        message: action === 'start' || action === 'restart'
          ? `${d.node.name}: ingest 127.0.0.1:${d.node.ingest_port} — mgmt 127.0.0.1:${d.node.mgmt_port}`
          : `${d.node.name} خارج شد`,
      });
    } catch (e) {
      toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : 'خطا' });
    } finally { setBusy(null); }
  };

  const ingestTest = async (node: LabNode) => {
    setBusy(`${node.id}:test`);
    try {
      const d = await api<{ result: ValidationItem }>(`/api/lab/nodes/${node.id}`, { method: 'POST', body: JSON.stringify({ action: 'ingest-test' }) });
      setResults((prev) => ({ ...prev, [node.id]: d.result }));
      toast.push({ tone: d.result.status === 'pass' ? 'success' : d.result.status === 'fail' ? 'danger' : 'warning', title: `نتیجه: ${d.result.status === 'pass' ? 'موفق' : d.result.status === 'fail' ? 'ناموفق' : 'هشدار'}`, message: d.result.detail });
      reload();
    } catch (e) {
      toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : 'خطا' });
    } finally { setBusy(null); }
  };

  if (!nodes) return <div className="flex items-center justify-center py-32"><Spinner /></div>;

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <FlaskConical className="size-6 text-brand-500" />
            آزمایشگاه زنده (Lab Runtime)
          </span>
        }
        subtitle="نودهای شبیه‌ساز واقعی روی همین ماشین: گیرنده TCP، سرویس مدیریت HTTP، conf زنده، فوروارد و جستجوی توزیع‌شده. این یک sandbox آزمایشگاهی است، نه Splunk Enterprise."
        actions={
          <>
            <Button variant="outline" onClick={reload}>بازخوانی</Button>
            {canOperate && <Button icon={<Boxes className="size-4" />} loading={busy === 'provision'} onClick={provision}>ساخت نودها از مانیفست استقرار</Button>}
          </>
        }
      />

      {provisionNote && <div className="mb-4 rounded-xl bg-brand-500/10 px-4 py-2 text-xs text-brand-700 dark:text-brand-300">{provisionNote}</div>}

      {nodes.length === 0 ? (
        <EmptyState
          title="هنوز نود آزمایشگاهی ساخته نشده است"
          hint="ابتدا از صفحه «استقرار و اعتبارسنجی» یک Local Lab مستقر کنید (مانیفست نودها ساخته می‌شود)، سپس با دکمه بالا نودهای زنده را بسازید."
          action={canOperate ? <Button loading={busy === 'provision'} onClick={provision}>ساخت نودها</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {nodes.map((n, i) => (
            <FadeIn key={n.id} delay={i * 0.05}>
              <Card className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold">{n.name}</span>
                      <Badge tone={n.status === 'running' ? 'green' : 'zinc'}>{n.status === 'running' ? 'در حال اجرا' : 'متوقف'}</Badge>
                      {n.mode && <Badge tone={n.mode === 'store' ? 'cyan' : 'amber'}>{n.mode === 'store' ? 'ایندکسر (ذخیره)' : 'فوروادر'}</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-ink-500 dark:text-ink-400">نقش: {n.role}</div>
                  </div>
                  {n.status === 'running' && (
                    <div className="text-left font-mono text-[10px] leading-4 text-ink-500 dark:text-ink-400">
                      ingest 127.0.0.1:{n.ingest_port ?? '—'}<br />
                      mgmt http://127.0.0.1:{n.mgmt_port ?? '—'}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-ink-900/5 py-2 dark:bg-white/5">
                    <div className="text-lg font-extrabold">{n.status === 'running' ? n.events_received : n.events_stored}</div>
                    <div className="text-[10px] text-ink-500">{n.status === 'running' ? 'دریافتی (این جلسه)' : 'ذخیره‌شده (آخرین اجرا)'}</div>
                  </div>
                  <div className="rounded-xl bg-ink-900/5 py-2 dark:bg-white/5">
                    <div className="text-lg font-extrabold">{n.events_forwarded}</div>
                    <div className="text-[10px] text-ink-500">فوروارد شده</div>
                  </div>
                  <div className="rounded-xl bg-ink-900/5 py-2 dark:bg-white/5">
                    <div className="text-lg font-extrabold">{n.mode === 'forward' ? n.forward_stats.length : '—'}</div>
                    <div className="text-[10px] text-ink-500">هدف فوروارد</div>
                  </div>
                </div>

                {n.forward_stats.length > 0 && (
                  <div className="space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/5 p-2 text-[11px]">
                    {n.forward_stats.map((f) => (
                      <div key={f.target} className="flex items-center justify-between font-mono">
                        <span>{f.target}</span>
                        <span className={f.lastError ? 'text-rose-500' : 'text-emerald-500'}>
                          ok={f.ok} fail={f.fail}{f.lastError ? ` — ${f.lastError}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {results[n.id] && (
                  <div className={`rounded-xl px-3 py-2 text-[11px] leading-5 ${results[n.id].status === 'pass' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : results[n.id].status === 'fail' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
                    تست اینگست: {results[n.id].detail}
                  </div>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2">
                  {canOperate && (
                    <>
                      {n.status === 'running' ? (
                        <Button size="sm" variant="secondary" icon={<Square className="size-3.5" />} loading={busy === `${n.id}:stop`} onClick={() => control(n, 'stop')}>توقف</Button>
                      ) : (
                        <Button size="sm" icon={<Play className="size-3.5" />} loading={busy === `${n.id}:start`} onClick={() => control(n, 'start')}>شروع</Button>
                      )}
                      <Button size="sm" variant="outline" icon={<RotateCcw className="size-3.5" />} loading={busy === `${n.id}:restart`} disabled={!canOperate} onClick={() => control(n, 'restart')}>ری‌استارت</Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" icon={<Send className="size-3.5" />} disabled={n.status !== 'running'} loading={busy === `${n.id}:test`} onClick={() => ingestTest(n)}>رویداد آزمایشی</Button>
                  <Button size="sm" variant="ghost" icon={<FileCog className="size-3.5" />} onClick={() => setConfNode(n)}>conf / btool</Button>
                  <Button size="sm" variant="ghost" icon={<ScrollText className="size-3.5" />} onClick={() => setLogNode(n)}>لاگ نود</Button>
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>
      )}

      {nodes.length > 0 && <SearchPanel nodes={nodes} />}

      <ConfModal node={confNode} onClose={() => setConfNode(null)} canOperate={!!canOperate} />
      <LogsModal node={logNode} onClose={() => setLogNode(null)} />
    </div>
  );
}

function SearchPanel({ nodes }: { nodes: LabNode[] }) {
  const toast = useToast();
  const [query, setQuery] = React.useState('');
  const [picked, setPicked] = React.useState<string[]>([]);
  const [running, setRunning] = React.useState(false);
  const [res, setRes] = React.useState<LabSearchResult | null>(null);

  const run = async () => {
    setRunning(true);
    try {
      const d = await api<{ result: LabSearchResult }>('/api/lab/search', { method: 'POST', body: JSON.stringify({ query, nodes: picked, limit: 100 }) });
      setRes(d.result);
      if (d.result.searched_nodes.length === 0) toast.push({ tone: 'warning', title: 'بدون نتیجه', message: 'هیچ نود ایندکسر در حال اجرا یافت نشد — ابتدا یک نود store را شروع کنید' });
    } catch (e) {
      toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : 'خطا' });
    } finally { setRunning(false); }
  };

  return (
    <FadeIn delay={0.1}>
      <Card className="mt-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold"><Search className="size-4 text-brand-500" /> جستجوی توزیع‌شده روی spool نودها</div>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="عبارت جستجو (کلمات با فاصله = و) — خالی = همه رویدادها" className="max-w-md" onKeyDown={(e) => e.key === 'Enter' && run()} />
          <Button icon={<Search className="size-4" />} loading={running} onClick={run}>اجستجو</Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {nodes.map((n) => (
            <label key={n.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-ink-900/5 px-2 py-1 dark:bg-white/5">
              <input
                type="checkbox"
                checked={picked.includes(n.name)}
                onChange={() => setPicked((p) => (p.includes(n.name) ? p.filter((x) => x !== n.name) : [...p, n.name]))}
              />
              {n.name}
              {n.mode === 'forward' && <span className="text-[10px] text-amber-500">(فوروادر — جستجو نمی‌شود)</span>}
            </label>
          ))}
        </div>
        {res && (
          <div className="mt-3 space-y-2">
            <div className="text-xs text-ink-500">
              {res.matched} رویداد یافت شد — نودهای جستجوشده: {res.searched_nodes.join('، ') || '—'}
              {res.skipped_forwarders.length > 0 && ` — فوروادرهای رد شده: ${res.skipped_forwarders.join('، ')}`}
            </div>
            {res.events.length > 0 && (
              <div className="max-h-72 overflow-y-auto rounded-xl border border-ink-200/60 dark:border-white/8">
                <table className="w-full text-right text-[11px]">
                  <thead className="sticky top-0 bg-white/90 backdrop-blur dark:bg-ink-900/90">
                    <tr className="text-ink-500"><th className="px-3 py-2 font-semibold">زمان</th><th className="px-3 py-2 font-semibold">نود</th><th className="px-3 py-2 font-semibold">رویداد</th></tr>
                  </thead>
                  <tbody className="font-mono">
                    {res.events.map((e, i) => (
                      <tr key={i} className="border-t border-ink-200/40 dark:border-white/6">
                        <td className="whitespace-nowrap px-3 py-1.5 text-ink-500">{new Date(e.ts).toLocaleTimeString('fa-IR')}</td>
                        <td className="whitespace-nowrap px-3 py-1.5">{e.node}</td>
                        <td className="px-3 py-1.5 leading-5 text-ink-700 dark:text-ink-200" dir="ltr">{e.raw}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>
    </FadeIn>
  );
}

function ConfModal({ node, onClose, canOperate }: { node: LabNode | null; onClose: () => void; canOperate: boolean }) {
  const toast = useToast();
  const [files, setFiles] = React.useState<string[]>([]);
  const [name, setName] = React.useState<string | null>(null);
  const [text, setText] = React.useState('');
  const [btool, setBtool] = React.useState<string | null>(null);
  const [diff, setDiff] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!node) return;
    setName(null); setText(''); setBtool(null); setDiff(null);
    api<{ files: string[] }>(`/api/lab/nodes/${node.id}/conf`).then((d) => setFiles(d.files)).catch(() => setFiles([]));
  }, [node]);

  const load = async (f: string) => {
    if (!node) return;
    setBusy(true);
    try {
      const d = await api<{ raw: string }>(`/api/lab/nodes/${node.id}/conf?name=${encodeURIComponent(f)}`);
      setName(f); setText(d.raw); setBtool(null); setDiff(null);
    } catch (e) {
      toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : 'خطا' });
    } finally { setBusy(false); }
  };

  const showBtool = async () => {
    if (!node || !name) return;
    setBusy(true);
    try {
      const d = await api<{ text: string }>(`/api/lab/nodes/${node.id}/conf?name=${encodeURIComponent(name)}&btool=1`);
      setBtool(d.text);
    } catch (e) {
      toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : 'خطا' });
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (!node || !name) return;
    setBusy(true);
    try {
      const d = await api<{ diffText: string; applied: string }>(`/api/lab/nodes/${node.id}/conf`, { method: 'PUT', body: JSON.stringify({ name, text }) });
      setDiff(d.diffText);
      toast.push({
        tone: 'success',
        title: 'ذخیره شد (با پشتیبان .bak)',
        message: d.applied === 'after_restart' ? 'برای اعمال تغییرات inputs/outputs نود را ری‌استارت کنید' : 'تغییر ذخیره شد',
      });
    } catch (e) {
      toast.push({ tone: 'danger', title: 'ذخیره ناموفق', message: e instanceof Error ? e.message : 'خطا' });
    } finally { setBusy(false); }
  };

  return (
    <Modal open={node !== null} onClose={onClose} title={`پیکربندی نود ${node?.name ?? ''}`} wide>
      <div className="flex flex-wrap items-center gap-2">
        {files.map((f) => (
          <Button key={f} size="sm" variant={name === f ? 'primary' : 'secondary'} disabled={busy} onClick={() => load(f)}>{f}</Button>
        ))}
        {files.length === 0 && <span className="text-xs text-ink-500">هیچ فایل conf در این نود وجود ندارد</span>}
      </div>
      {name && (
        <div className="mt-3 space-y-3">
          <textarea
            dir="ltr"
            value={text}
            onChange={(e) => setText(e.target.value)}
            readOnly={!canOperate}
            rows={12}
            className="w-full rounded-xl border border-ink-300 bg-ink-950 p-3 font-mono text-[12px] leading-5 text-emerald-300 dark:border-white/10"
          />
          <div className="flex flex-wrap items-center gap-2">
            {canOperate && <Button size="sm" icon={<Terminal className="size-3.5" />} loading={busy} onClick={save}>ذخیره تغییرات</Button>}
            <Button size="sm" variant="outline" disabled={busy} onClick={showBtool}>نمایش btool (merge شده)</Button>
            {!canOperate && <span className="text-[11px] text-ink-500">فقط مشاهده — ویرایش برای نقش شما مجاز نیست</span>}
          </div>
          {btool && (
            <pre dir="ltr" className="max-h-52 overflow-auto rounded-xl bg-ink-950 p-3 font-mono text-[11px] leading-5 text-cyan-200">{btool}</pre>
          )}
          {diff && (
            <div>
              <div className="mb-1 text-xs font-bold text-ink-500">تغییرات اعمال‌شده:</div>
              <pre dir="ltr" className="max-h-40 overflow-auto rounded-xl bg-ink-900/5 p-3 font-mono text-[11px] leading-5 dark:bg-white/5">{diff}</pre>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function LogsModal({ node, onClose }: { node: LabNode | null; onClose: () => void }) {
  const [lines, setLines] = React.useState<string[]>([]);
  const [logPath, setLogPath] = React.useState('');

  React.useEffect(() => {
    if (!node) return;
    setLines([]);
    api<{ lines: string[]; path: string }>(`/api/lab/nodes/${node.id}/logs?tail=200`)
      .then((d) => { setLines(d.lines); setLogPath(d.path); })
      .catch(() => {});
  }, [node]);

  return (
    <Modal open={node !== null} onClose={onClose} title={`لاگ نود ${node?.name ?? ''}`} wide>
      <div className="mb-2 text-[11px] text-ink-500" dir="ltr">{logPath}</div>
      {lines.length === 0 ? (
        <div className="rounded-xl bg-ink-900/5 p-4 text-center text-xs text-ink-500 dark:bg-white/5">هنوز لاگی ثبت نشده است — با شروع نود یا ارسال رویداد آزمایشی، لاگ پر می‌شود.</div>
      ) : (
        <pre dir="ltr" className="max-h-[55vh] overflow-auto rounded-xl bg-ink-950 p-3 font-mono text-[11px] leading-5 text-ink-200">{lines.join('\n')}</pre>
      )}
    </Modal>
  );
}
