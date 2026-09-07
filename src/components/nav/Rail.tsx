import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { ArrowRightIcon, ChevronRightIcon, LeafIcon } from '@/components/icons';

/**
 * The right rail.
 *
 * The plate holds what the page is about. The rail holds what it is NOT about,
 * and that is its whole job: somebody to look in on, somewhere to go next, and
 * one standing invitation to add something today. It is the part of the desk
 * that keeps an archive from being a filing cabinet.
 *
 * It disappears below 1280px rather than stacking underneath the page. A rail
 * of asides pushed below the content is read by nobody and costs a screenful of
 * scrolling on exactly the devices with the least of it.
 */
export function Rail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <aside aria-label="Хажуугийн самбар" className={cn('rt-rail', className)}>
      {children}
    </aside>
  );
}

/** A titled card in the rail, optionally with one link in its corner. */
export function RailCard({
  title,
  href,
  linkLabel = 'Бүгд',
  children,
  className,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rt-rail-card overflow-hidden', className)}>
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="font-display text-[1.02rem] text-ink">{title}</h2>
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 text-xs text-ink-soft transition-colors hover:text-forest"
          >
            {linkLabel}
            <ArrowRightIcon size={14} />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** A row of quick links: tinted icon, two lines, a chevron. */
export function RailRow({
  href,
  icon: Icon,
  title,
  note,
}: {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
  title: string;
  note: string;
}) {
  return (
    <Link href={href} className="rt-rail-row">
      <span className="rt-rail-icon">
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.92rem] font-medium text-ink">{title}</span>
        <span className="block truncate text-xs text-muted">{note}</span>
      </span>
      <ChevronRightIcon size={17} className="shrink-0 text-muted" />
    </Link>
  );
}

/**
 * The one dark object on the desk.
 *
 * Every screen gets exactly one, and it always says the same kind of thing:
 * the archive is only as good as what went into it this week. Two lines, no
 * icon-and-heading stack, no dismissal — it is a standing invitation rather
 * than a notification.
 */
export function RailCta({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="rt-cta">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,#f3efe4_16%,transparent)]">
        <LeafIcon size={18} />
      </span>
      <span className="flex-1 font-display text-[1rem] leading-snug">{children}</span>
      <ChevronRightIcon size={18} className="shrink-0 opacity-70" />
    </Link>
  );
}
