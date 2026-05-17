'use client';

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Image,
  Link as LinkIcon,
  Loader2,
  Maximize2,
  Plus,
  Save,
  Settings2,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/kychon/ui';
import {
  buildCopiedThemeEditorConfig,
  COPIED_THEME_EDITOR_TYPES,
  type CopiedThemeEditorType,
} from '@/lib/admin/copied-theme-editor';
import { chooseNavigationSection } from '@/lib/admin/navigation-section';
import { del, get, patch, post } from '@/lib/api';
import { BLOCK_TYPES, getSupportedSpans } from '@/lib/blocks';
import { PROVIDERS, type ParamSchemaEntry } from '@/lib/blocks/embed-providers';
import { currentPageSlugFromLocation } from '@/lib/clean-routes';
import { showToast } from '@/lib/toast-events';
import { cn } from '@/lib/ui/cn';

const SECTION_EDIT_EVENT = 'kychon:admin-editor-section-edit';
const ZONE_ADD_EVENT = 'kychon:admin-editor-zone-add';
const NAV_EDIT_EVENT = 'kychon:admin-editor-nav-edit';
const EMBED_EDIT_EVENT = 'kychon:admin-editor-embed-edit';
const CONTENT_RENDERED_EVENT = 'wl-content-rendered';
const SECTIONS_CHANGED_EVENT = 'wl-sections-changed';
const SELECT_EMPTY_VALUE = '__kychon_empty_value__';

type Zone = 'header' | 'main' | 'footer';

interface SectionRow {
  id: number;
  section_type: string;
  config?: Record<string, any>;
  page_slug?: string;
  position?: number;
  scope?: string;
  visible?: boolean;
  zone?: Zone;
  column_span?: string | null;
}

interface SectionEditDetail {
  sectionId: number;
}

interface ZoneAddDetail {
  zone: Zone;
}

interface NavEditDetail {
  sectionId: number;
}

interface EmbedEditDetail {
  sectionId: number;
}

type NavVisibility = 'public' | 'auth' | 'admin';
type EmbedParams = Record<string, unknown>;
type SourceFieldType = 'text' | 'number' | 'select' | 'textarea' | 'checkbox';
type SourceArrayKey = 'panels' | 'layers' | 'items';

interface SourceField {
  path: string;
  label: string;
  type?: SourceFieldType;
  placeholder?: string;
  step?: string;
  min?: string;
  max?: string;
  rows?: number;
  options?: Array<[string, string]>;
}

