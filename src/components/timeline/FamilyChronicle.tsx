import Link from 'next/link';
import { Plate } from '@/components/home/Plate';

/**
 * The family chronology, read as a story rather than a table.
 *
 * A spreadsheet of dated rows is the obvious way to render a timeline and the
 * wrong one: what a family wants from its own chronology is the feeling of a
 * life unfolding — 1998 they married, 2002 a first child, 2014 that child
 * married in turn. So the year is set enormous and stands alone in the margin,
 * the events beside it are written as sentences, and a photograph appears
 * wherever the archive has one. Nothing is ruled, boxed or badged.
 */
export interface ChronicleEntry {
  id: string;
  year: string;
  kind: string;
  title: string;
  description: string | null;
  href?: string;
  photo?: { src: string; alt: string } | null;
}

export function FamilyChronicle({ entries }: { entries: ChronicleEntry[] }) {
  const years = groupByYear(entries);

  return (
    <div>
      {years.map(([year, yearEntries]) => (
        <section key={year} className="ed-hair">
          <div className="ed-shell grid grid-cols-1 gap-8 py-14 lg:grid-cols-[9rem_minmax(0,1fr)] lg:gap-16 lg:py-20">
            <p className="ed-display self-start text-[2.4rem] leading-none tracking-[-0.045em] text-[color-mix(in_srgb,#183b32_75%,transparent)] lg:sticky lg:top-28 lg:text-[3.1rem]">
              {year}
            </p>

            <ol className="space-y-14 lg:space-y-20">
              {yearEntries.map((entry) => (
                <li key={entry.id} className="max-w-2xl">
                  <p className="ed-eyebrow">{kindLabel(entry.kind)}</p>

                  <h2 className="ed-display ed-display-md mt-4">
                    {entry.href ? (
                      <Link
                        href={entry.href}
                        className="underline decoration-transparent underline-offset-[0.4em] transition-colors hover:decoration-[color-mix(in_srgb,#183b32_28%,transparent)]"
                      >
                        {entry.title}
                      </Link>
                    ) : (
                      entry.title
                    )}
                  </h2>

                  {entry.description ? (
                    <p className="ed-lead mt-4">{entry.description}</p>
                  ) : null}

                  {entry.photo ? (
                    <div className="mt-8">
                      <Plate
                        src={entry.photo.src}
                        alt={entry.photo.alt}
                        initial={entry.title.slice(0, 1)}
                        className="aspect-3/2 rounded-[26px]"
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>
      ))}
    </div>
  );
}

/** Undated entries keep their place at the end under a year of their own. */
function groupByYear(entries: ChronicleEntry[]): Array<[string, ChronicleEntry[]]> {
  const groups = new Map<string, ChronicleEntry[]>();
  for (const entry of entries) {
    const key = entry.year || '—';
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }
  return [...groups.entries()];
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'marriage': return 'Гэрлэлт';
    case 'birth': return 'Төрсөн';
    case 'death': return 'Дурсгал';
    case 'memory': return 'Дурсамж';
    case 'migration':
    case 'move': return 'Нүүдэл';
    case 'family': return 'Гэр бүл';
    default: return 'Түүх';
  }
}
