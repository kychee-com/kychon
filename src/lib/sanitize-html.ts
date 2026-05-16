// HTML sanitizer for rich-text fields stored by admins (announcement bodies,
// event descriptions, custom blocks, etc.) and rendered back onto member pages.
// It uses an AST pass so browser and server contexts share the same policy.

import {
  DOCUMENT_NODE,
  ELEMENT_NODE,
  TEXT_NODE,
  parse,
  type ElementNode,
  type Node as HtmlNode,
} from 'ultrahtml';

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

const VOID_TAGS = new Set(['br', 'hr', 'img']);
const DROP_WITH_CONTENT_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed']);
const DROP_ELEMENT_TAGS = new Set(['input', 'select', 'textarea', 'option']);
const DANGEROUS_TEXT_TAG_FRAGMENT_RE =
  /<\s*\/?\s*(?:script|style|iframe|object|embed|svg|math|details|link|meta)(?:[\s/>]|$)[^>]*>/gi;

const ALLOWED_ATTRS_BY_TAG: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  '*': new Set(['id', 'lang', 'dir']),
};

const SAFE_URL_PROTOCOLS = ['http:', 'https:', 'mailto:'];
const EMPTY_ATTR_SET: ReadonlySet<string> = new Set();
const ENTITY_PATTERN = '(?:#\\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);';
const RAW_AMPERSAND_RE = new RegExp(`&(?!(?:${ENTITY_PATTERN}))`, 'gi');

type SanitizableParent = { children: HtmlNode[] };

function isSafeUrl(value: string, allowDataImage = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const compact = trimmed.replace(/[\u0000-\u001f\u007f\s]+/g, '');
  if (compact.startsWith('/') || compact.startsWith('#')) return true;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(compact)) return true;
  const colon = compact.indexOf(':');
  const protocol = compact.slice(0, colon + 1).toLowerCase();
  if (SAFE_URL_PROTOCOLS.includes(protocol)) return true;
  if (allowDataImage && protocol === 'data:' && /^data:image\/(png|jpe?g|gif|webp|svg\+xml)/i.test(compact)) {
    return true;
  }
  return false;
}

function decodeCodePointEntity(match: string, rawCodePoint: string, radix: 10 | 16): string {
  const codePoint = Number.parseInt(rawCodePoint, radix);
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
  return String.fromCodePoint(codePoint);
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized === 'amp') return '&';
    if (normalized === 'lt') return '<';
    if (normalized === 'gt') return '>';
    if (normalized === 'quot') return '"';
    if (normalized === 'apos') return "'";
    if (normalized === 'colon') return ':';
    if (normalized === 'tab') return '\t';
    if (normalized === 'newline') return '\n';
    if (normalized.startsWith('#x')) return decodeCodePointEntity(match, normalized.slice(2), 16);
    if (normalized.startsWith('#')) return decodeCodePointEntity(match, normalized.slice(1), 10);
    return match;
  });
}

function escapeText(value: string): string {
  return value.replace(RAW_AMPERSAND_RE, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}

function stripDangerousTextFragments(value: string): string {
  return value.replace(DANGEROUS_TEXT_TAG_FRAGMENT_RE, '');
}

function safeRelForBlankTarget(existingRel: string): string {
  const tokens = existingRel.split(/\s+/).filter(Boolean);
  const lowerTokens = new Set(tokens.map((token) => token.toLowerCase()));
  if (!lowerTokens.has('noopener')) tokens.push('noopener');
  if (!lowerTokens.has('noreferrer')) tokens.push('noreferrer');
  return tokens.join(' ');
}

function sanitizeAttributes(node: ElementNode): Record<string, string> {
  const tag = node.name.toLowerCase();
  const allowed = ALLOWED_ATTRS_BY_TAG[tag] ?? EMPTY_ATTR_SET;
  const allowedGlobal = ALLOWED_ATTRS_BY_TAG['*'] ?? EMPTY_ATTR_SET;
  const nextAttributes: Record<string, string> = {};

  for (const [rawName, rawValue] of Object.entries(node.attributes ?? {})) {
    const name = rawName.toLowerCase();
    const value = String(rawValue ?? '');
    if (name.startsWith('on')) continue;
    if (!allowed.has(name) && !allowedGlobal.has(name)) continue;

    const decodedValue = decodeHtmlEntities(value);
    if (name === 'href' && !isSafeUrl(decodedValue)) continue;
    if (name === 'src' && !isSafeUrl(decodedValue, true)) continue;

    nextAttributes[name] = value;
  }

  if (nextAttributes.target?.toLowerCase() === '_blank') {
    nextAttributes.rel = safeRelForBlankTarget(nextAttributes.rel || '');
  }

  return nextAttributes;
}

function sanitizeChildren(parent: SanitizableParent): HtmlNode[] {
  const sanitized: HtmlNode[] = [];
  for (const child of parent.children) sanitized.push(...sanitizeNode(child));
  return sanitized;
}

function sanitizeNode(node: HtmlNode): HtmlNode[] {
  if (node.type === TEXT_NODE) return [node];
  if (node.type === DOCUMENT_NODE) return sanitizeChildren(node as unknown as SanitizableParent);
  if (node.type !== ELEMENT_NODE) return [];

  const tag = node.name.toLowerCase();
  if (DROP_WITH_CONTENT_TAGS.has(tag) || DROP_ELEMENT_TAGS.has(tag)) return [];

  const children = sanitizeChildren(node);
  if (!ALLOWED_TAGS.has(tag)) return children;

  node.name = tag;
  node.attributes = sanitizeAttributes(node);
  node.children = children;
  return [node];
}

function renderAttributes(attributes: Record<string, string>): string {
  return Object.entries(attributes)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('');
}

function renderSanitizedNode(node: HtmlNode): string {
  if (node.type === TEXT_NODE) return escapeText(stripDangerousTextFragments(node.value));
  if (node.type === DOCUMENT_NODE) return node.children.map(renderSanitizedNode).join('');
  if (node.type !== ELEMENT_NODE) return '';

  const openTag = `<${node.name}${renderAttributes(node.attributes ?? {})}>`;
  if (VOID_TAGS.has(node.name)) return openTag;
  return `${openTag}${node.children.map(renderSanitizedNode).join('')}</${node.name}>`;
}

function sanitizeRichHtmlAst(input: string): string {
  const root = parse(input) as SanitizableParent;
  return sanitizeChildren(root).map(renderSanitizedNode).join('');
}

export function sanitizeRichHtml(input: string | null | undefined): string {
  const raw = String(input ?? '');
  if (!raw) return '';
  try {
    return sanitizeRichHtmlAst(raw);
  } catch {
    return escapeText(raw);
  }
}

export function sanitizeRichHtmlServer(input: unknown): string {
  if (input == null) return '';
  return sanitizeRichHtml(String(input));
}
