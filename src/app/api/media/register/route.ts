import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AccessError, assertFamilyAccess } from '@/lib/auth/guards';
import { getProfile } from '@/lib/auth/session';
import { handle, ok, parseBody } from '@/lib/api';
import { MEDIA_BUCKET } from '@/lib/media/storage';

const bodySchema = z.object({
  familyId: z.string().uuid(),
  path: z.string().min(10).max(500),
  kind: z.enum(['photo', 'video', 'audio', 'document']),
  mimeType: z.string().max(120),
  sizeBytes: z.number().int().nonnegative().optional(),
  originalFilename: z.string().max(255).optional(),
  caption: z.string().max(500).optional(),
  takenAt: z.string().datetime().nullable().optional(),
  durationSeconds: z.number().nonnegative().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  memoryId: z.string().uuid().nullable().optional(),
  personId: z.string().uuid().nullable().optional(),
  coupleId: z.string().uuid().nullable().optional(),
  interviewId: z.string().uuid().nullable().optional(),
  speakerPersonId: z.string().uuid().nullable().optional(),
});

/**
 * Step 2 of an upload: record the file in the database.
 *
 * Writes the `media` supertype row plus the row for its specific kind, so a
 * photo gets its photo columns and an audio recording gets its speaker and
 * consent columns. Both rows are written here rather than by a trigger so that
 * a failure surfaces to the uploader instead of silently leaving a file with no
 * record of what it is.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);
    await assertFamilyAccess(body.familyId, 'contributor');

    // The path was minted by /api/media/prepare for this family. Re-check it
    // here anyway: this endpoint is separately reachable.
    if (!body.path.startsWith(`families/${body.familyId}/`)) {
      throw new AccessError('Файлын зам буруу байна.', 400);
    }
    if (!body.path.includes('/original/')) {
      throw new AccessError('Зөвхөн эх файл бүртгэнэ.', 400);
    }

    const supabase = await createClient();
    const profile = await getProfile();

    const { data: media, error } = await supabase
      .from('media')
      .insert({
        family_id: body.familyId,
        kind: body.kind,
        variant: 'original',
        storage_bucket: MEDIA_BUCKET,
        storage_path: body.path,
        original_filename: body.originalFilename ?? null,
        mime_type: body.mimeType,
        size_bytes: body.sizeBytes ?? null,
        caption: body.caption ?? null,
        taken_at: body.takenAt ?? null,
        duration_seconds: body.durationSeconds ?? null,
        width: body.width ?? null,
        height: body.height ?? null,
        memory_id: body.memoryId ?? null,
        person_id: body.personId ?? null,
        couple_id: body.coupleId ?? null,
        uploaded_by: profile?.id ?? null,
        uploaded_by_name: profile?.display_name ?? 'Гэр бүлийн гишүүн',
      })
      .select('id')
      .single();

    if (error || !media) throw new Error(error?.message ?? 'Медиа бүртгэж чадсангүй.');

    const subtype = { media_id: media.id, family_id: body.familyId };
    switch (body.kind) {
      case 'photo':
        await supabase.from('photos').insert(subtype);
        break;
      case 'video':
        await supabase.from('videos').insert(subtype);
        break;
      case 'audio':
        await supabase.from('audio_recordings').insert({
          ...subtype,
          speaker_person_id: body.speakerPersonId ?? null,
          interview_id: body.interviewId ?? null,
          recorded_at: body.takenAt ?? new Date().toISOString(),
          // Voice cloning is off unless a family explicitly turns it on later.
          voice_cloning_consent: false,
        });
        break;
      case 'document':
        await supabase.from('documents').insert(subtype);
        break;
    }

    return ok({ id: media.id }, 201);
  });
}
