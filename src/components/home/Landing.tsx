import Link from 'next/link';

/**
 * The front door.
 *
 * Everyone who arrives at ROOTS without an archive lands here, and this page
 * has one job: say what this is before it asks for anything. It is the only
 * page in the product a stranger can see, so it holds no family's data — the
 * photographs are the site's own (see `lib/landing-media`), and the tree in the
 * middle of the page is a drawing of the idea, not somebody's real family.
 *
 * The idea it draws is the whole product: a family is built out of COUPLES, and
 * children become couples, and that is what grows downward. If a visitor
 * understands only that before they sign up, the page has done its work.
 */
export interface LandingProps {
  /** Signed in but not in a family yet — the copy changes, not the layout. */
  signedIn: boolean;
  photographs: string[];
}

export function Landing({ signedIn, photographs }: LandingProps) {
  const hero = photographs[0] ?? null;
  const plates = photographs.slice(1, 4);

  const primary = signedIn
    ? { href: '/onboarding', label: 'Архив эхлүүлэх' }
    : { href: '/signup', label: 'ROOTS эхлүүлэх' };
  const secondary = signedIn
    ? { href: '/onboarding', label: 'Кодоор нэгдэх' }
    : { href: '/login', label: 'Нэвтрэх' };

  return (
    <div className="editorial min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-[color-mix(in_srgb,#183b32_9%,transparent)] bg-[color-mix(in_srgb,#fffcf8_82%,transparent)] backdrop-blur-xl">
        <div className="ed-shell flex h-[72px] items-center justify-between gap-6 md:h-20">
          <span className="text-[1.05rem] font-semibold uppercase tracking-[0.26em] text-[#183b32]">
            Roots
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={secondary.href}
              className="rounded-full px-4 py-2.5 text-[0.95rem] text-[color-mix(in_srgb,#183b32_62%,transparent)] transition-colors hover:text-[#183b32]"
            >
              {secondary.label}
            </Link>
            <Link
              href={primary.href}
              className="rounded-full bg-[#183b32] px-5 py-2.5 text-[0.95rem] text-[#fbf9f4] transition-colors hover:bg-[#12302a]"
            >
              {primary.label}
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* ================= Hero =========================================
            With a photograph this is a cinema screen and the type sits in its
            lower third. Without one there is nothing to stand in front of, so
            it collapses to a shorter band of paper rather than reserving a
            screenful of empty colour for a picture that is not there. */}
        <section
          className={`relative isolate flex items-end overflow-hidden ${
            hero
              ? 'min-h-[clamp(30rem,84svh,46rem)]'
              : 'min-h-[clamp(21rem,56svh,30rem)]'
          }`}
        >
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element -- static asset, not optimised on purpose.
            <img src={hero} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-br from-[#f7f2e9] via-[#e7ecdf] to-[#cddbcf]"
            />
          )}
          <span
            aria-hidden="true"
            className={
              hero
                ? 'absolute inset-0 bg-gradient-to-t from-[rgb(10_26_21/0.86)] via-[rgb(10_26_21/0.42)] to-transparent'
                : 'absolute inset-0 bg-gradient-to-t from-[rgb(255_252_248/0.92)] to-transparent'
            }
          />

          <div className={`ed-shell relative w-full ${hero ? 'pb-16 pt-28 lg:pb-24' : 'pb-14 pt-16'}`}>
            <p
              className={
                hero
                  ? 'text-[0.7rem] font-medium uppercase tracking-[0.34em] text-[rgb(251_249_244/0.72)]'
                  : 'ed-eyebrow'
              }
            >
              Roots — Гэр бүлийн архив
            </p>

            <h1 className={`ed-display ed-display-xl mt-6 max-w-[14ch] ${hero ? 'text-[#fbf9f4]' : ''}`}>
              Танай гэр бүл.
              <br />
              Танай түүхүүд.
              <br />
              Танай өв.
            </h1>

            <p className={`ed-lead mt-7 ${hero ? 'text-[rgb(251_249_244/0.82)]' : ''}`}>
              Үеийг холбодог хүмүүс, дурсамж, дуу хоолойг нэг газар хадгалж үлдээе.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href={primary.href}
                className={`ed-btn ${hero ? 'bg-[#fbf9f4] text-[#183b32] hover:bg-white' : 'ed-btn-primary'}`}
              >
                {primary.label}
              </Link>
              <Link
                href={secondary.href}
                className={`ed-btn ${hero ? 'border-white/35 text-[#fbf9f4] hover:bg-white/10' : 'ed-btn-ghost'}`}
              >
                {secondary.label}
              </Link>
            </div>
          </div>
        </section>

        {/* ================= What it is =================================== */}
        <section className="ed-band-cream py-20 lg:py-28">
          <div className="ed-shell grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-20">
            <header>
              <p className="ed-eyebrow">Хос бүрээс</p>
              <h2 className="ed-display ed-display-lg mt-6">
                Гэр бүл хосоос
                <br />
                эхэлдэг.
              </h2>
              <p className="ed-lead mt-8">
                ROOTS-ын мод хүмүүсийн жагсаалт биш. Хос, тэдний хүүхдүүд, тэр хүүхдүүдийн
                хос — долоон үе хүртэл доошоо ургана. Хэн хэнтэйгээ ямар холбоотойг
                тайлбар уншилгүй шууд харна.
              </p>
            </header>

            <TreeSketch />
          </div>
        </section>

        {/* ================= What is inside =============================== */}
        <section className="py-20 lg:py-28">
          <div className="ed-shell">
            <header className="max-w-2xl">
              <p className="ed-eyebrow">Архивд юу хадгалагдах вэ</p>
              <h2 className="ed-display ed-display-lg mt-6">
                Зураг, түүх, дуу хоолой — бүгд нэг дор.
              </h2>
            </header>

            <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-3">
              {FEATURES.map((feature, position) => (
                <article key={feature.title}>
                  <Plate src={plates[position] ?? null} tone={position} />
                  <h3 className="mt-6 text-[1.2rem] font-semibold tracking-[-0.03em] text-[#183b32]">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-[color-mix(in_srgb,#183b32_62%,transparent)]">
                    {feature.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ================= Privacy ====================================== */}
        <section className="ed-band-sage py-20 lg:py-28">
          <div className="ed-shell max-w-3xl">
            <p className="ed-eyebrow">Хувийн архив</p>
            <h2 className="ed-display ed-display-lg mt-6">Зөвхөн танай гэр бүл харна.</h2>
            <p className="ed-lead mt-8 max-w-[52ch]">
              ROOTS нээлттэй сүлжээ биш. Танай архивыг зөвхөн та урьсан хүмүүс — эсвэл
              танай гэр бүлийн кодыг мэдэх хүмүүс — үзнэ. Хайлтын системд гарахгүй,
              зар сурталчилгаанд ашиглагдахгүй.
            </p>
          </div>
        </section>

        {/* ================= Closing ====================================== */}
        <section className="ed-shell py-20 text-center lg:py-28">
          <h2 className="ed-display ed-display-lg mx-auto max-w-[20ch]">
            Танайхны түүх хаана амьдрах вэ?
          </h2>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href={primary.href} className="ed-btn ed-btn-primary">
              {primary.label}
            </Link>
            <Link href={secondary.href} className="ed-btn ed-btn-ghost">
              {secondary.label}
            </Link>
          </div>
        </section>
      </main>

      <footer className="ed-shell ed-hair flex flex-wrap items-center justify-between gap-4 py-10">
        <p className="ed-eyebrow">Roots</p>
        <p className="ed-meta">Гэр бүлийн дурсамжийн хувийн архив</p>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    title: 'Дурсамж',
    body: 'Хуучин зураг, захидал, гэрэл зургийн ард бичсэн тэмдэглэл — бүгд түүхтэйгээ хамт.',
  },
  {
    title: 'Дуу хоолой',
    body: 'Хорин асуулт асууж, хариултыг нь өвөө эмээгийн өөрийнх нь хоолойгоор үлдээнэ.',
  },
  {
    title: 'Он цаг',
    body: 'Гэрлэлт, төрөлт, нүүдэл, дурсамж — гэр бүлийн он цагийн хэлхээ өөрөө бүрдэнэ.',
  },
] as const;

/**
 * A warm plate that holds the space a photograph will fill.
 *
 * The empty state is a band, not a portrait: 4:5 is the right shape for a face
 * and the wrong shape for a field of colour, which just reads as a missing
 * image the taller it gets.
 */
function Plate({ src, tone }: { src: string | null; tone: number }) {
  const grounds = [
    'from-[#f7f2e9] to-[#cddbcf]',
    'from-[#f3d8d4] to-[#f7f2e9]',
    'from-[#e7ecdf] to-[#c9a96e]/40',
  ];

  return (
    <div
      className={`ed-frame bg-gradient-to-br ${src ? 'aspect-4/5' : 'aspect-16/10'} ${
        grounds[tone] ?? grounds[0]
      }`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- static asset.
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : null}
    </div>
  );
}

/**
 * The product's grammar, drawn.
 *
 * Two portraits in one plate is a couple; a single portrait is a person; a
 * person who marries becomes a couple in the same place. Explaining that in a
 * paragraph takes longer than showing it, so this shows it — with no real
 * family in it, and no interaction to invite.
 */
function TreeSketch() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-lg select-none">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 260"
        fill="none"
        preserveAspectRatio="none"
      >
        <path
          d="M200 96 C200 130, 96 130, 96 168"
          stroke="color-mix(in srgb, #183b32 22%, transparent)"
          strokeWidth="1.2"
        />
        <path
          d="M200 96 C200 130, 200 130, 200 168"
          stroke="color-mix(in srgb, #183b32 22%, transparent)"
          strokeWidth="1.2"
        />
        <path
          d="M200 96 C200 130, 304 130, 304 168"
          stroke="color-mix(in srgb, #183b32 22%, transparent)"
          strokeWidth="1.2"
        />
      </svg>

      <div className="relative flex justify-center">
        <SketchCard kind="couple" name="Ану & Бат" meta="1998 оноос хамтдаа" />
      </div>

      <div className="relative mt-16 grid grid-cols-3 gap-4">
        <SketchCard kind="person" name="Сараа" meta="2002" />
        <SketchCard kind="couple" name="Болд & Ану" meta="2024 оноос" />
        <SketchCard kind="person" name="Нараа" meta="2007" />
      </div>

      <p className="mt-8 text-center text-[0.8rem] text-[color-mix(in_srgb,#183b32_48%,transparent)]">
        Хүүхэд гэрлэхэд түүний хөрөг хосын карт болж хувирна.
      </p>
    </div>
  );
}

function SketchCard({ kind, name, meta }: { kind: 'couple' | 'person'; name: string; meta: string }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-[color-mix(in_srgb,#183b32_12%,transparent)] bg-[#fffcf8] shadow-[0_14px_34px_-28px_rgba(24,59,50,0.5)]">
      <div className={`flex gap-[2px] ${kind === 'couple' ? 'h-20' : 'h-16'}`}>
        <span className="flex-1 bg-gradient-to-br from-[#f2ece1] to-[#bdd0c2]" />
        {kind === 'couple' ? (
          <span className="flex-1 bg-gradient-to-br from-[#f7f2e9] to-[#cddbcf]" />
        ) : null}
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-[0.72rem] font-medium text-[#183b32]">{name}</p>
        <p className="truncate text-[0.62rem] text-[color-mix(in_srgb,#183b32_50%,transparent)]">{meta}</p>
      </div>
    </div>
  );
}
