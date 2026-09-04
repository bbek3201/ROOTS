import { requireMySpace } from '@/lib/couple/guard';
import { listCouplePlaces, signMediaByIds } from '@/lib/data/couple-space';
import { AppHeader } from '@/components/nav/AppHeader';
import { PlacesRoom } from '@/components/couple/PlacesRoom';

export const dynamic = 'force-dynamic';

export default async function CouplePlacesPage() {
  const mine = await requireMySpace();
  const places = await listCouplePlaces(mine.space.id);
  const urls = await signMediaByIds(places.map((place) => place.media_id));

  return (
    <>
      <AppHeader
        title="Газрууд"
        subtitle={places.length > 0 ? `${places.length}` : undefined}
        backHref="/us"
      />
      <main id="main" className="px-4 pb-10">
        <PlacesRoom
          spaceId={mine.space.id}
          places={places.map((place) => ({
            id: place.id,
            name: place.name,
            visitedOn: place.visited_on,
            notes: place.notes,
            latitude: place.latitude,
            longitude: place.longitude,
            imageUrl: place.media_id ? urls.get(place.media_id) ?? null : null,
          }))}
        />
      </main>
    </>
  );
}
