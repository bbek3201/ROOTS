'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadToArchive } from '@/lib/media/upload-client';
import { describeRpcError } from '@/lib/supabase/errors';
import { Button } from '@/components/ui/Button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Photo } from '@/components/ui/Photo';
import type { DatePrecision, GenderBucket, LifeStatus, PersonRow } from '@/types/database';

/**
 * Editing a person.
 *
 * The portrait comes first, and it is the reason this screen matters more than
 * a form usually does: the family tree is built out of faces, and every person
 * without a photograph is a monogram on a card. So the picker is the top of the
 * page, it uploads into the archive like any other photograph, and it sets the
 * person's portrait in the same breath.
 *
 * Dates carry a PRECISION alongside them because a family archive is mostly
 * approximate — "1961", "the forties", "around 1930" — and storing a guess as
 * an exact date is how an archive quietly becomes fiction. The precision select
 * sits next to each date rather than hidden behind an "advanced" toggle.
 */
const GENDERS: Array<{ value: GenderBucket; label: string }> = [
  { value: 'female', label: 'Эмэгтэй' },
  { value: 'male', label: 'Эрэгтэй' },
  { value: 'other', label: 'Бусад' },
  { value: 'unknown', label: 'Тодорхойгүй' },
];

const STATUSES: Array<{ value: LifeStatus; label: string }> = [
  { value: 'living', label: 'Амьд' },
  { value: 'deceased', label: 'Таалал төгссөн' },
  { value: 'unknown', label: 'Тодорхойгүй' },
];

const PRECISIONS: Array<{ value: DatePrecision; label: string }> = [
  { value: 'exact', label: 'Тодорхой өдөр' },
  { value: 'month', label: 'Сар' },
  { value: 'year', label: 'Он' },
  { value: 'about', label: 'Ойролцоогоор' },
  { value: 'decade', label: 'Аравтын он' },
  { value: 'unknown', label: 'Тодорхойгүй' },
];

