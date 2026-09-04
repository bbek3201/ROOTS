import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/env';
import { AuthForm } from '@/components/auth/AuthForm';
import { AuthShell } from '@/components/auth/AuthShell';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; code?: string; next?: string }>;
}) {
  if (!isSupabaseConfigured()) redirect('/setup');
  const { invite, code, next } = await searchParams;

  // A family code survives the detour through account creation: someone who
  // was given a code and told to sign up should land on the join screen with
  // it already filled in, not on an empty onboarding page holding a code they
  // now have to find again in a chat.
  const nextPath = invite
    ? `/invite/${invite}`
    : code
      ? `/onboarding?code=${encodeURIComponent(code)}`
      : next ?? '/';
  const suffix = invite
    ? `?invite=${encodeURIComponent(invite)}`
    : code
      ? `?code=${encodeURIComponent(code)}`
      : next
        ? `?next=${encodeURIComponent(next)}`
        : '';

  return (
    <AuthShell
      mode="signup"
      title={invite || code ? 'Танайхан таныг хүлээж байна.' : 'Гэр бүлийнхээ архивыг эхлүүлье.'}
      intro={
        invite || code
          ? 'Бүртгэлээ үүсгэнэ үү. Дараа нь та шууд танайхны архив руу орно.'
          : 'Хэдхэн минутын дотор эхний хүнээ нэмээд, ах дүү, ач зээ нараа урина.'
      }
      switchHref={{ signin: `/login${suffix}`, signup: `/signup${suffix}` }}
    >
      <AuthForm mode="signup" nextPath={nextPath} />
    </AuthShell>
  );
}
