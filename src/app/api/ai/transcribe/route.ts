import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AccessError, assertFamilyAccess } from '@/lib/auth/guards';
import { getProfile } from '@/lib/auth/session';
import { getAIService } from '@/lib/ai';
import { recordAiOutput } from '@/lib/ai/record';
import { handle, ok, parseBody } from '@/lib/api';
import { MEDIA_BUCKET } from '@/lib/media/constants';

const bodySchema = z.object({
  mediaId: z.string().uuid(),
  interviewId: z.string().uuid(),
  questionId: z.string().uuid().nullable().optional(),
});

/** Audio bigger than this is not sent to a model; the recording is kept regardless. */
const MAX_TRANSCRIBE_BYTES = 25 * 1024 * 1024;

/**
 * Transcribe an interview answer.
 *
 * The ORIGINAL recording is already saved and is never touched by this route.
 * A transcript is an interpretation layered on top: if transcription is
 * unavailable, or wrong, the voice itself is still there — which is the part
 * that actually cannot be recreated.
 *
 * Transcripts are marked with their provider and is_mock, and a human editing
 * one preserves the machine version (enforced by a database trigger).
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);
    const supabase = await createClient();

    const { data: media } = await supabase
      .from('media')
      .select('id, family_id, storage_path, mime_type, size_bytes, kind')
      .eq('id', body.mediaId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!media || media.kind !== 'audio') throw new AccessError('Бичлэг олдсонгүй.', 404);
    const membership = await assertFamilyAccess(media.family_id, 'contributor');

    const ai = getAIService();

    // Don't download a large file just to hand it to a provider that will
    // refuse it — and never fail silently on the user.
    if ((media.size_bytes ?? 0) > MAX_TRANSCRIBE_BYTES) {
      return ok({
        unavailable: true,
        reason: 'Бичлэг хэт урт байна. Бичвэрийг гараар оруулна уу — эх бичлэг архивт хадгалагдсан.',
        isMock: ai.isMock,
      });
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .download(media.storage_path);

    if (downloadError || !file) throw new Error('Бичлэгийг уншиж чадсангүй.');

    // Give the provider the names in this family so it spells them correctly
    // rather than transliterating them into something unrecognisable.
    const { data: people } = await supabase
      .from('people')
      .select('first_name')
      .eq('family_id', media.family_id)
      .is('deleted_at', null)
      .limit(200);

    const result = await ai.transcribe({
      audio: { data: await file.arrayBuffer(), mimeType: media.mime_type ?? 'audio/webm' },
      language: membership.family.default_locale,
      nameHints: (people ?? []).map((person) => person.first_name),
    });

    const profile = await getProfile();
    await recordAiOutput({
      familyId: media.family_id,
      task: 'transcribe',
      provenance: result.provenance,
      subjectType: 'media',
      subjectId: media.id,
      outputText: result.ok ? result.text : result.reason,
      userId: profile?.id ?? null,
    });

    if (!result.ok) {
      await supabase.from('audio_recordings')
        .update({ transcript_status: 'skipped' })
        .eq('media_id', media.id);
      return ok({ unavailable: true, reason: result.reason, isMock: result.provenance.isMock });
    }

    const { data: transcript, error } = await supabase
      .from('interview_transcripts')
      .insert({
        family_id: media.family_id,
        interview_id: body.interviewId,
        question_id: body.questionId ?? null,
        audio_media_id: media.id,
        transcript_text: result.text,
        language: result.language,
        confidence: result.confidence,
        provider: result.provenance.provider,
        model: result.provenance.model,
        is_mock: result.provenance.isMock,
      })
      .select('id, transcript_text')
      .single();

    if (error) throw new Error(error.message);

    await supabase.from('audio_recordings')
      .update({ transcript_status: 'done' })
      .eq('media_id', media.id);

    return ok({
      id: transcript.id,
      text: transcript.transcript_text,
      isMock: result.provenance.isMock,
    });
  });
}
