import { AppHeader } from '@/components/nav/AppHeader';
import { FirstsRoom } from '@/components/couple/FirstsRoom';
import { FIRSTS } from '@/app/preview/fixture';

export default function PreviewFirsts() {
  return (
    <div className="mx-auto w-full max-w-[860px] py-6 md:py-12">
      <AppHeader title="Анхны мөчүүд" backHref="/preview" />
      <main className="px-4 pb-10">
        <FirstsRoom spaceId="preview" cards={FIRSTS} />
      </main>
    </div>
  );
}
