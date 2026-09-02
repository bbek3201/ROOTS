import type {
  CoupleNode,
  FamilyGraph,
  GenderBucket,
  ParentChildEdge,
  PersonNode,
} from '../types';

/**
 * A test family, five generations deep.
 *
 * This is TEST DATA ONLY — it is never imported by application code and never
 * written to a database. ROOTS ships with no sample family: an empty archive
 * that says "add the first person" is honest, and a fake one is not.
 *
 *   Лхагва ❤ Долгор                                    (gen 1)
 *     └── Дорж ❤ Цэрэн                                 (gen 2)
 *           ├── Бат ❤ Саруул  (1986)                   (gen 3)
 *           │     ├── Тэмүүлэн ❤ Хулан                 (gen 4)
 *           │     │     └── Тэмүүжин                   (gen 5)
 *           │     └── Номин ❤ Эрдэнэ                   (gen 4)
 *           │           └── Сарнай                     (gen 5)
 *           ├── Бат ❤ Цэцэг → Мөнх   (half-sibling)    (gen 4)
 *           ├── Оюун ❤ Бямба                           (gen 3)
 *           │     └── Ану                              (gen 4)
 *           └── Ганбат                                 (gen 3)
 *
 *   Зул — deliberately unconnected, to prove "unrelated" is a real answer.
 */

let counter = 0;
const ids = new Map<string, string>();

/** Stable, readable uuid-shaped ids so failures name a person, not a hash. */
function id(key: string): string {
  const existing = ids.get(key);
  if (existing) return existing;
  counter += 1;
  const value = `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
  ids.set(key, value);
  return value;
}

function person(
  key: string,
  gender: GenderBucket,
  birthDate: string | null,
  extra: Partial<PersonNode> = {},
): PersonNode {
  return {
    id: id(key),
    first_name: key,
    last_name: null,
    nickname: null,
    gender,
    birth_date: birthDate,
    death_date: null,
    life_status: 'unknown',
    generation: null,
    is_archived: false,
    occupation: null,
    birth_place_id: null,
    profile_photo_media_id: null,
    ...extra,
  };
}

function couple(key: string, a: string, b: string | null, marriageDate: string | null = null): CoupleNode {
  // The database stores partners in canonical uuid order; mirror that here so
  // the fixture exercises the same shape the app actually receives.
  const [personA, personB] = b === null
    ? [id(a), null]
    : [id(a) < id(b) ? id(a) : id(b), id(a) < id(b) ? id(b) : id(a)];
  return {
    id: id(key),
    person_a_id: personA as string,
    person_b_id: personB,
    relationship_type: 'marriage',
    status: 'together',
    marriage_date: marriageDate,
    relationship_start: marriageDate,
    relationship_end: null,
  };
}

function childOf(coupleKey: string, parents: string[], child: string): ParentChildEdge[] {
  return parents.map((parent) => ({
    parent_id: id(parent),
    child_id: id(child),
    couple_id: id(coupleKey),
    relationship_type: 'biological' as const,
  }));
}

export const P = {
  lhagva: 'Лхагва', dolgor: 'Долгор',
  dorj: 'Дорж', tseren: 'Цэрэн',
  bat: 'Бат', saruul: 'Саруул', tsetseg: 'Цэцэг',
  oyun: 'Оюун', byamba: 'Бямба',
  ganbat: 'Ганбат',
  temuulen: 'Тэмүүлэн', khulan: 'Хулан',
  nomin: 'Номин', erdene: 'Эрдэнэ',
  munkh: 'Мөнх',
  anu: 'Ану',
  temuujin: 'Тэмүүжин',
  sarnai: 'Сарнай',
  zul: 'Зул',
} as const;

export function personId(key: string): string {
  return id(key);
}

export function buildTestFamily(): FamilyGraph {
  const people: PersonNode[] = [
    person(P.lhagva, 'male', '1900-01-01'),
    person(P.dolgor, 'female', '1905-01-01'),
    person(P.dorj, 'male', '1930-03-12'),
    person(P.tseren, 'female', '1933-07-02'),
    person(P.bat, 'male', '1958-04-19'),
    person(P.saruul, 'female', '1961-11-05'),
    person(P.tsetseg, 'female', '1963-02-14'),
    person(P.oyun, 'female', '1961-06-30'),
    person(P.byamba, 'male', '1959-09-09'),
    person(P.ganbat, 'male', '1965-01-20'),
    person(P.temuulen, 'male', '1988-05-03'),
    person(P.khulan, 'female', '1990-08-17'),
    person(P.nomin, 'female', '1990-12-01'),
    person(P.erdene, 'male', '1989-03-22'),
    person(P.munkh, 'male', '1995-07-11'),
    person(P.anu, 'female', '1992-10-08'),
    person(P.temuujin, 'male', '2015-02-02'),
    person(P.sarnai, 'female', '2018-06-14'),
    person(P.zul, 'male', '1970-01-01'),
  ];

  const couples: CoupleNode[] = [
    couple('c0', P.lhagva, P.dolgor, '1928-01-01'),
    couple('c1', P.dorj, P.tseren, '1956-05-01'),
    couple('c2', P.bat, P.saruul, '1986-06-14'),
    couple('c3', P.oyun, P.byamba, '1988-02-20'),
    couple('c4', P.temuulen, P.khulan, '2013-09-01'),
    couple('c5', P.nomin, P.erdene, '2016-05-20'),
    couple('c6', P.bat, P.tsetseg, null),
  ];

  const parentChild: ParentChildEdge[] = [
    ...childOf('c0', [P.lhagva, P.dolgor], P.dorj),
    ...childOf('c1', [P.dorj, P.tseren], P.bat),
    ...childOf('c1', [P.dorj, P.tseren], P.oyun),
    ...childOf('c1', [P.dorj, P.tseren], P.ganbat),
    ...childOf('c2', [P.bat, P.saruul], P.temuulen),
    ...childOf('c2', [P.bat, P.saruul], P.nomin),
    ...childOf('c6', [P.bat, P.tsetseg], P.munkh),
    ...childOf('c3', [P.oyun, P.byamba], P.anu),
    ...childOf('c4', [P.temuulen, P.khulan], P.temuujin),
    ...childOf('c5', [P.nomin, P.erdene], P.sarnai),
  ];

  return {
    family_id: '00000000-0000-4000-8000-ffffffffffff',
    people,
    couples,
    parent_child: parentChild,
  };
}
