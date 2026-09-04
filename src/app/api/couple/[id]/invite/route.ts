import { createClient } from '@/lib/supabase/server';
import { requireCoupleSpace } from '@/lib/couple/space';
import { handle, ok } from '@/lib/api';

/**
 * A one-time link for the other half of the couple.
 *
 * The plaintext token is returned exactly once and never stored — only its
 * hash is. A database backup should not hand anyone the key to a couple's
 * letters, and this route is the only place the token ever exists in the clear.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id: spaceId } = await context.params;
    const { space } = await requireCoupleSpace(spaceId);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('invite_to_couple_space', { p_space_id: space.id });
    if (error) throw new Error(error.message);

    return ok({ token: data as string }, 201);
  });
}
