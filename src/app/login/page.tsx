'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { GitBranch, Lock, User as UserIcon, ShieldCheck } from 'lucide-react';
import { Button, Input, Card } from '@/components/ui';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    api<{ needsSetup: boolean }>('/api/setup').then((r) => {
      if (r.needsSetup) router.replace('/setup');
    }).catch(() => {});
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api<{ user: User }>('/api/auth', { method: 'POST', body: JSON.stringify({ username, password }) });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="mesh-bg flex min-h-screen items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} className="w-full max-w-md">
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 18 }}
            className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-500 text-white shadow-2xl shadow-brand-600/30"
          >
            <GitBranch className="size-8" />
          </motion.div>
          <h1 className="text-2xl font-extrabold tracking-tight">Splunk Infrastructure Studio</h1>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">کشف شبکه، طراحی معماری و استقرار Splunk — یکپارچه و کنترل‌شده</p>
        </div>

        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-ink-500 dark:text-ink-400">نام کاربری</label>
              <div className="relative">
                <UserIcon className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                <Input value={username} onChange={(e) => setUsername(e.target.value)} className="pr-9" autoFocus dir="ltr" placeholder="admin" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-ink-500 dark:text-ink-400">رمز عبور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-9" dir="ltr" placeholder="••••••••••" />
              </div>
            </div>
            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
                {error}
              </motion.div>
            )}
            <Button type="submit" loading={loading} className="w-full" size="lg">ورود به پلتفرم</Button>
          </form>
        </Card>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-ink-400 dark:text-ink-500">
          <ShieldCheck className="size-3.5" />
          احراز هویت امن — session رمزنگاری‌شده — ثبت کامل رویدادها در audit log
        </div>
        {needsSetup && null}
      </motion.div>
    </div>
  );
}
