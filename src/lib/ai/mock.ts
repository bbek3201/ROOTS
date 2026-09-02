import type {
  AIProvenance,
  AIResult,
  AIService,
  AnalyzePhotoInput,
  AnalyzePhotoOutput,
  AppearanceInput,
  AppearanceOutput,
  ExtractTimelineInput,
  ExtractTimelineOutput,
  ExtractedEvent,
  FamilyQuestionInput,
  FamilyQuestionOutput,
  FamilyStoryInput,
  FamilyStoryOutput,
  GroundingRef,
  OcrInput,
  OcrOutput,
  SummarizeInput,
  SummarizeOutput,
  TranscribeInput,
  TranscribeOutput,
} from './types';

/**
 * The development AI provider.
 *
 * It is NOT a pretend model. Where a task genuinely needs a model — hearing
 * audio, seeing a photograph, reading handwriting — it returns
 * `ok: false, unavailable: true` with a plain explanation, and the UI tells the
 * user that AI is not configured and offers to let them type it in themselves.
 *
 * Where a task is really text rearrangement — summarising, pulling dates out,
 * merging descriptions, assembling a story from facts — it does the work
 * honestly and deterministically, using ONLY the input it was given. That means
 * ROOTS is fully usable with no AI provider at all, which is the point: a
 * family archive must not stop working because an API key expired.
 *
 * Every result it returns carries isMock: true, all the way to the screen.
 */

const started = () => Date.now();

function provenance(startedAt: number, grounding: GroundingRef[] = []): AIProvenance {
  return {
    provider: 'mock',
    model: null,
    isMock: true,
    groundedOn: grounding,
    latencyMs: Date.now() - startedAt,
  };
}

function unavailable<T>(startedAt: number, reason: string, grounding: GroundingRef[] = []): AIResult<T> {
  return { ok: false, unavailable: true, reason, provenance: provenance(startedAt, grounding) };
}

/** Split text into sentences across Latin and Cyrillic punctuation. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/** Words that carry meaning, used to score which sentences matter most. */
function contentWords(text: string): string[] {
  return text
    .toLocaleLowerCase('mn-MN')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 3);
}

export class MockAIService implements AIService {
  readonly name = 'mock' as const;
  readonly model = null;
  readonly isMock = true;

  /** Hearing audio requires a real model. We will not invent words. */
  async transcribe(_input: TranscribeInput): Promise<AIResult<TranscribeOutput>> {
    const startedAt = started();
    return unavailable(
      startedAt,
      'Ярианаас текст хөрвүүлэх AI үйлчилгээ тохируулагдаагүй байна. Бичлэг архивт бүрэн хадгалагдсан бөгөөд та бичвэрийг гараар оруулж болно.',
    );
  }

  /**
   * Extractive summarisation: the summary is built from sentences that are
   * actually in the source, so it cannot contain a fact the family did not say.
   */
  async summarize(input: SummarizeInput): Promise<AIResult<SummarizeOutput>> {
    const startedAt = started();
    const all = sentences(input.text);

    if (all.length === 0) {
      return unavailable(startedAt, 'Хураангуйлах текст алга байна.', input.grounding ?? []);
    }

    const frequency = new Map<string, number>();
    for (const word of contentWords(input.text)) {
      frequency.set(word, (frequency.get(word) ?? 0) + 1);
    }

    const scored = all.map((sentence, position) => {
      const words = contentWords(sentence);
      const weight = words.reduce((sum, word) => sum + (frequency.get(word) ?? 0), 0);
      return {
        sentence,
        position,
        // Normalise by length so a long rambling sentence does not win by mass,
        // and give the opening a nudge — people lead with what matters.
        score: (weight / Math.max(words.length, 1)) + (position === 0 ? 1.5 : 0),
      };
    });

    const wanted = Math.max(1, Math.min(input.maxSentences ?? 3, all.length));
    const chosen = [...scored]
      .sort((a, b) => b.score - a.score)
      .slice(0, wanted)
      .sort((a, b) => a.position - b.position);

    return {
      ok: true,
      summary: chosen.map((item) => item.sentence).join(' '),
      keyPoints: chosen.map((item) => item.sentence),
      provenance: provenance(startedAt, input.grounding ?? []),
    };
  }

