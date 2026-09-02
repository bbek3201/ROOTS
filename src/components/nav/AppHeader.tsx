import Link from 'next/link';
import { ChevronLeftIcon } from '@/components/icons';
import type { ReactNode } from 'react';

export function AppHeader({
  title,
  subtitle,
  backHref,
  action,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 bg-parchment/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-4">
        {backHref ? (
          <Link
            href={backHref}
            className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-parchment-deep"
          >
            <ChevronLeftIcon />
            <span className="sr-only-text">Буцах</span>
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          {subtitle ? <p className="eyebrow truncate">{subtitle}</p> : null}
          <h1 className="truncate font-display text-[1.4rem] leading-tight text-ink">{title}</h1>
        </div>
        {action}
      </div>
    </header>
  );
}
