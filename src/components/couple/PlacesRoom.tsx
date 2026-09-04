'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/States';
import { MapPinIcon } from '@/components/icons';
import { PhotoAttachment } from '@/components/couple/PhotoAttachment';

export interface CouplePlace {
  id: string;
  name: string;
  visitedOn: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
}

/**
 * Everywhere they went together.
 *
 * There is no embedded map, and that is a decision rather than an omission.
 * Every map library worth using loads tiles from a third-party host, which
 * would mean the names of the places a couple keeps privately being requested
 * from someone else's server on every page view. A list of places they can read
 * is worth more than a map that leaks where they have been; the coordinates are
 * stored, so a map can be added later if it can be served without that cost.
 */
export function PlacesRoom({ spaceId, places }: { spaceId: string; places: CouplePlace[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [visitedOn, setVisitedOn] = useState('');
  const [notes, setNotes] = useState('');
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (name.trim().length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/couple/${spaceId}/places`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          visitedOn: visitedOn || null,
          notes: notes.trim() || undefined,
          mediaId,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Хадгалахад алдаа гарлаа.');
      }
      setName('');
      setVisitedOn('');
      setNotes('');
      setMediaId(null);
      setAdding(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Хадгалахад алдаа гарлаа.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {adding ? (
        <Card className="space-y-3">
          <TextField
            label="Газрын нэр"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Токио, Япон"
            required
          />
          <TextField
            label="Хэзээ очсон бэ?"
            type="date"
            value={visitedOn}
            onChange={(event) => setVisitedOn(event.target.value)}
          />
          <TextAreaField
            label="Тэмдэглэл"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
          />
          <PhotoAttachment spaceId={spaceId} onChange={setMediaId} />
          <div className="flex gap-2">
            <Button variant="ghost" fullWidth onClick={() => setAdding(false)}>Болих</Button>
            <Button fullWidth onClick={() => void submit()} loading={saving} disabled={name.trim().length === 0}>
              Нэмэх
            </Button>
          </div>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        </Card>
      ) : (
        <Button fullWidth variant="secondary" onClick={() => setAdding(true)}>
          Газар нэмэх
        </Button>
      )}

      {places.length === 0 ? (
        <EmptyState
          title="Хамт очсон газраа тэмдэглээрэй"
          description="Анхны болзооны газраас эхлээд аялсан хот бүр хүртэл."
        />
      ) : (
        <ul className="border-t border-line">
          {places.map((place) => (
            <li key={place.id} className="flex items-start gap-4 border-b border-line py-5">
              {place.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires.
                <img
                  src={place.imageUrl}
                  alt=""
                  loading="lazy"
                  className="h-16 w-14 shrink-0 rounded-lg border border-line object-cover"
                />
              ) : (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sage ring-1 ring-line">
                  <MapPinIcon size={14} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[1.05rem] leading-snug text-ink">{place.name}</span>
                {place.visitedOn ? (
                  <span className="mt-1 block text-xs tracking-[0.08em] text-muted uppercase">
                    {place.visitedOn}
                  </span>
                ) : null}
                {place.notes ? (
                  <span className="mt-2.5 block whitespace-pre-wrap text-[0.95rem] leading-relaxed text-ink-soft">
                    {place.notes}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
