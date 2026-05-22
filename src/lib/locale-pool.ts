/**
 * locale-pool.ts — the kitchen-sink locale pool for `spec.i18n.locales`.
 *
 * Run402's `spec.i18n.locales` is capped at 50 entries and frozen per deploy.
 * Until `kychee-com/run402-private#413` ships runtime-mutable locales, Kychon
 * declares a fixed 50-entry pool at deploy time and controls runtime visibility
 * via `site_config.languages_enabled` (a JSONB row in the project DB). The
 * gateway accepts any of the 50; the app decides what to expose. See
 * `openspec/changes/admin-content-management/design.md` Decision 9 for the
 * full reasoning.
 *
 * Both the deploy script (`scripts/_lib.ts`) and the admin UI
 * (`AddLanguageIsland`, `AdminBarIsland`) import this module so the pool and
 * its display labels stay in lockstep.
 */

/**
 * 50 base ISO 639-1 / BCP-47 codes covering top web-usage + community-platform
 * relevance. Ordering matches LOCALE_LABELS below for easy diffing.
 *
 * The exact membership is deliberately stable — admins outside the pool need
 * to wait for a code change + redeploy (or for #413 to ship). The 50-entry
 * cap is a Run402 platform constraint, not a Kychon one.
 */
export const LOCALE_POOL: readonly string[] = [
  // Major Western European (12)
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'nl',
  'sv',
  'da',
  'no',
  'fi',
  'pl',
  // Eastern European (12)
  'ru',
  'uk',
  'cs',
  'hu',
  'ro',
  'bg',
  'hr',
  'sk',
  'sl',
  'lt',
  'lv',
  'et',
  // East Asian (4)
  'ja',
  'zh',
  'zh-Hant',
  'ko',
  // Middle Eastern (4)
  'ar',
  'he',
  'fa',
  'tr',
  // South Asian (4)
  'hi',
  'bn',
  'ur',
  'ta',
  // Southeast Asian (5)
  'id',
  'ms',
  'tl',
  'vi',
  'th',
  // African + Other (9)
  'sw',
  'am',
  'af',
  'ca',
  'eu',
  'ga',
  'cy',
  'el',
  'is',
];

if (LOCALE_POOL.length > 50) {
  // Run402 platform constraint: spec.i18n.locales accepts ≤50 entries.
  throw new Error(`LOCALE_POOL exceeds Run402's 50-entry cap (got ${LOCALE_POOL.length})`);
}

/**
 * Human-readable labels for the locale switcher and Add Language dialog.
 * Native-language display name (endonym) so the dropdown is recognisable
 * to native speakers. Falls back to the code when a label is missing.
 */
export const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  sv: 'Svenska',
  da: 'Dansk',
  no: 'Norsk',
  fi: 'Suomi',
  pl: 'Polski',
  ru: 'Русский',
  uk: 'Українська',
  cs: 'Čeština',
  hu: 'Magyar',
  ro: 'Română',
  bg: 'Български',
  hr: 'Hrvatski',
  sk: 'Slovenčina',
  sl: 'Slovenščina',
  lt: 'Lietuvių',
  lv: 'Latviešu',
  et: 'Eesti',
  ja: '日本語',
  zh: '中文 (简体)',
  'zh-Hant': '中文 (繁體)',
  ko: '한국어',
  ar: 'العربية',
  he: 'עברית',
  fa: 'فارسی',
  tr: 'Türkçe',
  hi: 'हिन्दी',
  bn: 'বাংলা',
  ur: 'اردو',
  ta: 'தமிழ்',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
  tl: 'Filipino',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  sw: 'Kiswahili',
  am: 'አማርኛ',
  af: 'Afrikaans',
  ca: 'Català',
  eu: 'Euskara',
  ga: 'Gaeilge',
  cy: 'Cymraeg',
  el: 'Ελληνικά',
  is: 'Íslenska',
};

/** Whether a locale code is in the deploy-frozen pool. */
export function isPoolLocale(code: string): boolean {
  return LOCALE_POOL.includes(code);
}

/** Display label for a locale, falling back to the code itself. */
export function localeLabel(code: string): string {
  return LOCALE_LABELS[code] || code;
}

/** Validate that a locale tag is shaped right (BCP-47-ish, gateway-accepted). */
const LOCALE_TAG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export function isValidLocaleTag(code: string): boolean {
  return typeof code === 'string' && LOCALE_TAG_RE.test(code);
}
