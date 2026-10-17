'use client';

import * as React from 'react';
import { api } from '@/lib/api';
import { PageHeader, Card, Button, Badge, Input, Spinner, FadeIn, Modal } from '@/components/ui';
import { useToast } from '@/components/toast';
import { Users, KeyRound, LogOut, ShieldCheck, UserPlus, Power, RefreshCw } from 'lucide-react';
import { ROLE_LABELS } from '@/components/shell';
import type { Role, User } from '@/lib/types';

interface SessionInfo { token_hash: string; username: string; display_name: string; role: string; created_at: string; expires_at: string; current: number }
interface SecStatus {
  users_total: number; users_active: number; open_sessions: number; failed_logins_24h: number;
  locked_pairs: { username: string; ip: string; remainingSec: number }[];
  audit_chain_ok: boolean; audit_chain_broken_at: string | null; last_audit_at: string | null;
  session_secret_from_env: boolean; encryption_key_from_env: boolean;
}

export default function AdminPage() {
  const toast = useToast();
  const [users, setUsers] = React.useState<User[] | null>(null);
  const [sessions, setSessions] = React.useState<SessionInfo[]>([]);
  const [status, setStatus] = React.useState<SecStatus | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [resetFor, setResetFor] = React.useState<User | null>(null);
  const [newPw, setNewPw] = React.useState('');
  const [showCreate, setShowCreate] = React.useState(false);
  const [curPw, setCurPw] = React.useState('');
  const [nextPw, setNextPw] = React.useState('');

  const reload = React.useCallback(() => {
    api<{ users: User[] }>('/api/users').then((d) => setUsers(d.users)).catch((e) => { setUsers(null); toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : '' }); });
    api<{ sessions: SessionInfo[] }>('/api/security/sessions').then((d) => setSessions(d.sessions)).catch(() => {});
    api<{ status: SecStatus }>('/api/security/status').then((d) => setStatus(d.status)).catch(() => {});
  }, [toast]);

  React.useEffect(() => { reload(); }, [reload]);

  const toggle = async (u: User) => {
    setBusy(`t:${u.id}`);
    try {
      const d = await api<{ users: User[] }>('/api/users', { method: 'PATCH', body: JSON.stringify({ id: u.id, active: u.is_active !== 1 }) });
      setUsers(d.users);
      toast.push({ tone: 'success', title: u.is_active === 1 ? 'غیرفعال شد' : 'فعال شد', message: u.display_name });
    } catch (e) { toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : '' }); }
    finally { setBusy(null); }
  };

  const resetPw = async () => {
    if (!resetFor || newPw.length < 10) { toast.push({ tone: 'warning', title: 'رمز کوتاه', message: 'حداقل ۱۰ کاراکتر' }); return; }
    setBusy('reset');
    try {
      await api('/api/users/reset-password', { method: 'POST', body: JSON.stringify({ id: resetFor.id, password: newPw }) });
      toast.push({ tone: 'success', title: 'رمز بازنشانی شد', message: `همهٔ نشست‌های ${resetFor.display_name} بسته شد` });
      setResetFor(null); setNewPw('');
      reload();
    } catch (e) { toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : '' }); }
    finally { setBusy(null); }
  };

  const revoke = async (s: SessionInfo) => {
    setBusy(`s:${s.token_hash.slice(0, 8)}`);
    try {
      const d = await api<{ revoked: number; revoked_self?: boolean }>('/api/security/sessions', { method: 'POST', body: JSON.stringify({ action: 'revoke', tokenHash: s.token_hash }) });
      toast.push({ tone: d.revoked ? 'success' : 'warning', title: d.revoked ? 'نشست بسته شد' : 'نشستی یافت نشد', message: s.display_name });
      if (d.revoked_self) { window.location.href = '/login'; return; }
      reload();
    } catch (e) { toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : '' }); }
    finally { setBusy(null); }
  };

  const changeOwn = async () => {
    if (nextPw.length < 10) { toast.push({ tone: 'warning', title: 'رمز جدید کوتاه است', message: 'حداقل ۱۰ کاراکتر' }); return; }
    setBusy('own');
    try {
      await api('/api/auth/password', { method: 'POST', body: JSON.stringify({ current: curPw, next: nextPw }) });
      toast.push({ tone: 'success', title: 'رمز تغییر کرد', message: 'با رمز جدید وارد شوید' });
      setTimeout(() => { window.location.href = '/login'; }, 1200);
    } catch (e) { toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : '' }); }
    finally { setBusy(null); }
  };

  if (!users) return <div className="flex items-center justify-center py-32"><Spinner /></div>;

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-2"><ShieldCheck className="size-6 text-brand-500" /> مدیریت کاربران و امنیت</span>}
        subtitle="کاربران، نشست‌های فعال، قفل‌های ورود و سلامت زنجیرهٔ حسابرسی — همه از روی داده‌های واقعی همین نصب."
        actions={<Button variant="outline" icon={<RefreshCw className="size-4" />} onClick={reload}>بازخوانی</Button>}
      />

      {status && (
        <FadeIn>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <div className="text-xs text-ink-500">کاربران فعال</div>
              <div className="text-2xl font-extrabold">{status.users_active}<span className="text-sm font-normal text-ink-400"> / {status.users_total}</span></div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-ink-500">نشست‌های باز</div>
              <div className="text-2xl font-extrabold">{status.open_sessions}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-ink-500">ورود ناموفق (۲۴ ساعت)</div>
              <div className="text-2xl font-extrabold">{status.failed_logins_24h}</div>
              {status.locked_pairs.length > 0 && <div className="mt-1 text-[11px] text-rose-500">{status.locked_pairs.length} جفت کاربری/IP قفل است</div>}
            </Card>
            <Card className="p-4">
              <div className="text-xs text-ink-500">زنجیرهٔ حسابرسی</div>
              <div className="mt-1"><Badge tone={status.audit_chain_ok ? 'green' : 'rose'}>{status.audit_chain_ok ? 'سالم' : `قطع در ${status.audit_chain_broken_at ?? '?'}`}</Badge></div>
              <div className="mt-1 text-[10px] text-ink-400">
                SESSION_SECRET از env: {status.session_secret_from_env ? 'بله' : 'نه (dev)'} · کلید رمزنگاری: {status.encryption_key_from_env ? 'بله' : 'نه'}
              </div>
            </Card>
          </div>
        </FadeIn>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <FadeIn>
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold"><Users className="size-4 text-brand-500" /> کاربران</div>
              {users.length < 12 && <Button size="sm" icon={<UserPlus className="size-3.5" />} onClick={() => setShowCreate(true)}>کاربر جدید</Button>}
            </div>
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-200/50 px-3 py-2 text-xs dark:border-white/8">
                  <div>
                    <div className="font-semibold">{u.display_name} <span className="text-ink-400">@{u.username}</span></div>
                    <div className="text-[10px] text-ink-500">{ROLE_LABELS[u.role] ?? u.role}{u.last_login_at ? ` — آخرین ورود ${new Date(u.last_login_at).toLocaleString('fa-IR')}` : ' — هرگز وارد نشده'}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={u.is_active === 1 ? 'green' : 'zinc'}>{u.is_active === 1 ? 'فعال' : 'غیرفعال'}</Badge>
                    <Button size="sm" variant="ghost" icon={<KeyRound className="size-3.5" />} onClick={() => { setResetFor(u); setNewPw(''); }}>بازنشانی رمز</Button>
                    <Button size="sm" variant="ghost" icon={<Power className="size-3.5" />} loading={busy === `t:${u.id}`} disabled={busy === `t:${u.id}`} onClick={() => toggle(u)}>{u.is_active === 1 ? 'غیرفعال' : 'فعال'}</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </FadeIn>

        <FadeIn delay={0.06}>
          <Card>
            <div className="mb-3 flex items-center gap-2 text-sm font-bold"><LogOut className="size-4 text-brand-500" /> نشست‌های فعال</div>
            {sessions.length === 0 ? (
              <div className="py-6 text-center text-xs text-ink-500">نشست بازی وجود ندارد.</div>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.token_hash} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-200/50 px-3 py-2 text-xs dark:border-white/8">
                    <div>
                      <div className="font-semibold">{s.display_name} {s.current === 1 && <Badge tone="brand">نشست فعلی شما</Badge>}</div>
                      <div className="text-[10px] text-ink-500" dir="ltr">ساخته: {new Date(s.created_at).toLocaleString('fa-IR')} · انقضا: {new Date(s.expires_at).toLocaleString('fa-IR')}</div>
                    </div>
                    <Button size="sm" variant="ghost" className="text-rose-600" loading={busy === `s:${s.token_hash.slice(0, 8)}`} onClick={() => revoke(s)}>بستن</Button>
                  </div>
                ))}
              </div>
            )}
            {status?.locked_pairs && status.locked_pairs.length > 0 && (
              <div className="mt-3 rounded-xl bg-rose-500/8 p-3 text-[11px] leading-5 text-rose-600 dark:text-rose-300">
                قفل‌های فعال ورود (۵ تلاش ناموفق، ۱۰ دقیقه):{' '}
                {status.locked_pairs.map((l) => `${l.username} از ${l.ip} (${Math.ceil(l.remainingSec / 60)} دقیقهٔ دیگر)`).join('؛ ')}
              </div>
            )}
          </Card>
        </FadeIn>
      </div>

      <FadeIn delay={0.1}>
        <Card className="mt-5 max-w-xl">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold"><KeyRound className="size-4 text-brand-500" /> تغییر رمز حساب خودتان</div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1">
              <div className="mb-1 text-xs text-ink-500">رمز فعلی</div>
              <Input dir="ltr" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
            </div>
            <div className="min-w-48 flex-1">
              <div className="mb-1 text-xs text-ink-500">رمز جدید (حداقل ۱۰ کاراکتر)</div>
              <Input dir="ltr" type="password" value={nextPw} onChange={(e) => setNextPw(e.target.value)} />
            </div>
            <Button loading={busy === 'own'} onClick={changeOwn}>تغییر رمز</Button>
          </div>
          <div className="mt-2 text-[11px] text-ink-500">پس از تغییر، همهٔ نشست‌های شما بسته می‌شود و باید دوباره وارد شوید.</div>
        </Card>
      </FadeIn>

      <Modal open={resetFor !== null} onClose={() => setResetFor(null)} title={`بازنشانی رمز — ${resetFor?.display_name ?? ''}`}>
        <div className="space-y-3 text-sm">
          <Input dir="ltr" type="text" placeholder="رمز جدید (حداقل ۱۰ کاراکتر)" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <div className="text-[11px] text-amber-600 dark:text-amber-400">این عملیات همهٔ نشست‌های کاربر را می‌بندد و در حسابرسی ثبت می‌شود.</div>
          <div className="flex gap-2">
            <Button variant="danger" loading={busy === 'reset'} onClick={resetPw}>بازنشانی</Button>
            <Button variant="ghost" onClick={() => setResetFor(null)}>انصراف</Button>
          </div>
        </div>
      </Modal>

      <CreateUserModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); reload(); }} />
    </div>
  );
}

function CreateUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [f, setF] = React.useState({ username: '', displayName: '', role: 'viewer' as Role, password: '' });
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api('/api/users', { method: 'POST', body: JSON.stringify(f) });
      toast.push({ tone: 'success', title: 'کاربر ساخته شد', message: `@${f.username} با نقش ${ROLE_LABELS[f.role]}` });
      setF({ username: '', displayName: '', role: 'viewer', password: '' });
      onCreated();
    } catch (e) { toast.push({ tone: 'danger', title: 'خطا', message: e instanceof Error ? e.message : '' }); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="کاربر جدید">
      <div className="space-y-3 text-sm">
        <Input dir="ltr" placeholder="نام کاربری (انگلیسی)" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
        <Input placeholder="نام نمایشی" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} />
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })} className="focus-ring h-10 w-full rounded-xl border border-ink-300 bg-white px-3 text-sm dark:border-white/10 dark:bg-ink-900">
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <Input dir="ltr" type="text" placeholder="رمز عبور (حداقل ۱۰ کاراکتر)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <div className="flex gap-2">
          <Button loading={busy} disabled={f.username.length < 3 || f.displayName.length < 2 || f.password.length < 10} onClick={submit}>ساخت کاربر</Button>
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
        </div>
      </div>
    </Modal>
  );
}
