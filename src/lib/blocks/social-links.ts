import {
  adminDragHandleHtml,
  adminSectionActionsHtml,
  adminScopePillHtml,
  adminScopeToggleHtml,
  adminSectionEditButtonHtml,
  adminSectionRemoveButtonHtml,
} from '../admin-action-controls.js';
import { buttonVariants } from '@/components/kychon/ui';
import type { BlockRenderContext, BlockType, Section } from '../blocks.js';
import { escAttr, escHtml, safeCssValue } from '../blocks.js';

export const SUPPORTED_SOCIAL_PROVIDERS = [
  'facebook',
  'x',
  'linkedin',
  'instagram',
  'youtube',
  'email',
  'website',
] as const;

export type SupportedSocialProvider = (typeof SUPPORTED_SOCIAL_PROVIDERS)[number];
export type SocialProvider = SupportedSocialProvider | 'unknown';

export interface SocialLinkItem {
  platform?: string;
  href?: string;
  label?: string;
  external?: boolean;
  target?: string;
  rel?: string;
  show_label?: boolean;
}

export interface NormalizedSocialLinkItem {
  provider: SocialProvider;
  href: string;
  label: string;
  external: boolean;
  target?: string;
  rel?: string;
  showLabel: boolean;
}

export const SOCIAL_PROVIDER_DISPLAY_NAMES: Record<SocialProvider, string> = {
  facebook: 'Facebook',
  x: 'X',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  youtube: 'YouTube',
  email: 'Email',
  website: 'Website',
  unknown: 'Website',
};

const PROVIDER_ALIASES: Record<string, SocialProvider> = {
  fb: 'facebook',
  facebook: 'facebook',
  'facebook.com': 'facebook',
  twitter: 'x',
  x: 'x',
  'x.com': 'x',
  linkedin: 'linkedin',
  linkedIn: 'linkedin',
  'linked-in': 'linkedin',
  instagram: 'instagram',
  insta: 'instagram',
  youtube: 'youtube',
  'you tube': 'youtube',
  youtu: 'youtube',
  mail: 'email',
  email: 'email',
  e_mail: 'email',
  contact: 'email',
  web: 'website',
  website: 'website',
  homepage: 'website',
  home: 'website',
  url: 'website',
  link: 'website',
};

const SOCIAL_PROVIDER_ICONS: Record<SocialProvider, string> = {
  facebook: '<path d="M14 8h3V4h-3c-3.1 0-5 1.9-5 5v2H6v4h3v5h4v-5h3.2l.6-4H13V9c0-.7.3-1 1-1z" />',
  x: '<path d="M4 4h4.6l3.7 5.1L16.8 4H20l-6.1 7 6.6 9h-4.6l-4.1-5.7L6.7 20H3.5l6.6-7.5L4 4zm3.1 2 9.8 12h1L8.1 6h-1z" />',
  linkedin: '<path d="M5 8h4v12H5V8zm2-5a2.3 2.3 0 1 1 0 4.6A2.3 2.3 0 0 1 7 3zm5 5h3.8v1.7h.1c.5-1 1.8-2 3.6-2 3.9 0 4.5 2.5 4.5 5.8V20h-4v-5.8c0-1.4 0-3.1-1.9-3.1s-2.1 1.5-2.1 3V20h-4V8z" />',
  instagram: '<rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2" /><circle cx="17" cy="7" r="1.25" />',
  youtube: '<path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1A31 31 0 0 0 2 12a31 31 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22 12a31 31 0 0 0-.4-4.8zM10 15.4V8.6l5.8 3.4L10 15.4z" />',
  email: '<path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 2v.4l8 5.1 8-5.1V8H4zm16 8v-5.2l-7.5 4.8a1 1 0 0 1-1 0L4 10.8V16h16z" />',
  website: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />',
  unknown: '<path d="M10 5H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-4h-2v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4V5zm4 0v2h3.6l-8.3 8.3 1.4 1.4L19 8.4V12h2V5h-7z" />',
};

const SOCIAL_PROVIDER_COLORS: Record<SocialProvider, string> = {
  facebook: '#1877f2',
  x: '#000',
  linkedin: '#0a66c2',
  instagram: '#c13584',
  youtube: '#ff0000',
  email: 'var(--color-accent)',
  website: 'var(--color-primary-hover)',
  unknown: 'var(--color-primary-hover)',
};

