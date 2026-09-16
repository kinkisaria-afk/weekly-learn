import type { Metadata } from 'next';
import Link from 'next/link';
import { LocaleToggle } from '@/components/LocaleToggle';
import { getLocaleAndStrings } from '@/lib/server-locale';
import './globals.css';

export const metadata: Metadata = {
  title: 'LearnFromGithub — turn open-source trends into learning opportunities',
  description:
    'What is trending, what you can learn from it, and what you can build this weekend. AI-generated breakdowns of trending GitHub repositories.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getLocaleAndStrings();

  return (
    <html lang={locale === 'zh' ? 'zh-CN' : 'en'}>
      <body className="min-h-screen">
        <header className="border-b border-ink-800">
          <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-6 py-5">
            <Link href="/" className="group flex items-baseline gap-2">
              <span className="text-lg font-semibold tracking-tight text-mist-100">
                LearnFromGithub
              </span>
              <span className="hidden text-sm text-mist-400 group-hover:text-mist-300 sm:inline">
                {t.tagline}
              </span>
            </Link>
            <nav className="flex items-center gap-5 text-sm text-mist-300">
              <Link href="/" className="hover:text-mist-100">
                {t.navDashboard}
              </Link>
              <Link href="/newsletter" className="hover:text-mist-100">
                {t.navNewsletter}
              </Link>
              <LocaleToggle current={locale} />
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="mt-24 border-t border-ink-800">
          <div className="mx-auto max-w-content px-6 py-10 text-sm text-mist-400">
            <p>{t.footerDisclaimer}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