  /**
   * Date extraction by pattern, not by inference. A year is only reported when
   * it is literally written in the text, and the sentence it came from travels
   * with it as evidence so a human can confirm before it enters the timeline.
   */
  async extractTimeline(input: ExtractTimelineInput): Promise<AIResult<ExtractTimelineOutput>> {
    const startedAt = started();
    const events: ExtractedEvent[] = [];

    for (const sentence of sentences(input.text)) {
      const yearMatch = sentence.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
      if (!yearMatch?.[1]) continue;

      events.push({
        title: sentence.length > 80 ? `${sentence.slice(0, 77)}…` : sentence,
        date: `${yearMatch[1]}-01-01`,
        datePrecision: 'year',
        eventType: guessEventType(sentence),
        description: null,
        evidence: sentence,
      });
    }

    return {
      ok: true,
      events,
      provenance: provenance(startedAt, input.grounding ?? []),
    };
  }

  /** Seeing a photograph requires a real model. */
  async analyzePhoto(_input: AnalyzePhotoInput): Promise<AIResult<AnalyzePhotoOutput>> {
    const startedAt = started();
    return unavailable(
      startedAt,
      'Зураг таних AI үйлчилгээ тохируулагдаагүй байна. Зураг дээрх хүмүүсийг та өөрөө тэмдэглэж болно.',
    );
  }

  /** Reading a scanned document requires a real model. */
  async ocr(_input: OcrInput): Promise<AIResult<OcrOutput>> {
    const startedAt = started();
    return unavailable(
      startedAt,
      'Баримт уншигч AI үйлчилгээ тохируулагдаагүй байна. Эх баримт архивт хадгалагдсан.',
    );
  }

  /**
   * The database has already resolved the facts by the time we get here. The
   * mock's only job is to present them — and to say "unknown" when the list is
   * empty rather than filling the silence.
   */
  async answerFamilyQuestion(input: FamilyQuestionInput): Promise<AIResult<FamilyQuestionOutput>> {
    const startedAt = started();

    if (input.facts.length === 0) {
      return {
        ok: true,
        answered: false,
        answer: 'Энэ талаар хадгалагдсан мэдээлэл алга байна. Гэр бүлийн гишүүдээсээ асууж, архивт нэмж болно.',
        provenance: provenance(startedAt, input.grounding ?? []),
      };
    }

    return {
      ok: true,
      answered: true,
      answer: input.facts.join('\n'),
      provenance: provenance(startedAt, input.grounding ?? []),
    };
  }

  /**
   * A narrative assembled from verified facts, with memories kept in a clearly
   * separate section. Templated rather than generated — every sentence traces
   * back to a row a family member entered.
   */
  async generateFamilyStory(input: FamilyStoryInput): Promise<AIResult<FamilyStoryOutput>> {
    const startedAt = started();

    if (input.facts.length === 0 && input.memories.length === 0) {
      return unavailable(
        startedAt,
        'Түүх бичихэд хангалттай мэдээлэл алга байна. Эхлээд хүмүүс, огноо, дурсамжаа нэмнэ үү.',
        input.grounding ?? [],
      );
    }

    const paragraphs: string[] = [];
    paragraphs.push(`${input.familyName} — хадгалагдсан мэдээлэлд тулгуурласан гэр бүлийн товч түүх.`);

    if (input.facts.length > 0) {
      paragraphs.push('Баримтжсан үйл явдлууд:');
      paragraphs.push(input.facts.map((fact) => `• ${fact}`).join('\n'));
    }

    const memorySections: string[] = [];
    if (input.memories.length > 0) {
      paragraphs.push('Гэр бүлийн дурсамжаас:');
      for (const memory of input.memories) {
        const line = `• «${memory.text}» — ${memory.contributor}${memory.date ? `, ${memory.date}` : ''}`;
        memorySections.push(line);
        paragraphs.push(line);
      }
    }

    paragraphs.push(
      'Энэ түүх нь зөвхөн ROOTS-д хадгалагдсан мэдээллээс бүрдсэн болно. Баримт ба хувийн дурсамжийг тусад нь харуулав.',
    );

    return {
      ok: true,
      story: paragraphs.join('\n\n'),
      memoryDerivedSections: memorySections,
      provenance: provenance(startedAt, input.grounding ?? []),
    };
  }

