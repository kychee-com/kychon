// @ts-check
// i18n.js — Translation function with English fallback, plurals, interpolation

let strings = {};
let fallbackStrings = {};
let currentLocale = 'en';
const cache = {};

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

async function fetchLocale(lang) {
  if (cache[lang]) return cache[lang];
  try {
    const res = await fetch(`/custom/strings/${lang}.json`);
    if (!res.ok) return {};
    const data = await res.json();
    cache[lang] = data;
    return data;
  } catch {
    return {};
  }
}

export async function loadLocale(lang, defaultLang) {
  // Determine locale: explicit arg > localStorage > defaultLang param > brand.json default > 'en'
  if (!lang) {
    lang = localStorage.getItem('wl_locale');
  }
  if (!lang && defaultLang) {
    lang = defaultLang;
  }
  if (!lang) {
    try {
      const brand = await fetch('/custom/brand.json').then((r) => r.json());
      lang = brand.defaultLanguage || 'en';
    } catch {
      lang = 'en';
    }
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
