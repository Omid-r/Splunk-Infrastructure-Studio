'use client';

import { useCallback, useEffect, useState } from 'react';
import { Archive, Download, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { faDate, faNum } from '@/lib/utils';

interface BundleEntryInfo {
  path: string;
  bytes: number;
  truncated: boolean;
}

interface BundleResult {
  file: string;
  bytes: number;
  sha256: string;
  generated_at: string;
  node_count: number;
  entries: BundleEntryInfo[];
  skipped: { path: string; reason: string }[];
}

interface BundleListing {
  name: string;
  bytes: number;
  mtime: string;
}

function kb(bytes: number): string {
  return `${faNum(Math.max(1, Math.round(bytes / 1024)))} کیلوبایت`;
}

export function LabBundle({ canOperate }: { canOperate: boolean }) {
  const [bundles, setBundles] = useState<BundleListing[] | null>(null);
  const [last, setLast] = useState<BundleResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    api<{ bundles: BundleListing[] }>('/api/lab/bundle')
      .then((r) => setBundles(r.bundles))
      .catch(() => setBundles([]));
  }, []);

  useEffect(reload, [reload]);

  const build = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ bundle: BundleResult }>('/api/lab/bundle', {
        method: 'POST',
        body: JSON.stringify({ action: 'build' }),
      });
      setLast(r.bundle);
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!bundles) {
    return (
      <Card className="mt-6">
        <Spinner />
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Archive className="size-4 text-brand-500" />
          <h2 className="text-sm font-bold text-ink-900 dark:text-ink-50">بستهٔ قابل‌انتقال شواهد آزمایشگاه</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<RefreshCw className="size-3.5" />} onClick={reload}>
            بازخوانی فهرست
          </Button>
          {canOperate && (
            <Button size="sm" loading={busy} onClick={build} icon={<Archive className="size-3.5" />}>
              ساخت tar.gz
            </Button>
          )}
        </div>
      </div>

      <p className="mt-1 text-[11px] leading-5 text-ink-500 dark:text-ink-400">
        فایل tar.gz واقعی (ustar + gzip) از کانف‌ها، spool رویدادها و لاگ‌های نودهای همین Workspace — با manifest و
        یادداشت صداقت. اگر فایلی روی دیسک نباشد، در بخش skipped با دلیل ثبت می‌شود؛ چیزی جعل نمی‌شود.
      </p>

      {error && <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-[11px] text-rose-700 dark:text-rose-300">{error}</p>}

      {last && (
        <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Badge tone="green">ساخته شد</Badge>
            <span className="font-mono text-[10px]">{last.file}</span>
            <span className="text-ink-500 dark:text-ink-400">{kb(last.bytes)}</span>
            <span className="text-ink-500 dark:text-ink-400">{faNum(last.entries.length)} فایل</span>
            <span className="text-ink-500 dark:text-ink-400">{faNum(last.node_count)} نود</span>
            {last.skipped.length > 0 && <Badge tone="amber">{faNum(last.skipped.length)} مورد skip</Badge>}
          </div>
          <div className="mt-1 font-mono text-[10px] text-ink-400">sha256 {last.sha256}</div>
        </div>
      )}

      {bundles.length === 0 ? (
        <p className="mt-3 text-[11px] text-ink-500 dark:text-ink-400">هنوز bundle ای ساخته نشده است.</p>
      ) : (
        <div className="mt-4 space-y-1.5">
          {bundles.map((b) => (
            <div key={b.name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/40 px-3 py-2 dark:bg-white/5">
              <div className="text-right">
                <div className="font-mono text-[11px] font-bold">{b.name}</div>
                <div className="text-[10px] text-ink-500">{faDate(b.mtime)} · {kb(b.bytes)}</div>
              </div>
              <a
                href={`/api/lab/bundle/download?file=${encodeURIComponent(b.name)}`}
                className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-500/12 px-3 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-500/30 transition-colors hover:bg-brand-500/20 dark:text-brand-300"
              >
                <Download className="size-3.5" />
                دانلود
              </a>
            </div>
          ))}
        </div>
      )}

      {last && last.skipped.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1.5 text-[11px] font-bold text-ink-600 dark:text-ink-300">موارد skip‌شده با دلیل</h3>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {last.skipped.map((s) => (
              <div key={s.path} className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/8 px-2.5 py-1.5 text-[10px]">
                <span className="font-mono text-ink-500 dark:text-ink-400">{s.path}</span>
                <span className="text-amber-700 dark:text-amber-300">{s.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
