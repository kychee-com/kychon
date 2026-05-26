'use client';

import { Check, Loader2, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@/components/kychon/ui';

import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, ScrollArea } from "@/components/kychon/ui";
import { execOp, queryOp } from '@/lib/api';
import { uploadFileContentAddressed } from '@/lib/storage-upload';

/**
 * MediaPicker — Dialog for selecting (or uploading) an image asset.
 *
 * admin-content-management Decision 3: assets live in Run402's
 * `internal.blobs` (v1.50). The picker shows thumbnails from
 * `variants.thumb.cdn_url` when available, falling back to the original
 * `cdn_url` for assets below the 320 px variant threshold or pre-v1.49
 * uploads. The "Use this image →" callback receives the FULL AssetRef
 * (Decision 8) — callers persist it into block configs as a structured
 * object, not just a URL string.
 */

export interface MediaAssetRef {
  key: string;
  cdn_url: string;
  cdn_immutable_url?: string;
  immutable_url?: string;
  width_px?: number;
  height_px?: number;
  size_bytes?: number;
  content_type?: string;
  image_format?: string;
  blurhash?: string;
  /** v1.51: pre-decoded blurhash PNG data URL emitted by the upload pipeline.
   *  Used by `<Run402Image>` for the placeholder; surfaced here so admins
   *  can verify it landed (a missing value triggers strict-mode warnings). */
  blurhash_data_url?: string | null;
  /** v1.51: gateway shape stamp. `"v1.49" | "v1.50" | "v1.54" | null`.
   *  `null` for sub-threshold uploads (correctly unstamped per spec). */
  asset_schema?: 'v1.49' | 'v1.50' | 'v1.54' | null;
  /** v1.50: image-intrinsic facts the gateway extracts at upload time. */
  image_info?: {
    color_space?: string | null;
    has_alpha?: boolean | null;
    bit_depth?: number | null;
  } | null;
  metadata?: {
    filename?: string;
    uploaded_by?: string;
    [key: string]: unknown;
  } | null;
  variants?: {
    thumb?: { cdn_url: string; width_px?: number; height_px?: number; format?: string };
    medium?: { cdn_url: string; width_px?: number; height_px?: number; format?: string };
    large?: { cdn_url: string; width_px?: number; height_px?: number; format?: string };
    display_jpeg?: { cdn_url: string; width_px?: number; height_px?: number; format?: string };
  };
}

interface MediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the full AssetRef when the admin confirms a selection. */
  onSelect: (ref: MediaAssetRef) => void;
}

interface MediaListResponse {
  assets?: MediaAssetRef[];
  nextCursor?: string | null;
}

function thumbUrl(asset: MediaAssetRef): string {
  return asset.variants?.thumb?.cdn_url || asset.cdn_url;
}

