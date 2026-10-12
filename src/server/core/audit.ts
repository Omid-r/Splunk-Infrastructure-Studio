import { all, get, run } from '@/server/db';
import { sha256 } from '@/server/core/crypto';
import type { AuditEvent } from '@/lib/types';

export function audit(actor: string, action: string, target: string, outcome: string, correlationId: string): void {
  const last = get<{ hash: string }>('SELECT hash FROM audit_events ORDER BY created_at DESC, rowid DESC LIMIT 1');
  const prevHash = last?.hash ?? 'GENESIS';
  const createdAt = new Date().toISOString();
  const material = [actor, action, target, outcome, correlationId, createdAt, prevHash].join('|');
  const hash = sha256(material);
  run(
    'INSERT INTO audit_events (actor, action, target, outcome, correlation_id, prev_hash, hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    actor, action, target, outcome, correlationId, prevHash, hash, createdAt
  );
}

export function verifyChain(): { ok: boolean; broken_at: string | null } {
  const rows = all<AuditEvent>('SELECT * FROM audit_events ORDER BY created_at, rowid');
  let prev = 'GENESIS';
  for (const r of rows) {
    if (r.prev_hash !== prev) return { ok: false, broken_at: r.id };
    const material = [r.actor, r.action, r.target, r.outcome, r.correlation_id, r.created_at, r.prev_hash].join('|');
    if (sha256(material) !== r.hash) return { ok: false, broken_at: r.id };
    prev = r.hash;
  }
  return { ok: true, broken_at: null };
}

export function pruneAudit(retentionDays: number): void {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 3600 * 1000).toISOString();
  run('DELETE FROM audit_events WHERE created_at < ?', cutoff);
  run('DELETE FROM job_events WHERE created_at < ?', cutoff);
}
