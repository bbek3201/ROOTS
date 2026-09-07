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
export const HERITAGE_LEVELS = [
  {
    depth: 0, label: 'Би ба миний хайр', mark: '💖',
    cards: [{
      id: 'c0', href: '#', paired: true,
      people: [
        { id: 'p1', name: 'Билэг', years: '1996 –', note: 'Архитектор', photoUrl: PHOTOS[0]!, initial: 'Б' },
        { id: 'p2', name: 'Сараа', years: '1997 –', note: 'Багш', photoUrl: PHOTOS[1]!, initial: 'С' },
      ],
    }],
  },
  {
    depth: 1, label: 'Бидний эцэг эх', mark: '🌿',
    cards: [
      {
        id: 'c1', href: '#', paired: true,
        people: [
          { id: 'p3', name: 'Дорж', years: '1968 –', note: 'Инженер', photoUrl: PHOTOS[2]!, initial: 'Д' },
          { id: 'p4', name: 'Цэрэн', years: '1970 –', note: null, photoUrl: null, initial: 'Ц' },
        ],
      },
      {
        id: 'c2', href: '#', paired: true,
        people: [
          { id: 'p5', name: 'Ганбат', years: '1965 –', note: 'Малчин', photoUrl: null, initial: 'Г' },
          { id: 'p6', name: 'Оюун', years: '1967 –', note: null, photoUrl: PHOTOS[3]!, initial: 'О' },
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
          { id: 'p7', name: 'Бат', years: '1948 – 2019', note: 'Архангай', photoUrl: PHOTOS[4]!, initial: 'Б' },
          { id: 'p8', name: 'Саруул', years: '1951 –', note: 'Гэр бүлийн түүхч', photoUrl: null, initial: 'С' },
        ],
      },
      {
        id: 'c4', href: '#', paired: false,
        people: [
          { id: 'p9', name: 'Долгор', years: '1946 – 2003', note: 'Увс', photoUrl: PHOTOS[5]!, initial: 'Д' },
        ],
      },
    ],
  },
];

/* ---------------------------------------------------------------------------
   The family home and the desk around it
   --------------------------------------------------------------------------- */

export const FAMILY_NAME = 'Батболдын ураг';

export const VIEWER = { name: 'Ану', avatarUrl: null };

const PEOPLE = [
  ['Батболд', '1942 – 2010', 1],
  ['Сарантуяа', '1945 –', 1],
  ['Эрдэнэбат', '1968 –', 2],
  ['Алтантуяа', '1970 –', 2],
  ['Мөнхбат', '1972 –', 2],
  ['Уянга', '1975 –', 3],
  ['Батзориг', '1995 –', 3],
  ['Намуун', '1998 –', 4],
] as const;

export const HOME_GALLERY = PEOPLE.map(([name, meta], index) => ({
  id: `person-${index}`,
  href: '#',
  name,
  meta,
  src: PHOTOS[index % PHOTOS.length] ?? null,
}));

export const HOME_BANDS = [1, 2, 3].map((generation) => ({
  key: `generation-${generation}`,
  label: `${generation}-р үе`,
  overflow: generation === 3 ? 4 : 0,
  units: PEOPLE.filter((person) => person[2] === generation || generation === 3)
    .slice(0, 3)
    .map(([name, meta], index) => ({
      id: `unit-${generation}-${index}`,
      href: '#',
      people: [
        {
          id: `p-${generation}-${index}`,
          name,
          year: meta.slice(0, 4),
          photoUrl: PHOTOS[index % PHOTOS.length] ?? null,
          initial: name.slice(0, 1),
        },
      ],
    })),
}));

export const HOME_WALL = PHOTOS.slice(0, 6).map((src, index) => ({
  id: `wall-${index}`,
  href: '#',
  src,
  title: ['Наадам', 'Хаврын цагаалган', 'Хөдөө', 'Төрсөн өдөр', 'Хурим', 'Сургууль'][index] ?? 'Дурсамж',
  meta: `${1998 + index * 4}`,
}));

export const HOME_VOICES = [
  { id: 'v1', href: '#', subject: 'Сарантуяа', title: 'Амьдралын түүх', meta: '14/20 асуулт' },
  { id: 'v2', href: '#', subject: 'Эрдэнэбат', title: 'Хөдөөгийн жилүүд', meta: '6/20 асуулт' },
];

export const HOME_NEWS = [
  { id: 'n1', action: 'Шинэ дурсамж нэмлээ', actorName: 'Уянга', when: '2 цагийн өмнө', href: '#' },
  { id: 'n2', action: 'Зураг тэмдэглэлээ', actorName: 'Батзориг', when: 'өчигдөр', href: '#' },
];

export const HOME_COUPLE = {
  names: ['Билэг', 'Сараа'] as [string, string],
  together: '12 жил хамт',
  counts: { memories: 34, letters: 8, places: 5 },
  waiting: false,
};
