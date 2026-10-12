import { z } from 'zod';
import { ok, fail, handleError, readJson, requireAuth } from '@/server/http';
import { createUser, listUsers, setUserActive } from '@/server/services/users';
import { audit } from '@/server/core/audit';
import { newId } from '@/server/core/crypto';
import type { Role } from '@/lib/types';

export async function GET() {
  const auth = await requireAuth('admin.users');
  if ('response' in auth) return auth.response;
  return ok({ users: listUsers() });
}

const schema = z.object({
  username: z.string().min(3).max(64).regex(/^[\w.@-]+$/),
  displayName: z.string().min(2).max(128),
  role: z.enum(['viewer', 'network_operator', 'splunk_admin', 'infra_admin', 'auditor', 'admin']),
  password: z.string().min(10).max(128),
});

export async function POST(req: Request) {
  const auth = await requireAuth('admin.users');
  if ('response' in auth) return auth.response;
  try {
    const body = schema.parse(await readJson(req));
    const user = createUser(body as { username: string; displayName: string; role: Role; password: string });
    audit(auth.user.username, 'user.create', `user:${user.id}`, 'success', newId('corr'));
    return ok({ user }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAuth('admin.users');
  if ('response' in auth) return auth.response;
  try {
    const body = z.object({ id: z.string(), active: z.boolean() }).parse(await readJson(req));
    if (body.id === auth.user.id && !body.active) {
      return fail('INVALID_INPUT', 'نمی‌توانید حساب خودتان را غیرفعال کنید', 422);
    }
    setUserActive(body.id, body.active, auth.user.username);
    return ok({ users: listUsers() });
  } catch (e) {
    return handleError(e);
  }
}
