import { cookies } from 'next/headers';
import { LOCALE_COOKIE, LOCALES, type Locale } from '@/lib/locale';

const LABELS: Record<Locale, string> = { en: 'EN', zh: '中文' };

/**
 * Server-rendered toggle. A form action rather than client-side state so the
 * choice survives a reload and the server components re-render in the new
 * locale without shipping any JavaScript.
 */
export function LocaleToggle({ current }: { current: Locale }) {
  async function setLocale(formData: FormData) {
    'use server';
    const next = String(formData.get('locale'));
    if ((LOCALES as readonly string[]).includes(next)) {
      (await cookies()).set(LOCALE_COOKIE, next, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      });
    }
  }

  return (
    <div className="flex items-center rounded-lg border border-ink-700 p-0.5">
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <form action={setLocale} key={locale}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              aria-current={active ? 'true' : undefined}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-ink-700 text-mist-100'
                  : 'text-mist-400 hover:text-mist-200'
              }`}
            >
              {LABELS[locale]}
            </button>
          </form>
        );
      })}
    </div>
  );
}
