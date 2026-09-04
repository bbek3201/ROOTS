import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Plate } from '@/components/home/Plate';
import { Lineage, type LineageBand } from '@/components/home/Lineage';
import { Mosaic, type MosaicItem } from '@/components/home/Mosaic';
import { Voices, type VoiceEntry } from '@/components/home/Voices';

/**
 * The family home, as a picture.
 *
 * Everything on this page is real data, but none of it is fetched here: the
 * route builds the view model and this renders it. That seam is what lets the
 * whole cover be rendered — and looked at — without a session, which is the
 * only way a page whose entire job is how it looks can actually be reviewed.
 *
 * Four rules hold the design together:
 *
 *   1. The photographs are the product. They are large, they come first, and
 *      they are never reduced to a thumbnail with a title and a chevron.
 *   2. Warm paper, never a dark ground. The surface is light-only (`.editorial`
 *      in globals.css) so the album does not invert at night.
 *   3. Air is the layout. Sections are separated by space and by a change of
 *      wash — not by borders, cards or rules.
 *   4. One idea per section, said in a full sentence of display type. Families
 *      read these lines out loud.
 *
 * Sections disappear rather than degrade: a family with no recordings yet gets
 * no half-empty "Voices" shelf, because an archive that is honestly young looks
 * better than one padded with placeholders.
 */
export interface HeroPlate {
  src: string | null;
  alt: string;
  initial: string;
}

export interface GalleryPerson {
  id: string;
  href: string;
  name: string;
  meta: string;
  src: string | null;
}

export interface FamilyHomeProps {
  familyName: string;
  isEmpty: boolean;
  /** The family's join code — shown only to admins, and only when it is live. */
  joinCode?: string | null;
  generations: number;
  stats: { people: number; memories: number; media: number };
  /** Three plates, in the order they are composed. */
  hero: HeroPlate[];
  heroCaption: string | null;
  bands: LineageBand[];
  wall: MosaicItem[];
  gallery: GalleryPerson[];
  voices: VoiceEntry[];
  interview: { href: string; label: string };
  closingSrc: string | null;
}

