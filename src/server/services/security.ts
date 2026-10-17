import { all, get, run } from '@/server/db';
import { newId, hashPassword } from '@/server/core/crypto';
import { audit, verifyChain } from '@/server/core/audit';
import { currentTokenHash } from '@/server/core/session';
import { securityLocks } from '@/server/services/users';

export interface SessionInfo {
  token_hash: string;
  username: string;
  display_name: string;
  role: string;
  created_at: string;
  expires_at: string;
  current: number;
}

export async function listSessions(): Promise<SessionInfo[]> {
  const now = new Date().toISOString();
  const cur = await currentTokenHash();
  const rows = all<SessionInfo>(
    `SELECT s.token_hash, u.username, u.display_name, u.role, s.created_at, s.expires_at, 0 AS current
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.expires_at > ? ORDER BY s.created_at DESC`,
    now
  );
  return rows.map((r) => ({ ...r, token_hash: r.token_hash === cur ? r.token_hash : r.token_hash, current: r.token_hash === cur ? 1 : 0 }));
}

export function revokeSession(tokenHash: string, actor: string): { revoked: number } {
  const res = run('DELETE FROM sessions WHERE token_hash = ?', tokenHash);
  audit(actor, 'admin.session.revoke', `session:${tokenHash.slice(0, 12)}…`, 'success', newId('corr'));
  return { revoked: Number(res.changes ?? 0) };
}

export function revokeUserSessions(userId: string, actor: string): { revoked: number } {
  const res = run('DELETE FROM sessions WHERE user_id = ?', userId);
  audit(actor, 'admin.sessions.revoke_user', `user:${userId}`, 'success', newId('corr'));
  return { revoked: Number(res.changes ?? 0) };
}

export function adminResetPassword(userId: string, newPassword: string, actor: string): { ok: boolean; error?: string } {
  if (newPassword.length < 10) return { ok: false, error: 'رمز جدید باید حداقل ۱۰ کاراکتر باشد' };
  const user = get<{ username: string }>('SELECT username FROM users WHERE id = ?', userId);
  if (!user) return { ok: false, error: 'کاربر یافت نشد' };
  const { hash, salt } = hashPassword(newPassword);
  run('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?', hash, salt, userId);
  run('DELETE FROM sessions WHERE user_id = ?', userId);
  run('DELETE FROM auth_attempts WHERE username = ? AND ok = 0', user.username);
  audit(actor, 'admin.user.reset_password', `user:${user.username}`, 'success', newId('corr'));
  return { ok: true };
}

export function securityStatus(): Record<string, unknown> {
  const usersTotal = get<{ n: number }>('SELECT COUNT(*) AS n FROM users')?.n ?? 0;
  const usersActive = get<{ n: number }>('SELECT COUNT(*) AS n FROM users WHERE is_active = 1')?.n ?? 0;
  const openSessions = get<{ n: number }>('SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ?', new Date().toISOString())?.n ?? 0;
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const failed24h = get<{ n: number }>('SELECT COUNT(*) AS n FROM auth_attempts WHERE ok = 0 AND created_at > ?', dayAgo)?.n ?? 0;
  const locked = securityLocks();
  const chain = verifyChain();
  const lastAudit = get<{ created_at: string }>('SELECT created_at FROM audit_events ORDER BY created_at DESC LIMIT 1');
  return {
    users_total: usersTotal,
    users_active: usersActive,
    open_sessions: openSessions,
    failed_logins_24h: failed24h,
    locked_pairs: locked,
    audit_chain_ok: chain.ok,
    audit_chain_broken_at: chain.broken_at,
    last_audit_at: lastAudit?.created_at ?? null,
    session_secret_from_env: !!process.env.SESSION_SECRET && process.env.SESSION_SECRET !== 'CHANGE_ME_64_HEX_CHARS',
    encryption_key_from_env: !!process.env.SECRET_ENCRYPTION_KEY && process.env.SECRET_ENCRYPTION_KEY !== 'CHANGE_ME_64_HEX_CHARS',
  };
}
