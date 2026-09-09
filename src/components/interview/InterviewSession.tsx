'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadToArchive } from '@/lib/media/upload-client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { MicIcon, PauseIcon, PlayIcon, SparkIcon } from '@/components/icons';
import { formatDuration } from '@/lib/format';

/**
 * The interview session.
 *
 * The flow the product asks for: record → speech-to-text → transcript → confirm.
 * The order of operations matters and is deliberate:
 *
 *   1. The recording is UPLOADED AND SAVED FIRST, before any transcription is
 *      attempted. If the network dies, or the AI is not configured, or the
 *      transcript comes back nonsense, the voice is already safe.
 *   2. Transcription is offered second, and is always optional.
 *   3. The transcript is editable, because a machine will mis-hear a Mongolian
 *      name and a grandchild will know what was actually said.
 *
 * Nothing here is required to finish. An interview can be paused mid-question
 * and resumed months later by a different relative.
 */

interface Question {
  id: string;
  orderIndex: number;
  text: string;
  answeredAt: string | null;
  skipped: boolean;
  audioMediaId: string | null;
  audioUrl: string | null;
  transcript: { id: string; text: string; isMock: boolean; isEdited: boolean } | null;
}

type RecordState = 'idle' | 'recording' | 'recorded' | 'uploading';

