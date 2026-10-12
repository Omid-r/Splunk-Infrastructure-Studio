import { all, get, run, tx } from '@/server/db';
import { hashPassword, newId, sha256 } from '@/server/core/crypto';
import { audit } from '@/server/core/audit';
import type { Role, User } from '@/lib/types';

const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;
const attempts = new Map<string, { count: number; lockedUntil: number }>();

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
  const key = `${ip}:${username}`;
  const rec = attempts.get(key);
  if (rec && rec.lockedUntil > Date.now()) {
    return { ok: false, error: 'حساب موقتاً قفل شده است؛ دوباره تلاش کنید', lockedRemainingSec: Math.ceil((rec.lockedUntil - Date.now()) / 1000) };
  }
  const user = get<User & { password_hash: string; password_salt: string }>(
    'SELECT * FROM users WHERE username = ? AND is_active = 1', username
  );
  const okPw = user ? verifySafe(password, user.password_hash, user.password_salt) : false;
  if (!user || !okPw) {
    const next = rec ?? { count: 0, lockedUntil: 0 };
    next.count += 1;
    if (next.count >= MAX_ATTEMPTS) {
      next.lockedUntil = Date.now() + LOCK_MS;
      next.count = 0;
    }
    attempts.set(key, next);
    audit(username, 'auth.login_failed', `ip:${ip}`, 'failure', newId('corr'));
    return { ok: false, error: 'نام کاربری یا رمز عبور نادرست است' };
  }
  attempts.delete(key);
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
  return { ok: true };
}

export { sha256 };
