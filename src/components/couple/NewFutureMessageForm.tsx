'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { PhotoAttachment } from '@/components/couple/PhotoAttachment';
import { LockIcon } from '@/components/icons';
import { nextAnniversary } from '@/lib/couple/timeline';

/**
 * Leaving something for later.
 *
 * The date suggestions are anniversaries rather than "in 1 year", because that
 * is how couples actually think about the future: the fifth anniversary, not
 * 1826 days from Tuesday.
 *
 * Once written, neither of them can move the date and neither can read it back.
 * The form says so plainly before the button, because that is a promise worth
 * understanding before making rather than discovering afterwards.
 */
export function NewFutureMessageForm({
  spaceId,
  startedOn,
}: {
  spaceId: string;
  startedOn: string | null;
}) {
  const router = useRouter();
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [unlockOn, setUnlockOn] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = anniversarySuggestions(startedOn);

  const submit = async () => {
    if (title.trim().length === 0 || body.trim().length === 0 || !unlockOn) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/couple/${spaceId}/future`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          unlockAt: new Date(`${unlockOn}T00:00:00`).toISOString(),
          mediaId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? 'Хадгалахад алдаа гарлаа.');
      router.push('/us/future');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Хадгалахад алдаа гарлаа.');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <TextField
          label="Гарчиг"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="5 жилийн ойдоо нээнэ үү ❤"
          required
        />
        <TextAreaField
          label="Захиа"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={12}
          placeholder="Тэр өдөр та хоёр юу мэдэрч байгаасай гэж хүсэж байна вэ?"
          required
        />
        <PhotoAttachment spaceId={spaceId} onChange={setMediaId} label="Зураг хавсаргах" />
      </Card>

      <Card>
        <TextField
          label="Хэзээ нээгдэх вэ?"
          type="date"
          value={unlockOn}
          onChange={(event) => setUnlockOn(event.target.value)}
          required
        />

        {suggestions.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {suggestions.map((suggestion) => (
              <li key={suggestion.date}>
                <button
                  type="button"
                  onClick={() => setUnlockOn(suggestion.date)}
                  aria-pressed={unlockOn === suggestion.date}
                  className={`rounded-pill px-3 py-1.5 text-xs ${
                    unlockOn === suggestion.date
                      ? 'bg-forest text-forest-ink'
                      : 'border border-line text-ink-soft'
                  }`}
                >
                  {suggestion.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-4 rounded-xl bg-parchment-deep px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
          Хадгалсны дараа энэ огноог хэн ч өөрчилж чадахгүй, агуулгыг нь та өөрөө ч тэр өдрийг
          хүртэл дахин уншиж чадахгүй.
        </p>
      </Card>

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">{error}</p>
      ) : null}

      <Button
        size="lg"
        fullWidth
        onClick={() => void submit()}
        loading={saving}
        disabled={title.trim().length === 0 || body.trim().length === 0 || !unlockOn}
        icon={<LockIcon size={18} />}
      >
        Битүүмжлэх
      </Button>
    </div>
  );
}

/** The next few anniversaries, which is how couples name future dates. */
function anniversarySuggestions(startedOn: string | null): Array<{ date: string; label: string }> {
  const next = nextAnniversary(startedOn);
  if (!next) return [];

  return [1, 3, 5, 10].map((offset) => {
    const date = new Date(next.date);
    date.setFullYear(date.getFullYear() + offset - 1);
    const years = next.years + offset - 1;
    return {
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      label: `${years} жилийн ой`,
    };
  });
}
