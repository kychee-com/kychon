'use client';

import { Check, Clock, Loader2, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { showAdminAccessDenied, revealAdminContent } from '@/lib/admin-access';
import { del, get, patch, post } from '@/lib/api';
import { isAdmin } from '@/lib/auth';
import { applyTheme, clearCache, ready, refreshMemberRecord } from '@/lib/config';
import { showToast } from '@/lib/toast-events';

type ConfigMap = Record<string, any>;
type SaveKey =
  | 'branding'
  | 'theme'
  | 'general'
  | 'event-display'
  | 'feature'
  | 'ai'
  | 'tier'
  | 'field';

interface SiteConfigRow {
  key: string;
  value: any;
}

interface BrandingForm {
  site_name: string;
  site_tagline: string;
  site_description: string;
  brand_text: string;
  brand_text_short: string;
  brand_icon_url: string;
  brand_wordmark_url: string;
  favicon_url: string;
}

interface ThemeForm {
  primary: string;
  primary_hover: string;
  bg: string;
  surface: string;
  text: string;
  text_muted: string;
  border: string;
  font_heading: string;
  font_body: string;
  radius: string;
}

interface GeneralForm {
  signup_mode: string;
  default_language: string;
  directory_public: boolean;
  polls_member_create: boolean;
}

interface EventDisplayForm {
  event_source_timezone: string;
  event_time_display_mode: string;
}

interface MembershipTier {
  id: number;
  name: string;
  price_label?: string;
  description?: string;
  benefits?: string[];
  position?: number;
  is_default?: boolean;
}

interface CustomField {
  id: number;
  field_name: string;
  field_label: string;
  field_type: string;
  options?: string[] | null;
  required?: boolean;
  visible_in_directory?: boolean;
  position?: number;
}

interface AiActivity {
  moderated: number;
  translations: number;
  loaded: boolean;
}

const COLOR_FALLBACKS: Pick<
  ThemeForm,
  'primary' | 'primary_hover' | 'bg' | 'surface' | 'text' | 'text_muted' | 'border'
> = {
  primary: '#3b82f6',
  primary_hover: '#2563eb',
  bg: '#ffffff',
  surface: '#f8fafc',
  text: '#0f172a',
  text_muted: '#64748b',
  border: '#e2e8f0',
};

const EMPTY_BRANDING: BrandingForm = {
  site_name: '',
  site_tagline: '',
  site_description: '',
  brand_text: '',
  brand_text_short: '',
  brand_icon_url: '',
  brand_wordmark_url: '',
  favicon_url: '',
};

const EMPTY_THEME: ThemeForm = {
  primary: COLOR_FALLBACKS.primary,
  primary_hover: COLOR_FALLBACKS.primary_hover,
  bg: COLOR_FALLBACKS.bg,
  surface: COLOR_FALLBACKS.surface,
  text: COLOR_FALLBACKS.text,
  text_muted: COLOR_FALLBACKS.text_muted,
  border: COLOR_FALLBACKS.border,
  font_heading: '',
  font_body: '',
  radius: '',
};

const EMPTY_GENERAL: GeneralForm = {
  signup_mode: 'approved',
  default_language: 'en',
  directory_public: false,
  polls_member_create: false,
};

const EMPTY_EVENT_DISPLAY: EventDisplayForm = {
  event_source_timezone: '',
  event_time_display_mode: 'visitor',
};

const AI_FLAGS = ['feature_ai_moderation', 'feature_ai_translation'];
const SELECT_EMPTY_VALUE = '__kychon_empty_value__';
const FALLBACK_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Jerusalem',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asHexColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function featureLabel(key: string): string {
  return key.replace(/^feature_/, '').replace(/_/g, ' ');
}

