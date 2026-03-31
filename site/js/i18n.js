// @ts-check
// i18n.js — Translation function with English fallback, plurals, interpolation

let strings = {};
let fallbackStrings = {};
let currentLocale = 'en';
const cache = {};
const I18N_CACHE_PREFIX = 'wl_cache_i18n_';
const I18N_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function t(key, vars = {}) {
  // Plural: if vars.count exists, try key_one for count === 1
  let resolvedKey = key;
  if (vars.count !== undefined && vars.count === 1) {
    const oneKey = `${key}_one`;
    const oneVal = strings[oneKey] || fallbackStrings[oneKey];
    if (oneVal) resolvedKey = oneKey;
  }

  let str = strings[resolvedKey] || fallbackStrings[resolvedKey] || resolvedKey;

  // Interpolation: replace {placeholder} with vars
  if (vars && typeof str === 'string') {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return str;
}

function readLocaleCache(lang) {
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

function writeLocaleCache(lang, data) {
  try {
    localStorage.setItem(I18N_CACHE_PREFIX + lang, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // QuotaExceededError — skip silently
  }
}

function isLocaleCacheFresh(lang) {
  try {
    const raw = localStorage.getItem(I18N_CACHE_PREFIX + lang);
    if (!raw) return false;
    const { ts } = JSON.parse(raw);
    return typeof ts === 'number' && ts + I18N_TTL > Date.now();
  } catch {
    return false;
  }
}

async function fetchLocale(lang) {
  if (cache[lang]) return cache[lang];

  // Check localStorage cache
  const cached = readLocaleCache(lang);
  if (cached) {
    cache[lang] = cached;
    // Background refresh if stale
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

  // No cache — fetch and store
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

export async function loadLocale(lang, defaultLang) {
  // Determine locale: explicit arg > localStorage > defaultLang param > 'en'
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

  // Load English as fallback (always)
  if (lang !== 'en') {
    fallbackStrings = await fetchLocale('en');
  }

  // Load target locale
  strings = await fetchLocale(lang);

  // Handle RTL
  if (strings._meta?.direction === 'rtl') {
    document.documentElement.dir = 'rtl';
  } else {
    document.documentElement.dir = 'ltr';
  }

  return strings;
}

export function setLanguage(lang) {
  localStorage.setItem('wl_locale', lang);
  return loadLocale(lang);
}

export function getLocale() {
  return currentLocale;
}

let _availableLocales = null;

export function setAvailableLocales(locales) {
  _availableLocales = locales;
}

export function getAvailableLocales() {
  if (_availableLocales) return _availableLocales;
  try {
    const brand = JSON.parse(document.getElementById('brand-data')?.textContent || '{}');
    return brand.languages || ['en'];
  } catch {
    return ['en'];
  }
}

export { fallbackStrings, strings };
