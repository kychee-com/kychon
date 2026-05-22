'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from "@/components/kychon/ui";
import { Checkbox } from "@/components/kychon/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/kychon/ui";
import { Input } from "@/components/kychon/ui";
import { Label } from "@/components/kychon/ui";
import { execOp } from '@/lib/api';
import { toast } from '@/components/kychon/ui';

interface PageRow {
  id: number;
  slug: string;
  title: string;
  show_in_nav?: boolean;
  requires_auth?: boolean;
}

interface PageCreatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (slug: string) => void;
}

function autoSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

export function PageCreatorDialog({ open, onOpenChange, onCreated }: PageCreatorDialogProps) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [showInNav, setShowInNav] = useState(true);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when the dialog opens.
  useEffect(() => {
    if (open) {
      setTitle('');
      setSlug('');
      setSlugTouched(false);
      setShowInNav(true);
      setRequiresAuth(false);
      setBusy(false);
      setError(null);
    }
  }, [open]);

  // Auto-generate slug from title until the user edits the slug manually.
  useEffect(() => {
    if (!slugTouched) setSlug(autoSlug(title));
  }, [title, slugTouched]);

  const handleCreate = useCallback(async () => {
    if (!slug) {
      setError('Slug cannot be empty.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await execOp('pages.create', {
        title: title || slug,
        slug,
        show_in_nav: showInNav,
        requires_auth: requiresAuth,
      });
      if (result?.nav_not_found) {
        toast.message('Page created — add it to your navigation manually.', {
          description: 'No global navigation block was found to auto-insert into.',
        });
      } else if (showInNav && result?.nav_inserted) {
        toast.success('Page created and added to navigation.');
      } else {
        toast.success('Page created.');
      }
      onCreated(result?.slug ?? slug);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err ?? 'Create failed');
      // The server returns conflict.state for slug collisions; suggest a fix.
      if (/conflict/i.test(message) || /slug/i.test(message)) {
        setError(`This slug may be taken. Try a variation (e.g. "${slug}-2").`);
      } else {
        setError(message);
      }
      setBusy(false);
    }
  }, [slug, title, showInNav, requiresAuth, onCreated]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Page</DialogTitle>
          <DialogDescription>
            Pages start as a blank canvas. Add blocks once you’ve created the page.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="new-page-title">Title</Label>
            <Input
              id="new-page-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="About Our Club"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-page-slug">URL slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/</span>
              <Input
                id="new-page-slug"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(autoSlug(event.target.value));
                }}
                placeholder="about-our-club"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="new-page-show-in-nav"
              checked={showInNav}
              onCheckedChange={(checked) => setShowInNav(checked === true)}
            />
            <Label htmlFor="new-page-show-in-nav" className="font-normal">
              Add to navigation
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="new-page-requires-auth"
              checked={requiresAuth}
              onCheckedChange={(checked) => setRequiresAuth(checked === true)}
            />
            <Label htmlFor="new-page-requires-auth" className="font-normal">
              Members only
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!slug || busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Create Page →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PageDeleteDialogProps {
  page: PageRow | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function PageDeleteDialog({ page, onOpenChange, onDeleted }: PageDeleteDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (page) {
      setBusy(false);
      setError(null);
    }
  }, [page]);

  const handleDelete = useCallback(async () => {
    if (!page) return;
    setBusy(true);
    try {
      const result = await execOp('pages.delete', { id: page.id, slug: page.slug });
      const cascaded = result?.cascaded_sections;
      if (typeof cascaded === 'number' && cascaded > 0) {
        toast.success(
          `Deleted "${page.title || page.slug}". Removed ${cascaded} ${cascaded === 1 ? 'block' : 'blocks'}.`,
        );
      } else {
        toast.success(`Deleted "${page.title || page.slug}".`);
      }
      onDeleted();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err ?? 'Delete failed'));
      setBusy(false);
    }
  }, [page, onDeleted]);

  const open = page !== null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete "{page?.title || page?.slug}"?</DialogTitle>
          <DialogDescription>
            This will permanently delete the page and all its blocks.
            {page?.show_in_nav ? ' It will also be removed from the navigation.' : ''} This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Delete page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
