'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Toast { id: number; kind: 'success' | 'error' | 'warning' | 'info'; text: string }

export interface ToastObject { tone: 'success' | 'danger' | 'error' | 'warning' | 'info' | 'neutral'; title: string; message?: string }

const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => {});

const TONE_MAP: Record<string, Toast['kind']> = {
  success: 'success', danger: 'error', error: 'error', warning: 'warning', info: 'info', neutral: 'info',
};

export type PushFn = {
  (kind: Toast['kind'] | ToastObject, text?: string): void;
  push: (input: ToastObject) => void;
};

export function useToast(): PushFn {
  const push = useContext(ToastCtx);
  const fn = useCallback(
    ((a: Toast['kind'] | ToastObject, b?: string) => {
      if (typeof a === 'string') { push(a, b ?? ''); return; }
      push(TONE_MAP[a.tone] ?? 'info', a.message ? `${a.title} — ${a.message}` : a.title);
    }) as PushFn,
    [push],
  );
  fn.push = ((input: ToastObject) => fn(input)) as PushFn['push'];
  return fn;
}

const ICONS = {
  success: <CheckCircle2 className="size-4 text-emerald-500" />,
  error: <XCircle className="size-4 text-rose-500" />,
  warning: <AlertTriangle className="size-4 text-amber-500" />,
  info: <Info className="size-4 text-cyan-500" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-5 z-[100] flex w-80 flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: -40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -30, scale: 0.95 }}
              className={cn(
                'glass pointer-events-auto flex items-start gap-2.5 rounded-xl bg-white p-3 text-sm shadow-xl dark:bg-ink-850',
                'border-l-2',
                t.kind === 'success' && 'border-l-emerald-500',
                t.kind === 'error' && 'border-l-rose-500',
                t.kind === 'warning' && 'border-l-amber-500',
                t.kind === 'info' && 'border-l-cyan-500'
              )}
            >
              {ICONS[t.kind]}
              <span className="leading-5">{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
