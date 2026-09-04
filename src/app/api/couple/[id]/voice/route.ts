import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCoupleSpace } from '@/lib/couple/space';
import { handle, ok, parseBody, uuidSchema } from '@/lib/api';

const bodySchema = z.object({
  mediaId: uuidSchema,
  title: z.string().trim().min(1, 'Гарчиг оруулна уу').max(200),
  description: z.string().trim().max(4000).optional(),
  recordedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

/** A recording, with a name on it so it can be found again. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id: spaceId } = await context.params;
    const body = await parseBody(request, bodySchema);
    const { space, meUserId } = await requireCoupleSpace(spaceId);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('couple_voice_memories')
      .insert({
        space_id: space.id,
        media_id: body.mediaId,
        title: body.title,
        description: body.description || null,
        recorded_on: body.recordedOn ?? new Date().toISOString().slice(0, 10),
        created_by: meUserId,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return ok({ id: data.id }, 201);
  });
}
