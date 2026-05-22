'use client';

import { GripVertical, Loader2, Pencil, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
  toast,
} from '@/components/kychon/ui';
import { execOp } from '@/lib/api';
import type { JsonObject } from '@/lib/capability-api';

/**
 * BlockListEditor — Dialog-driven CRUD for blocks whose config has a
 * top-level array (`editorType: 'list'` in the BlockType registry):
 * features, testimonials, faq, footer_links, promo_cards, image_accordion,
 * slideshow, footer_social.
 *
 * Section 10. Opens in response to the block's edit affordance click
 * (routed by AdminEditorControlsIsland's SECTION_EDIT_EVENT handler when
 * the block's `editorType === 'list'`). Items render as draggable rows;
 * clicking an item's Pencil expands an inline detail form. "Save changes"
 * writes the whole config in one PATCH via `sections.updateConfig`.
 *
 * Controlled-only: `open` / `onOpenChange` are required props (the
 * AdminEditorControlsIsland owns the lifecycle). The earlier
 * Popover-with-trigger pattern was vestigial — every real caller goes
 * through the event-bus path.
 */

interface ItemFieldDef {
  key: string;
  label: string;
  /** `'text'` = single-line Input, `'textarea'` = multi-line Textarea. */
  kind: 'text' | 'textarea';
  placeholder?: string;
}

export interface BlockListEditorProps {
  /** Controlled open state — owned by the parent host (AdminEditorControlsIsland). */
  open: boolean;
  /** Open-state change callback (close-by-overlay-click, ESC, "Cancel"). */
  onOpenChange: (open: boolean) => void;
  /** The sections.id (numeric) — required for the PATCH. */
  sectionId: number;
  /** Block display label for the dialog title. */
  label: string;
  /** When true, the GLOBAL Badge is shown alongside the title. */
  isGlobal: boolean;
  /** Property name in `config` that holds the items array (e.g. `'items'`, `'cards'`, `'panels'`). */
  itemsKey: string;
  /** Per-item field schema rendered in the expand-on-pencil form. */
  itemSchema: ItemFieldDef[];
  /** Function returning the default item shape when "+ Add item" is clicked. */
  defaultItem: () => Record<string, unknown>;
  /** Function returning the per-item summary label for the collapsed row. */
  itemSummary: (item: Record<string, unknown>) => string;
  /** Current block config (full JSONB), used to seed local edit state. */
  config: Record<string, unknown>;
  /** Optional callback after a successful save. */
  onSaved?: (nextConfig: Record<string, unknown>) => void;
}

function readItems(config: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = config?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null);
}

