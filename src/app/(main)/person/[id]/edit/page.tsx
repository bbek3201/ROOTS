import { notFound, redirect } from 'next/navigation';
import { requireActiveFamily } from '@/lib/family-context';
import { can } from '@/lib/auth/session';
import { getPersonProfile } from '@/lib/data/people';
import { getMediaPaths } from '@/lib/data/family';
import { getSignedUrls } from '@/lib/media/storage';
import { AppHeader } from '@/components/nav/AppHeader';
import { PersonEditor } from '@/components/person/PersonEditor';
import { displayName } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Editing a person.
 *
 * The person page has linked here since the beginning; the page itself never
 * existed, so "Засах" was a 404. Editing is the half of an archive nobody
 * demos and everybody needs: a birth year arrives years after the name, a
 * photograph turns up in a drawer, a nickname is remembered at a funeral.
 */
export default async function PersonEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireActiveFamily();

  if (!can(membership, 'edit')) redirect(`/person/${id}`);

  const profile = await getPersonProfile(id);
  if (!profile) notFound();

  const { person } = profile;

  const paths = await getMediaPaths([person.profile_photo_media_id]);
  const path = person.profile_photo_media_id ? paths.get(person.profile_photo_media_id) : null;
  const signed = path ? await getSignedUrls([path]) : null;
  const portraitUrl = path ? (signed?.get(path) ?? null) : null;

  return (
    <>
      <AppHeader
        title={displayName(person)}
        subtitle="Мэдээлэл засах"
        backHref={`/person/${id}`}
      />
      <main id="main" className="px-4 pb-16 sm:px-5">
        <PersonEditor person={person} portraitUrl={portraitUrl} />
      </main>
    </>
  );
}