export function InterviewSession({
  interviewId,
  status,
  subjectPersonId,
  subjectName,
  aiConfigured,
  questions,
}: {
  interviewId: string;
  status: string;
  subjectPersonId: string;
  subjectName: string;
  aiConfigured: boolean;
  questions: Question[];
}) {
  const router = useRouter();

  const firstUnanswered = questions.findIndex((question) => !question.answeredAt && !question.skipped);
  const [position, setPosition] = useState(firstUnanswered === -1 ? 0 : firstUnanswered);
  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [draftTranscript, setDraftTranscript] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const question = questions[position];

  const resetForQuestion = useCallback(() => {
    setRecordState('idle');
    setElapsed(0);
    setBlob(null);
    setLocalUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setNotice(null);
    setError(null);
    setPlaying(false);
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  useEffect(() => {
    setDraftTranscript(question?.transcript?.text ?? '');
    resetForQuestion();
  }, [position, question?.transcript?.text, resetForQuestion]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      audioRef.current?.pause();
    };
  }, []);

  if (!question) {
    return (
      <Card className="text-center">
        <p className="font-display text-lg text-ink">Асуулт алга байна</p>
        <p className="mt-1.5 text-sm text-muted">
          Энэ ярилцлагад асуултын багц холбогдоогүй байна.
        </p>
      </Card>
    );
  }

  const answeredCount = questions.filter((q) => q.answeredAt || q.skipped).length;

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        setBlob(recorded);
        setLocalUrl(URL.createObjectURL(recorded));
        setRecordState('recorded');
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecordState('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
    } catch {
      setError(
        'Микрофон ашиглах зөвшөөрөл олдсонгүй. Хөтчийн тохиргооноос микрофоныг зөвшөөрнө үү.',
      );
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const togglePlayback = () => {
    const url = localUrl ?? question.audioUrl;
    if (!url) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    const audio = new Audio(url);
    audio.addEventListener('ended', () => setPlaying(false));
    audioRef.current = audio;
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  const saveAnswer = async () => {
    if (!blob) return;
    setBusy(true);
    setRecordState('uploading');
    setError(null);
    setNotice('Бичлэгийг архивт хадгалж байна…');

    try {
      // Step 1 — the voice is saved. Everything after this is a bonus.
      const uploaded = await uploadToArchive({
        file: blob,
        filename: `${question.id}.webm`,
        scope: 'interviews',
        scopeId: interviewId,
        interviewId,
        speakerPersonId: subjectPersonId,
        durationSeconds: elapsed,
        caption: question.text,
      });

      await fetch(`/api/interviews/${interviewId}/questions/${question.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audioMediaId: uploaded.mediaId, answered: true }),
      });

      setNotice('Дуу хоолой хадгалагдлаа.');

      // Step 2 — optional transcription.
      if (aiConfigured) {
        setNotice('Бичвэрт хөрвүүлж байна…');
        const response = await fetch('/api/ai/transcribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            mediaId: uploaded.mediaId,
            interviewId,
            questionId: question.id,
          }),
        });
        const result = await response.json().catch(() => null);
        if (result?.unavailable) {
          setNotice(`${result.reason}`);
        } else if (result?.text) {
          setDraftTranscript(result.text);
          setNotice('Бичвэр бэлэн боллоо. Уншаад засвал илүү зөв болно.');
        }
      } else {
        setNotice('Дуу хоолой хадгалагдлаа. Хүсвэл ярьсан үгийг доор бичиж болно.');
      }

      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Хадгалахад алдаа гарлаа.');
      setRecordState('recorded');
      setBusy(false);
      return;
    }

    setBusy(false);
    setRecordState('recorded');
  };

  const saveTranscript = async () => {
    setBusy(true);
    await fetch(`/api/interviews/${interviewId}/questions/${question.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        transcriptText: draftTranscript,
        transcriptId: question.transcript?.id,
        audioMediaId: question.audioMediaId,
        answered: draftTranscript.trim().length > 0,
      }),
    });
    setBusy(false);
    setNotice('Бичвэр хадгалагдлаа.');
    router.refresh();
  };

  const skip = async () => {
    setBusy(true);
    await fetch(`/api/interviews/${interviewId}/questions/${question.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ skipped: true }),
    });
    setBusy(false);
    goNext();
    router.refresh();
  };

  const goNext = () => setPosition((value) => Math.min(value + 1, questions.length - 1));
  const goPrevious = () => setPosition((value) => Math.max(value - 1, 0));

  const finish = async () => {
    setBusy(true);
    await fetch(`/api/interviews/${interviewId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    setBusy(false);
    router.push('/interview');
    router.refresh();
  };

  const hasAudio = Boolean(localUrl ?? question.audioUrl);

  return (
    <div className="space-y-4">
      {/* progress */}
      <div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-parchment-deep"
          role="progressbar"
          aria-valuenow={answeredCount}
          aria-valuemin={0}
          aria-valuemax={questions.length}
        >
          <div
            className="h-full rounded-full bg-forest transition-[width] duration-300"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted">
          {position + 1} / {questions.length} асуулт · {answeredCount} хариулсан
        </p>
      </div>

      {/* the question */}
      <Card className="border-olive/30 bg-olive-wash">
        <p className="text-xs font-medium uppercase tracking-wide text-olive">
          {subjectName}-д зориулсан асуулт
        </p>
        <p className="mt-2 font-display text-xl leading-snug text-ink">{question.text}</p>
        {question.answeredAt ? (
          <p className="mt-2"><Badge tone="sage">Хариулсан</Badge></p>
        ) : null}
      </Card>

      {/* recorder */}
      <Card className="flex flex-col items-center gap-4 py-6">
        {recordState === 'recording' ? (
          <>
            <button
              type="button"
              onClick={stopRecording}
              aria-label="Бичлэг зогсоох"
              className="recording-pulse flex h-24 w-24 items-center justify-center rounded-full bg-danger text-white"
            >
              <span className="h-7 w-7 rounded bg-white" />
            </button>
            <p className="font-display text-2xl text-ink" aria-live="polite">{formatDuration(elapsed)}</p>
            <p className="text-sm text-muted">Бичиж байна… дуусгахдаа дарна уу.</p>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={startRecording}
              disabled={busy}
              aria-label="Бичлэг эхлүүлэх"
              className="flex h-24 w-24 items-center justify-center rounded-full bg-forest text-forest-ink disabled:opacity-50"
            >
              <MicIcon size={36} />
            </button>
            <p className="max-w-xs text-center text-sm leading-relaxed text-muted">
              {hasAudio
                ? 'Дахин бичих бол дарна уу. Өмнөх бичлэг архивт үлдэнэ.'
                : 'Дарж эхлээд асуултаа уншиж өгөөрэй. Яаралгүй, чөлөөтэй ярина уу.'}
            </p>
          </>
        )}

        {hasAudio && recordState !== 'recording' ? (
          <div className="flex w-full items-center gap-3 rounded-2xl border border-line px-3 py-2.5">
            <button
              type="button"
              onClick={togglePlayback}
              aria-label={playing ? 'Зогсоох' : 'Сонсох'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-parchment-deep text-ink"
            >
              {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
            </button>
            <span className="min-w-0 flex-1 text-sm text-ink-soft">
              {localUrl && !question.audioMediaId ? 'Хадгалаагүй бичлэг' : 'Архивт хадгалагдсан бичлэг'}
            </span>
            {question.audioMediaId ? <Badge tone="sage">Эх хувь</Badge> : null}
          </div>
        ) : null}

        {blob && recordState === 'recorded' && !question.audioMediaId ? (
          <Button fullWidth size="lg" onClick={saveAnswer} loading={busy}>
            Архивт хадгалах
          </Button>
        ) : null}
      </Card>

      {notice ? (
        <p role="status" className="rounded-xl bg-sage-wash px-3 py-2.5 text-sm text-sage">{notice}</p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">{error}</p>
      ) : null}

      {/* transcript */}
      <Card>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink-soft">Ярьсан үг</p>
          <div className="flex gap-1.5">
            {question.transcript?.isMock ? <Badge tone="forest">Туршилтын AI</Badge> : null}
            {question.transcript?.isEdited ? <Badge tone="sage">Хүн засварласан</Badge> : null}
          </div>
        </div>

        <textarea
          value={draftTranscript}
          onChange={(event) => setDraftTranscript(event.target.value)}
          placeholder={
            aiConfigured
              ? 'Бичлэг хадгалсны дараа энд автоматаар гарч ирнэ. Буруу бичигдсэн нэрийг засаж болно.'
              : 'AI тохируулаагүй байна. Ярьсан үгийг өөрөө бичиж болно — эх бичлэг архивт хэвээр хадгалагдана.'
          }
          className="min-h-36 w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-3 text-[16px] leading-relaxed text-ink placeholder:text-muted/70 focus:border-forest focus:outline-none"
        />

        {!aiConfigured ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
            <SparkIcon size={14} className="mt-0.5 shrink-0" />
            AI үйлчилгээ тохируулагдаагүй тул яриаг автоматаар бичвэрт хөрвүүлэхгүй. Дуу хоолой нь
            хамгийн чухал хэсэг бөгөөд бүрэн хадгалагдана.
          </p>
        ) : null}

        {draftTranscript !== (question.transcript?.text ?? '') ? (
          <Button className="mt-3" onClick={saveTranscript} loading={busy}>
            Бичвэрийг хадгалах
          </Button>
        ) : null}
      </Card>

      {/* navigation */}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={goPrevious} disabled={position === 0}>
          Өмнөх
        </Button>
        <Button variant="ghost" onClick={skip} disabled={busy}>
          Алгасах
        </Button>
        <Button
          className="flex-1"
          onClick={position === questions.length - 1 ? finish : goNext}
          disabled={busy}
        >
          {position === questions.length - 1 ? 'Дуусгах' : 'Дараах'}
        </Button>
      </div>

      {status !== 'completed' && position === questions.length - 1 ? (
        <p className="text-center text-xs text-muted">
          Бүх асуултад хариулах шаардлагагүй. Хэдийд ч эргэж үргэлжлүүлж болно.
        </p>
      ) : null}
    </div>
  );
}

/** Pick a container the browser can actually record. Safari differs from Chrome. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}
