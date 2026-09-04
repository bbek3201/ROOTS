import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCoupleSpace } from '@/lib/couple/space';
import { handle, ok, parseBody, uuidSchema } from '@/lib/api';

const bodySchema = z.object({
  title: z.string().trim().min(1, 'Гарчиг оруулна уу').max(200),
  description: z.string().trim().max(8000).optional(),
  memoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  placeLabel: z.string().trim().max(200).optional(),
  mood: z.string().trim().max(60).optional(),
  /** Files already uploaded into this space, in the order they should show. */
  mediaIds: z.array(uuidSchema).max(30).optional(),
});

/**
 * Keep a moment.
 *
 * The media are attached rather than uploaded here: the bytes went straight to
 * storage from the browser and were registered against this space, so all that
 * is left is to say which of them belong to this memory and in what order.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id: spaceId } = await context.params;
    const body = await parseBody(request, bodySchema);
    const { space, meUserId } = await requireCoupleSpace(spaceId);

    const supabase = await createClient();
    const { data: memory, error } = await supabase
      .from('couple_memories')
      .insert({
        space_id: space.id,
        created_by: meUserId,
        title: body.title,
        description: body.description || null,
        memory_date: body.memoryDate ?? null,
        date_precision: body.memoryDate ? 'exact' : 'unknown',
        place_label: body.placeLabel || null,
        mood: body.mood || null,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    if (body.mediaIds && body.mediaIds.length > 0) {
      // RLS on couple_media means an id from another space simply does not
      // exist for this caller, and the insert fails rather than linking it.
      const { error: linkError } = await supabase.from('couple_memory_media').insert(
        body.mediaIds.map((mediaId, position) => ({
          memory_id: memory.id,
          media_id: mediaId,
          position,
        })),
      );
      if (linkError) throw new Error(linkError.message);
    }

    return ok({ id: memory.id }, 201);
  });
}
