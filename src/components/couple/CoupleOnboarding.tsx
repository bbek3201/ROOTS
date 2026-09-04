'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/States';
import { AppHeader } from '@/components/nav/AppHeader';

export interface OnboardingCouple {
  id: string;
  partnerName: string;
  partnerYears: string;
  suggestedStart: string | null;
  taken: boolean;
}

/**
 * Opening the space, in the three questions that actually matter.
 *
 * "Who is your person" is answered from the family tree rather than by typing a
 * name, because ROOTS already knows: the relationship is a row in `couples`
 * with both partners in it. Anything else would be a second, rival answer to a
 * question the archive has already recorded.
 *
 * The date and the story are both skippable. A couple opening this at midnight
 * because they just thought of it should not be stopped by a form.
 */
export function CoupleOnboarding({ couples }: { couples: OnboardingCouple[] }) {
  const router = useRouter();
  const available = couples.filter((couple) => !couple.taken);

  const [coupleId, setCoupleId] = useState<string | null>(available[0]?.id ?? null);
  const [startedOn, setStartedOn] = useState(available[0]?.suggestedStart?.slice(0, 10) ?? '');
  const [howWeMet, setHowWeMet] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!coupleId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/couple', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          coupleId,
          startedOn: startedOn || null,
          howWeMet: howWeMet.trim() || undefined,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? 'Үүсгэж чадсангүй.');
      router.push('/us');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Үүсгэж чадсангүй.');
      setBusy(false);
    }
  };

  if (couples.length === 0) {
    return (
      <>
        <AppHeader title="Хоёулаа" backHref="/family" />
        <main id="main" className="px-4 pb-8">
          <EmptyState
            title="Эхлээд харилцаагаа модонд бүртгээрэй"
            description="Хосын хувийн орон зай нь гэр бүлийн модон дахь харилцаан дээр тулгуурладаг. Та хоёрыг хос болгож бүртгэсний дараа энд орон зай нээгдэнэ."
            action={{ label: 'Гэр бүлийн мод', href: '/family/tree' }}
          />
        </main>
      </>
    );
  }

  if (available.length === 0) {
    return (
      <>
        <AppHeader title="Хоёулаа" backHref="/family" />
        <main id="main" className="px-4 pb-8">
          <EmptyState
            title="Хань тань аль хэдийн нээсэн байна"
            description="Түүнээс урилгын холбоос авбал та хоёрын орон зай нээгдэнэ."
          />
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader title="Хоёулаа" subtitle="Танай хоёрын орон зай" backHref="/family" />

      <main id="main" className="space-y-4 px-4 pb-10">
        <Card>
          <p className="eyebrow">Нэг</p>
          <h2 className="mt-1.5 font-display text-lg text-ink">Танай хүн хэн бэ?</h2>
          <ul className="mt-3 space-y-2">
            {available.map((couple) => (
              <li key={couple.id}>
                <button
                  type="button"
                  onClick={() => {
                    setCoupleId(couple.id);
                    setStartedOn(couple.suggestedStart?.slice(0, 10) ?? '');
                  }}
                  aria-pressed={coupleId === couple.id}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left ${
                    coupleId === couple.id
                      ? 'border-forest bg-forest-wash'
                      : 'border-line bg-surface'
                  }`}
                >
                  <span className="text-lg">❤️</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{couple.partnerName}</span>
                    {couple.partnerYears ? (
                      <span className="block text-xs text-muted">{couple.partnerYears}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Жагсаалтад байхгүй бол{' '}
            <Link href="/family/tree" className="underline">гэр бүлийн модонд</Link> харилцаагаа
            эхлээд бүртгээрэй.
          </p>
        </Card>

        <Card>
          <p className="eyebrow">Хоёр</p>
          <h2 className="mt-1.5 mb-3 font-display text-lg text-ink">Хэзээ эхэлсэн бэ?</h2>
          <TextField
            label="Хамт болсон огноо"
            type="date"
            value={startedOn}
            onChange={(event) => setStartedOn(event.target.value)}
            hint="Хуримын өдөр биш, та хоёрын тоолж эхэлсэн өдөр."
          />
        </Card>

        <Card>
          <p className="eyebrow">Гурав</p>
          <h2 className="mt-1.5 mb-3 font-display text-lg text-ink">Хэрхэн танилцсан бэ?</h2>
          <TextAreaField
            label="Бидний түүх"
            value={howWeMet}
            onChange={(event) => setHowWeMet(event.target.value)}
            rows={5}
            placeholder="Дараа ч бичиж болно."
          />
        </Card>

        {error ? (
          <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">{error}</p>
        ) : null}

        <Button size="lg" fullWidth onClick={() => void create()} loading={busy} disabled={!coupleId}>
          Орон зайгаа нээх ❤
        </Button>
      </main>
    </>
  );
}
