'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { PhotoAttachment } from '@/components/couple/PhotoAttachment';

/**
 * Writing a letter.
 *
 * The unlock date is optional and off by default: most letters are meant to be
 * read now, and making sealing the default would turn every note into an event.
 * When it IS set, the recipient sees the envelope and the date but not a word
 * of the contents — the database will not return them.
 */
export function NewLetterForm({ spaceId, recipientName }: { spaceId: string; recipientName: string }) {
  const router = useRouter();
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [seal, setSeal] = useState(false);
  const [unlockOn, setUnlockOn] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (title.trim().length === 0 || body.trim().length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/couple/${spaceId}/letters`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          // Local midnight of the chosen day, which is what a person means when
          // they pick a date to be surprised on.
          unlockAt: seal && unlockOn ? new Date(`${unlockOn}T00:00:00`).toISOString() : null,
          mediaId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? 'Хадгалахад алдаа гарлаа.');
      router.push('/us/letters');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Хадгалахад алдаа гарлаа.');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <p className="text-sm text-muted">Хүлээн авагч: <span className="text-ink">{recipientName}</span></p>
        <TextField
          label="Гарчиг"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Намайг санахдаа нээгээрэй"
          required
        />
        <TextAreaField
          label="Захидал"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={12}
          required
        />
        <PhotoAttachment spaceId={spaceId} onChange={setMediaId} />
      </Card>

      <Card>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={seal}
            onChange={(event) => setSeal(event.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-[#183b32]"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink">Тодорхой өдөр хүртэл битүүмжлэх</span>
            <span className="block text-xs leading-relaxed text-muted">
              Тэр өдөр хүртэл {recipientName} гарчгийг л харна. Агуулгыг нь сервер ч буцаахгүй.
            </span>
          </span>
        </label>

        {seal ? (
          <div className="mt-3">
            <TextField
              label="Нээгдэх өдөр"
              type="date"
              value={unlockOn}
              onChange={(event) => setUnlockOn(event.target.value)}
            />
          </div>
        ) : null}
      </Card>

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">{error}</p>
      ) : null}

      <Button
        size="lg"
        fullWidth
        onClick={() => void submit()}
        loading={saving}
        disabled={title.trim().length === 0 || body.trim().length === 0 || (seal && !unlockOn)}
      >
        Илгээх
      </Button>
    </div>
  );
}
