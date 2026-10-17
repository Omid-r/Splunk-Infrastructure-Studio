export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '0001_initial',
    sql: `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  site TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'Asia/Tehran',
  owner TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scope_ranges (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  cidr TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scope_exclusions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  cidr TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credential_refs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'ssh',
  secret_enc TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hosts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  hostname TEXT NOT NULL,
  ip TEXT NOT NULL,
  os TEXT NOT NULL DEFAULT 'Unknown',
  os_version TEXT,
  arch TEXT,
  cpu TEXT,
  ram_gb REAL,
  disk_total_gb REAL,
  disk_free_gb REAL,
  uptime_sec INTEGER,
  role TEXT,
  health TEXT NOT NULL DEFAULT 'unknown',
  status_label TEXT NOT NULL DEFAULT 'نامشخص',
  tags TEXT NOT NULL DEFAULT '[]',
  owner TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'scan'
);
CREATE INDEX IF NOT EXISTS idx_hosts_ws ON hosts(workspace_id);

CREATE TABLE IF NOT EXISTS host_ports (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL REFERENCES hosts(id),
  port INTEGER NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'tcp',
  service TEXT NOT NULL DEFAULT 'unknown',
  state TEXT NOT NULL DEFAULT 'open',
  observed_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'tcp-connect'
);
CREATE INDEX IF NOT EXISTS idx_ports_host ON host_ports(host_id);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL REFERENCES hosts(id),
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'observed',
  observed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_obs_host ON observations(host_id);

CREATE TABLE IF NOT EXISTS scan_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  profile TEXT NOT NULL,
  targets TEXT NOT NULL,
  exclusions TEXT NOT NULL DEFAULT '[]',
  ports TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'queued',
  progress REAL NOT NULL DEFAULT 0,
  total_hosts INTEGER NOT NULL DEFAULT 0,
  scanned_hosts INTEGER NOT NULL DEFAULT 0,
  hosts_up INTEGER NOT NULL DEFAULT 0,
  open_ports INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  demo INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS topology_snapshots (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  nodes TEXT NOT NULL,
  edges TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS architecture_designs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  environment_goal TEXT NOT NULL,
  sizing TEXT NOT NULL DEFAULT '{}',
  nodes TEXT NOT NULL DEFAULT '[]',
  assumptions TEXT NOT NULL DEFAULT '[]',
  ingest_gb_day REAL,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deployment_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  architecture_id TEXT REFERENCES architecture_designs(id),
  target_mode TEXT NOT NULL DEFAULT 'local_lab',
  status TEXT NOT NULL DEFAULT 'queued',
  plan_summary TEXT NOT NULL DEFAULT '',
  preflight TEXT,
  progress REAL NOT NULL DEFAULT 0,
  error TEXT,
  validation TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS job_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  message TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_job_events ON job_events(job_id);

CREATE TABLE IF NOT EXISTS best_practice_rules (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  rationale TEXT NOT NULL,
  risk TEXT NOT NULL,
  applicability TEXT NOT NULL,
  severity TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  version_note TEXT NOT NULL DEFAULT '',
  sample_config TEXT,
  applies_to TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS best_practice_runs (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES best_practice_rules(id),
  target TEXT NOT NULL DEFAULT 'local_lab',
  state TEXT NOT NULL DEFAULT 'pending',
  diff TEXT,
  result TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  outcome TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`,
  },
  {
    id: '0002_audit_event_ids',
    sql: `
UPDATE audit_events SET id = 'aud_' || lower(hex(randomblob(9))) WHERE id IS NULL;
`,
  },
  {
    id: '0003_lab_runtime',
    sql: `
CREATE TABLE IF NOT EXISTS lab_nodes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  conf_dir TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'stopped',
  ingest_port INTEGER,
  mgmt_port INTEGER,
  events_stored INTEGER NOT NULL DEFAULT 0,
  last_started_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (workspace_id, name)
);
CREATE INDEX IF NOT EXISTS idx_lab_nodes_ws ON lab_nodes(workspace_id);
`,
  },
  {
    id: '0004_diagnostic_runs',
    sql: `
CREATE TABLE IF NOT EXISTS diagnostic_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  items TEXT NOT NULL DEFAULT '[]',
  summary TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_diag_created ON diagnostic_runs(created_at);
`,
  },
  {
    id: '0005_toolbox_runs',
    sql: `
CREATE TABLE IF NOT EXISTS toolbox_runs (
  id TEXT PRIMARY KEY,
  tool TEXT NOT NULL,
  target TEXT NOT NULL,
  ok INTEGER NOT NULL,
  summary TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_toolbox_created ON toolbox_runs(created_at);
`,
  },
  {
    id: '0006_auth_attempts',
    sql: `
CREATE TABLE IF NOT EXISTS auth_attempts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  ip TEXT NOT NULL,
  ok INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_pair ON auth_attempts(username, ip, created_at);
`,
  },
  {
    id: '0007_scan_snapshots',
    sql: `
CREATE TABLE IF NOT EXISTS scan_snapshots (
  job_id TEXT PRIMARY KEY REFERENCES scan_jobs(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  created_at TEXT NOT NULL,
  host_count INTEGER NOT NULL DEFAULT 0,
  port_count INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_snapshots_ws ON scan_snapshots(workspace_id, created_at);
`,
  },
];

import type { DatabaseSync } from 'node:sqlite';

export function runMigrations(db: DatabaseSync): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );`);
  const stmt = db.prepare('SELECT id FROM schema_migrations WHERE id = ?');
  const insert = db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)');
  for (const m of MIGRATIONS) {
    const row = stmt.get(m.id) as { id: string } | undefined;
    if (!row) {
      db.exec(m.sql);
      insert.run(m.id, new Date().toISOString());
    }
  }
}
