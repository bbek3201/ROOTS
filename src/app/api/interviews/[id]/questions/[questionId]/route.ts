import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AccessError, assertFamilyAccess } from '@/lib/auth/guards';
import { getProfile } from '@/lib/auth/session';
import { handle, ok, parseBody } from '@/lib/api';

const bodySchema = z.object({
  audioMediaId: z.string().uuid().nullable().optional(),
  skipped: z.boolean().optional(),
  answered: z.boolean().optional(),
  transcriptText: z.string().max(20000).optional(),
  transcriptId: z.string().uuid().optional(),
});

/**
 * Update one answer in an interview.
 *
 * Editing a transcript writes through to interview_transcripts, where a
 * database trigger copies the machine version into original_text the first
 * time a human changes it. A relative correcting a misheard name therefore
 * improves the archive without erasing what was actually produced.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; questionId: string }> },
) {
  return handle(async () => {
    const { id: interviewId, questionId } = await context.params;
    const body = await parseBody(request, bodySchema);
    const supabase = await createClient();

    const { data: question } = await supabase
      .from('interview_questions')
      .select('id, family_id, interview_id')
      .eq('id', questionId)
      .eq('interview_id', interviewId)
      .maybeSingle();

    if (!question) throw new AccessError('Асуулт олдсонгүй.', 404);
    await assertFamilyAccess(question.family_id, 'contributor');

    // Typed rather than Record<string, unknown> so a renamed column fails the
    // build instead of silently updating nothing.
    const updates: Partial<{
      audio_media_id: string | null;
      skipped: boolean;
      answered_at: string;
    }> = {};
    if (body.audioMediaId !== undefined) updates.audio_media_id = body.audioMediaId;
    if (body.skipped !== undefined) updates.skipped = body.skipped;
    if (body.answered) updates.answered_at = new Date().toISOString();

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('interview_questions')
        .update(updates)
        .eq('id', questionId);
      if (error) throw new Error(error.message);
    }

    if (body.transcriptText !== undefined) {
      const profile = await getProfile();

      if (body.transcriptId) {
        const { error } = await supabase
          .from('interview_transcripts')
          .update({ transcript_text: body.transcriptText, edited_by: profile?.id ?? null })
          .eq('id', body.transcriptId);
        if (error) throw new Error(error.message);
      } else {
        // A typed-in transcript is not a mock AI output — it is a person's own
        // work, and provider records that honestly.
        const { error } = await supabase.from('interview_transcripts').insert({
          family_id: question.family_id,
          interview_id: interviewId,
          question_id: questionId,
          audio_media_id: body.audioMediaId ?? null,
          transcript_text: body.transcriptText,
          provider: 'human',
          is_mock: false,
        });
        if (error) throw new Error(error.message);
      }
    }

    // Keep the interview's updated_at fresh so "continue where you left off"
    // on the home screen points at the right session.
    await supabase
      .from('interviews')
      .update({ status: 'in_progress' })
      .eq('id', interviewId)
      .in('status', ['draft', 'paused']);

    return ok({ saved: true });
  });
}
