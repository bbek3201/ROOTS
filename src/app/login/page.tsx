import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/env';
import { AuthForm } from '@/components/auth/AuthForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (!isSupabaseConfigured()) redirect('/setup');
  const { next } = await searchParams;

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12">
      <header className="mb-8 text-center">
        <p className="font-display text-xs tracking-[0.35em] text-gold">ROOTS</p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-ink">Гэр бүлийн архив</h1>
        <p className="mt-3 text-balance text-ink-soft">
          Танай гэр бүл өөрийн түүхээ хэзээ ч мартах ёсгүй.
        </p>
      </header>

      <AuthForm mode="signin" nextPath={next ?? '/'} />

      <p className="mt-6 text-center text-sm text-muted">
        Шинэ хэрэглэгч үү?{' '}
        <Link href="/signup" className="font-medium text-ember underline underline-offset-4">
          Бүртгүүлэх
        </Link>
      </p>
    </main>
  );
}
