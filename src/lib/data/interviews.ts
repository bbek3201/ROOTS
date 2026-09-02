import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type {
  InterviewQuestionRow,
  InterviewQuestionSetRow,
  InterviewQuestionTemplateRow,
  InterviewRow,
  InterviewTranscriptRow,
  MediaRow,
  PersonRow,
} from '@/types/database';

export interface InterviewSummary extends InterviewRow {
  subject: Pick<PersonRow, 'id' | 'first_name' | 'last_name' | 'nickname' | 'birth_date' | 'death_date'> | null;
  answered: number;
  total: number;
}

export async function listInterviews(familyId: string): Promise<InterviewSummary[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('interviews')
    .select('*, subject:people!interviews_subject_person_id_fkey(id, first_name, last_name, nickname, birth_date, death_date)')
    .eq('family_id', familyId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  const interviews = (data ?? []) as unknown as Array<InterviewRow & { subject: InterviewSummary['subject'] }>;
  if (interviews.length === 0) return [];

  const { data: questions } = await supabase
    .from('interview_questions')
    .select('interview_id, answered_at, skipped')
    .in('interview_id', interviews.map((interview) => interview.id));

  const counts = new Map<string, { answered: number; total: number }>();
  for (const question of questions ?? []) {
    const entry = counts.get(question.interview_id) ?? { answered: 0, total: 0 };
    entry.total += 1;
    if (question.answered_at || question.skipped) entry.answered += 1;
    counts.set(question.interview_id, entry);
  }

  return interviews.map((interview) => ({
    ...interview,
    answered: counts.get(interview.id)?.answered ?? 0,
    total: counts.get(interview.id)?.total ?? 0,
  }));
}

export interface InterviewDetail {
  interview: InterviewRow;
  subject: PersonRow | null;
  questions: Array<
    InterviewQuestionRow & {
      transcript: InterviewTranscriptRow | null;
      audio: MediaRow | null;
    }
  >;
}

export async function getInterview(interviewId: string): Promise<InterviewDetail | null> {
  const supabase = await createClient();

  const { data: interview } = await supabase
    .from('interviews')
    .select('*')
    .eq('id', interviewId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!interview) return null;

  const [subject, questions, transcripts] = await Promise.all([
    supabase.from('people').select('*').eq('id', interview.subject_person_id).maybeSingle(),
    supabase.from('interview_questions').select('*').eq('interview_id', interviewId)
      .order('order_index', { ascending: true }),
    supabase.from('interview_transcripts').select('*').eq('interview_id', interviewId),
  ]);

  const audioIds = (questions.data ?? [])
    .map((question) => question.audio_media_id)
    .filter((id): id is string => typeof id === 'string');

  const { data: audio } = audioIds.length > 0
    ? await supabase.from('media').select('*').in('id', audioIds).is('deleted_at', null)
    : { data: [] as MediaRow[] };

  const transcriptByQuestion = new Map<string, InterviewTranscriptRow>();
  for (const transcript of transcripts.data ?? []) {
    if (transcript.question_id) transcriptByQuestion.set(transcript.question_id, transcript);
  }

  const audioById = new Map((audio ?? []).map((media) => [media.id, media]));

  return {
    interview,
    subject: subject.data ?? null,
    questions: (questions.data ?? []).map((question) => ({
      ...question,
      transcript: transcriptByQuestion.get(question.id) ?? null,
      audio: question.audio_media_id ? audioById.get(question.audio_media_id) ?? null : null,
    })),
  };
}

export interface QuestionSetWithTemplates extends InterviewQuestionSetRow {
  templates: InterviewQuestionTemplateRow[];
}

/** The built-in question sets, plus anything this family has added. */
export async function getQuestionSets(familyId: string, locale: string): Promise<QuestionSetWithTemplates[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('interview_question_sets')
    .select('*, templates:interview_question_templates(*)')
    .or(`family_id.is.null,family_id.eq.${familyId}`)
    .eq('locale', locale)
    .order('is_builtin', { ascending: false });

  const sets = (data ?? []) as unknown as QuestionSetWithTemplates[];
  return sets.map((set) => ({
    ...set,
    templates: [...(set.templates ?? [])].sort((a, b) => a.order_index - b.order_index),
  }));
}