const socialListClass = 'flex flex-wrap items-center gap-[var(--social-link-gap,0.375rem)] justify-[var(--social-link-justify,flex-start)]';
const socialIconClass = 'block h-[var(--social-link-icon-size,1rem)] w-[var(--social-link-icon-size,1rem)] fill-current';
const socialLabelClass = 'ml-1.5 text-sm leading-none';
const socialLinkBaseClass = 'rounded-[var(--social-link-radius,var(--radius))] border border-[color:var(--social-link-border,var(--border))] bg-[var(--social-link-bg,var(--background))] text-[var(--social-link-color,var(--primary))] no-underline hover:-translate-y-px hover:border-[color:var(--social-link-hover-border,var(--social-link-provider-color,var(--primary)))] hover:bg-[var(--social-link-hover-bg,var(--social-link-provider-color,var(--primary)))] hover:text-[var(--social-link-hover-color,var(--primary-foreground))] focus-visible:ring-ring';

function jsonAttr(value: unknown): string {
  return JSON.stringify(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSectionAttrs(section: Section, ctx: BlockRenderContext, cfg: Record<string, unknown>): string {
  const sid = section.id;
  const sortable = sid != null
    ? ` data-sortable-id="sections.${sid}" data-sortable-field="position"`
    : '';
  const zoneAttr = ` data-section-zone="${section.zone}"`;
  const scopeAttr = ` data-section-scope="${section.scope}"`;
  const cfgAttr = sid != null && ctx.admin
    ? ` data-editable-config="${jsonAttr(cfg)}"`
    : '';
  return `${sortable}${zoneAttr}${scopeAttr}${cfgAttr}`;
}

function styleAttr(vars: string[]): string {
  const style = vars.filter(Boolean).join('');
  return style ? ` style="${escAttr(style)}"` : '';
}

function cssVar(name: string, value: unknown): string {
  const safe = safeCssValue(value);
  return safe ? `${name}:${safe};` : '';
}

function buildAdminControls(section: Section, ctx: BlockRenderContext): string {
  if (!ctx.admin || section.id == null) return '';
  const sid = section.id;
  const isGlobal = section.scope === 'global';
  const pill = isGlobal ? adminScopePillHtml() : '';
  const toggleLabel = isGlobal ? 'Make page-only' : 'Make global';
  const toggleNext = isGlobal ? 'page' : 'global';
  return adminSectionActionsHtml(
    `${pill}${adminSectionEditButtonHtml(sid)}${adminScopeToggleHtml(sid, toggleNext, toggleLabel)}${adminSectionRemoveButtonHtml(sid)}`,
  );
}

function buildAdminDragHandle(section: Section, ctx: BlockRenderContext): string {
  return ctx.admin && section.id != null ? adminDragHandleHtml() : '';
}

function normalizeProviderToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim();
}

function providerFromHref(href: unknown): SocialProvider | null {
  const raw = String(href ?? '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.startsWith('mailto:')) return 'email';
  try {
    const url = new URL(raw, 'https://kychon.local');
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'kychon.local') return null;
    if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.me') return 'facebook';
    if (host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com')) return 'x';
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'linkedin';
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
    if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return 'youtube';
    return 'website';
  } catch {
    return null;
  }
}

export function normalizeSocialProvider(platform: unknown, href?: unknown): SocialProvider {
  const token = normalizeProviderToken(platform);
  const direct = PROVIDER_ALIASES[token];
  if (direct) return direct;
  const compact = token.replace(/\s+/g, '');
  const compactMatch = PROVIDER_ALIASES[compact];
  if (compactMatch) return compactMatch;
  return providerFromHref(href) || 'unknown';
}

export function sanitizeSocialHref(href: unknown): string {
  const raw = String(href ?? '').trim();
  if (!raw || raw.startsWith('//')) return '';
  const lower = raw.toLowerCase();
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:')
  ) {
    return raw;
  }
  if (raw.startsWith('/') || raw.startsWith('#') || raw.startsWith('?')) return raw;
  return '';
}

function getSocialItems(config: Record<string, unknown>): SocialLinkItem[] {
  if (Array.isArray(config.items)) return config.items as SocialLinkItem[];
  if (Array.isArray(config.icons)) return config.icons as SocialLinkItem[];
  return [];
}

export function normalizeSocialLinkItems(config: Record<string, unknown>): NormalizedSocialLinkItem[] {
  return getSocialItems(config)
    .map((item) => {
      const href = sanitizeSocialHref(item.href);
      const provider = normalizeSocialProvider(item.platform || item.label, href);
      const fallbackLabel = SOCIAL_PROVIDER_DISPLAY_NAMES[provider] || SOCIAL_PROVIDER_DISPLAY_NAMES.unknown;
      const label = String(item.label || fallbackLabel).trim() || fallbackLabel;
      const isHttp = /^https?:\/\//i.test(href);
      const normalized: NormalizedSocialLinkItem = {
        provider,
        href,
        label,
        external: item.external !== false && isHttp,
        showLabel: item.show_label === true,
      };
      if (typeof item.target === 'string') normalized.target = item.target;
      if (typeof item.rel === 'string') normalized.rel = item.rel;
      return normalized;
    })
    .filter((item) => item.href);
}

function renderSocialIcon(provider: SocialProvider): string {
  const icon = SOCIAL_PROVIDER_ICONS[provider] || SOCIAL_PROVIDER_ICONS.unknown;
  return `<svg class="${escAttr(socialIconClass)}" data-social-link-icon viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icon}</svg>`;
}

function socialProviderStyleAttr(provider: SocialProvider): string {
  return ` style="${escAttr(`--social-link-provider-color:${SOCIAL_PROVIDER_COLORS[provider]};`)}"`;
}

function renderSocialAnchor(item: NormalizedSocialLinkItem): string {
  const target = item.target || (item.external ? '_blank' : '');
  const targetAttr = target ? ` target="${escAttr(target)}"` : '';
  const relTokens = new Set(
    String(item.rel || '')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean),
  );
  if (target === '_blank') {
    relTokens.add('noopener');
    relTokens.add('noreferrer');
  }
  const relAttr = relTokens.size > 0 ? ` rel="${escAttr(Array.from(relTokens).join(' '))}"` : '';
  const labelText = item.showLabel
    ? `<span class="${escAttr(socialLabelClass)}">${escHtml(item.label)}</span>`
    : '';
  const sizeClass = item.showLabel
    ? 'h-[var(--social-link-size,1.75rem)] w-auto min-w-[var(--social-link-size,1.75rem)] px-3'
    : 'h-[var(--social-link-size,1.75rem)] w-[var(--social-link-size,1.75rem)] flex-[0_0_var(--social-link-size,1.75rem)] p-0';
  const className = buttonVariants({
    className: `${socialLinkBaseClass} ${sizeClass}`,
    size: 'icon',
    variant: 'ghost',
  });
  return (
    `<a class="${escAttr(className)}" data-social-provider="${escAttr(item.provider)}" ` +
    `href="${escAttr(item.href)}" aria-label="${escAttr(item.label)}"${targetAttr}${relAttr}${socialProviderStyleAttr(item.provider)}>` +
    `${renderSocialIcon(item.provider)}${labelText}</a>`
  );
}

