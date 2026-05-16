import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme } from '../../src/lib/config';
import { headFixture } from '../helpers/dom-fixture.js';

describe('copied-theme token application', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
    headFixture('<style id="wl-theme-vars"></style>');
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
    expect(document.documentElement.style.getPropertyValue('--ky-color-bg')).toBe('#ffffff');
    expect(document.documentElement.style.getPropertyValue('--color-text')).toBe('#1f2933');
    expect(document.documentElement.style.getPropertyValue('--ky-color-text')).toBe('#1f2933');
    expect(document.documentElement.style.getPropertyValue('--color-surface')).toBe('#f9f5f5');
    expect(document.documentElement.style.getPropertyValue('--ky-color-surface')).toBe('#f9f5f5');
    expect(document.getElementById('wl-theme-vars')?.textContent).toContain(':root');
  });

  it('keeps tenant light colors from overriding visitor dark mode', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    applyTheme({
      bg: '#fffdf7',
      text: '#1a1a2e',
      surface: '#f7f1e6',
      border: '#d4d0c8',
    });

    expect(document.documentElement.style.getPropertyValue('--color-bg')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--ky-color-bg')).toBe('');
    expect(document.getElementById('wl-theme-vars')?.textContent).toContain(':root:not([data-theme="dark"])');
    expect(document.getElementById('wl-theme-vars')?.textContent).toContain('--ky-color-bg: #fffdf7;');
  });
});
