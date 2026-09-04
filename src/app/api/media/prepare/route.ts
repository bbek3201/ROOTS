import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AccessError, assertFamilyAccess } from '@/lib/auth/guards';
import { getActiveFamily } from '@/lib/family-context';
import { handle, ok, parseBody } from '@/lib/api';
import {
  ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, MEDIA_BUCKET, buildStoragePath, kindForMimeType,
} from '@/lib/media/storage';

const bodySchema = z.object({
  familyId: z.string().uuid().optional(),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(120),
  sizeBytes: z.number().int().nonnegative(),
  scope: z.enum([
    'people', 'memories', 'photos', 'videos', 'audio', 'documents', 'interviews',
    'couple-space',
  ]),
  scopeId: z.string().uuid().nullable().optional(),
});

/**
 * Step 1 of an upload: validate, then mint a signed upload URL.
 *
 * The storage PATH is built on the server and never accepted from the client.
 * That is what guarantees a file always lands under its own family's prefix and
 * under `original/` — the storage policies read the family id out of segment 2
 * of that path, so letting a client choose it would hand them the keys.
 *
 * Bytes never pass through this server: the browser uploads straight to
 * Supabase Storage, which is what makes a 1 GB family video practical.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);

    const active = await getActiveFamily();
    const membership = await assertFamilyAccess(body.familyId ?? active?.family_id, 'contributor');

    // A couple-space path is only mintable by someone in that space. Without
    // this the route would happily sign an upload URL into another couple's
    // private prefix — the storage policy would refuse the write, but the
    // refusal would arrive after the file picker, not before it.
    if (body.scope === 'couple-space') {
      if (!body.scopeId) throw new AccessError('Хосын орон зай заагаагүй байна.', 400);
      const client = await createClient();
      const { data: space } = await client
        .from('couple_spaces')
        .select('id')
        .eq('id', body.scopeId)
        .is('deleted_at', null)
        .maybeSingle();
      if (!space) throw new AccessError('Олдсонгүй.', 404);
    }

    const kind = kindForMimeType(body.mimeType);
    if (!kind) {
      throw new AccessError(
        `Энэ төрлийн файлыг дэмждэггүй (${body.mimeType}). Зураг, видео, дуу, PDF оруулна уу.`,
        415,
      );
    }
    if (!ALLOWED_MIME_TYPES[kind].includes(body.mimeType)) {
      throw new AccessError('Файлын төрөл зөвшөөрөгдөөгүй байна.', 415);
    }
    if (body.sizeBytes > MAX_UPLOAD_BYTES[kind]) {
      throw new AccessError('Файл хэт том байна.', 413);
    }

    // Every upload is an ORIGINAL. Derived versions are produced server-side
    // and written to a different prefix, never here.
    const storagePath = buildStoragePath({
      familyId: membership.family_id,
      scope: body.scope,
      scopeId: body.scopeId ?? null,
      variant: 'original',
      filename: body.filename,
    });

    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) throw new Error(error?.message ?? 'Байршуулах холбоос үүсгэж чадсангүй.');

    return ok({
      bucket: MEDIA_BUCKET,
      path: storagePath,
      token: data.token,
      signedUrl: data.signedUrl,
      kind,
      familyId: membership.family_id,
    });
  });
}
