import { cookies } from 'next/headers';
import { get, run } from '@/server/db';
import { hmac, randomToken, sha256, timingSafeEqualStr } from '@/server/core/crypto';
import type { Role, User } from '@/lib/types';

const COOKIE = 'sis_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s === 'CHANGE_ME_64_HEX_CHARS') {
    if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET must be set');
    return 'dev-only-insecure-session-secret';
  }
  return s;
}

export interface SessionUser extends User {
  expires_at: string;
}

export function createSession(userId: string): { token: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const token = randomToken();
  run(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    sha256(token),
    userId,
    expiresAt.toISOString(),
    new Date().toISOString()
  );
  const signed = `${token}.${hmac(token, sessionSecret())}`;
  return { token: signed, expiresAt };
}

export function destroySession(signedToken: string): void {
  const token = signedToken.split('.')[0];
  run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const signed = jar.get(COOKIE)?.value;
  if (!signed) return null;
  const [token, sig] = signed.split('.');
  if (!token || !sig || !timingSafeEqualStr(sig, hmac(token, sessionSecret()))) return null;
  const row = get<SessionUser & { expires_at: string }>(
    `SELECT u.id, u.username, u.display_name, u.role, u.is_active, u.created_at, u.last_login_at, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    sha256(token),
    new Date().toISOString()
  );
  if (!row || row.is_active !== 1) return null;
  return row;
}

export function setSessionCookie(token: string, expiresAt: Date): void {
  // note: called from route handlers where cookies() is mutable
  void expiresAt;
  void token;
}

export async function currentTokenHash(): Promise<string | null> {
  const jar = await cookies();
  const signed = jar.get(COOKIE)?.value;
  if (!signed) return null;
  const [token, sig] = signed.split('.');
  if (!token || !sig || !timingSafeEqualStr(sig, hmac(token, sessionSecret()))) return null;
  return sha256(token);
}

export { COOKIE as SESSION_COOKIE };
