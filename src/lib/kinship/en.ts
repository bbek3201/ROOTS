import type { RelationshipDescriptor, GenderBucket } from '@/lib/relationships/types';
import type { KinshipLocale, KinshipTerm } from './types';

/**
 * English kinship terminology.
 *
 * Kept structurally identical to the Mongolian locale — same descriptor in,
 * same shape out — which is the proof that the relationship engine itself
 * carries no language assumptions. Adding a third language means adding one
 * file, not touching the engine.
 */

const ORDINALS = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'];

function ordinal(n: number): string {
  return ORDINALS[n] ?? `${n}th`;
}

function greats(count: number): string {
  if (count <= 0) return '';
  if (count === 1) return 'Great-';
  return `${count}× Great-`;
}

function byGender(gender: GenderBucket, male: string, female: string, neutral: string): string {
  if (gender === 'male') return male;
  if (gender === 'female') return female;
  return neutral;
}

export const enKinship: KinshipLocale = {
  code: 'en',
  name: 'English',
  self: 'You',
  unknown: {
    label: 'Unknown',
    confidence: 'generic',
    note: 'No relationship can be traced from the information stored so far.',
  },

  describe(descriptor: RelationshipDescriptor): KinshipTerm {
    const g = descriptor.targetGender;

    switch (descriptor.kind) {
      case 'self':
        return { label: 'You', confidence: 'standard' };

      case 'partner':
        return { label: byGender(g, 'Husband', 'Wife', 'Partner'), confidence: 'standard' };

      case 'ancestor': {
        if (descriptor.up === 1) {
          const base = byGender(g, 'Father', 'Mother', 'Parent');
          if (descriptor.edgeType === 'adoptive') return { label: `Adoptive ${base.toLowerCase()}`, confidence: 'standard' };
          if (descriptor.edgeType === 'step') return { label: `Step-${base.toLowerCase()}`, confidence: 'standard' };
          return { label: base, confidence: 'standard' };
        }
        const stem = byGender(g, 'grandfather', 'grandmother', 'grandparent');
        const label = `${greats(descriptor.up - 2)}${stem}`;
        const side = descriptor.side === 'paternal' ? 'Paternal' : descriptor.side === 'maternal' ? 'Maternal' : null;
        return {
          label: label.charAt(0).toUpperCase() + label.slice(1),
          confidence: 'standard',
          ...(side ? { note: `${side} line.` } : {}),
        };
      }

      case 'descendant': {
        if (descriptor.down === 1) {
          return { label: byGender(g, 'Son', 'Daughter', 'Child'), confidence: 'standard' };
        }
        const stem = byGender(g, 'grandson', 'granddaughter', 'grandchild');
        const label = `${greats(descriptor.down - 2)}${stem}`;
        return { label: label.charAt(0).toUpperCase() + label.slice(1), confidence: 'standard' };
      }

      case 'sibling': {
        const base = byGender(g, 'Brother', 'Sister', 'Sibling');
        const label = descriptor.half ? `Half-${base.toLowerCase()}` : base;
        const age = descriptor.relativeAge;
        return {
          label,
          confidence: 'standard',
          ...(age && age !== 'unknown' ? { note: `${age === 'older' ? 'Older' : 'Younger'} than you.` } : {}),
        };
      }

      case 'pibling': {
        const stem = byGender(g, 'uncle', 'aunt', 'aunt or uncle');
        const label = `${greats(descriptor.removed ?? 0)}${stem}`;
        const side = descriptor.side === 'paternal' ? 'Paternal' : descriptor.side === 'maternal' ? 'Maternal' : null;
        return {
          label: label.charAt(0).toUpperCase() + label.slice(1),
          confidence: 'standard',
          ...(side ? { note: `${side} side.` } : {}),
        };
      }

      case 'nibling': {
        const stem = byGender(g, 'nephew', 'niece', 'nibling');
        const label = `${greats(descriptor.removed ?? 0)}${stem}`;
        return { label: label.charAt(0).toUpperCase() + label.slice(1), confidence: 'standard' };
      }

      case 'cousin': {
        const degree = descriptor.degree ?? 1;
        const removed = descriptor.removed ?? 0;
        const base = `${ordinal(degree).charAt(0).toUpperCase()}${ordinal(degree).slice(1)} cousin`;
        if (removed === 0) return { label: base, confidence: 'standard' };
        return {
          label: `${base}, ${removed === 1 ? 'once' : removed === 2 ? 'twice' : `${removed} times`} removed`,
          confidence: 'standard',
        };
      }

      case 'in_law': {
        if (descriptor.up === 1 && descriptor.down === 0) {
          return { label: byGender(g, 'Father-in-law', 'Mother-in-law', 'Parent-in-law'), confidence: 'standard' };
        }
        if (descriptor.up === 0 && descriptor.down === 1) {
          return { label: byGender(g, 'Son-in-law', 'Daughter-in-law', 'Child-in-law'), confidence: 'standard' };
        }
        if (descriptor.up === 1 && descriptor.down === 1) {
          return { label: byGender(g, 'Brother-in-law', 'Sister-in-law', 'Sibling-in-law'), confidence: 'standard' };
        }
        return { label: 'Relative by marriage', confidence: 'generic' };
      }

      case 'step':
        return { label: 'Step-relative', confidence: 'generic' };

      case 'unrelated':
      default:
        return enKinship.unknown;
    }
  },
};
