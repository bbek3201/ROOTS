import { cn } from '@/lib/cn';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ember text-white border-transparent hover:bg-ember-soft active:bg-ember-soft',
  secondary: 'bg-surface text-ink border-line hover:border-ember/50',
  ghost: 'bg-transparent text-ink-soft border-transparent hover:bg-parchment-deep',
  danger: 'bg-danger-wash text-danger border-danger/25 hover:border-danger/60',
};

const SIZES: Record<Size, string> = {
  // 44px minimum touch target on every size — this is a phone-first app used by
  // grandparents, and a 32px button is not reachable in practice.
  sm: 'text-sm px-3.5 min-h-11 gap-1.5',
  md: 'text-[0.95rem] px-4 min-h-12 gap-2',
  lg: 'text-base px-5 min-h-14 gap-2.5 font-medium',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-full border font-medium',
        'transition-colors duration-150 select-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
