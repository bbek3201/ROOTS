import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCoupleSpace } from '@/lib/couple/space';
import { handle, ok, parseBody, uuidSchema } from '@/lib/api';
import { FIRSTS } from '@/lib/couple/firsts';

const KEYS = FIRSTS.map((first) => first.key) as [string, ...string[]];

const bodySchema = z.object({
  key: z.enum(KEYS),
  happenedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  story: z.string().trim().max(8000).optional(),
  mediaId: uuidSchema.nullable().optional(),
});

/**
 * Fill in one of the firsts.
 *
 * An upsert on (space_id, key), because a first is a fact about the
 * relationship rather than a post: writing it twice corrects it, it does not
 * add a second first date.
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id: spaceId } = await context.params;
    const body = await parseBody(request, bodySchema);
    const { space, meUserId } = await requireCoupleSpace(spaceId);

    const supabase = await createClient();
    const { error } = await supabase
      .from('couple_firsts')
      .upsert(
        {
          space_id: space.id,
          key: body.key as never,
          happened_on: body.happenedOn ?? null,
          story: body.story || null,
          media_id: body.mediaId ?? null,
          created_by: meUserId,
        },
        { onConflict: 'space_id,key' },
      );

    if (error) throw new Error(error.message);
    return ok({ ok: true });
  });
}
