/**
 * The AI connector panels: admin settings ("Manage with ChatGPT", with the
 * on/off switch) and the member profile ("Use from ChatGPT").
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bodyFixture, clearBodyFixture } from '../helpers/dom-fixture.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { AiConnectorCard, connectorEnabled } = await import('../../src/components/kychon/AiConnectorCard');

let root: Root | null = null;
let host: HTMLElement;

beforeEach(() => {
  clearBodyFixture();
  bodyFixture('<div data-connector-test-host></div>');
  host = document.querySelector('[data-connector-test-host]') as HTMLElement;
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  vi.unstubAllGlobals();
});

async function render(props: Parameters<typeof AiConnectorCard>[0]) {
  await act(async () => {
    root = createRoot(host);
    root.render(createElement(AiConnectorCard, props));
  });
}

describe('AiConnectorCard', () => {
  it("shows this portal's connector URL and copies it", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await render({ audience: 'member' });

    const url = host.querySelector('[data-ai-connector-url]')?.textContent;
    expect(url).toBe(`${window.location.origin}/_run402/mcp`);

    const copy = host.querySelector('[data-ai-connector="member"] button') as HTMLButtonElement;
    await act(async () => copy.click());
    expect(writeText).toHaveBeenCalledWith(url);
  });

  it('shows admin examples and the switch it is given', async () => {
    await render({ audience: 'admin', toggle: createElement('div', { 'data-test-toggle': '' }) });

    expect(host.querySelector('[data-ai-connector="admin"] [data-test-toggle]')).not.toBeNull();
    expect(host.querySelectorAll('ul li')).toHaveLength(4);
  });

  it('treats a missing flag as on and false as off', () => {
    expect(connectorEnabled(null)).toBe(true);
    expect(connectorEnabled(true)).toBe(true);
    expect(connectorEnabled(false)).toBe(false);
    expect(connectorEnabled('false')).toBe(false);
  });
});
