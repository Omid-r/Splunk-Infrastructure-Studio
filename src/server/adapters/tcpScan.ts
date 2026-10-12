import net from 'node:net';

export const COMMON_PORTS: Record<number, string> = {
  22: 'ssh',
  53: 'dns',
  80: 'http',
  111: 'rpcbind',
  135: 'msrpc',
  139: 'netbios',
  443: 'https',
  445: 'smb',
  623: 'ipmi',
  1433: 'mssql',
  3306: 'mysql',
  3389: 'rdp',
  5432: 'postgresql',
  5900: 'vnc',
  5985: 'winrm-http',
  5986: 'winrm-https',
  6379: 'redis',
  8000: 'splunk-web',
  8080: 'http-alt',
  8088: 'splunk-hec',
  8089: 'splunkd',
  8443: 'https-alt',
  9000: 'port9000',
  9092: 'kafka',
  9997: 'splunk-s2s',
  27017: 'mongodb',
};

export const QUICK_PORTS = [22, 80, 443, 445, 3389, 5985, 8000, 8080, 8088, 8089, 8443, 9997];
export const STANDARD_PORTS = [
  ...QUICK_PORTS, 53, 111, 135, 139, 623, 1433, 3306, 5432, 5900, 5986, 6379, 9000, 9092, 27017,
];

export function serviceGuess(port: number): string {
  return COMMON_PORTS[port] ?? 'unknown';
}

export function tcpProbe(ip: string, port: number, timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
    try {
      sock.connect(port, ip);
    } catch {
      finish(false);
    }
  });
}

export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length) as R[];
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
