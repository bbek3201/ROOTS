import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/env';
import { AuthForm } from '@/components/auth/AuthForm';
import { AuthShell } from '@/components/auth/AuthShell';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; next?: string }>;
}) {
  if (!isSupabaseConfigured()) redirect('/setup');
  const { invite, next } = await searchParams;

  const nextPath = invite ? `/invite/${invite}` : next ?? '/';
  const suffix = invite
    ? `?invite=${encodeURIComponent(invite)}`
    : next
      ? `?next=${encodeURIComponent(next)}`
      : '';

  return (
    <AuthShell
      mode="signup"
      title={invite ? 'Танайхан таныг хүлээж байна.' : 'Гэр бүлийнхээ архивыг эхлүүлье.'}
      intro={
        invite
          ? 'Урилгыг хүлээн авахын тулд бүртгэлээ үүсгэнэ үү. Дараа нь та шууд танайхны архив руу орно.'
          : 'Хэдхэн минутын дотор эхний хүнээ нэмээд, ах дүү, ач зээ нараа урина.'
      }
      switchHref={{ signin: `/login${suffix}`, signup: `/signup${suffix}` }}
    >
      <AuthForm mode="signup" nextPath={nextPath} />
    </AuthShell>
  );
}