function buildConfigMap(rows: SiteConfigRow[]): ConfigMap {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function brandingFromConfig(config: ConfigMap): BrandingForm {
  return {
    site_name: asText(config.site_name),
    site_tagline: asText(config.site_tagline),
    site_description: asText(config.site_description),
    brand_text: asText(config.brand_text || config.site_name),
    brand_text_short: asText(config.brand_text_short),
    brand_icon_url: asText(config.brand_icon_url),
    brand_wordmark_url: asText(config.brand_wordmark_url),
    favicon_url: asText(config.favicon_url),
  };
}

function themeFromConfig(config: ConfigMap): ThemeForm {
  const theme = config.theme || {};
  return {
    primary: asHexColor(theme.primary, COLOR_FALLBACKS.primary),
    primary_hover: asHexColor(theme.primary_hover, COLOR_FALLBACKS.primary_hover),
    bg: asHexColor(theme.bg, COLOR_FALLBACKS.bg),
    surface: asHexColor(theme.surface, COLOR_FALLBACKS.surface),
    text: asHexColor(theme.text, COLOR_FALLBACKS.text),
    text_muted: asHexColor(theme.text_muted, COLOR_FALLBACKS.text_muted),
    border: asHexColor(theme.border, COLOR_FALLBACKS.border),
    font_heading: asText(theme.font_heading),
    font_body: asText(theme.font_body),
    radius: asText(theme.radius),
  };
}

function generalFromConfig(config: ConfigMap): GeneralForm {
  return {
    signup_mode: asText(config.signup_mode) || 'approved',
    default_language: asText(config.default_language) || 'en',
    directory_public: config.directory_public === true,
    polls_member_create: config.polls_member_create === true,
  };
}

function eventDisplayFromConfig(config: ConfigMap): EventDisplayForm {
  return {
    event_source_timezone: asText(config.event_source_timezone),
    event_time_display_mode: config.event_time_display_mode === 'source' ? 'source' : 'visitor',
  };
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

function supportedTimeZones(): string[] {
  const supportedValuesOf = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  try {
    return typeof supportedValuesOf === 'function' ? supportedValuesOf('timeZone') : FALLBACK_TIMEZONES;
  } catch {
    return FALLBACK_TIMEZONES;
  }
}

function buildTimeZoneOptions(current: string, detected: string, base: string[] = FALLBACK_TIMEZONES): string[] {
  const options = new Set<string>(base);
  if (current) options.add(current);
  if (detected) options.add(detected);
  return Array.from(options).sort((a, b) => a.localeCompare(b));
}

function isValidTimeZone(value: string): boolean {
  if (!value) return true;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function normalizeBenefits(benefits: unknown): string[] {
  return Array.isArray(benefits) ? benefits.map((benefit) => String(benefit)) : [];
}

function normalizeOptions(options: unknown): string[] {
  return Array.isArray(options) ? options.map((option) => String(option)) : [];
}

function Field({
  id,
  label,
  children,
  help,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
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

function SettingsSelect({
  id,
  value,
  options,
  onValueChange,
  disabled,
  className,
  placeholder = 'Select an option',
}: {
  id: string;
  value: string;
  options: Array<[string, string]>;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  return (
    <Select
      value={encodeSelectValue(value, options)}
      disabled={disabled}
      onValueChange={(nextValue) => onValueChange(decodeSelectItemValue(nextValue))}
    >
      <SelectTrigger id={id} className={className}>
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

function CheckboxField({
  checked,
  label,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();

  return (
    <div className="flex min-h-9 items-center gap-2 rounded-md border border-transparent px-2 text-sm hover:bg-muted/50">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(nextChecked) => onCheckedChange(nextChecked === true)}
      />
      <Label htmlFor={id} className="leading-5">
        {label}
      </Label>
    </div>
  );
}

function SaveButton({ isSaving, children = 'Save' }: { isSaving: boolean; children?: React.ReactNode }) {
  return (
    <Button type="submit" disabled={isSaving}>
      {isSaving ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
      {isSaving ? 'Saving' : children}
    </Button>
  );
}

function SectionError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export default function AdminSettingsApp() {
  const [config, setConfig] = useState<ConfigMap>({});
  const [branding, setBranding] = useState<BrandingForm>(EMPTY_BRANDING);
  const [theme, setTheme] = useState<ThemeForm>(EMPTY_THEME);
  const [general, setGeneral] = useState<GeneralForm>(EMPTY_GENERAL);
  const [eventDisplay, setEventDisplay] = useState<EventDisplayForm>(EMPTY_EVENT_DISPLAY);
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [editingTier, setEditingTier] = useState<MembershipTier | null>(null);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [fieldOptionsText, setFieldOptionsText] = useState('');
  const [aiActivity, setAiActivity] = useState<AiActivity>({ moderated: 0, translations: 0, loaded: false });
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState('');
  const [saving, setSaving] = useState<SaveKey | null>(null);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [detectedTimeZone, setDetectedTimeZone] = useState('');
  const [timezoneOptions, setTimezoneOptions] = useState(() => buildTimeZoneOptions('', ''));

  const featureEntries = useMemo(
    () =>
      Object.entries(config)
        .filter(([key]) => key.startsWith('feature_') && !AI_FLAGS.includes(key))
        .sort(([a], [b]) => a.localeCompare(b)),
    [config],
  );
  useEffect(() => {
    const detected = browserTimeZone();
    setDetectedTimeZone(detected);
    setTimezoneOptions(buildTimeZoneOptions(eventDisplay.event_source_timezone, detected, supportedTimeZones()));
  }, [eventDisplay.event_source_timezone]);

  async function loadAiActivity(): Promise<void> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const since = sevenDaysAgo.toISOString();

    const [moderated, translations] = await Promise.all([
      get(`moderation_log?created_at=gte.${since}&select=id`)
        .then((rows: any[]) => rows.length)
        .catch(() => 0),
      get(`content_translations?created_at=gte.${since}&select=id`)
        .then((rows: any[]) => rows.length)
        .catch(() => 0),
    ]);

    setAiActivity({ moderated, translations, loaded: true });
  }

  async function loadSettings() {
    setLoading(true);
    setFatalError('');

    try {
      await ready;
      await refreshMemberRecord();
      if (!isAdmin()) {
        showAdminAccessDenied();
        return;
      }
      revealAdminContent();

      const [configRows, tierRows, fieldRows] = await Promise.all([
        get('site_config'),
        get('membership_tiers?order=position.asc').catch(() => []),
        get('member_custom_fields?order=position.asc').catch(() => []),
      ]);
      const nextConfig = buildConfigMap(configRows);

      setConfig(nextConfig);
      setBranding(brandingFromConfig(nextConfig));
      setTheme(themeFromConfig(nextConfig));
      setGeneral(generalFromConfig(nextConfig));
      setEventDisplay(eventDisplayFromConfig(nextConfig));
      setTiers(tierRows);
      setFields(fieldRows);
      await loadAiActivity();
    } catch (error) {
      setFatalError(formatError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();

    const reload = () => void loadSettings();
    document.addEventListener('wl-auth-changed', reload);
    document.addEventListener('wl-locale-changed', reload);
    return () => {
      document.removeEventListener('wl-auth-changed', reload);
      document.removeEventListener('wl-locale-changed', reload);
    };
  }, []);

  async function patchConfig(key: string, value: any, category = 'general') {
    const updated = await patch(`site_config?key=eq.${key}`, { value });
    if (Array.isArray(updated) && updated.length === 0) {
      await post('site_config', { key, value, category });
    }
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function setSectionError(key: SaveKey, message = '') {
    setSectionErrors((current) => ({ ...current, [key]: message }));
  }

  async function runSave(key: SaveKey, action: () => Promise<void>, successMessage: string) {
    setSaving(key);
    setSectionError(key);
    try {
      await action();
      showToast({ type: 'success', message: successMessage });
    } catch (error) {
      const message = formatError(error);
      setSectionError(key, message);
      showToast({ type: 'error', message });
    } finally {
      setSaving(null);
    }
  }

  async function saveBranding(event: React.SyntheticEvent) {
    event.preventDefault();
    const brandText = branding.brand_text.trim();
    if (!brandText) {
      setSectionError('branding', 'Brand Text is required');
      return;
    }

    await runSave(
      'branding',
      async () => {
        await Promise.all([
          patchConfig('site_name', branding.site_name),
          patchConfig('site_tagline', branding.site_tagline),
          patchConfig('site_description', branding.site_description),
          patchConfig('brand_text', brandText),
          patchConfig('brand_text_short', branding.brand_text_short),
          patchConfig('brand_icon_url', branding.brand_icon_url),
          patchConfig('brand_wordmark_url', branding.brand_wordmark_url),
          patchConfig('favicon_url', branding.favicon_url),
        ]);
        clearCache('wl_cache_site_config');
      },
      'Branding saved',
    );
  }

  async function saveTheme(event: React.SyntheticEvent) {
    event.preventDefault();
    await runSave(
      'theme',
      async () => {
        await patchConfig('theme', theme);
        applyTheme(theme);
        clearCache('wl_cache_site_config');
      },
      'Theme saved',
    );
  }

  async function saveGeneral(event: React.SyntheticEvent) {
    event.preventDefault();
    await runSave(
      'general',
      async () => {
        await Promise.all([
          patchConfig('signup_mode', general.signup_mode),
          patchConfig('default_language', general.default_language),
          patchConfig('directory_public', general.directory_public),
          patchConfig('polls_member_create', general.polls_member_create),
        ]);
      },
      'General settings saved',
    );
  }

  async function saveEventDisplay(event: React.SyntheticEvent) {
    event.preventDefault();
    const timezone = eventDisplay.event_source_timezone.trim();
    if (!isValidTimeZone(timezone)) {
      setSectionError('event-display', 'Choose a valid IANA timezone.');
      return;
    }
    await runSave(
      'event-display',
      async () => {
        await Promise.all([
          patchConfig('event_source_timezone', timezone, 'events'),
          patchConfig(
            'event_time_display_mode',
            eventDisplay.event_time_display_mode === 'source' ? 'source' : 'visitor',
            'events',
          ),
        ]);
        clearCache('wl_cache_site_config');
      },
      'Event display saved',
    );
  }

  async function toggleConfig(key: string, checked: boolean, group: SaveKey) {
    setSectionError(group);
    try {
      await patchConfig(key, checked);
      showToast({ type: 'success', message: `${featureLabel(key)} saved` });
    } catch (error) {
      const message = formatError(error);
      setSectionError(group, message);
      showToast({ type: 'error', message });
    }
  }

  async function addTier() {
    await runSave(
      'tier',
      async () => {
        const [created] = await post('membership_tiers', {
          name: 'New Tier',
          price_label: 'Free',
          benefits: [],
          position: tiers.length + 1,
          is_default: false,
        });
        const next = [...tiers, created];
        setTiers(next);
        setEditingTier({ ...created, benefits: [] });
      },
      'Tier added',
    );
  }

  async function saveTier() {
    if (!editingTier) return;
    await runSave(
      'tier',
      async () => {
        await patch(`membership_tiers?id=eq.${editingTier.id}`, {
          name: editingTier.name,
          price_label: editingTier.price_label || '',
          description: editingTier.description || '',
          benefits: normalizeBenefits(editingTier.benefits).filter((benefit) => benefit.trim()),
          is_default: editingTier.is_default === true,
        });
        setTiers(await get('membership_tiers?order=position.asc'));
        setEditingTier(null);
      },
      'Tier saved',
    );
  }

  async function deleteTier() {
    if (!editingTier || !confirm(`Delete tier "${editingTier.name}"?`)) return;
    await runSave(
      'tier',
      async () => {
        await del(`membership_tiers?id=eq.${editingTier.id}`);
        setTiers(await get('membership_tiers?order=position.asc'));
        setEditingTier(null);
      },
      'Tier deleted',
    );
  }

  async function addField() {
    await runSave(
      'field',
      async () => {
        const [created] = await post('member_custom_fields', {
          field_name: 'new_field',
          field_label: 'New Field',
          field_type: 'text',
          required: false,
          visible_in_directory: false,
          position: fields.length + 1,
        });
        setFields([...fields, created]);
        setEditingField(created);
        setFieldOptionsText('');
      },
      'Field added',
    );
  }

  function openField(field: CustomField) {
    setEditingField(field);
    setFieldOptionsText(normalizeOptions(field.options).join('\n'));
  }

  async function saveField() {
    if (!editingField) return;
    const options =
      editingField.field_type === 'select'
        ? fieldOptionsText
            .split('\n')
            .map((option) => option.trim())
            .filter(Boolean)
        : null;

    await runSave(
      'field',
      async () => {
        await patch(`member_custom_fields?id=eq.${editingField.id}`, {
          field_label: editingField.field_label,
          field_name: editingField.field_name,
          field_type: editingField.field_type,
          options,
          required: editingField.required === true,
          visible_in_directory: editingField.visible_in_directory === true,
        });
        setFields(await get('member_custom_fields?order=position.asc'));
        setEditingField(null);
      },
      'Field saved',
    );
  }

  async function deleteField() {
    if (!editingField || !confirm(`Delete field "${editingField.field_label}"?`)) return;
    await runSave(
      'field',
      async () => {
        await del(`member_custom_fields?id=eq.${editingField.id}`);
        setFields(await get('member_custom_fields?order=position.asc'));
        setEditingField(null);
      },
      'Field deleted',
    );
  }

  const tierBenefits = normalizeBenefits(editingTier?.benefits);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 py-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold tracking-normal">Site Settings</h2>
        {loading ? (
          <Badge variant="secondary" className="w-fit">
            <Loader2 aria-hidden="true" className="mr-1 h-3 w-3 animate-spin" />
            Loading
          </Badge>
        ) : (
          <Badge variant="outline" className="w-fit">
            <Check aria-hidden="true" className="mr-1 h-3 w-3" />
            Ready
          </Badge>
        )}
      </div>

      {fatalError ? (
        <Alert variant="destructive">
          <AlertDescription>{fatalError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={saveBranding}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="as-site-name" label="Site Name">
                <Input
                  id="as-site-name"
                  value={branding.site_name}
                  onChange={(event) => setBranding({ ...branding, site_name: event.currentTarget.value })}
                />
              </Field>
              <Field id="as-site-tagline" label="Tagline">
                <Input
                  id="as-site-tagline"
                  value={branding.site_tagline}
                  onChange={(event) => setBranding({ ...branding, site_tagline: event.currentTarget.value })}
                />
              </Field>
            </div>
            <Field id="as-site-description" label="Description">
              <Textarea
                id="as-site-description"
                rows={2}
                value={branding.site_description}
                onChange={(event) => setBranding({ ...branding, site_description: event.currentTarget.value })}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="as-brand-text" label="Brand Text">
                <Input
                  id="as-brand-text"
                  required
                  value={branding.brand_text}
                  onChange={(event) => setBranding({ ...branding, brand_text: event.currentTarget.value })}
                />
              </Field>
              <Field id="as-brand-text-short" label="Brand Text Short">
                <Input
                  id="as-brand-text-short"
                  value={branding.brand_text_short}
                  onChange={(event) => setBranding({ ...branding, brand_text_short: event.currentTarget.value })}
                />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field id="as-brand-icon-url" label="Brand Icon URL">
                <Input
                  id="as-brand-icon-url"
                  value={branding.brand_icon_url}
                  onChange={(event) => setBranding({ ...branding, brand_icon_url: event.currentTarget.value })}
                />
              </Field>
              <Field id="as-brand-wordmark-url" label="Brand Wordmark URL">
                <Input
                  id="as-brand-wordmark-url"
                  value={branding.brand_wordmark_url}
                  onChange={(event) => setBranding({ ...branding, brand_wordmark_url: event.currentTarget.value })}
                />
              </Field>
              <Field id="as-favicon-url" label="Favicon URL">
                <Input
                  id="as-favicon-url"
                  value={branding.favicon_url}
                  onChange={(event) => setBranding({ ...branding, favicon_url: event.currentTarget.value })}
                />
              </Field>
            </div>
            <SectionError message={sectionErrors.branding} />
            <SaveButton isSaving={saving === 'branding'} />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={saveTheme}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['primary', 'Primary'],
                ['primary_hover', 'Hover'],
                ['bg', 'Background'],
                ['surface', 'Surface'],
                ['text', 'Text'],
                ['text_muted', 'Muted'],
                ['border', 'Border'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
                  <input
                    type="color"
                    className="h-10 w-10 rounded-md border border-input bg-transparent"
                    value={theme[key as keyof ThemeForm]}
                    onChange={(event) => setTheme({ ...theme, [key]: event.currentTarget.value })}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field id="as-radius" label="Border Radius">
                <Input
                  id="as-radius"
                  placeholder="0.5rem"
                  value={theme.radius}
                  onChange={(event) => setTheme({ ...theme, radius: event.currentTarget.value })}
                />
              </Field>
              <Field id="as-font-heading" label="Heading Font">
                <Input
                  id="as-font-heading"
                  placeholder="Inter"
                  value={theme.font_heading}
                  onChange={(event) => setTheme({ ...theme, font_heading: event.currentTarget.value })}
                />
              </Field>
              <Field id="as-font-body" label="Body Font">
                <Input
                  id="as-font-body"
                  placeholder="Inter"
                  value={theme.font_body}
                  onChange={(event) => setTheme({ ...theme, font_body: event.currentTarget.value })}
                />
              </Field>
            </div>
            <SectionError message={sectionErrors.theme} />
            <SaveButton isSaving={saving === 'theme'} />
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveGeneral}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field id="as-signup-mode" label="Signup Mode">
                  <SettingsSelect
                    id="as-signup-mode"
                    value={general.signup_mode}
                    options={[
                      ['open', 'Open'],
                      ['approved', 'Approved'],
                      ['closed', 'Closed'],
                    ]}
                    onValueChange={(value) => setGeneral({ ...general, signup_mode: value })}
                  />
                </Field>
                <Field id="as-default-language" label="Default Language">
                  <SettingsSelect
                    id="as-default-language"
                    value={general.default_language}
                    options={[
                      ['en', 'English'],
                      ['es', 'Spanish'],
                    ]}
                    onValueChange={(value) => setGeneral({ ...general, default_language: value })}
                  />
                </Field>
              </div>
              <div className="space-y-1">
                <CheckboxField
                  checked={general.directory_public}
                  label="Member directory visible to visitors"
                  onCheckedChange={(checked) => setGeneral({ ...general, directory_public: checked })}
                />
                <CheckboxField
                  checked={general.polls_member_create}
                  label="Members can create polls"
                  onCheckedChange={(checked) => setGeneral({ ...general, polls_member_create: checked })}
                />
              </div>
              <SectionError message={sectionErrors.general} />
              <SaveButton isSaving={saving === 'general'} />
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Event Display</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveEventDisplay}>
              <Field id="as-event-source-timezone" label="Default source timezone">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <SettingsSelect
                    id="as-event-source-timezone"
                    className="min-w-0 flex-1"
                    value={eventDisplay.event_source_timezone}
                    options={[
                      ['', 'No source timezone'],
                      ...timezoneOptions.map((timezone) => [timezone, timezone] as [string, string]),
                    ]}
                    onValueChange={(value) => setEventDisplay({ ...eventDisplay, event_source_timezone: value })}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    disabled={!detectedTimeZone}
                    onClick={() =>
                      setEventDisplay({ ...eventDisplay, event_source_timezone: detectedTimeZone })
                    }
                  >
                    <Clock aria-hidden="true" />
                    Use mine
                  </Button>
                </div>
              </Field>
              <Field id="as-event-time-display-mode" label="Default event time display">
                <SettingsSelect
                  id="as-event-time-display-mode"
                  value={eventDisplay.event_time_display_mode}
                  options={[
                    ['visitor', 'Visitor local time'],
                    ['source', 'Source timezone'],
                  ]}
                  onValueChange={(value) => setEventDisplay({ ...eventDisplay, event_time_display_mode: value })}
                />
              </Field>
              <SectionError message={sectionErrors['event-display']} />
              <SaveButton isSaving={saving === 'event-display'} />
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SectionError message={sectionErrors.feature} />
          {featureEntries.length ? (
            featureEntries.map(([key, value]) => (
              <CheckboxField
                key={key}
                checked={value === true || value === 'true'}
                label={featureLabel(key)}
                onCheckedChange={(checked) => void toggleConfig(key, checked, 'feature')}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No feature flags yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Membership Tiers</CardTitle>
            <CardDescription>{tiers.length} configured</CardDescription>
          </div>
          <Button type="button" size="sm" onClick={() => void addTier()} disabled={saving === 'tier'}>
            <Plus aria-hidden="true" />
            Add Tier
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <SectionError message={sectionErrors.tier} />
          {tiers.length ? (
            tiers.map((tier) => (
              <div key={tier.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{tier.name}</strong>
                    {tier.is_default ? <Badge>Default</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tier.price_label || 'Free'}
                    {normalizeBenefits(tier.benefits).length ? ` - ${normalizeBenefits(tier.benefits).join(', ')}` : ''}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingTier(tier)}>
                  <Pencil aria-hidden="true" />
                  Edit
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No membership tiers yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Member Custom Fields</CardTitle>
            <CardDescription>{fields.length} configured</CardDescription>
          </div>
          <Button type="button" size="sm" onClick={() => void addField()} disabled={saving === 'field'}>
            <Plus aria-hidden="true" />
            Add Field
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <SectionError message={sectionErrors.field} />
          {fields.length ? (
            fields.map((field) => (
              <div key={field.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{field.field_label}</strong>
                    <Badge variant="secondary">{field.field_type}</Badge>
                    {field.required ? <Badge variant="outline">Required</Badge> : null}
                    {field.visible_in_directory ? <Badge variant="outline">Directory</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{field.field_name}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => openField(field)}>
                  <Pencil aria-hidden="true" />
                  Edit
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No custom fields yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SectionError message={sectionErrors.ai} />
          {AI_FLAGS.map((key) => (
            <CheckboxField
              key={key}
              checked={config[key] === true || config[key] === 'true'}
              label={`AI ${featureLabel(key).replace(/^ai /, '')}`}
              onCheckedChange={(checked) => void toggleConfig(key, checked, 'ai')}
            />
          ))}
          {aiActivity.loaded && (aiActivity.moderated || aiActivity.translations) ? (
            <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
              <h4 className="mb-1 font-medium text-foreground">AI Activity</h4>
              {aiActivity.moderated ? <div>{aiActivity.moderated} posts moderated</div> : null}
              {aiActivity.translations ? <div>{aiActivity.translations} translations created</div> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={editingTier !== null} onOpenChange={(open) => !open && setEditingTier(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Tier</DialogTitle>
            <DialogDescription>Update membership tier details.</DialogDescription>
          </DialogHeader>
          {editingTier ? (
            <div className="space-y-4">
              <Field id="tier-name" label="Name">
                <Input
                  id="tier-name"
                  value={editingTier.name || ''}
                  onChange={(event) => setEditingTier({ ...editingTier, name: event.currentTarget.value })}
                />
              </Field>
              <Field id="tier-price" label="Price Label">
                <Input
                  id="tier-price"
                  value={editingTier.price_label || ''}
                  onChange={(event) => setEditingTier({ ...editingTier, price_label: event.currentTarget.value })}
                />
              </Field>
              <Field id="tier-description" label="Description">
                <Textarea
                  id="tier-description"
                  rows={2}
                  value={editingTier.description || ''}
                  onChange={(event) => setEditingTier({ ...editingTier, description: event.currentTarget.value })}
                />
              </Field>
              <div className="space-y-2">
                <Label>Benefits</Label>
                {tierBenefits.map((benefit, index) => (
                  <div key={`${index}-${benefit}`} className="flex items-center gap-2">
                    <Input
                      value={benefit}
                      onChange={(event) => {
                        const next = [...tierBenefits];
                        next[index] = event.currentTarget.value;
                        setEditingTier({ ...editingTier, benefits: next });
                      }}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      aria-label="Remove benefit"
                      onClick={() => {
                        const next = tierBenefits.filter((_, benefitIndex) => benefitIndex !== index);
                        setEditingTier({ ...editingTier, benefits: next });
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditingTier({ ...editingTier, benefits: [...tierBenefits, ''] })}
                >
                  <Plus aria-hidden="true" />
                  Add Benefit
                </Button>
              </div>
              <CheckboxField
                checked={editingTier.is_default === true}
                label="Default tier"
                onCheckedChange={(checked) => setEditingTier({ ...editingTier, is_default: checked })}
              />
              <SectionError message={sectionErrors.tier} />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="destructive" onClick={() => void deleteTier()} disabled={saving === 'tier'}>
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditingTier(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveTier()} disabled={saving === 'tier'}>
              {saving === 'tier' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingField !== null} onOpenChange={(open) => !open && setEditingField(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Custom Field</DialogTitle>
            <DialogDescription>Update member profile field details.</DialogDescription>
          </DialogHeader>
          {editingField ? (
            <div className="space-y-4">
              <Field id="field-label" label="Label">
                <Input
                  id="field-label"
                  value={editingField.field_label || ''}
                  onChange={(event) => setEditingField({ ...editingField, field_label: event.currentTarget.value })}
                />
              </Field>
              <Field id="field-name" label="Field Name">
                <Input
                  id="field-name"
                  value={editingField.field_name || ''}
                  onChange={(event) => setEditingField({ ...editingField, field_name: event.currentTarget.value })}
                />
              </Field>
              <Field id="field-type" label="Type">
                <SettingsSelect
                  id="field-type"
                  value={editingField.field_type || 'text'}
                  options={[
                    ['text', 'Text'],
                    ['textarea', 'Textarea'],
                    ['select', 'Select'],
                    ['checkbox', 'Checkbox'],
                  ]}
                  onValueChange={(value) => setEditingField({ ...editingField, field_type: value })}
                />
              </Field>
              {editingField.field_type === 'select' ? (
                <Field id="field-options" label="Options">
                  <Textarea
                    id="field-options"
                    rows={3}
                    value={fieldOptionsText}
                    onChange={(event) => setFieldOptionsText(event.currentTarget.value)}
                  />
                </Field>
              ) : null}
              <div className="space-y-1">
                <CheckboxField
                  checked={editingField.required === true}
                  label="Required"
                  onCheckedChange={(checked) => setEditingField({ ...editingField, required: checked })}
                />
                <CheckboxField
                  checked={editingField.visible_in_directory === true}
                  label="Show in member directory"
                  onCheckedChange={(checked) =>
                    setEditingField({ ...editingField, visible_in_directory: checked })
                  }
                />
              </div>
              <SectionError message={sectionErrors.field} />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="destructive" onClick={() => void deleteField()} disabled={saving === 'field'}>
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditingField(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveField()} disabled={saving === 'field'}>
              {saving === 'field' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
