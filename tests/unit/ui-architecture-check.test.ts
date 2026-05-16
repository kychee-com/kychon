import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSource } from '../../scripts/ui-architecture-check';

function sourceFile(path: string): string {
  return resolve(process.cwd(), path);
}

function messages(path: string, source: string): string[] {
  return checkSource(sourceFile(path), source).map((violation) => violation.message);
}

describe('ui architecture check', () => {
  it('rejects hand-built DOM in product and public runtime source', () => {
    const createElementCall = `document.${'createElement'}('button');`;

    for (const path of ['src/lib/bad-runtime.ts', 'public/js/bad-runtime.js']) {
      expect(messages(path, createElementCall)).toContain(
        'Product source must not hand-build DOM; use React islands, Astro markup, or dom-fragment helpers',
      );
    }

    expect(messages('public/js/env.js', "window.__KYCHON_API = 'https://api.run402.com';")).toEqual([]);
  });

  it('keeps feature UI on Kychon/shadcn controls while allowing hidden plumbing inputs', () => {
    const violations = messages(
      'src/components/kychon/BadControls.tsx',
      '<button type="button">Save</button><input name="q" /><select /><textarea />',
    );

    expect(violations).toContain('Feature UI must use Kychon/shadcn components instead of native <button> controls');
    expect(violations).toContain('Feature UI must use Kychon/shadcn components instead of native <input> controls');
    expect(violations).toContain('Feature UI must use Kychon/shadcn components instead of native <select> controls');
    expect(violations).toContain('Feature UI must use Kychon/shadcn components instead of native <textarea> controls');

    expect(
      messages(
        'src/components/kychon/GoodControls.tsx',
        '<Button type="button">Save</Button><Input name="q" /><input type="hidden" /><input type="file" hidden />',
      ),
    ).toEqual([]);
  });

  it('keeps primitive imports and base UI imports behind owned facades', () => {
    const directUiImport = `import { Button } from '${'@/components/ui/button'}';`;
    const primitiveImport = `import * as Dialog from '${'@radix-ui/react-dialog'}';`;
    const facadeExport = `export { Button } from '${'@/components/ui/button'}';`;
    const primitiveWrapperImport = `import * as Dialog from '${'@radix-ui/react-dialog'}';`;

    expect(messages('src/components/kychon/BadImport.tsx', directUiImport)).toContain(
      'Feature code must import Kychon UI through @/components/kychon/ui, not @/components/ui/button',
    );
    expect(messages('src/components/kychon/BadPrimitive.tsx', primitiveImport)).toContain(
      'Direct primitive import @radix-ui/react-dialog must be wrapped behind src/components/ui/* or src/lib/ui/*',
    );

    expect(messages('src/components/kychon/ui.ts', facadeExport)).toEqual([]);
    expect(messages('src/components/ui/dialog.tsx', primitiveWrapperImport)).toEqual([]);
  });

  it('rejects owned CSS class selectors and retired primitive class definitions', () => {
    const violations = messages(
      'src/styles/bad.css',
      '[data-ready] { display: block; } .feature-card { color: red; } .btn { color: blue; }',
    );

    expect(violations).toContain(
      'Owned CSS must not define custom class selector .feature-card; use data attributes, semantic elements, or Tailwind utilities',
    );
    expect(violations).toContain(
      'CSS must not define retired Kychon primitive classes; use Tailwind, shadcn/Kychon UI, and data hooks',
    );

    expect(messages('demo/bad/seed.sql', String.raw`'{"html":"<div class=\"card\"></div>"}'`)).toContain(
      'Product source must not use retired Kychon primitive class tokens; use shadcn/Kychon UI and semantic data hooks',
    );
  });

  it('routes test DOM fixtures through the shared helper and allows negative source assertions', () => {
    const createElementCall = `document.${'createElement'}('div');`;

    expect(messages('tests/unit/bad-fixture.test.ts', createElementCall)).toContain(
      'Tests must use tests/helpers/dom-fixture.js instead of hand-building DOM fixtures',
    );
    expect(messages('tests/helpers/dom-fixture.js', createElementCall)).toEqual([]);
    expect(
      messages('tests/unit/source-assertion.test.ts', "expect(source).not.toContain('document.createElement');"),
    ).toEqual([]);
  });

  it('rejects dynamic Tailwind utility construction', () => {
    const interpolation = ['$', '{tenantColor}'].join('');
    const dynamicTailwindClass = ['const className = `bg-', interpolation, '-500`;'].join('');
    const concatPrefix = "'hover:bg-'";
    const concatSuffix = "'-500'";
    const dynamicTailwindConcat = ['const className = ', concatPrefix, ' + tenantColor + ', concatSuffix, ';'].join('');

    expect(messages('src/components/kychon/BadClass.tsx', dynamicTailwindClass)).toContain(
      'Dynamic Tailwind utility construction must use CSS variables, data attributes, or a static variant map',
    );
    expect(messages('src/components/kychon/BadConcatClass.tsx', dynamicTailwindConcat)).toContain(
      'Dynamic Tailwind utility construction must use CSS variables, data attributes, or a static variant map',
    );
  });
});
