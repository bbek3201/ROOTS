import { z } from 'zod';
import { assertFamilyAccess } from '@/lib/auth/guards';
import { getActiveFamily } from '@/lib/family-context';
import { getProfile } from '@/lib/auth/session';
import { getFamilyIndex } from '@/lib/data/family';
import { resolveFamilyQuestion } from '@/lib/assistant/resolver';
import { getAIService } from '@/lib/ai';
import { recordAiOutput } from '@/lib/ai/record';
import { handle, ok, parseBody } from '@/lib/api';
import { AccessError } from '@/lib/auth/guards';

const bodySchema = z.object({
  question: z.string().trim().min(2).max(500),
  familyId: z.string().uuid().optional(),
});

/**
 * The family assistant.
 *
 * ORDER MATTERS HERE, and it is the whole design:
 *
 *   1. The relationship graph answers the question. This is exact, instant,
 *      free, and works with no AI provider configured at all.
 *   2. AI is called ONLY when step 1 could not parse the question — and even
 *      then it is handed the family's own facts and forbidden from adding to
 *      them.
 *   3. If neither can answer, ROOTS says the archive does not know. It never
 *      fills the gap.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);

    const active = await getActiveFamily();
    const familyId = body.familyId ?? active?.family_id;
    const membership = await assertFamilyAccess(familyId, 'viewer');

    const index = await getFamilyIndex(membership.family_id);

    const resolved = resolveFamilyQuestion({
      index,
      subjectPersonId: membership.person_id,
      question: body.question,
      locale: membership.family.default_locale,
    });

    // The database answered. No model call, no latency, no risk of invention.
    if (!resolved.needsAI) {
      return ok({
        source: 'database' as const,
        intent: resolved.intent,
        answer: resolved.facts.join('\n'),
        facts: resolved.facts,
        unknown: resolved.unknown,
        people: resolved.people.map((person) => ({
          id: person.id,
          name: person.first_name,
          birthDate: person.birth_date,
          deathDate: person.death_date,
        })),
        isMock: false,
      });
    }

    // Fall back to AI for phrasing only, grounded in what we could find.
    const ai = getAIService();
    const result = await ai.answerFamilyQuestion({
      question: body.question,
      language: membership.family.default_locale,
      facts: resolved.facts,
      grounding: resolved.grounding,
    });

    const profile = await getProfile();
    await recordAiOutput({
      familyId: membership.family_id,
      task: 'answer_question',
      provenance: result.provenance,
      subjectType: 'family',
      subjectId: membership.family_id,
      inputSummary: body.question,
      outputText: result.ok ? result.answer : result.reason,
      userId: profile?.id ?? null,
    });

    if (!result.ok) {
      return ok({
        source: 'ai' as const,
        intent: resolved.intent,
        answer:
          'Энэ асуултыг ойлгож чадсангүй. Хүний нэрээр эсвэл «Аавын минь аав хэн бэ?» гэх мэтээр асууж үзнэ үү.',
        facts: [],
        unknown: true,
        people: [],
        isMock: result.provenance.isMock,
        unavailableReason: result.reason,
      });
    }

    return ok({
      source: 'ai' as const,
      intent: resolved.intent,
      answer: result.answer,
      facts: resolved.facts,
      unknown: !result.answered,
      people: [],
      isMock: result.provenance.isMock,
    });
  });
}

export async function GET() {
  throw new AccessError('POST ашиглана уу.', 405);
}
