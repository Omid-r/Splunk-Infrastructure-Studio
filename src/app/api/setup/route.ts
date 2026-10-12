import { z } from 'zod';
import { cookies } from 'next/headers';
import { ok, fail, handleError, readJson } from '@/server/http';
import { createUser, needsSetup } from '@/server/services/users';
import { setScopes, getDefaultWorkspace } from '@/server/services/workspace';
import { createSession, SESSION_COOKIE } from '@/server/core/session';
import { parseCidr } from '@/server/core/scope';
import { audit } from '@/server/core/audit';
import { newId } from '@/server/core/crypto';
import { clientIp } from '@/server/core/request';

export async function GET() {
  return ok({ needsSetup: needsSetup() });
}

const schema = z.object({
  username: z.string().min(3).max(64).regex(/^[\w.@-]+$/),
  password: z.string().min(10).max(128),
  displayName: z.string().min(2).max(128),
  workspaceName: z.string().min(2).max(128),
  scopes: z.array(z.string()).min(1, 'حداقل یک محدوده مجاز لازم است').max(50),
});

export async function POST(req: Request) {
  try {
    if (!needsSetup()) return fail('ALREADY_SETUP', 'راه‌اندازی اولیه قبلاً انجام شده است', 409);
    const body = schema.parse(await readJson(req));
    for (const s of body.scopes) {
      const cidr = s.includes('/') ? s : `${s}/32`;
      parseCidr(cidr);
      if (cidr.endsWith('/0')) return fail('SCOPE_VIOLATION', '0.0.0.0/0 مجاز نیست', 403);
    }
    const user = createUser({ username: body.username, displayName: body.displayName, role: 'admin', password: body.password });
    const ws = getDefaultWorkspace();
    setScopes(ws.id, body.scopes.map((s) => (s.includes('/') ? s : `${s}/32`)), []);
    audit(body.username, 'setup.completed', `workspace:${ws.id}`, 'success', newId('corr'));
    void clientIp(req);
    const { token, expiresAt } = createSession(user.id);
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', expires: expiresAt, path: '/',
    });
    return ok({ user, workspace: ws });
  } catch (e) {
    return handleError(e);
  }
}