interface NavItem {
  label?: string;
  href?: string;
  icon?: string;
  public?: boolean;
  auth?: boolean;
  admin?: boolean;
  children?: NavItem[];
  [key: string]: any;
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

function encodeSelectItemValue(value: string): string {
  return value === '' ? SELECT_EMPTY_VALUE : value;
}

function encodeSelectValue(value: string, options: Array<[string, string]>): string {
  return value === '' && options.some(([optionValue]) => optionValue === '') ? SELECT_EMPTY_VALUE : value;
}

function decodeSelectItemValue(value: string): string {
  return value === SELECT_EMPTY_VALUE ? '' : value;
}

function EditorSelect({
  id,
  value,
  options,
  onValueChange,
  disabled,
  placeholder = 'Select an option',
}: {
  id: string;
  value: string;
  options: Array<[string, string]>;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Select
      value={encodeSelectValue(value, options)}
      disabled={disabled}
      onValueChange={(nextValue) => onValueChange(decodeSelectItemValue(nextValue))}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(([optionValue, optionLabel]) => (
          <SelectItem key={`${id}-${optionValue || 'empty'}`} value={encodeSelectItemValue(optionValue)}>
            {optionLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function clearSectionCaches() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith('wl_cache_sections_'))
    .forEach((key) => localStorage.removeItem(key));
}

function isZone(value: unknown): value is Zone {
  return value === 'header' || value === 'main' || value === 'footer';
}

function cloneConfig(config: Record<string, any>): Record<string, any> {
  if (typeof structuredClone === 'function') return structuredClone(config);
  return JSON.parse(JSON.stringify(config));
}

function emitSectionsChanged(): void {
  document.dispatchEvent(new CustomEvent(SECTIONS_CHANGED_EVENT));
  document.dispatchEvent(new CustomEvent(CONTENT_RENDERED_EVENT));
}

function sectionAppliesToCurrentPage(section: SectionRow, slug: string): boolean {
  return section.scope === 'global' || section.page_slug === '*' || section.page_slug === slug;
}

async function nextSectionPosition(zone: Zone, slug: string): Promise<number> {
  const rows = (await get('sections?visible=eq.true&order=zone.asc,position.asc')) as SectionRow[];
  return rows.filter((section) => section.zone === zone && section.visible !== false && sectionAppliesToCurrentPage(section, slug)).length + 1;
}

function currentPageSlugForNavEditor(): string {
  return currentPageSlugFromLocation(window.location.pathname, window.location.search);
}

async function findCurrentNavigationSection(preferredSectionId: number | null): Promise<SectionRow | null> {
  const slug = currentPageSlugForNavEditor();
  if (Number.isFinite(preferredSectionId)) {
    const preferredRows = (await get(`sections?id=eq.${encodeURIComponent(String(preferredSectionId))}`)) as SectionRow[];
    const preferred = chooseNavigationSection(preferredRows, preferredSectionId, slug);
    if (preferred) return preferred as SectionRow;
  }

  const rows = (await get('sections?visible=eq.true&order=zone.asc,position.asc')) as SectionRow[];
  return chooseNavigationSection(rows, null, slug) as SectionRow | null;
}

function cloneNavItems(items: unknown): NavItem[] {
  return Array.isArray(items) ? cloneConfig({ items }).items : [];
}

function defaultNavItem(): NavItem {
  return { label: 'New Link', href: '/', public: true };
}

function navVisibility(item: NavItem): NavVisibility {
  if (item.admin) return 'admin';
  if (item.auth) return 'auth';
  return 'public';
}

function withVisibility(item: NavItem, visibility: NavVisibility): NavItem {
  const next = { ...item };
  delete next.public;
  delete next.auth;
  delete next.admin;
  next[visibility] = true;
  return next;
}

function countNavDescendants(item: NavItem): number {
  const children = Array.isArray(item.children) ? item.children : [];
  return children.reduce((sum, child) => sum + 1 + countNavDescendants(child), 0);
}

function mapNavItemAtPath(items: NavItem[], path: number[], updater: (item: NavItem) => NavItem): NavItem[] {
  if (path.length === 0) return items;
  const [index, ...rest] = path;
  return items.map((item, itemIndex) => {
    if (itemIndex !== index) return item;
    if (rest.length === 0) return updater(item);
    const children = Array.isArray(item.children) ? item.children : [];
    return { ...item, children: mapNavItemAtPath(children, rest, updater) };
  });
}

function addNavChildAtPath(items: NavItem[], path: number[]): NavItem[] {
  return mapNavItemAtPath(items, path, (item) => ({
    ...item,
    children: [...(Array.isArray(item.children) ? item.children : []), defaultNavItem()],
  }));
}

function removeNavItemAtPath(items: NavItem[], path: number[]): NavItem[] {
  if (path.length === 0) return items;
  const [index, ...rest] = path;
  if (rest.length === 0) return items.filter((_, itemIndex) => itemIndex !== index);
  return items.map((item, itemIndex) => {
    if (itemIndex !== index) return item;
    const children = Array.isArray(item.children) ? item.children : [];
    return { ...item, children: removeNavItemAtPath(children, rest) };
  });
}

function moveNavItemAtPath(items: NavItem[], path: number[], direction: -1 | 1): NavItem[] {
  if (path.length === 0) return items;
  const [index, ...rest] = path;
  if (rest.length === 0) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return items;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    return next;
  }
  return items.map((item, itemIndex) => {
    if (itemIndex !== index) return item;
    const children = Array.isArray(item.children) ? item.children : [];
    return { ...item, children: moveNavItemAtPath(children, rest, direction) };
  });
}

function getNavSiblingsAtPath(items: NavItem[], path: number[]): NavItem[] {
  if (path.length <= 1) return items;
  let siblings = items;
  for (const index of path.slice(0, -1)) {
    const item = siblings[index];
    siblings = Array.isArray(item?.children) ? item.children : [];
  }
  return siblings;
}

function cloneEmbedParams(params: unknown): EmbedParams {
  return params && typeof params === 'object' && !Array.isArray(params)
    ? cloneConfig(params as Record<string, any>)
    : {};
}

function trustHostFor(srcVal: string): string {
  try {
    return new URL(srcVal).host;
  } catch {
    return '';
  }
}

function extractVideoId(provider: string, raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (provider === 'youtube') {
    const patterns = [
      /youtube\.com\/watch\?v=([\w-]{6,})/,
      /youtu\.be\/([\w-]{6,})/,
      /youtube\.com\/embed\/([\w-]{6,})/,
      /youtube\.com\/shorts\/([\w-]{6,})/,
    ];
    for (const re of patterns) {
      const match = trimmed.match(re);
      if (match) return match[1];
    }
    if (/^[\w-]{6,}$/.test(trimmed)) return trimmed;
  }
  if (provider === 'vimeo') {
    const match = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (match) return match[1];
    if (/^\d+$/.test(trimmed)) return trimmed;
  }
  return null;
}

function isMissingRequiredParam(value: unknown): boolean {
  return value == null || value === '';
}

function sourceTypeLabel(type: CopiedThemeEditorType | null): string {
  if (type === 'image_accordion') return 'Image accordion';
  if (type === 'shape_divider') return 'Shape divider';
  if (type === 'slideshow') return 'Slideshow';
  if (type === 'nav') return 'Navigation';
  return 'Block';
}

function getValueAtPath(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, part) => {
    if (current == null) return undefined;
    const key = /^\d+$/.test(part) ? Number(part) : part;
    return current[key];
  }, obj as any);
}

function setValueAtPath(obj: Record<string, any>, path: string, value: any): Record<string, any> {
  const next = cloneConfig(obj);
  const parts = path.split('.');
  let current: any = next;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = /^\d+$/.test(parts[index]) ? Number(parts[index]) : parts[index];
    const nextKey = parts[index + 1];
    if (current[key] == null || typeof current[key] !== 'object') {
      current[key] = /^\d+$/.test(nextKey) ? [] : {};
    }
    current = current[key];
  }
  const last = parts[parts.length - 1];
  current[/^\d+$/.test(last) ? Number(last) : last] = value;
  return next;
}

function normalizeSourceDraft(type: CopiedThemeEditorType, config: Record<string, any>): Record<string, any> {
  const draft = cloneConfig(config);
  if (type === 'image_accordion') draft.panels = Array.isArray(draft.panels) ? draft.panels : [];
  if (type === 'shape_divider') draft.layers = Array.isArray(draft.layers) ? draft.layers : [];
  if (type === 'slideshow') draft.items = Array.isArray(draft.items) ? draft.items : [];
  return draft;
}

function defaultSourceItem(key: SourceArrayKey): Record<string, any> {
  if (key === 'panels') {
    return {
      image_url: '',
      image_alt: '',
      title: 'New panel',
      description: '',
      cta_label: '',
      href: '',
      fit: 'cover',
      object_position: 'center',
    };
  }
  if (key === 'layers') {
    return { fill: 'var(--shape-bottom-color)', opacity: 1, translate_y: 0 };
  }
  return { src: '', alt: 'New slide', caption: '', href: '', fit: '', object_position: 'center' };
}

function mutateSourceArray(
  draft: Record<string, any>,
  key: SourceArrayKey,
  mutator: (items: Record<string, any>[]) => void,
): Record<string, any> {
  const next = cloneConfig(draft);
  const items = Array.isArray(next[key]) ? [...next[key]] : [];
  mutator(items);
  next[key] = items;
  return next;
}

function moveSourceArrayItem(
  draft: Record<string, any>,
  key: SourceArrayKey,
  index: number,
  direction: -1 | 1,
): Record<string, any> {
  return mutateSourceArray(draft, key, (items) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const [moved] = items.splice(index, 1);
    items.splice(target, 0, moved);
  });
}

