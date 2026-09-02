import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireActiveFamily } from '@/lib/family-context';
import { getPersonProfile, getPersonPhotoWall } from '@/lib/data/people';
import { getFamilyIndex } from '@/lib/data/family';
import { getSignedUrls } from '@/lib/media/storage';
import { describeRelationship } from '@/lib/kinship';
import {
  getChildren, getParents, getPartners, getSiblings, getGrandparents, getGrandchildren,
} from '@/lib/relationships/graph';
import { AppHeader } from '@/components/nav/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, ProvenanceBadge } from '@/components/ui/Badge';
import { Card, SectionHeading } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { PersonTimeline } from '@/components/person/PersonTimeline';
import { PeopleStrip } from '@/components/person/PeopleStrip';
import { AppearanceSection } from '@/components/person/AppearanceSection';
import { VoiceSection } from '@/components/person/VoiceSection';
import { PhotoWall } from '@/components/media/PhotoWall';
import { displayName, fullName, formatDate, lifespan } from '@/lib/format';
import { MapPinIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

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

  const { person } = profile;
  const locale = membership.family.default_locale;

  // How the VIEWER is related to this person — the question people open a
  // profile to answer.
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

  return (
    <>
      <AppHeader
        title={displayName(person)}
        subtitle={lifespan(person) || undefined}
        backHref="/family/tree"
        action={
          <Link
            href={`/person/${id}/edit`}
            className="min-h-10 rounded-full border border-line px-3.5 text-sm leading-10 text-ink-soft"
          >
            Засах
          </Link>
        }
      />

      <main id="main" className="px-4 pb-8 pt-5">
        {/* ---- identity ---- */}
        <section className="mb-6 flex flex-col items-center text-center">
          <Avatar
            person={person}
            photoUrl={profilePhoto ? photoUrls.get(profilePhoto.storage_path) : null}
            size="xl"
          />
          <h2 className="mt-3 font-display text-2xl leading-tight text-ink">{fullName(person)}</h2>
          {person.nickname ? <p className="text-sm text-muted">«{person.nickname}»</p> : null}

          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {person.generation ? <Badge tone="neutral">{person.generation}-р үе</Badge> : null}
            {person.life_status === 'deceased' ? <Badge tone="neutral">Таалал төгссөн</Badge> : null}
            {person.occupation ? <Badge tone="sage">{person.occupation}</Badge> : null}
          </div>

          {relationship ? (
            <div className="mt-4 w-full rounded-2xl bg-ember-wash px-4 py-3 text-left">
              <p className="text-sm font-medium text-ember">
                Таны {relationship.term.label.toLocaleLowerCase('mn-MN')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
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
              {relationship.term.alternates?.length ? (
                <p className="mt-0.5 text-xs text-muted">
                  Бас: {relationship.term.alternates.join(', ')}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* ---- facts ---- */}
        <section className="mb-6">
          <Card className="p-0">
            <dl className="divide-y divide-line">
              <Fact label="Төрсөн" value={formatDate(person.birth_date, person.birth_date_precision, locale)} />
              <Fact
                label="Төрсөн газар"
                value={profile.birthPlace?.name ?? ''}
                icon={<MapPinIcon size={15} />}
              />
              <Fact label="Таалал төгссөн" value={formatDate(person.death_date, person.death_date_precision, locale)} />
              <Fact label="Мэргэжил" value={person.occupation ?? ''} />
              <Fact label="Боловсрол" value={person.education ?? ''} />
            </dl>
          </Card>

          {person.biography ? (
            <Card className="mt-3">
              <h3 className="font-display text-base text-ink">Намтар</h3>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                {person.biography}
              </p>
            </Card>
          ) : null}
        </section>

        {/* ---- family ---- */}
        <section className="mb-6">
          <SectionHeading title="Гэр бүл" />
          <div className="space-y-3">
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
            <ul className="mt-3 space-y-2">
              {profile.couples.map((couple) => {
                const partnerId = couple.person_a_id === id ? couple.person_b_id : couple.person_a_id;
                const partner = partnerId ? index.people.get(partnerId) : null;
                return (
                  <li key={couple.id}>
                    <Link
                      href={`/couple/${couple.id}`}
                      className="card flex items-center gap-3 p-3.5"
                    >
                      <Avatar person={person} size="xs" />
                      <span className="text-ember">♥</span>
                      <Avatar person={partner} size="xs" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {displayName(person)} ❤ {partner ? displayName(partner) : 'Тодорхойгүй'}
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

        {/* ---- voice ---- */}
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

        {/* ---- appearance ---- */}
        <AppearanceSection
          personId={id}
          personName={displayName(person)}
          descriptions={profile.appearance}
          hasPhotos={photoWall.length > 0}
        />

        {/* ---- photos ---- */}
        <section className="mb-6">
          <SectionHeading
            title="Зургууд"
            subtitle={photoWall.length > 0 ? `${photoWall.length} зураг` : undefined}
          />
          {photoWall.length === 0 ? (
            <EmptyState
              title="Зураг алга"
              description="Хуучин зураг оруулаад энэ хүнийг тэмдэглэвэл зураг нь энд автоматаар харагдана."
              action={{ label: 'Зураг нэмэх', href: '/memories/new?type=photo' }}
            />
          ) : (
            <PhotoWall
              photos={photoWall.map((media) => ({
                id: media.id,
                url: photoUrls.get(media.storage_path) ?? null,
                caption: media.caption,
                variant: media.variant,
                takenAt: media.taken_at,
              }))}
            />
          )}
        </section>

        {/* ---- timeline ---- */}
        <section className="mb-6">
          <SectionHeading title="Он цагийн хэлхээс" />
          <PersonTimeline entries={profile.timeline} locale={locale} />
        </section>

        {/* ---- places ---- */}
        {profile.places.length > 0 ? (
          <section className="mb-6">
            <SectionHeading title="Амьдарч байсан газрууд" />
            <Card className="p-0">
              <ul className="divide-y divide-line">
                {profile.places.map((place) => (
                  <li key={place.id} className="flex items-center gap-3 px-4 py-3">
                    <MapPinIcon size={16} className="shrink-0 text-gold" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">
                        {place.location?.name ?? 'Тодорхойгүй газар'}
                      </span>
                      <span className="block text-xs text-muted">
                        {[place.from_date?.slice(0, 4), place.to_date?.slice(0, 4)].filter(Boolean).join(' – ')}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}

        {/* ---- memories ---- */}
        <section>
          <SectionHeading
            title="Дурсамжууд"
            action={
              <Link href={`/memories/new?person=${id}`} className="text-sm font-medium text-ember">
                Нэмэх
              </Link>
            }
          />
          {profile.memories.length === 0 ? (
            <EmptyState
              title="Дурсамж хараахан алга"
              description={`${displayName(person)}-ийн тухай санаж байгаа зүйлээ бичиж үлдээгээрэй.`}
              action={{ label: 'Дурсамж бичих', href: `/memories/new?person=${id}` }}
            />
          ) : (
            <ul className="space-y-2.5">
              {profile.memories.map((memory) => (
                <li key={memory.id}>
                  <Link href={`/memories/${memory.id}`} className="card block p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-ink">{memory.title}</p>
                      <ProvenanceBadge kind="family_memory" />
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {memory.description ?? memory.body ?? ''}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      {memory.contributor_name}
                      {memory.memory_date ? ` · ${formatDate(memory.memory_date, memory.date_precision, locale)}` : ''}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

function Fact({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-3 px-4 py-3">
      <dt className="w-28 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-ink">
        {icon ? <span className="text-gold">{icon}</span> : null}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  );
}
