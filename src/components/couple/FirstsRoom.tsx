'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { PhotoAttachment } from '@/components/couple/PhotoAttachment';
import { formatDate } from '@/lib/format';

export interface FirstCard {
  key: string;
  label: string;
  prompt: string;
  happenedOn: string | null;
  story: string | null;
  imageUrl: string | null;
}

/**
 * The firsts, all nine of them, filled or not.
 *
 * An empty card shows its question rather than disappearing. That is the whole
 * design: "who said it first?" gets answered, and a page that only listed what
 * somebody already thought to write down would never ask.
 */
export function FirstsRoom({ spaceId, cards }: { spaceId: string; cards: FirstCard[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <ul className="space-y-3.5">
      {cards.map((card) => (
        <li key={card.key}>
          {editing === card.key ? (
            <FirstEditor
              spaceId={spaceId}
              card={card}
              onDone={() => { setEditing(null); router.refresh(); }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(card.key)}
              // An unwritten first is drawn in outline — dashed, no ground —
              // so the page reads at a glance as what is filled and what is
              // still being asked, without a single word of instruction.
              className={`block w-full overflow-hidden text-left ${
                card.story || card.happenedOn ? 'card p-0' : 'rounded-(--radius-card) border border-dashed border-line p-0'
              }`}
            >
              {card.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires.
                <img
                  src={card.imageUrl}
                  alt=""
                  loading="lazy"
                  className="aspect-video w-full object-cover"
                />
              ) : null}

              <span className="block px-5 py-5">
                <span className="flex items-baseline justify-between gap-4">
                  <span className="eyebrow">{card.label}</span>
                  {card.happenedOn ? (
                    <span className="shrink-0 text-xs text-muted">
                      {formatDate(card.happenedOn, 'exact')}
                    </span>
                  ) : null}
                </span>

                {card.story ? (
                  <span className="mt-3 block whitespace-pre-wrap text-[1.02rem] leading-relaxed text-ink">
                    {card.story}
                  </span>
                ) : (
                  // The prompt is a question, set as one. A greyed-out label
                  // would read as a disabled field; a question invites an answer.
                  <span className="mt-3 block text-[1.02rem] leading-relaxed text-muted">
                    {card.prompt}
                  </span>
                )}
              </span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function FirstEditor({
  spaceId,
  card,
  onDone,
  onCancel,
}: {
  spaceId: string;
  card: FirstCard;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [happenedOn, setHappenedOn] = useState(card.happenedOn ?? '');
  const [story, setStory] = useState(card.story ?? '');
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/couple/${spaceId}/firsts`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: card.key,
          happenedOn: happenedOn || null,
          story: story.trim() || undefined,
          mediaId,
        }),
      });
      if (!response.ok) throw new Error('Хадгалахад алдаа гарлаа.');
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Хадгалахад алдаа гарлаа.');
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-3">
      <p className="text-sm font-medium text-ink">{card.label}</p>
      <p className="text-xs text-muted">{card.prompt}</p>
      <TextField
        label="Огноо"
        type="date"
        value={happenedOn}
        onChange={(event) => setHappenedOn(event.target.value)}
      />
      <TextAreaField
        label="Түүх"
        value={story}
        onChange={(event) => setStory(event.target.value)}
        rows={5}
      />
      <PhotoAttachment spaceId={spaceId} onChange={setMediaId} />
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <Button variant="ghost" fullWidth onClick={onCancel}>Болих</Button>
        <Button fullWidth onClick={() => void save()} loading={saving}>Хадгалах</Button>
      </div>
    </Card>
  );
}
