'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard, Radar, Network, Server, Boxes, Rocket, ShieldCheck, ScrollText,
  Settings, Sun, Moon, LogOut, ChevronDown, Sparkles, GitBranch, FlaskConical, Stethoscope,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';

const NAV = [
  {
    group: 'نظارت عملیاتی',
    items: [
      { href: '/dashboard', label: 'داشبورد', icon: LayoutDashboard },
      { href: '/topology', label: 'نقشه شبکه زنده', icon: Network },
      { href: '/hosts', label: 'هاست‌ها', icon: Server },
    ],
  },
  {
    group: 'کشف و استقرار',
    items: [
      { href: '/discovery', label: 'کشف کنترل‌شده', icon: Radar },
      { href: '/architecture', label: 'استودیو معماری Splunk', icon: Boxes },
      { href: '/deployment', label: 'استقرار و اعتبارسنجی', icon: Rocket },
      { href: '/lab', label: 'آزمایشگاه زنده', icon: FlaskConical },
      { href: '/diagnostics', label: 'عیب‌یاری و ترمیم', icon: Stethoscope },
    ],
  },
  {
    group: 'حاکمیت',
    items: [
      { href: '/best-practices', label: 'Best Practiceها', icon: ShieldCheck },
      { href: '/audit', label: 'گزارش‌های حسابرسی', icon: ScrollText, roles: ['auditor', 'admin'] },
      { href: '/settings', label: 'تنظیمات', icon: Settings, roles: ['admin'] },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  viewer: 'بیننده', network_operator: 'اپراتور شبکه', splunk_admin: 'مدیر Splunk',
  infra_admin: 'مدیر زیرساخت', auditor: 'حسابرس', admin: 'مدیر سیستم',
};

export function AppShell({ children, user }: { children: React.ReactNode; user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoBanner, setDemoBanner] = useState(true);

  useEffect(() => setMounted(true), []);

  const logout = async () => {
    await api('/api/auth', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="mesh-bg min-h-screen">
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-ink-200/60 bg-white/60 px-4 py-5 backdrop-blur-xl dark:border-white/6 dark:bg-ink-950/40 lg:flex">
          <Link href="/dashboard" className="mb-6 flex items-center gap-2.5 px-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 text-white shadow-lg shadow-brand-600/30">
              <GitBranch className="size-5" />
            </div>
            <div className="leading-tight">
              <div className="text-[13px] font-extrabold">Splunk Infrastructure</div>
              <div className="text-[11px] text-ink-400">استودیو معماری و استقرار</div>
            </div>
          </Link>

          <nav className="flex-1 space-y-5 overflow-y-auto">
            {NAV.map((g) => {
              const items = g.items.filter((i) => !i.roles || i.roles.includes(user.role));
              if (items.length === 0) return null;
              return (
                <div key={g.group}>
                  <div className="mb-1.5 px-3 text-[11px] font-bold tracking-wide text-ink-400 dark:text-ink-500">{g.group}</div>
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const active = pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'focus-ring group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors',
                            active
                              ? 'font-semibold text-brand-700 dark:text-brand-300'
                              : 'text-ink-600 hover:bg-ink-900/5 dark:text-ink-300 dark:hover:bg-white/6'
                          )}
                        >
                          {active && (
                            <motion.span
                              layoutId="nav-active"
                              className="absolute inset-y-1.5 right-0 w-1 rounded-full bg-gradient-to-b from-brand-400 to-cyan-400"
                              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                            />
                          )}
                          <item.icon className={cn('size-4', active ? 'text-brand-500' : 'text-ink-400 group-hover:text-ink-600 dark:group-hover:text-ink-200')} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="mt-4 rounded-xl border border-brand-500/20 bg-brand-500/8 p-3 text-[11px] leading-5 text-ink-600 dark:text-ink-300">
            <div className="mb-1 flex items-center gap-1.5 font-bold text-brand-700 dark:text-brand-300">
              <Sparkles className="size-3.5" /> اصل امنیتی
            </div>
            کشف دستگاه به معنای مجوز مدیریت آن نیست؛ هیچ دسترسی‌ای بدون credential تعریف‌شده ایجاد نمی‌شود.
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-ink-200/60 bg-white/70 px-4 backdrop-blur-xl dark:border-white/6 dark:bg-ink-950/50 sm:px-6">
            <div className="flex items-center gap-3 lg:hidden">
              <Link href="/dashboard" className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 text-white">
                <GitBranch className="size-4" />
              </Link>
            </div>
            <div className="hidden items-center gap-2 text-xs text-ink-400 dark:text-ink-500 lg:flex">
              <span>Workspace:</span>
              <Badge tone="brand">محیط پیش‌فرض</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="focus-ring rounded-xl p-2 text-ink-500 hover:bg-ink-900/5 dark:text-ink-300 dark:hover:bg-white/8"
                aria-label="تغییر پوسته"
              >
                {mounted ? (theme === 'dark' ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />) : <span className="block size-4.5" />}
              </button>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="focus-ring flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-ink-900/5 dark:hover:bg-white/8"
                >
                  <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500/80 to-cyan-500/80 text-xs font-bold text-white">
                    {user.display_name.slice(0, 1)}
                  </div>
                  <div className="hidden text-right leading-tight sm:block">
                    <div className="text-xs font-bold">{user.display_name}</div>
                    <div className="text-[10px] text-ink-400">{ROLE_LABELS[user.role] ?? user.role}</div>
                  </div>
                  <ChevronDown className={cn('size-3.5 text-ink-400 transition-transform', menuOpen && 'rotate-180')} />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="glass absolute left-0 top-full z-20 mt-1.5 w-48 rounded-xl bg-white p-1.5 shadow-xl dark:bg-ink-900"
                    >
                      <button
                        onClick={logout}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                      >
                        <LogOut className="size-4" /> خروج از حساب
                      </button>
                    </motion.div>
                  </>
                )}
              </div>
            </div>
          </header>

          {demoBanner && (
            <div className="flex items-center justify-between gap-2 border-b border-fuchsia-500/20 bg-fuchsia-500/8 px-4 py-1.5 text-[11px] text-fuchsia-700 dark:text-fuchsia-300 sm:px-6">
              <span>این پلتفرم دارای حالت دمو است — داده‌های نمایشی همیشه با برچسب <b>DEMO DATA</b> مشخص می‌شوند و هرگز به‌عنوان داده واقعی نمایش داده نمی‌شوند.</span>
              <button onClick={() => setDemoBanner(false)} className="focus-ring rounded p-0.5 hover:bg-fuchsia-500/15">✕</button>
            </div>
          )}

          <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
