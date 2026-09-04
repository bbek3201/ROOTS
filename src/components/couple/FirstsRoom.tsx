'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextAreaField, TextField } from '@/components/ui/Field';

export interface FirstCard {
  key: string;
  label: string;
  prompt: string;
  happenedOn: string | null;
  story: string | null;
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
    <ul className="space-y-2.5">
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
              className="card block w-full p-4 text-left"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-ink">{card.label}</span>
                {card.happenedOn ? (
                  <span className="shrink-0 text-xs text-muted">{card.happenedOn}</span>
                ) : null}
              </span>
              <span
                className={`mt-1.5 block text-sm leading-relaxed ${
                  card.story ? 'whitespace-pre-wrap text-ink-soft' : 'text-muted'
                }`}
              >
                {card.story ?? card.prompt}
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
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <Button variant="ghost" fullWidth onClick={onCancel}>Болих</Button>
        <Button fullWidth onClick={() => void save()} loading={saving}>Хадгалах</Button>
      </div>
    </Card>
  );
}
