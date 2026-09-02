import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AccessError, assertFamilyAccess } from '@/lib/auth/guards';
import { getActiveFamily } from '@/lib/family-context';
import { getProfile } from '@/lib/auth/session';
import { handle, ok, parseBody } from '@/lib/api';

const bodySchema = z.object({
  subjectPersonId: z.string().uuid(),
  setId: z.string().uuid().nullable().optional(),
  title: z.string().max(200).optional(),
});

/**
 * Start an interview.
 *
 * The whole question list is materialised into interview_questions up front
 * rather than being read live from the template. An interview may be paused for
 * months and resumed by a different relative; freezing the questions means the
 * session someone half-finished is still the session they come back to, even if
 * ROOTS later changes its built-in questions.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);
    const active = await getActiveFamily();
    const membership = await assertFamilyAccess(active?.family_id, 'contributor');

    const supabase = await createClient();

    const { data: subject } = await supabase
      .from('people')
      .select('id, family_id, first_name')
      .eq('id', body.subjectPersonId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!subject || subject.family_id !== membership.family_id) {
      throw new AccessError('Хүн олдсонгүй.', 404);
    }

    const profile = await getProfile();

    const { data: interview, error } = await supabase
      .from('interviews')
      .insert({
        family_id: membership.family_id,
        subject_person_id: subject.id,
        interviewer_id: profile?.id ?? null,
        interviewer_name: profile?.display_name ?? null,
        set_id: body.setId ?? null,
        title: body.title ?? `${subject.first_name} — амьдралын түүх`,
        status: 'in_progress',
        language: membership.family.default_locale,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !interview) throw new Error(error?.message ?? 'interview');

    if (body.setId) {
      const { data: templates } = await supabase
        .from('interview_question_templates')
        .select('order_index, question_key, question_text')
        .eq('set_id', body.setId)
        .order('order_index', { ascending: true });

      if (templates && templates.length > 0) {
        const { error: questionError } = await supabase.from('interview_questions').insert(
          templates.map((template) => ({
            family_id: membership.family_id,
            interview_id: interview.id,
            order_index: template.order_index,
            question_key: template.question_key,
            question_text: template.question_text,
          })),
        );
        if (questionError) throw new Error(questionError.message);
      }
    }

    return ok({ id: interview.id }, 201);
  });
}
