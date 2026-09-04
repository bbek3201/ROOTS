import Link from 'next/link';
import { EmptyState } from '@/components/ui/States';
import { LetterIcon, LockIcon } from '@/components/icons';
import { formatDate, relativeTime } from '@/lib/format';

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

/**
 * The letters, as a stack of paper.
 *
 * Rows rather than cards, separated by hairlines: a card gives every letter a
 * border and a shadow, which makes a personal note look like a notification.
 * A sealed letter is drawn in outline — dashed rule, muted type, closed lock —
 * so its state is legible from across the room without a label shouting it.
 */
export function LetterList({ letters }: { letters: LetterSummary[] }) {
  if (letters.length === 0) {
    return (
      <EmptyState
        title="Үүрд хадгалах зүйл бичээрэй."
        description="Хэлж амжаагүй үг, эсвэл дараа нээхээр битүүмжилсэн захидал — аль нь ч болно."
        action={{ label: 'Захидал бичих', href: '/us/letters/new' }}
      />
    );
  }

  return (
    <div>
      <Link
        href="/us/letters/new"
        className="mb-7 flex min-h-12 w-full items-center justify-center rounded-pill bg-forest text-sm font-medium text-forest-ink"
      >
        Захидал бичих
      </Link>

      <ul className="border-t border-line">
        {letters.map((letter) => (
          <li key={letter.id}>
            <Link
              href={`/us/letters/${letter.id}`}
              className={`group flex items-baseline gap-4 border-b py-5 ${
                letter.sealed ? 'border-dashed border-line/70' : 'border-line'
              }`}
            >
              <span
                className={`mt-1 shrink-0 ${letter.sealed ? 'text-muted' : 'text-sage'}`}
                aria-hidden="true"
              >
                {letter.sealed ? <LockIcon size={18} /> : <LetterIcon size={18} />}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={`block text-[1.05rem] leading-snug ${
                    letter.sealed ? 'text-muted' : 'text-ink group-hover:underline decoration-1 underline-offset-4'
                  }`}
                >
                  {letter.title}
                </span>
                <span className="mt-1 block text-xs tracking-[0.08em] text-muted uppercase">
                  {letter.mine ? 'Таны бичсэн' : 'Танд'}
                  {' · '}
                  {letter.sealed && letter.unlockAt
                    ? `${formatDate(letter.unlockAt.slice(0, 10), 'exact')}-нд нээгдэнэ`
                    : relativeTime(letter.createdAt)}
                </span>
              </span>

              {letter.unread && !letter.sealed ? (
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-heart"
                  aria-label="Уншаагүй"
                />
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
