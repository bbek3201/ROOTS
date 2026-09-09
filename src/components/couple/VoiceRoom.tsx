'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadToCoupleSpace } from '@/lib/media/couple-upload';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/States';
import { MicIcon, PauseIcon, PlayIcon } from '@/components/icons';
import { formatDuration } from '@/lib/format';

export interface VoiceNote {
  id: string;
  title: string;
  description: string | null;
  recordedOn: string | null;
  url: string | null;
  durationSeconds: number | null;
}

type RecordState = 'idle' | 'recording' | 'recorded' | 'saving';

/**
 * Recording, and listening back.
 *
 * The same MediaRecorder approach the family interviews use, for the same
 * reason: a voice is the one thing in an archive that cannot be reconstructed
 * later from anything else. A photograph of someone can be found in a shoebox;
 * their voice cannot.
 *
 * The recording is uploaded before the title is required, so a person who hits
 * stop and closes the tab still has the audio. The title can be fixed; the
 * moment cannot be re-recorded.
 */
export function VoiceRoom({ spaceId, notes }: { spaceId: string; notes: VoiceNote[] }) {
  const router = useRouter();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [state, setState] = useState<RecordState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    audioRef.current?.pause();
    if (localUrl) URL.revokeObjectURL(localUrl);
  }, [localUrl]);

  const start = async () => {
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
        setState('recorded');
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      recorderRef.current = recorder;
      setState('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
    } catch {
      setError('Микрофон ашиглах зөвшөөрөл олдсонгүй. Хөтчийн тохиргооноос зөвшөөрнө үү.');
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const save = async () => {
    if (!blob) return;
    setState('saving');
    setError(null);
    try {
      const uploaded = await uploadToCoupleSpace({
        spaceId,
        file: blob,
        filename: `voice-${Date.now()}.webm`,
        durationSeconds: elapsed,
      });

      const response = await fetch(`/api/couple/${spaceId}/voice`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mediaId: uploaded.mediaId,
          title: title.trim() || 'Дуу хоолой',
        }),
      });
      if (!response.ok) throw new Error('Хадгалахад алдаа гарлаа.');

      setBlob(null);
      setLocalUrl(null);
      setTitle('');
      setElapsed(0);
      setState('idle');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Хадгалахад алдаа гарлаа.');
      setState('recorded');
    }
  };

  const toggle = (id: string, url: string | null) => {
    if (!url) return;
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(url);
    audio.addEventListener('ended', () => setPlayingId(null));
    audioRef.current = audio;
    void audio.play().then(() => setPlayingId(id)).catch(() => setPlayingId(null));
  };

  return (
    <div className="space-y-5">
      <Card className="px-5 py-9 text-center">
        {state === 'recorded' || state === 'saving' ? (
          <>
            <p className="text-sm text-muted">{formatDuration(elapsed)} бичигдлээ</p>
            {localUrl ? (
              /* A family's own voice note; a caption track is neither available nor meaningful here. */
              <audio src={localUrl} controls className="mx-auto mt-3 w-full" />
            ) : null}
            <div className="mt-4">
              <TextField
                label="Гарчиг"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Бид анх энэ газар ирэхдээ…"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="ghost"
                fullWidth
                onClick={() => { setBlob(null); setLocalUrl(null); setState('idle'); }}
                disabled={state === 'saving'}
              >
                Дахин бичих
              </Button>
              <Button fullWidth onClick={() => void save()} loading={state === 'saving'}>
                Хадгалах
              </Button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => (state === 'recording' ? stop() : void start())}
              aria-label={state === 'recording' ? 'Зогсоох' : 'Бичиж эхлэх'}
              className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full transition-transform duration-200 active:scale-95 ${
                state === 'recording'
                  ? 'recording-pulse bg-heart text-white'
                  : 'bg-forest text-forest-ink shadow-(--shadow-green)'
              }`}
            >
              {state === 'recording' ? <span className="h-7 w-7 rounded-sm bg-white" /> : <MicIcon size={30} />}
            </button>
            <p
              className={
                state === 'recording'
                  ? 'ed-display mt-5 text-3xl tabular-nums'
                  : 'mt-5 text-sm text-muted'
              }
            >
              {state === 'recording' ? formatDuration(elapsed) : 'Дуу хоолойгоороо дурсамж үлдээх'}
            </p>
          </>
        )}

        {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
      </Card>

      {notes.length === 0 ? (
        <EmptyState
          title="Хоолойгоо үлдээгээрэй"
          description="Хэдэн жилийн дараа сонсоход зураг хийж чадахгүй зүйлийг дуу хоолой хийнэ."
        />
      ) : (
        <ul className="border-t border-line">
          {notes.map((note) => (
            <li key={note.id} className="flex items-center gap-4 border-b border-line py-4">
              <button
                type="button"
                onClick={() => toggle(note.id, note.url)}
                disabled={!note.url}
                aria-label={playingId === note.id ? 'Зогсоох' : 'Сонсох'}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest text-forest-ink disabled:opacity-40"
              >
                {playingId === note.id ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
              </button>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[1.05rem] leading-snug text-ink">{note.title}</span>
                <span className="mt-1 block text-xs tracking-[0.08em] text-muted uppercase">
                  {[
                    note.recordedOn,
                    note.durationSeconds ? formatDuration(note.durationSeconds) : null,
                  ].filter(Boolean).join(' · ')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The first container the browser will actually record. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}
