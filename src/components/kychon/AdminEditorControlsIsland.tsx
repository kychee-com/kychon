'use client';

import { Loader2, Maximize2, Save, Settings2, Trash2 } from 'lucide-react';
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
} from '@/components/kychon/ui';
import { COPIED_THEME_EDITOR_TYPES, type CopiedThemeEditorType } from '@/lib/admin/copied-theme-editor';
import { del, get, patch } from '@/lib/api';
import { BLOCK_TYPES, getSupportedSpans } from '@/lib/blocks';
import { showToast } from '@/lib/toast-events';
import { cn } from '@/lib/ui/cn';

const SECTION_EDIT_EVENT = 'kychon:admin-editor-section-edit';
const HERO_SETTINGS_EVENT = 'kychon:admin-editor-open-hero-settings';
const SOURCE_SETTINGS_EVENT = 'kychon:admin-editor-open-source-settings';

interface SectionRow {
  id: number;
  section_type: string;
  scope?: string;
  column_span?: string | null;
}

interface SectionEditDetail {
  sectionId: number;
}

let root: Root | null = null;

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

function AdminEditorControls() {
  const [open, setOpen] = useState(false);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [row, setRow] = useState<SectionRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<'span' | 'scope' | 'remove' | null>(null);
  const [error, setError] = useState('');

  const spans = useMemo(() => (row ? getSupportedSpans(row.section_type) : []), [row]);
  const sectionDef = row ? BLOCK_TYPES[row.section_type] : null;
  const currentScope: 'page' | 'global' = row?.scope === 'global' ? 'global' : 'page';
  const nextScope: 'page' | 'global' = currentScope === 'global' ? 'page' : 'global';
  const canEditHero = row?.section_type === 'hero';
  const canEditSource = row ? COPIED_THEME_EDITOR_TYPES.has(row.section_type as CopiedThemeEditorType) : false;

  async function loadSection(nextSectionId: number) {
    setOpen(true);
    setSectionId(nextSectionId);
    setRow(null);
    setError('');
    setLoading(true);

    try {
      const rows = await get(`sections?id=eq.${nextSectionId}`);
      if (!rows[0]) {
        setError('Block not found');
        return;
      }
      setRow(rows[0]);
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

  function openHeroSettings() {
    if (!sectionId) return;
    setOpen(false);
    emitEditorBridgeEvent(HERO_SETTINGS_EVENT, sectionId);
  }

  function openSourceSettings() {
    if (!sectionId) return;
    setOpen(false);
    emitEditorBridgeEvent(SOURCE_SETTINGS_EVENT, sectionId);
  }

  return (
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
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Scope</div>
              <Button type="button" variant="secondary" disabled={saving !== null} onClick={() => void updateScope()}>
                {saving === 'scope' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
                {nextScope === 'global' ? 'Make global' : 'Make page-only'}
              </Button>
            </div>

            {canEditHero || canEditSource ? (
              <div className="flex flex-wrap gap-2">
                {canEditHero ? (
                  <Button type="button" variant="outline" onClick={openHeroSettings}>
                    <Settings2 aria-hidden="true" />
                    Hero settings
                  </Button>
                ) : null}
                {canEditSource ? (
                  <Button type="button" variant="outline" onClick={openSourceSettings}>
                    <Settings2 aria-hidden="true" />
                    Source settings
                  </Button>
                ) : null}
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
