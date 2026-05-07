import type { Section } from '../../src/lib/blocks';

export const copiedThemeFidelityTheme = {
  interactions: {
    button: {
      hover: {
        background: '#ffcc00',
        text: '#111111',
        duration: '180ms',
      },
    },
    card: {
      hover: {
        shadow: '0 10px 30px rgba(0,0,0,0.18)',
        transform: 'translateY(-2px)',
      },
    },
  },
  header: {
    padding: '1rem 0',
  },
  nav: {
    link_color: '#17324d',
    dropdown_bg: '#ffffff',
    dropdown_shadow: '0 12px 32px rgba(0,0,0,0.2)',
  },
  carousel: {
    arrow: {
      background: '#17324d',
      text: '#ffffff',
      hover: { background: '#ffcc00', text: '#111111' },
    },
    dot: {
      background: 'rgba(23,50,77,0.3)',
      active_background: '#17324d',
    },
  },
};

export const copiedThemeFidelitySections: Section[] = [
  {
    id: 9401,
    page_slug: 'index',
    zone: 'header',
    scope: 'global',
    section_type: 'nav',
    position: 1,
    config: {
      items: [
        {
          label: 'About',
          href: '/about.html',
          public: true,
          children: [
            { label: 'Staff', href: '/staff.html', public: true },
            { label: 'History', href: '/history.html', public: true },
          ],
        },
      ],
      presentation: {
        link_hover_bg: '#ffcc00',
        dropdown_width: '18rem',
        dropdown_offset_y: '0.5rem',
        chevron_color: '#17324d',
      },
      behavior: {
        mobile_breakpoint: 820,
        mobile_closed_layout: 'hidden',
        mobile_open_layout: 'drawer',
      },
    },
  },
  {
    id: 9601,
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type: 'image_accordion',
    position: 2,
    config: {
      heading: 'Our Choirs',
      active_ratio: 3,
      idle_ratio: 1,
      overlay_color: 'rgba(0,0,0,0.45)',
      panels: [
        {
          image_url: '/assets/choir-a.jpg',
          image_alt: 'Junior choir rehearsing',
          title: 'Junior Choir',
          description: 'A bright entry point for new singers.',
          cta_label: 'Explore',
          href: '/junior.html',
          object_position: '45% 50%',
        },
        {
          image_url: '/assets/choir-b.jpg',
          image_alt: 'Senior choir on stage',
          title: 'Senior Choir',
          description: 'Advanced ensemble work and performances.',
          cta_label: 'Explore',
          href: '/senior.html',
          object_position: '55% 50%',
        },
      ],
    },
  },
  {
    id: 9701,
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type: 'shape_divider',
    position: 3,
    config: {
      preset: 'wave',
      top_color: '#ffffff',
      bottom_color: '#17324d',
      height: '84px',
      flip_x: true,
      layers: [
        { fill: 'var(--shape-bottom-color)', opacity: 1 },
        { fill: 'var(--shape-top-color)', opacity: 0.35, translate_y: -14 },
      ],
    },
  },
  {
    id: 9801,
    page_slug: 'index',
    zone: 'main',
    scope: 'page',
    section_type: 'slideshow',
    position: 4,
    config: {
      heading: 'Season Highlights',
      height: '440px',
      mobile_height: '280px',
      transition: 'fade',
      transition_ms: 650,
      transition_easing: 'ease-in-out',
      auto_rotate_seconds: 4,
      pause_on_hover: true,
      pause_on_focus: true,
      manual_pause: true,
      arrow_style: copiedThemeFidelityTheme.carousel.arrow,
      dot_style: copiedThemeFidelityTheme.carousel.dot,
      items: [
        {
          src: '/assets/season-a.jpg',
          alt: 'Choir at winter concert',
          caption: 'Winter concert',
          href: '/events.html',
          object_position: '50% 35%',
        },
        {
          src: '/assets/season-b.jpg',
          alt: 'Choir rehearsal',
          caption: 'Open rehearsal',
          href: '/events.html',
          object_position: '50% 50%',
        },
      ],
    },
  },
];
