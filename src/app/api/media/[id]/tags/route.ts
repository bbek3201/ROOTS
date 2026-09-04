import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertFamilyAccess, AccessError } from '@/lib/auth/guards';
import { getProfile } from '@/lib/auth/session';
import { handle, ok, parseBody, uuidSchema } from '@/lib/api';

const tagSchema = z.object({
  personId: uuidSchema,
  /** Optional face box, normalised 0..1 so it survives every resize. */
  box: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0).max(1),
      height: z.number().min(0).max(1),
    })
    .optional(),
});

/**
 * Resolve a photo and the person in it through RLS, together.
 *
 * The family_id is taken from the rows, never from the request, and both rows
 * must belong to the same family — otherwise a caller who happens to be in two
 * families could tag a relative from one of them into a photograph from the
 * other, and the photo would then appear on that person's wall for people who
 * were never meant to see it.
 */
async function resolve(mediaId: string, personId: string) {
  const supabase = await createClient();

  const [{ data: media }, { data: person }] = await Promise.all([
    supabase.from('media').select('id, family_id, kind')
      .eq('id', mediaId).is('deleted_at', null).maybeSingle(),
    supabase.from('people').select('id, family_id')
      .eq('id', personId).is('deleted_at', null).maybeSingle(),
  ]);

  if (!media || !person) throw new AccessError('Зураг эсвэл хүн олдсонгүй.', 404);
  if (media.kind !== 'photo') throw new AccessError('Зөвхөн зураг дээр хүн тэмдэглэнэ.', 400);
  if (media.family_id !== person.family_id) throw new AccessError('Зураг олдсонгүй.', 404);

  await assertFamilyAccess(media.family_id, 'contributor');
  return { supabase, familyId: media.family_id };
}

/**
 * Say who is in a photograph.
 *
 * A tag made by a person is confirmed the moment it is made — a relative
 * pointing at their own grandmother is not a guess awaiting review. Only the AI
 * leaves tags unconfirmed, and this route never creates those.
 *
 * Tagging twice is not an error. The unique (media_id, person_id) constraint
 * turns the second attempt into an upsert, so two relatives naming the same
 * face at the same moment both succeed.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id: mediaId } = await context.params;
    const body = await parseBody(request, tagSchema);
    const { supabase, familyId } = await resolve(mediaId, body.personId);
    const profile = await getProfile();

    const { error } = await supabase
      .from('photo_people_tags')
      .upsert(
        {
          family_id: familyId,
          media_id: mediaId,
          person_id: body.personId,
          box_x: body.box?.x ?? null,
          box_y: body.box?.y ?? null,
          box_width: body.box?.width ?? null,
          box_height: body.box?.height ?? null,
          suggested_by_ai: false,
          confirmed_by: profile?.id ?? null,
          confirmed_at: new Date().toISOString(),
          created_by: profile?.id ?? null,
        },
        { onConflict: 'media_id,person_id' },
      );

    if (error) throw new Error(error.message);
    return ok({ ok: true }, 201);
  });
}

/**
 * Take a name back off a photograph.
 *
 * Removing the tag removes the photo from that person's wall, and nothing else
 * — the photograph itself is untouched. Being wrong about who is in a picture
 * should never cost the picture.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id: mediaId } = await context.params;
    const body = await parseBody(request, z.object({ personId: uuidSchema }));
    const { supabase } = await resolve(mediaId, body.personId);

    const { error } = await supabase
      .from('photo_people_tags')
      .delete()
      .eq('media_id', mediaId)
      .eq('person_id', body.personId);

    if (error) throw new Error(error.message);
    return ok({ ok: true });
  });
}
