import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/env';
import { AuthForm } from '@/components/auth/AuthForm';
import { AuthShell } from '@/components/auth/AuthShell';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (!isSupabaseConfigured()) redirect('/setup');
  const { next } = await searchParams;

  // Carry the destination through the switch, so someone who clicks a deep
  // link, discovers they have no account and signs up still lands where they
  // were headed.
  const suffix = next ? `?next=${encodeURIComponent(next)}` : '';

  return (
    <AuthShell
      mode="signin"
      title="Гэр бүлийн түүх үргэлжилсээр."
      intro="Долоон үеийн хүмүүс, дуу хоолой, зураг, дурсамж — бүгд нэг газар, зөвхөн танайхны хувьд."
      switchHref={{ signin: `/login${suffix}`, signup: `/signup${suffix}` }}
    >
      <AuthForm mode="signin" nextPath={next ?? '/'} />
    </AuthShell>
  );
}
