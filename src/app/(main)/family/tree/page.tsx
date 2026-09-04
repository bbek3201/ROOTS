import Link from 'next/link';
import { requireActiveFamily } from '@/lib/family-context';
import { can } from '@/lib/auth/session';
import { getFamilyGraph, getMediaPaths } from '@/lib/data/family';
import { getCoupleArchive } from '@/lib/data/couples';
import { getSignedUrls } from '@/lib/media/storage';
import { EmptyState } from '@/components/ui/States';
import { TreeIcon } from '@/components/icons';
import { FamilyCoverButton } from '@/components/family/FamilyCoverButton';
import { FamilyStoryEditor } from '@/components/family/FamilyStoryEditor';
import { FamilyTreeScreen } from '@/components/tree/FamilyTreeScreen';
import type { CoupleArchive } from '@/components/tree/FamilyTree';
import { yearOf } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * The family tree — the centre of the product.
 *
 * The page opens on a photograph of the whole family, because that is what the
 * tree below it is a diagram OF. A map of relationships is a beautiful thing to
 * navigate and a cold thing to arrive at; a picture of everyone at the reunion,
 * with the family's name over it, says what the archive is before a single card
 * is read.
 *
 * Under the cover the canvas is FRAMED rather than full-bleed. A pan-and-zoom
 * surface that fills the viewport swallows the page's scroll on a phone — every
 * finger lands inside it — so the tree keeps paper visible around it, and the
 * viewer takes it full screen deliberately when they want to get lost in it.
 *
 * Everything expensive happens here, once: the graph, every portrait and every
 * couple's archive counts are resolved in one signing round trip, and the
 * canvas below is handed a finished view model.
 */
