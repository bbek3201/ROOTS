'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectField } from '@/components/ui/Field';
import { cn } from '@/lib/cn';

/**
 * Choose who to interview and which question set to use.
 *
 * People are ordered oldest generation first, because that is the order the
 * archive most urgently needs them in.
 */
export function StartInterview({
  people,
  sets,
}: {
  people: Array<{ id: string; label: string; detail: string; generation: number | null }>;
  sets: Array<{ id: string; title: string; description: string | null; questionCount: number }>;
}) {
  const router = useRouter();
  const [personId, setPersonId] = useState('');
  const [setId, setSetId] = useState(sets[0]?.id ?? '');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (!personId) return;
    setStarting(true);
    setError(null);

    const response = await fetch('/api/interviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subjectPersonId: personId, setId: setId || null }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? 'Ярилцлага эхлүүлэхэд алдаа гарлаа.');
      setStarting(false);
      return;
    }

    const { id } = (await response.json()) as { id: string };
    router.push(`/interview/${id}`);
  };

  return (
    <Card className="space-y-3.5">
      <SelectField
        label="Хэнтэй ярилцах вэ?"
        value={personId}
        onChange={(event) => setPersonId(event.target.value)}
        hint="Хамгийн ахмад үеийнхнээс эхлэхийг зөвлөж байна."
        required
      >
        <option value="">— Хүн сонгох —</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.label}{person.detail ? ` (${person.detail})` : ''}
          </option>
        ))}
      </SelectField>

      {sets.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-medium text-ink-soft">Асуултын багц</p>
          <div className="space-y-2">
            {sets.map((set) => (
              <button
                key={set.id}
                type="button"
                onClick={() => setSetId(set.id)}
                aria-pressed={setId === set.id}
                className={cn(
                  'w-full rounded-2xl border px-3.5 py-3 text-left transition-colors',
                  setId === set.id ? 'border-forest bg-forest-wash' : 'border-line bg-surface',
                )}
              >
                <span className="block text-sm font-medium text-ink">{set.title}</span>
                {set.description ? (
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">{set.description}</span>
                ) : null}
                <span className="mt-1 block text-xs text-olive">{set.questionCount} асуулт</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">{error}</p>
      ) : null}

      <Button fullWidth size="lg" onClick={start} loading={starting} disabled={!personId}>
        Ярилцлага эхлүүлэх
      </Button>
    </Card>
  );
}
