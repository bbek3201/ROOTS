'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DESTINATIONS, SIDEBAR_SECONDARY, activeHref } from '@/lib/nav';

/**
 * The standing sidebar.
 *
 * It renders the shared navigation map rather than a list of its own, for the
 * same reason the tab bar does: two copies of the same list always drift. What
 * it adds is the thing a tab bar has no room for — a horizon.
 *
 * The photograph at the foot is not decoration. A family archive opened on a
 * laptop is mostly forms, lists and dates, and without something to look at the
 * whole product reads as records management. One landscape and one italic line
 * hold the tone of the thing on every screen, including the dull ones.
 */
export function Sidebar({ vista }: { vista?: string | null }) {
  const pathname = usePathname();
  const current = activeHref(pathname);

  return (
    <aside className="rt-sidebar">
      <Link href="/family" className="rt-wordmark px-2.5 py-1">
        ROOTS
      </Link>

      <nav aria-label="Үндсэн цэс" className="mt-7">
        <ul className="flex flex-col gap-0.5">
          {DESTINATIONS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current === item.href ? 'page' : undefined}
                className="rt-navlink"
              >
                <item.Icon size={19} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <ul className="mt-3 flex flex-col gap-0.5 border-t border-[color-mix(in_srgb,#183b32_8%,transparent)] pt-3">
          {SIDEBAR_SECONDARY.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current === item.href ? 'page' : undefined}
                className="rt-navlink"
              >
                <item.Icon size={19} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* The window. With no photograph in `public/landing/` this is the warm
          sage-and-gold wash the class already carries — finished either way,
          never a broken image. */}
      <div className="rt-vista">
        {vista ? <img src={vista} alt="" /> : null}
        <p className="rt-quote">
          Өнгөрсөн маань
          <br />
          ирээдүйг маань босгоно.
        </p>
      </div>
    </aside>
  );
}
