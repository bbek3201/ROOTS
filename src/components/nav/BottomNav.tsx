'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { MemoryIcon, PersonIcon, HomeIcon, TreeIcon } from '@/components/icons';

/**
 * Four destinations, and nothing else.
 *
 * Search and interviews used to live here too, which made the bar a menu of
 * features rather than a map of the product. They are reached from where they
 * are actually wanted instead: search from the home header, an interview from
 * the prompt on the home screen and from the person being interviewed.
 *
 * The bar stays at the bottom because this is a one-handed, phone-first app,
 * and it keeps its labels: the people most likely to be handed this app are
 * grandparents, for whom five unlabelled glyphs are a guessing game.
 */
const TABS = [
  { href: '/family', label: 'Нүүр', Icon: HomeIcon, exact: true },
  { href: '/family/tree', label: 'Гэр бүл', Icon: TreeIcon, match: ['/family/tree', '/person', '/couple'] },
  { href: '/memories', label: 'Дурсамж', Icon: MemoryIcon, match: ['/memories', '/interview'] },
  { href: '/profile', label: 'Би', Icon: PersonIcon, match: ['/profile', '/settings'] },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Үндсэн цэс"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-parchment/80 backdrop-blur-xl safe-bottom"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1.5 py-1.5',
                  'text-[0.66rem] tracking-wide transition-colors',
                  active ? 'text-forest' : 'text-muted hover:text-ink-soft',
                )}
              >
                <tab.Icon size={21} strokeWidth={active ? 1.9 : 1.4} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function isActive(pathname: string, tab: (typeof TABS)[number]): boolean {
  // Home is an exact match: without this it would light up on every /family/*
  // route and two tabs would read as current at once.
  if ('exact' in tab && tab.exact) return pathname === tab.href;
  const prefixes = 'match' in tab ? tab.match : [tab.href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
