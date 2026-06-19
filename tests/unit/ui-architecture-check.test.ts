import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSource, GIT_SCAN_FILE_ARGS, isScannedSourcePath } from '../../scripts/ui-architecture-check';

function sourceFile(path: string): string {
  return resolve(process.cwd(), path);
}

function messages(path: string, source: string): string[] {
  return checkSource(sourceFile(path), source).map((violation) => violation.message);
}

describe('ui architecture check', () => {
  it('scans tracked and untracked product source extensions including html', () => {
    expect(GIT_SCAN_FILE_ARGS).toEqual(['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
    expect(isScannedSourcePath('public/page.html')).toBe(true);
    expect(isScannedSourcePath('demo/site/seed.sql')).toBe(true);
    expect(isScannedSourcePath('functions/site-search.js')).toBe(true);
    expect(isScannedSourcePath('src/components/kychon/View.tsx')).toBe(true);
    expect(isScannedSourcePath('_aage-port.seed.sql')).toBe(true);
    expect(isScannedSourcePath('_aage-port-deploy.ts')).toBe(true);
    expect(isScannedSourcePath('public/image.png')).toBe(false);
    expect(isScannedSourcePath('dist/page.html')).toBe(false);
  });

  it('rejects hand-built DOM in product and public runtime source', () => {
    const createElementCall = `document.${'createElement'}('button');`;

    for (const path of ['src/lib/bad-runtime.ts', 'public/js/bad-runtime.js']) {
      expect(messages(path, createElementCall)).toContain(
        'Product source must not hand-build DOM; use React islands, Astro markup, or library/framework helpers',
      );
    }

    const replaceChildrenCall = ['root.replace', 'Children(node);'].join('');
    const removeCall = ['node.', 'remove();'].join('');
    const domFixtureHelperCalls = [
      'host.replace',
      'Children(node); reference.replace',
      'With(node); node.',
      'remove();',
    ].join('');

    expect(messages('src/lib/bad-runtime.ts', replaceChildrenCall)).toContain(
      'Product source must not hand-build DOM; use React islands, Astro markup, or library/framework helpers',
    );
    expect(messages('src/lib/bad-runtime.ts', removeCall)).toContain(
      'Product source must not hand-build DOM; use React islands, Astro markup, or library/framework helpers',
    );
    expect(messages('functions/bad-runtime.js', createElementCall)).toContain(
      'Product source must not hand-build DOM; use React islands, Astro markup, or library/framework helpers',
    );
    expect(messages('tests/helpers/dom-fixture.js', domFixtureHelperCalls)).toEqual([]);

    expect(messages('public/js/env.js', "window.__KYCHON_API = 'https://api.run402.com';")).toEqual([]);
  });

  it('rejects dom-fragment imports in product source', () => {
    const relativeImport = "import { renderHtmlChildren } from '../lib/dom-fragment';";
    const aliasedImport = "import { renderHtmlChildren } from '@/lib/dom-fragment';";
    const violation = 'Product source must not import dom-fragment';

    expect(messages('src/components/OtherAdmin.astro', relativeImport)).toContain(violation);
    expect(messages('src/components/kychon/BadFragment.tsx', aliasedImport)).toContain(violation);
    expect(messages('src/components/AdminEditor.astro', relativeImport)).toContain(violation);
    expect(messages('src/lib/page-render.ts', "import { renderHtmlChildren } from './dom-fragment';")).toContain(
      violation,
    );
    expect(messages('src/lib/sanitize-html.ts', "import { parseHtmlBody } from './dom-fragment';")).toContain(
      violation,
    );
  });

  it('rejects selector-based DOM lookup in product source', () => {
    const selectorLookups = [
      "document.getElementById('root');",
      "document.querySelector('[data-root]');",
      "document.querySelectorAll('[data-item]');",
      "target?.closest('[data-action]');",
      "target.matches('[data-action]');",
      "root.querySelector('[data-child]');",
    ].join('\n');

    expect(messages('src/lib/bad-selector-runtime.ts', selectorLookups)).toEqual([
      'Product source must not use selector-based DOM lookups; use React refs, structural traversal helpers, or explicit host inputs',
      'Product source must not use selector-based DOM lookups; use React refs, structural traversal helpers, or explicit host inputs',
      'Product source must not use selector-based DOM lookups; use React refs, structural traversal helpers, or explicit host inputs',
      'Product source must not use selector-based DOM lookups; use React refs, structural traversal helpers, or explicit host inputs',
      'Product source must not use selector-based DOM lookups; use React refs, structural traversal helpers, or explicit host inputs',
      'Product source must not use selector-based DOM lookups; use React refs, structural traversal helpers, or explicit host inputs',
    ]);
  });

  it('keeps feature UI on Kychon/shadcn controls', () => {
    const nativeButtonHtml = ['<but', 'ton type="button">Save</but', 'ton>'].join('');
    const nativeSelectHtml = ['<sel', 'ect></sel', 'ect>'].join('');
    const violations = messages(
      'src/components/kychon/BadControls.tsx',
      '<button type="button">Save</button><input name="q" /><select /><textarea /><label htmlFor="q">Search</label>',
    );

    expect(violations).toContain('Feature UI must use Kychon/shadcn components instead of native <button> controls');
    expect(violations).toContain('Feature UI must use Kychon/shadcn components instead of native <input> controls');
    expect(violations).toContain('Feature UI must use Kychon/shadcn components instead of native <select> controls');
    expect(violations).toContain('Feature UI must use Kychon/shadcn components instead of native <textarea> controls');
    expect(violations).toContain('Feature UI must use Kychon/shadcn components instead of native <label> controls');
    expect(messages('src/components/kychon/BadHiddenControl.tsx', '<input type="hidden" name="type" />')).toContain(
      'Feature UI must use Kychon/shadcn components instead of native <input> controls',
    );
    expect(messages('src/components/kychon/BadFileControl.tsx', '<input type="file" hidden />')).toContain(
      'Feature UI must use Kychon/shadcn components instead of native <input> controls',
    );

    expect(
      messages(
        'src/components/kychon/GoodControls.tsx',
        '<Button type="button">Save</Button><Label htmlFor="q">Search</Label><Input name="q" /><Input type="hidden" /><Input type="file" hidden />',
      ),
    ).toEqual([]);

    expect(messages('demo/bad/seed.sql', `'{"html":"${nativeButtonHtml}"}'`)).toContain(
      'Feature UI must use Kychon/shadcn components instead of native <button> controls',
    );
    expect(messages('public/js/bad-runtime.js', `const html = '${nativeSelectHtml}';`)).toContain(
      'Feature UI must use Kychon/shadcn components instead of native <select> controls',
    );
    expect(messages('public/bad.html', nativeButtonHtml)).toContain(
      'Feature UI must use Kychon/shadcn components instead of native <button> controls',
    );
    expect(messages('functions/bad-runtime.js', `return '${nativeButtonHtml}';`)).toContain(
      'Feature UI must use Kychon/shadcn components instead of native <button> controls',
    );
    expect(messages('src/lib/wild-apricot-search.ts', ['const re = /<but', 'ton\\b[^>]*>/;'].join(''))).toContain(
      'Feature UI must use Kychon/shadcn components instead of native <button> controls',
    );
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
    expect(messages('functions/bad-runtime.js', String.raw`return '<div class=\"card\"></div>';`)).toContain(
      'Product source must not use retired Kychon primitive class tokens; use shadcn/Kychon UI and semantic data hooks',
    );
  });

  it('allows vendor .r402-* selectors only in the hosted-auth theme bridge', () => {
    const vendorCss =
      '.r402-sign-in, .r402-input:focus-visible { color: var(--color-foreground); } .r402-method { gap: 0.5rem; }';

    // The designated theme-bridge file may target the hosted @run402/astro components' vendor DOM.
    expect(messages('src/styles/auth-hosted.css', vendorCss)).toEqual([]);

    // Any other CSS file may not — the exception is scoped to the allowlisted file.
    expect(messages('src/styles/other.css', vendorCss)).toContain(
      'Owned CSS must not define custom class selector .r402-sign-in; use data attributes, semantic elements, or Tailwind utilities',
    );

    // Even the allowlisted file may not define non-vendor owned classes.
    expect(messages('src/styles/auth-hosted.css', '.feature-card { color: red; }')).toContain(
      'Owned CSS must not define custom class selector .feature-card; use data attributes, semantic elements, or Tailwind utilities',
    );
  });

  it('keeps seed artifacts free of legacy embedded HTML primitives', () => {
    const violations = messages(
      '_aage-port.seed.sql',
      `INSERT INTO pages (content) VALUES ('<style>.card{color:red}</style><form class="legacy"><iframe src="/map"></iframe><input name="q"><p style="color:red">Legacy</p></form>');`,
    );

    expect(violations).toContain(
      'Seed artifacts must not embed legacy style HTML; use structural rich text or typed shadcn/Kychon blocks',
    );
    expect(violations).toContain(
      'Seed artifacts must not embed legacy form HTML; use structural rich text or typed shadcn/Kychon blocks',
    );
    expect(violations).toContain(
      'Seed artifacts must not embed legacy iframe HTML; use structural rich text or typed shadcn/Kychon blocks',
    );
    expect(violations).toContain(
      'Seed artifacts must not embed legacy class HTML; use structural rich text or typed shadcn/Kychon blocks',
    );
    expect(violations).toContain('Feature UI must use Kychon/shadcn components instead of native <input> controls');

    expect(messages('src/seeds/bad.ts', `const html = '<p class="legacy">Bad</p>';`)).toContain(
      'Seed artifacts must not embed legacy class HTML; use structural rich text or typed shadcn/Kychon blocks',
    );
    expect(messages('demo/bad/reset-demo.js', `const sql = '<p style="color:red">Bad</p>';`)).toContain(
      'Seed artifacts must not embed legacy style HTML; use structural rich text or typed shadcn/Kychon blocks',
    );
    expect(
      messages('demo/bad/seed.sql', `INSERT INTO sections VALUES ('<p text-xl text-muted-foreground\\">Bad</p>');`),
    ).toContain(
      'Seed artifacts must not contain stripped legacy <p> attribute fragments; rewrite rich text structurally before tracking generated SQL',
    );
  });

  it('routes test DOM fixtures through the shared helper and allows negative source assertions', () => {
    const createElementCall = `document.${'createElement'}('div');`;

    expect(messages('tests/unit/bad-fixture.test.ts', createElementCall)).toContain(
      'Tests must use tests/helpers/dom-fixture.js instead of hand-building DOM fixtures',
    );
    const appendCall = ['document.body.', 'append(host);'].join('');
    expect(messages('tests/unit/bad-append-fixture.test.ts', appendCall)).toContain(
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
