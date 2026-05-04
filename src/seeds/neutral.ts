import type { ProjectSeed } from './types.js';

export const seed: ProjectSeed = {
  site_config: {
    site_name: { value: 'Member Portal', category: 'branding' },
    site_description: { value: 'A membership portal is loading.', category: 'branding' },
    brand_text: { value: 'Member Portal', category: 'branding' },
    brand_text_short: { value: 'Portal', category: 'branding' },
    brand_icon_url: { value: '', category: 'branding' },
    brand_wordmark_url: { value: '', category: 'branding' },
    favicon_url: { value: '/favicon.svg', category: 'branding' },
    theme: {
      value: {
        primary: '#243447',
        primary_hover: '#1b2836',
        bg: '#f7f8fa',
        surface: '#ffffff',
        text: '#1f2933',
        text_muted: '#667085',
        border: '#d0d5dd',
        accent: '#4f6f8f',
        font_heading: 'system-ui',
        font_body: 'system-ui',
        radius: '0.5rem',
        max_width: '72rem',
      },
      category: 'theme',
    },
  },
  sections: [
    {
      page_slug: '*',
      zone: 'header',
      scope: 'global',
      section_type: 'brand_header',
      config: { href: '/' },
      position: 1,
      visible: true,
    },
    {
      page_slug: '*',
      zone: 'header',
      scope: 'global',
      section_type: 'sign_in_bar',
      config: { show_lang_toggle: true, show_theme_toggle: true },
      position: 2,
      visible: true,
    },
  ],
};
