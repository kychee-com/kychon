import { describe, it, expect } from 'vitest';

describe('i18n rendering', () => {
  const enStrings = {
    'nav.home': 'Home',
    'nav.members': 'Members',
    'welcome.greeting': 'Hello, {name}!',
    'members.count': '{count} members',
    'members.count_one': '1 member',
  };

  const ptStrings = {
    'nav.home': 'Inicio',
    'nav.members': 'Membros',
    'welcome.greeting': 'Ola, {name}!',
    'members.count': '{count} membros',
    'members.count_one': '1 membro',
  };

  function t(key, vars = {}, strings = enStrings, fallback = enStrings) {
    let resolvedKey = key;
    if (vars.count !== undefined && vars.count === 1) {
      const oneKey = key + '_one';
      if (strings[oneKey] || fallback[oneKey]) resolvedKey = oneKey;
    }
    let str = strings[resolvedKey] || fallback[resolvedKey] || resolvedKey;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v));
      }
    }
    return str;
  }

  it('renders nav items in English', () => {
    const nav = document.createElement('nav');
    ['nav.home', 'nav.members'].forEach(key => {
      const a = document.createElement('a');
      a.textContent = t(key);
      nav.appendChild(a);
    });
    expect(nav.children[0].textContent).toBe('Home');
    expect(nav.children[1].textContent).toBe('Members');
  });

  it('renders nav items in Portuguese', () => {
    const nav = document.createElement('nav');
    ['nav.home', 'nav.members'].forEach(key => {
      const a = document.createElement('a');
      a.textContent = t(key, {}, ptStrings, enStrings);
      nav.appendChild(a);
    });
    expect(nav.children[0].textContent).toBe('Inicio');
    expect(nav.children[1].textContent).toBe('Membros');
  });

  it('renders interpolated greeting', () => {
    const el = document.createElement('p');
    el.textContent = t('welcome.greeting', { name: 'Maria' });
    expect(el.textContent).toBe('Hello, Maria!');
  });

  it('renders plural correctly', () => {
    const el = document.createElement('span');
    el.textContent = t('members.count', { count: 42 });
    expect(el.textContent).toBe('42 members');
  });

  it('renders singular correctly', () => {
    const el = document.createElement('span');
    el.textContent = t('members.count', { count: 1 });
    expect(el.textContent).toBe('1 member');
  });

  it('falls back to English for missing key in another locale', () => {
    const sparseLocale = { 'nav.home': 'Casa' };
    const result = t('nav.members', {}, sparseLocale, enStrings);
    expect(result).toBe('Members');
  });

  it('returns key when missing from all locales', () => {
    const result = t('totally.missing.key', {}, {}, enStrings);
    expect(result).toBe('totally.missing.key');
  });
});
