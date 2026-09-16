import { cookies } from 'next/headers';
import { isLocale, LOCALE_COOKIE, UI, type Locale, type UIStrings } from './locale';

/** Reads the visitor's locale from the cookie the toggle sets. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : 'en';
}

export async function getLocaleAndStrings(): Promise<{ locale: Locale; t: UIStrings }> {
  const locale = await getLocale();
  return { locale, t: UI[locale] };
}
