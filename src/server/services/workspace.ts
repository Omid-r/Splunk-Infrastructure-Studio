import { get, run, all } from '@/server/db';
import { newId } from '@/server/core/crypto';
import type { Workspace } from '@/lib/types';

export function getDefaultWorkspace(): Workspace {
  let ws = get<Workspace>('SELECT * FROM workspaces ORDER BY created_at LIMIT 1');
  if (!ws) {
    const id = newId('ws');
    run(
      'INSERT INTO workspaces (id, name, description, site, timezone, owner, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, 'محیط پیش‌فرض', 'Workspace اولیه ساخته‌شده هنگام setup', 'Main DC', 'Asia/Tehran', 'admin', new Date().toISOString()
    );
    ws = get<Workspace>('SELECT * FROM workspaces WHERE id = ?', id)!;
  }
  return ws;
}

export function workspaceScopes(workspaceId: string): { ranges: string[]; exclusions: string[] } {
  const ranges = all<{ cidr: string }>('SELECT cidr FROM scope_ranges WHERE workspace_id = ?', workspaceId).map((r) => r.cidr);
  const exclusions = all<{ cidr: string }>('SELECT cidr FROM scope_exclusions WHERE workspace_id = ?', workspaceId).map((r) => r.cidr);
  return { ranges, exclusions };
}

export function setScopes(workspaceId: string, ranges: string[], exclusions: string[]): void {
  run('DELETE FROM scope_ranges WHERE workspace_id = ?', workspaceId);
  run('DELETE FROM scope_exclusions WHERE workspace_id = ?', workspaceId);
  for (const cidr of ranges) {
    run('INSERT INTO scope_ranges (id, workspace_id, cidr, created_at) VALUES (?, ?, ?, ?)', newId('scr'), workspaceId, cidr, new Date().toISOString());
  }
  for (const cidr of exclusions) {
    run('INSERT INTO scope_exclusions (id, workspace_id, cidr, reason, created_at) VALUES (?, ?, ?, ?, ?)', newId('sce'), workspaceId, cidr, '', new Date().toISOString());
  }
}
