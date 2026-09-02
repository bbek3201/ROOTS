import { notFound } from 'next/navigation';
import { requireActiveFamily } from '@/lib/family-context';
import { getInterview } from '@/lib/data/interviews';
import { getSignedUrls } from '@/lib/media/storage';
import { aiStatus } from '@/lib/ai';
import { AppHeader } from '@/components/nav/AppHeader';
import { InterviewSession } from '@/components/interview/InterviewSession';
import { displayName, lifespan } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireActiveFamily();

  const detail = await getInterview(id);
  if (!detail) notFound();

  const audioPaths = detail.questions
    .map((question) => question.audio?.storage_path)
    .filter((path): path is string => typeof path === 'string');

  const audioUrls = await getSignedUrls(audioPaths);
  const ai = aiStatus();

  return (
    <>
      <AppHeader
        title={detail.subject ? displayName(detail.subject) : 'Ярилцлага'}
        subtitle={detail.subject ? lifespan(detail.subject) || detail.interview.title || undefined : undefined}
        backHref="/interview"
      />

      <main id="main" className="px-4 pb-8 pt-4">
        <InterviewSession
          interviewId={id}
          status={detail.interview.status}
          subjectPersonId={detail.interview.subject_person_id}
          subjectName={detail.subject ? displayName(detail.subject) : 'Энэ хүн'}
          aiConfigured={ai.configured}
          questions={detail.questions.map((question) => ({
            id: question.id,
            orderIndex: question.order_index,
            text: question.question_text,
            answeredAt: question.answered_at,
            skipped: question.skipped,
            audioMediaId: question.audio_media_id,
            audioUrl: question.audio?.storage_path
              ? audioUrls.get(question.audio.storage_path) ?? null
              : null,
            transcript: question.transcript
              ? {
                  id: question.transcript.id,
                  text: question.transcript.transcript_text,
                  isMock: question.transcript.is_mock,
                  isEdited: question.transcript.is_edited,
                }
              : null,
          }))}
        />
      </main>
    </>
  );
}