const IMAGE_ACCORDION_FIELDS: SourceField[] = [
  { path: 'heading', label: 'Heading' },
  { path: 'active_ratio', label: 'Active ratio', type: 'number', step: '0.1', min: '0.1' },
  { path: 'idle_ratio', label: 'Idle ratio', type: 'number', step: '0.1', min: '0.1' },
  { path: 'overlay_color', label: 'Overlay color' },
  { path: 'overlay_opacity', label: 'Overlay opacity', type: 'number', step: '0.05', min: '0', max: '1' },
  { path: 'reveal_duration', label: 'Reveal duration', placeholder: '260ms' },
  { path: 'mobile_fallback', label: 'Mobile fallback', type: 'select', options: [['stack', 'Stack'], ['cards', 'Cards']] },
];

const SHAPE_DIVIDER_FIELDS: SourceField[] = [
  { path: 'preset', label: 'Preset', type: 'select', options: [['wave', 'Wave'], ['tilt', 'Tilt'], ['curve', 'Curve']] },
  { path: 'height', label: 'Height', placeholder: '96px' },
  { path: 'view_box', label: 'View box', placeholder: '0 0 1440 120' },
  { path: 'top_color', label: 'Top color' },
  { path: 'bottom_color', label: 'Bottom color' },
  {
    path: 'placement',
    label: 'Placement',
    type: 'select',
    options: [['between', 'Between sections'], ['top', 'Top'], ['bottom', 'Bottom']],
  },
  { path: 'flip_x', label: 'Flip horizontally', type: 'checkbox' },
  { path: 'flip_y', label: 'Flip vertically', type: 'checkbox' },
  { path: 'path', label: 'Imported SVG path', type: 'textarea', rows: 3 },
];

const SLIDESHOW_FIELDS: SourceField[] = [
  { path: 'heading', label: 'Heading' },
  { path: 'height', label: 'Desktop height', placeholder: '420px' },
  { path: 'mobile_height', label: 'Mobile height', placeholder: '260px' },
  {
    path: 'aspect_ratio',
    label: 'Aspect ratio',
    type: 'select',
    options: [['16/9', '16:9'], ['4/3', '4:3'], ['1/1', '1:1'], ['21/9', '21:9']],
  },
  { path: 'fit', label: 'Default fit', type: 'select', options: [['cover', 'Cover'], ['contain', 'Contain']] },
  { path: 'transition', label: 'Transition', type: 'select', options: [['fade', 'Fade'], ['slide', 'Slide']] },
  { path: 'auto_rotate_seconds', label: 'Autoplay seconds', type: 'number', step: '0.5', min: '0' },
  { path: 'transition_ms', label: 'Transition ms', type: 'number', step: '50', min: '0' },
  { path: 'transition_easing', label: 'Transition easing', placeholder: 'ease-in-out' },
  { path: 'show_arrows', label: 'Show arrows', type: 'checkbox' },
  { path: 'show_dots', label: 'Show dots', type: 'checkbox' },
  { path: 'pause_on_hover', label: 'Pause on hover', type: 'checkbox' },
  { path: 'pause_on_focus', label: 'Pause on focus', type: 'checkbox' },
  { path: 'manual_pause', label: 'Manual interaction pauses autoplay', type: 'checkbox' },
];

const SLIDESHOW_STYLE_FIELDS: SourceField[] = [
  { path: 'arrow_style.background', label: 'Arrow background' },
  { path: 'arrow_style.text', label: 'Arrow text' },
  { path: 'arrow_style.hover.background', label: 'Arrow hover background' },
  { path: 'arrow_style.hover.text', label: 'Arrow hover text' },
  { path: 'dot_style.background', label: 'Dot background' },
  { path: 'dot_style.active_background', label: 'Active dot background' },
];

const NAV_BEHAVIOR_FIELDS: SourceField[] = [
  {
    path: 'behavior.desktop_open',
    label: 'Desktop open',
    type: 'select',
    options: [['', 'Default'], ['hover', 'Hover'], ['click', 'Click'], ['focus', 'Focus']],
  },
  { path: 'behavior.mobile_breakpoint', label: 'Mobile breakpoint', type: 'number', step: '1', min: '1', placeholder: '768' },
  {
    path: 'behavior.mobile_closed_layout',
    label: 'Mobile closed layout',
    type: 'select',
    options: [['', 'Default'], ['hidden', 'Hidden'], ['overlay', 'Overlay']],
  },
  {
    path: 'behavior.mobile_open_layout',
    label: 'Mobile open layout',
    type: 'select',
    options: [['', 'Default'], ['dropdown', 'Dropdown'], ['drawer', 'Drawer'], ['inline', 'Inline']],
  },
];

const NAV_PRESENTATION_FIELDS: SourceField[] = [
  { path: 'presentation.link_color', label: 'Link color' },
  { path: 'presentation.link_hover_bg', label: 'Link hover background' },
  { path: 'presentation.link_hover_color', label: 'Link hover color' },
  { path: 'presentation.link_active_bg', label: 'Link active background' },
  { path: 'presentation.link_active_color', label: 'Link active color' },
  { path: 'presentation.link_padding', label: 'Link padding' },
  { path: 'presentation.link_gap', label: 'Link gap' },
  { path: 'presentation.font_family', label: 'Font family' },
  { path: 'presentation.font_size', label: 'Font size' },
  { path: 'presentation.font_weight', label: 'Font weight' },
  { path: 'presentation.dropdown_bg', label: 'Dropdown background' },
  { path: 'presentation.dropdown_color', label: 'Dropdown color' },
  { path: 'presentation.dropdown_hover_bg', label: 'Dropdown hover background' },
  { path: 'presentation.dropdown_hover_color', label: 'Dropdown hover color' },
  { path: 'presentation.dropdown_border', label: 'Dropdown border' },
  { path: 'presentation.dropdown_shadow', label: 'Dropdown shadow' },
  { path: 'presentation.dropdown_width', label: 'Dropdown width' },
  { path: 'presentation.dropdown_offset_x', label: 'Dropdown offset X' },
  { path: 'presentation.dropdown_offset_y', label: 'Dropdown offset Y' },
  { path: 'presentation.chevron_color', label: 'Chevron color' },
  { path: 'presentation.transition', label: 'Transition' },
  { path: 'presentation.mobile_menu_bg', label: 'Mobile menu background' },
  { path: 'presentation.mobile_menu_padding', label: 'Mobile menu padding' },
];

