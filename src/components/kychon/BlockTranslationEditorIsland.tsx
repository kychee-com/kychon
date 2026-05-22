'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  ScrollArea,
  Textarea,
  toast,
} from '@/components/kychon/ui';
import { execOp, queryOp } from '@/lib/api';
import type { JsonObject } from '@/lib/capability-api';
import { localeLabel } from '@/lib/locale-pool';

/**
 * BlockTranslationEditor — field-by-field translation editor for blocks
 * with non-empty `translatableFields`. admin-content-management Section 11.
 *
 * Two-column layout per field: source value on the left (read-only), the
 * translation Textarea on the right. Saves to `section_translations` via
 * `sections.translate` UPSERT. "Translate with AI" calls
 * `translations.translateText` for each field and fills the textareas.
 *
 * Array notation in `translatableFields` (`items[].title`) is rendered as
 * grouped rows per array index — one heading per item, then its fields.
 */

interface BlockTranslationEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The sections.id (numeric) — required for UPSERT. */
  sectionId: number;
  /** Block display label for the dialog header. */
  blockLabel: string;
  /** The active translation locale (e.g. `'es'`). */
  locale: string;
  /** Dot-paths declaring which fields are translatable (e.g. `['heading', 'items[].title']`). */
  translatableFields: readonly string[];
  /** Current section.config — used to read the source values. */
  sourceConfig: Record<string, unknown>;
}

interface FlatField {
  /** Dot-path that uniquely identifies the field, e.g. `'heading'` or `'items.2.title'`. */
  path: string;
  /** Schema-side dot-path with `[]` notation, e.g. `'heading'` or `'items[].title'`. */
  schemaPath: string;
  /** Optional row label for array items (e.g. `'Item 3'`). */
  groupLabel?: string;
  /** Field label (the leaf field name). */
  label: string;
  /** Source value (from base config). Empty string if missing. */
  source: string;
}

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = current[part];
    if (Array.isArray(next)) {
      // Continue into the array; the next part should be an index.
      const idx = Number(parts[i + 1]);
      if (Number.isInteger(idx)) {
        if (!next[idx] || typeof next[idx] !== 'object') next[idx] = {};
        current = next[idx] as Record<string, unknown>;
        i += 1; // consume the index part
        continue;
      }
    }
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function expandFields(
  source: Record<string, unknown>,
  translatableFields: readonly string[],
): FlatField[] {
  const out: FlatField[] = [];
  for (const schemaPath of translatableFields) {
    if (schemaPath.includes('[]')) {
      // Array path — find the array, then emit per-index flat paths.
      // Only supports one level of `[]` per translatable-field declaration
      // (matches the spec; `items[].children[].label` is left for the nav
      // editor's custom flow).
      const [head, tail] = schemaPath.split('[].');
      const arrayValue = getByPath(source, head);
      if (!Array.isArray(arrayValue)) continue;
      const leafFieldLabel = tail.split('.').pop() || tail;
      for (let i = 0; i < arrayValue.length; i++) {
        const flatPath = `${head}.${i}.${tail}`;
        const sourceValue = getByPath(source, flatPath);
        out.push({
          path: flatPath,
          schemaPath,
          groupLabel: `Item ${i + 1}`,
          label: leafFieldLabel,
          source: typeof sourceValue === 'string' ? sourceValue : '',
        });
      }
    } else {
      const sourceValue = getByPath(source, schemaPath);
      out.push({
        path: schemaPath,
        schemaPath,
        label: schemaPath,
        source: typeof sourceValue === 'string' ? sourceValue : '',
      });
    }
  }
  return out;
}

function configFromTranslations(fields: FlatField[], values: Record<string, string>): Record<string, unknown> {
  // Build a sparse JSONB blob containing only the translated fields.
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.path];
    if (typeof value === 'string' && value.trim().length > 0) {
      setByPath(out, field.path, value);
    }
  }
  return out;
}

