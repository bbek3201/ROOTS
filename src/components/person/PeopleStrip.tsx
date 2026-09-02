import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { displayName, lifespan } from '@/lib/format';
import type { PersonNode } from '@/lib/relationships/types';

/**
 * A horizontally scrolling row of relatives.
 *
 * Renders nothing at all when the row is empty and no hint is given — an
 * ancestor with no recorded grandchildren should not show seven empty headings.
 */
export function PeopleStrip({
  label,
  people,
  emptyHint,
}: {
  label: string;
  people: PersonNode[];
  emptyHint?: string;
}) {
  if (people.length === 0 && !emptyHint) return null;

  return (
    <div>
      <p className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      {people.length === 0 ? (
        <p className="px-1 text-sm text-muted">{emptyHint}</p>
      ) : (
        <ul className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {people.map((person) => (
            <li key={person.id}>
              <Link
                href={`/person/${person.id}`}
                className="flex w-[4.75rem] flex-col items-center gap-1.5 rounded-xl py-1 text-center"
              >
                <Avatar person={person} size="sm" />
                <span className="w-full truncate text-xs font-medium text-ink">{displayName(person)}</span>
                <span className="text-[0.65rem] leading-tight text-muted">{lifespan(person)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
