import Link from 'next/link';
import { ChevronLeftIcon } from '@/components/icons';
import type { ReactNode } from 'react';

/**
 * A page title.
 *
 * It used to be a sticky bar with its own blurred background, because it was
 * the only header a phone-shaped app had. The site header does that job now,
 * so this went back to being what it always should have been: the opening line
 * of the page, set large, with a way back to where you came from.
 */
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
    <header className="px-4 pt-2 pb-6 sm:px-5">
      {backHref ? (
        <Link
          href={backHref}
          className="-ml-2 mb-3 inline-flex h-9 items-center gap-1.5 rounded-full pr-3 pl-2 text-sm text-ink-soft transition-colors hover:bg-parchment-deep"
        >
          <ChevronLeftIcon size={17} />
          Буцах
        </Link>
      ) : null}

      <div className="flex items-end justify-between gap-5">
        <div className="min-w-0">
          {subtitle ? <p className="eyebrow mb-2 truncate">{subtitle}</p> : null}
          <h1 className="ed-display ed-display-lg truncate">{title}</h1>
        </div>
        {action ? <div className="shrink-0 pb-1">{action}</div> : null}
      </div>
    </header>
  );
}
