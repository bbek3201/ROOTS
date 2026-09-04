import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/env';
import { AuthForm } from '@/components/auth/AuthForm';
import { AuthShell } from '@/components/auth/AuthShell';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; code?: string }>;
}) {
  if (!isSupabaseConfigured()) redirect('/setup');
  const { next, code } = await searchParams;

  // Carry the destination through the switch, so someone who clicks a deep
  // link, discovers they have no account and signs up still lands where they
  // were headed. A family code counts as a destination: it is the whole reason
  // the person is here, and it must survive being sent to the other form.
  const suffix = code
    ? `?code=${encodeURIComponent(code)}`
    : next
      ? `?next=${encodeURIComponent(next)}`
      : '';

  return (
    <AuthShell
      mode="signin"
      title="Гэр бүлийн түүх үргэлжилсээр."
      intro="Долоон үеийн хүмүүс, дуу хоолой, зураг, дурсамж — бүгд нэг газар, зөвхөн танайхны хувьд."
      switchHref={{ signin: `/login${suffix}`, signup: `/signup${suffix}` }}
    >
      <AuthForm mode="signin" nextPath={code ? `/onboarding?code=${encodeURIComponent(code)}` : next ?? '/'} />
    </AuthShell>
  );
}
