#!/usr/bin/env node
// Laboratory launcher — a fully isolated instance of Splunk Infrastructure Studio.
// It uses its own SQLite file + its own lab artifacts, so experiments here never
// touch the developer's ./data directory.
//
//   node lab/start-lab.mjs                 # dev server on http://127.0.0.1:8553
//   node lab/start-lab.mjs --port=8600     # another port
//   node lab/start-lab.mjs --prod          # next start (run "npm run build" first)
//   node lab/start-lab.mjs --reset         # delete the lab data dir, then start
//   node lab/start-lab.mjs --fresh-admin   # also skip setup by seeding admin
//
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const labDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(labDir);
const argv = process.argv.slice(2);
const getFlag = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const has = (name) => argv.includes(`--${name}`);

const port = getFlag('port') || process.env.LAB_PORT || '8553';
const prod = has('prod');
const dataRel = path.join('lab', '.lab-data');
const dataAbs = path.join(root, dataRel);
const secretsFile = path.join(dataAbs, 'lab-secrets.json');

if (has('reset')) {
  if (fs.existsSync(dataAbs)) {
    fs.rmSync(dataAbs, { recursive: true, force: true });
    console.log(`[lab] پوشهٔ دادهٔ آزمایشگاه حذف شد: ${dataRel} (دیتابیس، کانف‌ها، spool و لاگ‌ها)`);
  }
}
fs.mkdirSync(dataAbs, { recursive: true });

function loadSecrets() {
  if (fs.existsSync(secretsFile)) {
    try {
      const j = JSON.parse(fs.readFileSync(secretsFile, 'utf8'));
      if (j.SESSION_SECRET && j.SECRET_ENCRYPTION_KEY) return j;
    } catch {
      /* corrupt file — regenerate below */
    }
  }
  const generated = {
    SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
    SECRET_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
  };
  fs.writeFileSync(secretsFile, JSON.stringify(generated, null, 2), { mode: 0o600 });
  return generated;
}

const secrets = loadSecrets();

const banner = [
  '',
  '══════════════════════════════════════════════════════════════',
  '  محیط آزمایشگاهی Splunk Infrastructure Studio',
  '══════════════════════════════════════════════════════════════',
  `  آدرس:      http://127.0.0.1:${port}`,
  `  حالت:       ${prod ? 'production (next start)' : 'development (next dev)'}`,
  `  داده‌ها:    ${path.join(dataRel, 'app.sqlite')} و ${path.join(dataRel, 'local-lab/')} — کاملاً جدا از ./data`,
  `  رازها:     ${path.join(dataRel, 'lab-secrets.json')} (فقط محلی، هرگز لاگ نمی‌شود)`,
  '',
  '  قدم‌های پیشنهادی:',
  `    ۱) ${prod ? 'بیلد گرفته شده است' : 'روی دکمهٔ ورود کلیک کنید و «راه‌اندازی اولیه» را کامل کنید'} — http://127.0.0.1:${port}/setup`,
  `    ۲) وارد صفحهٔ «محیط آزمایشگاهی» شوید و مراحل را یکی‌یکی اجرا کنید — http://127.0.0.1:${port}/lab-env`,
  `    ۳) برای دیدن نتایج: داشبورد، هاست‌ها، نقشه شبکه، آزمایشگاه زنده، عیب‌یاری، جعبه‌ابزار`,
  '',
  '  نکته‌های صداقت:',
  '    • همهٔ نودهای آزمایشگاهی فقط روی 127.0.0.1 گوش می‌دهند؛ هیچ اسکن شبکه‌ای خارج از allowlist انجام نمی‌شود.',
  '    • لاگ‌های نمونه در lab/sample-data دست‌ساز و برچسب‌خورده‌اند (DEMO DATA) و از هیچ سیستم واقعی نیامده‌اند.',
  '    • برای پاک‌کردن کامل: Ctrl+C سپس «node lab/start-lab.mjs --reset».',
  '══════════════════════════════════════════════════════════════',
  '',
];
console.log(banner.join('\n'));

const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
if (!fs.existsSync(nextBin)) {
  console.error('[lab] وابستگی‌ها نصب نشده‌اند. اول: npm install (یا node را با PATH مناسب اجرا کنید).');
  process.exit(1);
}
if (prod && !fs.existsSync(path.join(root, '.next', 'BUILD_ID'))) {
  console.error('[lab] برای --prod اول باید build شود:  npm run build');
  process.exit(1);
}

const args = [nextBin, prod ? 'start' : 'dev', '-H', '127.0.0.1', '-p', port];
const child = spawn(process.execPath, args, {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    APP_PORT: port,
    SIS_DATA_DIR: dataAbs,
    SESSION_SECRET: secrets.SESSION_SECRET,
    SECRET_ENCRYPTION_KEY: secrets.SECRET_ENCRYPTION_KEY,
  },
});
child.on('exit', (code) => process.exit(code ?? 0));
