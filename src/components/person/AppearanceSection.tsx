'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, SectionHeading } from '@/components/ui/Card';
import { TextAreaField } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { EyeIcon, SparkIcon, SpeakerIcon } from '@/components/icons';
import type { AppearanceDescriptionRow } from '@/types/database';

/**
 * Appearance memory.
 *
 * For an ancestor with no surviving photograph, the family's memory of their
 * face IS the only record there will ever be. This section exists to capture it
 * — and to keep three kinds of information visibly, permanently separate:
 *
 *   photograph         — verified, taken from a real photo   (sage)
 *   family_description — a relative's recollection, attributed (gold)
 *   ai_summary         — AI reorganisation of the above      (forest)
 *
 * The AI summary is never a new fact. It only merges what relatives wrote, and
 * it is labelled as AI everywhere it appears.
 *
 * The "read aloud" control is the reason this section is designed the way it
 * is: a blind family member cannot look at a photograph, but they can listen to
 * a careful description and build a picture of an ancestor in their own mind.
 */
export function AppearanceSection({
  personId,
  personName,
  descriptions,
  hasPhotos,
}: {
  personId: string;
  personName: string;
  descriptions: AppearanceDescriptionRow[];
  hasPhotos: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [organising, setOrganising] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const supportsSpeech = useRef(false);

  useEffect(() => {
    supportsSpeech.current = typeof window !== 'undefined' && 'speechSynthesis' in window;
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const familyDescriptions = descriptions.filter((row) => row.source_kind === 'family_description');
  const aiSummaries = descriptions.filter((row) => row.source_kind === 'ai_summary');
  const photoDerived = descriptions.filter((row) => row.source_kind === 'photograph');

  const speak = (row: AppearanceDescriptionRow) => {
    if (!('speechSynthesis' in window)) return;

    if (speakingId === row.id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(row.narration_text || row.description);
    utterance.lang = 'mn-MN';
    // Slower than default: this is being listened to carefully, not skimmed.
    utterance.rate = 0.92;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utterance);
    setSpeakingId(row.id);
  };

  const save = async () => {
    if (text.trim().length === 0) return;
    setSaving(true);
    setError(null);

    const response = await fetch(`/api/people/${personId}/appearance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: text.trim() }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Хадгалахад алдаа гарлаа.' }));
      setError(body.error ?? 'Хадгалахад алдаа гарлаа.');
      setSaving(false);
      return;
    }

    setText('');
    setAdding(false);
    setSaving(false);
    router.refresh();
  };

  const organise = async () => {
    setOrganising(true);
    setError(null);

    const response = await fetch(`/api/ai/appearance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ personId }),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok || body?.unavailable) {
      setError(body?.reason ?? body?.error ?? 'AI үйлчилгээ ажиллахгүй байна.');
      setOrganising(false);
      return;
    }

    setOrganising(false);
    router.refresh();
  };

  return (
    <section className="mb-6">
      <SectionHeading
        title="Дүр төрх"
        subtitle={hasPhotos ? 'Зураг болон гэр бүлийн дурсамжаас' : 'Гэрэл зураг байхгүй — гэр бүлийн дурсамжаар'}
        action={
          <button
            type="button"
            onClick={() => setAdding((value) => !value)}
            className="text-sm font-medium text-forest"
          >
            {adding ? 'Болих' : 'Тайлбар нэмэх'}
          </button>
        }
      />

      {adding ? (
        <Card className="mb-3">
          <TextAreaField
            label={`${personName} ямар харагддаг байсан бэ?`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Жишээ: Өндөр нуруутай, өргөн царайтай, зузаан хөмсөгтэй, хар үстэй, хамар нь бага зэрэг матигар."
            hint="Санаж байгаагаараа бичээрэй. Таны нэр энэ тайлбарын хажууд үүрд үлдэнэ."
            className="min-h-28"
          />
          <div className="mt-3 flex gap-2">
            <Button onClick={save} loading={saving} disabled={text.trim().length === 0}>
              Хадгалах
            </Button>
            <Button variant="ghost" onClick={() => { setAdding(false); setText(''); }}>
              Болих
            </Button>
          </div>
        </Card>
      ) : null}

      {error ? (
        <p role="alert" className="mb-3 rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {descriptions.length === 0 ? (
        <Card className="text-center">
          <EyeIcon size={28} className="mx-auto text-muted" />
          <p className="mt-2 font-display text-base text-ink">Дүр төрхийн тайлбар алга</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {hasPhotos
              ? 'Зурагнаас гадна санаж байгаа зүйлээ бичиж болно — хоолой, алхаа, царайны илэрхийлэл.'
              : 'Гэрэл зураг байхгүй бол гэр бүлийнхний дурсамж бол цорын ганц бичлэг. Хэн нэгэн санаж байвал бичиж үлдээгээрэй.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {photoDerived.map((row) => (
            <DescriptionCard
              key={row.id} row={row} tone="verified"
              speaking={speakingId === row.id} onSpeak={() => speak(row)}
            />
          ))}
          {familyDescriptions.map((row) => (
            <DescriptionCard
              key={row.id} row={row} tone="family"
              speaking={speakingId === row.id} onSpeak={() => speak(row)}
            />
          ))}
          {aiSummaries.map((row) => (
            <DescriptionCard
              key={row.id} row={row} tone="ai"
              speaking={speakingId === row.id} onSpeak={() => speak(row)}
            />
          ))}
        </div>
      )}

      {familyDescriptions.length >= 2 && aiSummaries.length === 0 ? (
        <Button
          variant="secondary"
          fullWidth
          className="mt-3"
          icon={<SparkIcon size={17} />}
          loading={organising}
          onClick={organise}
        >
          Тайлбаруудыг нэгтгэн эмхэтгэх
        </Button>
      ) : null}
    </section>
  );
}

function DescriptionCard({
  row,
  tone,
  speaking,
  onSpeak,
}: {
  row: AppearanceDescriptionRow;
  tone: 'verified' | 'family' | 'ai';
  speaking: boolean;
  onSpeak: () => void;
}) {
  const styles = {
    verified: 'border-sage/30 bg-sage-wash',
    family: 'border-olive/30 bg-olive-wash',
    ai: 'border-forest/30 bg-forest-wash',
  }[tone];

  return (
    <article className={`card ${styles}`}>
      <div className="flex items-start justify-between gap-2">
        {tone === 'verified' ? <Badge tone="sage">Зурагнаас баталгаажсан</Badge> : null}
        {tone === 'family' ? <Badge tone="olive">Гэр бүлийн дурсамж</Badge> : null}
        {tone === 'ai' ? <Badge tone="forest">AI-аар эмхэтгэсэн · баримт биш</Badge> : null}

        <button
          type="button"
          onClick={onSpeak}
          aria-label={speaking ? 'Уншихыг зогсоох' : 'Чангаар унших'}
          aria-pressed={speaking}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface ${
            speaking ? 'text-forest' : 'text-ink-soft'
          }`}
        >
          <SpeakerIcon size={17} />
        </button>
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-ink">{row.description}</p>

      {row.narration_text && row.narration_text !== row.description ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-muted">
            Чангаар уншихад зориулсан дэлгэрэнгүй
          </summary>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{row.narration_text}</p>
        </details>
      ) : null}

      <p className="mt-2.5 text-xs text-muted">
        {tone === 'ai'
          ? 'Гэр бүлийн тайлбаруудаас эмхэтгэсэн. Шинэ мэдээлэл нэмээгүй.'
          : `${row.contributor_name} санаж бичсэн`}
      </p>
    </article>
  );
}
