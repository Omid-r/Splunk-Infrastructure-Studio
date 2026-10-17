import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSessionUser } from '@/server/core/session';
import { can, type Action } from '@/server/core/rbac';
import { ScopeError } from '@/server/core/scope';
import { bootstrap } from '@/server/bootstrap';
import type { SessionUser } from '@/server/core/session';
import type { Role } from '@/lib/types';

bootstrap();

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function fail(code: string, message: string, status = 400, details?: unknown): NextResponse {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export async function requireAuth(action?: Action): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getSessionUser();
  if (!user) {
    return { response: fail('UNAUTHORIZED', 'ابتدا وارد شوید', 401) };
  }
  if (action && !can(user.role as Role, action)) {
    return { response: fail('FORBIDDEN', 'دسترسی به این عملیات برای نقش شما مجاز نیست', 403) };
  }
  return { user };
}

export function handleError(e: unknown): NextResponse {
  if (e instanceof ScopeError) return fail('SCOPE_VIOLATION', e.message, 403);
  if (e instanceof ZodError) {
    return fail('INVALID_INPUT', 'ورودی نامعتبر است', 422, e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  const err = e as Error & { code?: string };
  if (err.code === 'PREFLIGHT_BLOCKED') return fail('PREFLIGHT_BLOCKED', err.message, 409);
  if (err.code === 'FORBIDDEN') return fail('FORBIDDEN', err.message, 403);
  if (err.code === 'NOT_FOUND') return fail('NOT_FOUND', err.message, 404);
  if (err.code === 'INVALID_INPUT') return fail('INVALID_INPUT', err.message, 422);
  return fail('INTERNAL', err.message || 'خطای داخلی سرور', 500);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
