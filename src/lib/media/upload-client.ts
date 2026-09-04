'use client';

import { createClient } from '@/lib/supabase/client';
import { MEDIA_BUCKET } from './constants';
import { fetchWithRetry, PermanentError, retry } from './retry';

export type UploadScope = 'people' | 'memories' | 'photos' | 'videos' | 'audio' | 'documents' | 'interviews';

export interface UploadResult {
  mediaId: string;
  kind: 'photo' | 'video' | 'audio' | 'document';
  path: string;
}

export interface UploadOptions {
  file: File | Blob;
  filename: string;
  scope: UploadScope;
  scopeId?: string | null;
  memoryId?: string | null;
  personId?: string | null;
  coupleId?: string | null;
  interviewId?: string | null;
  speakerPersonId?: string | null;
  caption?: string;
  durationSeconds?: number | null;
  onProgress?: (fraction: number) => void;
  /** Called when a step is being retried, so the form can say so out loud. */
  onRetry?: (attempt: number) => void;
}

/**
 * Upload a file to the family archive.
 *
 * Three steps, and the middle one is the important one:
 *   1. ask the server for a signed upload URL (it decides the path)
 *   2. send the BYTES DIRECTLY to Supabase Storage — never through our server,
 *      which is what makes an 800 MB video from a 2003 camcorder feasible
 *   3. register the file in the database so it becomes part of the archive
 *
 * If step 3 fails the object is left in storage rather than deleted: an
 * orphaned file can be reclaimed later, but a deleted family video cannot.
 *
 * Every step retries on a dropped connection and on none of the refusals. This
 * is not polish: ROOTS is used from a phone on a rural connection by someone
 * holding a box of their grandmother's photographs, and a four-second dropout
 * that makes them start again is how the box stays in the box.
 *
 * Step 3 matters most. By then the bytes are already in storage, and giving up
 * there leaves a photograph uploaded but invisible — the worst outcome
 * available, because the family has no way to see it and no way to retry it.
 */
export async function uploadToArchive(options: UploadOptions): Promise<UploadResult> {
  const mimeType = options.file instanceof File ? options.file.type : (options.file.type || 'application/octet-stream');

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
        scope: options.scope,
        scopeId: options.scopeId ?? null,
      }),
    },
    'Байршуулах бэлтгэл амжилтгүй боллоо.',
    { onRetry: notifyRetry },
  )) as {
    bucket: string; path: string; token: string; kind: UploadResult['kind']; familyId: string;
  };

  options.onProgress?.(0.1);

  const supabase = createClient();
  await retry(async () => {
    const { error: uploadError } = await supabase.storage
      .from(prepared.bucket || MEDIA_BUCKET)
      .uploadToSignedUrl(prepared.path, prepared.token, options.file, {
        contentType: mimeType,
        // Originals are written once. Never overwrite.
        upsert: false,
      });

    if (!uploadError) return;

    // A retry after a connection that dropped AFTER the bytes landed comes back
    // as a duplicate. The file is there; that is what we were trying to achieve.
    if (isAlreadyUploaded(uploadError)) return;

    // The signed URL is minted per path and expires. Once it is gone, retrying
    // cannot help — the caller has to start again with a fresh token.
    if (isExpiredToken(uploadError)) {
      throw new PermanentError('Байршуулах хугацаа дууслаа. Дахин оролдоно уу.');
    }

    throw new Error('Файл байршуулахад алдаа гарлаа.');
  }, { onRetry: notifyRetry });

  options.onProgress?.(0.85);

  const dimensions = prepared.kind === 'photo' ? await readImageSize(options.file) : null;

  // More attempts here than anywhere else: the bytes are already in storage, so
  // the only thing standing between the family and their photograph is this
  // one small request.
  const registered = (await fetchWithRetry(
    '/api/media/register',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        familyId: prepared.familyId,
        path: prepared.path,
        kind: prepared.kind,
        mimeType,
        sizeBytes: options.file.size,
        originalFilename: options.filename,
        caption: options.caption ?? undefined,
        durationSeconds: options.durationSeconds ?? undefined,
        width: dimensions?.width ?? undefined,
        height: dimensions?.height ?? undefined,
        memoryId: options.memoryId ?? undefined,
        personId: options.personId ?? undefined,
        coupleId: options.coupleId ?? undefined,
        interviewId: options.interviewId ?? undefined,
        speakerPersonId: options.speakerPersonId ?? undefined,
      }),
    },
    'Файлыг бүртгэхэд алдаа гарлаа.',
    { attempts: 6, onRetry: notifyRetry },
  )) as { id: string };

  options.onProgress?.(1);

  return { mediaId: registered.id, kind: prepared.kind, path: prepared.path };
}

/** Storage says the object is already there — an earlier attempt got through. */
function isAlreadyUploaded(error: { message?: string; statusCode?: string } | null): boolean {
  const message = (error?.message ?? '').toLowerCase();
  return error?.statusCode === '409' || message.includes('already exists') || message.includes('duplicate');
}

/** The one-shot upload token has expired; a new one must be minted. */
function isExpiredToken(error: { message?: string } | null): boolean {
  const message = (error?.message ?? '').toLowerCase();
  return message.includes('expired') || message.includes('invalid signature') || message.includes('jwt');
}

/** Read pixel dimensions locally so the grid can reserve the right space. */
async function readImageSize(file: File | Blob): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    // HEIC and some TIFFs cannot be decoded in the browser. Not a failure —
    // the file itself uploads fine, we simply do not know its size yet.
    return null;
  }
}
