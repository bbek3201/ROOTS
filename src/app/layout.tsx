import type { Metadata, Viewport } from 'next';
import './globals.css';

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
    { media: '(prefers-color-scheme: light)', color: '#f7f2ea' },
    { media: '(prefers-color-scheme: dark)', color: '#17130f' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn">
      <body>
        <a
          href="#main"
          className="sr-only-text focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ember focus:px-4 focus:py-2 focus:text-white"
        >
          Үндсэн агуулга руу очих
        </a>
        {children}
      </body>
    </html>
  );
}
