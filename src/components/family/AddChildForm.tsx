'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { describeRpcError } from '@/lib/supabase/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectField, TextField } from '@/components/ui/Field';
import { PlusIcon } from '@/components/icons';
import { cn } from '@/lib/cn';

/**
 * Add a child to a couple.
 *
 * This one call is where ROOTS earns its keep. `add_child_to_couple` creates
 * the person AND both parent links in a single transaction, so the moment it
 * returns the system already knows this child's parents, siblings,
 * half-siblings, grandparents, aunts, uncles and cousins — none of which anyone
 * had to type. Generations are recomputed by the database on the same write.
 */
export function AddChildForm({ coupleId, className }: { coupleId: string; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'unknown'>('unknown');
  const [birthYear, setBirthYear] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (firstName.trim().length === 0) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('add_child_to_couple', {
      p_couple_id: coupleId,
      p_first_name: firstName.trim(),
      p_gender: gender,
      // A year alone is normal in an archive; it is stored with year precision.
      p_birth_date: /^\d{4}$/.test(birthYear.trim()) ? `${birthYear.trim()}-01-01` : null,
    });

    if (rpcError) {
      setError(
        rpcError.message.includes('permission')
          ? 'Танд хүүхэд нэмэх эрх байхгүй байна.'
          : describeRpcError(rpcError, 'Хадгалахад алдаа гарлаа. Дахин оролдоно уу.'),
      );
      setSaving(false);
      return;
    }

    setFirstName('');
    setBirthYear('');
    setGender('unknown');
    setSaving(false);
    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <Button
        variant="secondary"
        fullWidth
        icon={<PlusIcon size={17} />}
        className={className}
        onClick={() => setOpen(true)}
      >
        Хүүхэд нэмэх
      </Button>
    );
  }

  return (
    <Card className={cn('space-y-3.5', className)}>
      <TextField
        label="Нэр"
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
        placeholder="Хүүхдийн нэр"
        autoFocus
        required
      />

      <SelectField
        label="Хүйс"
        value={gender}
        onChange={(event) => setGender(event.target.value as typeof gender)}
      >
        <option value="unknown">Тодорхойгүй</option>
        <option value="male">Эрэгтэй</option>
        <option value="female">Эмэгтэй</option>
        <option value="other">Бусад</option>
      </SelectField>

      <TextField
        label="Төрсөн он"
        value={birthYear}
        onChange={(event) => setBirthYear(event.target.value.replace(/\D/g, '').slice(0, 4))}
        inputMode="numeric"
        placeholder="1988"
        hint="Мэдэхгүй бол хоосон орхино уу. Дараа нэмж болно."
      />

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">{error}</p>
      ) : null}

      <p className="text-xs leading-relaxed text-muted">
        Хадгалмагц эцэг эх, ах дүү, өвөө эмээ, авга нагацын хамаарал автоматаар тооцогдоно.
      </p>

      <div className="flex gap-2">
        <Button onClick={submit} loading={saving} disabled={firstName.trim().length === 0}>
          Нэмэх
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Болих</Button>
      </div>
    </Card>
  );
}
