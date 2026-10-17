// Production server launcher — run `npm run build` first. Honors APP_PORT (default 8443).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = process.env.APP_PORT || '8443';
const args = [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', port];
const child = spawn(process.execPath, args, { stdio: 'inherit', cwd: root });
child.on('exit', (code) => process.exit(code ?? 0));
