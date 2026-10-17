import { z } from 'zod';
import { ok, fail, handleError, readJson, requireAuth } from '@/server/http';
import { listSessions, revokeSession, revokeUserSessions } from '@/server/services/security';

export async function GET() {
  const auth = await requireAuth('admin.users');
  if ('response' in auth) return auth.response;
  return ok({ sessions: await listSessions() });
}

const schema = z.union([
  z.object({ action: z.literal('revoke'), tokenHash: z.string().min(10) }),
  z.object({ action: z.literal('revoke-user'), userId: z.string().min(3) }),
]);

export async function POST(req: Request) {
  const auth = await requireAuth('admin.users');
  if ('response' in auth) return auth.response;
  try {
    const body = schema.parse(await readJson(req));
    if (body.action === 'revoke') return ok(revokeSession(body.tokenHash, auth.user.username));
    const r = revokeUserSessions(body.userId, auth.user.username);
    if (body.userId === auth.user.id) return ok({ ...r, revoked_self: true });
    return ok(r);
  } catch (e) {
    return fail('INVALID_INPUT', 'ورودی نامعتبر است', 422);
  }
}
