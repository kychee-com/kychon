import type { ProjectSeed } from './types.js';
import { DEFAULT_FRESH_START_CHECKLIST_STATE, FRESH_START_CHECKLIST_KEY } from '../lib/fresh-start-checklist.js';

const DEFAULT_NAV_ITEMS = [
  { label: 'Home', href: '/', icon: 'home', public: true },
  { label: 'Members', href: '/directory.html', icon: 'users', auth: true, feature: 'feature_directory' },
  { label: 'Events', href: '/events.html', icon: 'calendar', feature: 'feature_events' },
  { label: 'Resources', href: '/resources.html', icon: 'book-open', feature: 'feature_resources' },
  { label: 'Dashboard', href: '/admin.html', icon: 'bar-chart-2', admin: true },
  { label: 'Members', href: '/admin-members.html', icon: 'users', admin: true },
  { label: 'Settings', href: '/admin-settings.html', icon: 'settings', admin: true },
];

export interface FreshSeedInput {
  organizationName?: string;
  portalSlug?: string;
}

function normalizeOrganizationName(value: string | undefined): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized || 'Your Organization';
}

function normalizePortalSlug(value: string | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\.kychon\.com\/?$/, '')
    .replace(/^www\./, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function shortBrandName(organizationName: string): string {
  if (organizationName.length <= 18) return organizationName;
  const words = organizationName.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return organizationName.slice(0, 18);
  return words.slice(0, 2).join(' ');
}

function portalUrlForSlug(slug: string): string {
  return slug ? `https://${slug}.kychon.com` : '';
}

export function buildFreshSeed(input: FreshSeedInput = {}): ProjectSeed {
  const organizationName = normalizeOrganizationName(
    input.organizationName || process.env.KYCHON_ORGANIZATION_NAME,
  );
  const portalSlug = normalizePortalSlug(input.portalSlug || process.env.KYCHON_PORTAL_SLUG);
  const portalUrl = portalUrlForSlug(portalSlug);

  return {
    site_config: {
      site_name: { value: organizationName, category: 'branding' },
      site_tagline: { value: 'A member portal for your community', category: 'branding' },
      site_description: {
        value: `${organizationName} is getting started on Kychon.`,
        category: 'branding',
      },
      brand_text: { value: organizationName, category: 'branding' },
      brand_text_short: { value: shortBrandName(organizationName), category: 'branding' },
      brand_icon_url: { value: '', category: 'branding' },
      brand_wordmark_url: { value: '', category: 'branding' },
      favicon_url: { value: '', category: 'branding' },
      portal_url: { value: portalUrl, category: 'branding' },
      theme: {
        value: {
          primary: '#2563eb',
          primary_hover: '#1d4ed8',
          bg: '#f8fafc',
          surface: '#ffffff',
          text: '#172033',
          text_muted: '#64748b',
          border: '#d9e2ec',
          accent: '#0f766e',
          font_heading: 'Inter',
          font_body: 'Inter',
          radius: '0.5rem',
          max_width: '72rem',
        },
        category: 'theme',
      },
      feature_events: { value: true, category: 'features' },
      feature_forum: { value: false, category: 'features' },
      feature_directory: { value: true, category: 'features' },
      feature_resources: { value: true, category: 'features' },
      feature_blog: { value: false, category: 'features' },
      feature_committees: { value: false, category: 'features' },
      feature_ai_moderation: { value: false, category: 'features' },
      feature_ai_translation: { value: false, category: 'features' },
      feature_ai_newsletter: { value: false, category: 'features' },
      feature_ai_insights: { value: false, category: 'features' },
      feature_ai_onboarding: { value: false, category: 'features' },
      feature_ai_event_recaps: { value: false, category: 'features' },
      directory_public: { value: false, category: 'features' },
      signup_mode: { value: 'approved', category: 'features' },
      feature_activity_feed: { value: false, category: 'features' },
      feature_reactions: { value: false, category: 'features' },
      feature_polls: { value: false, category: 'features' },
      polls_member_create: { value: false, category: 'features' },
      [FRESH_START_CHECKLIST_KEY]: {
        value: DEFAULT_FRESH_START_CHECKLIST_STATE,
        category: 'onboarding',
      },
    },
    membership_tiers: [
      {
        name: 'Member',
        description: 'Default membership',
        benefits: ['Member directory', 'Announcements', 'Events', 'Resources'],
        price_label: 'Included',
        position: 1,
        is_default: true,
      },
    ],
    sections: [
      {
        page_slug: '*',
        zone: 'header',
        scope: 'global',
        section_type: 'brand_header',
        config: { href: '/' },
        position: 1,
      },
      {
        page_slug: '*',
        zone: 'header',
        scope: 'global',
        section_type: 'nav',
        config: { items: DEFAULT_NAV_ITEMS },
        position: 2,
      },
      {
        page_slug: '*',
        zone: 'header',
        scope: 'global',
        section_type: 'sign_in_bar',
        config: { show_lang_toggle: true, show_theme_toggle: true },
        position: 3,
      },
      {
        page_slug: 'index',
        zone: 'main',
        scope: 'page',
        section_type: 'hero',
        config: {
          heading: `Welcome to ${organizationName}`,
          subheading:
            'This clean portal is ready for your logo, colors, homepage intro, members, events, and resources.',
          cta_text: 'Finish setup',
          cta_href: '/admin.html',
        },
        position: 1,
      },
      {
        page_slug: 'index',
        zone: 'main',
        scope: 'page',
        section_type: 'features',
        config: {
          columns: 3,
          items: [
            {
              icon: 'settings',
              title: 'Shape the homepage',
              desc: 'Add your intro, logo, colors, and the first pages your members should see.',
            },
            {
              icon: 'calendar',
              title: 'Add your first event',
              desc: 'Publish a meeting, game, service, workshop, or gathering when you are ready.',
            },
            {
              icon: 'book-open',
              title: 'Collect resources',
              desc: 'Start with documents, links, forms, handbooks, or anything members ask for often.',
            },
          ],
        },
        position: 2,
      },
      {
        page_slug: 'index',
        zone: 'main',
        scope: 'page',
        section_type: 'announcements_feed',
        config: { heading: 'Announcements', limit: 5 },
        position: 3,
      },
      {
        page_slug: 'index',
        zone: 'main',
        scope: 'page',
        section_type: 'events_list',
        config: {
          heading: 'Upcoming Events',
          count: 3,
          filter: 'upcoming',
          layout: 'cards',
          show_image: false,
          show_location: true,
          show_time: true,
          color_scheme: 'neutral',
        },
        position: 4,
      },
      {
        page_slug: 'index',
        zone: 'main',
        scope: 'page',
        section_type: 'link_list',
        config: {
          heading: 'Resources',
          source: 'resources',
          layout: 'rows',
          filter: { category: '', limit: 5, order: 'newest' },
        },
        position: 5,
      },
      {
        page_slug: '*',
        zone: 'footer',
        scope: 'global',
        section_type: 'footer_attribution',
        config: { text: 'Powered by [Kychon](https://kychon.com)' },
        position: 99,
      },
    ],
  };
}

export const seed: ProjectSeed = buildFreshSeed();
