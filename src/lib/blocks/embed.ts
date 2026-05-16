// embed.ts — Renderer for the `embed` block type. Dispatches to a registered
// provider via `config.provider`, builds the iframe URL via the provider's
// pure `buildSrc(params)`, and emits an iframe with the provider's exact
// sandbox attribute. Refuses to render and emits a visible error placeholder
// when the provider is unknown, `buildSrc` throws, or the generic `iframe`
// provider is used without `trust_acknowledged: true`.

import {
  adminDragHandleHtml,
  adminEmbedEditButtonHtml,
  adminSectionActionsHtml,
  adminScopePillHtml,
  adminScopeToggleHtml,
  adminSectionRemoveButtonHtml,
} from '../admin-action-controls.js';
import { renderEmbedBlockContentHtml, renderEmbedErrorContentHtml } from '@/components/kychon/EmbedBlockView';
import type { BlockRenderContext, BlockType, Section } from '../blocks.js';
import { escAttr, safeCssValue } from '../blocks.js';
import { getProvider, type EmbedProvider } from './embed-providers.js';

interface EmbedConfig {
  heading?: string;
  provider?: string;
  params?: Record<string, unknown>;
  height?: string;
  responsive?: boolean;
  trust_acknowledged?: boolean;
}

const embedSectionClass = 'w-full';

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
  const pill = isGlobal ? adminScopePillHtml() : '';
  const toggleLabel = isGlobal ? 'Make page-only' : 'Make global';
  const toggleNext = isGlobal ? 'page' : 'global';
  return adminSectionActionsHtml(
    `${pill}${adminEmbedEditButtonHtml(sid)}${adminScopeToggleHtml(sid, toggleNext, toggleLabel)}${adminSectionRemoveButtonHtml(sid)}`,
  );
}

function buildAdminDragHandle(section: Section, ctx: BlockRenderContext): string {
  return ctx.admin && section.id != null ? adminDragHandleHtml() : '';
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
    `<section data-section class="${embedSectionClass}" data-embed data-embed-state="error"${attrs}>` +
    buildAdminDragHandle(section, ctx) +
    adminCtrls +
    renderEmbedErrorContentHtml(message) +
    `</section>`
  );
}

function embedContentHtml(provider: EmbedProvider, src: string, cfg: EmbedConfig, ctx: BlockRenderContext): string {
  const sandbox = provider.sandbox.join(' ');
  const title = cfg.heading ? cfg.heading : provider.label;
  const isResponsive = cfg.responsive !== false && provider.responsive;
  const height = safeCssValue(cfg.height || provider.defaultHeight) || provider.defaultHeight;

  return renderEmbedBlockContentHtml({
    heading: cfg.heading || '',
    height,
    providerId: provider.id,
    responsive: isResponsive,
    sandbox,
    showExternalBadge: provider.trustLevel === 'generic' && ctx.admin,
    src,
    title,
  });
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

    const attrs = buildSectionAttrs(section, ctx, cfg);
    const adminCtrls = buildAdminControls(section, ctx);
    const content = embedContentHtml(provider, src, cfg, ctx);

    return (
      `<section data-section class="${embedSectionClass}" data-embed data-embed-state="ready" ` +
      `data-embed-provider="${escAttr(provider.id)}" data-provider="${escAttr(provider.id)}"${attrs}>` +
      buildAdminDragHandle(section, ctx) +
      adminCtrls +
      content +
      `</section>`
    );
  },
};

export default EMBED;
