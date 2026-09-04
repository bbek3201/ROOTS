import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireActiveFamily } from '@/lib/family-context';
import { getPersonProfile, getPersonPhotoWall } from '@/lib/data/people';
import { getFamilyIndex } from '@/lib/data/family';
import { getPhotoTags, taggablePeople } from '@/lib/data/photo-tags';
import { getSignedUrls } from '@/lib/media/storage';
import { describeRelationship } from '@/lib/kinship';
import {
  getChildren, getParents, getPartners, getSiblings, getGrandparents, getGrandchildren,
} from '@/lib/relationships/graph';
import { Photo, PhotoOverlay } from '@/components/ui/Photo';
import { Display, Eyebrow, SectionLead } from '@/components/ui/Editorial';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/States';
import { PersonTimeline } from '@/components/person/PersonTimeline';
import { PeopleStrip } from '@/components/person/PeopleStrip';
import { AppearanceSection } from '@/components/person/AppearanceSection';
import { VoiceSection } from '@/components/person/VoiceSection';
import { PhotoWall } from '@/components/media/PhotoWall';
import { displayName, fullName, formatDate, lifespan } from '@/lib/format';
import { can } from '@/lib/auth/session';
import { ChevronLeftIcon, MapPinIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

/**
 * A person, not a record.
 *
 * The portrait fills the top of the screen at 4:5 with the name set over it,
 * which is the difference between opening a profile and opening a row. Under
 * it, the first thing shown is not a table of dates but how the viewer is
 * related to this person — that is the question someone actually opened the
 * page to answer.
 */
export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireActiveFamily();

  const profile = await getPersonProfile(id);
  // RLS returns nothing for another family's person, so this is both
  // "does not exist" and "not yours" — and it must look identical either way.
  if (!profile) notFound();

  const [index, photoWall] = await Promise.all([
    getFamilyIndex(membership.family_id),
    getPersonPhotoWall(id),
  ]);
  const photoTags = await getPhotoTags(photoWall.map((media) => media.id));

  const { person } = profile;
  const locale = membership.family.default_locale;

  const relationship = membership.person_id && membership.person_id !== id
    ? describeRelationship(index, membership.person_id, id, locale)
    : null;

  const parents = getParents(index, id);
  const partners = getPartners(index, id);
  const children = getChildren(index, id);
  const siblings = getSiblings(index, id);
  const grandparents = getGrandparents(index, id);
  const grandchildren = getGrandchildren(index, id);

  const photoUrls = await getSignedUrls([
    ...photoWall.map((media) => media.storage_path),
    ...profile.audio.map((media) => media.storage_path),
  ]);

  const profilePhoto = photoWall.find((media) => media.id === person.profile_photo_media_id)
    ?? photoWall[0];
  const portraitUrl = profilePhoto ? photoUrls.get(profilePhoto.storage_path) : null;
  const gallery = photoWall.filter((media) => media.id !== profilePhoto?.id);

  const facts = [
    { label: 'Төрсөн', value: formatDate(person.birth_date, person.birth_date_precision, locale) },
    { label: 'Төрсөн газар', value: profile.birthPlace?.name ?? '' },
    { label: 'Таалал төгссөн', value: formatDate(person.death_date, person.death_date_precision, locale) },
    { label: 'Мэргэжил', value: person.occupation ?? '' },
    { label: 'Боловсрол', value: person.education ?? '' },
  ].filter((fact) => fact.value);

  return (
    <main id="main" className="pb-12">
      <section className="relative">
        <Photo
          src={portraitUrl}
          alt={fullName(person)}
          ratio="portrait"
          rounded={false}
          priority
          initial={displayName(person).slice(0, 1)}
          className="rounded-b-4xl"
        >
          <PhotoOverlay className="p-6 pb-7">
            <Display size="xl" className="text-white">
              {fullName(person)}
            </Display>
            <p className="mt-2 text-sm text-white/80">
              {[lifespan(person), person.nickname ? `«${person.nickname}»` : null, person.occupation]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </PhotoOverlay>
        </Photo>

        <Link
          href="/family/tree"
          aria-label="Буцах"
          className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-md transition-colors hover:bg-black/40"
        >
          <ChevronLeftIcon size={19} />
        </Link>
        <Link
          href={`/person/${id}/edit`}
          className="absolute right-5 top-5 flex h-10 items-center rounded-pill bg-black/25 px-4 text-sm text-white backdrop-blur-md transition-colors hover:bg-black/40"
        >
          Засах
        </Link>
      </section>

      <div className="px-5">
        {relationship ? (
          <section className="mt-6 rounded-(--radius-card) bg-sage-wash px-5 py-4">
            <Eyebrow className="text-sage">Таны хэн бэ</Eyebrow>
            <p className="mt-1.5 font-display text-[1.35rem] leading-tight text-forest">
              Таны {relationship.term.label.toLocaleLowerCase('mn-MN')}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              {relationship.chain
                .map((step, position) => {
                  const name = displayName(index.people.get(step.personId));
                  return position === 0 ? `Би (${name})` : `${step.term.label} (${name})`;
                })
                .join(' → ')}
            </p>
            {relationship.term.note ? (
              <p className="mt-1.5 text-xs text-muted">{relationship.term.note}</p>
            ) : null}
          </section>
        ) : null}

        {person.biography ? (
          <section className="mt-8">
            <p className="measure whitespace-pre-line text-[1.05rem] leading-[1.75] text-ink">
              {person.biography}
            </p>
          </section>
        ) : null}

        {facts.length > 0 ? (
          <section className="mt-8">
            <dl className="divide-y divide-line/70">
              {facts.map((fact) => (
                <div key={fact.label} className="flex items-baseline gap-5 py-3">
                  <dt className="w-28 shrink-0 text-sm text-muted">{fact.label}</dt>
                  <dd className="min-w-0 flex-1 text-[0.95rem] text-ink">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <section className="mt-10">
          <SectionLead label="Холбоо" title="Гэр бүл" />
          <div className="space-y-4">
            <PeopleStrip label="Эцэг эх" people={parents} emptyHint="Эцэг эхийг нь нэмээгүй байна." />
            <PeopleStrip label="Өвөө эмээ" people={grandparents} />
            <PeopleStrip label="Ах дүү" people={siblings.full} />
            {siblings.half.length > 0 ? (
              <PeopleStrip label="Нэг талын ах дүү" people={siblings.half} />
            ) : null}
            <PeopleStrip label="Хань" people={partners} />
            <PeopleStrip label="Хүүхдүүд" people={children} />
            <PeopleStrip label="Ач зээ" people={grandchildren} />
          </div>

          {profile.couples.length > 0 ? (
            <ul className="mt-5 space-y-2.5">
              {profile.couples.map((couple) => {
                const partnerId = couple.person_a_id === id ? couple.person_b_id : couple.person_a_id;
                const partner = partnerId ? index.people.get(partnerId) : null;
                return (
                  <li key={couple.id}>
                    <Link
                      href={`/couple/${couple.id}`}
                      className="flex items-center gap-3 rounded-(--radius-card) bg-parchment-deep/50 px-4 py-3.5 transition-colors hover:bg-parchment-deep"
                    >
                      <Avatar person={person} size="sm" />
                      <span className="text-heart">♥</span>
                      <Avatar person={partner} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">
                          {displayName(person)} ба {partner ? displayName(partner) : 'Тодорхойгүй'}
                        </span>
                        <span className="block text-xs text-muted">
                          {couple.marriage_date
                            ? `${formatDate(couple.marriage_date, 'year', locale)}-д гэрлэсэн`
                            : 'Огноо тодорхойгүй'}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

        <div className="mt-10">
          <VoiceSection
            recordings={profile.audio.map((media) => ({
              id: media.id,
              url: photoUrls.get(media.storage_path) ?? null,
              caption: media.caption,
              createdAt: media.created_at,
              durationSeconds: media.duration_seconds,
            }))}
            personName={displayName(person)}
          />
        </div>

        <div className="mt-10">
          <AppearanceSection
            personId={id}
            personName={displayName(person)}
            descriptions={profile.appearance}
            hasPhotos={photoWall.length > 0}
          />
        </div>

        <section className="mt-10">
          <SectionLead
            label={photoWall.length > 0 ? `${photoWall.length} зураг` : undefined}
            title="Зургууд"
          />
          {gallery.length === 0 ? (
            <EmptyState
              title="Зураг алга"
              description="Хуучин зураг оруулаад энэ хүнийг тэмдэглэвэл зураг нь энд автоматаар харагдана."
              action={{ label: 'Зураг нэмэх', href: '/memories/new?type=photo' }}
            />
          ) : (
            <PhotoWall
              photos={gallery.map((media) => ({
                id: media.id,
                url: photoUrls.get(media.storage_path) ?? null,
                caption: media.caption,
                variant: media.variant,
                takenAt: media.taken_at,
                tags: photoTags.get(media.id) ?? [],
              }))}
              people={taggablePeople(index)}
              canTag={can(membership, 'contribute')}
            />
          )}
        </section>

        <section className="mt-10">
          <SectionLead label="Амьдрал" title="Он цагийн хэлхээс" />
          <PersonTimeline entries={profile.timeline} locale={locale} />
        </section>

        {profile.places.length > 0 ? (
          <section className="mt-10">
            <SectionLead label="Газар" title="Амьдарч байсан" />
            <ul className="divide-y divide-line/70">
              {profile.places.map((place) => (
                <li key={place.id} className="flex items-center gap-3 py-3">
                  <MapPinIcon size={16} className="shrink-0 text-sage" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.95rem] text-ink">
                      {place.location?.name ?? 'Тодорхойгүй газар'}
                    </span>
                    <span className="block text-xs text-muted">
                      {[place.from_date?.slice(0, 4), place.to_date?.slice(0, 4)].filter(Boolean).join(' – ')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-10">
          <SectionLead
            label="Түүхүүд"
            title="Дурсамжууд"
            action={<Link href={`/memories/new?person=${id}`}>Нэмэх</Link>}
          />
          {profile.memories.length === 0 ? (
            <EmptyState
              title="Дурсамж хараахан алга"
              description={`${displayName(person)}-ийн тухай санаж байгаа зүйлээ бичиж үлдээгээрэй.`}
              action={{ label: 'Дурсамж бичих', href: `/memories/new?person=${id}` }}
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
