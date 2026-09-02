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
    <header className="sticky top-0 z-30 border-b border-line bg-parchment/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
        {backHref ? (
          <Link
            href={backHref}
            className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-soft"
          >
            <ChevronLeftIcon />
            <span className="sr-only-text">Буцах</span>
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl leading-tight text-ink">{title}</h1>
          {subtitle ? <p className="truncate text-sm text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
    </header>
  );
}
