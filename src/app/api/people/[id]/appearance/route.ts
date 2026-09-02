import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertFamilyAccess, AccessError } from '@/lib/auth/guards';
import { getProfile } from '@/lib/auth/session';
import { handle, ok, parseBody } from '@/lib/api';

const bodySchema = z.object({
  description: z.string().trim().min(3, 'Тайлбар хэт богино байна').max(4000),
  narration: z.string().trim().max(6000).optional(),
});

/**
 * Record one relative's memory of how an ancestor looked.
 *
 * Always stored as source_kind 'family_description' and attributed by name. It
 * is never merged into an existing description: two relatives remembering
 * differently is information, and both versions stay.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id: personId } = await context.params;
    const body = await parseBody(request, bodySchema);

    const supabase = await createClient();

    // Resolve the person FIRST, through RLS, and take the family_id from the
    // row — never from the request. A caller cannot name a family they are not
    // in, because they never get to name one at all.
    const { data: person } = await supabase
      .from('people')
      .select('id, family_id, first_name')
      .eq('id', personId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!person) throw new AccessError('Хүн олдсонгүй.', 404);
    await assertFamilyAccess(person.family_id, 'contributor');

    const profile = await getProfile();

    const { data, error } = await supabase
      .from('appearance_descriptions')
      .insert({
        family_id: person.family_id,
        person_id: personId,
        source_kind: 'family_description',
        description: body.description,
        narration_text: body.narration ?? null,
        is_ai_generated: false,
        contributed_by: profile?.id ?? null,
        contributor_name: profile?.display_name ?? 'Гэр бүлийн гишүүн',
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return ok({ id: data.id }, 201);
  });
}
