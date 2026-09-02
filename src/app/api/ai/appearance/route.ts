import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AccessError, assertFamilyAccess } from '@/lib/auth/guards';
import { getProfile } from '@/lib/auth/session';
import { getAIService } from '@/lib/ai';
import { recordAiOutput } from '@/lib/ai/record';
import { handle, ok, parseBody } from '@/lib/api';

const bodySchema = z.object({ personId: z.string().uuid() });

/**
 * Organise the family's appearance descriptions into one readable account.
 *
 * Runs SERVER-SIDE so the AI key never reaches a browser. The model is given
 * ONLY the descriptions relatives wrote, and its output is stored as a separate
 * `ai_summary` row — it never edits or replaces what a relative said, and it is
 * labelled as AI wherever it is displayed.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const { personId } = await parseBody(request, bodySchema);
    const supabase = await createClient();

    const { data: person } = await supabase
      .from('people')
      .select('id, family_id, first_name')
      .eq('id', personId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!person) throw new AccessError('Хүн олдсонгүй.', 404);
    await assertFamilyAccess(person.family_id, 'contributor');

    const { data: descriptions } = await supabase
      .from('appearance_descriptions')
      .select('id, description, contributor_name')
      .eq('person_id', personId)
      .eq('source_kind', 'family_description')
      .order('created_at', { ascending: true });

    if (!descriptions || descriptions.length === 0) {
      throw new AccessError('Эмхэтгэх тайлбар алга байна.', 400);
    }

    const ai = getAIService();
    const result = await ai.organizeAppearance({
      personName: person.first_name,
      descriptions: descriptions.map((row) => ({
        text: row.description,
        contributor: row.contributor_name,
      })),
      language: 'mn',
      grounding: descriptions.map((row) => ({ type: 'appearance' as const, id: row.id })),
    });

    const profile = await getProfile();

    const aiOutputId = await recordAiOutput({
      familyId: person.family_id,
      task: 'organize_appearance',
      provenance: result.provenance,
      subjectType: 'person',
      subjectId: personId,
      inputSummary: `${descriptions.length} appearance descriptions`,
      outputText: result.ok ? result.description : undefined,
      outputJson: result.ok ? { attributes: result.attributes, conflicts: result.conflicts } : undefined,
      userId: profile?.id ?? null,
    });

    if (!result.ok) {
      // Not an error the user caused — say what is unavailable and why.
      return ok({ unavailable: true, reason: result.reason, isMock: result.provenance.isMock }, 200);
    }

    const { error } = await supabase.from('appearance_descriptions').insert({
      family_id: person.family_id,
      person_id: personId,
      source_kind: 'ai_summary',
      description: result.description,
      narration_text: result.narration,
      attributes: result.attributes as never,
      is_ai_generated: true,
      ai_output_id: aiOutputId,
      contributed_by: profile?.id ?? null,
      contributor_name: profile?.display_name ?? 'Гэр бүлийн гишүүн',
    });

    if (error) throw new Error(error.message);

    return ok({
      description: result.description,
      narration: result.narration,
      attributes: result.attributes,
      // Disagreements between relatives are surfaced, never silently resolved.
      conflicts: result.conflicts,
      isMock: result.provenance.isMock,
    });
  });
}
