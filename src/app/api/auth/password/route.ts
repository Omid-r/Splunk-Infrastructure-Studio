import { z } from 'zod';
import { ok, fail, requireAuth } from '@/server/http';
import { changePassword } from '@/server/services/users';
import { audit } from '@/server/core/audit';
import { newId } from '@/server/core/crypto';

const schema = z.object({ current: z.string().min(1).max(128), next: z.string().min(10).max(128) });

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  try {
    const body = schema.parse(await req.json());
    const res = changePassword(auth.user.id, body.current, body.next);
    if (!res.ok) {
      audit(auth.user.username, 'auth.password_change_failed', `user:${auth.user.id}`, 'failure', newId('corr'));
      return fail('INVALID_INPUT', res.error ?? 'خطا', 422);
    }
    audit(auth.user.username, 'auth.password_change', `user:${auth.user.id}`, 'success', newId('corr'));
    return ok({ ok: true, note: 'همهٔ نشست‌های شما بسته شد؛ باید دوباره وارد شوید' });
  } catch (e) {
    const err = e as Error & { code?: string };
    return fail('INVALID_INPUT', err.message || 'ورودی نامعتبر است', 422);
  }
}
