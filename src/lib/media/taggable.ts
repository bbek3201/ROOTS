import { fullName, lifespan } from '@/lib/format';
import type { FamilyIndex } from '@/lib/relationships/graph';
import type { TaggablePerson } from '@/components/media/PhotoTagger';

export type { TaggablePerson };

/**
 * The roster the tag picker offers, ordered the way a person scans a list:
 * living relatives before the dead, then alphabetically. Archived people are
 * left out — they were removed from the family's view on purpose, and a picker
 * is not the place to bring them back.
 */
export function taggablePeople(index: FamilyIndex): TaggablePerson[] {
  return [...index.people.values()]
    .filter((person) => !person.is_archived)
    .map((person) => ({
      id: person.id,
      name: fullName(person),
      years: lifespan(person) || null,
      deceased: person.life_status === 'deceased',
    }))
    .sort((a, b) => {
      if (a.deceased !== b.deceased) return a.deceased ? 1 : -1;
      return a.name.localeCompare(b.name, 'mn');
    })
    .map(({ deceased: _deceased, ...person }) => person);
}
