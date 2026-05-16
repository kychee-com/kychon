import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = join(import.meta.dirname, '..');
const SCAN_DIRS = ['src', 'scripts', 'tests', 'public', 'demo', 'functions'];
const ROOT_SCAN_FILES = [
  '_aage-port-deploy.ts',
  '_aage-port.seed.sql',
  '_bmwclubcanberra-port-deploy.ts',
  '_bmwclubcanberra-port.seed.sql',
  '_odbc-port-deploy.ts',
  '_odbc-port.seed.sql',
];
const SOURCE_EXTENSIONS = new Set(['.astro', '.css', '.html', '.js', '.jsx', '.mjs', '.sql', '.ts', '.tsx']);
const ALLOWED_PRIMITIVE_IMPORT_PREFIXES = ['src/components/ui/', 'src/lib/ui/'];
const ALLOWED_UI_FACADE_IMPORT_PREFIXES = ['src/components/ui/'];
const ALLOWED_UI_FACADE_IMPORT_FILES = new Set(['src/components/kychon/ui.ts']);
const ALLOWED_DOM_FRAGMENT_HELPER_FILES = new Set(['src/lib/dom-fragment.ts', 'tests/helpers/dom-fixture.js']);
const PRIMITIVE_IMPORT_RE = /from\s+['"](@radix-ui\/[^'"]+|@base-ui-components\/[^'"]+)['"]/g;
const UI_FACADE_IMPORT_RE = /from\s+['"](@\/components\/ui\/[^'"]+)['"]/g;
const RELATIVE_IMPORT_RE = /from\s+['"](\.{1,2}\/[^'"]+)['"]/g;
const HAND_ROLLED_DOM_RE =
  /\b(?:document\.createElement|document\.createRange|createContextualFragment|insertAdjacentHTML|appendChild|removeChild|innerHTML\s*=|outerHTML\s*=|replaceChildren\(|insertBefore\(|replaceWith\()|(?:\.className\s*=|classList\.|\.(?:append|prepend|remove)\()/g;
const SELECTOR_DOM_LOOKUP_RE =
  /\bdocument\.(?:getElementById|getElementsByClassName|getElementsByTagName|querySelector(?:All)?)\s*\(|(?:\?\.|\.)\s*(?:closest|matches|querySelector(?:All)?)\s*\(/g;
const NATIVE_CONTROL_RE = /<\s*(button|input|select|textarea|label)\b([^>]*)>/g;
const SEED_ARTIFACT_LEGACY_HTML_RE = /<\s*(form|iframe|style)\b|\s(class|style)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const SEED_ARTIFACT_STRIPPED_ATTR_FRAGMENT_RE =
  /<\s*([a-z][a-z0-9-]*)\b(?=[^>]*(?:\b(?:aspect|bg|border|flex|grid|max-h|max-w|mb|mt|mx|my|min-h|min-w|object|overflow|px|py|rounded|shadow|text)[-\w:/%.()]*\b|\b(?:rem|solid|srgb)\b|color-mix\(|var\(--))[^=>]*>/gi;
const CLASS_LITERAL_RE = /\b(?:class|className)=\\*(["'`])([^'"`]*)\\*\1/g;
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
  'ky-container',
  'ky-text-muted',
  'page-content',
  'table-wrap',
]);
const RETIRED_PRIMITIVE_CLASS_DEFINITION_RE = new RegExp(
  `(^|[^a-zA-Z0-9_-])\\.(${Array.from(RETIRED_PRIMITIVE_CLASSES).join('|')})(?=$|[^a-zA-Z0-9_-])`,
  'g',
);
const CSS_CLASS_SELECTOR_RE = /(^|[\s,{>+~])\.([A-Za-z_][A-Za-z0-9_-]*)(?=$|[^A-Za-z0-9_-])/g;
const DYNAMIC_TAILWIND_PREFIX =
  '(?:bg|text|border|ring|from|via|to|fill|stroke|outline|decoration|accent|caret|shadow|rounded|gap|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|w|h|min-w|min-h|max-w|max-h|grid-cols|col-span|row-span)';
const DYNAMIC_TAILWIND_TEMPLATE_RE = new RegExp(`\\b${DYNAMIC_TAILWIND_PREFIX}-\\$\\{`);
const DYNAMIC_TAILWIND_CONCAT_RE = new RegExp(`(["'\`])(?:[a-z0-9-]+:)*${DYNAMIC_TAILWIND_PREFIX}-\\1\\s*\\+`, 'g');

export interface Violation {
  file: string;
  line: number;
  message: string;
  excerpt: string;
}

export function isScannedSourcePath(path: string): boolean {
  const rel = path.replaceAll('\\', '/');
  const extIndex = rel.lastIndexOf('.');
  const ext = extIndex >= 0 ? rel.slice(extIndex) : '';
  return (
    (SCAN_DIRS.some((dir) => rel.startsWith(`${dir}/`)) || ROOT_SCAN_FILES.includes(rel)) &&
    SOURCE_EXTENSIONS.has(ext)
  );
}

export function listScanFiles(): string[] {
  const output = execFileSync('git', ['ls-files', '-z', '--', ...SCAN_DIRS, ...ROOT_SCAN_FILES], {
    cwd: ROOT,
    encoding: 'utf-8',
  });
  return Array.from(
    new Set(
      output
        .split('\0')
        .filter(Boolean)
        .filter(isScannedSourcePath)
        .map((file) => join(ROOT, file)),
    ),
  );
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

function isAllowedDomFragmentMutation(file: string, token: string): boolean {
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  return (
    ALLOWED_DOM_FRAGMENT_HELPER_FILES.has(rel) &&
    /(?:replaceChildren|insertBefore|replaceWith|\.append\(|\.prepend\(|\.remove\()/.test(token)
  );
}

function relativeImportTarget(file: string, specifier: string): string {
  return relative(ROOT, join(dirname(file), specifier)).replaceAll('\\', '/');
}

function isProductSource(file: string): boolean {
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  return (
    (rel.startsWith('src/') && !rel.startsWith('src/components/ui/')) ||
    rel.startsWith('public/') ||
    rel.startsWith('demo/') ||
    rel.startsWith('functions/') ||
    ROOT_SCAN_FILES.includes(rel)
  );
}

function isRootPortSeed(file: string): boolean {
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  return ROOT_SCAN_FILES.includes(rel) && rel.endsWith('.seed.sql');
}

function isSeedArtifactSource(file: string): boolean {
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  return isRootPortSeed(file) || rel.startsWith('src/seeds/') || rel.startsWith('demo/');
}

function isUiRenderSource(file: string): boolean {
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  return rel.startsWith('src/') && !rel.startsWith('src/components/ui/') && /\.(?:astro|jsx|tsx)$/.test(file);
}

function isNativeControlSource(file: string): boolean {
  return isUiRenderSource(file) || (isProductSource(file) && !isCssSource(file));
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

export function checkSource(file: string, source: string): Violation[] {
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
      if (isAllowedDomFragmentMutation(file, match[0])) continue;
      const line = lineNumber(source, match.index ?? 0);
      violations.push({
        file: rel,
        line,
        message: 'Product source must not hand-build DOM; use React islands, Astro markup, or dom-fragment helpers',
        excerpt: lineAt(source, line),
      });
    }

    for (const match of source.matchAll(SELECTOR_DOM_LOOKUP_RE)) {
      const line = lineNumber(source, match.index ?? 0);
      violations.push({
        file: rel,
        line,
        message: 'Product source must not use selector-based DOM lookups; use React refs, structural traversal helpers, or explicit host inputs',
        excerpt: lineAt(source, line),
      });
    }

    for (const match of source.matchAll(CLASS_LITERAL_RE)) {
      const classes = String(match[2] || '').replaceAll('\\', '').split(/\s+/).filter(Boolean);
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

  if (isNativeControlSource(file)) {
    for (const match of source.matchAll(NATIVE_CONTROL_RE)) {
      const tag = String(match[1] || '').toLowerCase();
      const line = lineNumber(source, match.index ?? 0);
      violations.push({
        file: rel,
        line,
        message: `Feature UI must use Kychon/shadcn components instead of native <${tag}> controls`,
        excerpt: lineAt(source, line),
      });
    }
  }

  if (isSeedArtifactSource(file)) {
    for (const match of source.matchAll(SEED_ARTIFACT_LEGACY_HTML_RE)) {
      const token = String(match[1] || match[2] || '').toLowerCase();
      const line = lineNumber(source, match.index ?? 0);
      violations.push({
        file: rel,
        line,
        message: `Seed artifacts must not embed legacy ${token} HTML; use structural rich text or typed shadcn/Kychon blocks`,
        excerpt: lineAt(source, line),
      });
    }

    for (const match of source.matchAll(SEED_ARTIFACT_STRIPPED_ATTR_FRAGMENT_RE)) {
      const token = String(match[1] || '').toLowerCase();
      const line = lineNumber(source, match.index ?? 0);
      violations.push({
        file: rel,
        line,
        message: `Seed artifacts must not contain stripped legacy <${token}> attribute fragments; rewrite rich text structurally before tracking generated SQL`,
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
    if (!DYNAMIC_TAILWIND_TEMPLATE_RE.test(text)) continue;
    const line = lineNumber(source, match.index ?? 0);
    violations.push({
      file: rel,
      line,
      message: 'Dynamic Tailwind utility construction must use CSS variables, data attributes, or a static variant map',
      excerpt: lineAt(source, line),
    });
  }

  for (const match of source.matchAll(DYNAMIC_TAILWIND_CONCAT_RE)) {
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

export function checkFile(file: string): Violation[] {
  return checkSource(file, readFileSync(file, 'utf-8'));
}

export function main(): void {
  const files = listScanFiles();
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
