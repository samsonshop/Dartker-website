import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '@/lib/env';

/**
 * Product image storage. The local driver writes into /public/uploads; swapping
 * to S3 or Supabase Storage means implementing `putObject` for that driver and
 * changing STORAGE_DRIVER — no calling code changes.
 */

const ALLOWED = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
]);

const MAX_BYTES = 5 * 1024 * 1024;

/** Magic-number check — a file is trusted for its bytes, not its declared type. */
function sniff(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  const ascii = String.fromCharCode(...bytes.slice(0, 12));
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
  if (ascii.slice(4, 8) === 'ftyp' && ascii.slice(8, 12).startsWith('avif')) return 'image/avif';
  return null;
}

export class UploadError extends Error {}

export interface StoredFile {
  url: string;
  bytes: number;
  contentType: string;
}

export async function storeProductImage(file: File): Promise<StoredFile> {
  if (file.size === 0) throw new UploadError('The file is empty.');
  if (file.size > MAX_BYTES) throw new UploadError('Images must be 5 MB or smaller.');

  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniff(buffer);

  if (!sniffed || !ALLOWED.has(sniffed)) {
    throw new UploadError('Only JPG, PNG, WebP and AVIF images are allowed.');
  }
  // SVG is deliberately rejected: it can carry script.
  if (file.type && file.type !== sniffed) {
    throw new UploadError('The file contents do not match its type.');
  }

  const extension = ALLOWED.get(sniffed)!;
  const now = new Date();
  const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  // The name is generated, never taken from the upload — no path traversal is possible.
  const name = `${randomUUID()}.${extension}`;

  const driver = env().STORAGE_DRIVER;
  if (driver !== 'local') {
    throw new UploadError(
      `The "${driver}" storage driver is configured but not implemented yet. Set STORAGE_DRIVER=local or add the driver in src/server/storage.ts.`,
    );
  }

  const directory = join(process.cwd(), 'public', 'uploads', folder);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, name), buffer);

  return { url: `/uploads/${folder}/${name}`, bytes: buffer.length, contentType: sniffed };
}
