import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

export const REACT_HTML_CHILDREN_ATTR = 'data-react-html-children';

const ROOTS = new WeakMap<HTMLElement, Root>();
const LAST_HTML = new WeakMap<HTMLElement, string>();

function nodeToHtml(node: ChildNode): string {
  if (node instanceof Element) return node.outerHTML;
  if (node instanceof Text) return node.textContent || '';
  return '';
}

export function reactHtmlChildrenHost(host: HTMLElement): HTMLElement {
  for (const child of Array.from(host.children)) {
    if (child instanceof HTMLElement && child.hasAttribute(REACT_HTML_CHILDREN_ATTR)) return child;
  }
  return host;
}

export function serializeReactHtmlChildren(host: HTMLElement): string {
  return Array.from(reactHtmlChildrenHost(host).childNodes).map(nodeToHtml).join('');
}

export function renderReactHtmlChildren(host: HTMLElement, html: string): void {
  if (ROOTS.has(host) && LAST_HTML.get(host) === html) return;

  let root = ROOTS.get(host);
  if (!root) {
    root = createRoot(host);
    ROOTS.set(host, root);
  }

  flushSync(() => {
    root.render(
      createElement('div', {
        [REACT_HTML_CHILDREN_ATTR]: '',
        className: 'contents',
        dangerouslySetInnerHTML: { __html: html },
      }),
    );
  });
  LAST_HTML.set(host, html);
}
