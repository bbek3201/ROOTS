import { AppShell } from '@/components/nav/AppShell';
import { FamilyHome } from '@/components/home/FamilyHome';
import {
  FAMILY_NAME,
  HOME_BANDS,
  HOME_COUPLE,
  HOME_GALLERY,
  HOME_NEWS,
  HOME_VOICES,
  HOME_WALL,
  SCENES,
  VIEWER,
} from '../fixture';

/**
 * The desk, with a family on it.
 *
 * The one screen that shows the whole chrome at once — sidebar, top bar, plate
 * and rail — against a family big enough to fill it. Everything below is
 * fixture data; see ../fixture for why the archive ships no demo family.
 */
export default function HomePreview() {
  return (
    <AppShell viewer={VIEWER} family={FAMILY_NAME} vista={SCENES[0]} layout="self">
      <FamilyHome
        familyName={FAMILY_NAME}
        isEmpty={false}
        joinCode="ROOTS-2026"
        generations={7}
        stats={{ people: 128, memories: 64, media: 412 }}
        hero={SCENES.slice(0, 3).map((src) => ({ src, alt: FAMILY_NAME, initial: 'Б' }))}
        heroCaption="1971 · Хуримын дараа, Тамирын голын хөвөөнд"
        bands={HOME_BANDS}
        wall={HOME_WALL}
        gallery={HOME_GALLERY}
        voices={HOME_VOICES}
        news={HOME_NEWS}
        couple={HOME_COUPLE}
        interview={{ href: '#', label: 'Ярилцлага эхлүүлэх' }}
        closingSrc={SCENES[3] ?? null}
      />
    </AppShell>
  );
}
