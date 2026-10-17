import { gzipSync } from 'node:zlib';

export interface TarEntry {
  path: string;
  content: string | Buffer;
}

const BLOCK = 512;

function octal(value: number, width: number): string {
  return value.toString(8).padStart(width - 1, '0') + '\0';
}

/**
 * ustar names fit 100 bytes; longer ones are split into prefix+name at a path separator.
 */
function splitName(name: string): { prefix: string; base: string } {
  if (name.length <= 100) return { prefix: '', base: name };
  const cut = name.lastIndexOf('/', name.length - 100);
  if (cut === -1 || cut + 1 > 155) {
    throw new Error(`مسیر داخل آرشیو برای فرمت ustar بیش از حد بلند است: ${name}`);
  }
  return { prefix: name.slice(0, cut), base: name.slice(cut + 1) };
}

function header(name: string, size: number, mtimeSec: number): Buffer {
  const { prefix, base } = splitName(name);
  const h = Buffer.alloc(BLOCK, 0);
  // ustar offsets: name 0, mode 100, uid 108, gid 116, size 124, mtime 136, chksum 148,
  // typeflag 156, linkname 157, magic 257, version 263, uname 265, gname 297, prefix 345
  h.write(base.slice(0, 100), 0, 'utf8');
  h.write('0000644\0', 100, 'utf8');
  h.write(octal(0, 8), 108, 'utf8');
  h.write(octal(0, 8), 116, 'utf8');
  h.write(octal(size, 12), 124, 'utf8');
  h.write(octal(mtimeSec, 12), 136, 'utf8');
  h.write('        ', 148, 'utf8');
  h.write('0', 156, 'utf8');
  h.write('ustar\0', 257, 'utf8');
  h.write('00', 263, 'utf8');
  h.write('sis', 265, 'utf8');
  h.write('sis', 297, 'utf8');
  if (prefix) h.write(prefix.slice(0, 155), 345, 'utf8');
  let sum = 0;
  for (const byte of h) sum += byte;
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'utf8');
  return h;
}

/** Deterministic ustar tar.gz — no external dependency, sorted entries. */
export function createTarGz(entries: TarEntry[], mtimeSec = Math.floor(Date.now() / 1000)): Buffer {
  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const blocks: Buffer[] = [];
  for (const e of sorted) {
    const body = Buffer.isBuffer(e.content) ? e.content : Buffer.from(e.content, 'utf8');
    blocks.push(header(e.path, body.length, mtimeSec), body);
    const pad = (BLOCK - (body.length % BLOCK)) % BLOCK;
    if (pad > 0) blocks.push(Buffer.alloc(pad, 0));
  }
  blocks.push(Buffer.alloc(BLOCK * 2, 0));
  return gzipSync(Buffer.concat(blocks), { level: 9 });
}
