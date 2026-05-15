// Tiny dependency-free HTML sanitizer for rich-text fields stored by admins
// (announcement bodies, etc.) and re-rendered into innerHTML on every member's
// page. Strips on*= event handlers, <script>, javascript: hrefs, and any tag
// not on the Tiptap-compatible allowlist.
//
// Two execution contexts:
//   - Browser: uses native DOMParser.
//   - Node tests: relies on happy-dom (or jsdom) to provide DOMParser globally.
// Both are tested in tests/unit/security-bug-23-esc-xss.test.ts.

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

const ALLOWED_ATTRS_BY_TAG: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  '*': new Set(['class', 'id', 'lang', 'dir']),
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
        if (DROP_WITH_CONTENT_TAGS.has(tag)) {
          el.remove();
          continue;
        }
        // Drop the element but keep its (recursively sanitized) children.
        const parent = el.parentNode!;
        for (const grand of Array.from(el.childNodes)) parent.insertBefore(grand, el);
        parent.removeChild(el);
        continue;
      }
      sanitizeAttributes(el);
      walk(el);
    } else if (child.nodeType !== 3 /* TEXT_NODE */ && child.nodeType !== 4 /* CDATA */) {
      // Strip comments, processing instructions, etc.
      child.parentNode?.removeChild(child);
    }
  }
}

export function sanitizeRichHtml(input: string | null | undefined): string {
  const raw = String(input ?? '');
  if (!raw) return '';
  // DOMParser is provided by the browser at runtime and by happy-dom in tests.
  const parserCtor: typeof DOMParser | undefined =
    typeof DOMParser !== 'undefined'
      ? DOMParser
      : (globalThis as unknown as { DOMParser?: typeof DOMParser }).DOMParser;
  if (!parserCtor) {
    // Server-side build context with no DOM — fail closed by escaping.
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  const doc = new parserCtor().parseFromString(`<body>${raw}</body>`, 'text/html');
  const body = doc.body;
  if (!body) return '';
  walk(body);
  return body.innerHTML;
}
