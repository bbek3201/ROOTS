import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMemberships, requireUser, getProfile } from '@/lib/auth/session';
import { CreateFamilyForm } from '@/components/family/CreateFamilyForm';
import { JoinFamilyForm } from '@/components/family/JoinFamilyForm';

/**
 * The fork in the road, and there are only two ways through it.
 *
 * Someone arriving here either STARTS a family archive or JOINS one that
 * already exists — and in practice most people are joining, because one
 * relative builds the tree and everyone else is handed a code. So the code
 * comes first when the person arrived with one, and the choice is presented as
 * two equal paths rather than a primary action with a footnote.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  await requireUser();
  const [memberships, profile, { code }] = await Promise.all([
    getMemberships(),
    getProfile(),
    searchParams,
  ]);

  // Already in a family? Onboarding is not a place to linger.
  if (memberships.length > 0) redirect('/family');

  const arrivedWithCode = Boolean(code);

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12">
      <header className="mb-7">
        <Link
          href="/"
          className="font-display text-xs tracking-[0.35em] text-olive transition-colors hover:text-forest"
        >
          ROOTS
        </Link>
        <h1 className="mt-3 font-display text-3xl leading-tight text-ink">
          {profile?.display_name ? `Тавтай морил, ${profile.display_name}.` : 'Тавтай морил.'}
        </h1>
        <p className="mt-3 text-balance text-ink-soft">
          {arrivedWithCode
            ? 'Танд өгсөн кодыг шалгаад, танайхны архивт нэгдээрэй.'
            : 'Танайхны хэн нэг нь архив аль хэдийн үүсгэсэн бол кодыг нь оруулаад нэгдээрэй. Үгүй бол шинээр эхлүүлье.'}
        </p>
      </header>

      <section className="card p-5">
        <h2 className="font-display text-base text-ink">Кодоор нэгдэх</h2>
        <p className="mb-4 mt-1 text-sm text-ink-soft">
          Архив үүсгэсэн хүн 8 тэмдэгтийн код авсан байгаа. Түүнийг асуугаад энд оруулаарай.
        </p>
        <JoinFamilyForm initialCode={code ?? ''} />
      </section>

      <div className="my-7 flex items-center gap-4" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="eyebrow">эсвэл</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <section>
        <h2 className="mb-3 font-display text-base text-ink">Шинэ архив эхлүүлэх</h2>
        <CreateFamilyForm />
      </section>
    </main>
  );
}
