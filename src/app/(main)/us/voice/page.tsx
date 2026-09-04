import { requireMySpace } from '@/lib/couple/guard';
import { listVoiceMemories, signCoupleMedia } from '@/lib/data/couple-space';
import { AppHeader } from '@/components/nav/AppHeader';
import { VoiceRoom } from '@/components/couple/VoiceRoom';

export const dynamic = 'force-dynamic';

export default async function CoupleVoicePage() {
  const mine = await requireMySpace();
  const notes = await listVoiceMemories(mine.space.id);

  const urls = await signCoupleMedia(
    notes.map((note) => note.media).filter((media): media is NonNullable<typeof media> => media !== null),
  );

  return (
    <>
      <AppHeader title="Дуу хоолой" backHref="/us" />
      <main id="main" className="px-4 pb-10">
        <VoiceRoom
          spaceId={mine.space.id}
          notes={notes.map((note) => ({
            id: note.id,
            title: note.title,
            description: note.description,
            recordedOn: note.recorded_on,
            url: note.media ? urls.get(note.media.storage_path) ?? null : null,
            durationSeconds: note.media?.duration_seconds ?? null,
          }))}
        />
      </main>
    </>
  );
}
