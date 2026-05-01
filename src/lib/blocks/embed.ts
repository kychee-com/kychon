// embed.ts — Renderer for the `embed` block type. Dispatches to a registered
// provider via `config.provider`, builds the iframe URL via the provider's
// pure `buildSrc(params)`, and emits an iframe with the provider's exact
// sandbox attribute. Refuses to render and emits a visible error placeholder
// when the provider is unknown, `buildSrc` throws, or the generic `iframe`
// provider is used without `trust_acknowledged: true`.

import type { BlockType, Section, BlockRenderContext } from '../blocks.js';
import { escHtml, escAttr } from '../blocks.js';
import { getProvider, type EmbedProvider } from './embed-providers.js';

interface EmbedConfig {
  heading?: string;
  provider?: string;
  params?: Record<string, unknown>;
  height?: string;
  responsive?: boolean;
  trust_acknowledged?: boolean;
}

function jsonAttr(value: unknown): string {
  return JSON.stringify(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Build the section wrapper attrs that AdminEditor's drag/scope/edit handlers
 *  expect — same shape `adminWrap()` in `blocks.ts` produces. */
function buildSectionAttrs(section: Section, ctx: BlockRenderContext, cfg: EmbedConfig): string {
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

function buildAdminControls(section: Section, ctx: BlockRenderContext): string {
  if (!ctx.admin || section.id == null) return '';
  const sid = section.id;
  const isGlobal = section.scope === 'global';
  const pill = isGlobal ? `<span class="admin-scope-pill">Global</span>` : '';
  const toggleLabel = isGlobal ? 'Make page-only' : 'Make global';
  const toggleNext = isGlobal ? 'page' : 'global';
  return (
    `<div class="admin-section-actions">${pill}` +
    `<button class="admin-section-btn" data-embed-edit="${sid}" title="Edit embed">&#9998;</button>` +
    `<button class="admin-scope-toggle" data-scope-toggle="${sid}" data-scope-next="${toggleNext}" title="${toggleLabel}">${toggleLabel}</button>` +
    `<button class="admin-section-btn danger" data-section-remove="${sid}" title="Remove section">&times;</button>` +
    `</div>`
  );
}

/** Render the visible error placeholder. Used when a provider can't render —
 *  unknown id, `buildSrc` throw, missing trust gate, etc. */
export function renderEmbedError(
  message: string,
  section: Section,
  ctx: BlockRenderContext,
  cfg: EmbedConfig,
): string {
  const attrs = buildSectionAttrs(section, ctx, cfg);
  const adminCtrls = buildAdminControls(section, ctx);
  return (
    `<section class="section block-embed block-embed--error"${attrs}>` +
    adminCtrls +
    `<div class="container"><div class="block-embed__error" role="alert">` +
    `<strong>Embed unavailable</strong>` +
    `<p>${escHtml(message)}</p>` +
    `</div></div>` +
    `</section>`
  );
}

/** Construct the iframe element from a provider + resolved src. */
function renderIframe(
  provider: EmbedProvider,
  src: string,
  cfg: EmbedConfig,
): string {
  const sandbox = provider.sandbox.join(' ');
  const title = cfg.heading ? cfg.heading : provider.label;
  const isResponsive = cfg.responsive !== false && provider.responsive;
  const height = cfg.height || provider.defaultHeight;

  const iframeStyle = isResponsive
    ? 'width:100%; height:100%; border:0;'
    : `width:100%; height:${escAttr(height)}; border:0;`;

  const wrapperStyle = isResponsive
    ? 'position:relative; aspect-ratio:16/9; width:100%;'
    : '';

  const iframe =
    `<iframe src="${escAttr(src)}" sandbox="${escAttr(sandbox)}" loading="lazy" ` +
    `title="${escAttr(title)}" allowfullscreen style="${iframeStyle}"></iframe>`;

  return isResponsive
    ? `<div class="block-embed__frame" style="${wrapperStyle}">${iframe}</div>`
    : `<div class="block-embed__frame">${iframe}</div>`;
}

const EMBED: BlockType = {
  label: 'Embed',
  icon: '\u{1F517}',
  dynamic: false,
  zoneHints: ['main'],
  defaultConfig: {
    heading: '',
    provider: 'youtube',
    params: {},
    height: '360px',
    responsive: true,
  },
  render(section: Section, ctx: BlockRenderContext) {
    const cfg = (section.config || {}) as EmbedConfig;
    const providerId = cfg.provider;
    if (!providerId || typeof providerId !== 'string') {
      return renderEmbedError('No provider configured.', section, ctx, cfg);
    }

    const provider = getProvider(providerId);
    if (!provider) {
      return renderEmbedError(`Unknown provider: ${providerId}`, section, ctx, cfg);
    }

    if (provider.trustLevel === 'generic' && cfg.trust_acknowledged !== true) {
      return renderEmbedError(
        'This block embeds an unverified source. An admin must check the trust acknowledgment to enable it.',
        section,
        ctx,
        cfg,
      );
    }

    let src: string;
    try {
      src = provider.buildSrc(cfg.params || {});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not build the embed URL.';
      return renderEmbedError(message, section, ctx, cfg);
    }

    const heading = cfg.heading
      ? `<h2 class="block-embed__heading">${escHtml(cfg.heading)}</h2>`
      : '';
    const pill = provider.trustLevel === 'generic' && ctx.admin
      ? `<small class="block-embed__pill" title="Generic iframe — bypasses provider allowlist">External content</small>`
      : '';
    const attrs = buildSectionAttrs(section, ctx, cfg);
    const adminCtrls = buildAdminControls(section, ctx);
    const iframe = renderIframe(provider, src, cfg);

    return (
      `<section class="section block-embed block-embed--${escAttr(provider.id)}" ` +
      `data-provider="${escAttr(provider.id)}"${attrs}>` +
      adminCtrls +
      `<div class="container">${heading}${iframe}${pill}</div>` +
      `</section>`
    );
  },
};

export default EMBED;
