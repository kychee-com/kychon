import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme } from '../../src/lib/config';

describe('copied-theme token application', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
    document.getElementById('wl-theme-vars')?.remove();
  });

  it('applies copied-theme tokens to the document root from cached-shaped theme data', () => {
    applyTheme({
      interactions: { button: { hover: { background: '#ffcc00' } } },
      header: { padding: '1.25rem 0' },
      nav: { dropdown_bg: '#101010' },
    });
    expect(document.documentElement.style.getPropertyValue('--button-hover-bg')).toBe('#ffcc00');
    expect(document.documentElement.style.getPropertyValue('--nav-header-padding')).toBe('1.25rem 0');
    expect(document.documentElement.style.getPropertyValue('--nav-dropdown-bg')).toBe('#101010');
  });

  it('can preserve copied source colors over visitor dark-mode preferences', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    applyTheme({
      color_scheme: 'source',
      bg: '#ffffff',
      text: '#1f2933',
      surface: '#f9f5f5',
    });

    expect(document.documentElement.style.getPropertyValue('--color-bg')).toBe('#ffffff');
    expect(document.documentElement.style.getPropertyValue('--color-text')).toBe('#1f2933');
    expect(document.documentElement.style.getPropertyValue('--color-surface')).toBe('#f9f5f5');
    expect(document.getElementById('wl-theme-vars')?.textContent).toContain(':root');
  });
});
