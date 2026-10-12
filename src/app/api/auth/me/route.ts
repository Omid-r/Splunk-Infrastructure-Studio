import { ok } from '@/server/http';
import { getSessionUser } from '@/server/core/session';

export async function GET() {
  const user = await getSessionUser();
  return ok({ user });
}
