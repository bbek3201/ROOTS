'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';

/**
 * Sign-in and sign-up.
 *
 * Deliberately one component: the two flows differ by one field and one call,
 * and keeping them together means the error handling, the loading state and
 * the redirect logic cannot drift apart between them.
 */
export function AuthForm({ mode, nextPath }: { mode: 'signin' | 'signup'; nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          // display_name is read by the handle_new_user trigger to create the
          // profile row, so a member always has a name to be attributed by.
          options: { data: { display_name: displayName.trim() || email.split('@')[0], locale: 'mn' } },
        });
        if (signUpError) throw signUpError;

        // With email confirmation on, there is no session yet — say so rather
        // than redirecting into a login wall.
        if (!data.session) {
          setNotice('Баталгаажуулах холбоосыг таны имэйл рүү илгээлээ. Түүнийг дарж үргэлжлүүлнэ үү.');
          setLoading(false);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }

      router.replace(nextPath || '/');
      router.refresh();
    } catch (caught) {
      setError(translateAuthError(caught));
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      {mode === 'signup' ? (
        <TextField
          label="Таны нэр"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          autoComplete="name"
          placeholder="Жишээ: Бат"
          hint="Таны нэмсэн дурсамж, зураг энэ нэрээр үүрд тэмдэглэгдэнэ."
          required
        />
      ) : null}

      <TextField
        label="Имэйл"
        type="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        required
      />

      <TextField
        label="Нууц үг"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        minLength={8}
        hint={mode === 'signup' ? 'Дор хаяж 8 тэмдэгт.' : undefined}
        required
      />

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="rounded-xl bg-sage-wash px-3 py-2.5 text-sm text-sage">
          {notice}
        </p>
      ) : null}

      <Button type="submit" size="lg" fullWidth loading={loading}>
        {mode === 'signup' ? 'Бүртгүүлэх' : 'Нэвтрэх'}
      </Button>
    </form>
  );
}

/** Supabase returns English auth errors; show the family a Mongolian one. */
function translateAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();

  if (lowered.includes('invalid login credentials')) return 'Имэйл эсвэл нууц үг буруу байна.';
  if (lowered.includes('already registered')) return 'Энэ имэйл аль хэдийн бүртгэлтэй байна.';
  if (lowered.includes('email not confirmed')) return 'Имэйлээ баталгаажуулаагүй байна.';
  if (lowered.includes('password')) return 'Нууц үг хэт богино байна. Дор хаяж 8 тэмдэгт оруулна уу.';
  if (lowered.includes('rate limit') || lowered.includes('too many')) {
    return 'Хэт олон оролдлого хийлээ. Түр хүлээгээд дахин оролдоно уу.';
  }
  return 'Нэвтрэхэд алдаа гарлаа. Дахин оролдоно уу.';
}
