import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActiveFamily } from '@/lib/family-context';
import { getMemory } from '@/lib/data/memories';
import { getSignedUrls } from '@/lib/media/storage';
import { getFamilyIndex } from '@/lib/data/family';
import { getPhotoTags, taggablePeople } from '@/lib/data/photo-tags';
import { can } from '@/lib/auth/session';
import { Photo, PhotoOverlay } from '@/components/ui/Photo';
import { Display, Eyebrow, SectionLead } from '@/components/ui/Editorial';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { PhotoWall } from '@/components/media/PhotoWall';
import { MediaAttachments } from '@/components/media/MediaAttachments';
import { displayName, formatDate, relativeTime } from '@/lib/format';
import { ChevronLeftIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

/**
 * One memory, laid out like a page in an album rather than a record in a table.
 *
 * The photograph comes first at full bleed, with only a back button over it;
 * the title, date and place follow underneath in the reading order of a printed
 * caption. The story keeps a 62ch measure because it is prose someone told, not
 * interface copy, and prose set to the full width of a phone is unreadable.
 */
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

  const [index, photoTags] = await Promise.all([
    getFamilyIndex(membership.family_id),
    getPhotoTags(photos.map((item) => item.id)),
  ]);

  const [cover, ...restPhotos] = photos;
  const coverUrl = cover ? urls.get(cover.storage_path) : null;

  const dateLine = memory.memory_date
    ? formatDate(memory.memory_date, memory.date_precision, locale)
    : null;

  return (
    <main id="main" className="pb-12">
      <section className="relative">
        <Photo
          src={coverUrl}
          alt={memory.title}
          ratio={cover ? 'hero' : 'wide'}
          rounded={false}
          priority
          initial={memory.title.slice(0, 1)}
          className="rounded-b-4xl"
        >
          {cover ? (
            <PhotoOverlay className="p-6">
              <Eyebrow className="text-white/70">
                {[dateLine, location?.name].filter(Boolean).join(' · ') || 'Дурсамж'}
              </Eyebrow>
            </PhotoOverlay>
          ) : null}
        </Photo>

        <Link
          href="/memories"
          aria-label="Буцах"
          className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-md transition-colors hover:bg-black/40"
        >
          <ChevronLeftIcon size={19} />
        </Link>
      </section>

      <article className="px-5">
        <header className="mt-7">
          {!cover ? (
            <Eyebrow>{[dateLine, location?.name].filter(Boolean).join(' · ') || 'Дурсамж'}</Eyebrow>
          ) : null}
          <Display size="lg" className="mt-2">
            {memory.title}
          </Display>
          {cover ? (
            <p className="mt-3 text-sm text-muted">
              {[dateLine, location?.name].filter(Boolean).join(' · ')}
            </p>
          ) : null}
          {memory.is_private ? (
            <div className="mt-3">
              <Badge tone="neutral">Зөвхөн би ба админ</Badge>
            </div>
          ) : null}
        </header>

        {memory.description ? (
          <p className="measure mt-5 text-[1.05rem] leading-[1.7] text-ink-soft">{memory.description}</p>
        ) : null}

        {memory.body ? (
          <div className="measure mt-5 whitespace-pre-line text-[1.05rem] leading-[1.75] text-ink">
            {memory.body}
          </div>
        ) : null}

        {people.length > 0 ? (
          <section className="mt-9">
            <Eyebrow className="mb-3">Энэ дурсамжид</Eyebrow>
            <div className="no-scrollbar -mx-5 flex gap-5 overflow-x-auto px-5">
              {people.map((person) => (
                <Link
                  key={`${person.id}-${person.role}`}
                  href={`/person/${person.id}`}
                  className="w-18 shrink-0 text-center"
                >
                  <Avatar person={person} size="lg" className="mx-auto" />
                  <span className="mt-2 block truncate text-xs text-ink">{displayName(person)}</span>
                  <span className="block truncate text-[0.7rem] text-muted">
                    {roleLabel(person.role)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {others.length > 0 ? (
          <section className="mt-9">
            <SectionLead label="Дуу хоолой, баримт" title="Хавсралт" />
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

        {restPhotos.length > 0 ? (
          <section className="mt-9">
            <SectionLead label={`${photos.length} зураг`} title="Бүх зураг" />
            <PhotoWall
              photos={restPhotos.map((item) => ({
                id: item.id,
                url: urls.get(item.storage_path) ?? null,
                caption: item.caption,
                variant: item.variant,
                takenAt: item.taken_at,
                tags: photoTags.get(item.id) ?? [],
              }))}
              people={taggablePeople(index)}
              canTag={can(membership, 'contribute')}
            />
          </section>
        ) : null}

        {/* Attribution is permanent: whoever gave this to the archive keeps
            their name on it, even if they later delete their account. */}
        <footer className="mt-10 border-t border-line/70 pt-5">
          <p className="text-sm text-ink-soft">
            <span className="font-medium text-ink">{memory.contributor_name}</span> архивт нэмсэн
          </p>
          <p className="mt-0.5 text-xs text-muted">{relativeTime(memory.created_at)}</p>
        </footer>
      </article>
    </main>
  );
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    subject: 'Гол дүр', present: 'Байсан', mentioned: 'Дурдагдсан',
    narrator: 'Ярьсан', author: 'Бичсэн', recipient: 'Хүлээн авсан',
  };
  return labels[role] ?? role;
}
