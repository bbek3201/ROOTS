'use client';

import { createClient } from '@/lib/supabase/client';
import { MEDIA_BUCKET } from './constants';

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
 */
export async function uploadToArchive(options: UploadOptions): Promise<UploadResult> {
  const mimeType = options.file instanceof File ? options.file.type : (options.file.type || 'application/octet-stream');

  const prepareResponse = await fetch('/api/media/prepare', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      filename: options.filename,
      mimeType,
      sizeBytes: options.file.size,
      scope: options.scope,
      scopeId: options.scopeId ?? null,
    }),
  });

  if (!prepareResponse.ok) {
    const body = await prepareResponse.json().catch(() => null);
    throw new Error(body?.error ?? 'Байршуулах бэлтгэл амжилтгүй боллоо.');
  }

  const prepared = (await prepareResponse.json()) as {
    bucket: string; path: string; token: string; kind: UploadResult['kind']; familyId: string;
  };

  options.onProgress?.(0.1);

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from(prepared.bucket || MEDIA_BUCKET)
    .uploadToSignedUrl(prepared.path, prepared.token, options.file, {
      contentType: mimeType,
      // Originals are written once. Never overwrite.
      upsert: false,
    });

  if (uploadError) throw new Error('Файл байршуулахад алдаа гарлаа.');

  options.onProgress?.(0.85);

  const dimensions = prepared.kind === 'photo' ? await readImageSize(options.file) : null;

  const registerResponse = await fetch('/api/media/register', {
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
  });

  if (!registerResponse.ok) {
    const body = await registerResponse.json().catch(() => null);
    throw new Error(body?.error ?? 'Файлыг бүртгэхэд алдаа гарлаа.');
  }

  const { id } = (await registerResponse.json()) as { id: string };
  options.onProgress?.(1);

  return { mediaId: id, kind: prepared.kind, path: prepared.path };
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
