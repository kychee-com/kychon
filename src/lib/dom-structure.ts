export function nearestAncestorWithAttribute(host: HTMLElement, attribute: string): HTMLElement | null {
  let current = host.parentElement;
  while (current) {
    if (current.hasAttribute(attribute)) return current;
    current = current.parentElement;
  }
  return null;
}

export function sectionShellFor(host: HTMLElement): HTMLElement {
  return nearestAncestorWithAttribute(host, 'data-section') ?? host;
}
