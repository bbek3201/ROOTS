import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCoupleSpace } from '@/lib/couple/space';
import { handle, ok, parseBody, uuidSchema } from '@/lib/api';

const bodySchema = z.object({
  title: z.string().trim().min(1, 'Гарчиг оруулна уу').max(200),
  body: z.string().trim().min(1, 'Захидал хоосон байна').max(20000),
  /** Null means they can read it now. */
  unlockAt: z.string().datetime().nullable().optional(),
  mediaId: uuidSchema.nullable().optional(),
});

/**
 * Write a letter.
 *
 * Two inserts, and the second one is the letter. The envelope carries the
 * title, the date and the seal; the body lives in its own table because that is
 * the only way Postgres can withhold it — row-level security is exactly that,
 * and a body in the same row as its title would be one `select *` away from
 * being read early.
 *
 * If the body insert fails the envelope is removed again, so a letter is never
 * left standing with nothing inside it.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id: spaceId } = await context.params;
    const payload = await parseBody(request, bodySchema);
    const { space, meUserId } = await requireCoupleSpace(spaceId);

    const supabase = await createClient();
    const { data: letter, error } = await supabase
      .from('couple_letters')
      .insert({
        space_id: space.id,
        sender_id: meUserId,
        title: payload.title,
        unlock_at: payload.unlockAt ?? null,
        media_id: payload.mediaId ?? null,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    const { error: bodyError } = await supabase
      .from('couple_letter_bodies')
      .insert({ letter_id: letter.id, body: payload.body });

    if (bodyError) {
      await supabase.from('couple_letters').delete().eq('id', letter.id);
      throw new Error(bodyError.message);
    }

    return ok({ id: letter.id }, 201);
  });
}
