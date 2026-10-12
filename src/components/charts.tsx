'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useInView, useMotionValue, useSpring, useTransform, animate } from 'framer-motion';
import { cn, faNum } from '@/lib/utils';

export function Donut({ parts, size = 148, thickness = 16, centerLabel, centerSub }: {
  parts: { value: number; color: string; label: string }[];
  size?: number; thickness?: number; centerLabel?: string; centerSub?: string;
}) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="stroke-ink-900/8 dark:stroke-white/8" />
        {parts.filter((p) => p.value > 0).map((p, i) => {
          const frac = p.value / total;
          const dash = frac * c;
          const offset = -acc * c;
          acc += frac;
          return (
            <motion.circle
              key={i}
              cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={p.color} strokeWidth={thickness} strokeLinecap="butt"
              strokeDasharray={`${dash} ${c - dash}`}
              initial={{ strokeDashoffset: offset - dash }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1], delay: i * 0.08 }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold">{centerLabel}</span>
        {centerSub && <span className="text-[11px] text-ink-400">{centerSub}</span>}
      </div>
    </div>
  );
}

export function Spark({ data, width = 180, height = 44, color = 'var(--color-brand-500)' }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - 4 - ((v - min) / range) * (height - 8)}`);
  const d = `M${pts.join(' L')}`;
  const area = `${d} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={area} fill="url(#sparkFill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} />
      <motion.path
        d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
    </svg>
  );
}

export function RadialGauge({ value, size = 120, label, tone = 'brand' }: { value: number; size?: number; label: string; tone?: 'brand' | 'amber' | 'rose' | 'cyan' }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const colors: Record<string, string> = {
    brand: 'var(--color-brand-500)',
    amber: '#f59e0b',
    rose: '#f43f5e',
    cyan: '#06b6d4',
  };
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="10" className="stroke-ink-900/8 dark:stroke-white/8" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={colors[tone]} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (Math.min(100, value) / 100) * c }}
          transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold">{faNum(Math.round(value))}٪</span>
        <span className="text-[10px] text-ink-400">{label}</span>
      </div>
    </div>
  );
}

export function CountUp({ value, suffix, className }: { value: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 1.2,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value]);
  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {faNum(display)}
      {suffix}
    </span>
  );
}

export function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [4, -4]), { stiffness: 180, damping: 18 });
  const ry = useSpring(useTransform(mx, [0, 1], [-4, 4]), { stiffness: 180, damping: 18 });
  return (
    <motion.div
      ref={ref}
      style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d', perspective: 800 }}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        mx.set((e.clientX - rect.left) / rect.width);
        my.set((e.clientY - rect.top) / rect.height);
      }}
      onMouseLeave={() => { mx.set(0.5); my.set(0.5); }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
