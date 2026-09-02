import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

/**
 * The typographic voices of the archive.
 *
 * Two sizes of one idea: a small olive label that says what kind of thing this
 * is, and a large serif line that says which one. Keeping them here rather than
 * as loose classNames is what stops eleven screens from each inventing their
 * own idea of a heading.
 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('eyebrow', className)}>{children}</p>;
}

export function Display({
  children,
  className,
  as: Component = 'h1',
  size = 'lg',
}: {
  children: ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'p';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const sizes = {
    sm: 'text-[1.35rem]',
    md: 'text-[1.7rem]',
    lg: 'text-[2.1rem]',
    xl: 'text-[2.6rem]',
  } as const;
  return (
    <Component className={cn('font-display text-balance leading-[1.1] text-ink', sizes[size], className)}>
      {children}
    </Component>
  );
}

/** Dates, places, counts — the line under a title, in one consistent voice. */
export function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-sm text-muted', className)}>{children}</p>;
}

/**
 * A section opener. No card, no rule, no chevron button — the space above it
 * is what separates it from what came before.
 */
export function SectionLead({
  label,
  title,
  action,
  className,
}: {
  label?: string;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {label ? <Eyebrow className="mb-1.5">{label}</Eyebrow> : null}
        <Display as="h2" size="sm">
          {title}
        </Display>
      </div>
      {action ? <div className="shrink-0 pb-1 text-sm text-sage">{action}</div> : null}
    </div>
  );
}
