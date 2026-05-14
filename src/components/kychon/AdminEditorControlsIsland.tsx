'use client';

import { Image, Loader2, Maximize2, Plus, Save, Settings2, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@/components/kychon/ui';
import { COPIED_THEME_EDITOR_TYPES, type CopiedThemeEditorType } from '@/lib/admin/copied-theme-editor';
import { del, get, patch, post } from '@/lib/api';
import { BLOCK_TYPES, getSupportedSpans } from '@/lib/blocks';
import { currentPageSlugFromLocation } from '@/lib/clean-routes';
import { showToast } from '@/lib/toast-events';
import { cn } from '@/lib/ui/cn';

const SECTION_EDIT_EVENT = 'kychon:admin-editor-section-edit';
const ZONE_ADD_EVENT = 'kychon:admin-editor-zone-add';
const SOURCE_SETTINGS_EVENT = 'kychon:admin-editor-open-source-settings';

type Zone = 'header' | 'main' | 'footer';

interface SectionRow {
  id: number;
  section_type: string;
  config?: Record<string, any>;
  scope?: string;
  column_span?: string | null;
}

interface SectionEditDetail {
  sectionId: number;
}

interface ZoneAddDetail {
  zone: Zone;
}

type HeroMode = 'background' | 'foreground';
type HeroAspect = 'auto' | '16/9' | '4/3' | '21/9';
type HeroTextPosition = 'over_image' | 'below_image';
type HeroLogoPosition = 'left' | 'center' | 'right';
type HeroCaptionPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'right-middle'
  | 'bottom-right'
  | 'bottom-center'
  | 'bottom-left'
  | 'left-middle';

interface HeroDraft {
  heading: string;
  subheading: string;
  cta_text: string;
  cta_href: string;
  mode: HeroMode;
  bg_image: string;
  image_url: string;
  image_alt: string;
  image_aspect: HeroAspect;
  logo_overlay_url: string;
  logo_position: HeroLogoPosition;
  logo_max_height: string;
  caption_html: string;
  caption_position: HeroCaptionPosition;
  text_position: HeroTextPosition;
}

let root: Root | null = null;

function asHeroMode(value: unknown): HeroMode {
  return value === 'foreground' ? 'foreground' : 'background';
}

function asHeroAspect(value: unknown): HeroAspect {
  return value === '16/9' || value === '4/3' || value === '21/9' ? value : 'auto';
}

function asHeroTextPosition(value: unknown): HeroTextPosition {
  return value === 'below_image' ? 'below_image' : 'over_image';
}

function asHeroLogoPosition(value: unknown): HeroLogoPosition {
  return value === 'center' || value === 'right' ? value : 'left';
}

function asHeroCaptionPosition(value: unknown): HeroCaptionPosition {
  const valid = new Set([
    'top-left',
    'top-center',
    'top-right',
    'right-middle',
    'bottom-right',
    'bottom-center',
    'bottom-left',
    'left-middle',
  ]);
  return typeof value === 'string' && valid.has(value) ? (value as HeroCaptionPosition) : 'bottom-right';
}

function textValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function heroDraftFromConfig(config: Record<string, any> = {}): HeroDraft {
  return {
    heading: textValue(config.heading),
    subheading: textValue(config.subheading),
    cta_text: textValue(config.cta_text),
    cta_href: textValue(config.cta_href),
    mode: asHeroMode(config.mode),
    bg_image: textValue(config.bg_image),
    image_url: textValue(config.image_url),
    image_alt: textValue(config.image_alt),
    image_aspect: asHeroAspect(config.image_aspect),
    logo_overlay_url: textValue(config.logo_overlay_url),
    logo_position: asHeroLogoPosition(config.logo_position),
    logo_max_height: textValue(config.logo_max_height, '120px'),
    caption_html: textValue(config.caption_html),
    caption_position: asHeroCaptionPosition(config.caption_position),
    text_position: asHeroTextPosition(config.text_position),
  };
}

function heroConfigFromDraft(current: Record<string, any> = {}, draft: HeroDraft): Record<string, any> {
  const next: Record<string, any> = {
    ...current,
    heading: draft.heading.trim(),
    subheading: draft.subheading.trim(),
    cta_text: draft.cta_text.trim(),
    cta_href: draft.cta_href.trim(),
    mode: draft.mode,
  };

  if (draft.mode === 'foreground') {
    delete next.bg_image;
    next.image_url = draft.image_url.trim();
    next.image_alt = draft.image_alt.trim();
    next.image_aspect = draft.image_aspect;
    next.logo_overlay_url = draft.logo_overlay_url.trim();
    next.logo_position = draft.logo_position;
    next.logo_max_height = draft.logo_max_height.trim() || '120px';
    next.caption_html = draft.caption_html.trim();
    next.caption_position = draft.caption_position;
    next.text_position = draft.text_position;
  } else {
    delete next.image_url;
    delete next.image_alt;
    delete next.image_aspect;
    delete next.logo_overlay_url;
    delete next.logo_position;
    delete next.logo_max_height;
    delete next.caption_html;
    delete next.caption_position;
    delete next.text_position;
    next.bg_image = draft.bg_image.trim();
  }

  return next;
}

function NativeSelect({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function clearSectionCaches() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith('wl_cache_sections_'))
    .forEach((key) => localStorage.removeItem(key));
}

function mirrorRenderedSpan(sectionId: number, span: string) {
  const blockEl = document.querySelector(`[data-sortable-id="sections.${sectionId}"]`) as HTMLElement | null;
  if (blockEl) blockEl.setAttribute('data-column-span', span);
}

function mirrorRenderedScope(sectionId: number, next: 'page' | 'global') {
  const flipped = next === 'global' ? 'page' : 'global';
  const inlineToggle = document.querySelector(`[data-scope-toggle="${sectionId}"]`) as HTMLElement | null;
  if (!inlineToggle) return;

  inlineToggle.dataset.scopeNext = flipped;
  inlineToggle.textContent = flipped === 'global' ? 'Make global' : 'Make page-only';
  inlineToggle.title = inlineToggle.textContent;

  const sectionEl = inlineToggle.closest('[data-sortable-id]') as HTMLElement | null;
  if (!sectionEl) return;
  sectionEl.setAttribute('data-section-scope', next);
  const existingPill = sectionEl.querySelector('.admin-section-actions .admin-scope-pill');
  if (next === 'global' && !existingPill) {
    const pill = document.createElement('span');
    pill.className = 'admin-scope-pill';
    pill.textContent = 'Global';
    inlineToggle.before(pill);
  } else if (next === 'page' && existingPill) {
    existingPill.remove();
  }
}

function emitEditorBridgeEvent(name: string, sectionId: number) {
  window.dispatchEvent(new CustomEvent<SectionEditDetail>(name, { detail: { sectionId } }));
}

function isZone(value: unknown): value is Zone {
  return value === 'header' || value === 'main' || value === 'footer';
}

function cloneConfig(config: Record<string, any>): Record<string, any> {
  if (typeof structuredClone === 'function') return structuredClone(config);
  return JSON.parse(JSON.stringify(config));
}

function AdminEditorControls() {
  const [open, setOpen] = useState(false);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [row, setRow] = useState<SectionRow | null>(null);
  const [heroDraft, setHeroDraft] = useState<HeroDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<'span' | 'scope' | 'hero' | 'remove' | null>(null);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addZone, setAddZone] = useState<Zone>('main');
  const [addSaving, setAddSaving] = useState<string | null>(null);
  const [addError, setAddError] = useState('');

  const spans = useMemo(() => (row ? getSupportedSpans(row.section_type) : []), [row]);
  const sectionDef = row ? BLOCK_TYPES[row.section_type] : null;
  const addCandidates = useMemo(
    () =>
      Object.entries(BLOCK_TYPES)
        .filter(([, block]) => !block.zoneHints || block.zoneHints.includes(addZone))
        .sort(([, a], [, b]) => a.label.localeCompare(b.label)),
    [addZone],
  );
  const currentScope: 'page' | 'global' = row?.scope === 'global' ? 'global' : 'page';
  const nextScope: 'page' | 'global' = currentScope === 'global' ? 'page' : 'global';
  const canEditHero = row?.section_type === 'hero';
  const canEditSource = row ? COPIED_THEME_EDITOR_TYPES.has(row.section_type as CopiedThemeEditorType) : false;

  async function loadSection(nextSectionId: number) {
    setOpen(true);
    setSectionId(nextSectionId);
    setRow(null);
    setHeroDraft(null);
    setError('');
    setLoading(true);

    try {
      const rows = await get(`sections?id=eq.${nextSectionId}`);
      if (!rows[0]) {
        setError('Block not found');
        return;
      }
      const nextRow = rows[0] as SectionRow;
      setRow(nextRow);
      setHeroDraft(nextRow.section_type === 'hero' ? heroDraftFromConfig(nextRow.config || {}) : null);
    } catch (loadError) {
      console.error('Failed to load section row:', loadError);
      setError('Could not load block');
      showToast({ type: 'error', message: 'Could not load block' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<SectionEditDetail>).detail;
      if (Number.isFinite(detail?.sectionId)) void loadSection(detail.sectionId);
    };
    window.addEventListener(SECTION_EDIT_EVENT, listener);
    return () => window.removeEventListener(SECTION_EDIT_EVENT, listener);
  }, []);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<ZoneAddDetail>).detail;
      if (!isZone(detail?.zone)) return;
      setAddZone(detail.zone);
      setAddError('');
      setAddSaving(null);
      setAddOpen(true);
    };
    window.addEventListener(ZONE_ADD_EVENT, listener);
    return () => window.removeEventListener(ZONE_ADD_EVENT, listener);
  }, []);

  async function updateSpan(span: string) {
    if (!row || !sectionId || span === row.column_span) return;
    setSaving('span');
    setError('');

    try {
      await patch(`sections?id=eq.${sectionId}`, { column_span: span });
      clearSectionCaches();
      mirrorRenderedSpan(sectionId, span);
      setRow({ ...row, column_span: span });
      showToast({ type: 'success', message: 'Width saved' });
      document.dispatchEvent(new CustomEvent('wl-content-rendered'));
    } catch (saveError) {
      console.error('Span save failed:', saveError);
      setError('Save failed');
      showToast({ type: 'error', message: 'Save failed' });
    } finally {
      setSaving(null);
    }
  }

  async function updateScope() {
    if (!row || !sectionId) return;
    setSaving('scope');
    setError('');

    try {
      await patch(`sections?id=eq.${sectionId}`, { scope: nextScope });
      clearSectionCaches();
      mirrorRenderedScope(sectionId, nextScope);
      setRow({ ...row, scope: nextScope });
      showToast({
        type: 'success',
        message: nextScope === 'global' ? 'Saved - appears on all pages' : 'Saved - appears on this page only',
      });
      document.dispatchEvent(new CustomEvent('wl-content-rendered'));
    } catch (saveError) {
      console.error('Scope save failed:', saveError);
      setError('Save failed');
      showToast({ type: 'error', message: 'Save failed' });
    } finally {
      setSaving(null);
    }
  }

  async function removeSection() {
    if (!row || !sectionId || !confirm('Remove this block?')) return;
    setSaving('remove');
    setError('');

    try {
      await del(`sections?id=eq.${sectionId}`);
      clearSectionCaches();
      document.querySelector(`[data-sortable-id="sections.${sectionId}"]`)?.remove();
      showToast({ type: 'success', message: 'Block removed' });
      setOpen(false);
    } catch (removeError) {
      console.error('Remove failed:', removeError);
      setError('Remove failed');
      showToast({ type: 'error', message: 'Remove failed' });
    } finally {
      setSaving(null);
    }
  }

  async function saveHeroSettings() {
    if (!row || !sectionId || !heroDraft) return;
    setSaving('hero');
    setError('');

    const config = heroConfigFromDraft(row.config || {}, heroDraft);
    try {
      await patch(`sections?id=eq.${sectionId}`, { config });
      clearSectionCaches();
      setRow({ ...row, config });
      showToast({ type: 'success', message: 'Hero saved' });
      document.dispatchEvent(new CustomEvent('wl-content-rendered'));
    } catch (saveError) {
      console.error('Hero save failed:', saveError);
      setError('Hero save failed');
      showToast({ type: 'error', message: 'Hero save failed' });
    } finally {
      setSaving(null);
    }
  }

  function openSourceSettings() {
    if (!sectionId) return;
    setOpen(false);
    emitEditorBridgeEvent(SOURCE_SETTINGS_EVENT, sectionId);
  }

  async function addBlock(type: string) {
    const def = BLOCK_TYPES[type];
    if (!def || addSaving) return;
    setAddSaving(type);
    setAddError('');

    const currentSlugFromPath = currentPageSlugFromLocation(window.location.pathname, window.location.search);
    let pageSlug: string;
    let scope: 'page' | 'global';
    if (type === 'page_banner') {
      pageSlug = currentSlugFromPath;
      scope = 'page';
    } else if (addZone === 'header' || addZone === 'footer') {
      pageSlug = '*';
      scope = 'global';
    } else {
      pageSlug = currentSlugFromPath;
      scope = 'page';
    }

    const zoneEl = document.querySelector(`[data-zone="${addZone}"]`) as HTMLElement | null;
    const existingCount = zoneEl?.querySelectorAll('[data-sortable-id]').length || 0;

    try {
      await post('sections', {
        page_slug: pageSlug,
        zone: addZone,
        scope,
        section_type: type,
        config: cloneConfig(def.defaultConfig),
        position: existingCount + 1,
        visible: true,
      });
      clearSectionCaches();
      showToast({ type: 'success', message: 'Block added' });
      setAddOpen(false);
      document.dispatchEvent(new CustomEvent('wl-content-rendered'));
    } catch (addError) {
      console.error('Failed to add block:', addError);
      setAddError('Could not add block');
      showToast({ type: 'error', message: 'Could not add block' });
    } finally {
      setAddSaving(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 aria-hidden="true" className="h-4 w-4" />
              {row ? sectionDef?.label || row.section_type : 'Block settings'}
              {currentScope === 'global' ? <Badge>Global</Badge> : null}
            </DialogTitle>
            <DialogDescription>Adjust this block in the editor.</DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              Loading block
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {row ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="text-sm font-medium">Width</div>
                {spans.length <= 1 ? (
                  <div className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-muted/30 px-3 text-sm text-muted-foreground">
                    <Maximize2 aria-hidden="true" className="h-4 w-4" />
                    Fixed full width
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {spans.map((span) => {
                      const active = span === (row.column_span || '1');
                      return (
                        <Button
                          key={span}
                          type="button"
                          variant={active ? 'default' : 'outline'}
                          className={cn('justify-center', active && 'shadow')}
                          disabled={saving !== null}
                          onClick={() => void updateSpan(span)}
                        >
                          <Maximize2 aria-hidden="true" />
                          {span === '1' ? 'Full' : span === '1/2' ? 'Half' : span === '1/3' ? 'Third' : 'Two-thirds'}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Scope</div>
                <Button type="button" variant="secondary" disabled={saving !== null} onClick={() => void updateScope()}>
                  {saving === 'scope' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
                  {nextScope === 'global' ? 'Make global' : 'Make page-only'}
                </Button>
              </div>

            {canEditHero && heroDraft ? (
              <div className="space-y-4 rounded-md border border-border p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Image aria-hidden="true" className="h-4 w-4" />
                  Hero content
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="hero-heading" label="Heading">
                    <Input
                      id="hero-heading"
                      value={heroDraft.heading}
                      onChange={(event) => setHeroDraft({ ...heroDraft, heading: event.currentTarget.value })}
                    />
                  </Field>
                  <Field id="hero-subheading" label="Subheading">
                    <Input
                      id="hero-subheading"
                      value={heroDraft.subheading}
                      onChange={(event) => setHeroDraft({ ...heroDraft, subheading: event.currentTarget.value })}
                    />
                  </Field>
                  <Field id="hero-cta-text" label="Button text">
                    <Input
                      id="hero-cta-text"
                      value={heroDraft.cta_text}
                      onChange={(event) => setHeroDraft({ ...heroDraft, cta_text: event.currentTarget.value })}
                    />
                  </Field>
                  <Field id="hero-cta-href" label="Button link">
                    <Input
                      id="hero-cta-href"
                      value={heroDraft.cta_href}
                      onChange={(event) => setHeroDraft({ ...heroDraft, cta_href: event.currentTarget.value })}
                    />
                  </Field>
                  <Field id="hero-mode" label="Image mode">
                    <NativeSelect
                      id="hero-mode"
                      value={heroDraft.mode}
                      onChange={(event) =>
                        setHeroDraft({ ...heroDraft, mode: event.currentTarget.value as HeroMode })
                      }
                    >
                      <option value="background">Background image</option>
                      <option value="foreground">Foreground image</option>
                    </NativeSelect>
                  </Field>
                  {heroDraft.mode === 'background' ? (
                    <Field id="hero-bg-image" label="Background image URL">
                      <Input
                        id="hero-bg-image"
                        value={heroDraft.bg_image}
                        onChange={(event) => setHeroDraft({ ...heroDraft, bg_image: event.currentTarget.value })}
                      />
                    </Field>
                  ) : (
                    <>
                      <Field id="hero-image-url" label="Image URL">
                        <Input
                          id="hero-image-url"
                          value={heroDraft.image_url}
                          onChange={(event) => setHeroDraft({ ...heroDraft, image_url: event.currentTarget.value })}
                        />
                      </Field>
                      <Field id="hero-image-alt" label="Image alt text">
                        <Input
                          id="hero-image-alt"
                          value={heroDraft.image_alt}
                          onChange={(event) => setHeroDraft({ ...heroDraft, image_alt: event.currentTarget.value })}
                        />
                      </Field>
                      <Field id="hero-image-aspect" label="Aspect ratio">
                        <NativeSelect
                          id="hero-image-aspect"
                          value={heroDraft.image_aspect}
                          onChange={(event) =>
                            setHeroDraft({ ...heroDraft, image_aspect: event.currentTarget.value as HeroAspect })
                          }
                        >
                          <option value="auto">Auto</option>
                          <option value="16/9">16:9</option>
                          <option value="4/3">4:3</option>
                          <option value="21/9">21:9</option>
                        </NativeSelect>
                      </Field>
                      <Field id="hero-text-position" label="Heading position">
                        <NativeSelect
                          id="hero-text-position"
                          value={heroDraft.text_position}
                          onChange={(event) =>
                            setHeroDraft({
                              ...heroDraft,
                              text_position: event.currentTarget.value as HeroTextPosition,
                            })
                          }
                        >
                          <option value="over_image">Over the image</option>
                          <option value="below_image">Below the image</option>
                        </NativeSelect>
                      </Field>
                      <Field id="hero-logo-overlay" label="Logo overlay URL">
                        <Input
                          id="hero-logo-overlay"
                          value={heroDraft.logo_overlay_url}
                          onChange={(event) =>
                            setHeroDraft({ ...heroDraft, logo_overlay_url: event.currentTarget.value })
                          }
                        />
                      </Field>
                      <Field id="hero-caption" label="Caption HTML">
                        <Textarea
                          id="hero-caption"
                          rows={2}
                          value={heroDraft.caption_html}
                          onChange={(event) => setHeroDraft({ ...heroDraft, caption_html: event.currentTarget.value })}
                        />
                      </Field>
                    </>
                  )}
                </div>
                <Button type="button" disabled={saving !== null} onClick={() => void saveHeroSettings()}>
                  {saving === 'hero' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
                  Save hero
                </Button>
              </div>
            ) : null}

            {canEditSource ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={openSourceSettings}>
                  <Settings2 aria-hidden="true" />
                  Source settings
                </Button>
              </div>
            ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="button" variant="destructive" disabled={!row || saving !== null} onClick={() => void removeSection()}>
              {saving === 'remove' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Trash2 aria-hidden="true" />}
              Remove block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add block to {addZone}
            </DialogTitle>
            <DialogDescription>Choose a block type for this zone.</DialogDescription>
          </DialogHeader>

          {addError ? (
            <Alert variant="destructive">
              <AlertDescription>{addError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            {addCandidates.map(([type, def]) => (
              <Button
                key={type}
                type="button"
                variant="outline"
                className="h-auto justify-start gap-3 p-4 text-left"
                disabled={addSaving !== null}
                onClick={() => void addBlock(type)}
              >
                <span className="text-xl leading-none" aria-hidden="true">
                  {addSaving === type ? <Loader2 className="h-5 w-5 animate-spin" /> : def.icon}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{def.label}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{type}</span>
                </span>
              </Button>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function mountAdminEditorControls(element: HTMLElement): void {
  if (root) return;
  root = createRoot(element);
  root.render(<AdminEditorControls />);
}

export function openSectionEditControl(sectionId: number): void {
  window.dispatchEvent(new CustomEvent<SectionEditDetail>(SECTION_EDIT_EVENT, { detail: { sectionId } }));
}

export function openZoneAddControl(zone: Zone): void {
  window.dispatchEvent(new CustomEvent<ZoneAddDetail>(ZONE_ADD_EVENT, { detail: { zone } }));
}
