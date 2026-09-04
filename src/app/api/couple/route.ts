import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AccessError } from '@/lib/auth/guards';
import { handle, ok, parseBody, uuidSchema } from '@/lib/api';

const bodySchema = z.object({
  coupleId: uuidSchema,
  startedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  howWeMet: z.string().trim().max(8000).optional(),
});

/**
 * Open a couple space.
 *
 * The decision of who may do this is not the family role — an editor can change
 * anyone's marriage date, and that is nothing like being in the relationship.
 * create_couple_space asks whether the caller IS one of the two people, and
 * refuses otherwise; this route just carries the answer back.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('create_couple_space', {
      p_couple_id: body.coupleId,
      p_started_on: body.startedOn ?? null,
      p_how_we_met: body.howWeMet ?? null,
    });

    if (error) {
      // The partner opened it first. They can see it and this caller cannot,
      // so the useful answer is "ask them", not "already exists".
      if (error.code === '23505') {
        throw new AccessError(
          'Танай хань энэ орон зайг аль хэдийн нээсэн байна. Түүнээс урилга авна уу.',
          409,
        );
      }
      if (error.code === '42501') {
        throw new AccessError('Зөвхөн тухайн хоёр хүн энэ орон зайг нээнэ.', 403);
      }
      throw new Error(error.message);
    }

    return ok({ spaceId: data as string }, 201);
  });
}
