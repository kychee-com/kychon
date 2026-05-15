function domParserCtor(): typeof DOMParser | undefined {
  return typeof DOMParser !== 'undefined'
    ? DOMParser
    : (globalThis as unknown as { DOMParser?: typeof DOMParser }).DOMParser;
}

export function parseHtmlBody(html: string): HTMLElement | null {
  const parserCtor = domParserCtor();
  if (!parserCtor) return null;
  return new parserCtor().parseFromString(`<body>${html}</body>`, 'text/html').body;
}

function parseHtmlFragment(html: string): Node[] {
  const body = parseHtmlBody(html);
  if (!body) throw new Error('DOMParser is required to render HTML fragments');
  return Array.from(body.childNodes).map((node) => document.importNode(node, true));
}

function nodeToHtml(node: ChildNode): string {
  if (node instanceof Element) return node.outerHTML;
  if (node instanceof Text) return node.textContent || '';
  return '';
}

function childNodesEqual(host: ParentNode, nextChildren: Node[]): boolean {
  const currentChildren = Array.from(host.childNodes);
  if (currentChildren.length !== nextChildren.length) return false;
  return currentChildren.every((child, index) => child.isEqualNode(nextChildren[index] ?? null));
}

export function serializeHtmlChildren(host: ParentNode): string {
  return Array.from(host.childNodes).map(nodeToHtml).join('');
}

export function renderHtmlChildren(host: HTMLElement, html: string): void {
  const nextChildren = parseHtmlFragment(html);
  if (childNodesEqual(host, nextChildren)) return;
  host.replaceChildren(...nextChildren);
}

export function clearHtmlChildren(host: HTMLElement): void {
  if (host.childNodes.length === 0) return;
  host.replaceChildren();
}

export function moveNodeToEnd(host: HTMLElement, node: HTMLElement): void {
  if (node.parentElement === host && node === host.lastElementChild) return;
  host.append(node);
}
