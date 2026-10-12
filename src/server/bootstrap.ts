import { get, run, getDb } from '@/server/db';
import { runMigrations } from '@/server/db/schema';
import { pruneAudit } from '@/server/core/audit';
import { BEST_PRACTICE_RULES } from '@/server/catalog/bestPractices';

let booted = false;

export function bootstrap(): void {
  if (booted) return;
  runMigrations(getDb());
  const count = get<{ n: number }>('SELECT COUNT(*) AS n FROM best_practice_rules');
  if (!count || count.n === 0) {
    for (const r of BEST_PRACTICE_RULES) {
      run(
        `INSERT INTO best_practice_rules (id, code, title, summary, rationale, risk, applicability, severity, source_url, source_title, version_note, sample_config, applies_to)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        r.id, r.code, r.title, r.summary, r.rationale, r.risk, r.applicability, r.severity,
        r.source_url, r.source_title, r.version_note, r.sample_config, JSON.stringify(r.applies_to)
      );
    }
  }
  const retention = Number(process.env.AUDIT_RETENTION_DAYS ?? 90);
  pruneAudit(retention);
  booted = true;
}
