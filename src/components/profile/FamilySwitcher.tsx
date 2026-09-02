'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

/**
 * Switch between families.
 *
 * Writes a cookie and refreshes; the server resolves that cookie against the
 * user's real memberships, so it is a preference and never an access decision.
 */
export function FamilySwitcher({
  activeFamilyId,
  families,
}: {
  activeFamilyId: string;
  families: Array<{ id: string; name: string; role: string }>;
}) {
  const router = useRouter();

  const choose = (familyId: string) => {
    document.cookie = `roots.family=${familyId}; path=/; max-age=31536000; samesite=lax`;
    router.push('/family');
    router.refresh();
  };

  return (
    <Card className="p-0">
      <ul className="divide-y divide-line">
        {families.map((family) => (
          <li key={family.id}>
            <button
              type="button"
              onClick={() => choose(family.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <span className="min-w-0">
                <span className={cn(
                  'block truncate text-sm font-medium',
                  family.id === activeFamilyId ? 'text-forest' : 'text-ink',
                )}>
                  {family.name}
                </span>
                <span className="block text-xs text-muted">{family.role}</span>
              </span>
              {family.id === activeFamilyId ? (
                <span className="shrink-0 text-xs font-medium text-forest">Идэвхтэй</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
