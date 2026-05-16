type ElementContainer = Pick<Document, 'children'> | Element | null | undefined;

export function isHtmlElement(value: unknown): value is HTMLElement {
  return value instanceof HTMLElement;
}

export function directElementChildren(parent: ElementContainer): HTMLElement[] {
  return Array.from(parent?.children ?? []).filter(isHtmlElement);
}

export function findDirectElementChild(
  parent: ElementContainer,
  predicate: (child: HTMLElement) => boolean,
): HTMLElement | null {
  return directElementChildren(parent).find(predicate) ?? null;
}

export function findDescendantElement(
  parent: ElementContainer,
  predicate: (child: HTMLElement) => boolean,
): HTMLElement | null {
  for (const child of directElementChildren(parent)) {
    if (predicate(child)) return child;
    const nested = findDescendantElement(child, predicate);
    if (nested) return nested;
  }
  return null;
}

export function collectDescendantElements(
  root: ElementContainer,
  predicate: (child: HTMLElement) => boolean,
  matches: HTMLElement[] = [],
): HTMLElement[] {
  if (isHtmlElement(root) && predicate(root)) matches.push(root);
  for (const child of directElementChildren(root)) collectDescendantElements(child, predicate, matches);
  return matches;
}

export function nearestElement(host: Element | null, predicate: (element: HTMLElement) => boolean): HTMLElement | null {
  let current: Element | null = host;
  while (current) {
    if (isHtmlElement(current) && predicate(current)) return current;
    current = current.parentElement;
  }
  return null;
}

export function nearestAncestorElement(
  host: Element | null,
  predicate: (element: HTMLElement) => boolean,
): HTMLElement | null {
  let current = host?.parentElement ?? null;
  while (current) {
    if (isHtmlElement(current) && predicate(current)) return current;
    current = current.parentElement;
  }
  return null;
}

export function nearestElementWithAttribute(host: Element | null, attribute: string): HTMLElement | null {
  return nearestElement(host, (element) => element.hasAttribute(attribute));
}

export function nearestAncestorWithAttribute(host: Element | null, attribute: string): HTMLElement | null {
  return nearestAncestorElement(host, (element) => element.hasAttribute(attribute));
}

export function nearestElementWithTagName(host: Element | null, tagName: string): HTMLElement | null {
  const normalized = tagName.toUpperCase();
  return nearestElement(host, (element) => element.tagName === normalized);
}

export interface StructuralElement {
  readonly children?: ArrayLike<StructuralElement>;
  readonly id?: string;
  readonly textContent?: string | null;
}

type StructuralElementContainer = Pick<Document, 'children'> | StructuralElement | null | undefined;

export function findDescendantElementById(container: StructuralElementContainer, id: string): StructuralElement | null {
  for (const child of Array.from(container?.children ?? [])) {
    if (child.id === id) return child;
    const nested = findDescendantElementById(child, id);
    if (nested) return nested;
  }
  return null;
}

export function sectionShellFor(host: HTMLElement): HTMLElement {
  return nearestAncestorWithAttribute(host, 'data-section') ?? host;
}
