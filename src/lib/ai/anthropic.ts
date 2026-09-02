import 'server-only';

import {
  APPEARANCE_PROMPT,
  OCR_PROMPT,
  PHOTO_PROMPT,
  QUESTION_PROMPT,
  STORY_PROMPT,
  SUMMARIZE_PROMPT,
  TIMELINE_PROMPT,
} from './prompts';
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

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } };

/**
 * Anthropic-backed AI provider.
 *
 * Runs SERVER-SIDE ONLY — the `server-only` import above turns any accidental
 * client import into a build error rather than a leaked API key.
 *
 * Every method sends a strict grounding prompt (see prompts.ts) plus the exact
 * source material, and parses a JSON response. If the model returns anything
 * that is not the expected shape, the call reports itself unavailable rather
 * than passing half-understood content into a family's permanent record.
 */
export class AnthropicAIService implements AIService {
  readonly name = 'anthropic' as const;
  readonly isMock = false;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  private provenance(startedAt: number, grounding: GroundingRef[] = []): AIProvenance {
    return {
      provider: 'anthropic',
      model: this.model,
      isMock: false,
      groundedOn: grounding,
      latencyMs: Date.now() - startedAt,
    };
  }

  private async call<T>(
    system: string,
    content: ContentBlock[],
    maxTokens = 2048,
  ): Promise<{ ok: true; value: T } | { ok: false; reason: string }> {
    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxTokens,
          system,
          // Low temperature: this is archival work, not creative writing.
          temperature: 0.2,
          messages: [{ role: 'user', content }],
        }),
      });
    } catch (error) {
      return { ok: false, reason: `AI үйлчилгээтэй холбогдож чадсангүй: ${(error as Error).message}` };
    }

    if (!response.ok) {
      // The body may contain the prompt; never surface it to the client.
      console.error('[roots:ai] anthropic error', response.status, await response.text().catch(() => ''));
      return { ok: false, reason: `AI үйлчилгээ хариу өгсөнгүй (${response.status}).` };
    }

    const payload = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (payload.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('')
      .trim();

    const parsed = extractJson<T>(text);
    if (!parsed) {
      return { ok: false, reason: 'AI хариултыг уншиж чадсангүй.' };
    }
    return { ok: true, value: parsed };
  }

  /**
   * Speech-to-text needs an audio model, which this provider does not offer.
   * Saying so is the honest answer; the recording itself is already preserved.
   */
  async transcribe(_input: TranscribeInput): Promise<AIResult<TranscribeOutput>> {
    const startedAt = Date.now();
    return {
      ok: false,
      unavailable: true,
      reason:
        'Энэ AI үйлчилгээ дуу хоолой таних боломжгүй. Бичлэг архивт хадгалагдсан бөгөөд бичвэрийг гараар оруулж болно.',
      provenance: this.provenance(startedAt),
    };
  }

  async summarize(input: SummarizeInput): Promise<AIResult<SummarizeOutput>> {
    const startedAt = Date.now();
    const result = await this.call<SummarizeOutput>(SUMMARIZE_PROMPT, [
      {
        type: 'text',
        text: [
          input.context ? `Context: ${input.context}` : null,
          input.maxSentences ? `Maximum sentences: ${input.maxSentences}` : null,
          '--- SOURCE TEXT (the only material you may use) ---',
          input.text,
        ].filter(Boolean).join('\n'),
      },
    ]);

    if (!result.ok) {
      return { ok: false, unavailable: true, reason: result.reason, provenance: this.provenance(startedAt, input.grounding ?? []) };
    }
    return {
      ok: true,
      summary: String(result.value.summary ?? ''),
      keyPoints: Array.isArray(result.value.keyPoints) ? result.value.keyPoints.map(String) : [],
      provenance: this.provenance(startedAt, input.grounding ?? []),
    };
  }

  async extractTimeline(input: ExtractTimelineInput): Promise<AIResult<ExtractTimelineOutput>> {
    const startedAt = Date.now();
    const result = await this.call<ExtractTimelineOutput>(TIMELINE_PROMPT, [
      {
        type: 'text',
        text: [
          input.knownDates?.length
            ? `Known reference dates:\n${input.knownDates.map((d) => `- ${d.label}: ${d.date}`).join('\n')}`
            : null,
          '--- SOURCE TEXT (the only material you may use) ---',
          input.text,
        ].filter(Boolean).join('\n'),
      },
    ]);

    if (!result.ok) {
      return { ok: false, unavailable: true, reason: result.reason, provenance: this.provenance(startedAt, input.grounding ?? []) };
    }

    // Drop anything without evidence: an event nobody can verify must not enter
    // the timeline, however confident the model sounded.
    const events = (Array.isArray(result.value.events) ? result.value.events : []).filter(
      (event) => typeof event?.evidence === 'string' && event.evidence.trim().length > 0,
    );

    return { ok: true, events, provenance: this.provenance(startedAt, input.grounding ?? []) };
  }

  async analyzePhoto(input: AnalyzePhotoInput): Promise<AIResult<AnalyzePhotoOutput>> {
    const startedAt = Date.now();
    const result = await this.call<AnalyzePhotoOutput>(PHOTO_PROMPT, [
      { type: 'image', source: { type: 'base64', media_type: input.image.mimeType, data: toBase64(input.image.data) } },
      { type: 'text', text: 'Describe this family photograph.' },
    ]);

    if (!result.ok) {
      return { ok: false, unavailable: true, reason: result.reason, provenance: this.provenance(startedAt) };
    }
    return {
      ok: true,
      description: String(result.value.description ?? ''),
      observations: Array.isArray(result.value.observations) ? result.value.observations.map(String) : [],
      estimatedPeopleCount:
        typeof result.value.estimatedPeopleCount === 'number' ? result.value.estimatedPeopleCount : null,
      provenance: this.provenance(startedAt),
    };
  }

  async ocr(input: OcrInput): Promise<AIResult<OcrOutput>> {
    const startedAt = Date.now();
    const isPdf = input.document.mimeType === 'application/pdf';
    const block: ContentBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: toBase64(input.document.data) } }
      : { type: 'image', source: { type: 'base64', media_type: input.document.mimeType, data: toBase64(input.document.data) } };

    const result = await this.call<OcrOutput>(OCR_PROMPT, [block, { type: 'text', text: 'Transcribe this document.' }], 4096);

    if (!result.ok) {
      return { ok: false, unavailable: true, reason: result.reason, provenance: this.provenance(startedAt) };
    }
    return {
      ok: true,
      text: String(result.value.text ?? ''),
      language: result.value.language ?? null,
      provenance: this.provenance(startedAt),
    };
  }

  async answerFamilyQuestion(input: FamilyQuestionInput): Promise<AIResult<FamilyQuestionOutput>> {
    const startedAt = Date.now();

    // If the database found nothing, do not spend a model call on it. There is
    // nothing to phrase, and asking a model an unanswerable question is exactly
    // how invented family history gets in.
    if (input.facts.length === 0) {
      return {
        ok: true,
        answered: false,
        answer: 'Энэ талаар хадгалагдсан мэдээлэл алга байна.',
        provenance: this.provenance(startedAt, input.grounding ?? []),
      };
    }

    const result = await this.call<FamilyQuestionOutput>(QUESTION_PROMPT, [
      {
        type: 'text',
        text: [
          `QUESTION: ${input.question}`,
          '--- FACTS FROM THE FAMILY DATABASE (the only material you may use) ---',
          ...input.facts.map((fact) => `- ${fact}`),
        ].join('\n'),
      },
    ]);

    if (!result.ok) {
      return { ok: false, unavailable: true, reason: result.reason, provenance: this.provenance(startedAt, input.grounding ?? []) };
    }
    return {
      ok: true,
      answer: String(result.value.answer ?? ''),
      answered: result.value.answered !== false,
      provenance: this.provenance(startedAt, input.grounding ?? []),
    };
  }

  async generateFamilyStory(input: FamilyStoryInput): Promise<AIResult<FamilyStoryOutput>> {
    const startedAt = Date.now();
    const result = await this.call<FamilyStoryOutput>(STORY_PROMPT, [
      {
        type: 'text',
        text: [
          `FAMILY: ${input.familyName}`,
          '--- VERIFIED FACTS ---',
          ...input.facts.map((fact) => `- ${fact}`),
          '--- MEMORIES CONTRIBUTED BY FAMILY MEMBERS ---',
          ...input.memories.map((memory) => `- "${memory.text}" — ${memory.contributor}${memory.date ? ` (${memory.date})` : ''}`),
        ].join('\n'),
      },
    ], 4096);

    if (!result.ok) {
      return { ok: false, unavailable: true, reason: result.reason, provenance: this.provenance(startedAt, input.grounding ?? []) };
    }
    return {
      ok: true,
      story: String(result.value.story ?? ''),
      memoryDerivedSections: Array.isArray(result.value.memoryDerivedSections)
        ? result.value.memoryDerivedSections.map(String)
        : [],
      provenance: this.provenance(startedAt, input.grounding ?? []),
    };
  }

  async organizeAppearance(input: AppearanceInput): Promise<AIResult<AppearanceOutput>> {
    const startedAt = Date.now();
    const result = await this.call<AppearanceOutput>(APPEARANCE_PROMPT, [
      {
        type: 'text',
        text: [
          `PERSON: ${input.personName}`,
          '--- DESCRIPTIONS WRITTEN FROM MEMORY BY RELATIVES ---',
          ...input.descriptions.map((entry) => `- ${entry.contributor}: "${entry.text}"`),
        ].join('\n'),
      },
    ]);

    if (!result.ok) {
      return { ok: false, unavailable: true, reason: result.reason, provenance: this.provenance(startedAt, input.grounding ?? []) };
    }
    return {
      ok: true,
      description: String(result.value.description ?? ''),
      attributes: (result.value.attributes ?? {}) as Record<string, string>,
      narration: String(result.value.narration ?? ''),
      conflicts: Array.isArray(result.value.conflicts) ? result.value.conflicts.map(String) : [],
      provenance: this.provenance(startedAt, input.grounding ?? []),
    };
  }
}

function toBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64');
}

/** Models sometimes wrap JSON in prose or a fenced block; recover it safely. */
function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? text).trim();

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
}
