/**
 * Admin settings "Export content": prepares a kychon-bundle/v1 download through
 * the bundle.export capability, members only when ticked.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bodyFixture, clearBodyFixture } from '../helpers/dom-fixture.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const api = vi.hoisted(() => ({ queryOp: vi.fn() }));
vi.mock('../../src/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/api')>()),
  queryOp: api.queryOp,
}));

const { ContentExportCard } = await import('../../src/components/kychon/AdminSettingsApp');

let root: Root | null = null;
let host: HTMLElement;

beforeEach(() => {
  clearBodyFixture();
  bodyFixture('<div data-export-test-host></div>');
  host = document.querySelector('[data-export-test-host]') as HTMLElement;
  api.queryOp.mockReset();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:export'), revokeObjectURL: vi.fn() }));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  vi.unstubAllGlobals();
});

async function render() {
  await act(async () => {
    root = createRoot(host);
    root.render(createElement(ContentExportCard));
  });
}

function button(label: string): HTMLElement {
  const found = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(label));
  if (!found) throw new Error(`no button ${label}`);
  return found;
}

describe('ContentExportCard', () => {
  it('prepares the bundle and offers it as a download, without members by default', async () => {
    api.queryOp.mockResolvedValue({ bundle: { format: 'kychon-bundle/v1' } });
    await render();
    await act(async () => button('Prepare export').click());

    expect(api.queryOp).toHaveBeenCalledWith('bundle.export', { include_members: false });
    const link = host.querySelector('a[download]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('blob:export');
    expect(link.getAttribute('download')).toMatch(/^kychon-export-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('asks for members when ticked', async () => {
    api.queryOp.mockResolvedValue({ bundle: {} });
    await render();
    await act(async () => (host.querySelector('[role="checkbox"]') as HTMLElement).click());
    await act(async () => button('Prepare export').click());
    expect(api.queryOp).toHaveBeenCalledWith('bundle.export', { include_members: true });
  });

  it('shows the error when the export fails', async () => {
    api.queryOp.mockRejectedValue(new Error('bundle.export requires admin role.'));
    await render();
    await act(async () => button('Prepare export').click());
    expect(host.textContent).toContain('bundle.export requires admin role.');
    expect(host.querySelector('a[download]')).toBeNull();
  });
});
