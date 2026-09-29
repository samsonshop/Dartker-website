import { randomBytes, randomInt } from 'node:crypto';

const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** ORD-25090412-4F7K — sortable by date, unique enough for a boutique store. */
export function generateOrderNumber(date = new Date()): string {
  const stamp = [
    String(date.getFullYear()).slice(2),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
  ].join('');
  return `ORD-${stamp}-${randomToken(4)}`;
}

export function generateRequestNumber(type: 'RETURN' | 'CANCELLATION', date = new Date()): string {
  const prefix = type === 'RETURN' ? 'RET' : 'CAN';
  const stamp = [
    String(date.getFullYear()).slice(2),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
  return `${prefix}-${stamp}-${randomToken(4)}`;
}

export function randomToken(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += BASE32[randomInt(0, BASE32.length)];
  return out;
}

export function generateSku(prefix: string, index: number): string {
  return `${prefix.toUpperCase()}-${String(index).padStart(3, '0')}`;
}

export function generateBackupCode(): string {
  return `${randomToken(4)}-${randomToken(4)}`;
}

export function secureId(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}
