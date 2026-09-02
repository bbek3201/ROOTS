/**
 * The AI provider contract.
 *
 * Two rules shape this entire interface:
 *
 * 1. AI NEVER INVENTS FAMILY FACTS. Every method receives explicit, quoted
 *    source material and may only summarise, structure or reorganise it. There
 *    is no method that asks a model what it "knows" about a person, because a
 *    model does not know anything about your grandmother, and a plausible
 *    invention in a family archive is worse than a blank.
 *
 * 2. EVERY RESULT DECLARES ITS PROVENANCE. `provider`, `model`, `isMock` and
 *    `groundedOn` travel with the output all the way to the screen, so the UI
 *    can always show where a sentence came from — and can visibly mark a
 *    development mock instead of pretending AI is running.
 */

export type AIProviderName = 'mock' | 'anthropic';

export interface AIProvenance {
  provider: AIProviderName;
  model: string | null;
  /** True when this came from the development mock, not a real model. */
  isMock: boolean;
  /** Ids of the family rows the output was derived from. */
  groundedOn: GroundingRef[];
  latencyMs: number;
}

export interface GroundingRef {
  type: 'person' | 'couple' | 'memory' | 'interview' | 'transcript' | 'life_event' | 'media' | 'appearance';
  id: string;
  label?: string;
}

/** Every AI result is either usable, or explicitly unavailable — never faked. */
export type AIResult<T> =
  | ({ ok: true } & T & { provenance: AIProvenance })
  | { ok: false; unavailable: true; reason: string; provenance: AIProvenance };

// ---------------------------------------------------------------------------
// Task inputs and outputs
// ---------------------------------------------------------------------------

export interface TranscribeInput {
  audio: { data: ArrayBuffer; mimeType: string };
  language?: string;
  /** Names likely to appear, so a provider that supports hints spells them right. */
  nameHints?: string[];
}

export interface TranscribeOutput {
  text: string;
  language: string;
  confidence: number | null;
  segments?: Array<{ start: number; end: number; text: string }>;
}

export interface SummarizeInput {
  /** The exact text to summarise. Nothing outside this may appear in the output. */
  text: string;
  /** What the summary is for, e.g. "an interview with a grandmother". */
  context?: string;
  language?: string;
  maxSentences?: number;
  grounding?: GroundingRef[];
}

export interface SummarizeOutput {
  summary: string;
  /** Short bullet points a family would want to keep. */
  keyPoints: string[];
}

export interface ExtractTimelineInput {
  text: string;
  language?: string;
  /** Used only to resolve relative dates like "two years later". */
  knownDates?: Array<{ label: string; date: string }>;
  grounding?: GroundingRef[];
}

export interface ExtractedEvent {
  title: string;
  /** ISO date, or a year when that is all the text supports. */
  date: string | null;
  datePrecision: 'exact' | 'month' | 'year' | 'decade' | 'about' | 'unknown';
  eventType: string;
  description: string | null;
  /** The exact sentence this came from, so a human can verify it in one glance. */
  evidence: string;
}

export interface ExtractTimelineOutput {
  events: ExtractedEvent[];
}

export interface AnalyzePhotoInput {
  image: { data: ArrayBuffer; mimeType: string };
  /** People already known to be in the photo, to help describe the scene. */
  knownPeople?: string[];
  language?: string;
}

export interface AnalyzePhotoOutput {
  /** A neutral description of what is visibly in the frame. */
  description: string;
  /** Era or setting cues the model can see — never asserted as dates. */
  observations: string[];
  estimatedPeopleCount: number | null;
}

export interface OcrInput {
  document: { data: ArrayBuffer; mimeType: string };
  language?: string;
}

export interface OcrOutput {
  text: string;
  language: string | null;
}

export interface FamilyQuestionInput {
  question: string;
  language?: string;
  /**
   * Facts already resolved from the database. The model may use ONLY these.
   * If they do not answer the question, the correct output is "unknown".
   */
  facts: string[];
  grounding?: GroundingRef[];
}

export interface FamilyQuestionOutput {
  answer: string;
  /** False when the stored data does not contain the answer. */
  answered: boolean;
}

export interface FamilyStoryInput {
  /** Structured, verified facts — one line each — in chronological order. */
  facts: string[];
  /** Personal recollections, kept separate so the story can distinguish them. */
  memories: Array<{ text: string; contributor: string; date?: string | null }>;
  familyName: string;
  language?: string;
  grounding?: GroundingRef[];
}

export interface FamilyStoryOutput {
  story: string;
  /** Sentences drawn from memories rather than records, for visible marking. */
  memoryDerivedSections: string[];
}

export interface AppearanceInput {
  /** Raw descriptions from relatives, each attributed. */
  descriptions: Array<{ text: string; contributor: string }>;
  personName: string;
  language?: string;
  grounding?: GroundingRef[];
}

export interface AppearanceOutput {
  /** One readable paragraph combining what relatives said. */
  description: string;
  /** Structured facets: height, face, hair, eyes, build, distinguishing marks. */
  attributes: Record<string, string>;
  /**
   * Written to be read ALOUD to a visually impaired family member, so they can
   * build a mental image of an ancestor they will never see a photograph of.
   */
  narration: string;
  /** Points where relatives disagreed. Preserved, never resolved by the model. */
  conflicts: string[];
}

// ---------------------------------------------------------------------------
// The service
// ---------------------------------------------------------------------------

export interface AIService {
  readonly name: AIProviderName;
  readonly model: string | null;
  readonly isMock: boolean;

  transcribe(input: TranscribeInput): Promise<AIResult<TranscribeOutput>>;
  summarize(input: SummarizeInput): Promise<AIResult<SummarizeOutput>>;
  extractTimeline(input: ExtractTimelineInput): Promise<AIResult<ExtractTimelineOutput>>;
  analyzePhoto(input: AnalyzePhotoInput): Promise<AIResult<AnalyzePhotoOutput>>;
  ocr(input: OcrInput): Promise<AIResult<OcrOutput>>;
  answerFamilyQuestion(input: FamilyQuestionInput): Promise<AIResult<FamilyQuestionOutput>>;
  generateFamilyStory(input: FamilyStoryInput): Promise<AIResult<FamilyStoryOutput>>;
  organizeAppearance(input: AppearanceInput): Promise<AIResult<AppearanceOutput>>;
}
