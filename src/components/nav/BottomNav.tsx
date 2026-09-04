'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { TAB_BAR, activeHref } from '@/lib/nav';

/**
 * The tab bar.
 *
 * It renders the shared navigation map (see `lib/nav`) rather than a list of
 * its own, so it can never disagree with the header about what exists or about
 * which destination you are in. The bar stays at the bottom because this is a
 * one-handed, phone-first app, and it keeps its labels: the people most likely
 * to be handed this app are grandparents, for whom five unlabelled glyphs are a
 * guessing game.
 */
export function BottomNav() {
  const pathname = usePathname();
  const current = activeHref(pathname, TAB_BAR);

  return (
    <nav
      aria-label="Үндсэн цэс"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-parchment/80 backdrop-blur-xl safe-bottom"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1">
        {TAB_BAR.map((tab) => {
          const active = current === tab.href;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1.5 py-1.5',
                  'text-[0.62rem] tracking-tight transition-colors',
                  active ? 'text-forest' : 'text-muted hover:text-ink-soft',
                )}
              >
                <tab.Icon size={20} strokeWidth={active ? 1.9 : 1.4} />
                <span>{tab.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
