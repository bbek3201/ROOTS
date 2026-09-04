import { AppHeader } from '@/components/nav/AppHeader';
import { FutureRoom } from '@/components/couple/FutureRoom';
import { FUTURE } from '@/app/preview/fixture';

export default function PreviewFuture() {
  return (
    <div className="mx-auto w-full max-w-[860px] py-6 md:py-12">
      <AppHeader title="Ирээдүйд" backHref="/preview" />
      <main className="px-4 pb-10">
        <FutureRoom messages={FUTURE} />
      </main>
    </div>
  );
}
