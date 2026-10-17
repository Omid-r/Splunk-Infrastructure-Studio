import { all, get, run } from '@/server/db';
import { newId } from '@/server/core/crypto';
import { audit } from '@/server/core/audit';
import { ScopeError, isIPv4, cidrContainsIp } from '@/server/core/scope';
import { workspaceScopes } from '@/server/services/workspace';
import * as nt from '@/server/adapters/netTools';
import type { ToolboxRun } from '@/lib/types';

export const TOOLS = ['ping', 'traceroute', 'dns', 'tcp', 'http', 'ports', 'interfaces'] as const;
export type Tool = (typeof TOOLS)[number];

const LOCAL_NAMES = new Set(['127.0.0.1', 'localhost', '::1', '0.0.0.0', '127.0.0.53']);

type RunRow = ToolboxRun & { ok: number };

export function listRuns(limit = 25): ToolboxRun[] {
  return all<RunRow>('SELECT * FROM toolbox_runs ORDER BY created_at DESC LIMIT ?', limit).map((r) => ({ ...r }));
}

async function allowedIp(target: string, workspaceId: string): Promise<{ ip: string; local: boolean }> {
  const host = target.toLowerCase();
  const locals = nt.localAddresses().map((a) => a.toLowerCase());
  if (LOCAL_NAMES.has(host) || locals.includes(host)) {
    return { ip: isIPv4(target) ? target : '127.0.0.1', local: true };
  }
  let ip: string | null = null;
  if (isIPv4(target)) ip = target;
  else {
    if (!nt.SAFE_HOST.test(target)) throw new ScopeError('میزبان نامعتبر است');
    const dnsRes = await nt.resolveDns(target);
    if (dnsRes.error || dnsRes.addresses.length === 0) throw new ScopeError(`نام میزبان قابل حل نیست: ${target} (${dnsRes.error ?? 'بدون رکورد'})`);
    ip = dnsRes.addresses.find((a) => a.family === 4)?.address ?? dnsRes.addresses[0].address;
  }
  const { ranges, exclusions } = workspaceScopes(workspaceId);
  const localIps = nt.localAddresses();
  if (localIps.includes(ip)) return { ip, local: true };
  const covered = ranges.some((r) => {
    try {
      return cidrContainsIp(r, ip!);
    } catch {
      return false;
    }
  });
  if (!covered) throw new ScopeError(`مقصود ${target} (${ip}) خارج از محدوده مجاز Workspace است — برای ابزارهای شبکه هم allowlist الزامی است`);
  const excluded = exclusions.some((e) => {
    try {
      return cidrContainsIp(e, ip!);
    } catch {
      return false;
    }
  });
  if (excluded) throw new ScopeError(`مقصود ${target} (${ip}) در فهرست استثناها قرار دارد`);
  return { ip, local: false };
}

function record(tool: Tool, target: string, ok: boolean, summary: string, detail: string, actor: string): ToolboxRun {
  const id = newId('tbx');
  run(
    'INSERT INTO toolbox_runs (id, tool, target, ok, summary, detail, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id, tool, target, ok ? 1 : 0, summary, detail, actor, new Date().toISOString()
  );
  audit(actor, `toolbox.${tool}`, target, ok ? 'success' : 'failure', newId('corr'));
  const row = get<RunRow>('SELECT * FROM toolbox_runs WHERE id = ?', id)!;
  return { ...row };
}

function parsePing(out: string): string {
  const m = /(\d+)\s*(?:پاسخ|replies|received)/i.exec(out) ?? /Received\s*=\s*(\d+)/i.exec(out);
  const ttl = (out.match(/TTL=/gi) ?? []).length;
  const got = m ? Number(m[1]) : ttl;
  return got > 0 ? `${got} پاسخ دریافت شد` : 'پاسخی دریافت نشد';
}

export async function runToolbox(
  tool: Tool,
  rawTarget: string,
  opts: { port?: number; count?: number },
  workspaceId: string,
  actor: string
): Promise<ToolboxRun> {
  const target = rawTarget.trim();

  if (tool === 'ports') {
    const ports = await nt.listeningPorts();
    const detail = ports.map((p) => `tcp ${p.address}:${p.port} pid=${p.pid ?? '?'}`).join('\n');
    return record(tool, 'local', true, `${ports.length} پورت TCP در حال گوش‌دادن روی همین ماشین`, detail, actor);
  }

  if (tool === 'interfaces') {
    const ifs = nt.interfaces();
    const detail = ifs.map((i) => `${i.name}: ${i.addresses.map((a) => `${a.address} (${a.family})`).join(', ') || '—'}`).join('\n');
    return record(tool, 'local', true, `${ifs.length} اینترفیس شبکه`, detail, actor);
  }

  if (!target) throw new ScopeError('برای این ابزار باید مقصود وارد شود');

  if (tool === 'dns') {
    const res = await nt.resolveDns(target);
    const detail = res.error ? res.error : res.addresses.map((a) => `${a.address} (IPv${a.family})`).join('\n');
    return record(tool, target, !res.error && res.addresses.length > 0, res.error ?? `${res.addresses.length} رکورد یافت شد`, detail, actor);
  }

  const { ip } = await allowedIp(target, workspaceId);

  if (tool === 'ping') {
    const r = await nt.ping(ip, opts.count ?? 4);
    const summary = r.timedOut ? 'ابزار ping به مهلت رسید' : parsePing(r.out);
    return record(tool, `${target} (${ip})`, !r.timedOut && /TTL=/i.test(r.out), summary, r.out, actor);
  }

  if (tool === 'traceroute') {
    const r = await nt.traceroute(ip);
    const hops = (r.out.match(/\d+\.\d+\.\d+\.\d+/g) ?? []).length;
    return record(tool, `${target} (${ip})`, !r.timedOut && hops > 0, r.timedOut ? 'tracert به مهلت رسید' : `${hops} هپ/پاسخ ثبت شد`, r.out, actor);
  }

  if (tool === 'tcp') {
    const port = opts.port ?? 0;
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ScopeError('شماره پورت معتبر (1-65535) لازم است');
    const open = await nt.tcpProbe(ip, port, 1500);
    return record(tool, `${ip}:${port}`, open, open ? `پورت ${port} باز است (TCP connect موفق)` : `پورت ${port} باز نیست یا بی‌پاسخ است`, '', actor);
  }

  if (tool === 'http') {
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      throw new ScopeError('برای بررسی HTTP باید آدرس کامل http(s):// وارد شود');
    }
    if (!/^https?:$/.test(url.protocol)) throw new ScopeError('فقط http/https مجاز است');
    await allowedIp(url.hostname, workspaceId);
    const res = await nt.httpCheck(url.toString());
    const detail = res.error ? res.error : `${res.status} ${res.statusText} — content-type: ${res.contentType} — ${res.elapsedMs}ms`;
    return record(tool, url.toString(), res.ok, res.error ?? `پاسخ HTTP ${res.status} در ${res.elapsedMs}ms`, detail, actor);
  }

  throw new ScopeError('ابزار ناشناخته است');
}
