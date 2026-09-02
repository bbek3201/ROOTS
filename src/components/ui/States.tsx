import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

/**
 * Empty, loading and error states.
 *
 * A family archive starts completely empty and stays sparse for a long time, so
 * empty states are not an edge case here — they are the first thing most people
 * see. Each one names what is missing and offers the single next action, rather
 * than showing a shrug icon.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string } | ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('card flex flex-col items-center px-6 py-10 text-center', className)}>
      {icon ? <div className="mb-3 text-3xl opacity-70">{icon}</div> : null}
      <h3 className="font-display text-lg text-ink">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{description}</p> : null}
      {action ? (
        <div className="mt-5">
          {isLinkAction(action) ? (
            <Link
              href={action.href}
              className="inline-flex min-h-11 items-center rounded-pill bg-forest px-5 text-sm font-medium text-forest-ink"
            >
              {action.label}
            </Link>
          ) : (
            action
          )}
        </div>
      ) : null}
    </div>
  );
}

function isLinkAction(action: unknown): action is { label: string; href: string } {
  return typeof action === 'object' && action !== null && 'href' in action && 'label' in action;
}

export function ErrorState({
  title = 'Алдаа гарлаа',
  message,
  retry,
}: {
  title?: string;
  message: string;
  retry?: ReactNode;
}) {
  return (
    <div role="alert" className="card border-danger/30 bg-danger-wash px-5 py-6 text-center">
      <h3 className="font-display text-base text-danger">{title}</h3>
      <p className="mt-1.5 text-sm text-ink-soft">{message}</p>
      {retry ? <div className="mt-4">{retry}</div> : null}
    </div>
  );
}

/** Skeletons match the shape of the content they replace, to avoid layout jump. */
export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2.5', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-3.5 rounded-full bg-parchment-deep"
          style={{ width: `${100 - index * 12}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only-text">Ачаалж байна…</span>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 rounded-full bg-parchment-deep" />
            <div className="flex-1">
              <SkeletonLines lines={2} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
