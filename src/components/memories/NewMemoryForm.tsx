'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadToArchive } from '@/lib/media/upload-client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { MemoryType } from '@/types/database';

/**
 * Add a memory.
 *
 * Upload first, describe second. The product principle is that people should be
 * pouring things IN — a scan, a recording, a photo of a letter — not filling in
 * a form, so the file picker is the top of the screen and everything below it
 * is optional except the title.
 *
 * The memory row is created BEFORE the uploads so each file can be attached to
 * it directly; if an upload then fails, the memory still exists with whatever
 * did succeed rather than everything being lost.
 */

const TYPES: Array<{ value: MemoryType; label: string }> = [
  { value: 'story', label: 'Түүх' },
  { value: 'photo', label: 'Зураг' },
  { value: 'audio', label: 'Дуу хоолой' },
  { value: 'video', label: 'Видео' },
  { value: 'letter', label: 'Захидал' },
  { value: 'document', label: 'Баримт' },
  { value: 'recipe', label: 'Хоолны жор' },
  { value: 'tradition', label: 'Уламжлал' },
  { value: 'event', label: 'Үйл явдал' },
];

export function NewMemoryForm({
  familyId,
  people,
  presetPersonId,
  presetCoupleId,
  presetType,
}: {
  familyId: string;
  people: Array<{ id: string; name: string; years: string }>;
  presetPersonId: string | null;
  presetCoupleId: string | null;
  presetType: string | null;
}) {
  const router = useRouter();

  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<MemoryType>(
    (TYPES.find((entry) => entry.value === presetType)?.value ?? 'story') as MemoryType,
  );
  const [dateValue, setDateValue] = useState('');
  const [taggedIds, setTaggedIds] = useState<string[]>(presetPersonId ? [presetPersonId] : []);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Files usually tell us what kind of memory this is; don't make people say it.
  useEffect(() => {
    const first = files[0];
    if (!first || presetType) return;
    if (first.type.startsWith('image/')) setType('photo');
    else if (first.type.startsWith('audio/')) setType('audio');
    else if (first.type.startsWith('video/')) setType('video');
    else if (first.type === 'application/pdf') setType('document');
  }, [files, presetType]);

  const toggleTag = (personId: string) => {
    setTaggedIds((current) =>
      current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId],
    );
  };

  const submit = async () => {
    if (title.trim().length === 0) return;
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: profile } = await supabase.auth.getUser();
      const userId = profile.user?.id;
      if (!userId) throw new Error('auth');

      const { data: profileRow } = await supabase
        .from('profiles').select('display_name').eq('id', userId).maybeSingle();

      setProgress('Дурсамжийг үүсгэж байна…');

      const { data: memory, error: memoryError } = await supabase
        .from('memories')
        .insert({
          family_id: familyId,
          type,
          title: title.trim(),
          body: body.trim() || null,
          memory_date: normaliseDate(dateValue),
          date_precision: datePrecision(dateValue),
          couple_id: presetCoupleId,
          contributor_id: userId,
          contributor_name: profileRow?.display_name ?? 'Гэр бүлийн гишүүн',
        })
        .select('id')
        .single();

      if (memoryError || !memory) throw new Error(memoryError?.message ?? 'memory');

      if (taggedIds.length > 0) {
        await supabase.from('memory_people').insert(
          taggedIds.map((personId) => ({
            family_id: familyId,
            memory_id: memory.id,
            person_id: personId,
            role: 'subject',
            created_by: userId,
          })),
        );
      }

      for (const [position, file] of files.entries()) {
        setProgress(`Файл байршуулж байна (${position + 1}/${files.length})…`);
        await uploadToArchive({
          file,
          filename: file.name,
          scope: 'memories',
          scopeId: memory.id,
          memoryId: memory.id,
        });
      }

      router.push(`/memories/${memory.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message.includes('permission')
          ? 'Танд дурсамж нэмэх эрх байхгүй байна.'
          : 'Хадгалахад алдаа гарлаа. Оруулсан зүйл тань хадгалагдаагүй байж магадгүй.',
      );
      setSaving(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-dashed">
        <label className="flex cursor-pointer flex-col items-center gap-2 py-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ember-wash text-2xl text-ember">
            ＋
          </span>
          <span className="font-display text-base text-ink">Зураг, бичлэг, баримт оруулах</span>
          <span className="max-w-xs text-sm leading-relaxed text-muted">
            Хуучин зургаа гар утсаараа зурагдаад оруулж болно. Эх файл өөрчлөгдөхгүйгээр үүрд хадгалагдана.
          </span>
          <input
            type="file"
            multiple
            accept="image/*,video/*,audio/*,application/pdf"
            className="sr-only-text"
            onChange={(event) => setFiles([...(event.target.files ?? [])])}
          />
        </label>

        {files.length > 0 ? (
          <ul className="mt-2 space-y-1.5 border-t border-line pt-3">
            {files.map((file, position) => (
              <li key={`${file.name}-${position}`} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink">{file.name}</span>
                <span className="shrink-0 text-xs text-muted">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  onClick={() => setFiles((current) => current.filter((_, i) => i !== position))}
                  className="shrink-0 text-xs text-danger"
                >
                  Хасах
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card className="space-y-3.5">
        <TextField
          label="Гарчиг"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Жишээ: 1978 оны зун, Хөвсгөлд"
          required
          maxLength={200}
        />

        <TextAreaField
          label="Дурсамж"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Санаж байгаагаараа бичээрэй. Хэн байсан, юу болсон, юу мэдэрсэн…"
          className="min-h-36"
        />

        <SelectField label="Төрөл" value={type} onChange={(event) => setType(event.target.value as MemoryType)}>
          {TYPES.map((entry) => (
            <option key={entry.value} value={entry.value}>{entry.label}</option>
          ))}
        </SelectField>

        <TextField
          label="Он, огноо"
          value={dateValue}
          onChange={(event) => setDateValue(event.target.value)}
          placeholder="1978 эсвэл 1978-07-15"
          hint="Зөвхөн он мэдэж байвал ондоо бичээрэй. Тодорхойгүй бол хоосон орхиж болно."
        />
      </Card>

      {people.length > 0 ? (
        <Card>
          <p className="mb-2.5 text-sm font-medium text-ink-soft">Хэн холбогдох вэ?</p>
          <p className="mb-3 text-xs leading-relaxed text-muted">
            Тэмдэглэсэн хүн бүрийн профайл дээр энэ дурсамж автоматаар харагдана.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {people.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => toggleTag(person.id)}
                aria-pressed={taggedIds.includes(person.id)}
                className={cn(
                  'rounded-pill border px-3 py-1.5 text-sm transition-colors',
                  taggedIds.includes(person.id)
                    ? 'border-ember bg-ember text-white'
                    : 'border-line bg-surface text-ink-soft',
                )}
              >
                {person.name}
                {person.years ? <span className="ml-1 opacity-60">{person.years}</span> : null}
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">{error}</p>
      ) : null}

      {progress ? (
        <p role="status" className="rounded-xl bg-sage-wash px-3 py-2.5 text-sm text-sage">{progress}</p>
      ) : null}

      <Button size="lg" fullWidth onClick={submit} loading={saving} disabled={title.trim().length === 0}>
        Архивт хадгалах
      </Button>
    </div>
  );
}

/** "1978" is a perfectly good date in a family archive. Accept it as one. */
function normaliseDate(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return null;
}

function datePrecision(value: string): 'exact' | 'month' | 'year' | 'unknown' {
  const trimmed = value.trim();
  if (/^\d{4}$/.test(trimmed)) return 'year';
  if (/^\d{4}-\d{2}$/.test(trimmed)) return 'month';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return 'exact';
  return 'unknown';
}
