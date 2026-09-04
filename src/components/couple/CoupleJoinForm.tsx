'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/** Accepting takes one tap; it also tells you what you are accepting. */
export function CoupleJoinForm({ token, inviterName }: { token: string; inviterName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/couple/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? 'Нэгдэж чадсангүй.');
      router.push('/us');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Нэгдэж чадсангүй.');
      setBusy(false);
    }
  };

  return (
    <Card className="text-center">
      <p className="text-3xl">❤️</p>
      <h2 className="mt-3 font-display text-xl text-ink">
        {inviterName} таныг хамтдаа түүхээ бичихийг урьж байна
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
        Нэгдсэнээр та хоёрын хувийн орон зай нээгдэнэ. Гэр бүлийн бусад гишүүд эндэхийг харахгүй.
      </p>
      <Button size="lg" className="mt-6" onClick={() => void accept()} loading={busy}>
        Нэгдэх
      </Button>
      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
    </Card>
  );
}