export default async function FamilyTreePage() {
  const membership = await requireActiveFamily();
  const familyId = membership.family_id;
  // Two different rights: an editor curates the photograph, but the family's
  // NAME and its story are the archive's own words about itself, and changing
  // those belongs to whoever opened it — the same rule the families table's own
  // policy enforces, so the button and the database agree.
  const canCurate = can(membership, 'edit');
  const canAdminister = can(membership, 'administer');
  const story = membership.family.description?.trim() ?? '';

  const [graph, archive] = await Promise.all([getFamilyGraph(familyId), getCoupleArchive(familyId)]);

  const coverPaths = await getMediaPaths([membership.family.cover_media_id]);
  const portraitPaths = await getMediaPaths(graph.people.map((person) => person.profile_photo_media_id));
  const previewPaths = [...archive.values()].flatMap((summary) => summary.previewPaths);

  const signed = await getSignedUrls([
    ...coverPaths.values(),
    ...portraitPaths.values(),
    ...previewPaths,
  ]);

  const coverPath = membership.family.cover_media_id
    ? coverPaths.get(membership.family.cover_media_id)
    : null;
  const coverUrl = coverPath ? (signed.get(coverPath) ?? null) : null;

  const photoUrls: Record<string, string> = {};
  for (const person of graph.people) {
    const path = person.profile_photo_media_id ? portraitPaths.get(person.profile_photo_media_id) : null;
    const url = path ? signed.get(path) : null;
    if (url) photoUrls[person.id] = url;
  }

  const coupleArchive: Record<string, CoupleArchive> = {};
  for (const [coupleId, summary] of archive) {
    coupleArchive[coupleId] = {
      stories: summary.stories,
      photos: summary.photos,
      recordings: summary.recordings,
      previews: summary.previewPaths
        .map((path) => signed.get(path))
        .filter((url): url is string => Boolean(url)),
    };
  }

  const generations = new Set(graph.people.map((person) => person.generation ?? 0)).size;
  const span = lifeSpanOfFamily(graph.people);

  return (
    <main id="main">
      {/* ================= The family, in one photograph =================== */}
      <section className="relative">
        <div className="relative isolate flex min-h-[clamp(22rem,62svh,38rem)] items-end overflow-hidden">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires.
            <img
              src={coverUrl}
              alt={membership.family.name}
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-br from-[#f7f2e9] via-[#e7ecdf] to-[#cddbcf]"
            />
          )}

          <span
            aria-hidden="true"
            className={
              coverUrl
                ? 'absolute inset-0 bg-gradient-to-t from-[rgb(10_26_21/0.86)] via-[rgb(10_26_21/0.4)] to-transparent'
                : 'absolute inset-0 bg-gradient-to-t from-[rgb(255_252_248/0.92)] to-transparent'
            }
          />

          <div className="ed-shell relative w-full pb-12 pt-24 sm:pb-16">
            <p
              className={
                coverUrl
                  ? 'text-[0.7rem] font-medium uppercase tracking-[0.32em] text-[rgb(251_249_244/0.72)]'
                  : 'ed-eyebrow'
              }
            >
              {[
                `${graph.people.length} хүн`,
                `${generations || membership.family.visible_generations} үе`,
                span,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>

            <h1
              className={`ed-display ed-display-xl mt-5 max-w-[15ch] ${coverUrl ? 'text-[#fbf9f4]' : ''}`}
            >
              {membership.family.name}
            </h1>

            {story ? (
              <p className={`ed-lead mt-6 ${coverUrl ? 'text-[rgb(251_249_244/0.82)]' : ''}`}>
                {firstLine(story)}
              </p>
            ) : null}

            {canCurate || canAdminister ? (
              <div className="mt-8 flex flex-wrap items-start gap-2">
                {canCurate ? (
                  <FamilyCoverButton
                    familyId={familyId}
                    hasCover={Boolean(membership.family.cover_media_id)}
                  />
                ) : null}
                {canAdminister ? (
                  <FamilyStoryEditor
                    familyId={familyId}
                    name={membership.family.name}
                    story={story}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ================= The family's own words ========================== */}
      {story || canAdminister ? (
        <section className="ed-band-cream py-16 lg:py-24">
          <div className="ed-shell">
            <p className="ed-eyebrow">Гэр бүлийн түүх</p>

            {story ? (
              <>
                {/* `pre-line` keeps the paragraphs someone typed. A family
                    history is written in breaths, not in one block. */}
                <div className="mt-7 max-w-[62ch] whitespace-pre-line text-[1.08rem] leading-[1.75] text-[color-mix(in_srgb,#183b32_82%,transparent)]">
                  {story}
                </div>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  {canAdminister ? (
                    <FamilyStoryEditor
                      familyId={familyId}
                      name={membership.family.name}
                      story={story}
                      variant="onPaper"
                      label="Түүхийг засах"
                    />
                  ) : null}
                  <Link
                    href="/family/story"
                    className="text-[0.9rem] text-[#183b32] underline decoration-[color-mix(in_srgb,#183b32_25%,transparent)] underline-offset-8 transition-colors hover:decoration-[#183b32]"
                  >
                    Бүтнээр нь унших
                  </Link>
                </div>
              </>
            ) : (
              <div className="mt-7 max-w-[52ch]">
                <p className="ed-display ed-display-md">
                  Танайхны түүхийг хэн ч бичээгүй байна.
                </p>
                <p className="ed-lead mt-5">
                  Хаанаас гаралтай, хэнээс эхэлсэн, юугаараа онцлог вэ — хэдхэн өгүүлбэр
                  ч гэсэн үр хойчид үлдэнэ.
                </p>
                <div className="mt-7">
                  <FamilyStoryEditor
                    familyId={familyId}
                    name={membership.family.name}
                    story={story}
                    variant="onPaper"
                    label="Түүхийг бичих"
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* ================= The tree itself ================================= */}
      <section className="ed-shell py-14 lg:py-20">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="ed-eyebrow">Family tree</p>
            <h2 className="ed-display ed-display-lg mt-5 max-w-[18ch]">
              Хос бүрээс дараагийн үе.
            </h2>
          </div>
          <p className="ed-meta max-w-sm">
            Хосыг дарж дэлгэрэнгүйг үзнэ. Чирж, томруулж, үеийн дугаараар шилжинэ.
          </p>
        </header>

        {graph.people.length === 0 ? (
          <div className="mx-auto mt-12 max-w-md">
            <EmptyState
              icon={<TreeIcon size={30} />}
              title="Мод хоосон байна"
              description="Эхний хосоо нэмснээр гэр бүлийн мод ургаж эхэлнэ."
              action={{ label: 'Хүн нэмэх', href: '/family/add-person' }}
            />
          </div>
        ) : (
          <div className="ed-frame relative mt-12 h-[clamp(28rem,74svh,52rem)] border border-[color-mix(in_srgb,#183b32_10%,transparent)] bg-[#fffcf8]">
            <FamilyTreeScreen
              graph={graph}
              focusPersonId={membership.person_id}
              locale={membership.family.default_locale}
              visibleGenerations={membership.family.visible_generations}
              photoUrls={photoUrls}
              coupleArchive={coupleArchive}
            />
          </div>
        )}

        <p className="mt-8">
          <Link
            href="/timeline"
            className="text-[0.95rem] text-[#183b32] underline decoration-[color-mix(in_srgb,#183b32_25%,transparent)] underline-offset-8 transition-colors hover:decoration-[#183b32]"
          >
            Он цагийн хэлхээгээр үзэх
          </Link>
        </p>
      </section>
    </main>
  );
}

/**
 * The opening line of the story, for the cover.
 *
 * The whole history goes in the section below the photograph; over the
 * photograph it would fight the family's name, so only the first line stands
 * there — the way a caption sits under a plate rather than a chapter.
 */
function firstLine(story: string): string {
  const [opening = ''] = story.split(/\n+/);
  return opening.length > 190 ? `${opening.slice(0, 187).trimEnd()}…` : opening;
}

/** "1900 – өнөөдөр": the years this family's records actually cover. */
function lifeSpanOfFamily(people: Array<{ birth_date: string | null }>): string {
  const years = people
    .map((person) => yearOf(person.birth_date))
    .filter((year) => year !== '')
    .sort();
  const first = years[0];
  return first ? `${first} оноос` : '';
}
