'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from '@/components/nav/BottomNav';
import { SiteHeader } from '@/components/home/SiteHeader';

/**
 * The signed-in chrome.
 *
 * ROOTS is a website that happens to work beautifully on a phone — not a phone
 * app stretched onto a desktop. So every signed-in page gets the same site
 * header and the same warm paper, and the tab bar is confined to touch widths
 * where a thumb is the pointing device.
 *
 * Three kinds of page live here, and the shell gives each the width it needs:
 *
 *   · The family home and the timeline are editorial pages. They run the full
 *     measure and lay themselves out edge to edge.
 *   · The family tree opens on the family's cover photograph and carries its
 *     canvas framed inside the page. The canvas is not full-bleed on purpose:
 *     a pan-and-zoom surface filling the viewport eats the page's scroll,
 *     because every finger lands inside it. Full screen is a button.
 *   · Everything else is a reading or writing surface — a person, a memory, a
 *     form, a transcript — and prose set 1300px wide is unreadable. Those get a
 *     single column, generous but bounded, centred on the same paper.
 */

/** Pages that compose their own full-width editorial layout. */
const EDITORIAL = ['/family', '/timeline', '/family/tree', '/family/story'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEditorial = EDITORIAL.includes(pathname);

  return (
    <div className="editorial flex min-h-dvh flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      <SiteHeader />

      {isEditorial ? (
        children
      ) : (
        // No horizontal padding here: the inner pages carry their own gutter,
        // and adding the shell's on top of it doubles the margin on a phone.
        <div className="mx-auto w-full max-w-[860px] flex-1 py-6 md:py-12">{children}</div>
      )}

      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
