import { z } from 'zod';
import { ok, fail, requireAuth } from '@/server/http';
import { adminResetPassword } from '@/server/services/security';

const schema = z.object({ id: z.string(), password: z.string().min(10).max(128) });

export async function POST(req: Request) {
  const auth = await requireAuth('admin.users');
  if ('response' in auth) return auth.response;
  try {
    const body = schema.parse(await req.json());
    const res = adminResetPassword(body.id, body.password, auth.user.username);
    if (!res.ok) return fail('INVALID_INPUT', res.error ?? 'خطا', 422);
    return ok({ ok: true });
  } catch (e) {
    const err = e as Error & { code?: string };
    return fail('INVALID_INPUT', err.message || 'ورودی نامعتبر است', 422);
  }
}
