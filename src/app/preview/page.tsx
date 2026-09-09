import Link from 'next/link';

/**
 * The design preview index.
 *
 * Every screen that has a fixture-backed preview, in one list, so a layout
 * change can be eyeballed at every breakpoint without a database or a signed-in
 * session. Grouped by which half of the product it belongs to.
 */
const GROUPS: Array<{ title: string; screens: Array<{ href: string; label: string; note: string }> }> = [
  {
    title: 'Гэр бүлийн архив',
    screens: [
      { href: '/preview/home', label: 'Нүүр', note: 'Ширээ: sidebar, top bar, plate, rail' },
      { href: '/preview/tree', label: 'Өв мод', note: 'Гэрэлтэй plate, хажуугийн rail' },
      { href: '/preview/tree-empty', label: 'Өв мод — хоосон', note: 'Хэн ч ороогүй үеийн байдал' },
      { href: '/preview/timeline', label: 'Он цагийн хэлхээ', note: 'Hairline, царай бүхий бичвэр' },
    ],
  },
  {
    title: 'Хосын орон зай',
    screens: [
      { href: '/preview/us', label: 'Хосын нүүр', note: 'Sanctuary layout' },
      { href: '/preview/us/memories', label: 'Дурсамж', note: '4:5 плитүүд, хайлт' },
      { href: '/preview/us/timeline', label: 'Он цаг', note: 'Hairline rail' },
      { href: '/preview/us/letters', label: 'Захидал', note: 'Битүүмжилсэн ба нээлттэй' },
      { href: '/preview/us/firsts', label: 'Анхны мөчүүд', note: 'Бөглөсөн ба хоосон' },
      { href: '/preview/us/future', label: 'Ирээдүйд', note: 'Цоожтой ба бэлэн' },
    ],
  },
];

export default function PreviewIndex() {
  return (
    <main className="ed-shell py-16">
      <h1 className="ed-display ed-display-lg">Дизайн — дэлгэцүүд</h1>

      {GROUPS.map((group) => (
        <section key={group.title} className="mt-12">
          <p className="ed-eyebrow">{group.title}</p>
          <ul className="mt-5 max-w-xl border-t border-[color-mix(in_srgb,#183b32_12%,transparent)]">
            {group.screens.map((screen) => (
              <li key={screen.href}>
                <Link
                  href={screen.href}
                  className="flex items-baseline justify-between gap-5 border-b border-[color-mix(in_srgb,#183b32_12%,transparent)] py-5"
                >
                  <span className="ed-display text-2xl">{screen.label}</span>
                  <span className="text-sm text-[color-mix(in_srgb,#183b32_50%,transparent)]">
                    {screen.note}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