const NAV_INTERACTION_FIELDS: SourceField[] = [
  { path: 'interactions.hover.background', label: 'Hover background' },
  { path: 'interactions.hover.text', label: 'Hover text' },
  { path: 'interactions.hover.icon', label: 'Hover icon' },
  { path: 'interactions.focus.border', label: 'Focus border' },
  { path: 'interactions.focus.text', label: 'Focus text' },
];

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
  const [navOpen, setNavOpen] = useState(false);
  const [navSectionId, setNavSectionId] = useState<number | null>(null);
  const [navConfig, setNavConfig] = useState<Record<string, any>>({});
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [navLoading, setNavLoading] = useState(false);
  const [navSaving, setNavSaving] = useState(false);
  const [navError, setNavError] = useState('');
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedSectionId, setEmbedSectionId] = useState<number | null>(null);
  const [embedConfig, setEmbedConfig] = useState<Record<string, any>>({});
  const [embedProviderId, setEmbedProviderId] = useState('youtube');
  const [embedParams, setEmbedParams] = useState<EmbedParams>({});
  const [embedHeading, setEmbedHeading] = useState('');
  const [embedUrlHelper, setEmbedUrlHelper] = useState('');
  const [embedTrustAck, setEmbedTrustAck] = useState(false);
  const [embedLoading, setEmbedLoading] = useState(false);
  const [embedSaving, setEmbedSaving] = useState(false);
  const [embedError, setEmbedError] = useState('');
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceSectionId, setSourceSectionId] = useState<number | null>(null);
  const [sourceType, setSourceType] = useState<CopiedThemeEditorType | null>(null);
  const [sourceConfig, setSourceConfig] = useState<Record<string, any>>({});
  const [sourceDraft, setSourceDraft] = useState<Record<string, any>>({});
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceSaving, setSourceSaving] = useState(false);
  const [sourceError, setSourceError] = useState('');

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
  const embedProvider = PROVIDERS[embedProviderId];
  const embedTrustedHost = useMemo(
    () => (embedProviderId === 'iframe' ? trustHostFor(String(embedParams.src || '')) : ''),
    [embedParams, embedProviderId],
  );
  const embedParamEntries = useMemo(
    () => (embedProvider ? Object.entries(embedProvider.paramsSchema) : []),
    [embedProvider],
  );
  const embedCanSave = useMemo(() => {
    if (!embedProvider) return false;
    for (const [key, schema] of Object.entries(embedProvider.paramsSchema)) {
      if (schema.required && isMissingRequiredParam(embedParams[key])) return false;
    }
    if (embedProviderId === 'iframe' && (!embedTrustedHost || !embedTrustAck)) return false;
    return true;
  }, [embedParams, embedProvider, embedProviderId, embedTrustAck, embedTrustedHost]);

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

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<NavEditDetail>).detail;
      if (Number.isFinite(detail?.sectionId)) void openNavEditor(detail.sectionId);
    };
    window.addEventListener(NAV_EDIT_EVENT, listener);
    return () => window.removeEventListener(NAV_EDIT_EVENT, listener);
  }, []);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<EmbedEditDetail>).detail;
      if (Number.isFinite(detail?.sectionId)) void openEmbedEditor(detail.sectionId);
    };
    window.addEventListener(EMBED_EDIT_EVENT, listener);
    return () => window.removeEventListener(EMBED_EDIT_EVENT, listener);
  }, []);

  async function openNavEditor(nextSectionId: number) {
    setNavOpen(true);
    setNavSectionId(null);
    setNavConfig({});
    setNavItems([]);
    setNavError('');
    setNavLoading(true);
    try {
      const nextRow = await findCurrentNavigationSection(nextSectionId);
      if (!nextRow) {
        setNavError('Navigation block not found');
        return;
      }
      setNavSectionId(nextRow.id);
      const config = nextRow.config || {};
      setNavConfig(config);
      setNavItems(cloneNavItems(config.items));
    } catch (loadError) {
      console.error('Failed to load navigation block:', loadError);
      setNavError('Could not load navigation');
      showToast({ type: 'error', message: 'Could not load navigation' });
    } finally {
      setNavLoading(false);
    }
  }

  async function updateSpan(span: string) {
    if (!row || !sectionId || span === row.column_span) return;
    setSaving('span');
    setError('');

    try {
      await patch(`sections?id=eq.${sectionId}`, { column_span: span });
      clearSectionCaches();
      setRow({ ...row, column_span: span });
      showToast({ type: 'success', message: 'Width saved' });
      emitSectionsChanged();
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
      setRow({ ...row, scope: nextScope });
      showToast({
        type: 'success',
        message: nextScope === 'global' ? 'Saved - appears on all pages' : 'Saved - appears on this page only',
      });
      emitSectionsChanged();
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
      showToast({ type: 'success', message: 'Block removed' });
      setOpen(false);
      emitSectionsChanged();
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
      emitSectionsChanged();
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
    void openSourceEditor(sectionId);
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

    try {
      const position = await nextSectionPosition(addZone, currentSlugFromPath);
      await post('sections', {
        page_slug: pageSlug,
        zone: addZone,
        scope,
        section_type: type,
        config: cloneConfig(def.defaultConfig),
        position,
        visible: true,
      });
      clearSectionCaches();
      showToast({ type: 'success', message: 'Block added' });
      setAddOpen(false);
      emitSectionsChanged();
    } catch (addError) {
      console.error('Failed to add block:', addError);
      setAddError('Could not add block');
      showToast({ type: 'error', message: 'Could not add block' });
    } finally {
      setAddSaving(null);
    }
  }

  function updateNavItem(path: number[], updater: (item: NavItem) => NavItem) {
    setNavItems((items) => mapNavItemAtPath(items, path, updater));
  }

  function removeNavItem(path: number[]) {
    const siblings = getNavSiblingsAtPath(navItems, path);
    const item = siblings[path[path.length - 1]];
    if (!item) return;
    const descendants = countNavDescendants(item);
    if (descendants > 0) {
      const word = descendants === 1 ? 'child item' : 'child items';
      if (!confirm(`Remove this item and ${descendants} ${word}?`)) return;
    }
    setNavItems((items) => removeNavItemAtPath(items, path));
  }

  function renderNavItemEditor(item: NavItem, path: number[], depth: number) {
    const key = path.join('.');
    const siblings = getNavSiblingsAtPath(navItems, path);
    const index = path[path.length - 1];
    const children = Array.isArray(item.children) ? item.children : [];

    return (
      <div key={key} className={cn('space-y-3 rounded-md border border-border p-3', depth > 0 && 'ml-5 bg-muted/20')}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_9rem_auto]">
          <Field id={`nav-label-${key}`} label="Label">
            <Input
              id={`nav-label-${key}`}
              value={item.label || ''}
              onChange={(event) => updateNavItem(path, (current) => ({ ...current, label: event.currentTarget.value }))}
            />
          </Field>
          <Field id={`nav-href-${key}`} label="Link">
            <Input
              id={`nav-href-${key}`}
              value={item.href || ''}
              placeholder="/about"
              onChange={(event) => updateNavItem(path, (current) => ({ ...current, href: event.currentTarget.value }))}
            />
          </Field>
          <Field id={`nav-visibility-${key}`} label="Visibility">
            <EditorSelect
              id={`nav-visibility-${key}`}
              value={navVisibility(item)}
              options={[
                ['public', 'Public'],
                ['auth', 'Members'],
                ['admin', 'Admin'],
              ]}
              onValueChange={(value) => updateNavItem(path, (current) => withVisibility(current, value as NavVisibility))}
            />
          </Field>
          <div className="flex items-end gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Move up"
              title="Move up"
              disabled={index <= 0}
              onClick={() => setNavItems((items) => moveNavItemAtPath(items, path, -1))}
            >
              <ChevronUp aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Move down"
              title="Move down"
              disabled={index >= siblings.length - 1}
              onClick={() => setNavItems((items) => moveNavItemAtPath(items, path, 1))}
            >
              <ChevronDown aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              aria-label="Remove navigation item"
              title="Remove"
              onClick={() => removeNavItem(path)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={depth >= 2}
            onClick={() => setNavItems((items) => addNavChildAtPath(items, path))}
          >
            <Plus aria-hidden="true" />
            Add child
          </Button>
          {depth >= 2 ? <span className="self-center text-xs text-muted-foreground">Maximum nesting reached</span> : null}
        </div>

        {children.length > 0 ? (
          <div className="space-y-3">
            {children.map((child, childIndex) => renderNavItemEditor(child, [...path, childIndex], depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  async function saveNavigation() {
    if (!navSectionId || navSaving) return;
    setNavSaving(true);
    setNavError('');
    try {
      const nextRow = await findCurrentNavigationSection(navSectionId);
      if (!nextRow) {
        setNavSectionId(null);
        setNavError('Navigation block not found');
        return;
      }
      const current = nextRow.config || navConfig;
      const config = { ...current, items: cloneConfig({ items: navItems }).items };
      await patch(`sections?id=eq.${nextRow.id}`, { config });
      clearSectionCaches();
      setNavSectionId(nextRow.id);
      setNavConfig(config);
      showToast({ type: 'success', message: 'Navigation saved' });
      setNavOpen(false);
      emitSectionsChanged();
    } catch (saveError) {
      console.error('Nav save failed:', saveError);
      setNavError('Could not save navigation');
      showToast({ type: 'error', message: 'Could not save navigation' });
    } finally {
      setNavSaving(false);
    }
  }

  function openNavSourceSettings() {
    if (!navSectionId) return;
    setNavOpen(false);
    void openSourceEditor(navSectionId);
  }

  async function openEmbedEditor(nextSectionId: number) {
    setEmbedOpen(true);
    setEmbedSectionId(nextSectionId);
    setEmbedConfig({});
    setEmbedProviderId('youtube');
    setEmbedParams({});
    setEmbedHeading('');
    setEmbedUrlHelper('');
    setEmbedTrustAck(false);
    setEmbedError('');
    setEmbedLoading(true);
    try {
      const rows = await get(`sections?id=eq.${nextSectionId}`);
      const nextRow = rows[0] as SectionRow | undefined;
      if (!nextRow) {
        setEmbedError('Embed block not found');
        return;
      }
      const config = nextRow.config || {};
      setEmbedConfig(config);
      setEmbedProviderId(typeof config.provider === 'string' && PROVIDERS[config.provider] ? config.provider : 'youtube');
      setEmbedParams(cloneEmbedParams(config.params));
      setEmbedHeading(textValue(config.heading));
      setEmbedTrustAck(config.trust_acknowledged === true);
    } catch (loadError) {
      console.error('Failed to load embed block:', loadError);
      setEmbedError('Could not load embed');
      showToast({ type: 'error', message: 'Could not load embed' });
    } finally {
      setEmbedLoading(false);
    }
  }

  function selectEmbedProvider(nextProviderId: string) {
    setEmbedProviderId(nextProviderId);
    setEmbedParams({});
    setEmbedUrlHelper('');
    setEmbedTrustAck(false);
  }

  function updateEmbedParam(key: string, schema: ParamSchemaEntry, rawValue: string) {
    const value = schema.type === 'number' ? (rawValue === '' ? undefined : Number(rawValue)) : rawValue;
    if (embedProviderId === 'iframe' && key === 'src') setEmbedTrustAck(false);
    setEmbedParams((current) => ({ ...current, [key]: value }));
  }

  function extractEmbedVideoId() {
    const videoId = extractVideoId(embedProviderId, embedUrlHelper);
    if (!videoId) {
      showToast({ type: 'error', message: 'Could not extract video ID from that URL' });
      return;
    }
    setEmbedParams((current) => ({ ...current, video_id: videoId }));
    showToast({ type: 'success', message: 'Video ID extracted' });
  }

  function renderEmbedParamField(key: string, schema: ParamSchemaEntry) {
    const id = `embed-param-${key}`;
    const value = embedParams[key] == null ? '' : String(embedParams[key]);
    return (
      <div key={key} className="space-y-1.5">
        <Label htmlFor={id}>
          {schema.label || key}
          {schema.required ? <span className="text-destructive"> *</span> : null}
        </Label>
        {schema.type === 'select' && schema.options ? (
          <EditorSelect
            id={id}
            value={value}
            options={[
              ['', 'Default'],
              ...schema.options.map((option) => [option, option] as [string, string]),
            ]}
            onValueChange={(nextValue) => updateEmbedParam(key, schema, nextValue)}
          />
        ) : (
          <Input
            id={id}
            type={schema.type === 'number' ? 'number' : 'text'}
            value={value}
            placeholder={schema.placeholder || ''}
            required={schema.required}
            onChange={(event) => updateEmbedParam(key, schema, event.currentTarget.value)}
          />
        )}
        {schema.help ? <p className="text-xs text-muted-foreground">{schema.help}</p> : null}
      </div>
    );
  }

  async function saveEmbed() {
    if (!embedSectionId || !embedProvider || embedSaving) return;
    setEmbedSaving(true);
    setEmbedError('');
    try {
      embedProvider.buildSrc(embedParams);
    } catch (validationError) {
      const message = validationError instanceof Error ? validationError.message : 'Invalid embed settings';
      setEmbedError(message);
      showToast({ type: 'error', message });
      setEmbedSaving(false);
      return;
    }

    try {
      const rows = await get(`sections?id=eq.${embedSectionId}`);
      const current = rows[0]?.config || embedConfig;
      const config: Record<string, any> = {
        ...current,
        provider: embedProviderId,
        params: cloneConfig(embedParams as Record<string, any>),
        heading: embedHeading,
      };
      if (embedProviderId === 'iframe') {
        config.trust_acknowledged = embedTrustAck;
      } else {
        delete config.trust_acknowledged;
      }
      await patch(`sections?id=eq.${embedSectionId}`, { config });
      clearSectionCaches();
      setEmbedConfig(config);
      showToast({ type: 'success', message: 'Embed saved' });
      setEmbedOpen(false);
      emitSectionsChanged();
    } catch (saveError) {
      console.error('Embed save failed:', saveError);
      setEmbedError('Could not save embed');
      showToast({ type: 'error', message: 'Could not save embed' });
    } finally {
      setEmbedSaving(false);
    }
  }

  async function openSourceEditor(nextSectionId: number) {
    setSourceOpen(true);
    setSourceSectionId(nextSectionId);
    setSourceType(null);
    setSourceConfig({});
    setSourceDraft({});
    setSourceError('');
    setSourceLoading(true);
    try {
      const rows = await get(`sections?id=eq.${nextSectionId}`);
      const nextRow = rows[0] as SectionRow | undefined;
      const nextType = nextRow?.section_type as CopiedThemeEditorType | undefined;
      if (!nextRow || !nextType || !COPIED_THEME_EDITOR_TYPES.has(nextType)) {
        setSourceError('No source settings for this block');
        return;
      }
      const config = nextRow.config || {};
      setSourceType(nextType);
      setSourceConfig(config);
      setSourceDraft(normalizeSourceDraft(nextType, config));
    } catch (loadError) {
      console.error('Failed to load source settings:', loadError);
      setSourceError('Could not load source settings');
      showToast({ type: 'error', message: 'Could not load source settings' });
    } finally {
      setSourceLoading(false);
    }
  }

  function updateSourceField(field: SourceField, rawValue: string | boolean) {
    const value = field.type === 'number' ? (rawValue === '' ? undefined : Number(rawValue)) : rawValue;
    setSourceDraft((draft) => setValueAtPath(draft, field.path, value));
  }

  function addSourceArrayItem(key: SourceArrayKey) {
    setSourceDraft((draft) => mutateSourceArray(draft, key, (items) => items.push(defaultSourceItem(key))));
  }

  function removeSourceArrayItem(key: SourceArrayKey, index: number) {
    setSourceDraft((draft) => mutateSourceArray(draft, key, (items) => items.splice(index, 1)));
  }

  function moveSourceItem(key: SourceArrayKey, index: number, direction: -1 | 1) {
    setSourceDraft((draft) => moveSourceArrayItem(draft, key, index, direction));
  }

  function renderSourceField(field: SourceField) {
    const id = `source-${field.path.replace(/[^a-z0-9_-]+/gi, '-')}`;
    const value = getValueAtPath(sourceDraft, field.path);
    if (field.type === 'checkbox') {
      return (
        <div
          key={field.path}
          className="flex min-h-9 items-center gap-2 rounded-md border border-transparent px-2 text-sm hover:bg-muted/50"
        >
          <Checkbox
            id={id}
            checked={value === true}
            onCheckedChange={(checked) => updateSourceField(field, checked === true)}
          />
          <Label htmlFor={id} className="leading-5">
            {field.label}
          </Label>
        </div>
      );
    }
    if (field.type === 'textarea') {
      return (
        <Field key={field.path} id={id} label={field.label}>
          <Textarea
            id={id}
            rows={field.rows || 3}
            value={value == null ? '' : String(value)}
            placeholder={field.placeholder || ''}
            onChange={(event) => updateSourceField(field, event.currentTarget.value)}
          />
        </Field>
      );
    }
    if (field.type === 'select' && field.options) {
      return (
        <Field key={field.path} id={id} label={field.label}>
          <EditorSelect
            id={id}
            value={value == null ? '' : String(value)}
            options={field.options}
            onValueChange={(nextValue) => updateSourceField(field, nextValue)}
          />
        </Field>
      );
    }
    return (
      <Field key={field.path} id={id} label={field.label}>
        <Input
          id={id}
          type={field.type === 'number' ? 'number' : 'text'}
          value={value == null ? '' : String(value)}
          placeholder={field.placeholder || ''}
          step={field.step}
          min={field.min}
          max={field.max}
          onChange={(event) => updateSourceField(field, event.currentTarget.value)}
        />
      </Field>
    );
  }

  function renderSourceFieldGrid(fields: SourceField[]) {
    return <div className="grid gap-3 sm:grid-cols-2">{fields.map((field) => renderSourceField(field))}</div>;
  }

  function renderSourceGroup(title: string, children: React.ReactNode) {
    return (
      <section className="space-y-3 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium">{title}</h3>
        {children}
      </section>
    );
  }

  function renderArrayHeader(title: string, key: SourceArrayKey, index: number, length: number) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{title}</h4>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Move ${title.toLowerCase()} up`}
            title="Move up"
            disabled={index <= 0}
            onClick={() => moveSourceItem(key, index, -1)}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Move ${title.toLowerCase()} down`}
            title="Move down"
            disabled={index >= length - 1}
            onClick={() => moveSourceItem(key, index, 1)}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            aria-label={`Remove ${title.toLowerCase()}`}
            title="Remove"
            onClick={() => removeSourceArrayItem(key, index)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  }

  function renderImageAccordionSource() {
    const panels = Array.isArray(sourceDraft.panels) ? sourceDraft.panels : [];
    return (
      <div className="space-y-4">
        {renderSourceGroup('Accordion settings', renderSourceFieldGrid(IMAGE_ACCORDION_FIELDS))}
        {renderSourceGroup(
          'Panels',
          <div className="space-y-3">
            {panels.map((_panel, index) => (
              <div key={index} className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                {renderArrayHeader(`Panel ${index + 1}`, 'panels', index, panels.length)}
                {renderSourceFieldGrid([
                  { path: `panels.${index}.title`, label: 'Title' },
                  { path: `panels.${index}.cta_label`, label: 'CTA label' },
                  { path: `panels.${index}.href`, label: 'Link href', placeholder: '/about' },
                  { path: `panels.${index}.image_url`, label: 'Image URL' },
                  { path: `panels.${index}.image_alt`, label: 'Image alt' },
                  { path: `panels.${index}.object_position`, label: 'Object position', placeholder: '50% 50%' },
                  {
                    path: `panels.${index}.fit`,
                    label: 'Image fit',
                    type: 'select',
                    options: [['', 'Default'], ['cover', 'Cover'], ['contain', 'Contain']],
                  },
                  { path: `panels.${index}.description`, label: 'Description', type: 'textarea', rows: 2 },
                ])}
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => addSourceArrayItem('panels')}>
              <Plus aria-hidden="true" />
              Add panel
            </Button>
          </div>,
        )}
      </div>
    );
  }

  function renderShapeDividerSource() {
    const layers = Array.isArray(sourceDraft.layers) ? sourceDraft.layers : [];
    return (
      <div className="space-y-4">
        {renderSourceGroup('Shape', renderSourceFieldGrid(SHAPE_DIVIDER_FIELDS))}
        {renderSourceGroup(
          'Fill layers',
          <div className="space-y-3">
            {layers.map((_layer, index) => (
              <div key={index} className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                {renderArrayHeader(`Layer ${index + 1}`, 'layers', index, layers.length)}
                {renderSourceFieldGrid([
                  { path: `layers.${index}.fill`, label: 'Fill' },
                  { path: `layers.${index}.opacity`, label: 'Opacity', type: 'number', step: '0.05', min: '0', max: '1' },
                  { path: `layers.${index}.translate_y`, label: 'Translate Y', type: 'number', step: '1' },
                  { path: `layers.${index}.path`, label: 'Layer path override', type: 'textarea', rows: 2 },
                ])}
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => addSourceArrayItem('layers')}>
              <Plus aria-hidden="true" />
              Add layer
            </Button>
          </div>,
        )}
      </div>
    );
  }

  function renderSlideshowSource() {
    const slides = Array.isArray(sourceDraft.items) ? sourceDraft.items : [];
    return (
      <div className="space-y-4">
        {renderSourceGroup('Carousel settings', renderSourceFieldGrid(SLIDESHOW_FIELDS))}
        {renderSourceGroup('Control styling', renderSourceFieldGrid(SLIDESHOW_STYLE_FIELDS))}
        {renderSourceGroup(
          'Slides',
          <div className="space-y-3">
            {slides.map((_slide, index) => (
              <div key={index} className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                {renderArrayHeader(`Slide ${index + 1}`, 'items', index, slides.length)}
                {renderSourceFieldGrid([
                  { path: `items.${index}.src`, label: 'Image URL' },
                  { path: `items.${index}.alt`, label: 'Alt text' },
                  { path: `items.${index}.href`, label: 'Link href' },
                  { path: `items.${index}.object_position`, label: 'Object position', placeholder: '50% 50%' },
                  {
                    path: `items.${index}.fit`,
                    label: 'Image fit',
                    type: 'select',
                    options: [['', 'Default'], ['cover', 'Cover'], ['contain', 'Contain']],
                  },
                  { path: `items.${index}.caption`, label: 'Caption', type: 'textarea', rows: 2 },
                ])}
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => addSourceArrayItem('items')}>
              <Plus aria-hidden="true" />
              Add slide
            </Button>
          </div>,
        )}
      </div>
    );
  }

  function renderNavSource() {
    return (
      <div className="space-y-4">
        {renderSourceGroup('Behavior', renderSourceFieldGrid(NAV_BEHAVIOR_FIELDS))}
        {renderSourceGroup('Links and dropdowns', renderSourceFieldGrid(NAV_PRESENTATION_FIELDS))}
        {renderSourceGroup('Interaction fallback', renderSourceFieldGrid(NAV_INTERACTION_FIELDS))}
      </div>
    );
  }

  function renderSourceBody() {
    if (!sourceType || sourceLoading) return null;
    if (sourceType === 'image_accordion') return renderImageAccordionSource();
    if (sourceType === 'shape_divider') return renderShapeDividerSource();
    if (sourceType === 'slideshow') return renderSlideshowSource();
    return renderNavSource();
  }

  async function saveSourceSettings() {
    if (!sourceSectionId || !sourceType || sourceSaving) return;
    setSourceSaving(true);
    setSourceError('');
    const config = buildCopiedThemeEditorConfig(sourceType, sourceConfig, sourceDraft);
    try {
      await patch(`sections?id=eq.${sourceSectionId}`, { config });
      clearSectionCaches();
      setSourceConfig(config);
      setSourceDraft(normalizeSourceDraft(sourceType, config));
      showToast({ type: 'success', message: 'Source settings saved' });
      setSourceOpen(false);
      emitSectionsChanged();
    } catch (saveError) {
      console.error('Source settings save failed:', saveError);
      setSourceError('Could not save source settings');
      showToast({ type: 'error', message: 'Could not save source settings' });
    } finally {
      setSourceSaving(false);
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
                    <EditorSelect
                      id="hero-mode"
                      value={heroDraft.mode}
                      options={[
                        ['background', 'Background image'],
                        ['foreground', 'Foreground image'],
                      ]}
                      onValueChange={(value) => setHeroDraft({ ...heroDraft, mode: value as HeroMode })}
                    />
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
                        <EditorSelect
                          id="hero-image-aspect"
                          value={heroDraft.image_aspect}
                          options={[
                            ['auto', 'Auto'],
                            ['16/9', '16:9'],
                            ['4/3', '4:3'],
                            ['21/9', '21:9'],
                          ]}
                          onValueChange={(value) => setHeroDraft({ ...heroDraft, image_aspect: value as HeroAspect })}
                        />
                      </Field>
                      <Field id="hero-text-position" label="Heading position">
                        <EditorSelect
                          id="hero-text-position"
                          value={heroDraft.text_position}
                          options={[
                            ['over_image', 'Over the image'],
                            ['below_image', 'Below the image'],
                          ]}
                          onValueChange={(value) =>
                            setHeroDraft({
                              ...heroDraft,
                              text_position: value as HeroTextPosition,
                            })
                          }
                        />
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

      <Dialog open={navOpen} onOpenChange={setNavOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 aria-hidden="true" className="h-4 w-4" />
              Edit navigation
            </DialogTitle>
            <DialogDescription>Manage links, nesting, order, and visibility.</DialogDescription>
          </DialogHeader>

          {navLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              Loading navigation
            </div>
          ) : null}

          {navError ? (
            <Alert variant="destructive">
              <AlertDescription>{navError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-3">
            {navItems.length > 0 ? (
              navItems.map((item, index) => renderNavItemEditor(item, [index], 0))
            ) : (
              <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                No navigation items yet.
              </div>
            )}
          </div>

          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setNavItems((items) => [...items, defaultNavItem()])}
            >
              <Plus aria-hidden="true" />
              Add item
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={openNavSourceSettings} disabled={!navSectionId || navSaving}>
              <Settings2 aria-hidden="true" />
              Source settings
            </Button>
            <Button type="button" variant="outline" onClick={() => setNavOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={navSaving || navLoading || !navSectionId} onClick={() => void saveNavigation()}>
              {navSaving ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
              Save navigation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={embedOpen} onOpenChange={setEmbedOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon aria-hidden="true" className="h-4 w-4" />
              Edit embed
            </DialogTitle>
            <DialogDescription>Choose a trusted provider and configure its embed settings.</DialogDescription>
          </DialogHeader>

          {embedLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              Loading embed
            </div>
          ) : null}

          {embedError ? (
            <Alert variant="destructive">
              <AlertDescription>{embedError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-4">
            <Field id="embed-provider" label="Provider">
              <EditorSelect
                id="embed-provider"
                value={embedProviderId}
                disabled={embedLoading || embedSaving}
                options={Object.entries(PROVIDERS).map(([id, provider]) => [id, `${provider.icon} ${provider.label}`])}
                onValueChange={selectEmbedProvider}
              />
            </Field>

            <Field id="embed-heading" label="Heading (optional)">
              <Input
                id="embed-heading"
                value={embedHeading}
                placeholder="Block heading shown above the embed"
                disabled={embedLoading || embedSaving}
                onChange={(event) => setEmbedHeading(event.currentTarget.value)}
              />
            </Field>

            {embedProviderId === 'youtube' || embedProviderId === 'vimeo' ? (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <Label htmlFor="embed-url-helper" className="text-xs text-muted-foreground">
                  Paste a {embedProviderId === 'youtube' ? 'YouTube' : 'Vimeo'} URL to extract the ID
                </Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    id="embed-url-helper"
                    value={embedUrlHelper}
                    placeholder={
                      embedProviderId === 'youtube'
                        ? 'https://www.youtube.com/watch?v=...'
                        : 'https://vimeo.com/...'
                    }
                    disabled={embedLoading || embedSaving}
                    onChange={(event) => setEmbedUrlHelper(event.currentTarget.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={embedLoading || embedSaving}
                    onClick={extractEmbedVideoId}
                  >
                    Extract
                  </Button>
                </div>
              </div>
            ) : null}

            <fieldset className="space-y-3 rounded-md border border-border p-3">
              <legend className="px-1 text-xs font-semibold uppercase text-muted-foreground">Provider params</legend>
              {embedParamEntries.length > 0 ? (
                embedParamEntries.map(([key, schema]) => renderEmbedParamField(key, schema))
              ) : (
                <p className="text-sm text-muted-foreground">No provider params.</p>
              )}
            </fieldset>

            {embedProviderId === 'iframe' ? (
              <Alert>
                <ShieldAlert aria-hidden="true" className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-3">
                    <p>
                      This block embeds content from a source Kychon has not verified. Visitors run any scripts that
                      source serves.
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <Checkbox
                        id="embed-trust-ack"
                        checked={embedTrustAck && Boolean(embedTrustedHost)}
                        disabled={!embedTrustedHost || embedLoading || embedSaving}
                        onCheckedChange={(checked) => setEmbedTrustAck(checked === true)}
                      />
                      <Label htmlFor="embed-trust-ack" className="leading-5">
                        I trust <code className="rounded bg-muted px-1 py-0.5">{embedTrustedHost || 'this source'}</code>
                      </Label>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEmbedOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={embedSaving || embedLoading || !embedSectionId || !embedCanSave}
              onClick={() => void saveEmbed()}
            >
              {embedSaving ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
              Save embed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sourceOpen} onOpenChange={setSourceOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 aria-hidden="true" className="h-4 w-4" />
              Source settings
            </DialogTitle>
            <DialogDescription>{sourceTypeLabel(sourceType)} block fidelity settings.</DialogDescription>
          </DialogHeader>

          {sourceLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              Loading source settings
            </div>
          ) : null}

          {sourceError ? (
            <Alert variant="destructive">
              <AlertDescription>{sourceError}</AlertDescription>
            </Alert>
          ) : null}

          {renderSourceBody()}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSourceOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={sourceSaving || sourceLoading || !sourceSectionId || !sourceType}
              onClick={() => void saveSourceSettings()}
            >
              {sourceSaving ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
              Save source settings
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

export function openNavEditControl(sectionId: number): void {
  window.dispatchEvent(new CustomEvent<NavEditDetail>(NAV_EDIT_EVENT, { detail: { sectionId } }));
}

export function openEmbedEditControl(sectionId: number): void {
  window.dispatchEvent(new CustomEvent<EmbedEditDetail>(EMBED_EDIT_EVENT, { detail: { sectionId } }));
}
