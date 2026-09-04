import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCoupleSpace } from '@/lib/couple/space';
import { handle, ok, parseBody, uuidSchema } from '@/lib/api';

const bodySchema = z.object({
  name: z.string().trim().min(1, 'Газрын нэр оруулна уу').max(200),
  visitedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(4000).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  mediaId: uuidSchema.nullable().optional(),
});

/** Somewhere they went together. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id: spaceId } = await context.params;
    const body = await parseBody(request, bodySchema);
    const { space, meUserId } = await requireCoupleSpace(spaceId);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('couple_places')
      .insert({
        space_id: space.id,
        name: body.name,
        visited_on: body.visitedOn ?? null,
        notes: body.notes || null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        media_id: body.mediaId ?? null,
        created_by: meUserId,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return ok({ id: data.id }, 201);
  });
}
