// Fixed-argv network tools: spawn without a shell, never interpolate free-form
// commands, always bounded by timeout + output cap.
import { spawn } from 'node:child_process';
import dns from 'node:dns/promises';
import os from 'node:os';
import { tcpProbe } from '@/server/adapters/tcpScan';

export interface ToolRunResult {
  code: number | null;
  out: string;
  timedOut: boolean;
}

const MAX_OUT = 4000;

export function runTool(cmd: string, args: string[], timeoutMs: number): Promise<ToolRunResult> {
  return new Promise((resolve) => {
    let out = '';
    let timedOut = false;
    const child = spawn(cmd, args, { shell: false, windowsHide: true });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.stdout.on('data', (c) => {
      if (out.length < MAX_OUT) out += c.toString();
    });
    child.stderr.on('data', (c) => {
      if (out.length < MAX_OUT) out += c.toString();
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: -1, out: `خطای اجرا: ${e.message}`, timedOut: false });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, out: out.slice(0, MAX_OUT), timedOut });
    });
  });
}

export const SAFE_HOST = /^[A-Za-z0-9._:-]{1,253}$/;

export async function ping(host: string, count: number): Promise<ToolRunResult> {
  return runTool('ping', ['-n', String(Math.min(10, Math.max(1, count))), host], count * 4500 + 2000);
}

export async function traceroute(host: string): Promise<ToolRunResult> {
  return runTool('tracert', ['-d', '-h', '16', '-w', '1500', host], 45_000);
}

export interface DnsResult {
  addresses: { address: string; family: number }[];
  error: string | null;
}

export async function resolveDns(host: string): Promise<DnsResult> {
  try {
    const recs = await dns.lookup(host, { all: true, verbatim: true });
    return { addresses: recs.map((r) => ({ address: r.address, family: r.family })), error: null };
  } catch (e) {
    return { addresses: [], error: (e as Error).message };
  }
}

export { tcpProbe };

export interface HttpCheckResult {
  ok: boolean;
  status: number | null;
  statusText: string;
  contentType: string;
  elapsedMs: number;
  error: string | null;
}

export async function httpCheck(url: string, timeoutMs = 6000): Promise<HttpCheckResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.body?.getReader().read().catch(() => null);
    res.body?.cancel().catch(() => {});
    void body;
    return {
      ok: res.status >= 200 && res.status < 400,
      status: res.status,
      statusText: res.statusText,
      contentType: res.headers.get('content-type') ?? 'نامشخص',
      elapsedMs: Date.now() - t0,
      error: null,
    };
  } catch (e) {
    return { ok: false, status: null, statusText: '', contentType: '', elapsedMs: Date.now() - t0, error: (e as Error).message };
  }
}

export interface ListeningPort {
  proto: string;
  address: string;
  port: number;
  pid: number | null;
}

export async function listeningPorts(): Promise<ListeningPort[]> {
  const r = await runTool('netstat', ['-ano', '-p', 'tcp'], 8000);
  const ports: ListeningPort[] = [];
  for (const line of r.out.split(/\r?\n/)) {
    if (!/LISTENING/i.test(line)) continue;
    const m = /^\s*TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING(?:\s+(\d+))?/i.exec(line);
    if (!m) continue;
    ports.push({ proto: 'tcp', address: m[1], port: Number(m[2]), pid: m[3] ? Number(m[3]) : null });
  }
  return ports;
}

export interface NetInterface {
  name: string;
  addresses: { address: string; family: string; netmask: string; mac: string }[];
}

export function interfaces(): NetInterface[] {
  const ifs = os.networkInterfaces();
  return Object.entries(ifs).map(([name, addrs]) => ({
    name,
    addresses: (addrs ?? []).map((a) => ({ address: a.address, family: String(a.family), netmask: a.netmask ?? '', mac: a.mac ?? '' })),
  }));
}

export function localAddresses(): string[] {
  const out: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) out.push(a.address);
  }
  return out;
}
