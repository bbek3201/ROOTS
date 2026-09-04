import Link from 'next/link';
import { EmptyState } from '@/components/ui/States';
import { relativeTime } from '@/lib/format';

export interface LetterSummary {
  id: string;
  title: string;
  createdAt: string;
  unlockAt: string | null;
  mine: boolean;
  /** The body did not come back from the database. That IS the seal. */
  sealed: boolean;
  unread: boolean;
}

export function LetterList({ letters }: { letters: LetterSummary[] }) {
  if (letters.length === 0) {
    return (
      <EmptyState
        icon="💌"
        title="Үүрд хадгалах зүйл бичээрэй."
        description="Хэлж амжаагүй үг, дараа нээхээр битүүмжилсэн захидал — аль нь ч болно."
        action={{ label: 'Захидал бичих', href: '/us/letters/new' }}
      />
    );
  }

  return (
    <div>
      <Link
        href="/us/letters/new"
        className="mb-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-forest text-sm font-medium text-forest-ink"
      >
        Захидал бичих
      </Link>

      <ul className="space-y-2">
        {letters.map((letter) => (
          <li key={letter.id}>
            <Link href={`/us/letters/${letter.id}`} className="card flex items-center gap-3 p-4">
              <span className="text-xl">{letter.sealed ? '🔒' : '💌'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{letter.title}</span>
                <span className="block text-xs text-muted">
                  {letter.mine ? 'Таны бичсэн' : 'Танд'} ·{' '}
                  {letter.sealed && letter.unlockAt
                    ? `${letter.unlockAt.slice(0, 10)}-нд нээгдэнэ`
                    : relativeTime(letter.createdAt)}
                </span>
              </span>
              {letter.unread && !letter.sealed ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-heart" aria-label="Уншаагүй" />
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
