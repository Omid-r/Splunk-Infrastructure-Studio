'use client';

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-600/25 dark:shadow-brand-900/40',
  secondary:
    'bg-ink-900/5 text-ink-800 hover:bg-ink-900/10 dark:bg-white/8 dark:text-ink-100 dark:hover:bg-white/12',
  ghost: 'text-ink-600 hover:bg-ink-900/5 dark:text-ink-300 dark:hover:bg-white/8',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-600/25',
  outline:
    'border border-ink-300 text-ink-700 hover:border-brand-500 hover:text-brand-600 dark:border-white/12 dark:text-ink-200 dark:hover:border-brand-400 dark:hover:text-brand-300',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-base rounded-xl gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'focus-ring inline-flex select-none items-center justify-center font-medium transition-all duration-200',
        'active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'glass rounded-2xl p-5 shadow-[0_8px_40px_-18px_rgba(0,0,0,0.35)] dark:shadow-[0_8px_40px_-18px_rgba(0,0,0,0.8)]',
        className
      )}
      {...rest}
    />
  );
}

export type BadgeTone = 'brand' | 'green' | 'amber' | 'rose' | 'zinc' | 'cyan' | 'demo';

const TONES: Record<BadgeTone, string> = {
  brand: 'bg-brand-500/12 text-brand-700 dark:text-brand-300 ring-brand-500/30',
  green: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  amber: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-amber-500/30',
  rose: 'bg-rose-500/12 text-rose-700 dark:text-rose-300 ring-rose-500/30',
  zinc: 'bg-ink-500/10 text-ink-600 dark:text-ink-300 ring-ink-400/25',
  cyan: 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 ring-cyan-500/30',
  demo: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 ring-fuchsia-500/40',
};

export function Badge({ tone = 'zinc', className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', TONES[tone], className)}>
      {children}
    </span>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        'focus-ring h-10 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400',
        'dark:border-white/10 dark:bg-white/5 dark:text-ink-100 dark:placeholder:text-ink-500',
        className
      )}
      {...rest}
    />
  );
});

export function ProgressBar({ value, tone = 'brand', className }: { value: number; tone?: BadgeTone; className?: string }) {
  const tones: Record<string, string> = {
    brand: 'from-brand-500 to-cyan-400',
    green: 'from-emerald-500 to-brand-400',
    amber: 'from-amber-500 to-orange-400',
    rose: 'from-rose-500 to-red-400',
  };
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-ink-900/8 dark:bg-white/8', className)}>
      <motion.div
        className={cn('h-full rounded-full bg-gradient-to-l', tones[tone] ?? tones.brand)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
      />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-brand-500', className)} />;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-300 py-14 text-center dark:border-white/10"
    >
      <div className="text-3xl font-bold text-ink-400 dark:text-ink-500">∅</div>
      <div className="text-sm font-semibold text-ink-600 dark:text-ink-300">{title}</div>
      {hint && <div className="max-w-sm text-xs leading-5 text-ink-400 dark:text-ink-500">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function FadeIn({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className={cn(
              'glass relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-2xl bg-white p-6 dark:bg-ink-900',
              wide ? 'max-w-3xl' : 'max-w-lg'
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{title}</h3>
              <button onClick={onClose} className="focus-ring rounded-lg p-1 text-ink-400 hover:bg-ink-900/5 dark:hover:bg-white/10">✕</button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
