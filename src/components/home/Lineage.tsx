import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * The family, drawn rather than diagrammed.
 *
 * The real tree lives at /family/tree with its connectors, panning and edge
 * cases. This is the picture on the cover: one row of faces per generation,
 * oldest at the top, couples set as a pair of overlapping portraits, and a
 * single hair-thin line falling between the rows to say descent.
 *
 * What it deliberately does not do is draw every edge. A complete graph at
 * this size is a schematic — and a family looking at their own grandparents
 * should see faces, not a topology.
 */
export interface LineagePerson {
  id: string;
  name: string;
  year: string;
  photoUrl: string | null;
  initial: string;
}

export interface LineageUnit {
  id: string;
  href: string;
  people: LineagePerson[];
}

export interface LineageBand {
  key: string;
  label: string;
  units: LineageUnit[];
  /** People in this generation that the cover does not have room for. */
  overflow: number;
}

export function Lineage({ bands }: { bands: LineageBand[] }) {
  return (
    <div className="flex flex-col items-center">
      {bands.map((band, index) => (
        <div key={band.key} className="flex w-full flex-col items-center">
          {index > 0 ? (
            <span
              aria-hidden="true"
              className="h-14 w-px bg-gradient-to-b from-transparent via-[color-mix(in_srgb,#183b32_22%,transparent)] to-transparent sm:h-20"
            />
          ) : null}

          <p className="ed-eyebrow mb-6 text-center">{band.label}</p>

          <div className="flex flex-wrap items-start justify-center gap-x-8 gap-y-10 sm:gap-x-14">
            {band.units.map((unit) => (
              <Link key={unit.id} href={unit.href} className="group block text-center">
                <span className="flex items-end justify-center">
                  {unit.people.map((person, personIndex) => (
                    <Portrait
                      key={person.id}
                      person={person}
                      className={personIndex > 0 ? '-ml-5 sm:-ml-6' : undefined}
                    />
                  ))}
                </span>
                <span className="mt-3.5 block text-[0.95rem] text-[#183b32] transition-opacity group-hover:opacity-60">
                  {unit.people.map((person) => person.name).join(' · ')}
                </span>
                <span className="mt-0.5 block text-[0.78rem] text-[color-mix(in_srgb,#183b32_45%,transparent)]">
                  {unit.people.map((person) => person.year).filter(Boolean).join(' · ')}
                </span>
              </Link>
            ))}

            {band.overflow > 0 ? (
              <Link
                href="/family/tree"
                className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-[color-mix(in_srgb,#183b32_20%,transparent)] text-[0.85rem] text-[color-mix(in_srgb,#183b32_55%,transparent)] transition-colors hover:border-[#183b32] sm:h-24 sm:w-24"
              >
                +{band.overflow}
              </Link>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function Portrait({ person, className }: { person: LineagePerson; className?: string }) {
  return (
    <span
      className={cn(
        'ed-frame block h-20 w-20 shrink-0 rounded-full ring-4 ring-[#fffcf8] sm:h-24 sm:w-24',
        className,
      )}
    >
      {person.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires.
        <img src={person.photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center font-display text-2xl text-[color-mix(in_srgb,#183b32_38%,transparent)]">
          {person.initial}
        </span>
      )}
    </span>
  );
}
