import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { formatDate, yearOf } from '@/lib/format';
import type { PersonTimelineRow } from '@/types/database';

const EVENT_LABELS: Record<string, string> = {
  birth: 'Төрсөн', death: 'Таалал төгссөн', marriage: 'Гэрлэсэн', divorce: 'Салсан',
  birth_of_child: 'Хүүхэдтэй болсон', graduation: 'Төгссөн', education: 'Суралцсан',
  job: 'Ажил', military: 'Цэрэг', migration: 'Нүүсэн', move: 'Нүүсэн',
  award: 'Шагнал', illness: 'Өвчин', religious: 'Шашны', travel: 'Аялал',
  retirement: 'Тэтгэвэрт гарсан', memory: 'Дурсамж', other: 'Бусад',
};

/**
 * A person's chronological life.
 *
 * Undated entries are collected at the end under their own heading rather than
 * being dropped or guessed into place — in a family archive "we know it
 * happened, not when" is extremely common and is still worth keeping.
 */
export function PersonTimeline({
  entries,
  locale = 'mn',
}: {
  entries: PersonTimelineRow[];
  locale?: string;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="Он цагийн хэлхээс хоосон"
        description="Төрсөн он, сургууль, ажил, гэрлэсэн он зэргийг нэмбэл энд дараалан харагдана."
      />
    );
  }

  const dated = entries.filter((entry) => entry.event_date !== null);
  const undated = entries.filter((entry) => entry.event_date === null);

  return (
    <div className="card p-0">
      <ol className="divide-y divide-line">
        {dated.map((entry) => (
          <TimelineRow key={`${entry.entry_kind}:${entry.entry_id}`} entry={entry} locale={locale} />
        ))}
      </ol>

      {undated.length > 0 ? (
        <div className="border-t border-line bg-parchment-deep/40">
          <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-muted">
            Огноо тодорхойгүй
          </p>
          <ol className="divide-y divide-line">
            {undated.map((entry) => (
              <TimelineRow key={`${entry.entry_kind}:${entry.entry_id}`} entry={entry} locale={locale} />
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function TimelineRow({ entry, locale }: { entry: PersonTimelineRow; locale: string }) {
  const label = EVENT_LABELS[entry.event_type] ?? entry.event_type;
  const body = (
    <div className="flex items-baseline gap-3 px-4 py-3">
      <span className="w-12 shrink-0 font-display text-sm text-gold">
        {yearOf(entry.event_date) || '—'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-ink">{entry.title}</span>
          {entry.is_ai_extracted && !entry.confirmed_at ? (
            <Badge tone="ember">AI-аас олсон · батлаагүй</Badge>
          ) : null}
        </span>
        {entry.description ? (
          <span className="mt-0.5 block line-clamp-2 text-sm text-muted">{entry.description}</span>
        ) : null}
        <span className="mt-0.5 block text-xs text-muted">
          {label}
          {entry.event_date ? ` · ${formatDate(entry.event_date, entry.date_precision, locale)}` : ''}
        </span>
      </span>
    </div>
  );

  if (entry.entry_kind === 'memory') {
    return (
      <li>
        <Link href={`/memories/${entry.entry_id}`} className="block hover:bg-parchment-deep/40">
          {body}
        </Link>
      </li>
    );
  }
  return <li>{body}</li>;
}
