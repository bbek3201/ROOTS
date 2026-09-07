'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  ACTIONS,
  DESTINATIONS,
  SIDEBAR_SECONDARY,
  UTILITIES,
  activeHref,
} from '@/lib/nav';
import { BellIcon, ChevronDownIcon, SearchIcon } from '@/components/icons';

export interface Viewer {
  name: string;
  avatarUrl: string | null;
}

/**
 * The top of the desk.
 *
 * Almost nothing lives here on purpose. Navigation is the sidebar's job, and a
 * top bar that repeats it is two menus arguing; what this carries is the one
 * thing you do from every page regardless of where you are — search — plus the
 * two controls that belong to you rather than to the page: what has happened
 * since you last looked, and who you are signed in as.
 *
 * Below `lg` the sidebar is gone, so this grows the wordmark and a drawer. That
 * drawer is the one place in the product where EVERY destination is listed,
 * including the ones no bar is wide enough to hold.
 */
export function TopBar({ viewer, family }: { viewer: Viewer; family: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const current = activeHref(pathname);

  // The drawer is a route-level overlay: it must not survive a navigation.
  useEffect(() => setOpen(false), [pathname]);

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get('q');
    const trimmed = typeof query === 'string' ? query.trim() : '';
    if (trimmed) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <>
      <div className="rt-topbar">
        <Link href="/family" className="rt-wordmark shrink-0 text-[1.3rem] lg:hidden">
          ROOTS
        </Link>

        <form
          role="search"
          onSubmit={search}
          className="min-w-0 flex-1 lg:mx-auto lg:max-w-[560px]"
        >
          <label className="rt-search">
            <SearchIcon size={17} />
            <input
              type="search"
              name="q"
              placeholder="Хүн, дурсамж, он оноор хайх…"
              aria-label={`${family} доторх хайлт`}
              defaultValue=""
            />
          </label>
        </form>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link href="/timeline" aria-label="Сүүлд юу болсон" className="rt-orb hidden sm:inline-flex">
            <BellIcon size={18} />
          </Link>

          <Link
            href="/profile"
            className="flex items-center gap-1.5 rounded-full pr-1 transition-opacity hover:opacity-80"
          >
            <span className="sr-only-text">Профайл</span>
            <span className="photo-frame inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full font-display text-sm text-sage sm:h-10 sm:w-10">
              {viewer.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- a signed
                // storage URL, which the Next image optimiser cannot cache.
                <img src={viewer.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                viewer.name.slice(0, 1).toUpperCase()
              )}
            </span>
            <ChevronDownIcon
              size={15}
              className="hidden text-[color-mix(in_srgb,#183b32_45%,transparent)] sm:block"
            />
          </Link>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? 'Цэсийг хаах' : 'Цэс нээх'}
            className="rt-orb lg:hidden"
          >
            <span className="relative block h-3 w-4">
              <span
                className={cn(
                  'absolute inset-x-0 top-0 h-px bg-current transition-transform',
                  open && 'translate-y-1.5 rotate-45',
                )}
              />
              <span
                className={cn(
                  'absolute inset-x-0 bottom-0 h-px bg-current transition-transform',
                  open && '-translate-y-1.5 -rotate-45',
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <nav
          aria-label="Гар утасны цэс"
          className="sticky top-[4.65rem] z-30 max-h-[calc(100dvh-4.65rem)] overflow-y-auto border-y border-[color-mix(in_srgb,#183b32_8%,transparent)] bg-[#fffcf8] px-4 py-4 lg:hidden"
        >
          <ul>
            {DESTINATIONS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={current === item.href ? 'page' : undefined}
                  className={cn(
                    'block py-3 font-display text-[1.3rem]',
                    current === item.href
                      ? 'text-[#183b32]'
                      : 'text-[color-mix(in_srgb,#183b32_72%,transparent)]',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <ul className="mt-3 border-t border-[color-mix(in_srgb,#183b32_8%,transparent)] pt-3">
            {[...UTILITIES, ...SIDEBAR_SECONDARY, ...ACTIONS]
              // Профайл is in both lists; the drawer should show it once.
              .filter((item, index, all) => all.findIndex((x) => x.href === item.href) === index)
              .map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block py-2.5 text-[1rem] text-[color-mix(in_srgb,#183b32_72%,transparent)]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      ) : null}
    </>
  );
}
