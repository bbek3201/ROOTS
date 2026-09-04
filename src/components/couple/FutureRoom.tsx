'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { LockIcon, UnlockIcon } from '@/components/icons';
import { formatDate } from '@/lib/format';

export interface FutureMessage {
  id: string;
  title: string;
  unlockAt: string;
  /** Null while sealed — the database returns no body, so there is none here. */
  body: string | null;
  openedAt: string | null;
  imageUrl: string | null;
}

/**
 * Messages to their future selves.
 *
 * A locked message shows its title, its date and a count of days. It does not
 * show its contents, and there is no "reveal" this component could be talked
 * into performing: the body never reached the browser, never reached the
 * server's render, and does not exist in the page source.
 *
 * Neither partner can move the date, the writer included. A message you can
 * open tonight is a draft.
 */
export function FutureRoom({ messages }: { messages: FutureMessage[] }) {
  const now = Date.now();
  const ready = messages.filter((message) => message.body !== null);
  const sealed = messages.filter((message) => message.body === null);

  if (messages.length === 0) {
    return (
      <div className="space-y-4">
        <NewLink />
        <EmptyState
          title="Ирээдүйн өөрсдөдөө зүйл үлдээгээрэй."
          description="Тавьсан өдөр хүртэл хоёулаа хардаггүй. Тэр өдөр хүрэхэд л нээгдэнэ."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <NewLink />

      {ready.length > 0 ? (
        <section>
          <p className="eyebrow mb-3">Нээгдсэн</p>
          <ul className="space-y-2.5">
            {ready.map((message) => (
              <li key={message.id}>
                <OpenedMessage message={message} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sealed.length > 0 ? (
        <section>
          <p className="eyebrow mb-3">Хүлээж байна</p>
          <ul className="space-y-2.5">
            {sealed.map((message) => {
              const days = Math.max(
                0,
                Math.ceil((new Date(message.unlockAt).getTime() - now) / 86_400_000),
              );
              return (
                <li key={message.id}>
                  {/* Dashed, muted, and led by the countdown rather than by the
                      title: what a sealed message has to say right now is how
                      long is left, and the waiting IS the feature. */}
                  <Card className="flex items-center gap-4 border-dashed py-5">
                    <LockIcon size={20} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[1.02rem] leading-snug text-ink-soft">
                        {message.title}
                      </span>
                      <span className="mt-1 block text-xs tracking-[0.08em] text-muted uppercase">
                        {formatDate(message.unlockAt.slice(0, 10), 'exact')}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="ed-display block text-2xl tabular-nums text-[color-mix(in_srgb,#183b32_45%,transparent)]">
                        {days}
                      </span>
                      <span className="block text-[0.65rem] tracking-[0.14em] text-muted uppercase">
                        {days === 0 ? 'өнөөдөр' : 'хоног'}
                      </span>
                    </span>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function NewLink() {
  return (
    <Link
      href="/us/future/new"
      className="flex min-h-12 w-full items-center justify-center rounded-pill bg-forest text-sm font-medium text-forest-ink"
    >
      Ирээдүйд захиа үлдээх
    </Link>
  );
}

/**
 * An unlocked message, opened once.
 *
 * The first read is recorded so the space can say "your memory is ready" only
 * while it still is news. The body is already here — opening records the moment,
 * it does not fetch anything.
 */
function OpenedMessage({ message }: { message: FutureMessage }) {
  const router = useRouter();
  const [open, setOpen] = useState(message.openedAt !== null);

  const reveal = async () => {
    setOpen(true);
    const supabase = createClient();
    await supabase.rpc('open_future_message', { p_id: message.id });
    router.refresh();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => void reveal()}
        className="card-hero block w-full px-6 py-9 text-center"
      >
        <UnlockIcon size={26} className="mx-auto text-forest" />
        <span className="ed-display mt-5 block text-2xl">Танай захиа бэлэн боллоо.</span>
        <span className="mt-2 block text-sm text-muted">{message.title}</span>
      </button>
    );
  }

  return (
    <Card>
      <p className="text-sm font-medium text-ink">{message.title}</p>
      <p className="mt-1 text-xs text-muted">{formatDate(message.unlockAt.slice(0, 10), 'exact')}</p>
      {message.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires.
        <img
          src={message.imageUrl}
          alt=""
          className="mt-3 w-full rounded-xl border border-line object-cover"
        />
      ) : null}
      <p className="mt-3 whitespace-pre-wrap text-[1.05rem] leading-relaxed text-ink">{message.body}</p>
    </Card>
  );
}
