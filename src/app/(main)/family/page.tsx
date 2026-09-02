import Link from 'next/link';
import { requireActiveFamily } from '@/lib/family-context';
import { getFamilyActivity, getFamilyGraph, getFamilyHome } from '@/lib/data/family';
import { getFamilyTimeline } from '@/lib/data/timeline';
import { Card, LinkCard, SectionHeading } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { ArchiveIcon, ChevronRightIcon, ClockIcon, MicIcon, PlusIcon, TreeIcon } from '@/components/icons';
import { formatDate, relativeTime, yearOf } from '@/lib/format';
import { TreePreview } from '@/components/tree/TreePreview';

export const dynamic = 'force-dynamic';

/**
 * The home screen.
 *
 * Ordered by what actually pulls someone back into a family archive: the tree
 * first (it is the reason they opened the app), then the unfinished interview
 * (the most perishable thing in ROOTS — the person being interviewed will not
 * be here forever), then recent memories, timeline and family activity.
 */
export default async function FamilyHomePage() {
  const membership = await requireActiveFamily();
  const familyId = membership.family_id;

  const [graph, home, timeline, activity] = await Promise.all([
    getFamilyGraph(familyId),
    getFamilyHome(familyId),
    getFamilyTimeline(familyId, 6),
    getFamilyActivity(familyId, 6),
  ]);

  const isEmpty = home.counts.people === 0;

  return (
    <main id="main" className="px-4 pb-6 pt-5">
      <header className="mb-5 px-1">
        <p className="font-display text-[0.7rem] tracking-[0.35em] text-gold">ROOTS</p>
        <h1 className="mt-1.5 font-display text-2xl leading-tight text-ink">{membership.family.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {home.counts.people} хүн · {home.counts.couples} хос · {home.counts.memories} дурсамж
        </p>
      </header>

      {isEmpty ? (
        <EmptyState
          icon={<TreeIcon size={34} />}
          title="Архив хоосон байна"
          description="Эхлээд хамгийн ахмад нь буюу өвөө эмээгээсээ эхэлье. Дараа нь хос, хүүхдүүдийг нэмэхэд хамаарал автоматаар тооцогдоно."
          action={{ label: 'Эхний хүнийг нэмэх', href: '/family/add-person' }}
        />
      ) : (
        <section className="mb-6">
          <SectionHeading
            title="Гэр бүлийн мод"
            action={
              <Link href="/family/tree" className="inline-flex items-center gap-0.5 text-sm font-medium text-ember">
                Дэлгэрэнгүй <ChevronRightIcon size={16} />
              </Link>
            }
          />
          <TreePreview graph={graph} focusPersonId={membership.person_id} />
        </section>
      )}

      {home.resumableInterview ? (
        <section className="mb-6">
          <SectionHeading title="Дуусаагүй ярилцлага" />
          <LinkCard href={`/interview/${home.resumableInterview.id}`} className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ember-wash text-ember">
              <MicIcon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-ink">
                {home.resumableInterview.title ?? 'Амьдралын түүх'}
              </span>
              <span className="block text-sm text-muted">
                {relativeTime(home.resumableInterview.updated_at)} · үргэлжлүүлэх
              </span>
            </span>
            <ChevronRightIcon className="shrink-0 text-muted" size={18} />
          </LinkCard>
        </section>
      ) : !isEmpty ? (
        <section className="mb-6">
          <LinkCard href="/interview" className="flex items-center gap-3 border-ember/25 bg-ember-wash">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-ember">
              <MicIcon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink">Ярилцлага эхлүүлэх</span>
              <span className="block text-sm text-ink-soft">
                Өвөө эмээгийнхээ дуу хоолойг үүрд хадгалж үлдээе.
              </span>
            </span>
            <ChevronRightIcon className="shrink-0 text-ember" size={18} />
          </LinkCard>
        </section>
      ) : null}

      <section className="mb-6">
        <SectionHeading
          title="Сүүлийн дурсамж"
          action={
            <Link href="/memories/new" className="inline-flex items-center gap-0.5 text-sm font-medium text-ember">
              <PlusIcon size={16} /> Нэмэх
            </Link>
          }
        />
        {home.recentMemories.length === 0 ? (
          <EmptyState
            icon={<ArchiveIcon size={30} />}
            title="Дурсамж хараахан алга"
            description="Хуучин зураг, захидал, дуу хоолой, эсвэл ярьж өгсөн түүхээ нэмээрэй."
            action={{ label: 'Дурсамж нэмэх', href: '/memories/new' }}
          />
        ) : (
          <ul className="space-y-2.5">
            {home.recentMemories.map((memory) => (
              <li key={memory.id}>
                <LinkCard href={`/memories/${memory.id}`}>
                  <p className="font-medium text-ink">{memory.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                    {memory.description ?? memory.body ?? ''}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <Badge tone="gold">{memoryTypeLabel(memory.type)}</Badge>
                    <span>{memory.contributor_name}</span>
                    {memory.memory_date ? (
                      <span>· {formatDate(memory.memory_date, memory.date_precision)}</span>
                    ) : null}
                  </p>
                </LinkCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      {timeline.length > 0 ? (
        <section className="mb-6">
          <SectionHeading
            title="Гэр бүлийн он цагийн хэлхээс"
            action={
              <Link href="/family/timeline" className="inline-flex items-center gap-0.5 text-sm font-medium text-ember">
                Бүгд <ChevronRightIcon size={16} />
              </Link>
            }
          />
          <Card className="space-y-0 p-0">
            <ul className="divide-y divide-line">
              {timeline.map((entry) => (
                <li key={entry.id} className="flex items-baseline gap-3 px-4 py-3">
                  <span className="w-12 shrink-0 font-display text-sm text-gold">
                    {yearOf(entry.date) || '—'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{entry.title}</span>
                  </span>
                  {entry.isUnconfirmedAi ? <Badge tone="ember">Батлагдаагүй</Badge> : null}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {activity.length > 0 ? (
        <section>
          <SectionHeading title="Гэр бүлийн идэвх" subtitle="Хэн юу нэмснийг харуулна" />
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {activity.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
                  <ClockIcon size={16} className="mt-0.5 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">{entry.action}</span>
                    <span className="block text-xs text-muted">
                      {entry.actor_name ? `${entry.actor_name} · ` : ''}
                      {relativeTime(entry.created_at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </main>
  );
}

function memoryTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    story: 'Түүх', photo: 'Зураг', video: 'Видео', audio: 'Дуу хоолой',
    document: 'Баримт', letter: 'Захидал', recipe: 'Хоолны жор',
    tradition: 'Уламжлал', event: 'Үйл явдал', note: 'Тэмдэглэл',
  };
  return labels[type] ?? type;
}
