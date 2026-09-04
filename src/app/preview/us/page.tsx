import { CoupleHome } from '@/components/couple/CoupleHome';
import { COVERS, HOW_WE_MET, NAMES } from '@/app/preview/fixture';

export default function PreviewCoupleHome() {
  return (
    <CoupleHome
      spaceId="preview"
      names={NAMES}
      startedOn="2025-06-12"
      howWeMet={HOW_WE_MET}
      partnerJoined
      counts={{ memories: 128, letters: 14, places: 23, voice: 6, future: 3 }}
      firsts={{ filled: 3, total: 9 }}
      nextUnlockAt="2030-06-12T00:00:00Z"
      covers={COVERS.slice(0, 5)}
    />
  );
}
