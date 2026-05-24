import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CONTROLS = resolve(process.cwd(), 'src/components/kychon/AdminEditorControlsIsland.tsx');

describe('admin editor controls source', () => {
  it('keeps React controls out of hand-rolled rendered-DOM mutations', async () => {
    const source = await readFile(CONTROLS, 'utf8');

    expect(source).toContain('@/components/kychon/ui');
    expect(source).toContain('isSingletonBlockType');
    expect(source).toContain('unavailableReason');
    expect(source).toContain('Already in this zone');
    expect(source).toContain('nextSectionPosition');
    expect(source).toContain("get('sections?visible=eq.true&order=zone.asc,position.asc')");
    expect(source).not.toContain('querySelector');
    expect(source).not.toContain('document.createElement');
    expect(source).not.toContain('innerHTML');
    expect(source).not.toContain('insertAdjacentHTML');
    expect(source).not.toContain('data-sortable-id');
    expect(source).not.toContain('admin-scope-pill');
  });
});
