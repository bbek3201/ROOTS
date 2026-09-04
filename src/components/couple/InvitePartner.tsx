'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { HeartIcon } from '@/components/icons';

/**
 * "Waiting for your person."
 *
 * The link is generated on demand and shown once. It is not emailed and not
 * stored anywhere the app can read it back — only its hash is kept — so the
 * only copy is the one the inviter sends, in whatever way two people actually
 * talk to each other.
 */
export function InvitePartner({ spaceId, partnerName }: { spaceId: string; partnerName: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invite = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/couple/${spaceId}/invite`, { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? 'Урилга үүсгэж чадсангүй.');
      setLink(`${window.location.origin}/us/join?token=${body.token as string}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Урилга үүсгэж чадсангүй.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the link is on screen either way.
      setCopied(false);
    }
  };

  return (
    <Card className="border-dashed px-5 py-9 text-center">
      {/* Outline, not filled: the second half of this pair has not arrived yet,
          and the card says so before a single word is read. */}
      <HeartIcon size={26} className="mx-auto text-muted" />
      <h2 className="ed-display mt-5 text-2xl">Ханиа хүлээж байна…</h2>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
        {partnerName} нэгдэх хүртэл энэ орон зайг зөвхөн та харна. Доорх холбоосыг түүнд илгээнэ үү.
      </p>

      {link ? (
        <div className="mt-5">
          <p className="break-all rounded-xl bg-parchment-deep px-3 py-2.5 text-left text-xs text-ink-soft">
            {link}
          </p>
          <Button variant="secondary" size="sm" className="mt-3.5" onClick={() => void copy()}>
            {copied ? 'Хуулагдлаа ✓' : 'Холбоосыг хуулах'}
          </Button>
          <p className="mt-2 text-xs text-muted">
            Энэ холбоос 14 хоног хүчинтэй бөгөөд нэг л удаа ажиллана.
          </p>
        </div>
      ) : (
        <Button className="mt-7" onClick={() => void invite()} loading={busy}>
          Урилга үүсгэх
        </Button>
      )}

      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
    </Card>
  );
}
