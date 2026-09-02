'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { MemoryIcon, MicIcon, PersonIcon, SearchIcon, TreeIcon } from '@/components/icons';

/**
 * The five destinations of ROOTS: Family, Memories, Interview, Search, Profile.
 *
 * Fixed to the bottom because this is a one-handed, phone-first app, and the
 * bottom of a phone is the only place a thumb reliably reaches.
 */
const TABS = [
  { href: '/family', label: 'Гэр бүл', Icon: TreeIcon, match: ['/family', '/person', '/couple'] },
  { href: '/memories', label: 'Дурсамж', Icon: MemoryIcon, match: ['/memories'] },
  { href: '/interview', label: 'Ярилцлага', Icon: MicIcon, match: ['/interview'] },
  { href: '/search', label: 'Хайх', Icon: SearchIcon, match: ['/search'] },
  { href: '/profile', label: 'Профайл', Icon: PersonIcon, match: ['/profile', '/settings'] },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Үндсэн цэс"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-line',
        'bg-surface/92 backdrop-blur-lg safe-bottom',
      )}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5',
                  'text-[0.68rem] font-medium transition-colors',
                  active ? 'text-ember' : 'text-muted',
                )}
              >
                <Icon size={22} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
