import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

export function Card({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  const Component = as;
  return <Component className={cn('card p-4', className)}>{children}</Component>;
}

/** A card that is entirely one tap target — the dominant pattern on mobile. */
export function LinkCard({
  href,
  children,
  className,
  tone = 'plain',
}: {
  href: string;
  children: ReactNode;
  className?: string;
  /** `hero` is the lit, green-washed card used for the one action a screen wants. */
  tone?: 'plain' | 'hero';
}) {
  return (
    <Link
      href={href}
      className={cn(
        tone === 'hero' ? 'card-hero' : 'card',
        'block p-4 transition-shadow duration-150 hover:shadow-(--shadow-lift)',
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function SectionHeading({
  title,
  action,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <h2 className="font-display text-[1.15rem] leading-tight text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
