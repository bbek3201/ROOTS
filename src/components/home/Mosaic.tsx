import Link from 'next/link';
import { Plate } from '@/components/home/Plate';

/**
 * The photo wall.
 *
 * A repeating seven-plate rhythm — wide, tall, three squares, tall, wide —
 * rather than a uniform grid, so the wall reads as a spread in a magazine
 * instead of a gallery of thumbnails. Nothing is wrapped in a card and nothing
 * carries a title underneath it: the year and the name sit inside the picture,
 * small, and only where there is room for them.
 */
export interface MosaicItem {
  id: string;
  href: string;
  src: string | null;
  title: string;
  meta: string;
}

/** Column span and shape per position in the rhythm. Sums to 12 per row. */
const RHYTHM = [
  'md:col-span-7 aspect-4/3',
  'md:col-span-5 aspect-4/5',
  'md:col-span-4 aspect-square',
  'md:col-span-4 aspect-square',
  'md:col-span-4 aspect-square',
  'md:col-span-5 aspect-4/5',
  'md:col-span-7 aspect-3/2',
] as const;

/**
 * Counts at which the rhythm lands on a complete row (7+5, 4+4+4, 5+7, …).
 * Anything else leaves a single plate stranded beside a rectangle of empty
 * paper, which is the one thing a photo wall must never do.
 */
const COMPLETE_COUNTS = [14, 12, 9, 7, 5, 2];

export function Mosaic({ items }: { items: MosaicItem[] }) {
  const count = COMPLETE_COUNTS.find((value) => value <= items.length) ?? items.length;
  const shown = items.slice(0, count);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-6">
      {shown.map((item, index) => (
        <Link key={item.id} href={item.href} className={`col-span-1 ${RHYTHM[index % RHYTHM.length]}`}>
          <Plate
            src={item.src}
            alt={item.title}
            initial={item.title.slice(0, 1)}
            caption={item.title}
            meta={item.meta}
            className="h-full w-full rounded-[26px]"
          />
        </Link>
      ))}
    </div>
  );
}
