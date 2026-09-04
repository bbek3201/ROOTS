'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { describeRpcError } from '@/lib/supabase/errors';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextAreaField, TextField } from '@/components/ui/Field';

/**
 * How they met, and when it started.
 *
 * Written straight to couple_spaces rather than through a route: the update
 * policy on that table grants only the two members, so the client has exactly
 * the reach it should and a route would add a hop without adding a check.
 */
export function StoryEditor({
  spaceId,
  howWeMet,
  startedOn,
}: {
  spaceId: string;
  howWeMet: string;
  startedOn: string;
}) {
  const router = useRouter();
  const [story, setStory] = useState(howWeMet);
  const [date, setDate] = useState(startedOn.slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('couple_spaces')
        .update({ how_we_met: story.trim() || null, started_on: date || null })
        .eq('id', spaceId);
      if (updateError) throw updateError;
      setSaved(true);
      router.refresh();
    } catch (caught) {
      setError(describeRpcError(caught, 'Хадгалахад алдаа гарлаа.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <TextField
          label="Хамт болсон огноо"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          hint="Та хоёрын тоолж эхэлсэн өдөр."
        />
      </Card>

      <Card>
        <TextAreaField
          label="Хэрхэн танилцсан бэ?"
          value={story}
          onChange={(event) => setStory(event.target.value)}
          rows={10}
          placeholder="Тэр өдөр юу болсныг санаж байгаагаараа бичээрэй. Жижиг зүйлс нь хамгийн үнэтэй нь."
        />
      </Card>

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">{error}</p>
      ) : null}
      {saved ? (
        <p role="status" className="rounded-xl bg-sage-wash px-3 py-2.5 text-sm text-sage">Хадгалагдлаа.</p>
      ) : null}

      <Button size="lg" fullWidth onClick={() => void save()} loading={saving}>
        Хадгалах
      </Button>
    </div>
  );
}