export function FamilyHome({
  familyName,
  isEmpty,
  joinCode = null,
  generations,
  stats,
  hero,
  heroCaption,
  bands,
  wall,
  gallery,
  voices,
  interview,
  closingSrc,
}: FamilyHomeProps) {
  return (
    <main id="main">
      {/* ================= Hero ============================================ */}
      {/* One photograph, the width of the screen, and four lines of type over
          it. A family album opens on a picture of the family — not on a
          two-column marketing layout — and everything the page can say about
          itself is worth less than the first face someone recognises. */}
      <section className="relative">
        <div className="relative isolate flex min-h-[clamp(30rem,82svh,46rem)] items-end overflow-hidden">
          {hero[0]?.src ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires.
            <img
              src={hero[0].src}
              alt={hero[0].alt}
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-br from-[#f7f2e9] via-[#e7ecdf] to-[#cddbcf]"
            />
          )}

          {/* Late, gentle, and only in the lower half: faces stay untouched. */}
          <span
            aria-hidden="true"
            className={
              hero[0]?.src
                ? 'absolute inset-0 bg-gradient-to-t from-[rgb(10_26_21/0.86)] via-[rgb(10_26_21/0.42)] to-transparent'
                : 'absolute inset-0 bg-gradient-to-t from-[rgb(255_252_248/0.9)] to-transparent'
            }
          />

          <div className="ed-shell relative w-full pb-14 pt-28 sm:pb-20 lg:pb-24">
            <p
              className={
                hero[0]?.src
                  ? 'text-[0.7rem] font-medium uppercase tracking-[0.34em] text-[rgb(251_249_244/0.72)]'
                  : 'ed-eyebrow'
              }
            >
              Roots · {familyName}
            </p>

            <h1
              className={cn(
                'ed-display ed-display-xl mt-6 max-w-[14ch]',
                hero[0]?.src && 'text-[#fbf9f4]',
              )}
            >
              Танай гэр бүл.
              <br />
              Танай түүхүүд.
              <br />
              Танай өв.
            </h1>

            <p
              className={cn(
                'ed-lead mt-7',
                hero[0]?.src && 'text-[rgb(251_249_244/0.82)]',
              )}
            >
              Үеийг холбодог хүмүүс, дурсамж, түүхийг хамтдаа хадгалъя.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/family/tree"
                className={cn(
                  'ed-btn',
                  hero[0]?.src
                    ? 'bg-[#fbf9f4] text-[#183b32] hover:bg-white'
                    : 'ed-btn-primary',
                )}
              >
                Гэр бүлээ судлах
              </Link>
              <Link
                href="/memories/new"
                className={cn(
                  'ed-btn',
                  hero[0]?.src
                    ? 'border-white/35 text-[#fbf9f4] hover:bg-white/10'
                    : 'ed-btn-ghost',
                )}
              >
                Дурсамж нэмэх
              </Link>
            </div>
          </div>
        </div>

        {/* The two supporting prints and the count of what is in the archive —
            on paper, under the photograph, the way a caption sits under a plate. */}
        <div className="ed-shell grid grid-cols-1 gap-12 pt-14 pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-20 lg:pt-20 lg:pb-28">
          <div>
            {heroCaption ? <p className="ed-eyebrow">{heroCaption}</p> : null}
            <p className="ed-lead mt-6 text-[1.15rem] sm:text-[1.35rem]">
              Долоон үеийг нэг архивт. Хос болгон, хүүхэд болгон, дуу хоолой болгон
              өөрийн байрандаа.
            </p>

            {!isEmpty ? (
              <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-7 sm:gap-x-14">
                <Stat value={generations} label="үе" />
                <Stat value={stats.people} label="хүн" />
                <Stat value={stats.memories} label="дурсамж" />
                <Stat value={stats.media} label="зураг, бичлэг" />
              </dl>
            ) : null}
          </div>

          {hero.length > 1 ? (
            <div className="grid min-w-0 grid-cols-2 gap-4 sm:gap-5">
              <Plate
                src={hero[1]?.src ?? null}
                alt={hero[1]?.alt ?? familyName}
                initial={hero[1]?.initial ?? familyName.slice(0, 1)}
                className="aspect-4/5 rounded-[26px]"
              />
              <Plate
                src={hero[2]?.src ?? null}
                alt={hero[2]?.alt ?? familyName}
                initial={hero[2]?.initial ?? familyName.slice(0, 1)}
                className="aspect-4/5 translate-y-8 rounded-[26px]"
              />
            </div>
          ) : null}
        </div>
      </section>

      {isEmpty ? (
        <section className="ed-shell pb-28">
          <div className="ed-band-sage rounded-[32px] px-8 py-16 text-center sm:px-16 sm:py-24">
            <h2 className="ed-display ed-display-lg">Архив хоосон байна.</h2>
            <p className="ed-lead mx-auto mt-6">
              Хамгийн ахмад хүнээсээ эхэлье. Хос, хүүхдүүдийг нэмэхэд хамаарал
              автоматаар бүрдэнэ.
            </p>
            <Link href="/family/add-person" className="ed-btn ed-btn-primary mt-10">
              Эхний хүнийг нэмэх
            </Link>

            {joinCode ? <JoinCodeNote code={joinCode} /> : null}
          </div>
        </section>
      ) : null}

      {/* ================= Lineage ========================================= */}
      {bands.length > 0 ? (
        <section className="ed-band-cream py-20 lg:py-28">
          <div className="ed-shell">
            <header className="mx-auto max-w-2xl text-center">
              <p className="ed-eyebrow">Lineage</p>
              <h2 className="ed-display ed-display-lg mt-6">
                {generations} үе.
                <br />
                Нэг амьд түүх.
              </h2>
            </header>

            <div className="mt-14">
              <Lineage bands={bands} />
            </div>

            <p className="mt-14 text-center">
              <TextLink href="/family/tree">Бүтэн модыг үзэх</TextLink>
            </p>
          </div>
        </section>
      ) : null}

      {/* ================= The wall ======================================== */}
      {wall.length > 0 ? (
        <section className="py-20 lg:py-28">
          <div className="ed-shell">
            <header className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="ed-eyebrow">Moments</p>
                <h2 className="ed-display ed-display-lg mt-6">Тэр мөчүүдийг санацгаая.</h2>
              </div>
              <TextLink href="/memories">Бүх дурсамж</TextLink>
            </header>

            <div className="mt-14">
              <Mosaic items={wall} />
            </div>
          </div>
        </section>
      ) : null}

      {/* ================= People ========================================== */}
      {gallery.length > 0 ? (
        <section className="pb-20 lg:pb-28">
          <div className="ed-shell">
            <header className="max-w-2xl">
              <p className="ed-eyebrow">People</p>
              <h2 className="ed-display ed-display-lg mt-6">Хүн бүрд өөрийн түүх бий.</h2>
            </header>

            <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4 md:gap-x-8">
              {gallery.map((person) => (
                <Link key={person.id} href={person.href} className="group block">
                  <Plate
                    src={person.src}
                    alt={person.name}
                    initial={person.name.slice(0, 1)}
                    className="aspect-4/5 rounded-[24px]"
                  />
                  <p className="mt-5 text-[1.2rem] font-semibold tracking-[-0.03em] text-[#183b32]">
                    {person.name}
                  </p>
                  <p className="mt-1 text-[0.9rem] text-[color-mix(in_srgb,#183b32_55%,transparent)]">
                    {person.meta}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ================= Voices ========================================== */}
      <section className="ed-band-sage py-20 lg:py-28">
        <div className="ed-shell">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-24">
            <header>
              <p className="ed-eyebrow">Voices</p>
              <h2 className="ed-display ed-display-lg mt-6">
                Зарим дурсамжийг
                <br />
                сонсох нь дээр.
              </h2>
              <p className="ed-lead mt-8">
                Хорин асуулт. Хариултууд нь ярьсан хүний дуу хоолойгоор үүрд үлдэнэ.
              </p>
              <Link href={interview.href} className="ed-btn ed-btn-primary mt-10">
                {interview.label}
              </Link>
            </header>

            <div>
              {voices.length > 0 ? (
                <Voices entries={voices} />
              ) : (
                <p className="ed-lead mt-4 lg:mt-16">
                  Одоогоор бичигдсэн дуу хоолой алга. Хамгийн ахмад хүнээсээ эхлэх нь
                  хамгийн зөв.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================= Closing ========================================= */}
      <section className="ed-shell py-20 lg:py-28">
        <div className="ed-frame relative isolate flex min-h-[26rem] items-end overflow-hidden rounded-[36px] lg:min-h-[34rem]">
          {closingSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires.
            <img
              src={closingSrc}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[rgb(12_28_23/0.88)] via-[rgb(12_28_23/0.48)] to-[rgb(12_28_23/0.14)]"
          />
          <div className="relative w-full p-10 sm:p-16 lg:p-20">
            <h2 className="ed-display ed-display-lg max-w-[16ch] text-[#fbf9f4]">
              Гэр бүлийнхээ түүхийг амьд байлга.
            </h2>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link href="/memories/new" className="ed-btn bg-[#fbf9f4] text-[#183b32] hover:bg-white">
                Архиваа баяжуулах
              </Link>
              <Link
                href="/family/add-person"
                className="ed-btn border-white/35 text-[#fbf9f4] hover:bg-white/10"
              >
                Хүн нэмэх
              </Link>
            </div>

            {joinCode && !isEmpty ? (
              <p className="mt-9 text-[0.95rem] text-[rgb(251_249_244/0.78)]">
                Танайхныг урих код:{' '}
                <span className="font-semibold tracking-[0.22em] text-[#fbf9f4]">{joinCode}</span>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="ed-shell ed-hair py-10">
        <p className="ed-eyebrow">Roots · {familyName}</p>
      </footer>
    </main>
  );
}

/**
 * The code, on the cover of an archive that is still empty.
 *
 * The moment someone creates a family they need exactly two things: a first
 * person, and a way to get their relatives in. Burying the second one in
 * settings is how an archive ends up with one member forever.
 */
function JoinCodeNote({ code }: { code: string }) {
  return (
    <div className="mx-auto mt-12 max-w-md border-t border-[color-mix(in_srgb,#183b32_14%,transparent)] pt-8">
      <p className="ed-eyebrow">Танайхныг урих код</p>
      <p className="mt-4 font-display text-[2rem] tracking-[0.24em] text-[#183b32]">{code}</p>
      <p className="ed-meta mt-4">
        Ах дүү, ач зээ нартаа энэ кодыг өгөөрэй. Бүртгүүлээд оруулахад л энэ архивт нэгдэнэ.
      </p>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="sr-only-text">{label}</dt>
      <dd className="text-[2.2rem] font-semibold leading-none tracking-[-0.04em] text-[#183b32]">
        {value}
      </dd>
      <p className="ed-eyebrow mt-2.5">{label}</p>
    </div>
  );
}

/** The only link style on the page that is not a button: a hairline underline. */
function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[0.95rem] text-[#183b32] underline decoration-[color-mix(in_srgb,#183b32_25%,transparent)] underline-offset-8 transition-colors hover:decoration-[#183b32]"
    >
      {children}
    </Link>
  );
}
