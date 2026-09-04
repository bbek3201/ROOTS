import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { MediaKind, MediaVariant } from '@/types/database';

export { MEDIA_BUCKET } from './constants';
import { MEDIA_BUCKET } from './constants';

/** How long a media link stays valid. Short, because links get forwarded. */
const SIGNED_URL_TTL_SECONDS = 60 * 10;

export type MediaScope =
  | 'people' | 'memories' | 'photos' | 'videos' | 'audio' | 'documents' | 'interviews'
  // The couple space's private prefix. The storage policies carve this OUT of
  // the family's read grant and hand it to the two partners instead, so the
  // literal string here is load-bearing: change it and private photographs
  // become family photographs.
  | 'couple-space';

/**
 * Build a storage path.
 *
 * The layout is load-bearing, not cosmetic:
 *   families/{family_id}/...   — the storage policies read family_id from
 *                                segment 2, so a path that does not start this
 *                                way is rejected before any bytes are written.
 *   .../couple-space/{space_id}/...
 *                              — segment 3 and 4. The family read policy
 *                                explicitly excludes this prefix and a separate
 *                                policy grants the couple, which is what makes
 *                                a private photograph actually private rather
 *                                than merely undisplayed.
 *   .../original/... vs .../derived/...
 *                              — updates and deletes are only permitted under
 *                                derived/, which is how "never overwrite an
 *                                original" is enforced by the server rather
 *                                than by everyone remembering to be careful.
 */
export function buildStoragePath(options: {
  familyId: string;
  scope: MediaScope;
  scopeId?: string | null;
  variant: MediaVariant;
  filename: string;
}): string {
  const { familyId, scope, scopeId, variant, filename } = options;
  const bucketFolder = variant === 'original' ? 'original' : 'derived';
  const safeName = sanitiseFilename(filename);
  const unique = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

  const segments = ['families', familyId, scope];
  if (scopeId) segments.push(scopeId);
  segments.push(bucketFolder, `${unique}-${safeName}`);

  return segments.join('/');
}

/**
 * Strip anything that could escape the intended prefix or confuse storage.
 * Unicode letters are kept so a Mongolian filename survives intact.
 */
export function sanitiseFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? 'file';
  const cleaned = base
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+/, '')
    .slice(0, 80);
  return cleaned || 'file';
}

/**
 * Sign one object URL.
 *
 * Uses the CALLER's client, not the service role: Supabase Storage applies the
 * same RLS policy to signing that it applies to reading, so a member of another
 * family cannot obtain a URL even if they somehow learn the path.
 */
export const getSignedUrl = cache(async (storagePath: string, bucket = MEDIA_BUCKET): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
});

/** Sign many at once — one request instead of one per thumbnail. */
export async function getSignedUrls(
  storagePaths: string[],
  bucket = MEDIA_BUCKET,
): Promise<Map<string, string>> {
  const unique = [...new Set(storagePaths.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return new Map();

  const result = new Map<string, string>();
  for (const entry of data) {
    if (entry.path && entry.signedUrl) result.set(entry.path, entry.signedUrl);
  }
  return result;
}

/** What a given file type is allowed to be, checked before an upload is signed. */
export const ALLOWED_MIME_TYPES: Record<MediaKind, string[]> = {
  photo: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/tiff', 'image/gif', 'image/bmp'],
  video: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/aac', 'audio/flac'],
  document: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'],
};

export const MAX_UPLOAD_BYTES: Record<MediaKind, number> = {
  photo: 40 * 1024 * 1024,
  // Family video is often a single irreplaceable file from an old camera.
  video: 1024 * 1024 * 1024,
  audio: 300 * 1024 * 1024,
  document: 100 * 1024 * 1024,
};

export function kindForMimeType(mimeType: string): MediaKind | null {
  for (const [kind, types] of Object.entries(ALLOWED_MIME_TYPES) as Array<[MediaKind, string[]]>) {
    if (types.includes(mimeType)) return kind;
  }
  return null;
}
