import Link from 'next/link';
import { ChevronLeftIcon } from '@/components/icons';
import type { ReactNode } from 'react';

/**
 * A page title — the standing pattern for every inner page.
 *
 * The desk (sidebar + top bar) handles getting AROUND the product; this handles
 * opening a single page: its name set large, and — for a page reached by
 * drilling into a list — a way back to that list. The two are complementary,
 * not redundant: the sidebar only knows the six top-level destinations, so on
 * `/us/letters/[id]` the "Буцах" link to `/us/letters` is the only route back
 * to the list, at every width.
 *
 * The rich pages — the family home and the tree — lay out their own plate and
 * rail instead (see AppShell's SELF_LAID). Everything else is a reading or
 * writing surface and opens with this.
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
