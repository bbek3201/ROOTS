import Link from 'next/link';
import { ShieldIcon } from '@/components/icons';
import type { ReactNode } from 'react';

/**
 * The shell around sign-in and sign-up.
 *
 * The rest of ROOTS is cream paper; this is the one screen that is a deep
 * green cover, because it is the only screen a person sees before they belong
 * to anything. It has to say what the app is in two seconds — a family tree,
 * private — which is why the artwork behind the wordmark is the tree itself
 * and not a decorative blob.
 *
 * The two modes are real routes rather than client state: a person arriving
 * from an invite link, a password manager or the browser's back button lands
 * on the form they expect, and the switch below stays a plain link.
 */
export function AuthShell({
  mode,
  title,
  intro,
  switchHref,
  children,
}: {
  mode: 'signin' | 'signup';
  title: string;
  intro: string;
  /** Preserves ?next / ?invite across the segmented switch. */
  switchHref: { signin: string; signup: string };
  children: ReactNode;
}) {
  return (
    <main id="main" className="flex min-h-dvh flex-col bg-parchment">
      <header className="relative overflow-hidden rounded-b-4xl bg-brand-deep px-6 pb-16 pt-12 text-brand-fg">
        <TreeArtwork />

        <div className="relative mx-auto max-w-lg">
          <Link href="/" className="flex items-center gap-2 font-display text-sm tracking-[0.32em]">
            <LeafMark />
            ROOTS
          </Link>
          <h1 className="mt-5 max-w-[15ch] text-balance font-display text-[2rem] leading-[1.15]">
            {title}
          </h1>
          <p className="mt-3 max-w-[34ch] text-balance text-[0.95rem] leading-relaxed text-brand-fg/75">
            {intro}
          </p>
        </div>
      </header>

      {/* The card lifts over the green edge so the two halves read as one
          screen rather than a banner with a form beneath it. */}
      <div className="relative z-10 -mt-9 flex-1 px-5 pb-10">
        <div className="mx-auto max-w-lg">
          <div className="card overflow-hidden p-5 shadow-(--shadow-lift)">
            <nav
              aria-label="Нэвтрэх хэлбэр"
              className="mb-5 grid grid-cols-2 gap-1 rounded-pill bg-parchment-deep p-1"
            >
              <ModeTab href={switchHref.signin} active={mode === 'signin'}>
                Нэвтрэх
              </ModeTab>
              <ModeTab href={switchHref.signup} active={mode === 'signup'}>
                Бүртгүүлэх
              </ModeTab>
            </nav>

            {children}
          </div>

          <p className="mx-auto mt-5 flex max-w-[32ch] items-start gap-2 text-center text-xs leading-relaxed text-muted">
            <ShieldIcon size={15} className="mt-px shrink-0 text-sage" />
            <span className="text-left">
              Танай архивыг зөвхөн та урьсан гэр бүлийнхэн харна. Хайлтын систем, гадны хүн
              хэзээ ч хандахгүй.
            </span>
          </p>
        </div>
      </div>
    </main>
  );
}

function ModeTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        'flex min-h-11 items-center justify-center rounded-pill text-[0.95rem] font-medium transition-colors ' +
        (active
          ? 'bg-surface text-forest shadow-(--shadow-soft)'
          : 'text-muted hover:text-ink-soft')
      }
    >
      {children}
    </Link>
  );
}

function LeafMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path
        d="M20 4c0 8.5-4.8 13-11 13H5c0-8.5 4.8-13 11-13h4Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path d="M5 21c1.5-5 4.5-8.5 9-11" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Three generations, drawn as the app draws them. Low contrast on purpose —
 * it is a watermark behind the words, not a diagram to be read.
 */
function TreeArtwork() {
  return (
    <svg
      viewBox="0 0 320 200"
      aria-hidden="true"
      className="pointer-events-none absolute -right-10 -top-6 h-[190px] w-[320px] text-brand-fg opacity-[0.13]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    >
      <circle cx="120" cy="28" r="13" />
      <circle cx="200" cy="28" r="13" />
      <path d="M133 28h54" />
      <path d="M160 41v26M60 67h200M60 67v18M160 67v18M260 67v18" />
      <circle cx="60" cy="98" r="13" />
      <circle cx="160" cy="98" r="13" />
      <circle cx="260" cy="98" r="13" />
      <path d="M160 111v22M110 133h100M110 133v16M210 133v16" />
      <circle cx="110" cy="162" r="13" />
      <circle cx="210" cy="162" r="13" />
    </svg>
  );
}
