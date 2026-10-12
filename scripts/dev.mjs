// Development server launcher — honors APP_PORT (default 8443).
// HTTPS=1 enables Next.js experimental self-signed HTTPS for local testing only.
import { spawn } from 'node:child_process';

const port = process.env.APP_PORT || '8443';
const https = process.env.HTTPS === '1';

if (https) {
  console.warn('[sis] WARNING: self-signed TLS — فقط برای آزمایش محلی. برای production از گواهی معتبر پشت reverse proxy استفاده کنید.');
}

const args = ['next', 'dev', '-p', port];
if (https) args.push('--experimental-https');

const child = spawn('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });
child.on('exit', (code) => process.exit(code ?? 0));
