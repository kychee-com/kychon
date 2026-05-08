import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SCAN_DIRS = ['public/css', 'src'];
const TARGET_CLASSES = [
  'hidden',
  'flex',
  'flex-col',
  'gap-1',
  'mt-1',
  'mt-2',
  'mb-1',
  'mb-2',
  'items-center',
  'justify-between',
  'text-sm',
  'text-center',
  'text-muted',
  'container',
  'btn',
  'card',
  'badge',
  'toast',
  'form-input',
  'form-select',
  'form-textarea',
] as const;

type TargetClass = (typeof TARGET_CLASSES)[number];

interface Hit {
  file: string;
  line: number;
  excerpt: string;
}

interface ClassReport {
  className: TargetClass;
  definitionHits: Hit[];
  usageHits: Hit[];
  decision: string;
}

function parseArgs(): { out: string | null } {
  const outIndex = process.argv.indexOf('--out');
  return { out: outIndex >= 0 ? process.argv[outIndex + 1] ?? null : null };
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (/\.(astro|css|js|jsx|ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function hit(file: string, line: number, excerpt: string): Hit {
  return {
    file: relative(ROOT, file).replaceAll('\\', '/'),
    line,
    excerpt: excerpt.trim(),
  };
}

function decisionFor(className: TargetClass): string {
  if (className === 'container') {
    return 'Retired as a Kychon layout class; use `.ky-container` for Kychon chrome/block layout and reserve `.container` for Tailwind if needed.';
  }
  if (className === 'text-muted') {
    return 'Retired as a Kychon helper; use `.ky-text-muted` for public/static markup or Tailwind/shadcn semantic text utilities in React code.';
  }
  if (['btn', 'card', 'badge', 'toast', 'form-input', 'form-select', 'form-textarea'].includes(className)) {
    return 'Owned public component class retained temporarily while call sites move to Kychon UI components.';
  }
  return 'Kychon must not define this class; exact class-token usages should resolve to Tailwind utilities.';
}

function findClassHits(file: string, className: TargetClass): Pick<ClassReport, 'definitionHits' | 'usageHits'> {
  const source = readFileSync(file, 'utf-8');
  const lines = source.split('\n');
  const definitionRe = new RegExp(`(^|[^a-zA-Z0-9_-])\\.${className.replace('-', '\\-')}(?=$|[^a-zA-Z0-9_-])`);
  const classAttrRe = /\bclass(?:Name)?\s*=\s*(["'`])([^"'`]*)\1/g;
  const classNameAssignRe = /\.className\s*=\s*(["'`])([^"'`]*)\1/g;
  const definitionHits: Hit[] = [];
  const usageHits: Hit[] = [];

  lines.forEach((line, index) => {
    if (file.endsWith('.css') && definitionRe.test(line)) {
      definitionHits.push(hit(file, index + 1, line));
      return;
    }
    classAttrRe.lastIndex = 0;
    classNameAssignRe.lastIndex = 0;
    const hasClassAttr = [...line.matchAll(classAttrRe), ...line.matchAll(classNameAssignRe)].some((match) => {
      const classes = match[2] ?? '';
      return classes.split(/\s+/).includes(className);
    });
    if (hasClassAttr) usageHits.push(hit(file, index + 1, line));
  });

  return { definitionHits, usageHits };
}

function renderMarkdown(reports: ClassReport[]): string {
  const generatedAt = new Date().toISOString();
  const lines = [
    '# UI CSS Collision Report',
    '',
    `Generated: ${generatedAt}`,
    '',
    'This report tracks legacy unprefixed classes that collide with Tailwind utilities or shadcn/Kychon component names. New UI code should not add fresh usages of these classes unless it is explicitly part of the compatibility layer.',
    '',
    '| Class | Definitions | Usages | Decision |',
    '|---|---:|---:|---|',
    ...reports.map((report) => {
      return `| \`.${report.className}\` | ${report.definitionHits.length} | ${report.usageHits.length} | ${report.decision} |`;
    }),
    '',
    '## Hit Details',
    '',
  ];

  for (const report of reports) {
    lines.push(`### .${report.className}`, '', report.decision, '');
    if (report.definitionHits.length > 0) {
      lines.push('Definitions:');
      for (const item of report.definitionHits) lines.push(`- \`${item.file}:${item.line}\` ${item.excerpt}`);
      lines.push('');
    }
    if (report.usageHits.length > 0) {
      lines.push('Usages:');
      for (const item of report.usageHits.slice(0, 30)) lines.push(`- \`${item.file}:${item.line}\` ${item.excerpt}`);
      if (report.usageHits.length > 30) lines.push(`- ... ${report.usageHits.length - 30} more usages`);
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

function main(): void {
  const { out } = parseArgs();
  const files = SCAN_DIRS.flatMap((dir) => walk(join(ROOT, dir)));
  const reports = TARGET_CLASSES.map((className) => {
    const definitionHits: Hit[] = [];
    const usageHits: Hit[] = [];
    for (const file of files) {
      const result = findClassHits(file, className);
      definitionHits.push(...result.definitionHits);
      usageHits.push(...result.usageHits);
    }
    return { className, definitionHits, usageHits, decision: decisionFor(className) };
  });
  const markdown = renderMarkdown(reports);

  if (out) {
    writeFileSync(join(ROOT, out), markdown, 'utf-8');
    process.stdout.write(`wrote ${out}\n`);
    return;
  }
  process.stdout.write(markdown);
}

main();
