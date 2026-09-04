'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { ACTIONS, DESTINATIONS, UTILITIES, activeHref } from '@/lib/nav';

/**
 * The website header.
 *
 * The archive has a bottom tab bar on a phone because it is held in one hand.
 * On a desktop that same bar reads as a mobile app pinned to a large screen,
 * so every signed-in page gets a proper site header instead: wordmark on the
 * left, the four parts of the archive in the middle, search and profile on the
 * right, one hair line underneath and nothing else. No shadow, no chrome, no
 * colour.
 *
 * Under `md` it collapses to the wordmark plus a menu — and that menu is the
 * one place in the product where EVERY destination is listed, including the
 * ones the bars are too small to hold: search, settings, and the two "add"
 * actions. A minimal navigation is only a virtue while nothing is unreachable
 * from it, so the top of the menu is the map and the bottom is the toolbox.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = activeHref(pathname);

  // The menu is a route-level overlay, so it must not survive a navigation.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-[color-mix(in_srgb,#183b32_9%,transparent)] bg-[color-mix(in_srgb,#fffcf8_82%,transparent)] backdrop-blur-xl">
      <div className="ed-shell flex h-[72px] items-center justify-between gap-8 md:h-20">
        <Link
          href="/family"
          className="text-[1.05rem] font-semibold tracking-[0.26em] text-[#183b32] uppercase"
        >
          Roots
        </Link>

        <nav aria-label="Үндсэн цэс" className="hidden md:block">
          <ul className="flex items-center gap-6 lg:gap-8">
            {DESTINATIONS.map((link) => {
              const active = current === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'text-[0.95rem] transition-colors',
                      active
                        ? 'text-[#183b32]'
                        : 'text-[color-mix(in_srgb,#183b32_58%,transparent)] hover:text-[#183b32]',
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5">
          {UTILITIES.map((utility) => (
            <Link
              key={utility.href}
              href={utility.href}
              aria-label={utility.label}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[#183b32] transition-colors hover:bg-[color-mix(in_srgb,#f7f2e9_90%,transparent)]"
            >
              <utility.Icon size={19} />
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? 'Цэсийг хаах' : 'Цэс нээх'}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#183b32] md:hidden"
          >
            <span className="relative block h-3 w-5">
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
          className="max-h-[calc(100dvh-72px)] overflow-y-auto border-t border-[color-mix(in_srgb,#183b32_9%,transparent)] bg-[#fffcf8] md:hidden"
        >
          <div className="ed-shell py-4">
            <ul>
              {DESTINATIONS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current === link.href ? 'page' : undefined}
                    className={cn(
                      'block py-3 text-[1.35rem] font-medium tracking-[-0.02em]',
                      current === link.href
                        ? 'text-[#183b32]'
                        : 'text-[color-mix(in_srgb,#183b32_74%,transparent)]',
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <ul className="mt-4 border-t border-[color-mix(in_srgb,#183b32_9%,transparent)] pt-4">
              {UTILITIES.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block py-2.5 text-[1.02rem] text-[color-mix(in_srgb,#183b32_72%,transparent)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <ul className="mt-4 border-t border-[color-mix(in_srgb,#183b32_9%,transparent)] pt-4 pb-2">
              {ACTIONS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block py-2.5 text-[1.02rem] text-[color-mix(in_srgb,#183b32_72%,transparent)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
