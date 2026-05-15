'use client';

import { Alert, AlertDescription, Card, CardContent } from '@/components/kychon/ui';
import { get } from '@/lib/api';
import { isAdmin, isAuthenticated } from '@/lib/auth';
import { resolveCustomPageSlugFromLocation } from '@/lib/clean-routes';
import { ready, translateItems } from '@/lib/config';
import { sanitizeRichHtml } from '@/lib/sanitize-html';
import type { Page } from '@/schemas/content';
import { useCallback, useEffect, useMemo, useState } from 'react';

function currentSlug(): string | null {
  if (typeof window === 'undefined') return null;
  return resolveCustomPageSlugFromLocation(window.location.pathname, window.location.search);
}

function PageSkeleton() {
  return (
    <div className="space-y-4" role="status">
      <div className="h-10 w-56 rounded-md bg-muted" />
      <div className="space-y-2">
        <div className="h-4 rounded-md bg-muted" />
        <div className="h-4 w-5/6 rounded-md bg-muted" />
        <div className="h-4 w-2/3 rounded-md bg-muted" />
      </div>
    </div>
  );
}

export default function CustomPageApp() {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [admin, setAdmin] = useState(false);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    setPage(null);
    try {
      await ready;
      const slug = currentSlug();
      setAdmin(isAdmin());
      if (!slug) {
        setNotFound(true);
        return;
      }

      const rows = (await get(`pages?slug=eq.${encodeURIComponent(slug)}&published=eq.true&limit=1`)) as Page[];
      if (!rows.length) {
        setNotFound(true);
        return;
      }

      const [translated] = (await translateItems('page', [rows[0]], ['title', 'content'])) as Page[];
      if (translated.requires_auth && !isAuthenticated()) {
        window.location.assign('/');
        return;
      }

      document.title = translated.title;
      setPage(translated);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error loading page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage();
    document.addEventListener('astro:after-swap', loadPage);
    document.addEventListener('wl-locale-changed', loadPage);
    document.addEventListener('wl-auth-changed', loadPage);
    return () => {
      document.removeEventListener('astro:after-swap', loadPage);
      document.removeEventListener('wl-locale-changed', loadPage);
      document.removeEventListener('wl-auth-changed', loadPage);
    };
  }, [loadPage]);

  const contentHtml = useMemo(() => sanitizeRichHtml(page?.content), [page?.content]);

  if (loading) return <PageSkeleton />;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (notFound || !page) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">Page not found.</CardContent>
      </Card>
    );
  }

  return (
    <article className="space-y-6">
      <h1 className="break-words text-4xl font-semibold tracking-normal" data-editable={admin ? `pages.${page.id}.title` : undefined}>
        {page.title}
      </h1>
      {contentHtml ? (
        <div
          className="max-w-none break-words leading-7 text-foreground [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
          data-editable-rich={admin ? `pages.${page.id}.content` : undefined}
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      ) : null}
    </article>
  );
}
