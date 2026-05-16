// Tiny dependency-free HTML sanitizer for rich-text fields stored by admins
// (announcement bodies, etc.) and rendered back onto every member's
// page. Strips on*= event handlers, <script>, javascript: hrefs, and any tag
// not on the Tiptap-compatible allowlist.
//
// Two execution contexts:
//   - Browser: uses the shared fragment parser.
//   - Node tests: relies on happy-dom (or jsdom) to provide parser globals.
// Both are tested in tests/unit/security-bug-23-esc-xss.test.ts.

import { parseHtmlBody, removeNode, serializeHtmlChildren, unwrapElement } from './dom-fragment';

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'ins',
  'sub',
  'sup',
  'mark',
  'small',
  'span',
  'div',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'img',
  'figure',
  'figcaption',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
]);

const DROP_WITH_CONTENT_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed']);
const DROP_ELEMENT_TAGS = new Set(['input', 'select', 'textarea', 'option']);

const ALLOWED_ATTRS_BY_TAG: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  '*': new Set(['id', 'lang', 'dir']),
};

const SAFE_URL_PROTOCOLS = ['http:', 'https:', 'mailto:'];

function isSafeUrl(value: string, allowDataImage = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Allow protocol-relative or absolute paths.
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
  // URLs with no colon are relative and safe.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return true;
  const colon = trimmed.indexOf(':');
  const protocol = trimmed.slice(0, colon + 1).toLowerCase();
  if (SAFE_URL_PROTOCOLS.includes(protocol)) return true;
  if (allowDataImage && protocol === 'data:' && /^data:image\/(png|jpe?g|gif|webp|svg\+xml)/i.test(trimmed)) {
    return true;
  }
  return false;
}

const EMPTY_ATTR_SET: ReadonlySet<string> = new Set();

function sanitizeAttributes(el: Element): void {
  const tag = el.tagName.toLowerCase();
  const allowed = ALLOWED_ATTRS_BY_TAG[tag] ?? EMPTY_ATTR_SET;
  const allowedGlobal = ALLOWED_ATTRS_BY_TAG['*'] ?? EMPTY_ATTR_SET;
  const toRemove: string[] = [];
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on')) {
      toRemove.push(attr.name);
      continue;
    }
    if (!allowed.has(name) && !allowedGlobal.has(name)) {
      toRemove.push(attr.name);
      continue;
    }
    if (name === 'href' && !isSafeUrl(attr.value)) {
      toRemove.push(attr.name);
      continue;
    }
    if (name === 'src' && !isSafeUrl(attr.value, true)) {
      toRemove.push(attr.name);
      continue;
    }
    if (name === 'target' && attr.value && attr.value.toLowerCase() === '_blank') {
      // _blank without rel=noopener leaks window.opener — force a safe rel.
      const existingRel = el.getAttribute('rel') || '';
      if (!/noopener/i.test(existingRel)) {
        el.setAttribute('rel', `${existingRel} noopener noreferrer`.trim());
      }
    }
  }
  for (const name of toRemove) el.removeAttribute(name);
}

function walk(node: Node): void {
  // Iterate over a snapshot since we mutate as we go.
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === 1 /* ELEMENT_NODE */) {
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        if (DROP_ELEMENT_TAGS.has(tag)) {
          removeNode(el);
          continue;
        }
        if (DROP_WITH_CONTENT_TAGS.has(tag)) {
          removeNode(el);
          continue;
        }
        // Drop the element but keep its (recursively sanitized) children.
        unwrapElement(el);
        continue;
      }
      sanitizeAttributes(el);
      walk(el);
    } else if (child.nodeType !== 3 /* TEXT_NODE */ && child.nodeType !== 4 /* CDATA */) {
      // Strip comments, processing instructions, etc.
      removeNode(child);
    }
  }
}

export function sanitizeRichHtml(input: string | null | undefined): string {
  const raw = String(input ?? '');
  if (!raw) return '';
  const body = parseHtmlBody(raw);
  if (!body) {
    // Server-side build context with no DOM — fail closed by escaping.
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  walk(body);
  return serializeHtmlChildren(body);
}

export function sanitizeRichHtmlServer(input: unknown): string {
  if (input == null) return '';
  let html = String(input);
  html = html.replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  html = html.replace(/<\s*(input|select|textarea|option)\b[^>]*>(?:[\s\S]*?<\/\s*\1\s*>)?/gi, '');
  html = html.replace(/<\/?\s*(script|style|iframe|object|embed|svg|math|details|link|meta)(?:\s|\/|>)[^>]*>/gi, '');
  html = html.replace(/<\/?\s*(button|form|label)\b[^>]*>/gi, '');
  html = html.replace(/[\s/]+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/\s(?:class|style)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/\s(href|src)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (_match, attr: string, rawValue: string) => {
    const value = rawValue.replace(/^['"]|['"]$/g, '');
    const decoded = decodeHtmlEntities(value).trim();
    return /^(?:javascript|vbscript):/i.test(decoded) ? '' : ` ${attr}=${rawValue}`;
  });
  html = html.replace(/(\s\w+\s*=\s*["'])\s*(?:javascript|vbscript)\s*:/gi, '$1about:blank#blocked-');
  html = html.replace(/(\s\w+\s*=\s*)(?:javascript|vbscript)\s*:/gi, '$1about:blank#blocked-');
  return html;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized === 'amp') return '&';
    if (normalized === 'lt') return '<';
    if (normalized === 'gt') return '>';
    if (normalized === 'quot') return '"';
    if (normalized === 'apos') return "'";
    if (normalized.startsWith('#x')) return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
    if (normalized.startsWith('#')) return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
    return match;
  });
}
