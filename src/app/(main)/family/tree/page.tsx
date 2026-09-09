import { requireActiveFamily } from '@/lib/family-context';
import { can } from '@/lib/auth/session';
import { getFamilyGraph, getMediaPaths } from '@/lib/data/family';
import { getCoupleArchive } from '@/lib/data/couples';
import { getSignedUrls } from '@/lib/media/storage';
import { PagePlate } from '@/components/nav/AppShell';
import { Rail, RailCard, RailCta, RailRow } from '@/components/nav/Rail';
import { BookIcon, ImageIcon, MicIcon } from '@/components/icons';
import { FamilyCoverButton } from '@/components/family/FamilyCoverButton';
import { FamilyStoryEditor } from '@/components/family/FamilyStoryEditor';
import { FamilyTreeScreen } from '@/components/tree/FamilyTreeScreen';
import { HeritageTree, type HeritageLevel } from '@/components/tree/HeritageTree';
import type { CoupleArchive } from '@/components/tree/FamilyTree';
import { buildAncestry, buildFromRoots, deeperCount } from '@/lib/tree/heritage';
import { buildFamilyIndex } from '@/lib/relationships/graph';
import { displayName, lifespan, yearOf } from '@/lib/format';

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

  // One line describing the archive, said the same way wherever it appears.
  const familyMeta = [
    `${generations || membership.family.visible_generations} үе`,
    `${graph.people.length} хүн`,
    span,
  ]
    .filter(Boolean)
    .join(' · ');

  // ---- The lineage, read outward from whoever is looking -------------------
  // A member who has not been linked to a person in the tree still gets a view;
  // theirs runs oldest-first from the roots, because there is no "you" to walk
  // up from yet.
  const index = buildFamilyIndex(graph);
  const anchored = Boolean(membership.person_id);
  const bands = anchored
    ? buildAncestry(index, membership.person_id)
    : buildFromRoots(index);

  const levels: HeritageLevel[] = bands.map((band) => ({
    depth: band.depth,
    label: anchored ? BAND_LABELS[band.depth] ?? `${band.depth + 1}-р үе` : `${band.depth + 1}-р үе`,
    mark: BAND_MARKS[band.depth] ?? '🌿',
    cards: band.units.map((unit) => ({
      id: unit.id,
      href: unit.href,
      paired: unit.paired,
      people: unit.people.map((person) => ({
        id: person.id,
        name: displayName(person),
        years: lifespan(person),
        // Whatever the family actually recorded about them, in one line.
        note: person.occupation ?? null,
        photoUrl: photoUrls[person.id] ?? null,
        initial: displayName(person).slice(0, 1),
      })),
    })),
  }));

  return (
    <>
      <PagePlate>
        {/* =============== The family, in one photograph =================== */}
        {/* The tree below is a diagram OF this. A map of relationships is a
            beautiful thing to navigate and a cold thing to arrive at; the
            picture of everyone at the reunion, with the family's name over it,
            says what the archive is before a single card is read. */}
        <section className="relative isolate flex min-h-[clamp(16rem,42svh,26rem)] items-end overflow-hidden">
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
                ? 'absolute inset-0 bg-gradient-to-t from-[rgb(10_26_21/0.82)] via-[rgb(10_26_21/0.34)] to-transparent'
                : 'absolute inset-0 bg-gradient-to-t from-[rgb(255_252_248/0.92)] to-transparent'
            }
          />

          <div className="rt-gutters relative w-full pt-20 pb-8">
            <p
              className={
                coverUrl
                  ? 'text-[0.68rem] font-medium uppercase tracking-[0.3em] text-[rgb(251_249_244/0.74)]'
                  : 'ed-eyebrow'
              }
            >
              {familyMeta}
            </p>

            <h1
              className={`ed-display mt-3 text-[clamp(1.9rem,3vw,2.9rem)] ${coverUrl ? 'text-[#fbf9f4]' : ''}`}
            >
              {membership.family.name}
            </h1>

            {canCurate || canAdminister ? (
              <div className="mt-6 flex flex-wrap items-start gap-2">
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
        </section>

        {/* =============== The lineage ==================================== */}
        <HeritageTree
          levels={levels}
          deeper={deeperCount(index, bands)}
          canEdit={canCurate}
          hasStory={Boolean(story)}
          meta={familyMeta}
        >
          <FamilyTreeScreen
            graph={graph}
            focusPersonId={membership.person_id}
            locale={membership.family.default_locale}
            visibleGenerations={membership.family.visible_generations}
            photoUrls={photoUrls}
            coupleArchive={coupleArchive}
          />
        </HeritageTree>
      </PagePlate>

      {/* ================= The rail ======================================= */}
      {/* On the tree, the aside is the family's own words about itself. The
          diagram says how everyone is connected; only the story says why any
          of it matters, and buried under a canvas nobody scrolls to it. */}
      <Rail>
        <RailCard
          title="Гэр бүлийн түүх"
          href={story ? '/family/story' : undefined}
          linkLabel="Бүтнээр"
        >
          <div className="px-5 pb-5">
            {story ? (
              <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-ink-soft">
                {firstLine(story)}
              </p>
            ) : (
              <p className="text-[0.95rem] leading-relaxed text-ink-soft">
                Танайхны түүхийг хэн ч бичээгүй байна. Хаанаас гаралтай, хэнээс
                эхэлсэн — хэдхэн өгүүлбэр ч гэсэн үр хойчид үлдэнэ.
              </p>
            )}

            {canAdminister ? (
              <div className="mt-5">
                <FamilyStoryEditor
                  familyId={familyId}
                  name={membership.family.name}
                  story={story}
                  variant="onPaper"
                  label={story ? 'Түүхийг засах' : 'Түүхийг бичих'}
                />
              </div>
            ) : null}
          </div>
        </RailCard>

        <div className="rt-rail-card overflow-hidden">
          <RailRow href="/timeline" icon={BookIcon} title="Он цагийн хэлхээ" note={familyMeta} />
          <RailRow
            href="/interview"
            icon={MicIcon}
            title="Дуу хоолойн архив"
            note="Ахмадуудынхаа түүхийг сонс"
          />
          <RailRow href="/memories" icon={ImageIcon} title="Зураг ба бичлэг" note="Бүх дурсамж" />
        </div>

        {canCurate ? (
          <RailCta href="/family/add-person">
            Дутуу хүнээ
            <br />
            модондоо нэм
          </RailCta>
        ) : null}
      </Rail>
    </>
  );
}

/**
 * What each band is called, counting outward from the viewer.
 *
 * Deliberately not "Generation 4": a person opening a family tree is not
 * looking for a generation number, they are looking for their grandmother. Past
 * great-grandparents the words run out in every language, so the numbering
 * takes over — and by then the canvas is the better tool anyway.
 */
const BAND_LABELS = ['Би ба миний хайр', 'Бидний эцэг эх', 'Өвөө эмээ', 'Элэнц хуланц'] as const;
const BAND_MARKS = ['💖', '🌿', '🍂', '🕯️'] as const;

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
