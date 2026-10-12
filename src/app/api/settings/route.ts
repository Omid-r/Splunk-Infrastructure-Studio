import { z } from 'zod';
import { ok, handleError, readJson, requireAuth } from '@/server/http';
import { get, run, all } from '@/server/db';
import { getDefaultWorkspace, setScopes, workspaceScopes } from '@/server/services/workspace';
import { parseCidr } from '@/server/core/scope';
import { audit } from '@/server/core/audit';
import { newId } from '@/server/core/crypto';
import type { Workspace } from '@/lib/types';

export async function GET() {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  const ws = getDefaultWorkspace();
  const scopes = workspaceScopes(ws.id);
  const settings = Object.fromEntries(all<{ key: string; value: string }>('SELECT key, value FROM settings').map((s) => [s.key, s.value]));
  return ok({
    workspace: ws,
    scopes,
    app: {
      port: process.env.APP_PORT ?? '8443',
      host: process.env.APP_HOST ?? '127.0.0.1',
      audit_retention_days: Number(process.env.AUDIT_RETENTION_DAYS ?? 90),
      scan_max_hosts: Number(process.env.SCAN_MAX_HOSTS ?? 1024),
      tls_in_dev: 'self-signed via npm run dev:https (warning expected)',
    },
    settings,
  });
}

const schema = z.object({
  workspaceName: z.string().min(2).max(128).optional(),
  scopes: z.array(z.string()).max(50).optional(),
  exclusions: z.array(z.string()).max(50).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuth('settings.manage');
  if ('response' in auth) return auth.response;
  try {
    const body = schema.parse(await readJson(req));
    const ws = getDefaultWorkspace();
    if (body.workspaceName) {
      run('UPDATE workspaces SET name = ? WHERE id = ?', body.workspaceName, ws.id);
    }
    if (body.scopes) {
      for (const s of body.scopes) {
        const cidr = s.includes('/') ? s : `${s}/32`;
        parseCidr(cidr);
        if (cidr.endsWith('/0')) return ok({ error: 'SCOPE_VIOLATION' }, { status: 403 });
      }
      const current = workspaceScopes(ws.id);
      setScopes(ws.id, body.scopes.map((s) => (s.includes('/') ? s : `${s}/32`)), body.exclusions ?? current.exclusions);
    } else if (body.exclusions) {
      const current = workspaceScopes(ws.id);
      setScopes(ws.id, current.ranges, body.exclusions);
    }
    audit(auth.user.username, 'settings.update', `workspace:${ws.id}`, 'success', newId('corr'));
    const ws2 = get<Workspace>('SELECT * FROM workspaces WHERE id = ?', ws.id)!;
    return ok({ workspace: ws2, scopes: workspaceScopes(ws.id) });
  } catch (e) {
    return handleError(e);
  }
}
