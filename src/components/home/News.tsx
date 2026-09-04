import Link from 'next/link';

export interface NewsEntry {
  id: string;
  action: string;
  actorName: string | null;
  when: string;
  href: string;
}

/**
 * What the rest of the family has added since you last looked.
 *
 * The whole section only exists when there is something new — an archive that
 * has been quiet for a month should say nothing rather than show a shelf
 * labelled "nothing happened". That is also why this sits high on the page,
 * directly under the hero: it is the one part of the home screen whose content
 * a returning member has not already seen.
 *
 * Each line names the person who did it. "Хуучин зураг архивт нэмэгдлээ" is a
 * log entry; "Ээж хуучин зураг архивт нэмлээ" is a reason to open it.
 */
export function News({ entries }: { entries: NewsEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section className="ed-band-sage py-16 lg:py-20">
      <div className="ed-shell">
        <header className="flex flex-wrap items-baseline justify-between gap-4">
          <p className="ed-eyebrow">Таныг байхгүйд</p>
          <p className="text-[0.85rem] text-[color-mix(in_srgb,#183b32_55%,transparent)]">
            {entries.length} шинэ
          </p>
        </header>

        <ul className="mt-8 divide-y divide-[color-mix(in_srgb,#183b32_12%,transparent)]">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link href={entry.href} className="flex items-baseline gap-4 py-4 group">
                <span className="min-w-0 flex-1 text-[1.05rem] leading-snug text-[#183b32]">
                  {entry.actorName ? (
                    <span className="font-semibold">{entry.actorName}</span>
                  ) : null}{' '}
                  <span className="group-hover:underline">{entry.action}</span>
                </span>
                <span className="shrink-0 text-[0.8rem] text-[color-mix(in_srgb,#183b32_50%,transparent)]">
                  {entry.when}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
