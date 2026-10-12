'use client';

import * as React from 'react';
import { api } from '@/lib/api';
import {
  PageHeader, Card, Button, Badge, Spinner, FadeIn, EmptyState,
} from '@/components/ui';
import { useToast } from '@/components/toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, GitCompare, Wrench, RefreshCw, FlaskConical, ShieldCheck, Info,
} from 'lucide-react';
import type { BestPracticeRule, BestPracticeRun } from '@/lib/types';

const SEV_TONE: Record<string, 'brand' | 'green' | 'amber' | 'rose' | 'zinc' | 'cyan' | 'demo'> = {
  critical: 'rose', warning: 'amber', info: 'cyan',
};

type PlanResult = {
  targetPath: string;
  current: string;
  desired: string;
  diff: string;
  applicable: boolean;
  reason?: string;
};

type LabInfo = { labExists: boolean; nodes: number; manifestAt: string | null };

export default function BestPracticesPage() {
  const toast = useToast();
  const [rules, setRules] = React.useState<BestPracticeRule[]>([]);
  const [runsByRule, setRunsByRule] = React.useState<Record<string, BestPracticeRun[]>>({});
  const [lab, setLab] = React.useState<LabInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [mode, setMode] = React.useState<'read' | 'plan' | 'apply'>('read');
  const [planResult, setPlanResult] = React.useState<PlanResult | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const data = await api<{ rules: BestPracticeRule[]; runs: BestPracticeRun[]; lab: LabInfo; rules_version: string }>('/api/best-practices');
      setRules(data.rules);
      const grouped: Record<string, BestPracticeRun[]> = {};
      for (const r of data.runs) (grouped[r.rule_id] ??= []).push(r);
      setRunsByRule(grouped);
      setLab(data.lab);
    } catch (e) { toast.push({ tone: 'danger', title: 'خطا در بارگذاری', message: e instanceof Error ? e.message : 'خطا' }); }
    finally { setLoading(false); }
  }, [toast]);
  React.useEffect(() => { load(); }, [load]);

  const act = async (ruleId: string, action: 'plan' | 'apply') => {
    setBusy(ruleId + action);
    try {
      const res = await api<{ plan?: PlanResult; run?: BestPracticeRun }>('/api/best-practices', {
        method: 'POST', body: JSON.stringify({ ruleId, action }),
      });
      if (action === 'plan' && res.plan) { setPlanResult(res.plan); setMode('plan'); setSelected(ruleId); }
      else if (res.run) {
        toast.push({ tone: res.run.state === 'applied' ? 'success' : res.run.state === 'failed' ? 'danger' : 'warning', title: res.run.state === 'applied' ? 'اعمال شد' : res.run.state === 'failed' ? 'ناموفق' : 'رد شد', message: res.run.result ?? '' });
        await load();
      }
    } catch (e) { toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : 'خطا' }); }
    finally { setBusy(null); }
  };

  if (loading) return <div className="flex items-center justify-center py-32"><Spinner /></div>;

  const selectedRule = rules.find((r) => r.id === selected) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="بهترین شیوه‌های Splunk"
        subtitle={`اجرای توصیه‌ها روی محیط Local Lab${lab?.labExists ? ` (${lab.nodes} نود — ساخته‌شده در ${lab.manifestAt?.slice(0, 19)})` : ' (هنوز ساخته نشده)'}`}
        actions={<Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> تازه‌سازی</Button>}
      />

      {lab && !lab.labExists && (
        <FadeIn><div className="glass flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-amber-200">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
          <div>اجرای توصیه‌ها روی محیط Local Lab انجام می‌شود. برای فعال‌سازی، ابتدا یک استقرار آزمایشی روی Local Lab اجرا کنید.</div>
        </div></FadeIn>
      )}

      <div className="glass flex w-fit items-center gap-1 rounded-xl p-1">
        {([['read', 'خواندن', BookOpen], ['plan', 'مقایسه', GitCompare], ['apply', 'اعمال', Wrench]] as const).map(([m, label, Icon]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`relative flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${mode === m ? 'text-emerald-200' : 'text-zinc-400 hover:text-zinc-200'}`}>
            {mode === m && <motion.span layoutId="bp-mode" className="absolute inset-0 rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/30" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <Icon className="relative z-10 h-3.5 w-3.5" /><span className="relative z-10">{label}</span>
          </button>
        ))}
      </div>

      {rules.length === 0 ? (
        <Card><EmptyState title="قانونی ثبت نشده" hint="کاتالوگ بهترین شیوه‌ها هنوز خالی است" /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rules.map((rule, i) => {
            const ruleRuns = runsByRule[rule.id] ?? [];
            const latest = ruleRuns[0];
            return (
              <FadeIn key={rule.id} delay={i * 0.05}>
                <Card className={`h-full transition ${selected === rule.id ? 'ring-1 ring-emerald-400/40' : 'hover:border-zinc-600/50'}`}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <button className="font-mono text-[11px] text-emerald-300/80 hover:underline" onClick={() => setSelected(rule.id)}>{rule.code}</button>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={SEV_TONE[rule.severity]}>{rule.severity}</Badge>
                        {latest && <Badge tone={latest.state === 'applied' ? 'green' : latest.state === 'failed' ? 'rose' : 'zinc'}>{latest.state}</Badge>}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-100">{rule.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-400">{rule.summary}</p>
                    </div>
                    {mode === 'read' && (
                      <div className="space-y-2 rounded-lg bg-zinc-900/60 p-3 text-xs leading-relaxed text-zinc-400">
                        <div><span className="text-zinc-500">دلیل: </span>{rule.rationale}</div>
                        <div><span className="text-zinc-500">ریسک: </span>{rule.risk}</div>
                        <div><span className="text-zinc-500">کاربرد: </span>{rule.applicability}</div>
                        {rule.sample_config && (
                          <pre className="overflow-x-auto rounded bg-zinc-950/80 p-2 font-mono text-[11px] text-emerald-200/70" dir="ltr">{rule.sample_config}</pre>
                        )}
                        <div className="text-zinc-500">{rule.source_title} — {rule.version_note}</div>
                        {rule.source_url && (
                          <a href={rule.source_url} target="_blank" rel="noreferrer" className="block truncate text-sky-300 hover:underline" dir="ltr">{rule.source_url}</a>
                        )}
                      </div>
                    )}
                    {(mode === 'plan' || mode === 'apply') && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" loading={busy === rule.id + 'plan'} onClick={() => void act(rule.id, 'plan')}>
                          <GitCompare className="h-3.5 w-3.5" /> پیش‌نمایش تغییرات
                        </Button>
                        {mode === 'apply' && (
                          <Button size="sm" loading={busy === rule.id + 'apply'} onClick={() => void act(rule.id, 'apply')}>
                            <Wrench className="h-3.5 w-3.5" /> اعمال
                          </Button>
                        )}
                      </div>
                    )}
                    {latest && <div className="text-[11px] text-zinc-500">آخرین اجرا: {latest.created_at.slice(0, 19)} — {latest.result ?? ''}</div>}
                  </div>
                </Card>
              </FadeIn>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {planResult && selectedRule && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="glass space-y-4 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-zinc-100"><GitCompare className="h-4 w-4 text-emerald-300" /> نتیجه Plan — {selectedRule.title}</h3>
              <Button variant="ghost" size="sm" onClick={() => setPlanResult(null)}>بستن</Button>
            </div>
            {!planResult.applicable ? (
              <div className="flex items-start gap-2 text-sm text-amber-200"><Info className="mt-0.5 h-4 w-4 shrink-0" />{planResult.reason}</div>
            ) : (
              <>
                <div className="flex items-start gap-2 text-sm text-zinc-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> مقصد: <code className="text-emerald-200/80" dir="ltr">{planResult.targetPath}</code></div>
                {planResult.diff === '(بدون تغییر)' ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-400"><Info className="h-4 w-4" /> وضعیت فعلی مطابق توصیه است؛ تغییری لازم نیست.</div>
                ) : (
                  <pre className="overflow-x-auto rounded-lg border border-zinc-700/40 bg-zinc-900/70 p-3 font-mono text-xs" dir="ltr">{planResult.diff}</pre>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
