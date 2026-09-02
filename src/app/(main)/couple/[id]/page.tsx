import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActiveFamily } from '@/lib/family-context';
import { getCoupleProfile } from '@/lib/data/couples';
import { getCoupleTimeline } from '@/lib/data/timeline';
import { getSignedUrls } from '@/lib/media/storage';
import { can } from '@/lib/auth/session';
import { Photo, PhotoOverlay } from '@/components/ui/Photo';
import { Display, Eyebrow, SectionLead } from '@/components/ui/Editorial';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/States';
import { PhotoWall } from '@/components/media/PhotoWall';
import { AddChildForm } from '@/components/family/AddChildForm';
import { displayName, formatDate, lifespan, yearOf } from '@/lib/format';
import { ChevronLeftIcon, MapPinIcon } from '@/components/icons';
import type { PersonRow } from '@/types/database';

export const dynamic = 'force-dynamic';

/**
 * A couple.
 *
 * This is the load-bearing page of the whole product: in ROOTS a family is not
 * a list of individuals but a chain of couples, and a marriage has its own
 * photograph, its own dates, its own children and its own story. So it gets the
 * same treatment a person gets — a picture at full bleed and both names in
 * serif over it — rather than being a row on somebody's profile.
 *
 * The two portraits sit over the lower edge of the wedding photograph. When
 * there is no wedding photograph, they are the subject rather than a fallback,
 * which is the normal case for a couple married in 1962.
 */
