import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

/**
 * Two faces, self-hosted by next/font at build time.
 *
 * A family archive is read on bad connections, so nothing here is fetched from
 * a third party at run time: next/font downloads the files during the build and
 * serves them from our own origin, with the metrics inlined so a name never
 * reflows after paint. Both carry the Cyrillic subset — the entire product is
 * in Mongolian, and a display face that silently falls back for Cyrillic would
 * undo the typography everywhere it matters most.
 */
const display = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-display-loaded',
  display: 'swap',
  weight: ['400', '500', '600'],
});

const sans = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-sans-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ROOTS — Гэр бүлийн дурсамжийн архив',
  description:
    'ROOTS — долоон үеийн гэр бүлийн хүмүүс, дурсамж, зураг, дуу хоолой, түүхийг хадгалах хувийн архив.',
  applicationName: 'ROOTS',
  // A private family archive must never be indexed, previewed or cached by a
  // crawler. This is the first line of that defence; RLS is the last.
  robots: { index: false, follow: false, nocache: true },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zooming must stay available: a grandparent reading a transcript will pinch.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4efe4' },
    { media: '(prefers-color-scheme: dark)', color: '#10150f' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className={`${display.variable} ${sans.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only-text focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-forest focus:px-4 focus:py-2 focus:text-forest-ink"
        >
          Үндсэн агуулга руу очих
        </a>
        {children}
      </body>
    </html>
  );
}
