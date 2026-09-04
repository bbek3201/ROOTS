import Link from 'next/link';

const SCREENS = [
  { href: '/preview/us', label: 'Хосын нүүр', note: 'Editorial spread' },
  { href: '/preview/us/memories', label: 'Дурсамж', note: '4:5 плитүүд, хайлт' },
  { href: '/preview/us/timeline', label: 'Он цаг', note: 'Hairline rail' },
  { href: '/preview/us/letters', label: 'Захидал', note: 'Битүүмжилсэн ба нээлттэй' },
  { href: '/preview/us/firsts', label: 'Анхны мөчүүд', note: 'Бөглөсөн ба хоосон' },
  { href: '/preview/us/future', label: 'Ирээдүйд', note: 'Цоожтой ба бэлэн' },
];

export default function PreviewIndex() {
  return (
    <main className="ed-shell py-16">
      <h1 className="ed-display ed-display-lg">Хосын орон зай — дизайн</h1>
      <ul className="mt-10 max-w-xl border-t border-[color-mix(in_srgb,#183b32_12%,transparent)]">
        {SCREENS.map((screen) => (
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
    </main>
  );
}
