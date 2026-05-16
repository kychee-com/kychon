import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SCAN_DIRS = ['src', 'scripts', 'tests', 'public/css'];
const SOURCE_EXTENSIONS = new Set(['.astro', '.css', '.js', '.jsx', '.mjs', '.ts', '.tsx']);
const ALLOWED_PRIMITIVE_IMPORT_PREFIXES = ['src/components/ui/', 'src/lib/ui/'];
const ALLOWED_UI_FACADE_IMPORT_PREFIXES = ['src/components/ui/'];
const ALLOWED_UI_FACADE_IMPORT_FILES = new Set(['src/components/kychon/ui.ts']);
const PRIMITIVE_IMPORT_RE = /from\s+['"](@radix-ui\/[^'"]+|@base-ui-components\/[^'"]+)['"]/g;
const UI_FACADE_IMPORT_RE = /from\s+['"](@\/components\/ui\/[^'"]+)['"]/g;
const RELATIVE_IMPORT_RE = /from\s+['"](\.{1,2}\/[^'"]+)['"]/g;
const HAND_ROLLED_DOM_RE =
  /\b(?:document\.createElement|insertAdjacentHTML|appendChild|removeChild|innerHTML\s*=|\.className\s*=|classList\.)/g;
const CLASS_LITERAL_RE = /\b(?:class|className)=['"`]([^'"`]*)['"`]/g;
const RETIRED_PRIMITIVE_CLASSES = new Set([
  'container',
  'text-muted',
  'btn',
  'card',
  'badge',
  'toast',
  'form-input',
  'form-select',
  'form-textarea',
]);
const RETIRED_PRIMITIVE_CLASS_DEFINITION_RE = new RegExp(
  `(^|[^a-zA-Z0-9_-])\\.(${Array.from(RETIRED_PRIMITIVE_CLASSES).join('|')})(?=$|[^a-zA-Z0-9_-])`,
  'g',
);
const CSS_CLASS_SELECTOR_RE = /(^|[\s,{>+~])\.([A-Za-z_][A-Za-z0-9_-]*)(?=$|[^A-Za-z0-9_-])/g;
const DYNAMIC_TAILWIND_RE =
  /\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|decoration|accent|caret|shadow|rounded|gap|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|w|h|min-w|min-h|max-w|max-h|grid-cols|col-span|row-span)-\$\{/;

interface Violation {
  file: string;
  line: number;
  message: string;
  excerpt: string;
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    const ext = entry.name.slice(entry.name.lastIndexOf('.'));
    if (SOURCE_EXTENSIONS.has(ext)) files.push(full);
  }
  return files;
}

function lineNumber(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

function lineAt(source: string, line: number): string {
  return source.split('\n')[line - 1]?.trim() ?? '';
}

function stripCssNoise(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => '\n'.repeat(match.split('\n').length - 1))
    .replace(/(["'])(?:\\.|(?!\1)[\s\S])*\1/g, (match) => ' '.repeat(match.length));
}

function isAllowedPrimitiveImport(file: string): boolean {
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  return ALLOWED_PRIMITIVE_IMPORT_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

function isAllowedUiFacadeImport(file: string): boolean {
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  return (
    ALLOWED_UI_FACADE_IMPORT_FILES.has(rel) ||
    ALLOWED_UI_FACADE_IMPORT_PREFIXES.some((prefix) => rel.startsWith(prefix))
  );
}

function relativeImportTarget(file: string, specifier: string): string {
  return relative(ROOT, join(dirname(file), specifier)).replaceAll('\\', '/');
}

function isProductSource(file: string): boolean {
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  return rel.startsWith('src/') && !rel.startsWith('src/components/ui/');
}

function isCssSource(file: string): boolean {
  return file.endsWith('.css');
}

function isTestSource(file: string): boolean {
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  return rel.startsWith('tests/') && rel !== 'tests/helpers/dom-fixture.js';
}

function isSourceAssertion(line: string): boolean {
  return /\bnot\.to(?:Contain|Match)\(/.test(line);
}

function checkFile(file: string): Violation[] {
  const source = readFileSync(file, 'utf-8');
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  const violations: Violation[] = [];

  if (!isAllowedPrimitiveImport(file)) {
    for (const match of source.matchAll(PRIMITIVE_IMPORT_RE)) {
      const line = lineNumber(source, match.index ?? 0);
      violations.push({
        file: rel,
        line,
        message: `Direct primitive import ${match[1]} must be wrapped behind src/components/ui/* or src/lib/ui/*`,
        excerpt: lineAt(source, line),
      });
    }
  }

  if (!isAllowedUiFacadeImport(file)) {
    for (const match of source.matchAll(UI_FACADE_IMPORT_RE)) {
      const line = lineNumber(source, match.index ?? 0);
      violations.push({
        file: rel,
        line,
        message: `Feature code must import Kychon UI through @/components/kychon/ui, not ${match[1]}`,
        excerpt: lineAt(source, line),
      });
    }

    for (const match of source.matchAll(RELATIVE_IMPORT_RE)) {
      const target = relativeImportTarget(file, match[1]);
      if (!target.startsWith('src/components/ui/')) continue;
      const line = lineNumber(source, match.index ?? 0);
      violations.push({
        file: rel,
        line,
        message: `Feature code must import Kychon UI through @/components/kychon/ui, not relative base UI import ${match[1]}`,
        excerpt: lineAt(source, line),
      });
    }
  }

  if (isProductSource(file)) {
    for (const match of source.matchAll(HAND_ROLLED_DOM_RE)) {
      const line = lineNumber(source, match.index ?? 0);
      violations.push({
        file: rel,
        line,
        message: 'Product source must not hand-build DOM; use React islands, Astro markup, or dom-fragment helpers',
        excerpt: lineAt(source, line),
      });
    }

    for (const match of source.matchAll(CLASS_LITERAL_RE)) {
      const classes = String(match[1] || '').split(/\s+/).filter(Boolean);
      if (!classes.some((className) => RETIRED_PRIMITIVE_CLASSES.has(className))) continue;
      const line = lineNumber(source, match.index ?? 0);
      violations.push({
        file: rel,
        line,
        message: 'Product source must not use retired Kychon primitive class tokens; use shadcn/Kychon UI and semantic data hooks',
        excerpt: lineAt(source, line),
      });
    }
  }

  if (isCssSource(file)) {
    const cssForSelectorScan = stripCssNoise(source);
    for (const match of cssForSelectorScan.matchAll(RETIRED_PRIMITIVE_CLASS_DEFINITION_RE)) {
      const line = lineNumber(cssForSelectorScan, match.index ?? 0);
      violations.push({
        file: rel,
        line,
        message: 'CSS must not define retired Kychon primitive classes; use Tailwind, shadcn/Kychon UI, and data hooks',
        excerpt: lineAt(source, line),
      });
    }

    for (const match of cssForSelectorScan.matchAll(CSS_CLASS_SELECTOR_RE)) {
      const line = lineNumber(cssForSelectorScan, match.index ?? 0);
      violations.push({
        file: rel,
        line,
        message: `Owned CSS must not define custom class selector .${match[2]}; use data attributes, semantic elements, or Tailwind utilities`,
        excerpt: lineAt(source, line),
      });
    }
  }

  if (isTestSource(file)) {
    for (const match of source.matchAll(HAND_ROLLED_DOM_RE)) {
      const line = lineNumber(source, match.index ?? 0);
      const excerpt = lineAt(source, line);
      if (isSourceAssertion(excerpt)) continue;
      violations.push({
        file: rel,
        line,
        message: 'Tests must use tests/helpers/dom-fixture.js instead of hand-building DOM fixtures',
        excerpt,
      });
    }
  }

  for (const match of source.matchAll(/`[^`]*\$\{[^`]*`/g)) {
    const text = match[0];
    if (!DYNAMIC_TAILWIND_RE.test(text)) continue;
    const line = lineNumber(source, match.index ?? 0);
    violations.push({
      file: rel,
      line,
      message: 'Dynamic Tailwind utility construction must use CSS variables, data attributes, or a static variant map',
      excerpt: lineAt(source, line),
    });
  }

  return violations;
}

function main(): void {
  const files = SCAN_DIRS.flatMap((dir) => walk(join(ROOT, dir)));
  const violations = files.flatMap(checkFile);

  if (violations.length === 0) {
    process.stdout.write(`ok ui architecture check (${files.length} files scanned)\n`);
    return;
  }

  for (const violation of violations) {
    process.stderr.write(`${violation.file}:${violation.line} ${violation.message}\n`);
    process.stderr.write(`  ${violation.excerpt}\n`);
  }
  process.exit(1);
}

main();
