import { ok, requireAuth } from '@/server/http';
import { all, get } from '@/server/db';
import { verifyChain } from '@/server/core/audit';
import type { AuditEvent } from '@/lib/types';

export async function GET(request: Request) {
  const auth = await requireAuth('audit.view');
  if ('response' in auth) return auth.response;
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get('page_size') ?? '30') || 30));
  const actor = (url.searchParams.get('actor') ?? '').trim();
  const where = actor ? 'WHERE actor = ?' : '';
  const args: unknown[] = actor ? [actor] : [];
  const { total } = get<{ total: number }>(`SELECT COUNT(*) AS total FROM audit_events ${where}`, ...args) ?? { total: 0 };
  const events = all<AuditEvent>(
    `SELECT * FROM audit_events ${where} ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`,
    ...args, pageSize, (page - 1) * pageSize,
  );
  return ok({ events, total, page, page_size: pageSize, chain: verifyChain() });
}
