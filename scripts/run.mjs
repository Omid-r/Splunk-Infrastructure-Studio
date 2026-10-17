// Two-click launcher: verifies the runtime, installs dependencies when missing,
// starts the app and opens the browser. Needed because many target machines have
// no node.exe on PATH, so `npm run dev` is not usable there.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const val = (n, d) => (argv.find((a) => a.startsWith(`--${n}=`) || a === `--${n}`) ?? '').split('=')[1] ?? d;

const port = val('port', process.env.APP_PORT || '8443');
const prod = has('prod');
const openBrowser = !has('no-open');
const url = `http://127.0.0.1:${port}`;

function die(msg) {
  console.error(`\n[!] ${msg}\n`);
  process.exit(1);
}

const major = Number(process.versions.node.split('.')[0]);
if (major < 22) die(`Node.js نسخهٔ ${process.versions.node} خیلی قدیمی است. نسخهٔ ۲۲ یا جدیدتر لازم است، چون این برنامه از ماژول داخلی node:sqlite استفاده می‌کند.`);

function runTool(entry, args) {
  return spawn(process.execPath, [path.join(root, entry), ...args], { stdio: 'inherit', cwd: root });
}

// --- dependencies -----------------------------------------------------------
if (!fs.existsSync(path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'))) {
  console.log('\n[1/3] وابستگی‌ها نصب نشده‌اند — در حال npm install (یک‌بار، چند دقیقه)…\n');
  const npm = path.join(path.dirname(process.execPath), process.platform === 'win32' ? 'npm.cmd' : 'npm');
  if (!fs.existsSync(npm)) die('npm کنار فایل node.exe پیدا نشد. لطفاً Node.js را کامل نصب کنید (تیک Add to PATH) و دوباره امتحان کنید.');
  const r = spawnSync(npm, ['install', '--no-audit', '--no-fund'], { stdio: 'inherit', cwd: root });
  if (r.status !== 0) die('npm install با خطا پایان یافت. متن بالا را بررسی کنید — بدون وابستگی‌ها برنامه اجرا نمی‌شود.');
}

// --- production build -------------------------------------------------------
if (prod && !fs.existsSync(path.join(root, '.next', 'BUILD_ID'))) {
  console.log('\n[2/3] بیلد production وجود ندارد — در حال next build…\n');
  await new Promise((resolve, reject) => {
    const c = runTool('node_modules/next/dist/bin/next', ['build']);
    c.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`next build با کد ${code} شکست خورد.`))));
  }).catch((e) => die(e.message));
}

// --- server -----------------------------------------------------------------
console.log(`\n[3/3] سرور ${prod ? 'production' : 'توسعه'} روی ${url} بالا می‌آید. برای توقف: Ctrl+C\n`);
const server = runTool('node_modules/next/dist/bin/next', [prod ? 'start' : 'dev', '-p', port]);
server.on('exit', (code) => process.exit(code ?? 0));

function probe() {
  return new Promise((done) => {
    const req = http.get(`${url}/login`, (res) => { res.resume(); done(res.statusCode === 200); });
    req.on('error', () => done(false));
    req.setTimeout(1500, () => { req.destroy(); done(false); });
  });
}

async function waitReady(ms = 90_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await probe()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

if (openBrowser) {
  waitReady().then((ok) => {
    if (!ok) {
      console.warn(`\n[!] سرور داخل ${url} پاسخ نداد. اگر پورت ${port} اشغال است: node scripts/run.mjs --port=8450\n`);
      return;
    }
    console.log(`\n→ آماده است: ${url}\n`);
    if (process.platform === 'win32') spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    else if (process.platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  });
}
