import Link from 'next/link';
import { PlayIcon } from '@/components/icons';

/**
 * Recorded stories.
 *
 * A transcript is a document; a voice is a person. So this section is the one
 * place on the page where the photograph steps back and a name, a line of a
 * question, and a play affordance carry it instead.
 *
 * The control is a link into the interview, not a fake inline player: the
 * audio lives with its questions and its transcript, and a play button that
 * only navigates is a lie about what pressing it does.
 */
export interface VoiceEntry {
  id: string;
  href: string;
  /** Whose voice it is. */
  subject: string;
  title: string;
  meta: string;
}

export function Voices({ entries }: { entries: VoiceEntry[] }) {
  return (
    <ul className="mt-12 divide-y divide-[color-mix(in_srgb,#183b32_12%,transparent)] border-y border-[color-mix(in_srgb,#183b32_12%,transparent)]">
      {entries.map((entry) => (
        <li key={entry.id}>
          <Link href={entry.href} className="group flex items-center gap-6 py-6 sm:gap-8 sm:py-7">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,#183b32_18%,transparent)] text-[#183b32] transition-colors group-hover:border-transparent group-hover:bg-[#183b32] group-hover:text-[#fbf9f4]">
              <PlayIcon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[1.3rem] font-semibold leading-tight tracking-[-0.03em] text-[#183b32] sm:text-[1.6rem]">
                {entry.subject}
              </span>
              <span className="mt-1.5 block truncate text-[0.95rem] text-[color-mix(in_srgb,#183b32_60%,transparent)]">
                {entry.title}
              </span>
            </span>
            <span className="ed-eyebrow hidden shrink-0 sm:block">{entry.meta}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
