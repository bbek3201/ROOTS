'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { describeRpcError } from '@/lib/supabase/errors';
import { Button } from '@/components/ui/Button';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { rememberActiveFamily } from '@/lib/family/active-family';

/**
 * Creating a family calls the create_family() RPC rather than inserting a row.
 * The family and its owner membership are written in one transaction there, so
 * a failure halfway can never leave an archive that nobody can open.
 */
export function CreateFamilyForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc('create_family', {
      p_name: name.trim(),
      p_description: description.trim() || null,
      p_locale: 'mn',
    });

    if (rpcError || !data) {
      setError(describeRpcError(rpcError, 'Гэр бүл үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.'));
      setLoading(false);
      return;
    }

    rememberActiveFamily(data);
    router.replace('/family');
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <TextField
        label="Гэр бүлийн нэр"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Жишээ: Доржийн удам"
        hint="Овог, ургийн нэр, эсвэл танайхны дуудаж заншсан нэр."
        required
        maxLength={160}
      />

      <TextAreaField
        label="Товч тайлбар"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Хаанаас гаралтай, юугаараа онцлог гэр бүл вэ?"
        className="min-h-24"
      />

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" fullWidth loading={loading} disabled={name.trim().length === 0}>
        Архив үүсгэх
      </Button>

      <p className="text-xs leading-relaxed text-muted">
        Та энэ архивын эзэн болно. Зөвхөн таны урьсан хүмүүс үүнийг харах боломжтой.
      </p>
    </form>
  );
}
