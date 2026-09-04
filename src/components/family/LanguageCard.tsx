'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { describeRpcError } from '@/lib/supabase/errors';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

/**
 * Which language the archive speaks.
 *
 * This is not a translation toggle for the interface. It is the setting that
 * decides which kinship vocabulary names a relationship — and Mongolian and
 * English genuinely disagree about what a relationship IS. Mongolian has
 * separate words for the paternal and maternal line (авга / нагац) and for
 * descent through a son and through a daughter (ач / зээ); English collapses
 * all four into "cousin" and "grandchild".
 *
 * It also decides how dates are written, which language the AI answers in, and
 * which language a recording is transcribed as. A family in Ulaanbaatar and
 * their grandchildren abroad want different answers to all four.
 */
const LANGUAGES = [
  { code: 'mn', name: 'Монгол', note: 'Авга/нагац, ач/зээ ялгаатай' },
  { code: 'en', name: 'English', note: 'Cousin, grandchild — ялгалгүй' },
] as const;

export function LanguageCard({ familyId, current }: { familyId: string; current: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (code: string) => {
    if (code === current) return;
    setSaving(code);
    setError(null);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc('set_family_locale', {
        p_family_id: familyId,
        p_locale: code,
      });
      if (rpcError) throw rpcError;
      router.refresh();
    } catch (caught) {
      setError(describeRpcError(caught, 'Хэл солиход алдаа гарлаа.'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card className="p-0">
      <ul className="divide-y divide-line">
        {LANGUAGES.map((language) => {
          const active = language.code === current;
          return (
            <li key={language.code}>
              <button
                type="button"
                onClick={() => void choose(language.code)}
                disabled={active || saving !== null}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3.5 text-left disabled:opacity-100',
                  !active && saving === null && 'hover:bg-parchment-deep',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{language.name}</span>
                  <span className="block text-xs text-muted">{language.note}</span>
                </span>
                {active ? (
                  <span className="shrink-0 text-sm text-forest" aria-label="Сонгогдсон">✓</span>
                ) : saving === language.code ? (
                  <span className="shrink-0 text-xs text-muted">Солиж байна…</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p role="alert" className="border-t border-line px-4 py-2.5 text-sm text-danger">{error}</p>
      ) : null}
    </Card>
  );
}