export interface RenderSocialLinksOptions {
  className?: string;
  legacyFooter?: boolean;
}

export function renderSocialLinksBlock(
  section: Section,
  ctx: BlockRenderContext,
  options: RenderSocialLinksOptions = {},
): string {
  const cfg = section.config || {};
  const items = normalizeSocialLinkItems(cfg);
  const p = (cfg.presentation || {}) as Record<string, unknown>;
  const zone = section.zone;
  const layout = String(cfg.layout || (zone === 'header' ? 'compact' : 'icons')).toLowerCase();
  const baseClass = options.className || 'section w-full p-0 opacity-100';
  const classes = [
    baseClass,
    zone === 'header' ? 'ml-auto' : '',
  ].filter(Boolean).join(' ');
  const attrs = buildSectionAttrs(section, ctx, cfg);
  const style = styleAttr([
    zone === 'footer' ? '--social-link-size:2rem;' : '',
    zone === 'header' && layout === 'compact' ? '--social-link-size:1.75rem;--social-link-icon-size:0.95rem;' : '',
    cssVar('--social-link-size', p.size),
    cssVar('--social-link-icon-size', p.icon_size),
    cssVar('--social-link-radius', p.radius),
    cssVar('--social-link-bg', p.bg),
    cssVar('--social-link-color', p.color),
    cssVar('--social-link-border', p.border),
    cssVar('--social-link-gap', p.gap),
    cssVar('--social-link-justify', p.justify),
  ]);
  const adminControls = buildAdminControls(section, ctx);
  const dragHandle = buildAdminDragHandle(section, ctx);
  const links = items.map(renderSocialAnchor).join('');
  const layoutAttr = ` data-social-links-zone="${escAttr(zone)}" data-social-links-layout="${escAttr(layout)}"`;
  const legacyAttr = options.legacyFooter ? ' data-legacy-footer-links' : '';
  return `<section class="${escAttr(classes)}" data-social-links${layoutAttr}${legacyAttr}${attrs}${style}>${dragHandle}${adminControls}<div class="${escAttr(socialListClass)}" data-social-links-list>${links}</div></section>`;
}

const SOCIAL_LINKS: BlockType = {
  label: 'Social Links',
  icon: '\u{1F310}',
  dynamic: false,
  zoneHints: ['header', 'footer'],
  supportedSpans: ['1', '1/3'],
  defaultConfig: {
    items: [],
  },
  render(section, ctx) {
    return renderSocialLinksBlock(section, ctx);
  },
};

export default SOCIAL_LINKS;
