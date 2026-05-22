'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '@/components/kychon/ui';

import { Button } from "@/components/kychon/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/kychon/ui";
import { Label } from "@/components/kychon/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/kychon/ui";
import { execOp } from '@/lib/api';
import { LOCALE_LABELS } from '@/lib/locale-pool';

interface AddLanguageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Locales already enabled in `site_config.languages_enabled`. */
  currentLocales: readonly string[];
  /** The 50-entry pool the gateway accepts. */
  pool: readonly string[];
  /** Called with the new locale code after a successful UPSERT. */
  onAdded: (code: string) => void;
}

export function AddLanguageDialog({
  open,
  onOpenChange,
  currentLocales,
  pool,
  onAdded,
}: AddLanguageDialogProps) {
  const [selected, setSelected] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on open so the dialog never carries state across sessions.
  useEffect(() => {
    if (open) {
      setSelected('');
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const availableOptions = useMemo(() => {
    const already = new Set(currentLocales);
    return pool.filter((code) => !already.has(code));
  }, [pool, currentLocales]);

  const handleAdd = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      // Runtime-only mutation: UPSERT the languages_enabled site_config row.
      // No deploy required because the gateway already accepts every pool
      // locale via spec.i18n.locales (Decision 9 kitchen-sink).
      const nextLocales = [...currentLocales, selected];
      await execOp('config.set', {
        key: 'languages_enabled',
        value: nextLocales,
        category: 'i18n',
      });
      // Refresh the cached site_config so the AdminBar's reactive read picks
      // up the new entry on next render without a hard reload.
      document.dispatchEvent(new CustomEvent('wl-config-changed'));
      toast.success(`Added ${LOCALE_LABELS[selected] ?? selected}. No deploy needed.`);
      onAdded(selected);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err ?? 'Add language failed'));
      setBusy(false);
    }
  }, [selected, currentLocales, onAdded]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add language</DialogTitle>
          <DialogDescription>
            Members will be able to switch to this language. Content can be translated block by
            block or with AI. No deploy required.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <Label htmlFor="add-language-select">Language</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger id="add-language-select">
              <SelectValue placeholder="Select a language…" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {availableOptions.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">
                  All pool locales are already enabled.
                </div>
              ) : (
                availableOptions.map((code) => (
                  <SelectItem key={code} value={code}>
                    {LOCALE_LABELS[code] ?? code}
                    <span className="ml-2 text-xs text-muted-foreground">{code}</span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!selected || busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Add language
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
