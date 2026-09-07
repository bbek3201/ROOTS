import Link from 'next/link';
import { requireActiveFamily } from '@/lib/family-context';
import { can } from '@/lib/auth/session';
import { getMediaPaths } from '@/lib/data/family';
import { getSignedUrls } from '@/lib/media/storage';
import { FamilyStoryEditor } from '@/components/family/FamilyStoryEditor';
import { AiStoryDraft } from '@/components/family/AiStoryDraft';

export const dynamic = 'force-dynamic';

/**
 * The family's story, in full.
 *
 * The profile screen has linked here since the beginning and the page never
 * existed. It is the long form of what the tree page shows above the canvas:
 * one piece of prose, set at reading measure on warm paper, with the family's
 * photograph over it — the closest thing this archive has to a first page of a
 * book. Admins write it here, or let the archive draft it and then correct it.
 */
export default async function FamilyStoryPage() {
  const membership = await requireActiveFamily();
  const canAdminister = can(membership, 'administer');
  const story = membership.family.description?.trim() ?? '';

  const coverPaths = await getMediaPaths([membership.family.cover_media_id]);
  const coverPath = membership.family.cover_media_id
    ? coverPaths.get(membership.family.cover_media_id)
    : null;
  const signed = coverPath ? await getSignedUrls([coverPath]) : null;
  const coverUrl = coverPath ? (signed?.get(coverPath) ?? null) : null;

  return (
    <main id="main" className="pb-20">
      <section className="relative isolate flex min-h-[clamp(16rem,42svh,26rem)] items-end overflow-hidden">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires.
          <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
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
              ? 'absolute inset-0 bg-gradient-to-t from-[rgb(10_26_21/0.84)] to-transparent'
              : 'absolute inset-0 bg-gradient-to-t from-[rgb(255_252_248/0.9)] to-transparent'
          }
        />
        <div className="rt-gutters relative w-full pb-10 pt-20">
          <p
            className={
              coverUrl
                ? 'text-[0.7rem] font-medium uppercase tracking-[0.3em] text-[rgb(251_249_244/0.7)]'
                : 'ed-eyebrow'
            }
          >
            Гэр бүлийн түүх
          </p>
          <h1 className={`ed-display ed-display-lg mt-4 ${coverUrl ? 'text-[#fbf9f4]' : ''}`}>
            {membership.family.name}
          </h1>
        </div>
      </section>

      <section className="rt-gutters pt-12">
        {story ? (
          <div className="max-w-[62ch] whitespace-pre-line text-[1.12rem] leading-[1.8] text-[color-mix(in_srgb,#183b32_84%,transparent)]">
            {story}
          </div>
        ) : (
          <div className="max-w-[52ch]">
            <p className="ed-display ed-display-md">Энэ хуудас хоосон байна.</p>
            <p className="ed-lead mt-5">
              Танайхны түүхийг бичих, эсвэл архивт хадгалагдсан баримт, дурсамжаас
              ноорог гаргуулаад засах — аль нь ч болно.
            </p>
          </div>
        )}

        {canAdminister ? (
          <div className="mt-10 flex flex-wrap items-start gap-3 border-t border-[color-mix(in_srgb,#183b32_12%,transparent)] pt-8">
            <FamilyStoryEditor
              familyId={membership.family_id}
              name={membership.family.name}
              story={story}
              variant="onPaper"
              label={story ? 'Түүхийг засах' : 'Түүхийг бичих'}
            />
            <AiStoryDraft familyId={membership.family_id} />
          </div>
        ) : null}

        <p className="mt-10">
          <Link
            href="/family/tree"
            className="text-[0.95rem] text-[#183b32] underline decoration-[color-mix(in_srgb,#183b32_25%,transparent)] underline-offset-8 transition-colors hover:decoration-[#183b32]"
          >
            Гэр бүлийн мод руу буцах
          </Link>
        </p>
      </section>
    </main>
  );
}
