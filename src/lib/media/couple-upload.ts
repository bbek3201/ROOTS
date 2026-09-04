'use client';

import { createClient } from '@/lib/supabase/client';
import { MEDIA_BUCKET } from './constants';
import { fetchWithRetry, PermanentError, retry } from './retry';

export interface CoupleUploadResult {
  mediaId: string;
  kind: 'photo' | 'video' | 'audio' | 'document';
  path: string;
}

/**
 * Upload a file into a couple's private space.
 *
 * Deliberately a separate function from uploadToArchive rather than a flag on
 * it. The two differ in the one thing that matters — where the bytes land and
 * who may read them afterwards — and a shared function with a boolean is the
 * shape of code where a private photograph eventually ends up in the family
 * archive because a caller left the flag off.
 *
 * The three steps and the retry behaviour are the same as the family uploader,
 * for the same reason: the connection drops, and starting again is how a
 * memory stays unrecorded.
 */
export async function uploadToCoupleSpace(options: {
  spaceId: string;
  file: File | Blob;
  filename: string;
  caption?: string;
  durationSeconds?: number | null;
  onProgress?: (fraction: number) => void;
  onRetry?: (attempt: number) => void;
}): Promise<CoupleUploadResult> {
  const mimeType =
    options.file instanceof File
      ? options.file.type
      : options.file.type || 'application/octet-stream';

  const notifyRetry = options.onRetry ? (attempt: number) => options.onRetry?.(attempt) : undefined;

  const prepared = (await fetchWithRetry(
    '/api/media/prepare',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filename: options.filename,
        mimeType,
        sizeBytes: options.file.size,
        scope: 'couple-space',
        scopeId: options.spaceId,
      }),
    },
    'Байршуулах бэлтгэл амжилтгүй боллоо.',
    { onRetry: notifyRetry },
  )) as { bucket: string; path: string; token: string; kind: CoupleUploadResult['kind'] };

  options.onProgress?.(0.1);

  const supabase = createClient();
  await retry(async () => {
    const { error } = await supabase.storage
      .from(prepared.bucket || MEDIA_BUCKET)
      .uploadToSignedUrl(prepared.path, prepared.token, options.file, {
        contentType: mimeType,
        upsert: false,
      });

    if (!error) return;
    const message = (error.message ?? '').toLowerCase();
    // A dropout after the bytes landed comes back as a duplicate; the file is
    // there, which is what we wanted.
    if (message.includes('already exists') || message.includes('duplicate')) return;
    if (message.includes('expired') || message.includes('invalid signature') || message.includes('jwt')) {
      throw new PermanentError('Байршуулах хугацаа дууслаа. Дахин оролдоно уу.');
    }
    throw new Error('Файл байршуулахад алдаа гарлаа.');
  }, { onRetry: notifyRetry });

  options.onProgress?.(0.85);

  const dimensions = prepared.kind === 'photo' ? await readImageSize(options.file) : null;

  const registered = (await fetchWithRetry(
    `/api/couple/${options.spaceId}/media`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        path: prepared.path,
        kind: prepared.kind,
        mimeType,
        sizeBytes: options.file.size,
        width: dimensions?.width ?? undefined,
        height: dimensions?.height ?? undefined,
        durationSeconds: options.durationSeconds ?? undefined,
        caption: options.caption ?? undefined,
      }),
    },
    'Файлыг бүртгэхэд алдаа гарлаа.',
    // The bytes are already up by this point; this small request is the only
    // thing standing between the couple and their photograph.
    { attempts: 6, onRetry: notifyRetry },
  )) as { id: string };

  options.onProgress?.(1);
  return { mediaId: registered.id, kind: prepared.kind, path: prepared.path };
}

async function readImageSize(file: File | Blob): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}
