export type Role = 'viewer' | 'network_operator' | 'splunk_admin' | 'infra_admin' | 'auditor' | 'admin';

export interface User {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  is_active: number;
  created_at: string;
  last_login_at: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  site: string;
  timezone: string;
  owner: string;
  created_at: string;
}

export type ScanStatus = 'queued' | 'running' | 'waiting_approval' | 'success' | 'warning' | 'failed' | 'cancelled';

export type ScanProfile = 'quick' | 'standard' | 'credentialed';

export interface ScanJob {
  id: string;
  workspace_id: string;
  profile: ScanProfile;
  targets: string[];
  exclusions: string[];
  ports: number[];
  status: ScanStatus;
  progress: number;
  total_hosts: number;
  scanned_hosts: number;
  hosts_up: number;
  open_ports: number;
  error: string | null;
  demo: number;
  created_by: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface Host {
  id: string;
  workspace_id: string;
  hostname: string;
  ip: string;
  os: string;
  os_version: string | null;
  arch: string | null;
  cpu: string | null;
  ram_gb: number | null;
  disk_total_gb: number | null;
  disk_free_gb: number | null;
  uptime_sec: number | null;
  role: string | null;
  health: 'healthy' | 'warning' | 'critical' | 'unknown';
  status_label: string;
  tags: string;
  owner: string | null;
  is_demo: number;
  first_seen_at: string;
  last_seen_at: string;
  source: string;
}

export interface HostPort {
  id: string;
  host_id: string;
  port: number;
  protocol: string;
  service: string;
  state: string;
  observed_at: string;
  source: string;
}

export interface Observation {
  id: string;
  host_id: string;
  kind: string;
  key: string;
  value: string;
  source: string;
  confidence: 'observed' | 'inferred' | 'unknown';
  observed_at: string;
}

export interface TopologyNode {
  id: string;
  kind: 'host' | 'subnet' | 'firewall' | 'splunk';
  label: string;
  sub?: string;
  hostId?: string;
  demo?: boolean;
  x?: number;
  y?: number;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  kind: 'observed' | 'membership' | 'management' | 'dataflow' | 'inferred';
  label?: string;
}

export interface TopologySnapshot {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  generated_at: string;
}

export interface SplunkNodeSpec {
  role: string;
  count: number;
  cpu: number;
  ram_gb: number;
  storage_gb: number;
  reason: string;
}

export interface ArchitectureDesign {
  id: string;
  workspace_id: string;
  name: string;
  environment_goal: string;
  sizing: Record<string, unknown>;
  nodes: SplunkNodeSpec[];
  assumptions: string[];
  ingest_gb_day: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export type JobStatus = ScanStatus;

export interface DeploymentJob {
  id: string;
  workspace_id: string;
  architecture_id: string | null;
  target_mode: 'local_lab';
  status: JobStatus;
  plan_summary: string;
  preflight: PreflightItem[] | null;
  progress: number;
  error: string | null;
  validation: ValidationItem[] | null;
  created_by: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface PreflightItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  check: string;
  detail: string;
  passed: boolean;
}

export interface ValidationItem {
  check: string;
  status: 'pass' | 'fail' | 'not_verified';
  detail: string;
}

export interface BestPracticeRule {
  id: string;
  code: string;
  title: string;
  summary: string;
  rationale: string;
  risk: string;
  applicability: string;
  severity: 'critical' | 'warning' | 'info';
  source_url: string;
  source_title: string;
  version_note: string;
  sample_config: string | null;
  applies_to: string[];
}

export interface BestPracticeRun {
  id: string;
  rule_id: string;
  target: string;
  state: 'pending' | 'applied' | 'failed' | 'skipped';
  diff: string | null;
  result: string | null;
  created_by: string;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  target: string;
  outcome: string;
  correlation_id: string;
  created_at: string;
  prev_hash: string;
  hash: string;
}

export interface SplunkVersionEntry {
  version: string;
  status: 'supported' | 'legacy' | 'eol';
  os_support: string[];
  architectures: string[];
  source_url: string;
  checked_at: string;
  note: string;
}

export interface DashboardStats {
  hosts: number;
  hosts_up: number;
  networks: number;
  open_ports: number;
  last_scan_at: string | null;
  stale_hosts: number;
  recent_changes: number;
  demo_hosts: number;
  deployments_total: number;
  deployments_failed: number;
  scans_total: number;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface LabForwardStat {
  target: string;
  ok: number;
  fail: number;
  lastError: string | null;
}

export interface LabNode {
  id: string;
  workspace_id: string;
  name: string;
  role: string;
  conf_dir: string;
  status: 'running' | 'stopped';
  ingest_port: number | null;
  mgmt_port: number | null;
  events_stored: number;
  last_started_at: string | null;
  created_at: string;
  events_received: number;
  events_forwarded: number;
  mode: 'store' | 'forward' | null;
  forward_stats: LabForwardStat[];
  started_at: string | null;
}

export interface LabSearchResult {
  query: string;
  searched_nodes: string[];
  skipped_forwarders: string[];
  matched: number;
  events: { ts: string; node: string; raw: string }[];
  per_node: Record<string, number>;
  completed_at: string;
}

export type DiagnosticFixKind =
  | 'start-node'
  | 'restart-node'
  | 'enable-splunktcp'
  | 'start-target-node'
  | 'create-spool-dir'
  | null;

export interface DiagnosticItem {
  id: string;
  node: string | null;
  nodeId: string | null;
  check: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  fixKind: DiagnosticFixKind;
  fixNote: string | null;
  fixTarget: string | null;
}

export interface DiagnosticRun {
  id: string;
  workspace_id: string;
  items: DiagnosticItem[];
  summary: string;
  created_by: string;
  created_at: string;
}
