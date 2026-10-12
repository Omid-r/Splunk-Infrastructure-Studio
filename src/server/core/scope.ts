export class ScopeError extends Error {
  code = 'SCOPE_VIOLATION';
  constructor(message: string) {
    super(message);
    this.name = 'ScopeError';
  }
}

export function isIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255 && String(Number(p)) === p);
}

export function ipToLong(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function longToIp(long: number): string {
  return [(long >>> 24) & 255, (long >>> 16) & 255, (long >>> 8) & 255, long & 255].join('.');
}

export interface CidrRange {
  start: number;
  end: number;
  prefix: number;
}

export function parseCidr(cidr: string): CidrRange {
  const [ip, prefixStr] = cidr.split('/');
  if (!isIPv4(ip) || prefixStr === undefined) throw new ScopeError(`محدوده نامعتبر است: ${cidr}`);
  const prefix = Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 8 || prefix > 32) {
    throw new ScopeError(`پیشوند CIDR باید بین 8 تا 32 باشد: ${cidr}`);
  }
  const long = ipToLong(ip);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const start = (long & mask) >>> 0;
  const size = 2 ** (32 - prefix);
  return { start, end: (start + size - 1) >>> 0, prefix };
}

export function expandCidr(cidr: string, maxHosts: number): string[] {
  const { start, end, prefix } = parseCidr(cidr);
  const count = end - start + 1;
  const usable = Math.min(count, prefix <= 30 ? count - 2 : count);
  if (usable > maxHosts) {
    throw new ScopeError(`محدوده ${cidr} بیش از سقف مجاز ${maxHosts} هاست است؛ محدوده کوچک‌تری انتخاب کنید`);
  }
  const out: string[] = [];
  const from = prefix <= 30 ? start + 1 : start;
  const to = prefix <= 30 ? end - 1 : end;
  for (let l = from; l <= to; l++) out.push(longToIp(l >>> 0));
  return out;
}

export function cidrContainsIp(cidr: string, ip: string): boolean {
  const { start, end } = parseCidr(cidr);
  const long = ipToLong(ip);
  return long >= start && long <= end;
}

export interface NormalizedTarget {
  kind: 'ip' | 'cidr';
  value: string;
}

export function normalizeTarget(raw: string): NormalizedTarget {
  const value = raw.trim();
  if (value.includes('/')) {
    parseCidr(value);
    return { kind: 'cidr', value };
  }
  if (!isIPv4(value)) throw new ScopeError(`آدرس IP نامعتبر است: ${value}`);
  return { kind: 'ip', value };
}

export function assertAllowed(targets: string[], allowlist: string[], exclusions: string[], maxHosts: number): NormalizedTarget[] {
  if (allowlist.length === 0) throw new ScopeError('هیچ محدوده مجازی برای این Workspace تعریف نشده است');
  const normalized: NormalizedTarget[] = [];
  for (const raw of targets) {
    const t = normalizeTarget(raw);
    if (t.kind === 'cidr' && t.value.endsWith('/0')) {
      throw new ScopeError('اسکن 0.0.0.0/0 هرگز مجاز نیست');
    }
    const covered = allowlist.some((a) => {
      try {
        return t.kind === 'ip' ? cidrContainsIp(a, t.value) : rangesOverlap(parseCidr(a), parseCidr(t.value));
      } catch {
        return false;
      }
    });
    if (!covered) throw new ScopeError(`هدف ${t.value} خارج از محدوده مجاز Workspace است`);
    const excluded = exclusions.some((e) => {
      try {
        return t.kind === 'ip' ? cidrContainsIp(e, t.value) : rangesOverlap(parseCidr(e), parseCidr(t.value));
      } catch {
        return false;
      }
    });
    if (excluded) throw new ScopeError(`هدف ${t.value} در فهرست استثناها قرار دارد`);
    if (t.kind === 'cidr') {
      const count = expandCidr(t.value, Number.MAX_SAFE_INTEGER).length;
      if (normalized.reduce((acc, n) => acc + (n.kind === 'ip' ? 1 : expandCidr(n.value, Number.MAX_SAFE_INTEGER).length), 0) + count > maxHosts) {
        throw new ScopeError(`مجموع اهداف از سقف ${maxHosts} هاست بیشتر می‌شود`);
      }
    }
    normalized.push(t);
  }
  return normalized;
}

function rangesOverlap(a: CidrRange, b: CidrRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}
