'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { describeRpcError } from '@/lib/supabase/errors';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { rememberActiveFamily } from '@/lib/family/active-family';
import { formatJoinCode, isCompleteJoinCode, extractJoinCode } from '@/lib/family/join-code';

/**
 * Joining a family with the code someone read out to you.
 *
 * Two steps rather than one, and the first step is the reason this exists: the
 * code is checked with preview_join_code() and the family's NAME is shown back
 * before anything is joined. Nobody should discover which archive they have
 * walked into after the fact — and a mistyped code that happens to be someone
 * else's should be caught by a person recognising a name, not by a database.
 *
 * The field itself is forgiving on purpose. It uppercases, inserts the dash,
 * folds the letters that are always mistaken for digits, and accepts a whole
 * pasted link — because the alternative is a grandparent failing to join over a
 * lowercase letter.
 */
export function JoinFamilyForm({ initialCode = '' }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(() => formatJoinCode(initialCode));
  const [match, setMatch] = useState<{ familyId: string; name: string; members: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A code that arrives in the URL — from a shared link — is checked on sight,
  // so the person lands on "Join the Dorj family", not on an empty field.
  useEffect(() => {
    if (isCompleteJoinCode(initialCode)) void check(formatJoinCode(initialCode));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, for the URL.
  }, []);

  const check = async (value: string) => {
    setChecking(true);
    setError(null);
    setMatch(null);

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc('preview_join_code', { p_code: value });
    const row = Array.isArray(data) ? data[0] : null;

    if (rpcError) {
      setError(describeRpcError(rpcError, 'Кодыг шалгахад алдаа гарлаа. Дахин оролдоно уу.'));
    } else if (!row) {
      // One message for every kind of failure — wrong, switched off, expired or
      // used up. Telling them apart would tell a stranger which codes exist.
      setError('Ийм код олдсонгүй. Кодоо шалгаад дахин оруулна уу.');
    } else {
      setMatch({ familyId: row.family_id, name: row.family_name, members: row.member_count });
    }
    setChecking(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isCompleteJoinCode(code)) return;
    void check(code);
  };

  const join = async () => {
    setJoining(true);
    setError(null);

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc('join_family_with_code', { p_code: code });

    if (rpcError || !data) {
      setError(describeRpcError(rpcError, 'Нэгдэхэд алдаа гарлаа. Код хүчинтэй эсэхийг шалгана уу.'));
      setJoining(false);
      return;
    }

    rememberActiveFamily(data);
    router.replace('/family');
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField
        label="Гэр бүлийн код"
        value={code}
        onChange={(event) => {
          setCode(formatJoinCode(event.target.value));
          setMatch(null);
          setError(null);
        }}
        onPaste={(event) => {
          const pasted = extractJoinCode(event.clipboardData.getData('text'));
          if (!pasted) return;
          event.preventDefault();
          setCode(pasted);
          setMatch(null);
          setError(null);
        }}
        placeholder="7K3D-9F2A"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={9}
        hint="Архив үүсгэсэн хүнээс асуугаарай. Жижиг, том үсэг ялгаагүй."
        className="font-display text-center text-[1.35rem] tracking-[0.32em]"
      />

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {match ? (
        <div className="rounded-2xl bg-forest-wash px-4 py-3.5">
          <p className="text-sm text-ink-soft">Энэ код танайхыг дараах архив руу оруулна:</p>
          <p className="mt-1 font-display text-lg text-ink">{match.name}</p>
          <p className="mt-0.5 text-sm text-muted">
            {match.members} гишүүн
          </p>
        </div>
      ) : null}

      {match ? (
        <Button type="button" size="lg" fullWidth loading={joining} onClick={join}>
          {match.name} руу нэгдэх
        </Button>
      ) : (
        <Button type="submit" size="lg" fullWidth loading={checking} disabled={!isCompleteJoinCode(code)}>
          Кодыг шалгах
        </Button>
      )}
    </form>
  );
}