export function BlockTranslationEditor({
  open,
  onOpenChange,
  sectionId,
  blockLabel,
  locale,
  translatableFields,
  sourceConfig,
}: BlockTranslationEditorProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flatFields = useMemo(
    () => expandFields(sourceConfig, translatableFields),
    [sourceConfig, translatableFields],
  );

  // Load existing translation rows when the dialog opens.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    setAiBusy(false);
    void (async () => {
      try {
        const res = (await queryOp('sections.getTranslation', {
          section_id: sectionId,
          language: locale,
        })) as { translation?: { config?: Record<string, unknown> } | null } | null;
        const existing = res?.translation?.config ?? {};
        const seeded: Record<string, string> = {};
        for (const field of flatFields) {
          const value = getByPath(existing, field.path);
          if (typeof value === 'string') seeded[field.path] = value;
        }
        setValues(seeded);
      } catch (err) {
        console.warn('sections.getTranslation failed', err);
        setValues({});
      }
    })();
  }, [open, sectionId, locale, flatFields]);

  const handleSave = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const partialConfig = configFromTranslations(flatFields, values);
      // execOp's input is JsonObject; partialConfig is JSON-valued but the
      // type-checker can't prove it without a structural narrow. Cast at
      // the boundary — the gateway re-validates shape on receipt.
      await execOp(
        'sections.translate',
        {
          section_id: sectionId,
          language: locale,
          config: partialConfig,
        } as unknown as JsonObject,
      );
      toast.success(`Saved ${localeLabel(locale)} translation`);
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err ?? 'Save failed'));
      setBusy(false);
    }
  }, [flatFields, values, sectionId, locale, onOpenChange]);

  const handleAiFill = useCallback(async () => {
    setAiBusy(true);
    setError(null);
    try {
      // translate-text edge function exists; call it once per field. This
      // could be batched in a single platform AI call (run402#398 family),
      // but for an MVP per-field calls work — the field count is small
      // (max ~10 for a typical block).
      const next: Record<string, string> = { ...values };
      for (const field of flatFields) {
        if (!field.source) continue;
        try {
          const res = (await execOp('translations.translateText', {
            text: field.source,
            target_lang: locale,
          })) as { translatedText?: string; translated?: string } | null;
          const translated = res?.translatedText || res?.translated;
          if (typeof translated === 'string') next[field.path] = translated;
        } catch (perFieldErr) {
          console.warn(`AI translate failed for ${field.path}`, perFieldErr);
        }
      }
      setValues(next);
      toast.success('Filled with AI — review and save when ready.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err ?? 'AI translate failed'));
    } finally {
      setAiBusy(false);
    }
  }, [flatFields, values, locale]);

  // Group fields by their `groupLabel` so item-array rendering is clean.
  const grouped = useMemo(() => {
    const map = new Map<string, FlatField[]>();
    for (const field of flatFields) {
      const key = field.groupLabel || '__root__';
      const bucket = map.get(key);
      if (bucket) bucket.push(field);
      else map.set(key, [field]);
    }
    return Array.from(map.entries());
  }, [flatFields]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Translate: {blockLabel}</DialogTitle>
          <DialogDescription>
            Editing {localeLabel(locale)} translation. Empty fields fall back to the source content.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-2">
          {flatFields.length === 0 ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">
              This block has no translatable fields.
            </p>
          ) : (
            <div className="grid gap-4">
              {grouped.map(([groupKey, fields]) => (
                <section key={groupKey} className="grid gap-3">
                  {groupKey !== '__root__' ? (
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {groupKey}
                    </h3>
                  ) : null}
                  {fields.map((field) => (
                    <div key={field.path} className="grid grid-cols-2 gap-4 border-b border-border/50 pb-3 last:border-b-0">
                      <div>
                        <Label className="text-xs text-muted-foreground">{field.label}</Label>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                          {field.source || <em>(no source value)</em>}
                        </p>
                      </div>
                      <div>
                        <Label htmlFor={`tx-${field.path}`} className="text-xs">
                          {localeLabel(locale)}
                        </Label>
                        <Textarea
                          id={`tx-${field.path}`}
                          value={values[field.path] ?? ''}
                          onChange={(event) =>
                            setValues((prev) => ({ ...prev, [field.path]: event.target.value }))
                          }
                          placeholder={field.source}
                          className="mt-1 min-h-[60px] resize-none text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          )}
        </ScrollArea>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleAiFill} disabled={aiBusy || busy || flatFields.length === 0}>
            {aiBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Translate with AI
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy || flatFields.length === 0}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Save {localeLabel(locale)} translation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BlockTranslationEditor;
