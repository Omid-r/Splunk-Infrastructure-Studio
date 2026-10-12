import { z } from 'zod';
import { cookies } from 'next/headers';
import { ok, fail, handleError, readJson } from '@/server/http';
import { createSession, destroySession, SESSION_COOKIE, getSessionUser } from '@/server/core/session';
import { login, createUser, needsSetup } from '@/server/services/users';
import { setScopes } from '@/server/services/workspace';
import { clientIp } from '@/server/core/request';

const schema = z.object({
  username: z.string().min(3).max(64).regex(/^[\w.@-]+$/, 'نام کاربری فقط حروف، عدد و . _ @ -'),
  password: z.string().min(10, 'رمز باید حداقل ۱۰ کاراکتر باشد').max(128),
});

export async function POST(req: Request) {
  try {
    if (needsSetup()) return fail('SETUP_REQUIRED', 'ابتدا راه‌اندازی اولیه را انجام دهید', 428);
    const body = schema.parse(await readJson(req));
    const result = login(body.username, body.password, clientIp(req));
    if (!result.ok || !result.user) {
      return fail('AUTH_FAILED', result.error ?? 'ورود ناموفق', 401, result.lockedRemainingSec ? { lockedRemainingSec: result.lockedRemainingSec } : undefined);
    }
    const { token, expiresAt } = createSession(result.user.id);
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
      path: '/',
    });
    return ok({ user: result.user });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE() {
  const jar = await cookies();
  const signed = jar.get(SESSION_COOKIE)?.value;
  if (signed) destroySession(signed);
  jar.delete(SESSION_COOKIE);
  return ok({ ok: true });
}
