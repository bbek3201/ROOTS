import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AccessError, assertFamilyAccess } from '@/lib/auth/guards';
import { handle, ok, parseBody } from '@/lib/api';

const bodySchema = z.object({
  status: z.enum(['in_progress', 'paused', 'completed', 'archived']).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await context.params;
    const body = await parseBody(request, bodySchema);
    const supabase = await createClient();

    const { data: interview } = await supabase
      .from('interviews')
      .select('id, family_id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (!interview) throw new AccessError('Ярилцлага олдсонгүй.', 404);
    await assertFamilyAccess(interview.family_id, 'contributor');

    const { error } = await supabase
      .from('interviews')
      .update({
        ...(body.status ? { status: body.status } : {}),
        ...(body.status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return ok({ saved: true });
  });
}
