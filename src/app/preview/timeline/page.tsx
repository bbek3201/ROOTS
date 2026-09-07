import { AppShell } from '@/components/nav/AppShell';
import { FamilyChronicle, type ChronicleEntry } from '@/components/timeline/FamilyChronicle';
import { FAMILY_NAME, FAMILY_TIMELINE, SCENES, VIEWER } from '@/app/preview/fixture';

/** The chronicle, with the faces the events happened to. */
export default function PreviewTimeline() {
  return (
    <AppShell viewer={VIEWER} family={FAMILY_NAME} vista={SCENES[0]} layout="editorial">
      <main id="main">
        <header className="rt-gutters pt-12 pb-10 lg:pt-16 lg:pb-14">
          <p className="ed-eyebrow">Timeline</p>
          <h1 className="ed-display ed-display-xl mt-6 max-w-[16ch]">
            Танай гэр бүлийн он цагийн хэлхээ.
          </h1>
          <p className="ed-lead mt-7">
            1918 оноос 2025 он хүртэл — гэрлэлт, төрөлт, нүүдэл, дурсамжууд нэг мөрөнд.
          </p>
        </header>

        <FamilyChronicle entries={FAMILY_TIMELINE as ChronicleEntry[]} />

        <footer className="rt-gutters ed-hair py-10">
          <p className="ed-eyebrow">Roots · {FAMILY_NAME}</p>
        </footer>
      </main>
    </AppShell>
  );
}
