import { all, get, run } from '@/server/db';
import { newId } from '@/server/core/crypto';
import { audit } from '@/server/core/audit';
import type { ArchitectureDesign, SplunkNodeSpec } from '@/lib/types';

export interface ArchitectureInput {
  goal: 'poc' | 'small' | 'enterprise' | 'ha' | 'dr';
  ingest_gb_day: number;
  peak_gb_day: number;
  retention_days: number;
  search_users: number;
  workload: 'light' | 'mixed' | 'heavy';
  growth_pct_year: number;
  sites: number;
  name?: string;
}

export function generateArchitecture(input: ArchitectureInput): { nodes: SplunkNodeSpec[]; assumptions: string[] } {
  const assumptions: string[] = [];
  const nodes: SplunkNodeSpec[] = [];
  const ingest = Math.max(0, input.ingest_gb_day);
  const isLab = input.goal === 'poc';
  const isHa = input.goal === 'ha' || input.goal === 'dr' || input.sites > 1;

  if (ingest <= 0) {
    assumptions.push('نرخ ingest مشخص نشده؛ برآوردها بر پایه حداقل پیکربندی انجام شده و قطعی نیستند.');
  }
  if (input.peak_gb_day > 0 && input.peak_gb_day < ingest) {
    assumptions.push('مقدار peak از میانگین کمتر است؛ از میانگین برای sizing استفاده شد.');
  }
  const effectiveIngest = Math.max(ingest, input.peak_gb_day, 1);

  const idxCapacityPerNode = 150;
  const indexerCount = isLab ? 1 : Math.max(1, Math.ceil(effectiveIngest / idxCapacityPerNode));

  if (isLab) {
    nodes.push({
      role: 'Standalone', count: 1, cpu: 8, ram_gb: 16, storage_gb: Math.max(200, Math.round(effectiveIngest * input.retention_days * 0.55)),
      reason: 'محیط lab/POC — همه نقش‌ها روی یک نود؛ مناسب یادگیری و اعتبارسنجی، نه production',
    });
    assumptions.push('Standalone برای POC طراحی شده و SLAای برای availability ندارد.');
    return { nodes, assumptions };
  }

  if (!isHa && indexerCount <= 1 && effectiveIngest < 100) {
    nodes.push({ role: 'Search Head', count: 1, cpu: 8, ram_gb: 16, storage_gb: 200, reason: 'جستجو و داشبورد — برای حجم کم ingest' });
    nodes.push({ role: 'Indexer', count: 1, cpu: 12, ram_gb: 24, storage_gb: Math.max(500, Math.round(effectiveIngest * input.retention_days * 0.55)), reason: 'ایندکس‌گری داده — نود اصلی ذخیره‌سازی' });
    nodes.push({ role: 'Universal Forwarder', count: Math.max(1, Math.round(effectiveIngest / 10)), cpu: 2, ram_gb: 4, storage_gb: 20, reason: 'جمع‌آوری رویداد از منابع — تقریبی' });
    assumptions.push('توپولوژی distributed ساده؛ برای HA واقعی نیاز به clustering است.');
    return { nodes, assumptions };
  }

  const sites = Math.max(1, input.sites);
  const idxPerSite = Math.max(isHa ? 2 : 1, Math.ceil(indexerCount / sites));
  if (isHa) {
    assumptions.push(`Indexer Cluster با replication_factor=2 فرض شده؛ حداقل 2 peer در هر سایت فعال.`);
    nodes.push({ role: 'Indexer Cluster Manager', count: 1, cpu: 8, ram_gb: 16, storage_gb: 100, reason: 'مدیریت کلاستر ایندکسر — نود سبک ولی حیاتی' });
    nodes.push({ role: 'Deployer', count: 1, cpu: 4, ram_gb: 8, storage_gb: 50, reason: 'توزیع کانفیگ Search Head Cluster' });
  }
  nodes.push({
    role: 'Search Head Cluster', count: isHa ? 3 : 1, cpu: 16, ram_gb: 32, storage_gb: 200,
    reason: isHa ? 'جستجوی Highly Available — حداقل 3 عضو برای quorum' : 'جستجوی متمرکز',
  });
  nodes.push({
    role: 'Indexer Cluster Peer', count: idxPerSite * sites, cpu: 16, ram_gb: 32,
    storage_gb: Math.max(1000, Math.round((effectiveIngest * input.retention_days * 0.55) / Math.max(1, idxPerSite * sites))),
    reason: `ایندکس‌گری توزیع‌شده — ${idxPerSite} نود در ${sites} سایت (تقریبی)`,
  });
  nodes.push({ role: 'Monitoring Console', count: 1, cpu: 4, ram_gb: 8, storage_gb: 100, reason: 'پایش سلامت همه نودها' });
  nodes.push({ role: 'Universal Forwarder', count: Math.max(2, Math.round(effectiveIngest / 10)), cpu: 2, ram_gb: 4, storage_gb: 20, reason: 'جمع‌آوری رویداد از منابع — تقریبی' });
  if (input.search_users > 20 || input.workload === 'heavy') {
    assumptions.push('بار جستجوی سنگین — در نظر گرفتن Search Head اضافه یا افزایش منابع در فاز capacity planning.');
  }
  if (input.goal === 'dr') {
    assumptions.push('برای DR واقعی، multisite clustering با site_replication_factor لازم است — در طراحی جزئیات گنجانده نشده.');
  }
  assumptions.push('همه اعداد sizing تقریبی (approximate) و بر اساس فرضیات کاربرند؛ قبل از procurement با ماتریس رسمی Splunk اعتبارسنجی شود.');
  return { nodes, assumptions };
}

export function saveArchitecture(workspaceId: string, actor: string, input: ArchitectureInput): ArchitectureDesign {
  const { nodes, assumptions } = generateArchitecture(input);
  const id = newId('arch');
  run(
    `INSERT INTO architecture_designs (id, workspace_id, name, environment_goal, sizing, nodes, assumptions, ingest_gb_day, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, workspaceId, input.name ?? `طراحی ${new Date().toLocaleDateString('fa-IR')}`, input.goal,
    JSON.stringify({ ...input }), JSON.stringify(nodes), JSON.stringify(assumptions), input.ingest_gb_day, actor, new Date().toISOString()
  );
  audit(actor, 'architecture.save', `arch:${id}`, 'success', newId('corr'));
  return getArchitecture(id)!;
}

export function getArchitecture(id: string): (ArchitectureDesign & { nodes: SplunkNodeSpec[]; assumptions: string[] }) | null {
  const r = get<ArchitectureDesign & { nodes: string; assumptions: string; sizing: string }>('SELECT * FROM architecture_designs WHERE id = ?', id);
  if (!r) return null;
  return { ...r, nodes: JSON.parse(r.nodes), assumptions: JSON.parse(r.assumptions), sizing: JSON.parse(r.sizing) };
}

export function listArchitectures(workspaceId: string): (ArchitectureDesign & { nodes: SplunkNodeSpec[]; assumptions: string[] })[] {
  return all<ArchitectureDesign & { nodes: string; assumptions: string; sizing: string }>(
    'SELECT * FROM architecture_designs WHERE workspace_id = ? ORDER BY created_at DESC', workspaceId
  ).map((r) => ({ ...r, nodes: JSON.parse(r.nodes), assumptions: JSON.parse(r.assumptions), sizing: JSON.parse(r.sizing) }));
}

export function deleteArchitecture(id: string, actor: string): void {
  run('DELETE FROM architecture_designs WHERE id = ?', id);
  audit(actor, 'architecture.delete', `arch:${id}`, 'success', newId('corr'));
}
