'use client';

import { Download, File, FileImage, FileText, LinkIcon, Loader2, Lock, Trash2, Upload, Video } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { del, getResources, post } from '@/lib/api';
import { getSession, isAdmin, isAuthenticated } from '@/lib/auth';
import { openAuthModal } from '@/lib/auth-modal-events';
import { refreshMemberRecord, translateItems } from '@/lib/config';
import { uploadFileContentAddressed } from '@/lib/storage-upload';
import { showToast } from '@/lib/toast-events';
import type { Resource } from '@/schemas/content';

const ALL_CATEGORIES = 'all';
const RESOURCE_TYPES = [
  { value: 'pdf', label: 'PDF' },
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Image' },
  { value: 'link', label: 'Link / URL' },
] as const;

type ResourceType = (typeof RESOURCE_TYPES)[number]['value'];

interface UploadFormState {
  title: string;
  description: string;
  category: string;
  fileType: ResourceType;
  fileUrl: string;
  isMembersOnly: boolean;
}

const EMPTY_UPLOAD_FORM: UploadFormState = {
  title: '',
  description: '',
  category: '',
  fileType: 'pdf',
  fileUrl: '',
  isMembersOnly: true,
};

function resourceIcon(type: string | null | undefined) {
  if (type === 'pdf') return FileText;
  if (type === 'video') return Video;
  if (type === 'image') return FileImage;
  if (type === 'link') return LinkIcon;
  return File;
}

function categoryLabel(value: string | null | undefined): string {
  return String(value || '').trim();
}

async function uploadResourceFile(file: File): Promise<string> {
  const { url } = await uploadFileContentAddressed(file, {
    keyPrefix: 'resources',
    authToken: getSession()?.access_token,
  });
  return url;
}

