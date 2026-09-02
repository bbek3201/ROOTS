import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/env';
import { AuthForm } from '@/components/auth/AuthForm';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  if (!isSupabaseConfigured()) redirect('/setup');
  const { invite } = await searchParams;

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12">
      <header className="mb-8 text-center">
        <p className="font-display text-xs tracking-[0.35em] text-gold">ROOTS</p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-ink">Бүртгүүлэх</h1>
        <p className="mt-3 text-balance text-ink-soft">
          Таны архив зөвхөн танай гэр бүлийнх. Өөр хэн ч харах боломжгүй.
        </p>
      </header>

      <AuthForm mode="signup" nextPath={invite ? `/invite/${invite}` : '/'} />

      <p className="mt-6 text-center text-sm text-muted">
        Бүртгэлтэй юу?{' '}
        <Link href="/login" className="font-medium text-ember underline underline-offset-4">
          Нэвтрэх
        </Link>
      </p>
    </main>
  );
}
