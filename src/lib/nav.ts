import type { ComponentType, SVGProps } from 'react';
import {
  ClockIcon,
  HeartIcon,
  HomeIcon,
  MemoryIcon,
  MicIcon,
  PersonIcon,
  PlusIcon,
  SearchIcon,
  TreeIcon,
} from '@/components/icons';

/**
 * Where you can go, in one place.
 *
 * The site header and the tab bar used to each keep their own list of links and
 * their own idea of which one was "current". They drifted, as two copies of the
 * same list always do: a destination existed in one and not the other, and two
 * items could light up at once because both `/family` and `/family/tree` match
 * a path that starts with `/family`.
 *
 * So the map lives here, and both bars render it. The active rule lives here
 * too, and it is a single sentence: the MOST SPECIFIC destination whose route
 * contains the current path is the current one. Never two, never none where one
 * should be.
 */
export type NavIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

export interface NavItem {
  href: string;
  /** Full name, for the header and the menu. */
  label: string;
  /** The tab bar has a thumb's width per item, not a sentence's. */
  short: string;
  Icon: NavIcon;
  /**
   * Other routes that belong to this destination — a person's page belongs to
   * the tree, family settings belong to the profile. Without these, opening a
   * relative's page would clear the navigation entirely.
   */
  also?: readonly string[];
}

/** The archive itself: the five places a family actually spends time. */
export const DESTINATIONS: readonly NavItem[] = [
  { href: '/family', label: 'Нүүр', short: 'Нүүр', Icon: HomeIcon },
  {
    href: '/family/tree',
    label: 'Гэр бүлийн мод',
    short: 'Мод',
    Icon: TreeIcon,
    // Opening a relative, a couple, or the form that adds one is still "the
    // tree" — the navigation must not go dark the moment you step into it.
    also: ['/person', '/couple', '/family/add-person'],
  },
  { href: '/memories', label: 'Дурсамж', short: 'Дурсамж', Icon: MemoryIcon },
  { href: '/timeline', label: 'Он цаг', short: 'Он цаг', Icon: ClockIcon },
  { href: '/interview', label: 'Түүхүүд', short: 'Түүх', Icon: MicIcon },
  {
    href: '/us',
    label: 'Хоёулаа',
    short: 'Хоёул',
    Icon: HeartIcon,
    // Everything under /us belongs here — the whole private space is one
    // destination, however many rooms it has.
    also: ['/us/join'],
  },
] as const;

/** Things you do rather than places you go. Icons in the header, all widths. */
export const UTILITIES: readonly NavItem[] = [
  { href: '/search', label: 'Хайх', short: 'Хайх', Icon: SearchIcon },
  {
    href: '/profile',
    label: 'Профайл',
    short: 'Би',
    Icon: PersonIcon,
    also: ['/settings'],
  },
] as const;

/** Reachable from the menu, so nothing in the product is a dead end. */
export const ACTIONS: readonly NavItem[] = [
  { href: '/family/add-person', label: 'Хүн нэмэх', short: 'Хүн нэмэх', Icon: PlusIcon },
  { href: '/memories/new', label: 'Дурсамж нэмэх', short: 'Дурсамж нэмэх', Icon: PlusIcon },
  { href: '/settings/family', label: 'Гишүүд ба эрх', short: 'Гишүүд', Icon: PersonIcon },
] as const;

/**
 * The five tabs a thumb can reach.
 *
 * Түүхүүд and Хоёулаа are the two destinations missing here. An interview is
 * nearly always opened from the person being interviewed or from the prompt on
 * the home screen; the couple space is opened from its own card on the home
 * screen, and it is a place one person goes rather than a place the family
 * lives. A tab bar of seven costs every tab its label, which would make all
 * five of the common destinations harder to hit in order to surface two rare
 * ones. Both keep their place in the header and in the menu.
 */
const NOT_IN_TAB_BAR = new Set(['/interview', '/us']);

export const TAB_BAR: readonly NavItem[] = [
  ...DESTINATIONS.filter((item) => !NOT_IN_TAB_BAR.has(item.href)),
  UTILITIES[1] as NavItem,
];

/** Every route that belongs to an item. */
function routesOf(item: NavItem): string[] {
  return [item.href, ...(item.also ?? [])];
}

function matches(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/**
 * Which destination the current path belongs to.
 *
 * Longest match wins, and that single rule settles every case the two hand-
 * written lists used to get wrong: `/family/tree` belongs to the tree rather
 * than to the home page it is nested under, `/settings/family` belongs to the
 * profile rather than to the family, and `/memories/new` belongs to the
 * memories. Null is a real answer — on a page that is not any of these, nothing
 * should be lit rather than something arbitrary.
 */
export function activeHref(
  pathname: string,
  items: readonly NavItem[] = DESTINATIONS,
): string | null {
  let best: { href: string; length: number } | null = null;

  for (const item of items) {
    for (const route of routesOf(item)) {
      if (!matches(pathname, route)) continue;
      if (!best || route.length > best.length) best = { href: item.href, length: route.length };
    }
  }

  return best?.href ?? null;
}

export function isActive(pathname: string, href: string, items?: readonly NavItem[]): boolean {
  return activeHref(pathname, items) === href;
}