function previewLabel(asset: MediaAssetRef): string {
  return asset.metadata?.filename || asset.key.split('/').pop() || asset.key;
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaPicker({ open, onOpenChange, onSelect }: MediaPickerProps) {
  const [assets, setAssets] = useState<MediaAssetRef[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<MediaAssetRef | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ inUse: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await queryOp('media.list')) as MediaListResponse | null;
      const rows = res?.assets ?? [];
      setAssets(rows);
      setCursor(res?.nextCursor ?? null);
    } catch (err) {
      console.warn('media.list failed', err);
      toast.error('Failed to load media library.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setLoading(true);
    try {
      const res = (await queryOp('media.list', { cursor })) as MediaListResponse | null;
      const rows = res?.assets ?? [];
      setAssets((prev) => [...prev, ...rows]);
      setCursor(res?.nextCursor ?? null);
    } catch (err) {
      console.warn('media.list (next) failed', err);
      toast.error('Failed to load more.');
    } finally {
      setLoading(false);
    }
  }, [cursor]);

  // Reset + load on every open.
  useEffect(() => {
    if (open) {
      setSelected(null);
      setConfirmDelete(null);
      void loadFirst();
    }
  }, [open, loadFirst]);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      // Reuse the existing content-addressed upload helper; it base64-encodes
      // the bytes and posts to `upload-asset` with `{ file, path }`. The
      // refactored upload-asset.js threads metadata + exifPolicy server-side
      // and returns the full v1.50 AssetRef as `ref` in the response payload.
      const result = await uploadFileContentAddressed(file, { keyPrefix: 'assets' });
      const ref = (result?.ref ?? null) as MediaAssetRef | null;
      if (ref) {
        setAssets((prev) => [ref, ...prev]);
        setSelected(ref);
        toast.success('Uploaded.');
      } else {
        toast.error('Upload succeeded but no asset metadata was returned.');
      }
    } catch (err) {
      console.warn('upload failed', err);
      toast.error(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      const probe = await execOp('media.delete', {
        path: selected.key.replace(/^assets\//, ''),
        cdn_url: selected.cdn_url,
        confirmed: confirmDelete !== null,
      });
      if (probe?.status === 'pending_confirmation' && probe?.inUse) {
        setConfirmDelete({ inUse: true });
        setDeleting(false);
        return;
      }
      setAssets((prev) => prev.filter((a) => a.key !== selected.key));
      setSelected(null);
      setConfirmDelete(null);
      toast.success('Image deleted.');
    } catch (err) {
      console.warn('delete failed', err);
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }, [selected, confirmDelete]);

  const handleUseSelected = useCallback(() => {
    if (!selected) return;
    onSelect(selected);
    onOpenChange(false);
  }, [selected, onSelect, onOpenChange]);

  const selectedPreviewSrc = useMemo(
    () => selected?.variants?.medium?.cdn_url || selected?.cdn_url || '',
    [selected],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Choose an image</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_280px] divide-x">
          {/* Library grid */}
          <ScrollArea className="h-[420px] p-4">
            {loading && assets.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Loading library…
              </div>
            ) : assets.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No images uploaded yet. Use the panel on the right to upload your first image.
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {assets.map((asset) => {
                  const isSelected = selected?.key === asset.key;
                  return (
                    <Button
                      key={asset.key}
                      type="button"
                      variant="ghost"
                      onClick={() => setSelected(asset)}
                      className={[
                        'group relative h-auto w-full overflow-hidden rounded-md border-2 p-0 transition-colors',
                        'aspect-square',
                        isSelected ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30',
                      ].join(' ')}
                      title={previewLabel(asset)}
                    >
                      <img
                        src={thumbUrl(asset)}
                        alt={previewLabel(asset)}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      {isSelected ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                          <Check className="h-6 w-6 text-primary" aria-hidden="true" />
                        </div>
                      ) : null}
                    </Button>
                  );
                })}
              </div>
            )}
            {cursor ? (
              <Button
                variant="ghost"
                className="mt-4 w-full"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                Load more
              </Button>
            ) : null}
          </ScrollArea>

          {/* Upload / preview pane */}
          <div className="flex flex-col gap-3 p-4">
            {selected === null ? (
              <Label
                className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 px-4 text-center transition-colors hover:border-muted-foreground/50"
                htmlFor="media-picker-upload-input"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mb-2 h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm font-medium">Uploading…</span>
                  </>
                ) : (
                  <>
                    <Upload className="mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm font-medium">Upload new image</span>
                    <span className="text-xs text-muted-foreground">PNG, JPG, SVG, WebP</span>
                  </>
                )}
                <Input
                  ref={fileInputRef}
                  id="media-picker-upload-input"
                  type="file"
                  accept="image/*"
                  hidden
                  aria-hidden="true"
                  tabIndex={-1}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFile(file);
                    if (event.target) event.target.value = '';
                  }}
                />
              </Label>
            ) : (
              <div className="flex flex-1 flex-col gap-3">
                <img
                  src={selectedPreviewSrc}
                  alt={previewLabel(selected)}
                  className="aspect-video w-full rounded-md object-cover"
                />
                <div className="space-y-1 text-sm">
                  <p className="truncate font-medium">{previewLabel(selected)}</p>
                  {selected.width_px && selected.height_px ? (
                    <p className="text-xs text-muted-foreground">
                      {selected.width_px} × {selected.height_px} · {formatBytes(selected.size_bytes)}
                      {selected.image_format ? ` · ${selected.image_format.toUpperCase()}` : ''}
                    </p>
                  ) : null}
                  {/* v1.50/v1.54 image metadata — surfaced for admins so they can
                      spot non-sRGB color spaces (may render differently on
                      standard displays), alpha presence (matters when compositing
                      on dark backgrounds), and the shape-contract stamp (helps
                      diagnose strict-mode failures). Only renders when there's
                      something notable to show. */}
                  {(() => {
                    const info = selected.image_info;
                    const notes: string[] = [];
                    if (info?.color_space && info.color_space.toLowerCase() !== 'srgb') {
                      notes.push(info.color_space);
                    }
                    if (info?.has_alpha) {
                      notes.push('transparent');
                    }
                    if (selected.asset_schema && selected.asset_schema !== 'v1.54') {
                      notes.push(`shape ${selected.asset_schema}`);
                    }
                    if (!notes.length) return null;
                    return (
                      <p className="text-xs text-muted-foreground/80">
                        {notes.join(' · ')}
                      </p>
                    );
                  })()}
                </div>
                {confirmDelete ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                    <p className="mb-2 font-medium">This image may be in use on your site.</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={deleting}
                      >
                        {deleting ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
                        ) : null}
                        Delete anyway
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <X className="mr-1 h-3 w-3" aria-hidden="true" />
                    )}
                    Delete image
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUseSelected} disabled={!selected}>
            Use this image →
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
