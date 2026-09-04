import type { SVGProps } from 'react';

/**
 * Inline icon set.
 *
 * Hand-drawn as SVG rather than pulled from a library: it is a few hundred
 * bytes, it inherits currentColor, and it keeps the bundle free of an icon
 * dependency for the sake of a dozen glyphs.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 22, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 11.2 12 4.5l8 6.7" />
    <path d="M6.2 10.4V19a.8.8 0 0 0 .8.8h10a.8.8 0 0 0 .8-.8v-8.6" />
    <path d="M10 20v-5h4v5" />
  </Icon>
);

export const TreeIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="7" cy="5" r="2.3" />
    <circle cx="17" cy="5" r="2.3" />
    <circle cx="5" cy="19" r="2.1" />
    <circle cx="12" cy="19" r="2.1" />
    <circle cx="19" cy="19" r="2.1" />
    <path d="M9.3 5h5.4M12 6v5M5 16.9V12h14v4.9M12 11v5.9" />
  </Icon>
);

export const MemoryIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="M3 16.2l4.6-4.1a2 2 0 0 1 2.7.05L15 16.5m0 0l2.1-1.9a2 2 0 0 1 2.7.06L21 15.7" />
  </Icon>
);

export const MicIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21.5M8.5 21.5h7" />
  </Icon>
);

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Icon>
);

export const PersonIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Icon>
);

export const HeartIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
  </Icon>
);

/** A sealed letter. Drawn closed on purpose — an open envelope reads as "sent". */
export const LetterIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path d="M3.6 7 12 13l8.4-6" />
  </Icon>
);

/** A closed padlock: the shackle is drawn down, which is what "not yet" looks like. */
export const LockIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
    <path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" />
    <path d="M12 14.4v2" />
  </Icon>
);

/** The same lock, open. Only ever shown once the date has actually arrived. */
export const UnlockIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
    <path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.3-1.3" />
    <path d="M12 14.4v2" />
  </Icon>
);

export const ClockIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </Icon>
);

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5.5v13M5.5 12h13" />
  </Icon>
);

export const PlayIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 5.5l10 6.5-10 6.5z" fill="currentColor" stroke="none" />
  </Icon>
);

export const PauseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 5.5v13M15 5.5v13" strokeWidth={2.2} />
  </Icon>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9.5 5.5l6.5 6.5-6.5 6.5" />
  </Icon>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14.5 5.5L8 12l6.5 6.5" />
  </Icon>
);

export const SparkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
  </Icon>
);

export const MapPinIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 21s6.5-5.6 6.5-10.4A6.5 6.5 0 0 0 5.5 10.6C5.5 15.4 12 21 12 21z" />
    <circle cx="12" cy="10.4" r="2.4" />
  </Icon>
);

export const ArchiveIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="4" width="18" height="4.5" rx="1.2" />
    <path d="M4.8 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11.4a1.5 1.5 0 0 0 1.5-1.5V8.5M10 12.5h4" />
  </Icon>
);

export const ShieldIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3l7 2.8v5.4c0 4.4-3 8.1-7 9.3-4-1.2-7-4.9-7-9.3V5.8z" />
    <path d="M9.2 12.2l2 2 3.6-3.8" />
  </Icon>
);

export const EyeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </Icon>
);

export const SpeakerIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
    <path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.8a7.5 7.5 0 0 1 0 10.4" />
  </Icon>
);