export function PersonEditor({
  person,
  portraitUrl,
}: {
  person: PersonRow;
  portraitUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    first_name: person.first_name,
    last_name: person.last_name ?? '',
    nickname: person.nickname ?? '',
    gender: person.gender,
    birth_date: person.birth_date ?? '',
    birth_date_precision: person.birth_date_precision,
    death_date: person.death_date ?? '',
    death_date_precision: person.death_date_precision,
    life_status: person.life_status,
    occupation: person.occupation ?? '',
    education: person.education ?? '',
    biography: person.biography ?? '',
  });

  const [portrait, setPortrait] = useState(portraitUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const uploadPortrait = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadToArchive({
        file,
        filename: file.name,
        scope: 'people',
        scopeId: person.id,
        personId: person.id,
      });

      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('people')
        .update({ profile_photo_media_id: uploaded.mediaId })
        .eq('id', person.id);
      if (updateError) throw updateError;

      // Show it immediately from the local file rather than waiting for a
      // signed URL round trip: the upload already succeeded.
      setPortrait(URL.createObjectURL(file));
      router.refresh();
    } catch (caught) {
      setError(describeRpcError(caught, 'Зураг оруулахад алдаа гарлаа.'));
    } finally {
      setUploading(false);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (form.first_name.trim().length === 0) {
      setError('Нэр шаардлагатай.');
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('people')
      .update({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        nickname: form.nickname.trim() || null,
        gender: form.gender,
        // An empty date must clear the field, not write an empty string.
        birth_date: form.birth_date || null,
        birth_date_precision: form.birth_date_precision,
        death_date: form.death_date || null,
        death_date_precision: form.death_date_precision,
        // A recorded death date and "living" cannot both be true.
        life_status: form.death_date ? 'deceased' : form.life_status,
        occupation: form.occupation.trim() || null,
        education: form.education.trim() || null,
        biography: form.biography.trim() || null,
      })
      .eq('id', person.id);

    if (updateError) {
      setError(describeRpcError(updateError, 'Хадгалахад алдаа гарлаа. Танд засах эрх байгаа эсэхийг шалгана уу.'));
      setSaving(false);
      return;
    }

    router.push(`/person/${person.id}`);
    router.refresh();
  };

  return (
    <form onSubmit={save} className="space-y-8">
      {/* ---- the face ---- */}
      <section>
        <p className="eyebrow">Хөрөг</p>
        <div className="mt-3 flex items-center gap-4">
          <Photo
            src={portrait}
            alt={form.first_name}
            ratio="square"
            initial={form.first_name.slice(0, 1)}
            className="w-28 shrink-0 rounded-3xl"
          />
          <div className="min-w-0">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="sr-only-text"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void uploadPortrait(file);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              loading={uploading}
            >
              {portrait ? 'Хөрөг солих' : 'Хөрөг оруулах'}
            </Button>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Энэ зураг гэр бүлийн модонд харагдана. Хуучин, сканнердсан зураг ч болно.
            </p>
          </div>
        </div>
      </section>

      {/* ---- who they are ---- */}
      <section className="space-y-4">
        <p className="eyebrow">Хэн бэ</p>

        <TextField
          label="Нэр"
          value={form.first_name}
          onChange={(event) => set('first_name', event.target.value)}
          required
          maxLength={120}
        />
        <TextField
          label="Овог"
          value={form.last_name}
          onChange={(event) => set('last_name', event.target.value)}
          maxLength={120}
        />
        <TextField
          label="Хоч"
          value={form.nickname}
          onChange={(event) => set('nickname', event.target.value)}
          hint="Гэрийнхэн нь дуудаж заншсан нэр"
          maxLength={120}
        />
        <SelectField
          label="Хүйс"
          value={form.gender}
          onChange={(event) => set('gender', event.target.value as GenderBucket)}
        >
          {GENDERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </SelectField>
      </section>

      {/* ---- when ---- */}
      <section className="space-y-4">
        <p className="eyebrow">Он цаг</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
          <TextField
            label="Төрсөн огноо"
            type="date"
            value={form.birth_date}
            onChange={(event) => set('birth_date', event.target.value)}
          />
          <SelectField
            label="Нарийвчлал"
            value={form.birth_date_precision}
            onChange={(event) => set('birth_date_precision', event.target.value as DatePrecision)}
          >
            {PRECISIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
          <TextField
            label="Таалал төгссөн огноо"
            type="date"
            value={form.death_date}
            onChange={(event) => set('death_date', event.target.value)}
          />
          <SelectField
            label="Нарийвчлал"
            value={form.death_date_precision}
            onChange={(event) => set('death_date_precision', event.target.value as DatePrecision)}
          >
            {PRECISIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectField>
        </div>

        <SelectField
          label="Амьдралын байдал"
          value={form.death_date ? 'deceased' : form.life_status}
          disabled={Boolean(form.death_date)}
          onChange={(event) => set('life_status', event.target.value as LifeStatus)}
          hint={form.death_date ? 'Огноо бичигдсэн тул автоматаар тэмдэглэгдэнэ.' : undefined}
        >
          {STATUSES.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </SelectField>
      </section>

      {/* ---- life ---- */}
      <section className="space-y-4">
        <p className="eyebrow">Амьдрал</p>
        <TextField
          label="Мэргэжил"
          value={form.occupation}
          onChange={(event) => set('occupation', event.target.value)}
          maxLength={160}
        />
        <TextField
          label="Боловсрол"
          value={form.education}
          onChange={(event) => set('education', event.target.value)}
          maxLength={160}
        />
        <TextAreaField
          label="Намтар"
          value={form.biography}
          onChange={(event) => set('biography', event.target.value)}
          placeholder="Ямар хүн байсан бэ? Юу хийж явсан, юугаараа санагддаг вэ?"
          className="min-h-40"
        />
      </section>

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" loading={saving}>
          Хадгалах
        </Button>
        <Button type="button" size="lg" variant="ghost" onClick={() => router.back()}>
          Болих
        </Button>
      </div>
    </form>
  );
}
