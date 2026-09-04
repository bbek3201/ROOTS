'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { describeRpcError } from '@/lib/supabase/errors';
import { Button } from '@/components/ui/Button';

/**
 * A first draft, written from what the archive already knows.
 *
 * The model never writes into the archive. It proposes, a person reads, and
 * only a person saves — which is the rule the whole AI surface of ROOTS is
 * built on: a family history that quietly acquired invented details would be
 * worse than no family history at all. The draft is shown in full, editable,
 * and thrown away unless someone chooses to keep it.
 */
export function AiStoryDraft({ familyId }: { familyId: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setNote(null);
    try {
      const response = await fetch('/api/ai/story', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ familyId }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.error ?? 'Ноорог гаргаж чадсангүй.');
      } else if (body?.unavailable) {
        setError(body.reason ?? 'AI тохируулагдаагүй байна.');
      } else {
        setDraft(body?.story ?? '');
        setNote(
          body?.isMock
            ? 'Жишиг горим: энэ бол AI холбогдоогүй үеийн туршилтын текст.'
            : `Архивын ${body?.basedOn?.facts ?? 0} баримт, ${body?.basedOn?.memories ?? 0} дурсамж дээр үндэслэв.`,
        );
      }
    } catch {
      setError('Сервертэй холбогдож чадсангүй.');
    } finally {
      setLoading(false);
    }
  };

  const keep = async () => {
    if (!draft) return;
    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('families')
      .update({ description: draft.trim() || null })
      .eq('id', familyId);

    if (updateError) {
      setError(describeRpcError(updateError, 'Хадгалахад алдаа гарлаа.'));
      setSaving(false);
      return;
    }
    setSaving(false);
    setDraft(null);
    router.refresh();
  };

  return (
    <div>
      {draft === null ? (
        <Button type="button" variant="secondary" onClick={generate} loading={loading}>
          AI-аар ноорог гаргах
        </Button>
      ) : (
        <div className="rounded-[24px] border border-[color-mix(in_srgb,#183b32_12%,transparent)] bg-[#fffcf8] p-5">
          <p className="ed-eyebrow">Ноорог</p>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={12}
            className="mt-3 w-full resize-y rounded-2xl border border-[color-mix(in_srgb,#183b32_12%,transparent)] bg-white px-4 py-3 text-[16px] leading-relaxed text-[#183b32] focus:border-[color-mix(in_srgb,#183b32_40%,transparent)] focus:outline-none"
          />
          {note ? <p className="mt-2 text-xs text-muted">{note}</p> : null}
          <p className="mt-2 text-xs text-muted">
            Уншиж шалгаад хадгална уу. Буруу зүйл байвал засаарай — энэ бол ноорог.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={keep} loading={saving}>
              Түүх болгож хадгалах
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
              Болих
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