export default async function CouplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireActiveFamily();

  const profile = await getCoupleProfile(id);
  if (!profile) notFound();

  const timeline = await getCoupleTimeline(id);
  const locale = membership.family.default_locale;

  const photos = profile.media.filter((media) => media.kind === 'photo');
  const photoUrls = await getSignedUrls(photos.map((media) => media.storage_path));

  const [partnerA, partnerB] = profile.partners;
  const [cover, ...restPhotos] = photos;
  const coverUrl = cover ? photoUrls.get(cover.storage_path) : null;

  const marriageYear = yearOf(profile.couple.marriage_date ?? profile.couple.relationship_start);
  const years = marriageYear ? Number(new Date().getFullYear()) - Number(marriageYear) : null;

  return (
    <main id="main" className="pb-12">
      <section className="relative">
        <Photo
          src={coverUrl}
          alt={`${displayName(partnerA)} ба ${partnerB ? displayName(partnerB) : ''}`}
          ratio="hero"
          rounded={false}
          priority
          initial="♥"
          className="rounded-b-4xl"
        >
          <PhotoOverlay className="p-6 pb-7">
            <Eyebrow className="text-white/70">
              {relationshipTypeLabel(profile.couple.relationship_type)}
              {marriageYear ? ` · ${marriageYear}` : ''}
            </Eyebrow>
            <Display size="lg" className="mt-2 text-white">
              {displayName(partnerA)} <span className="text-heart">♥</span>{' '}
              {partnerB ? displayName(partnerB) : 'Тодорхойгүй'}
            </Display>
          </PhotoOverlay>
        </Photo>

        <Link
          href="/family/tree"
          aria-label="Буцах"
          className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-md transition-colors hover:bg-black/40"
        >
          <ChevronLeftIcon size={19} />
        </Link>
      </section>

      <div className="px-5">
        {/* ---- the two of them ------------------------------------------ */}
        <section className="mt-7 flex items-start justify-center gap-8">
          <PartnerColumn person={partnerA} />
          <span aria-hidden="true" className="pt-7 text-xl text-heart">♥</span>
          <PartnerColumn person={partnerB} />
        </section>

        {/* ---- the numbers that matter ---------------------------------- */}
        <section className="mt-8 grid grid-cols-3 divide-x divide-line/70 text-center">
          <Stat value={String(profile.children.length)} label="Хүүхэд" />
          <Stat
            value={years !== null && years >= 0 ? String(years) : '—'}
            label={years !== null && years >= 0 ? 'Жил хамт' : 'Огноо тодорхойгүй'}
          />
          <Stat value={String(profile.memories.length)} label="Дурсамж" />
        </section>

        {profile.marriagePlace || profile.couple.status !== 'unknown' ? (
          <p className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
            {profile.marriagePlace ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPinIcon size={14} className="text-sage" />
                {profile.marriagePlace.name}
              </span>
            ) : null}
            {profile.couple.status !== 'unknown' ? (
              <span>{statusLabel(profile.couple.status)}</span>
            ) : null}
          </p>
        ) : null}

        {/* ---- how they met --------------------------------------------- */}
        {profile.couple.story ? (
          <section className="mt-9">
            <SectionLead label="Бидний түүх" title="Хэрхэн танилцсан бэ" />
            <p className="measure whitespace-pre-line text-[1.05rem] leading-[1.75] text-ink">
              {profile.couple.story}
            </p>
          </section>
        ) : null}

        {/* ---- children -------------------------------------------------- */}
        <section className="mt-10">
          <SectionLead
            label={profile.children.length > 0 ? `${profile.children.length} хүүхэд` : undefined}
            title="Хүүхдүүд"
          />
          {profile.children.length === 0 ? (
            <EmptyState
              title="Хүүхэд бүртгэгдээгүй"
              description="Хүүхэд нэмэхэд эцэг эх, ах дүү, өвөө эмээгийн хамаарал автоматаар үүснэ."
            />
          ) : (
            <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5">
              {profile.children.map((child) => (
                <ChildCard key={child.id} person={child} />
              ))}
            </div>
          )}

          {can(membership, 'edit') ? <AddChildForm coupleId={id} className="mt-5" /> : null}
        </section>

        {profile.grandchildren.length > 0 ? (
          <section className="mt-10">
            <SectionLead label={`${profile.grandchildren.length} хүн`} title="Ач зээ нар" />
            <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5">
              {profile.grandchildren.map((child) => (
                <ChildCard key={child.id} person={child} />
              ))}
            </div>
          </section>
        ) : null}

        {/* ---- shared photographs ---------------------------------------- */}
        {restPhotos.length > 0 ? (
          <section className="mt-10">
            <SectionLead label={`${photos.length} зураг`} title="Хамтын зургууд" />
            <PhotoWall
              photos={restPhotos.map((media) => ({
                id: media.id,
                url: photoUrls.get(media.storage_path) ?? null,
                caption: media.caption,
                variant: media.variant,
                takenAt: media.taken_at,
              }))}
            />
          </section>
        ) : null}

        {/* ---- their years together --------------------------------------- */}
        <section className="mt-10">
          <SectionLead label="Хамтдаа" title="Он цагийн хэлхээс" />
          {timeline.length === 0 ? (
            <EmptyState
              title="Үйл явдал бүртгэгдээгүй"
              description="Гэрлэсэн он, нүүсэн газар, чухал үйл явдлаа нэмээрэй."
            />
          ) : (
            <ul className="divide-y divide-line/70">
              {timeline.map((entry) => (
                <li key={entry.id} className="flex items-baseline gap-5 py-3.5">
                  <span className="w-12 shrink-0 font-display text-[1.05rem] text-sage">
                    {yearOf(entry.date) || '—'}
                  </span>
                  <span className="min-w-0 flex-1 text-[0.95rem] text-ink">{entry.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- memories ---------------------------------------------------- */}
        <section className="mt-10">
          <SectionLead
            label="Хамтын"
            title="Дурсамжууд"
            action={<Link href={`/memories/new?couple=${id}`}>Нэмэх</Link>}
          />
          {profile.memories.length === 0 ? (
            <EmptyState
              title="Дурсамж алга"
              description="Хуримын зураг, хамт өнгөрүүлсэн жилүүдийн тухай дурсамжаа нэмээрэй."
              action={{ label: 'Дурсамж нэмэх', href: `/memories/new?couple=${id}` }}
            />
          ) : (
            <ul className="divide-y divide-line/70">
              {profile.memories.map((memory) => (
                <li key={memory.id}>
                  <Link href={`/memories/${memory.id}`} className="block py-4">
                    <p className="font-display text-[1.1rem] leading-snug text-ink">{memory.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
                      {memory.description ?? memory.body ?? ''}
                    </p>
                    <p className="mt-1.5 text-xs text-muted">
                      {memory.contributor_name}
                      {memory.memory_date
                        ? ` · ${formatDate(memory.memory_date, memory.date_precision, locale)}`
                        : ''}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function PartnerColumn({ person }: { person: PersonRow | undefined }) {
  const body = (
    <>
      <Avatar person={person ?? null} size="lg" className="mx-auto" />
      <span className="mt-2.5 block font-display text-[1.05rem] text-ink">
        {person ? displayName(person) : 'Тодорхойгүй'}
      </span>
      <span className="block text-xs text-muted">{person ? lifespan(person) : ''}</span>
    </>
  );
  return person ? (
    <Link href={`/person/${person.id}`} className="w-28 text-center">
      {body}
    </Link>
  ) : (
    <div className="w-28 text-center">{body}</div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-2">
      <p className="font-display text-[1.6rem] leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-xs text-muted">{label}</p>
    </div>
  );
}

function ChildCard({ person }: { person: PersonRow }) {
  return (
    <Link href={`/person/${person.id}`} className="w-24 shrink-0 text-center">
      <Avatar person={person} size="lg" className="mx-auto" />
      <span className="mt-2 block truncate text-sm text-ink">{displayName(person)}</span>
      <span className="block text-xs text-muted">{yearOf(person.birth_date) || ''}</span>
    </Link>
  );
}

function relationshipTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    marriage: 'Гэрлэсэн', partnership: 'Хамтран амьдарсан', engagement: 'Сүй тавьсан', unknown: 'Хос',
  };
  return labels[type] ?? type;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    together: 'Хамт', separated: 'Тусдаа', divorced: 'Салсан',
    widowed: 'Бэлэвсэн', ended: 'Дууссан', unknown: 'Тодорхойгүй',
  };
  return labels[status] ?? status;
}
