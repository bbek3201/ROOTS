import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AccessError } from '@/lib/auth/guards';
import { handle, ok, parseBody } from '@/lib/api';

/**
 * Accept an invitation to a couple space.
 *
 * Everything real happens in accept_couple_invitation, which runs as definer
 * because the person accepting is by definition not yet a member and so cannot
 * see the invitation row they are accepting.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const { token } = await parseBody(request, z.object({ token: z.string().min(16).max(200) }));

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('accept_couple_invitation', { p_token: token });

    // Expired, revoked, already used, or never real — all one answer, because
    // distinguishing them tells an outsider which tokens exist.
    if (error) throw new AccessError('Энэ урилга хүчингүй болсон байна.', 404);

    return ok({ spaceId: data as string });
  });
}
