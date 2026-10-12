import { all, run } from '@/server/db';
import { newId } from '@/server/core/crypto';

export type JobLevel = 'info' | 'success' | 'warning' | 'error';

export interface JobEventRow {
  id: string;
  job_id: string;
  job_type: string;
  message: string;
  level: JobLevel;
  created_at: string;
}

export function emitJobEvent(jobId: string, jobType: string, message: string, level: JobLevel = 'info'): void {
  run(
    'INSERT INTO job_events (id, job_id, job_type, message, level, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    newId('ev'), jobId, jobType, message, level, new Date().toISOString()
  );
}

export function eventsAfter(jobId: string, afterId: string | null, limit = 200): JobEventRow[] {
  if (afterId) {
    const anchor = all<{ id: string; rowid: number } & object>(
      'SELECT id, rowid FROM job_events WHERE job_id = ? ORDER BY rowid'
    , jobId) as unknown as { id: string; rowid: number }[];
    const idx = anchor.findIndex((r) => r.id === afterId);
    const afterRowid = idx >= 0 ? anchor[idx].rowid : -1;
    if (idx === -1 && afterId) {
      return all<JobEventRow>(
        'SELECT * FROM job_events WHERE job_id = ? ORDER BY rowid LIMIT ?', jobId, limit
      );
    }
    return all<JobEventRow>(
      'SELECT * FROM job_events WHERE job_id = ? AND rowid > ? ORDER BY rowid LIMIT ?',
      jobId, afterRowid, limit
    );
  }
  return all<JobEventRow>('SELECT * FROM job_events WHERE job_id = ? ORDER BY rowid LIMIT ?', jobId, limit);
}

export function isCancelled(jobTable: 'scan_jobs' | 'deployment_jobs', jobId: string): boolean {
  const row = all<{ status: string }>(`SELECT status FROM ${jobTable} WHERE id = ?`, jobId)[0];
  return row?.status === 'cancelled';
}