  /**
   * Merges what relatives said about an ancestor's appearance into one readable
   * description — and surfaces, rather than settles, the places they disagree.
   */
  async organizeAppearance(input: AppearanceInput): Promise<AIResult<AppearanceOutput>> {
    const startedAt = started();

    if (input.descriptions.length === 0) {
      return unavailable(startedAt, 'Дүр төрхийн тайлбар оруулаагүй байна.', input.grounding ?? []);
    }

    const attributes: Record<string, string> = {};
    const conflicts: string[] = [];

    for (const facet of APPEARANCE_FACETS) {
      const hits = input.descriptions.filter((entry) =>
        facet.keywords.some((keyword) => entry.text.toLocaleLowerCase('mn-MN').includes(keyword)),
      );
      if (hits.length === 0) continue;

      const phrases = [...new Set(hits.map((hit) => extractPhrase(hit.text, facet.keywords)))];
      attributes[facet.key] = phrases.join('; ');

      // Two relatives describing the same feature differently is data, not noise.
      if (phrases.length > 1) {
        conflicts.push(
          `${facet.label}: ${hits.map((hit) => `${hit.contributor} — «${extractPhrase(hit.text, facet.keywords)}»`).join(' / ')}`,
        );
      }
    }

    const combined = input.descriptions
      .map((entry) => entry.text.trim().replace(/\s+/g, ' '))
      .join(' ');

    const narration =
      `${input.personName}-ийн дүр төрхийг гэр бүлийнхэн ингэж дурсдаг. ${combined} ` +
      'Энэ бол гэрэл зураг биш, гэр бүлийн дурсамжаас цуглуулсан тайлбар юм.';

    return {
      ok: true,
      description: combined,
      attributes,
      narration,
      conflicts,
      provenance: provenance(startedAt, input.grounding ?? []),
    };
  }
}

/**
 * Appearance vocabulary lives in data, not in code branches, so another
 * language can be added by extending this list.
 */
const APPEARANCE_FACETS: Array<{ key: string; label: string; keywords: string[] }> = [
  { key: 'height', label: 'Өндөр', keywords: ['өндөр', 'намхан', 'нуруу'] },
  { key: 'build', label: 'Бие', keywords: ['туранхай', 'тарган', 'бүдүүн', 'нарийн', 'чийрэг'] },
  { key: 'face', label: 'Царай', keywords: ['царай', 'хацар', 'эрүү', 'дүрс'] },
  { key: 'hair', label: 'Үс', keywords: ['үс', 'сахал', 'буурал'] },
  { key: 'eyebrows', label: 'Хөмсөг', keywords: ['хөмсөг'] },
  { key: 'eyes', label: 'Нүд', keywords: ['нүд', 'харц'] },
  { key: 'nose', label: 'Хамар', keywords: ['хамар'] },
  { key: 'marks', label: 'Онцлог', keywords: ['сорви', 'мэнгэ', 'толбо'] },
];

function extractPhrase(text: string, keywords: string[]): string {
  for (const part of text.split(/[,;.]/)) {
    const lowered = part.toLocaleLowerCase('mn-MN');
    if (keywords.some((keyword) => lowered.includes(keyword))) return part.trim();
  }
  return text.trim();
}

/** Coarse event typing from words literally present in the sentence. */
function guessEventType(sentence: string): string {
  const lowered = sentence.toLocaleLowerCase('mn-MN');
  const rules: Array<[string[], string]> = [
    [['төрсөн', 'мэндэлсэн', 'born'], 'birth'],
    [['гэрлэсэн', 'хурим', 'married', 'wedding'], 'marriage'],
    [['нас барсан', 'таалал', 'died'], 'death'],
    [['төгссөн', 'сургууль', 'graduated', 'school'], 'education'],
    [['ажил', 'ажиллаж', 'job', 'work'], 'job'],
    [['цэрэг', 'army', 'military'], 'military'],
    [['нүүсэн', 'нүүж', 'moved'], 'move'],
  ];
  for (const [keywords, type] of rules) {
    if (keywords.some((keyword) => lowered.includes(keyword))) return type;
  }
  return 'other';
}
