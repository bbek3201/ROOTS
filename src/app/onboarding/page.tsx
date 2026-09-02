import { redirect } from 'next/navigation';
import { getMemberships, requireUser, getProfile } from '@/lib/auth/session';
import { CreateFamilyForm } from '@/components/family/CreateFamilyForm';

export default async function OnboardingPage() {
  await requireUser();
  const [memberships, profile] = await Promise.all([getMemberships(), getProfile()]);

  // Already in a family? Onboarding is not a place to linger.
  if (memberships.length > 0) redirect('/family');

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12">
      <header className="mb-7">
        <p className="font-display text-xs tracking-[0.35em] text-olive">ROOTS</p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-ink">
          {profile?.display_name ? `Тавтай морил, ${profile.display_name}.` : 'Тавтай морил.'}
        </h1>
        <p className="mt-3 text-balance text-ink-soft">
          Гэр бүлийнхээ архивыг эхлүүлье. Дараа нь та ах дүү, ач зээ нараа урьж, хамтдаа
          дурсамжаа цуглуулна.
        </p>
      </header>

      <CreateFamilyForm />

      <div className="card mt-5 p-4">
        <h2 className="font-display text-base text-ink">Урилга авсан уу?</h2>
        <p className="mt-1.5 text-sm text-ink-soft">
          Танайхны хэн нэг нь архив үүсгэсэн бол танд илгээсэн урилгын холбоосыг дарж нэгдээрэй.
          Шинэ гэр бүл үүсгэх шаардлагагүй.
        </p>
      </div>
    </main>
  );
}
