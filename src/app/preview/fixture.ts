/**
 * Sample data for the design preview. NEVER imported by the application.
 *
 * ROOTS deliberately ships with no demo family — an empty archive that says
 * "add the first person" is honest, and a fake one is not. This file exists for
 * the other problem: a page whose entire job is how it LOOKS cannot be judged
 * empty, and the components were built with a data/presentation seam precisely
 * so they could be rendered without a session.
 *
 * It lives under /preview, which returns 404 outside development.
 */

/**
 * Stand-in photographs, drawn rather than downloaded.
 *
 * Data URIs so the preview works with no network and no storage bucket, and
 * deliberately abstract: a stock photograph of somebody else's couple would
 * flatter the layout and teach us nothing about how it holds a real family's
 * badly-lit 1998 print.
 */
function plate(from: string, to: string, seed: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
      </linearGradient>
    </defs>
    <rect width="800" height="1000" fill="url(#g)"/>
    <circle cx="${240 + seed * 37}" cy="${330 + seed * 21}" r="${130 + seed * 9}" fill="#ffffff" opacity="0.14"/>
    <circle cx="${520 - seed * 23}" cy="${640 + seed * 13}" r="${190 - seed * 7}" fill="#183b32" opacity="0.10"/>
    <rect y="${760 + seed * 11}" width="800" height="240" fill="#183b32" opacity="0.07"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PHOTOS = [
  plate('#f3d8d4', '#cddbcf', 1),
  plate('#f7f2e9', '#afc7b8', 2),
  plate('#cddbcf', '#c9a96e', 3),
  plate('#eaf0ec', '#f3d8d4', 4),
  plate('#f4f1e7', '#5f7a68', 5),
  plate('#afc7b8', '#183b32', 6),
];

export const NAMES: [string, string] = ['Билэг', 'Сараа'];

export const HOW_WE_MET =
  'Улаанбаатарын нэгэн бороотой намар, номын дэлгүүрийн адилхан тавиур дээр хоёулаа гараа сунгасан. ' +
  'Тэр номыг би авсан. Гэхдээ дараа долоо хоногт нь түүнд бэлэглэсэн.';

export const COVERS = PHOTOS.map((src, index) => ({
  id: `cover-${index}`,
  src,
  alt: 'Дурсамжийн зураг',
}));

export const MEMORIES = [
  { id: 'm1', title: 'Анхны аялал — Токио', description: 'Шинжюкү дээр төөрөөд, эцэст нь жижигхэн рамэнний газар олсон.', date: '2026-03-18', place: 'Токио, Япон', mood: 'Аз жаргалтай', photoCount: 7, videoCount: 1, cover: PHOTOS[0]! },
  { id: 'm2', title: 'Хатан суусан өдөр', description: null, date: '2025-12-24', place: 'Улаанбаатар', mood: 'Дулаахан', photoCount: 3, videoCount: 0, cover: PHOTOS[1]! },
  { id: 'm3', title: 'Тэрэлж, цасан дунд', description: 'Машин суулаа. Гурван цаг тохоо гаргасан.', date: '2026-01-11', place: 'Тэрэлж', mood: 'Хөгжилтэй', photoCount: 12, videoCount: 2, cover: PHOTOS[2]! },
  { id: 'm4', title: 'Ээжийнд анх очсон', description: null, date: '2025-08-02', place: 'Дархан', mood: null, photoCount: 2, videoCount: 0, cover: PHOTOS[3]! },
  { id: 'm5', title: 'Сөүлийн зун', description: null, date: '2026-07-05', place: 'Сөүл, Солонгос', mood: 'Онцгой', photoCount: 21, videoCount: 0, cover: PHOTOS[4]! },
  { id: 'm6', title: 'Гэрээ засаж дуусгасан', description: null, date: '2026-05-30', place: null, mood: 'Тайван', photoCount: 1, videoCount: 0, cover: PHOTOS[5]! },
  { id: 'm7', title: 'Хамгийн эхний өглөө', description: null, date: '2025-06-13', place: null, mood: null, photoCount: 1, videoCount: 0, cover: null },
];

export const LETTERS = [
  { id: 'l1', title: 'Намайг санахдаа нээгээрэй', createdAt: '2026-08-14T09:00:00Z', unlockAt: null, mine: false, sealed: false, unread: true },
  { id: 'l2', title: '30 нас хүрэхэд чинь', createdAt: '2026-02-01T09:00:00Z', unlockAt: '2029-04-12T00:00:00Z', mine: true, sealed: true, unread: false },
  { id: 'l3', title: 'Өчигдрийн маргааны тухай', createdAt: '2026-06-20T09:00:00Z', unlockAt: null, mine: true, sealed: false, unread: false },
  { id: 'l4', title: 'Хэзээ ч уншихгүй байж магадгүй', createdAt: '2025-09-09T09:00:00Z', unlockAt: null, mine: false, sealed: false, unread: false },
];

export const FIRSTS = [
  { key: 'meeting', label: 'Анх уулзсан', prompt: 'Хаана, хэзээ анх тааралдсан бэ?', happenedOn: '2025-06-12', story: 'Номын дэлгүүрийн гуравдугаар тавиур. Хоёулаа адилхан ном барьсан.', imageUrl: PHOTOS[1]! },
  { key: 'date', label: 'Анхны болзоо', prompt: 'Хамгийн анх хамт хаашаа явсан бэ?', happenedOn: '2025-06-19', story: 'Сүхбаатарын талбай, дараа нь хоёр цаг алхсан.', imageUrl: null },
  { key: 'photo', label: 'Анхны хамтын зураг', prompt: 'Хамтдаа авахуулсан хамгийн анхны зураг.', happenedOn: null, story: null, imageUrl: null },
  { key: 'i_love_you', label: 'Анх хайртайгаа хэлсэн', prompt: 'Хэн нь эхэлж хэлсэн бэ?', happenedOn: '2025-09-03', story: 'Тэр эхэлж хэлсэн. Би гурван секунд чимээгүй байсан.', imageUrl: null },
  { key: 'trip', label: 'Анхны аялал', prompt: 'Хамтдаа хамгийн анх хаашаа явсан бэ?', happenedOn: null, story: null, imageUrl: null },
  { key: 'gift', label: 'Анхны бэлэг', prompt: 'Юу байсан, яагаад тэр бэ?', happenedOn: null, story: null, imageUrl: null },
];

export const FUTURE = [
  { id: 'f1', title: '5 жилийн ойдоо нээнэ үү', unlockAt: '2030-06-12T00:00:00Z', body: null, openedAt: null, imageUrl: null },
  { id: 'f2', title: 'Анхны жилийн дараа', unlockAt: '2026-06-12T00:00:00Z', body: 'Энэ жилийг санаж байгаа биз? Бид юу ч мэдэхгүй байсан. Гэхдээ би айгаагүй.', openedAt: null, imageUrl: null },
  { id: 'f3', title: 'Хэцүү өдөр таарвал', unlockAt: '2027-01-01T00:00:00Z', body: null, openedAt: null, imageUrl: null },
];

export const TIMELINE_ENTRIES = [
  { id: 't1', kind: 'first' as const, title: 'Анх уулзсан', date: '2025-06-12', subtitle: null, href: '#', imageUrl: null },
  { id: 't2', kind: 'first' as const, title: 'Анхны болзоо', date: '2025-06-19', subtitle: null, href: '#', imageUrl: null },
  { id: 't3', kind: 'memory' as const, title: 'Ээжийнд анх очсон', date: '2025-08-02', subtitle: 'Дархан', href: '#', imageUrl: PHOTOS[3]! },
  { id: 't4', kind: 'letter' as const, title: 'Хэзээ ч уншихгүй байж магадгүй', date: '2025-09-09', subtitle: null, href: '#', imageUrl: null },
  { id: 't5', kind: 'memory' as const, title: 'Хатан суусан өдөр', date: '2025-12-24', subtitle: 'Улаанбаатар', href: '#', imageUrl: PHOTOS[1]! },
  { id: 't6', kind: 'memory' as const, title: 'Тэрэлж, цасан дунд', date: '2026-01-11', subtitle: 'Тэрэлж', href: '#', imageUrl: PHOTOS[2]! },
  { id: 't7', kind: 'memory' as const, title: 'Анхны аялал — Токио', date: '2026-03-18', subtitle: 'Токио, Япон', href: '#', imageUrl: PHOTOS[0]! },
  { id: 't8', kind: 'voice' as const, title: 'Онгоцны буудал дээр', date: '2026-03-25', subtitle: null, href: '#', imageUrl: null },
  { id: 't9', kind: 'place' as const, title: 'Сөүл', date: '2026-07-05', subtitle: null, href: '#', imageUrl: null },
];

/** The lineage bands, for the heritage tree preview. */
/**
 * The same family the rest of this file describes, read outward from Батзориг.
 *
 * Written as the bands actually arrive: the viewer's own couple at the top,
 * then their parents, then a generation where one grandmother was never
 * photographed, then a couple at the root that nobody photographed at all.
 * That last band is the one worth having in a fixture — a tree of nothing but
 * complete records is a tree nobody has.
 */
export const HERITAGE_LEVELS = [
  {
    depth: 0, label: 'Би ба миний хайр', mark: '💖',
    cards: [{
      id: 'c0', href: '#', paired: true,
      people: [
        { id: 'p1', name: 'Батзориг', years: '1995 –', note: 'Программист', photoUrl: PHOTOS[0]!, initial: 'Б' },
        { id: 'p2', name: 'Намуун', years: '1998 –', note: 'Оюутан', photoUrl: PHOTOS[1]!, initial: 'Н' },
      ],
    }],
  },
  {
    depth: 1, label: 'Бидний эцэг эх', mark: '🌿',
    cards: [
      {
        id: 'c1', href: '#', paired: true,
        people: [
          { id: 'p3', name: 'Эрдэнэбат', years: '1968 –', note: 'Инженер', photoUrl: PHOTOS[2]!, initial: 'Э' },
          { id: 'p4', name: 'Алтантуяа', years: '1970 –', note: 'Эмч', photoUrl: PHOTOS[3]!, initial: 'А' },
        ],
      },
      {
        id: 'c2', href: '#', paired: true,
        people: [
          { id: 'p5', name: 'Мөнхбат', years: '1972 –', note: 'Жолооч', photoUrl: PHOTOS[4]!, initial: 'М' },
          { id: 'p6', name: 'Уянга', years: '1975 –', note: 'Архивч', photoUrl: null, initial: 'У' },
        ],
      },
    ],
  },
  {
    depth: 2, label: 'Өвөө эмээ', mark: '🍂',
    cards: [
      {
        id: 'c3', href: '#', paired: true,
        people: [
          { id: 'p7', name: 'Батболд', years: '1942 – 2010', note: 'Багш · Их тамир', photoUrl: PHOTOS[5]!, initial: 'Б' },
          { id: 'p8', name: 'Сарантуяа', years: '1945 –', note: 'Багш · Архангай', photoUrl: null, initial: 'С' },
        ],
      },
    ],
  },
  {
    depth: 3, label: 'Элэнц хуланц', mark: '🕯️',
    cards: [
      {
        id: 'c4', href: '#', paired: true,
        people: [
          { id: 'p9', name: 'Дамдин', years: '1918 – 1994', note: 'Малчин · Их тамир', photoUrl: null, initial: 'Д' },
          { id: 'p10', name: 'Должин', years: '1921 – 1989', note: null, photoUrl: null, initial: 'Д' },
        ],
      },
    ],
  },
];

/* ---------------------------------------------------------------------------
   A family, invented in full
   ---------------------------------------------------------------------------
   The plates above are abstract on purpose. The WORDS cannot be: a layout that
   has only been seen holding "Lorem ipsum" or a three-word title has not been
   seen at all. Half the design decisions in this product are about what happens
   when a name is long, a story runs four paragraphs, an occupation is missing
   and a date is only a year — and none of those show up against placeholder
   text.

   So the Батболд family is written out properly, with the shape a real archive
   has: a couple at the top nobody photographed, a generation with good records,
   a generation with too many photographs, and gaps where gaps really fall.
   --------------------------------------------------------------------------- */

/**
 * The landscapes in `public/landing/`.
 *
 * Real raster files rather than the drawn plates above, because these stand in
 * for the PHOTOGRAPHS a family puts on its cover — the hero, the wall, the
 * window at the foot of the sidebar. A gradient reads as a missing image at
 * that size; a horizon reads as a picture somebody took.
 *
 * Deliberately still not people. A stock portrait of somebody else's
 * grandmother would flatter every layout in this product and teach us nothing
 * about how it holds a badly-lit print from 1974 — so faces stay abstract and
 * places do not.
 */
export const SCENES = [
  '/landing/01-ug-tsutsval.jpg',
  '/landing/02-zuny-belcheer.jpg',
  '/landing/03-namryn-gerel.jpg',
  '/landing/04-uvliin-uden.jpg',
];

export const FAMILY_NAME = 'Батболдын ураг';

export const VIEWER = { name: 'Ану', avatarUrl: null };

/**
 * The family's own words about itself.
 *
 * Deliberately long, and deliberately uneven — it opens like a record and ends
 * like someone remembering. That is how these are actually written, and a
 * reading column that only ever held two tidy sentences has not been tested.
 */
export const FAMILY_STORY = [
  'Манай ураг Архангай аймгийн Их тамир сумын Цэцэрлэг багаас гаралтай. ' +
    'Бидний мэдэх хамгийн ахмад хүн бол 1918 онд төрсөн Дамдин өвөө. Тэрээр ' +
    'насаараа мал маллаж, дөрвөн хүүхэд өсгөсөн гэдэг. Түүний зураг ганц ч ' +
    'үлдээгүй — зөвхөн нэр, төрсөн он, тэгээд Тамирын голын хөвөөнд байсан ' +
    'хашааных нь байрлал л үлдсэн.',
  'Дамдин өвөөгийн отгон хүү Батболд 1942 онд мэндэлж, 1968 онд Сарантуяа ' +
    'эмээтэй гэр бүл болсон. Тэд хоёулаа багш байсан. Их тамирын сургуульд ' +
    'хорин хоёр жил ажиллаж, гурван хүүхэд өсгөж, 1979 онд Улаанбаатар руу ' +
    'нүүсэн. Батболд өвөө 2010 онд өөд болсон. Сарантуяа эмээ өнөөдөр ч ' +
    'Баянзүрхэд амьдарч байгаа, ярилцлагынхаа арван дөрвөн асуултад хариулсан.',
  'Бидний хамгийн эртний зураг 1971 оных. Хуримын дараа авахуулсан гэрэл зураг ' +
    '— эмээгийн гарт цагаан цэцэг, өвөөгийн зүүн мөрөн дээр нарны туяа. Тэр ' +
    'зургийг Уянга эгч 2019 онд хөдөөнөөс олж ирээд сканердсан. Түүнээс хойш ' +
    'бид энэ архивыг цуглуулж эхэлсэн.',
  'Одоо бид долоон үе, зуун хорин найман хүн. Хамгийн залуу нь 2025 онд ' +
    'төрсөн Ануужин. Хамгийн ахмад нь зурагтай ч үгүй Дамдин өвөө. Хоёулаа ' +
    'нэг модонд байгаа — энэ л бидний хийхийг хүссэн зүйл.',
].join('\n\n');

/** Who is in the tree, and what the family actually recorded about them. */
const PEOPLE = [
  ['Дамдин', '1918 – 1994', 1, 'Малчин · Их тамир'],
  ['Должин', '1921 – 1989', 1, null],
  ['Батболд', '1942 – 2010', 2, 'Багш · Их тамир'],
  ['Сарантуяа', '1945 –', 2, 'Багш · Архангай'],
  ['Эрдэнэбат', '1968 –', 3, 'Инженер'],
  ['Алтантуяа', '1970 –', 3, 'Эмч'],
  ['Мөнхбат', '1972 –', 3, 'Жолооч'],
  ['Уянга', '1975 –', 3, 'Архивч'],
  ['Батзориг', '1995 –', 4, 'Программист'],
  ['Намуун', '1998 –', 4, 'Оюутан'],
  ['Ануужин', '2025 –', 5, null],
] as const;

export const HOME_GALLERY = PEOPLE.slice(0, 8).map(([name, meta, , note], index) => ({
  id: `person-${index}`,
  href: '#',
  name,
  meta: note ? `${note} · ${meta}` : meta,
  // The two oldest have no photograph, which is the normal case for anyone
  // born before about 1950 and the case the layout most needs to survive.
  src: index < 2 ? null : (PHOTOS[index % PHOTOS.length] ?? null),
}));

export const HOME_BANDS = [
  { key: 'g-2', label: 'Би ба миний хайр', depth: 0, from: 8, count: 2 },
  { key: 'g-3', label: 'Бидний эцэг эх', depth: 1, from: 4, count: 4 },
  { key: 'g-4', label: 'Өвөө эмээ', depth: 2, from: 2, count: 2 },
  { key: 'g-5', label: 'Элэнц хуланц', depth: 3, from: 0, count: 2 },
].map((band) => ({
  key: band.key,
  label: band.label,
  overflow: band.key === 'g-3' ? 3 : 0,
  units: PEOPLE.slice(band.from, band.from + band.count).map(([name, meta], index) => ({
    id: `${band.key}-${index}`,
    href: '#',
    people: [
      {
        id: `${band.key}-p-${index}`,
        name,
        year: meta.slice(0, 4),
        photoUrl: band.from < 2 ? null : (PHOTOS[index % PHOTOS.length] ?? null),
        initial: name.slice(0, 1),
      },
    ],
  })),
}));

/**
 * Memories, with the titles families actually give them.
 *
 * Note the range: a two-word title and a title that will not fit on one line,
 * a memory with a precise date and one with only a decade. Both happen.
 */
const WALL_ENTRIES: ReadonlyArray<readonly [string, string]> = [
  ['Хурмын өдөр', '1968'],
  ['Их тамирын сургуулийн багш нар', '1974'],
  ['Улаанбаатар руу нүүсэн зун', '1979'],
  ['Наадам', '1986'],
  ['Эмээгийн наян насны ой', '2025'],
  ['Тамирын голын хөвөө', '1990-ээд'],
];

export const HOME_WALL = WALL_ENTRIES.map(([title, meta], index) => ({
  id: `wall-${index}`,
  href: '#',
  src: SCENES[index % SCENES.length] ?? null,
  title,
  meta,
}));

export const HOME_VOICES = [
  {
    id: 'v1',
    href: '#',
    subject: 'Сарантуяа',
    title: 'Амьдралын түүх',
    meta: '14/20 асуулт',
  },
  {
    id: 'v2',
    href: '#',
    subject: 'Мөнхбат',
    title: 'Хөдөөгийн жилүүд',
    meta: '6/20 асуулт',
  },
  {
    id: 'v3',
    href: '#',
    subject: 'Уянга',
    title: 'Архивыг хэрхэн цуглуулсан тухай',
    meta: '20/20 асуулт',
  },
];

export const HOME_NEWS = [
  { id: 'n1', action: '1971 оны хуримын зургийг нэмлээ', actorName: 'Уянга', when: '2 цагийн өмнө', href: '#' },
  { id: 'n2', action: 'Эмээгийн ярилцлагад 3 асуулт хариуллаа', actorName: 'Намуун', when: 'өчигдөр', href: '#' },
  { id: 'n3', action: 'Ануужиныг модонд нэмлээ', actorName: 'Батзориг', when: '4 хоногийн өмнө', href: '#' },
];

export const HOME_COUPLE = {
  names: ['Билэг', 'Сараа'] as [string, string],
  together: '2013 оны 6-р сараас — 12 жил хамт',
  counts: { memories: 34, letters: 8, places: 5 },
  waiting: false,
};

/** The family chronicle, as the timeline assembles it from the graph. */
export const FAMILY_TIMELINE = [
  { year: '1918', kind: 'birth', title: 'Дамдин мэндэлсэн', description: 'Архангай, Их тамир' },
  { year: '1942', kind: 'birth', title: 'Батболд мэндэлсэн', description: null },
  { year: '1968', kind: 'marriage', title: 'Батболд ба Сарантуяа гэр бүл болов', description: null },
  { year: '1974', kind: 'memory', title: 'Их тамирын сургуулийн багш нар', description: 'Уянгагийн олж ирсэн зураг' },
  { year: '1979', kind: 'memory', title: 'Улаанбаатар руу нүүсэн зун', description: null },
  { year: '1994', kind: 'death', title: 'Дамдин тэнгэрт халив', description: null },
  { year: '2010', kind: 'death', title: 'Батболд тэнгэрт халив', description: null },
  { year: '2025', kind: 'birth', title: 'Ануужин мэндэлсэн', description: 'Долоо дахь үе' },
];
