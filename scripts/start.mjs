// Production server launcher — run `npm run build` first. Honors APP_PORT (default 8443).
import { spawn } from 'node:child_process';

const port = process.env.APP_PORT || '8443';
const child = spawn('npx', ['next', 'start', '-p', port], { stdio: 'inherit', shell: process.platform === 'win32' });
child.on('exit', (code) => process.exit(code ?? 0));
