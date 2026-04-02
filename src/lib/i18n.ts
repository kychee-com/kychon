// i18n.ts — Translation function with English fallback, plurals, interpolation

let strings: Record<string, any> = {};
let fallbackStrings: Record<string, any> = {};
let currentLocale = 'en';
const cache: Record<string, Record<string, any>> = {};
const I18N_CACHE_PREFIX = 'wl_cache_i18n_';
const I18N_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function t(key: string, vars: Record<string, any> = {}): string {
  let resolvedKey = key;
  if (vars.count !== undefined && vars.count === 1) {
    const oneKey = `${key}_one`;
    const oneVal = strings[oneKey] || fallbackStrings[oneKey];
    if (oneVal) resolvedKey = oneKey;
  }

  let str: string = strings[resolvedKey] || fallbackStrings[resolvedKey] || resolvedKey;

  if (vars && typeof str === 'string') {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return str;
}

function readLocaleCache(lang: string): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(I18N_CACHE_PREFIX + lang);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data ?? null;
  } catch {
    localStorage.removeItem(I18N_CACHE_PREFIX + lang);
    return null;
  }
}

function writeLocaleCache(lang: string, data: Record<string, any>): void {
  try {
    localStorage.setItem(I18N_CACHE_PREFIX + lang, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // QuotaExceededError — skip silently
  }
}

function isLocaleCacheFresh(lang: string): boolean {
  try {
    const raw = localStorage.getItem(I18N_CACHE_PREFIX + lang);
    if (!raw) return false;
    const { ts } = JSON.parse(raw);
    return typeof ts === 'number' && ts + I18N_TTL > Date.now();
  } catch {
    return false;
  }
}

async function fetchLocale(lang: string): Promise<Record<string, any>> {
  if (cache[lang]) return cache[lang];

  const cached = readLocaleCache(lang);
  if (cached) {
    cache[lang] = cached;
    if (!isLocaleCacheFresh(lang)) {
      fetch(`/custom/strings/${lang}.json?v=9`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            cache[lang] = data;
            writeLocaleCache(lang, data);
          }
        })
        .catch(() => {});
    }
    return cached;
  }

  try {
    const res = await fetch(`/custom/strings/${lang}.json?v=9`);
    if (!res.ok) return {};
    const data = await res.json();
    cache[lang] = data;
    writeLocaleCache(lang, data);
    return data;
  } catch {
    return {};
  }
}

export async function loadLocale(lang?: string | null, defaultLang?: string): Promise<Record<string, any>> {
  if (!lang) {
    lang = localStorage.getItem('wl_locale');
  }
  if (!lang && defaultLang) {
    lang = defaultLang;
  }
  if (!lang) {
    lang = 'en';
  }

  currentLocale = lang;

  if (lang !== 'en') {
    fallbackStrings = await fetchLocale('en');
  }

  strings = await fetchLocale(lang);

  if (strings._meta?.direction === 'rtl') {
    document.documentElement.dir = 'rtl';
  } else {
    document.documentElement.dir = 'ltr';
  }

  return strings;
}

export function setLanguage(lang: string): Promise<Record<string, any>> {
  localStorage.setItem('wl_locale', lang);
  return loadLocale(lang);
}

export function getLocale(): string {
  return currentLocale;
}

let _availableLocales: string[] | null = null;

export function setAvailableLocales(locales: string[]): void {
  _availableLocales = locales;
}

export function getAvailableLocales(): string[] {
  if (_availableLocales) return _availableLocales;
  try {
    const brand = JSON.parse(document.getElementById('brand-data')?.textContent || '{}');
    return brand.languages || ['en'];
  } catch {
    return ['en'];
  }
}

export { fallbackStrings, strings };
