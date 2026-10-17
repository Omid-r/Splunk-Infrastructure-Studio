import { all, get, run, tx } from '@/server/db';
import { hashPassword, newId, sha256 } from '@/server/core/crypto';
import { audit } from '@/server/core/audit';
import type { Role, User } from '@/lib/types';

const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;

function recordAttempt(username: string, ip: string, ok: boolean): void {
  run('INSERT INTO auth_attempts (id, username, ip, ok, created_at) VALUES (?, ?, ?, ?, ?)',
    newId('att'), username, ip, ok ? 1 : 0, new Date().toISOString());
}

function lockState(username: string, ip: string): { locked: boolean; remainingSec: number } {
  const fails = all<{ created_at: string }>(
    'SELECT created_at FROM auth_attempts WHERE username = ? AND ip = ? AND ok = 0 AND created_at > ? ORDER BY created_at DESC LIMIT ?',
    username, ip, new Date(Date.now() - LOCK_MS).toISOString(), MAX_ATTEMPTS
  );
  if (fails.length < MAX_ATTEMPTS) return { locked: false, remainingSec: 0 };
  const oldest = new Date(fails[fails.length - 1].created_at).getTime();
  const remaining = LOCK_MS - (Date.now() - oldest);
  if (remaining <= 0) return { locked: false, remainingSec: 0 };
  return { locked: true, remainingSec: Math.ceil(remaining / 1000) };
}

export function userCount(): number {
  return get<{ n: number }>('SELECT COUNT(*) AS n FROM users')?.n ?? 0;
}

export function needsSetup(): boolean {
  return userCount() === 0;
}

export function createUser(input: { username: string; displayName: string; role: Role; password: string }): User {
  const id = newId('usr');
  const { hash, salt } = hashPassword(input.password);
  run(
    'INSERT INTO users (id, username, display_name, role, password_hash, password_salt, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
    id, input.username, input.displayName, input.role, hash, salt, new Date().toISOString()
  );
  return get<User>('SELECT id, username, display_name, role, is_active, created_at, last_login_at FROM users WHERE id = ?', id)!;
}

export interface LoginResult {
  ok: boolean;
  user?: User;
  error?: string;
  lockedRemainingSec?: number;
}

export function login(username: string, password: string, ip: string): LoginResult {
  const lock = lockState(username, ip);
  if (lock.locked) {
    return { ok: false, error: 'حساب موقتاً قفل شده است؛ دوباره تلاش کنید', lockedRemainingSec: lock.remainingSec };
  }
  const user = get<User & { password_hash: string; password_salt: string }>(
    'SELECT * FROM users WHERE username = ? AND is_active = 1', username
  );
  const okPw = user ? verifySafe(password, user.password_hash, user.password_salt) : false;
  if (!user || !okPw) {
    recordAttempt(username, ip, false);
    audit(username, 'auth.login_failed', `ip:${ip}`, 'failure', newId('corr'));
    const after = lockState(username, ip);
    return {
      ok: false,
      error: after.locked ? 'حساب موقتاً قفل شده است؛ دوباره تلاش کنید' : 'نام کاربری یا رمز عبور نادرست است',
      lockedRemainingSec: after.locked ? after.remainingSec : undefined,
    };
  }
  recordAttempt(username, ip, true);
  run('DELETE FROM auth_attempts WHERE username = ? AND ip = ? AND ok = 0', username, ip);
  run('UPDATE users SET last_login_at = ? WHERE id = ?', new Date().toISOString(), user.id);
  const { password_hash, password_salt, ...safe } = user;
  void password_hash; void password_salt;
  audit(username, 'auth.login', `user:${user.id}`, 'success', newId('corr'));
  return { ok: true, user: safe };
}

import { verifyPassword } from '@/server/core/crypto';
function verifySafe(password: string, hash: string, salt: string): boolean {
  try {
    return verifyPassword(password, hash, salt);
  } catch {
    return false;
  }
}

export function listUsers(): User[] {
  return all<User>('SELECT id, username, display_name, role, is_active, created_at, last_login_at FROM users ORDER BY created_at');
}

export function setUserActive(id: string, active: boolean, actor: string): void {
  run('UPDATE users SET is_active = ? WHERE id = ?', active ? 1 : 0, id);
  audit(actor, active ? 'user.activate' : 'user.deactivate', `user:${id}`, 'success', newId('corr'));
}

export function changePassword(id: string, current: string, next: string): { ok: boolean; error?: string } {
  const user = get<{ password_hash: string; password_salt: string }>('SELECT password_hash, password_salt FROM users WHERE id = ?', id);
  if (!user) return { ok: false, error: 'کاربر یافت نشد' };
  if (!verifySafe(current, user.password_hash, user.password_salt)) return { ok: false, error: 'رمز فعلی نادرست است' };
  if (next.length < 10) return { ok: false, error: 'رمز جدید باید حداقل ۱۰ کاراکتر باشد' };
  const { hash, salt } = hashPassword(next);
  run('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?', hash, salt, id);
  run('DELETE FROM sessions WHERE user_id = ?', id);
  const uname = get<{ username: string }>('SELECT username FROM users WHERE id = ?', id)?.username;
  if (uname) run('DELETE FROM auth_attempts WHERE username = ? AND ok = 0', uname);
  return { ok: true };
}

export function securityLocks(): { username: string; ip: string; remainingSec: number }[] {
  const pairs = all<{ username: string; ip: string }>(
    'SELECT DISTINCT username, ip FROM auth_attempts WHERE ok = 0 AND created_at > ?',
    new Date(Date.now() - LOCK_MS).toISOString()
  );
  return pairs
    .map((p) => ({ username: p.username, ip: p.ip, remainingSec: lockState(p.username, p.ip).remainingSec }))
    .filter((p) => p.remainingSec > 0);
}

export { sha256 };
