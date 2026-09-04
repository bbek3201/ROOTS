import { AppHeader } from '@/components/nav/AppHeader';
import { LetterList } from '@/components/couple/LetterList';
import { LETTERS } from '@/app/preview/fixture';

export default function PreviewLetters() {
  return (
    <div className="mx-auto w-full max-w-[860px] py-6 md:py-12">
      <AppHeader title="Захидал" backHref="/preview" />
      <main className="px-4 pb-10">
        <LetterList letters={LETTERS} />
      </main>
    </div>
  );
}
