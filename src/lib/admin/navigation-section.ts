export interface NavigationSectionRow {
  id?: number | string | null;
  section_type?: string | null;
  page_slug?: string | null;
  position?: number | string | null;
  scope?: string | null;
  visible?: boolean | null;
  zone?: string | null;
}

function sectionIdKey(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

function positionValue(value: unknown): number {
  const position = Number(value);
  return Number.isFinite(position) ? position : Number.MAX_SAFE_INTEGER;
}

function appliesToSlug(section: NavigationSectionRow, slug: string): boolean {
  return section.scope === 'global' || section.page_slug === '*' || section.page_slug === slug;
}

function isPageSpecific(section: NavigationSectionRow, slug: string): boolean {
  return section.scope !== 'global' && section.page_slug === slug;
}

export function isCurrentHeaderNavigationSection(section: NavigationSectionRow, slug: string): boolean {
  return (
    section.section_type === 'nav' &&
    section.zone === 'header' &&
    section.visible !== false &&
    appliesToSlug(section, slug)
  );
}

export function chooseNavigationSection(
  rows: NavigationSectionRow[],
  preferredId: number | string | null | undefined,
  slug: string,
): NavigationSectionRow | null {
  const preferredKey = sectionIdKey(preferredId);
  const candidates = rows.filter((section) => isCurrentHeaderNavigationSection(section, slug));

  if (preferredKey) {
    const preferred = candidates.find((section) => sectionIdKey(section.id) === preferredKey);
    if (preferred) return preferred;
  }

  return candidates.sort((left, right) => {
    const leftPageSpecific = isPageSpecific(left, slug) ? 0 : 1;
    const rightPageSpecific = isPageSpecific(right, slug) ? 0 : 1;
    if (leftPageSpecific !== rightPageSpecific) return leftPageSpecific - rightPageSpecific;

    const leftPosition = positionValue(left.position);
    const rightPosition = positionValue(right.position);
    if (leftPosition !== rightPosition) return leftPosition - rightPosition;

    return sectionIdKey(left.id).localeCompare(sectionIdKey(right.id), undefined, { numeric: true });
  })[0] || null;
}
