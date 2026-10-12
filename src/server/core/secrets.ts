import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';

function key(): Buffer {
  const raw = process.env.SECRET_ENCRYPTION_KEY;
  if (!raw || raw === 'CHANGE_ME_64_HEX_CHARS') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SECRET_ENCRYPTION_KEY must be set in production');
    }
    return crypto.createHash('sha256').update('dev-only-insecure-key').digest();
  }
  return Buffer.from(raw, 'hex');
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join('.');
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, encHex] = payload.split('.');
  const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
}
