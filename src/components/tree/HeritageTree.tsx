'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';

export interface HeritagePerson {
  id: string;
  name: string;
  years: string;
  /** A line under the name — occupation, birthplace, whatever is recorded. */
  note: string | null;
  photoUrl: string | null;
  initial: string;
}

export interface HeritageCard {
  id: string;
  href: string;
  people: HeritagePerson[];
  paired: boolean;
}

export interface HeritageLevel {
  depth: number;
  /** "Me & My Love", "Our Parents", "Grandparents" … */
  label: string;
  mark: string;
  cards: HeritageCard[];
}

/**
 * The tree as a lineage rather than as a diagram.
 *
 * The pan-and-zoom canvas is still the right tool for holding seven
 * generations in one field, and it is still here — one button away. But it
 * answers "how is this family shaped", and most people arriving at a family
 * tree are asking something smaller and warmer: who am I from? This view
 * answers that one, reading downward from the viewer's own couple through
 * their parents and grandparents, one band at a time.
 *
 * Bands are numbered from the person looking, never from the database. The
 * `generation` column counts from the oldest known ancestor because that is the
 * only numbering that survives someone adding a great-grandmother; it is the
 * right thing to store and a meaningless thing to show.
 */
export function HeritageTree({
  levels,
  deeper,
  canEdit,
  hasStory,
  children,
}: {
  levels: HeritageLevel[];
  /** How many ancestors are further up than the bands reach. */
  deeper: number;
  canEdit: boolean;
  hasStory: boolean;
  /** The pan-and-zoom canvas, revealed by the action bar. */
  children: ReactNode;
}) {
  const [canvasOpen, setCanvasOpen] = useState(false);

  return (
    <div className="heritage">
      {/* ================= Header ========================================= */}
      <section className="ed-shell pt-16 pb-12 text-center sm:pt-24">
        <p aria-hidden="true" className="text-2xl">✨ 🌳 ✨</p>

        <h2 className="ed-display ed-display-lg mx-auto mt-6 max-w-[20ch] text-balance text-[var(--hx-text)]">
          Бидний үеийн үндэс
        </h2>

        <p className="mx-auto mt-6 max-w-[42ch] text-[1.05rem] leading-relaxed text-[var(--hx-muted)]">
          “Хоёрын түүх эхэлсэн газраас олон үеийн замнал уулзана.”
        </p>
      </section>

      <div className="ed-shell">
        <hr className="border-t border-[var(--hx-hair)]" />
      </div>

      {/* ================= Nobody in the tree yet ========================= */}
      {/* The empty state lives INSIDE the heritage surface rather than on the
          paper above it. An archive that is honestly empty should still look
          like the room it is going to fill — and the first person is added from
          the same screen the tree will appear on, not from a different one. */}
      {levels.length === 0 ? (
        <section className="ed-shell py-20 text-center lg:py-28">
          <p aria-hidden="true" className="text-3xl">🌱</p>
          <h3 className="ed-display ed-display-md mx-auto mt-6 max-w-[20ch] text-balance text-[var(--hx-text)]">
            Энэ мод хараахан ургаагүй байна
          </h3>
          <p className="mx-auto mt-5 max-w-[38ch] leading-relaxed text-[var(--hx-muted)]">
            Хамгийн ахмад хүнээсээ эхэлье. Хос, хүүхдүүдийг нэмэхэд ураг төрлийн
            холбоо өөрөө бүрдэнэ.
          </p>
          {canEdit ? (
            <Link href="/family/add-person" className="hx-btn mt-8">
              <span aria-hidden="true">✨</span> Эхний хүнээ нэмэх
            </Link>
          ) : null}
        </section>
      ) : null}

      {/* ================= The bands ====================================== */}
      <section className={levels.length === 0 ? 'hidden' : 'ed-shell py-14 lg:py-20'}>
        {levels.map((level, position) => (
          <div key={level.depth}>
            <p className="hx-eyebrow">
              [ {level.label} ] <span aria-hidden="true">{level.mark}</span>
            </p>

            {/* Two across on anything wider than a phone, because a couple is
                one unit and splitting the pair onto two rows misstates the
                shape of the family. One across on a phone, where two portraits
                side by side are two thumbnails and neither is a face. */}
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:gap-6">
              {level.cards.map((card) => (
                // A band holding one couple — almost always the viewer's own —
                // runs the full width. Left in a half-width column it sits off
                // to one side with the thread descending past it, which reads
                // as a missing second card rather than as a single union.
                <li key={card.id} className={level.cards.length === 1 ? 'sm:col-span-2' : undefined}>
                  <Link href={card.href} className="hx-card block h-full p-5">
                    {/* Stacked on a phone, side by side from a tablet up. Two
                        names in one 390px row truncate to "Б…" and "Га…", and a
                        family tree that cannot show a name has failed at the
                        only thing it is for. The heart stays between them in
                        both orientations, so the pair still reads as one unit. */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                      <Person person={card.people[0]!} />

                      {card.paired && card.people[1] ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="self-center text-lg leading-none text-[var(--hx-heart)]"
                          >
                            ❤
                          </span>
                          <Person person={card.people[1]} />
                        </>
                      ) : null}
                    </div>

                    {card.people.some((person) => person.note) ? (
                      <p className="mt-4 truncate text-sm text-[var(--hx-muted)]">
                        {card.people.map((person) => person.note).filter(Boolean).join(' · ')}
                      </p>
                    ) : null}

                    <p className="mt-4 text-sm text-[var(--hx-gold)]">
                      {card.paired ? 'Хосыг үзэх' : 'Профайл үзэх'} →
                    </p>
                  </Link>
                </li>
              ))}
            </ul>

            {/* The thread down to the generation above. Not drawn after the
                last band — a line into nothing reads as missing data. */}
            {position < levels.length - 1 ? (
              // The thread points the way the page is read: downward, into the
              // generation before. An upward arrow is true of the tree and
              // false of the scroll, and the scroll is what the hand is doing.
              <div aria-hidden="true" className="flex flex-col items-center py-7">
                <span className="hx-thread h-14" />
                <span className="mt-1 text-[var(--hx-gold)]">▼</span>
              </div>
            ) : null}
          </div>
        ))}

        {/* ================= Deeper ancestry =============================== */}
        {deeper > 0 ? (
          <div className="mt-12 text-center">
            <div aria-hidden="true" className="mx-auto mb-7 flex flex-col items-center">
              <span className="hx-thread h-14" />
            </div>
            <p className="hx-eyebrow">[ Гүн үндэс ]</p>
            <p className="mx-auto mt-4 max-w-[36ch] text-[var(--hx-muted)]">
              Дээш нь бүртгэгдсэн бас {deeper} хүн байна.
            </p>
            <button
              type="button"
              onClick={() => setCanvasOpen(true)}
              className="hx-btn mt-6"
            >
              <span aria-hidden="true">✨</span> Гүн удмаа дэлгэх
            </button>
          </div>
        ) : null}
      </section>

      <div className="ed-shell">
        <hr className="border-t border-[var(--hx-hair)]" />
      </div>

      {/* ================= The canvas, on request ========================= */}
      {/* Kept, not replaced. Bands answer "who am I from"; the canvas answers
          "what shape is this family", and a family of ninety needs both. It is
          closed by default because a pan-and-zoom surface that opens under a
          thumb eats the page's scroll. */}
      <section className="ed-shell py-14 lg:py-20">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {levels.length > 0 ? (
            <button type="button" onClick={() => setCanvasOpen((open) => !open)} className="hx-btn">
              <span aria-hidden="true">🔍</span> {canvasOpen ? 'Модыг хаах' : 'Бүтэн мод'}
            </button>
          ) : null}

          {canEdit ? (
            <Link href="/family/add-person" className="hx-btn">
              <span aria-hidden="true">➕</span> Хүн нэмэх
            </Link>
          ) : null}

          <Link href="/family/story" className="hx-btn">
            <span aria-hidden="true">📜</span> {hasStory ? 'Гэр бүлийн түүх' : 'Түүхээ бичих'}
          </Link>
        </div>

        {canvasOpen ? (
          <div
            id="heritage-canvas"
            className="relative mt-10 h-[clamp(28rem,74svh,52rem)] overflow-hidden rounded-[24px] border border-[color-mix(in_srgb,#d4af37_22%,transparent)] bg-[#fffcf8]"
          >
            {/* The canvas keeps its own warm ground: it is a drawing on paper,
                and recolouring 1300 lines of it for one surrounding surface
                would be a second tree to maintain. */}
            {children}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Person({ person }: { person: HeritagePerson }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <Portrait person={person} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[1.02rem] font-medium text-[var(--hx-text)]">
          <span aria-hidden="true" className="mr-1 text-[var(--hx-gold)]">✨</span>
          {person.name}
        </span>
        {person.years ? (
          <span className="block whitespace-nowrap text-xs text-[var(--hx-faint)]">
            {person.years}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function Portrait({ person }: { person: HeritagePerson }) {
  return (
    <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[var(--hx-raised)] ring-1 ring-[color-mix(in_srgb,#d4af37_30%,transparent)]">
      {person.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires.
        <img
          src={person.photoUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm text-[var(--hx-faint)]">
          {person.initial}
        </span>
      )}
    </span>
  );
}
