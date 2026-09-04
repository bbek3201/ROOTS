import { AppHeader } from '@/components/nav/AppHeader';
import { CoupleTimeline } from '@/components/couple/CoupleTimeline';
import { groupByYear } from '@/lib/couple/timeline';
import { TIMELINE_ENTRIES } from '@/app/preview/fixture';

export default function PreviewTimeline() {
  return (
    <div className="mx-auto w-full max-w-[860px] py-6 md:py-12">
      <AppHeader title="Он цагийн хэлхээс" backHref="/preview" />
      <main className="px-4 pb-10">
        <CoupleTimeline years={groupByYear(TIMELINE_ENTRIES)} />
      </main>
    </div>
  );
}
