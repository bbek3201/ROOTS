import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AccessError } from '@/lib/auth/guards';
import { requireCoupleSpace } from '@/lib/couple/space';
import { handle, ok, parseBody } from '@/lib/api';

const bodySchema = z.object({
  path: z.string().min(3).max(500),
  kind: z.enum(['photo', 'video', 'audio', 'document']),
  mimeType: z.string().max(120).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().nonnegative().optional(),
  caption: z.string().max(500).optional(),
  takenAt: z.string().datetime().optional(),
});

/**
 * Step 3 of a couple-space upload: make the file part of the space.
 *
 * A separate route from /api/media/register, and a separate table, because the
 * two have different access rules and a shared code path is exactly where a
 * private photograph would end up in the family archive by accident.
 *
 * The path is checked against this space's own prefix. The storage policy
 * already refuses a write anywhere else, but a row pointing at another space's
 * object would be a private file listed in the wrong private space — refused
 * here rather than discovered later.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id: spaceId } = await context.params;
    const body = await parseBody(request, bodySchema);
    const { space } = await requireCoupleSpace(spaceId);

    const expectedPrefix = `families/${space.family_id}/couple-space/${space.id}/`;
    if (!body.path.startsWith(expectedPrefix)) {
      throw new AccessError('Файлын зам буруу байна.', 400);
    }

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('couple_media')
      .insert({
        space_id: space.id,
        kind: body.kind,
        storage_path: body.path,
        mime_type: body.mimeType ?? null,
        size_bytes: body.sizeBytes ?? null,
        width: body.width ?? null,
        height: body.height ?? null,
        duration_seconds: body.durationSeconds ?? null,
        caption: body.caption ?? null,
        taken_at: body.takenAt ?? null,
        uploaded_by: auth.user?.id ?? null,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return ok({ id: data.id }, 201);
  });
}
