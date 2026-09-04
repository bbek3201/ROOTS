import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AccessError } from '@/lib/auth/guards';
import { requireCoupleSpace } from '@/lib/couple/space';
import { handle, ok, parseBody, uuidSchema } from '@/lib/api';

const bodySchema = z.object({
  title: z.string().trim().min(1, 'Гарчиг оруулна уу').max(200),
  body: z.string().trim().min(1, 'Захиа хоосон байна').max(20000),
  unlockAt: z.string().datetime(),
  mediaId: uuidSchema.nullable().optional(),
});

/**
 * Leave something for your future selves.
 *
 * The unlock date must be in the future. A "future message" that is already
 * open is just a note, and accepting one would quietly turn the feature into
 * something it is not.
 *
 * Once written, neither of them can move the date and neither can read it —
 * there is no update policy on either table, so the only way to get the body
 * back is to wait. That is the whole feature; a peekable version of it is
 * worthless.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id: spaceId } = await context.params;
    const payload = await parseBody(request, bodySchema);
    const { space, meUserId } = await requireCoupleSpace(spaceId);

    if (new Date(payload.unlockAt).getTime() <= Date.now()) {
      throw new AccessError('Нээгдэх огноо ирээдүйд байх ёстой.', 400);
    }

    const supabase = await createClient();
    const { data: message, error } = await supabase
      .from('couple_future_messages')
      .insert({
        space_id: space.id,
        created_by: meUserId,
        title: payload.title,
        unlock_at: payload.unlockAt,
        media_id: payload.mediaId ?? null,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    const { error: bodyError } = await supabase
      .from('couple_future_message_bodies')
      .insert({ message_id: message.id, body: payload.body });

    if (bodyError) {
      await supabase.from('couple_future_messages').delete().eq('id', message.id);
      throw new Error(bodyError.message);
    }

    return ok({ id: message.id }, 201);
  });
}
