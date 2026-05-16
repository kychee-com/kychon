export function nearestElementWithAttribute(host: Element | null, attribute: string): HTMLElement | null {
  let current: Element | null = host;
  while (current) {
    if (current instanceof HTMLElement && current.hasAttribute(attribute)) return current;
    current = current.parentElement;
  }
  return null;
}

export function nearestAncestorWithAttribute(host: Element | null, attribute: string): HTMLElement | null {
  let current = host?.parentElement ?? null;
  while (current) {
    if (current instanceof HTMLElement && current.hasAttribute(attribute)) return current;
    current = current.parentElement;
  }
  return null;
}

export function nearestElementWithTagName(host: Element | null, tagName: string): HTMLElement | null {
  const normalized = tagName.toUpperCase();
  let current: Element | null = host;
  while (current) {
    if (current instanceof HTMLElement && current.tagName === normalized) return current;
    current = current.parentElement;
  }
  return null;
}

type ElementContainer = Pick<Document, 'children'> | Pick<Element, 'children'> | null | undefined;

export function findDescendantElementById(container: ElementContainer, id: string): HTMLElement | null {
  for (const child of Array.from(container?.children ?? [])) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.id === id) return child;
    const nested = findDescendantElementById(child, id);
    if (nested) return nested;
  }
  return null;
}

export function sectionShellFor(host: HTMLElement): HTMLElement {
  return nearestAncestorWithAttribute(host, 'data-section') ?? host;
}
