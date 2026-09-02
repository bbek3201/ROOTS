import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActiveFamily } from '@/lib/family-context';
import { getMemory } from '@/lib/data/memories';
import { getSignedUrls } from '@/lib/media/storage';
import { AppHeader } from '@/components/nav/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, ProvenanceBadge } from '@/components/ui/Badge';
import { Card, SectionHeading } from '@/components/ui/Card';
import { PhotoWall } from '@/components/media/PhotoWall';
import { MediaAttachments } from '@/components/media/MediaAttachments';
import { displayName, formatDate, relativeTime } from '@/lib/format';
import { MapPinIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function MemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireActiveFamily();

  const detail = await getMemory(id);
  if (!detail) notFound();

  const { memory, people, media, location } = detail;
  const locale = membership.family.default_locale;

  const urls = await getSignedUrls(media.map((item) => item.storage_path));
  const photos = media.filter((item) => item.kind === 'photo');
  const others = media.filter((item) => item.kind !== 'photo');

  return (
    <>
      <AppHeader title={memory.title} backHref="/memories" />

      <main id="main" className="px-4 pb-8 pt-5">
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <ProvenanceBadge kind="family_memory" />
          {memory.is_private ? <Badge tone="neutral">Хувийн</Badge> : null}
          {location ? (
            <Badge tone="neutral" icon={<MapPinIcon size={12} />}>{location.name}</Badge>
          ) : null}
          {memory.memory_date ? (
            <Badge tone="neutral">{formatDate(memory.memory_date, memory.date_precision, locale)}</Badge>
          ) : null}
        </div>

        {memory.description ? (
          <p className="mb-4 text-base leading-relaxed text-ink-soft">{memory.description}</p>
        ) : null}

        {photos.length > 0 ? (
          <section className="mb-5">
            <PhotoWall
              photos={photos.map((item) => ({
                id: item.id,
                url: urls.get(item.storage_path) ?? null,
                caption: item.caption,
                variant: item.variant,
                takenAt: item.taken_at,
              }))}
            />
          </section>
        ) : null}

        {memory.body ? (
          <Card className="mb-5">
            <p className="whitespace-pre-line text-[0.98rem] leading-relaxed text-ink">{memory.body}</p>
          </Card>
        ) : null}

        {others.length > 0 ? (
          <section className="mb-5">
            <SectionHeading title="Хавсаргасан файлууд" />
            <MediaAttachments
              items={others.map((item) => ({
                id: item.id,
                kind: item.kind,
                url: urls.get(item.storage_path) ?? null,
                caption: item.caption ?? item.original_filename,
                sizeBytes: item.size_bytes,
                durationSeconds: item.duration_seconds,
                isOriginal: item.variant === 'original',
              }))}
            />
          </section>
        ) : null}

        {people.length > 0 ? (
          <section className="mb-5">
            <SectionHeading title="Энэ дурсамжид холбогдох хүмүүс" />
            <ul className="space-y-2">
              {people.map((person) => (
                <li key={`${person.id}-${person.role}`}>
                  <Link href={`/person/${person.id}`} className="card flex items-center gap-3 p-3">
                    <Avatar person={person} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {displayName(person)}
                      </span>
                      <span className="block text-xs text-muted">{roleLabel(person.role)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Attribution is permanent: whoever gave this to the archive keeps
            their name on it, even if they later delete their account. */}
        <Card className="border-gold/25 bg-gold-wash">
          <p className="text-sm text-ink-soft">
            Энэ дурсамжийг <strong className="font-medium text-ink">{memory.contributor_name}</strong>{' '}
            архивт нэмсэн.
          </p>
          <p className="mt-0.5 text-xs text-muted">{relativeTime(memory.created_at)}</p>
        </Card>
      </main>
    </>
  );
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    subject: 'Гол дүр', present: 'Байсан', mentioned: 'Дурдагдсан',
    narrator: 'Ярьсан', author: 'Бичсэн', recipient: 'Хүлээн авсан',
  };
  return labels[role] ?? role;
}
