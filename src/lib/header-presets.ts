// header-presets: porter-emittable header compositions (#99). A preset returns
// an ordered list of header-zone sections the copy-website porter drops in a
// single operation, composed from existing and new header blocks rather than a
// monolithic block — so each piece stays independently admin-editable.
export interface PresetSection {
  section_type: string;
  zone: 'header';
  position: number;
  config: Record<string, unknown>;
}

/**
 * Wild Apricot-style utility header cluster: a coordinated first viewport with a
 * utility strip, brand, dropdown nav, compact search, social icons, a safety
 * CTA, and sign-in. Every section_type is a registered header block (the
 * port-patterns test asserts this), so the preset can never seed a fossil.
 */
export function utilityHeaderPreset(): PresetSection[] {
  return [
    { section_type: 'utility_bar', zone: 'header', position: 1, config: { align: 'right', items: [{ label: 'Welcome', href: '' }] } },
    { section_type: 'brand_header', zone: 'header', position: 2, config: { href: '/', brand_header_mode: 'auto' } },
    { section_type: 'nav', zone: 'header', position: 3, config: {} },
    { section_type: 'site_search', zone: 'header', position: 4, config: {} },
    { section_type: 'social_row', zone: 'header', position: 5, config: { links: [] } },
    { section_type: 'safety_cta', zone: 'header', position: 6, config: { label: 'Safety', href: '#', variant: 'solid' } },
    { section_type: 'sign_in_bar', zone: 'header', position: 7, config: {} },
  ];
}
