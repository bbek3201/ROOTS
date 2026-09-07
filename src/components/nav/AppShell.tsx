'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/nav/Sidebar';
import { TopBar, type Viewer } from '@/components/nav/TopBar';
import { BottomNav } from '@/components/nav/BottomNav';

/**
 * The signed-in chrome — a desk, not a phone.
 *
 * ROOTS is opened on a laptop by the person doing the archiving and on a phone
 * by everyone else, and this lays out one product that is honestly both:
 *
 *   · From `lg` up it is a desk. A standing sidebar on the left with the
 *     wordmark above it and a horizon below it, a quiet top bar carrying the
 *     search field, and the page laid out on it as a single plate of warm
 *     paper.
 *   · Below `lg` the sidebar folds into the top bar's drawer and the tab bar
 *     returns, because a thumb is the pointing device again.
 *
 * Three kinds of page live on the desk, and the shell gives each the width it
 * needs:
 *
 *   · SELF_LAID pages lay out the whole row themselves — their own plate AND a
 *     `<Rail>` beside it. Only the two screens rich enough to have something
 *     worth putting in an aside are in this list; a rail is a promise to have
 *     something to say there, and a page that cannot keep it should not have
 *     one.
 *   · EDITORIAL pages compose a full-bleed layout and get the plate edge to
 *     edge.
 *   · Everything else is a reading or writing surface, and prose set 1300px
 *     wide is unreadable, so those get a single bounded column centred on the
 *     same paper.
 */

/** Pages that lay out their own plate and rail. */
const SELF_LAID = ['/family', '/family/tree'];

/** Pages that fill the plate with their own full-width layout. */
const EDITORIAL = ['/timeline', '/family/story', '/us'];

/** How a page wants the plate. Normally read from the route; see `layout`. */
export type PageLayout = 'self' | 'editorial' | 'column';

export function AppShell({
  children,
  viewer,
  family,
  vista,
  layout,
}: {
  children: React.ReactNode;
  viewer: Viewer;
  family: string;
  vista?: string | null;
  /**
   * Override the route lookup below.
   *
   * The lists are keyed by pathname because a page cannot tell its own layout
   * to a shell that renders above it. The design preview can: it mounts the
   * shell directly, under a path the lists know nothing about, and without this
   * a self-laid page would render its plate inside the shell's — two `<main>`
   * elements on one screen.
   */
  layout?: PageLayout;
}) {
  const pathname = usePathname();
  const resolved: PageLayout =
    layout ??
    (SELF_LAID.includes(pathname)
      ? 'self'
      : EDITORIAL.includes(pathname)
        ? 'editorial'
        : 'column');
  const selfLaid = resolved === 'self';
  const isEditorial = resolved === 'editorial';

  return (
    <div className="editorial rt-frame">
      <Sidebar vista={vista} />

      <div className="flex min-h-dvh flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
        <TopBar viewer={viewer} family={family} />

        {/* The gutter belongs to the desk, not to the plate: the page inside
            carries its own padding, and adding the two together doubles every
            margin on a phone. */}
        <div className="flex flex-1 items-start gap-4 px-[var(--rt-gutter)] pt-1 pb-[var(--rt-gutter)]">
          {selfLaid ? (
            children
          ) : (
            // A div, not a <main>: every page in this group already renders its
            // own `<main id="main">`, which is what the skip link points at.
            // Wrapping them in another one would put two on the page and two
            // elements answering to the same id.
            <div className="rt-panel min-w-0 flex-1 overflow-hidden">
              {isEditorial ? (
                children
              ) : (
                <div className="mx-auto w-full max-w-[860px] px-1 py-3 sm:px-3 md:py-7">{children}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}

/**
 * The plate, for a page that lays out its own row.
 *
 * Exported here rather than in `ui/` because it is half of a pair: a SELF_LAID
 * page renders this and a `<Rail>` as siblings, and the two only make sense
 * together. Named `PagePlate` rather than `Plate` because `home/Plate` is a
 * photographic plate — a different object entirely, and one this sits beside.
 */
export function PagePlate({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main id="main" className={`rt-panel min-w-0 flex-1 overflow-hidden ${className ?? ''}`}>
      {children}
    </main>
  );
}
