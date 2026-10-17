import type { Role } from '@/lib/types';

export type Action =
  | 'workspace.manage'
  | 'scan.run'
  | 'host.view'
  | 'architecture.design'
  | 'deploy.run'
  | 'bestpractice.apply'
  | 'audit.view'
  | 'admin.users'
  | 'settings.manage'
  | 'demo.load'
  | 'lab.operate'
  | 'lab.search'
  | 'toolbox.run';

const MATRIX: Record<Action, Role[]> = {
  'workspace.manage': ['admin'],
  'scan.run': ['network_operator', 'splunk_admin', 'infra_admin', 'admin'],
  'host.view': ['viewer', 'network_operator', 'splunk_admin', 'infra_admin', 'auditor', 'admin'],
  'architecture.design': ['splunk_admin', 'infra_admin', 'admin'],
  'deploy.run': ['splunk_admin', 'infra_admin', 'admin'],
  'bestpractice.apply': ['splunk_admin', 'infra_admin', 'admin'],
  'audit.view': ['auditor', 'admin'],
  'admin.users': ['admin'],
  'settings.manage': ['admin'],
  'demo.load': ['network_operator', 'splunk_admin', 'infra_admin', 'admin'],
  'lab.operate': ['splunk_admin', 'infra_admin', 'admin'],
  'lab.search': ['viewer', 'network_operator', 'splunk_admin', 'infra_admin', 'auditor', 'admin'],
  'toolbox.run': ['network_operator', 'splunk_admin', 'infra_admin', 'admin'],
};

export function can(role: Role, action: Action): boolean {
  return MATRIX[action]?.includes(role) ?? false;
}

export function requireRole(role: Role, action: Action): void {
  if (!can(role, action)) {
    const err = new Error('دسترسی به این عملیات برای نقش شما مجاز نیست') as Error & { code: string };
    err.code = 'FORBIDDEN';
    throw err;
  }
}
