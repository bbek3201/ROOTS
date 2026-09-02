import { Badge } from '@/components/ui/Badge';
import { Timeline, TimelineEntry } from '@/components/ui/Timeline';
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
    <div className="card p-2">
      <Timeline>
        {dated.map((entry) => (
          <Row key={`${entry.entry_kind}:${entry.entry_id}`} entry={entry} locale={locale} />
        ))}
      </Timeline>

      {undated.length > 0 ? (
        <div className="mt-1 border-t border-line pt-2">
          <p className="px-4 pb-1 text-xs font-medium uppercase tracking-wide text-muted">
            Огноо тодорхойгүй
          </p>
          <Timeline>
            {undated.map((entry) => (
              <Row key={`${entry.entry_kind}:${entry.entry_id}`} entry={entry} locale={locale} muted />
            ))}
          </Timeline>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  entry,
  locale,
  muted = false,
}: {
  entry: PersonTimelineRow;
  locale: string;
  muted?: boolean;
}) {
  const label = EVENT_LABELS[entry.event_type] ?? entry.event_type;
  return (
    <TimelineEntry
      year={yearOf(entry.event_date) || '—'}
      title={entry.title}
      description={entry.description}
      muted={muted}
      meta={
        label +
        (entry.event_date ? ` · ${formatDate(entry.event_date, entry.date_precision, locale)}` : '')
      }
      badge={
        entry.is_ai_extracted && !entry.confirmed_at ? (
          <Badge tone="forest">AI-аас олсон · батлаагүй</Badge>
        ) : null
      }
      href={entry.entry_kind === 'memory' ? `/memories/${entry.entry_id}` : undefined}
    />
  );
}