export function BlockListEditor({
  open,
  onOpenChange,
  sectionId,
  label,
  isGlobal,
  itemsKey,
  itemSchema,
  defaultItem,
  itemSummary,
  config,
  onSaved,
}: BlockListEditorProps) {
  const setOpen = onOpenChange;
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed local state every time the popover opens — discard unsaved edits
  // from a prior open, mirror the latest base config.
  useEffect(() => {
    if (open) {
      setItems(readItems(config, itemsKey).map((item) => ({ ...item })));
      setExpandedIndex(null);
      setDragIndex(null);
      setBusy(false);
      setError(null);
    }
  }, [open, config, itemsKey]);

  const updateField = useCallback((index: number, field: string, value: unknown) => {
    setItems((prev) => {
      const next = [...prev];
      const current = next[index];
      if (typeof current === 'object' && current !== null) {
        next[index] = { ...current, [field]: value };
      }
      return next;
    });
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => {
      const next = [...prev, { ...defaultItem() }];
      setExpandedIndex(next.length - 1);
      return next;
    });
  }, [defaultItem]);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setExpandedIndex(null);
  }, []);

  const onDragStart = useCallback((index: number) => (event: React.DragEvent) => {
    setDragIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    // The drag image looks better when set to the row itself; the browser
    // picks the right element automatically here.
  }, []);

  const onDragOver = useCallback((index: number) => (event: React.DragEvent) => {
    if (dragIndex === null || dragIndex === index) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, [dragIndex]);

  const onDrop = useCallback((index: number) => (event: React.DragEvent) => {
    event.preventDefault();
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      return;
    }
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setExpandedIndex(null);
    setDragIndex(null);
  }, [dragIndex]);

  const handleSave = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const nextConfig = { ...config, [itemsKey]: items };
      // `execOp` types its `input` as JsonObject; AssetRef / arbitrary block
      // configs are valid JSON but the type-checker can't prove it without a
      // structural narrow. Cast at the boundary; the gateway re-validates.
      await execOp('sections.updateConfig', { id: sectionId, config: nextConfig } as unknown as JsonObject);
      toast.success(isGlobal ? 'Saved — appears on all pages' : 'Saved');
      setOpen(false);
      onSaved?.(nextConfig);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err ?? 'Save failed'));
      setBusy(false);
    }
  }, [sectionId, items, config, itemsKey, isGlobal, onSaved]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base">{label}</DialogTitle>
            {isGlobal ? <Badge variant="secondary">GLOBAL</Badge> : null}
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-1">
          {items.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              No items yet. Add one to get started.
            </p>
          ) : (
            items.map((item, index) => (
              <BlockListItemRow
                key={index}
                index={index}
                summary={itemSummary(item)}
                expanded={expandedIndex === index}
                onExpand={() => setExpandedIndex(expandedIndex === index ? null : index)}
                onRemove={() => removeItem(index)}
                onDragStart={onDragStart(index)}
                onDragOver={onDragOver(index)}
                onDrop={onDrop(index)}
                isBeingDragged={dragIndex === index}
              >
                {expandedIndex === index ? (
                  <ItemDetailForm
                    item={item}
                    schema={itemSchema}
                    onChange={(field, value) => updateField(index, field, value)}
                    onDone={() => setExpandedIndex(null)}
                  />
                ) : null}
              </BlockListItemRow>
            ))
          )}
        </div>

        <Button variant="outline" size="sm" className="mt-1 w-full" onClick={addItem}>
          <Plus className="mr-1 h-3 w-3" aria-hidden="true" />
          Add item
        </Button>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <div className="mt-2 flex gap-2 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button size="sm" className="flex-1" onClick={handleSave} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" aria-hidden="true" /> : null}
            Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface BlockListItemRowProps {
  index: number;
  summary: string;
  expanded: boolean;
  isBeingDragged: boolean;
  onExpand: () => void;
  onRemove: () => void;
  onDragStart: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  children?: React.ReactNode;
}

function BlockListItemRow({
  summary,
  expanded,
  isBeingDragged,
  onExpand,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  children,
}: BlockListItemRowProps) {
  return (
    <div
      className={[
        'group rounded-md border border-transparent transition-colors',
        expanded ? 'border-border bg-muted/30' : 'hover:bg-muted/50',
        isBeingDragged ? 'opacity-40' : '',
      ].join(' ')}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-2 px-1 py-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 cursor-grab text-muted-foreground hover:text-foreground"
          draggable
          onDragStart={onDragStart}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </Button>
        <span className="flex-1 truncate text-sm">{summary || <em className="text-muted-foreground">untitled</em>}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100"
          onClick={onExpand}
          aria-label={expanded ? 'Collapse item' : 'Edit item'}
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive opacity-0 hover:bg-destructive/10 group-hover:opacity-100"
          onClick={onRemove}
          aria-label="Remove item"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </Button>
      </div>
      {expanded ? <div className="border-t px-3 py-3">{children}</div> : null}
    </div>
  );
}

interface ItemDetailFormProps {
  item: Record<string, unknown>;
  schema: ItemFieldDef[];
  onChange: (field: string, value: unknown) => void;
  onDone: () => void;
}

