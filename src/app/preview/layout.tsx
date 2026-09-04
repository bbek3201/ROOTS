import { notFound } from 'next/navigation';

/**
 * The design preview, and its one hard rule.
 *
 * These pages render the couple space against sample data so the layout can be
 * looked at without a database, a session, or a real family's photographs. They
 * are development-only: in a production build this returns 404 before anything
 * under it renders, so there is no route on a deployed ROOTS that shows a
 * fictional couple.
 *
 * The check is here rather than in each page because a new preview page added
 * later must not be able to forget it.
 */
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className="editorial min-h-dvh">
      <p className="sticky top-0 z-50 bg-danger-wash px-4 py-2 text-center text-xs text-danger">
        Дизайн харах хуудас · жишээ өгөгдөл · зөвхөн development
      </p>
      {children}
    </div>
  );
}
