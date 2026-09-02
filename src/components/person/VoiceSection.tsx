'use client';

import { useEffect, useRef, useState } from 'react';
import { SectionHeading } from '@/components/ui/Card';
import { PauseIcon, PlayIcon, SpeakerIcon } from '@/components/icons';
import { formatDuration, relativeTime } from '@/lib/format';

interface Recording {
  id: string;
  url: string | null;
  caption: string | null;
  createdAt: string;
  durationSeconds: number | null;
}

/**
 * Preserved voice.
 *
 * A recording of a grandparent is often the single most valuable thing in a
 * family archive — more than a photograph, because it carries how they spoke.
 * These are always the ORIGINAL files: ROOTS stores them untouched, never
 * re-encodes over them, and never clones a voice from them.
 */
export function VoiceSection({
  recordings,
  personName,
}: {
  recordings: Recording[];
  personName: string;
}) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  if (recordings.length === 0) return null;

  const toggle = (recording: Recording) => {
    if (!recording.url) return;

    if (playingId === recording.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    audioRef.current?.pause();
    const audio = new Audio(recording.url);
    audio.addEventListener('ended', () => setPlayingId(null));
    audio.addEventListener('error', () => setPlayingId(null));
    audioRef.current = audio;
    void audio.play().then(() => setPlayingId(recording.id)).catch(() => setPlayingId(null));
  };

  return (
    <section className="mb-6">
      <SectionHeading
        title="Дуу хоолой"
        subtitle={`${personName}-ийн эх бичлэгүүд — өөрчлөгдөөгүй хадгалагдсан`}
      />
      <ul className="space-y-2.5">
        {recordings.map((recording) => (
          <li key={recording.id} className="card flex items-center gap-3 p-3.5">
            <button
              type="button"
              onClick={() => toggle(recording)}
              disabled={!recording.url}
              aria-label={playingId === recording.id ? 'Зогсоох' : 'Сонсох'}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ember text-white disabled:opacity-40"
            >
              {playingId === recording.id ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {recording.caption || 'Дуу хоолойн бичлэг'}
              </p>
              <p className="text-xs text-muted">
                {relativeTime(recording.createdAt)}
                {recording.durationSeconds ? ` · ${formatDuration(recording.durationSeconds)}` : ''}
              </p>
            </div>

            <SpeakerIcon size={18} className="shrink-0 text-gold" />
          </li>
        ))}
      </ul>
    </section>
  );
}