function ItemDetailForm({ item, schema, onChange, onDone }: ItemDetailFormProps) {
  return (
    <div className="grid gap-2">
      {schema.map((field) => {
        const value = item[field.key];
        const stringValue = typeof value === 'string' ? value : '';
        return (
          <div key={field.key} className="grid gap-1">
            <Label htmlFor={`bl-${field.key}`} className="text-xs">
              {field.label}
            </Label>
            {field.kind === 'textarea' ? (
              <Textarea
                id={`bl-${field.key}`}
                value={stringValue}
                onChange={(event) => onChange(field.key, event.target.value)}
                placeholder={field.placeholder}
                className="min-h-[60px] resize-none text-sm"
              />
            ) : (
              <Input
                id={`bl-${field.key}`}
                value={stringValue}
                onChange={(event) => onChange(field.key, event.target.value)}
                placeholder={field.placeholder}
                className="h-8 text-sm"
              />
            )}
          </div>
        );
      })}
      <div className="mt-1 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

/**
 * useBlockListEditorSchema — convenience: given a block type, return the
 * item schema + items key + default item for the most common list-type
 * blocks. Callers in `AdminEditor.astro` use this to wire the editor for
 * any `editorType: 'list'` block without re-stating the schema per block.
 */
export const LIST_BLOCK_SCHEMAS: Record<
  string,
  Pick<BlockListEditorProps, 'itemsKey' | 'itemSchema' | 'defaultItem' | 'itemSummary'>
> = {
  features: {
    itemsKey: 'items',
    itemSchema: [
      { key: 'icon', label: 'Icon', kind: 'text', placeholder: 'home' },
      { key: 'title', label: 'Title', kind: 'text' },
      { key: 'desc', label: 'Description', kind: 'textarea' },
    ],
    defaultItem: () => ({ icon: '', title: 'New feature', desc: '' }),
    itemSummary: (item) => String(item.title ?? ''),
  },
  testimonials: {
    itemsKey: 'items',
    itemSchema: [
      { key: 'name', label: 'Name', kind: 'text' },
      { key: 'role', label: 'Role', kind: 'text' },
      { key: 'text', label: 'Quote', kind: 'textarea' },
      { key: 'avatar', label: 'Avatar URL', kind: 'text' },
    ],
    defaultItem: () => ({ name: '', role: '', text: '', avatar: '' }),
    itemSummary: (item) => String(item.name ?? ''),
  },
  faq: {
    itemsKey: 'items',
    itemSchema: [
      { key: 'question', label: 'Question', kind: 'text' },
      { key: 'answer', label: 'Answer', kind: 'textarea' },
    ],
    defaultItem: () => ({ question: 'New question', answer: '' }),
    itemSummary: (item) => String(item.question ?? ''),
  },
  promo_cards: {
    itemsKey: 'cards',
    itemSchema: [
      { key: 'tag', label: 'Tag', kind: 'text' },
      { key: 'title', label: 'Title', kind: 'text' },
      { key: 'description', label: 'Description', kind: 'textarea' },
      { key: 'href', label: 'Link', kind: 'text' },
      { key: 'image_url', label: 'Image URL', kind: 'text' },
    ],
    defaultItem: () => ({ tag: '', title: 'New card', description: '', href: '', image_url: '' }),
    itemSummary: (item) => String(item.title ?? ''),
  },
  image_accordion: {
    itemsKey: 'panels',
    itemSchema: [
      { key: 'title', label: 'Title', kind: 'text' },
      { key: 'description', label: 'Description', kind: 'textarea' },
      { key: 'cta_label', label: 'CTA label', kind: 'text' },
      { key: 'href', label: 'Link', kind: 'text' },
      { key: 'image_url', label: 'Image URL', kind: 'text' },
      { key: 'image_alt', label: 'Image alt', kind: 'text' },
    ],
    defaultItem: () => ({
      title: 'New panel',
      description: '',
      cta_label: 'Learn more',
      href: '',
      image_url: '',
      image_alt: '',
    }),
    itemSummary: (item) => String(item.title ?? ''),
  },
  slideshow: {
    itemsKey: 'slides',
    itemSchema: [
      { key: 'caption', label: 'Caption', kind: 'text' },
      { key: 'image_url', label: 'Image URL', kind: 'text' },
      { key: 'href', label: 'Link', kind: 'text' },
    ],
    defaultItem: () => ({ caption: '', image_url: '', href: '' }),
    itemSummary: (item) => String(item.caption ?? item.image_url ?? 'slide'),
  },
  footer_social: {
    itemsKey: 'items',
    itemSchema: [
      { key: 'platform', label: 'Platform', kind: 'text', placeholder: 'twitter' },
      { key: 'href', label: 'URL', kind: 'text', placeholder: 'https://…' },
    ],
    defaultItem: () => ({ platform: '', href: '' }),
    itemSummary: (item) => String(item.platform ?? item.href ?? ''),
  },
  footer_links: {
    // footer_links has nested arrays (columns[].items[]); the simple editor
    // supports the top-level columns only. Per-column items remain editable
    // via inline data-editable attributes or a custom editor follow-up.
    itemsKey: 'columns',
    itemSchema: [{ key: 'heading', label: 'Column heading', kind: 'text' }],
    defaultItem: () => ({ heading: 'New section', items: [] }),
    itemSummary: (item) => String(item.heading ?? ''),
  },
};

export default BlockListEditor;
