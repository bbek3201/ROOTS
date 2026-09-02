import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'ember' | 'gold' | 'sage' | 'danger';

const TONES: Record<Tone, string> = {
  neutral: 'bg-parchment-deep text-ink-soft border-line',
  ember: 'bg-ember-wash text-ember border-ember/25',
  gold: 'bg-gold-wash text-gold border-gold/25',
  sage: 'bg-sage-wash text-sage border-sage/25',
  danger: 'bg-danger-wash text-danger border-danger/25',
};

export function Badge({
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * The provenance badge. This is a product-critical component, not decoration:
 * it is how a reader tells a verified record from a relative's recollection
 * from an AI-organised summary. All three appear side by side throughout ROOTS
 * and must never look alike.
 */
export function ProvenanceBadge({
  kind,
  isMock = false,
}: {
  kind: 'verified' | 'family_memory' | 'ai' | 'unconfirmed' | 'disputed';
  isMock?: boolean;
}) {
  switch (kind) {
    case 'verified':
      return <Badge tone="sage">Баримтжсан</Badge>;
    case 'family_memory':
      return <Badge tone="gold">Гэр бүлийн дурсамж</Badge>;
    case 'ai':
      return (
        <Badge tone="ember">
          {isMock ? 'AI (туршилтын горим)' : 'AI-аар эмхэтгэсэн'}
        </Badge>
      );
    case 'unconfirmed':
      return <Badge tone="ember">Батлагдаагүй</Badge>;
    case 'disputed':
      return <Badge tone="danger">Зөрчилтэй</Badge>;
  }
}
