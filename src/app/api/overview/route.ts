import { ok, requireAuth } from '@/server/http';
import { dashboardStats } from '@/server/services/hosts';
import { getDefaultWorkspace } from '@/server/services/workspace';
import { all } from '@/server/db';

export async function GET() {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  const ws = getDefaultWorkspace();
  const stats = dashboardStats(ws.id);
  const recentScans = all<{ id: string; profile: string; status: string; progress: number; created_at: string; demo: number }>(
    'SELECT id, profile, status, progress, created_at, demo FROM scan_jobs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 5', ws.id
  );
  const recentDeployments = all<{ id: string; status: string; plan_summary: string; created_at: string }>(
    'SELECT id, status, plan_summary, created_at FROM deployment_jobs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 5', ws.id
  );
  const recentRuns = all<{ id: string; rule_id: string; state: string; created_at: string }>(
    'SELECT id, rule_id, state, created_at FROM best_practice_runs ORDER BY created_at DESC LIMIT 6'
  );
  const recentHosts = all<{ id: string; hostname: string; ip: string; health: string; is_demo: number; last_seen_at: string }>(
    'SELECT id, hostname, ip, health, is_demo, last_seen_at FROM hosts WHERE workspace_id = ? ORDER BY last_seen_at DESC LIMIT 8', ws.id
  );
  return ok({ stats, recentScans, recentDeployments, recentRuns, recentHosts });
}
