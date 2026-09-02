'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectField, TextField } from '@/components/ui/Field';

/**
 * Link the signed-in user to their own person in the tree.
 *
 * This single field is what turns ROOTS from a database into something
 * personal: once set, every profile can say "your grandmother" instead of
 * "Tseren", and the assistant can answer "who was MY mother's father".
 */
export function ProfileSettings({
  memberId,
  currentPersonId,
  displayName,
  people,
}: {
  memberId: string;
  currentPersonId: string | null;
  displayName: string;
  people: Array<{ id: string; label: string; detail: string }>;
}) {
  const router = useRouter();
  const [personId, setPersonId] = useState(currentPersonId ?? '');
  const [name, setName] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError('Дахин нэвтэрнэ үү.'); setSaving(false); return; }

    const [{ error: memberError }, { error: profileError }] = await Promise.all([
      supabase.from('family_members').update({ person_id: personId || null }).eq('id', memberId),
      supabase.from('profiles').update({ display_name: name.trim() || 'Гэр бүлийн гишүүн' }).eq('id', auth.user.id),
    ]);

    if (memberError || profileError) {
      setError('Хадгалахад алдаа гарлаа.');
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    router.refresh();
  };

  const dirty = personId !== (currentPersonId ?? '') || name !== displayName;

  return (
    <Card className="space-y-3.5">
      <TextField
        label="Харагдах нэр"
        value={name}
        onChange={(event) => setName(event.target.value)}
        hint="Таны нэмсэн дурсамж, зураг энэ нэрээр тэмдэглэгдэнэ."
      />

      <SelectField
        label="Та модны аль хүн бэ?"
        value={personId}
        onChange={(event) => setPersonId(event.target.value)}
        hint="Холбосноор «таны өвөө», «таны нагац эгч» гэх мэт хамаарал харагдана."
      >
        <option value="">— Холбоогүй —</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.label}{person.detail ? ` (${person.detail})` : ''}
          </option>
        ))}
      </SelectField>

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">{error}</p>
      ) : null}
      {saved && !dirty ? (
        <p role="status" className="rounded-xl bg-sage-wash px-3 py-2.5 text-sm text-sage">Хадгалагдлаа.</p>
      ) : null}

      <Button onClick={save} loading={saving} disabled={!dirty}>Хадгалах</Button>
    </Card>
  );
}