export default function ResourcesPageApp() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [admin, setAdmin] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState<UploadFormState>(EMPTY_UPLOAD_FORM);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Resource | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadResources() {
    setLoading(true);
    setError('');
    try {
      const rows = await getResources('order=created_at.desc');
      const translated = await translateItems('resource', rows, ['title', 'description']);
      setResources(translated as Resource[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load resources.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      await refreshMemberRecord();
      if (cancelled) return;
      setAuthenticated(isAuthenticated());
      setAdmin(isAdmin());
      await loadResources();
      if (cancelled) return;
      const urlCategory = new URLSearchParams(window.location.search).get('category');
      if (urlCategory) setCategory(urlCategory);
    }

    void load();
    document.addEventListener('wl-auth-changed', load);
    document.addEventListener('wl-locale-changed', load);
    return () => {
      cancelled = true;
      document.removeEventListener('wl-auth-changed', load);
      document.removeEventListener('wl-locale-changed', load);
    };
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(resources.map((resource) => categoryLabel(resource.category)).filter(Boolean))).sort(),
    [resources],
  );

  const categoryFilteredResources = useMemo(
    () => resources.filter((resource) => category === ALL_CATEGORIES || categoryLabel(resource.category) === category),
    [resources, category],
  );

  const visibleResources = useMemo(
    () => categoryFilteredResources.filter((resource) => authenticated || !resource.is_members_only),
    [authenticated, categoryFilteredResources],
  );

  const hasHiddenMembersOnlyResources = categoryFilteredResources.length > 0 && visibleResources.length === 0 && !authenticated;

  function resetUpload() {
    setUploadForm(EMPTY_UPLOAD_FORM);
    setUploadFile(null);
  }

  async function submitUpload(event: { preventDefault(): void }) {
    event.preventDefault();
    setUploading(true);

    try {
      let fileUrl = uploadForm.fileUrl.trim();
      if (uploadForm.fileType !== 'link') {
        if (!uploadFile) throw new Error('Choose a file to upload.');
        fileUrl = await uploadResourceFile(uploadFile);
      }

      await post('resources', {
        title: uploadForm.title,
        description: uploadForm.description,
        category: uploadForm.category,
        file_type: uploadForm.fileType,
        file_url: fileUrl,
        is_members_only: uploadForm.isMembersOnly,
      });

      await loadResources();
      setUploadOpen(false);
      resetUpload();
      showToast('Resource uploaded', 'success');
    } catch (uploadError) {
      showToast(uploadError instanceof Error ? uploadError.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await del(`resources?id=eq.${deleteTarget.id}`);
      setResources((current) => current.filter((resource) => resource.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast('Resource deleted', 'success');
    } catch (deleteError) {
      showToast(deleteError instanceof Error ? deleteError.message : 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Resources</h2>
          <p className="text-sm text-muted-foreground">Browse documents, links, videos, and shared files.</p>
        </div>
        {admin ? (
          <Button type="button" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" />
            Upload Resource
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={category} onValueChange={setCategory} name="resource_category_filter">
          <SelectTrigger id="res-category-filter" className="sm:w-56" aria-label="Filter by category">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>All Categories</SelectItem>
            {categories.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {category !== ALL_CATEGORIES ? (
          <Button type="button" variant="ghost" onClick={() => setCategory(ALL_CATEGORIES)}>
            Clear
          </Button>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 p-5">
                <div className="h-5 w-3/4 rounded bg-muted" />
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="h-8 w-24 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && hasHiddenMembersOnlyResources ? (
        <Card className="mx-auto max-w-lg text-center" role="status" aria-live="polite">
          <CardHeader className="items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle>Sign in to view resources</CardTitle>
            <CardDescription>These resources are available to signed-in members.</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button type="button" onClick={(event) => openAuthModal({ trigger: event.currentTarget })}>
              Sign in
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {!loading && !hasHiddenMembersOnlyResources && visibleResources.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">No resources yet.</CardContent>
        </Card>
      ) : null}

      {!loading && visibleResources.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleResources.map((resource) => {
            const Icon = resourceIcon(resource.file_type);
            const label = categoryLabel(resource.category);
            return (
              <Card key={resource.id} id={`resource-${resource.id}`}>
                <CardHeader className="flex-row items-start gap-3 space-y-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <CardTitle className="text-base tracking-normal">{resource.title}</CardTitle>
                    <div className="flex flex-wrap gap-1">
                      {label ? <Badge variant="secondary">{label}</Badge> : null}
                      {resource.is_members_only ? <Badge variant="outline">Members Only</Badge> : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {resource.description ? (
                    <CardDescription className="line-clamp-3">{resource.description}</CardDescription>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {resource.file_url ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={resource.file_url} target="_blank" rel="noreferrer">
                          <Download className="h-4 w-4" />
                          Download
                        </a>
                      </Button>
                    ) : null}
                    {admin ? (
                      <Button type="button" size="sm" variant="destructive" onClick={() => setDeleteTarget(resource)}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      <Dialog open={uploadOpen} onOpenChange={(open) => {
        setUploadOpen(open);
        if (!open) resetUpload();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Resource</DialogTitle>
            <DialogDescription>Add a document, image, video, or link for members.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitUpload}>
            <div className="space-y-2">
              <Label htmlFor="rf-title">Title</Label>
              <Input
                id="rf-title"
                name="title"
                value={uploadForm.title}
                onChange={(event) => setUploadForm((form) => ({ ...form, title: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rf-description">Description</Label>
              <Textarea
                id="rf-description"
                name="description"
                rows={2}
                value={uploadForm.description}
                onChange={(event) => setUploadForm((form) => ({ ...form, description: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rf-category">Category</Label>
              <Input
                id="rf-category"
                name="category"
                placeholder="e.g. Guides, Templates"
                value={uploadForm.category}
                onChange={(event) => setUploadForm((form) => ({ ...form, category: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rf-type">Type</Label>
              <Select
                value={uploadForm.fileType}
                onValueChange={(value: ResourceType) => setUploadForm((form) => ({ ...form, fileType: value }))}
                name="file_type"
              >
                <SelectTrigger id="rf-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {uploadForm.fileType === 'link' ? (
              <div className="space-y-2">
                <Label htmlFor="rf-url">URL</Label>
                <Input
                  id="rf-url"
                  name="url"
                  type="url"
                  placeholder="https://..."
                  value={uploadForm.fileUrl}
                  onChange={(event) => setUploadForm((form) => ({ ...form, fileUrl: event.target.value }))}
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="rf-file">File</Label>
                <Input
                  id="rf-file"
                  name="file"
                  type="file"
                  onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                  required
                />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                id="rf-members-only"
                checked={uploadForm.isMembersOnly}
                onCheckedChange={(checked) => setUploadForm((form) => ({ ...form, isMembersOnly: checked === true }))}
              />
              Members only
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Upload
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete resource?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? `This will remove "${deleteTarget.title}" from the resource library.` : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
