'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { describeRpcError } from '@/lib/supabase/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { FamilyRole } from '@/types/database';

/**
 * The family's code, as the person who started the tree sees it.
 *
 * This is the answer to "how do I get my brother in?" — one code, always the
 * same one, big enough to read off a screen across a table. It is deliberately
 * not a link: links die in group chats and cannot be said out loud at a
 * birthday, which is where families actually recruit each other.
 *
 * Everything dangerous about a re-usable code is one tap away: switch it off,
 * or replace it. Replacing it kills the old one instantly, which is the fix for
 * "it ended up somewhere it shouldn't have".
 */
const ROLES: Array<{ value: FamilyRole; label: string; detail: string }> = [
  { value: 'viewer', label: 'Үзэгч', detail: 'Зөвхөн үзнэ' },
  { value: 'contributor', label: 'Хувь нэмэр', detail: 'Дурсамж, зураг нэмнэ' },
  { value: 'editor', label: 'Засварлагч', detail: 'Мод, хамаарал засна' },
];

interface JoinCode {
  code: string;
  role: FamilyRole;
  isEnabled: boolean;
  useCount: number;
}

export function JoinCodeCard({ familyId }: { familyId: string }) {
  const [state, setState] = useState<JoinCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc('get_join_code', { p_family_id: familyId });
    const row = Array.isArray(data) ? data[0] : null;

    if (rpcError || !row) {
      setError(describeRpcError(rpcError, 'Кодыг ачаалж чадсангүй.'));
    } else {
      setState({ code: row.code, role: row.role, isEnabled: row.is_enabled, useCount: row.use_count });
      setError(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by family.
  }, [familyId]);

  const rotate = async () => {
    if (!window.confirm('Шинэ код үүсгэх үү? Хуучин код тэр даруй ажиллахаа болино.')) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc('rotate_join_code', { p_family_id: familyId });
    if (rpcError || !data) setError(describeRpcError(rpcError, 'Код солиход алдаа гарлаа.'));
    else setState((current) => (current ? { ...current, code: data, useCount: 0 } : current));
    setBusy(false);
  };

  const update = async (patch: { enabled?: boolean; role?: FamilyRole }) => {
    setBusy(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('set_join_code_policy', {
      p_family_id: familyId,
      p_is_enabled: patch.enabled ?? null,
      p_role: patch.role ?? null,
    });
    if (rpcError) setError(describeRpcError(rpcError, 'Тохиргоог хадгалж чадсангүй.'));
    else
      setState((current) =>
        current
          ? { ...current, isEnabled: patch.enabled ?? current.isEnabled, role: patch.role ?? current.role }
          : current,
      );
    setBusy(false);
  };

  const copy = async () => {
    if (!state) return;
    await navigator.clipboard?.writeText(state.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <Card className="p-5"><p className="text-sm text-muted">Ачаалж байна…</p></Card>;
  }

  return (
    <Card className="p-5">
      {state ? (
        <>
          <p className="text-sm text-ink-soft">
            Танайхны хэн нэг нь бүртгүүлээд энэ кодыг оруулбал шууд энэ архивт нэгдэнэ.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <p
              className={`flex-1 rounded-2xl bg-parchment-deep/70 px-4 py-4 text-center font-display text-[1.65rem] tracking-[0.24em] ${
                state.isEnabled ? 'text-ink' : 'text-muted line-through'
              }`}
            >
              {state.code}
            </p>
            <Button type="button" variant="secondary" onClick={copy} disabled={!state.isEnabled}>
              {copied ? 'Хууллаа' : 'Хуулах'}
            </Button>
          </div>

          <p className="mt-2.5 text-xs text-muted">
            {state.isEnabled
              ? `${state.useCount} хүн энэ кодоор нэгдсэн байна.`
              : 'Код унтраалттай байна — одоогоор хэн ч нэгдэж чадахгүй.'}
          </p>

          <div className="mt-5 space-y-2">
            <p className="eyebrow">Кодоор нэгдсэн хүний эрх</p>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  disabled={busy}
                  onClick={() => update({ role: role.value })}
                  aria-pressed={state.role === role.value}
                  className={`rounded-pill px-4 py-2 text-sm transition-colors ${
                    state.role === role.value
                      ? 'bg-forest text-forest-ink'
                      : 'bg-parchment-deep text-ink-soft hover:text-ink'
                  }`}
                >
                  {role.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">
              {ROLES.find((role) => role.value === state.role)?.detail}. Админ эрхийг зөвхөн гараар өгнө.
            </p>
          </div>

          {error ? (
            <p role="alert" className="mt-4 rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={rotate} loading={busy}>
              Шинэ код үүсгэх
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => update({ enabled: !state.isEnabled })}
              disabled={busy}
            >
              {state.isEnabled ? 'Кодыг унтраах' : 'Кодыг асаах'}
            </Button>
          </div>
        </>
      ) : (
        <p role="alert" className="text-sm text-danger">{error}</p>
      )}
    </Card>
  );
}
