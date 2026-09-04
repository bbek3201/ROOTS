'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadToCoupleSpace } from '@/lib/media/couple-upload';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { formatBytes } from '@/lib/format';

const MOODS = ['Аз жаргалтай', 'Дулаахан', 'Хөгжилтэй', 'Тайван', 'Санагдмаар', 'Онцгой'];

/**
 * Keep a moment.
 *
 * Files are uploaded FIRST and the memory is created with their ids, which is
 * the opposite of the family form and deliberate: a couple space has no partial
 * state worth leaving behind, and a memory with no photographs in it is not
 * what the person tapping "keep" meant to make.
 *
 * Uploads that fail are kept in the picker rather than discarding the ones that
 * worked, for the same reason they are in the family form: a phone on a rural
 * connection will drop one of eleven, and starting again is how the moment goes
 * unrecorded.
 */
export function NewCoupleMemoryForm({ spaceId }: { spaceId: string }) {
  const router = useRouter();

  const [files, setFiles] = useState<File[]>([]);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [place, setPlace] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (title.trim().length === 0) return;
    setSaving(true);
    setError(null);

    const mediaIds = [...uploaded];
    const failed: File[] = [];

    for (const [position, file] of files.entries()) {
      setProgress(`Файл байршуулж байна (${position + 1}/${files.length})…`);
      try {
        const result = await uploadToCoupleSpace({
          spaceId,
          file,
          filename: file.name,
          onRetry: () => setProgress(`${file.name} — сүлжээ саатлаа, дахин оролдож байна…`),
        });
        mediaIds.push(result.mediaId);
      } catch {
        failed.push(file);
      }
    }

    if (failed.length > 0) {
      // Remember what did land, so pressing the button again does not upload
      // the same photograph twice.
      setUploaded(mediaIds);
      setFiles(failed);
      setError(`${failed.length} файл байршсангүй. Дахин оролдоно уу.`);
      setSaving(false);
      setProgress(null);
      return;
    }

    setProgress('Хадгалж байна…');
    try {
      const response = await fetch(`/api/couple/${spaceId}/memories`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          memoryDate: date || null,
          placeLabel: place.trim() || undefined,
          mood: mood ?? undefined,
          mediaIds,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? 'Хадгалахад алдаа гарлаа.');
      router.push(`/us/memories/${body.id as string}`);
      router.refresh();
    } catch (caught) {
      setUploaded(mediaIds);
      setFiles([]);
      setError(caught instanceof Error ? caught.message : 'Хадгалахад алдаа гарлаа.');
      setSaving(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-dashed">
        <label className="flex cursor-pointer flex-col items-center gap-2 py-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-forest-wash text-2xl text-forest">
            ＋
          </span>
          <span className="font-display text-base text-ink">Зураг, видео нэмэх</span>
          <span className="max-w-xs text-sm leading-relaxed text-muted">
            Эдгээр файлыг зөвхөн та хоёр харна.
          </span>
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            className="sr-only-text"
            onChange={(event) => setFiles([...(event.target.files ?? [])])}
          />
        </label>

        {uploaded.length > 0 ? (
          <p className="border-t border-line pt-3 text-xs text-sage">
            {uploaded.length} файл аль хэдийн байршсан.
          </p>
        ) : null}

        {files.length > 0 ? (
          <ul className="mt-2 space-y-1.5 border-t border-line pt-3">
            {files.map((file, position) => (
              <li key={`${file.name}-${position}`} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink">{file.name}</span>
                <span className="shrink-0 text-xs text-muted">{formatBytes(file.size)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <TextField
          label="Гарчиг"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Анхны аялал — Токио"
          required
        />
        <TextField label="Огноо" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <TextField
          label="Газар"
          value={place}
          onChange={(event) => setPlace(event.target.value)}
          placeholder="Токио, Япон"
        />
        <TextAreaField
          label="Юу болсон бэ?"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={5}
        />
      </Card>

      <Card>
        <p className="mb-2.5 text-sm font-medium text-ink">Ямар мэдрэмж вэ?</p>
        <ul className="flex flex-wrap gap-1.5">
          {MOODS.map((option) => (
            <li key={option}>
              <button
                type="button"
                onClick={() => setMood(option === mood ? null : option)}
                aria-pressed={mood === option}
                className={`rounded-pill px-3 py-1.5 text-xs ${
                  mood === option ? 'bg-forest text-forest-ink' : 'border border-line text-ink-soft'
                }`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">{error}</p>
      ) : null}
      {progress ? (
        <p role="status" className="rounded-xl bg-sage-wash px-3 py-2.5 text-sm text-sage">{progress}</p>
      ) : null}

      <Button size="lg" fullWidth onClick={() => void submit()} loading={saving} disabled={title.trim().length === 0}>
        Хадгалах
      </Button>
    </div>
  );
}
