'use client';

import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { PauseIcon, PlayIcon } from '@/components/icons';
import { formatBytes, formatDuration } from '@/lib/format';

interface Item {
  id: string;
  kind: string;
  url: string | null;
  caption: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  isOriginal: boolean;
}

/**
 * Non-photo attachments: audio, video and documents.
 *
 * Audio plays inline because a voice recording should be one tap away. Video
 * and documents open in a new tab — the signed URL is short-lived and the
 * browser's own viewer handles them better than anything embedded here would.
 */
export function MediaAttachments({ items }: { items: Item[] }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleAudio = (item: Item) => {
    if (!item.url) return;
    if (playingId === item.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(item.url);
    audio.addEventListener('ended', () => setPlayingId(null));
    audioRef.current = audio;
    void audio.play().then(() => setPlayingId(item.id)).catch(() => setPlayingId(null));
  };

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="card flex items-center gap-3 p-3.5">
          {item.kind === 'audio' ? (
            <button
              type="button"
              onClick={() => toggleAudio(item)}
              disabled={!item.url}
              aria-label={playingId === item.id ? 'Зогсоох' : 'Сонсох'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ember text-white disabled:opacity-40"
            >
              {playingId === item.id ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
            </button>
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-parchment-deep text-xs font-medium text-ink-soft">
              {item.kind === 'video' ? 'MP4' : 'DOC'}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{item.caption || kindLabel(item.kind)}</p>
            <p className="text-xs text-muted">
              {[
                item.durationSeconds ? formatDuration(item.durationSeconds) : null,
                formatBytes(item.sizeBytes),
              ].filter(Boolean).join(' · ')}
            </p>
          </div>

          {item.isOriginal ? <Badge tone="sage">Эх хувь</Badge> : null}

          {item.kind !== 'audio' && item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-pill border border-line px-3 py-1.5 text-xs font-medium text-ink-soft"
            >
              Нээх
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function kindLabel(kind: string): string {
  const labels: Record<string, string> = { audio: 'Дуу хоолой', video: 'Видео', document: 'Баримт' };
  return labels[kind] ?? 'Файл';
}
