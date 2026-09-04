import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActiveFamily } from '@/lib/family-context';
import { getCoupleProfile } from '@/lib/data/couples';
import { getCoupleTimeline } from '@/lib/data/timeline';
import { getSignedUrls } from '@/lib/media/storage';
import { can } from '@/lib/auth/session';
import { AppHeader } from '@/components/nav/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card, SectionHeading } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { PeopleStrip } from '@/components/person/PeopleStrip';
import { PhotoWall } from '@/components/media/PhotoWall';
import { AddChildForm } from '@/components/family/AddChildForm';
import { displayName, formatDate, lifespan, yearOf } from '@/lib/format';
import { MapPinIcon } from '@/components/icons';
import type { PersonNode } from '@/lib/relationships/types';

export const dynamic = 'force-dynamic';

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
  const title = `${displayName(partnerA)} ❤ ${partnerB ? displayName(partnerB) : 'Тодорхойгүй'}`;

  const marriageYear = yearOf(profile.couple.marriage_date ?? profile.couple.relationship_start);

  return (
    <>
      <AppHeader title={title} subtitle={marriageYear ? `${marriageYear} оноос` : undefined} backHref="/family/tree" />

      <main id="main" className="px-4 pb-8 pt-5">
        {/* ---- the couple ---- */}
        <section className="mb-6">
          <Card className="flex flex-col items-center py-6 text-center">
            <div className="flex items-center gap-4">
              <Link href={`/person/${partnerA?.id}`} className="flex flex-col items-center gap-1.5">
                <Avatar person={partnerA} size="lg" />
                <span className="text-sm font-medium text-ink">{displayName(partnerA)}</span>
                <span className="text-xs text-muted">{partnerA ? lifespan(partnerA) : ''}</span>
              </Link>

              <span className="pb-8 text-2xl text-heart" aria-label="хосууд">♥</span>

              {partnerB ? (
                <Link href={`/person/${partnerB.id}`} className="flex flex-col items-center gap-1.5">
                  <Avatar person={partnerB} size="lg" />
                  <span className="text-sm font-medium text-ink">{displayName(partnerB)}</span>
                  <span className="text-xs text-muted">{lifespan(partnerB)}</span>
                </Link>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <Avatar person={null} size="lg" />
                  <span className="text-sm text-muted">Тодорхойгүй</span>
                </div>
              )}
            </div>

            <p className="mt-5 text-sm text-ink-soft">
              {[
                profile.couple.marriage_date
                  ? `${formatDate(profile.couple.marriage_date, 'year', locale)}-д гэрлэсэн`
                  : null,
                profile.children.length > 0 ? `${profile.children.length} хүүхэд` : null,
                profile.grandchildren.length > 0 ? `${profile.grandchildren.length} ач зээ` : null,
              ].filter(Boolean).join(' · ') || 'Огноо бүртгэгдээгүй'}
            </p>

            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              <Badge tone="olive">{relationshipTypeLabel(profile.couple.relationship_type)}</Badge>
              {profile.couple.status !== 'unknown' ? (
                <Badge tone="neutral">{statusLabel(profile.couple.status)}</Badge>
              ) : null}
              {profile.marriagePlace ? (
                <Badge tone="neutral" icon={<MapPinIcon size={12} />}>{profile.marriagePlace.name}</Badge>
              ) : null}
            </div>
          </Card>

          {profile.couple.story ? (
            <Card className="mt-3">
              <h3 className="font-display text-base text-ink">Хэрхэн танилцсан бэ</h3>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                {profile.couple.story}
              </p>
            </Card>
          ) : null}
        </section>

        {/* ---- children ---- */}
        <section className="mb-6">
          <SectionHeading title="Хүүхдүүд" subtitle={`${profile.children.length} хүүхэд`} />
          {profile.children.length === 0 ? (
            <EmptyState
              title="Хүүхэд бүртгэгдээгүй"
              description="Хүүхэд нэмэхэд эцэг эх, ах дүү, өвөө эмээгийн хамаарал автоматаар үүснэ."
            />
          ) : (
            <PeopleStrip label="" people={profile.children as unknown as PersonNode[]} />
          )}

          {can(membership, 'edit') ? (
            // The id is the target of "Хүүхэд нэмэх" in the tree's detail
            // panel, so that link lands on the form rather than on the page.
            <div id="add-child" className="scroll-mt-24">
              <AddChildForm coupleId={id} className="mt-3" />
            </div>
          ) : null}
        </section>

        {profile.grandchildren.length > 0 ? (
          <section className="mb-6">
            <SectionHeading title="Ач зээ нар" subtitle={`${profile.grandchildren.length} хүн`} />
            <PeopleStrip label="" people={profile.grandchildren as unknown as PersonNode[]} />
          </section>
        ) : null}

        {/* ---- shared photos ---- */}
        {photos.length > 0 ? (
          <section className="mb-6">
            <SectionHeading title="Хосын зургууд" />
            <PhotoWall
              photos={photos.map((media) => ({
                id: media.id,
                url: photoUrls.get(media.storage_path) ?? null,
                caption: media.caption,
                variant: media.variant,
                takenAt: media.taken_at,
              }))}
            />
          </section>
        ) : null}

        {/* ---- timeline ---- */}
        <section className="mb-6">
          <SectionHeading title="Хамтын он цагийн хэлхээс" />
          {timeline.length === 0 ? (
            <EmptyState title="Үйл явдал бүртгэгдээгүй" description="Гэрлэсэн он, нүүсэн газар, чухал үйл явдлаа нэмээрэй." />
          ) : (
            <Card className="p-0">
              <ol className="divide-y divide-line">
                {timeline.map((entry) => (
                  <li key={entry.id} className="flex items-baseline gap-3 px-4 py-3">
                    <span className="w-12 shrink-0 font-display text-sm text-olive">
                      {yearOf(entry.date) || '—'}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-ink">{entry.title}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </section>

        {/* ---- places ---- */}
        {profile.places.length > 0 ? (
          <section className="mb-6">
            <SectionHeading title="Амьдарч байсан газрууд" />
            <div className="flex flex-wrap gap-1.5">
              {profile.places.map((place) => (
                <Badge key={place.id} tone="neutral" icon={<MapPinIcon size={12} />}>{place.name}</Badge>
              ))}
            </div>
          </section>
        ) : null}

        {/* ---- memories ---- */}
        <section>
          <SectionHeading
            title="Хамтын дурсамжууд"
            action={
              <Link href={`/memories/new?couple=${id}`} className="text-sm font-medium text-forest">
                Нэмэх
              </Link>
            }
          />
          {profile.memories.length === 0 ? (
            <EmptyState
              title="Дурсамж алга"
              description="Хуримын зураг, хамт өнгөрүүлсэн жилүүдийн тухай дурсамжаа нэмээрэй."
              action={{ label: 'Дурсамж нэмэх', href: `/memories/new?couple=${id}` }}
            />
          ) : (
            <ul className="space-y-2.5">
              {profile.memories.map((memory) => (
                <li key={memory.id}>
                  <Link href={`/memories/${memory.id}`} className="card block p-4">
                    <p className="font-medium text-ink">{memory.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                      {memory.description ?? memory.body ?? ''}
                    </p>
                    <p className="mt-2 text-xs text-muted">{memory.contributor_name}</p>
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

function relationshipTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    marriage: 'Гэрлэсэн', partnership: 'Хамтран амьдарсан', engagement: 'Сүй тавьсан', unknown: 'Тодорхойгүй',
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
