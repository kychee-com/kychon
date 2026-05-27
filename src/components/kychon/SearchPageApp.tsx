'use client';

import { Loader2, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  Input,
  Label,
} from '@/components/kychon/ui';
import { searchSite } from '@/lib/api';
import type { SearchFacets, SearchResponse, SearchType } from '@/lib/search';

const TYPE_LABELS: Record<string, string> = {
  all: 'All',
  pages: 'Pages',
  resources: 'Resources',
  events: 'Events',
  page: 'Page',
  resource: 'Resource',
  event: 'Event',
};
const FILTERS: SearchType[] = ['all', 'pages', 'resources', 'events'];
const DEFAULT_PARAMS: SearchParams = { q: '', type: 'all', page: 1 };

interface SearchParams {
  q: string;
  type: SearchType;
  page: number;
}

function normalizeType(value: string | null): SearchType {
  return FILTERS.includes(value as SearchType) ? (value as SearchType) : 'all';
}

function readParams(): SearchParams {
  const params = new URLSearchParams(window.location.search);
  return {
    q: (params.get('q') || '').trim(),
    type: normalizeType(params.get('type')),
    page: Math.max(1, Number(params.get('page') || '1') || 1),
  };
}

function buildUrl(next: { q: string; type: SearchType; page?: number }): string {
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  params.set('type', next.type || 'all');
  if (next.page && next.page > 1) params.set('page', String(next.page));
  return `/search?${params.toString()}`;
}

function emptyResponse({ q, type, page }: SearchParams): SearchResponse {
  return {
    query: q,
    type,
    page,
    page_size: 10,
    total: 0,
    has_next: false,
    facets: { all: 0, pages: 0, resources: 0, events: 0 },
    results: [],
  };
}

function facetCount(facets: SearchFacets | undefined, type: SearchType): number {
  return facets?.[type] ?? 0;
}

interface SearchPageAppProps {
  /**
   * Pre-fetched search response from the per-request SSR pass — see
   * `src/lib/ssr-api.ts:ssrSearchQuery` + `search.astro`. Seeds
   * `useState` so the React island's first render matches the SSR
   * HTML byte-for-byte: no skeleton, no "searching…" flash between
   * hydration and the post-mount fetch. Background `useEffect` still
   * re-fetches on URL change (typing pushes new history entries that
   * trigger a refetch).
   *
   * `initialParams` carries the `?q=/?type=/?page=` the server
   * resolved from `Astro.request.url` so React's initial state
   * matches the SSR HTML without reading `window.location` until
   * after hydration.
   */
  initialResponse?: SearchResponse;
  initialParams?: SearchParams;
}

export default function SearchPageApp({ initialResponse, initialParams }: SearchPageAppProps = {}) {
  const [params, setParams] = useState<SearchParams>(() => initialParams ?? DEFAULT_PARAMS);
  const [draft, setDraft] = useState(params.q);
  const [response, setResponse] = useState<SearchResponse>(
    () => initialResponse ?? emptyResponse(params),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Track whether the initial render came from SSR so the first
  // useEffect run can skip the redundant refetch. useRef so it
  // doesn't pull into the effect dep array — the effect still
  // re-runs on `params` changes (typing, navigation), it just
  // short-circuits its first run when SSR primed the state.
  const ssrPrimeRef = useRef(Boolean(initialResponse));

  useEffect(() => {
    setDraft(params.q);
  }, [params.q]);

  useEffect(() => {
    const syncFromLocation = () => setParams(readParams());
    syncFromLocation();
    window.addEventListener('popstate', syncFromLocation);
    document.addEventListener('astro:after-swap', syncFromLocation);
    document.addEventListener('wl-auth-changed', syncFromLocation);
    return () => {
      window.removeEventListener('popstate', syncFromLocation);
      document.removeEventListener('astro:after-swap', syncFromLocation);
      document.removeEventListener('wl-auth-changed', syncFromLocation);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError('');

    if (!params.q) {
      setResponse(emptyResponse({ ...params, page: 1 }));
      setLoading(false);
      return;
    }

    // Skip the first refetch when SSR primed the response — it's
    // already the freshest the server could produce. Mark consumed
    // so subsequent params changes still trigger refetch.
    if (ssrPrimeRef.current) {
      ssrPrimeRef.current = false;
      setLoading(false);
      return;
    }

    setLoading(true);
    searchSite({ q: params.q, type: params.type, page: params.page, page_size: 10 })
      .then((next) => {
        if (cancelled) return;
        setResponse(next);
      })
      .catch((searchError) => {
        if (cancelled) return;
        setError(searchError instanceof Error ? searchError.message : 'Search is unavailable right now.');
        setResponse(emptyResponse(params));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params]);

  const countLabel = useMemo(() => {
    if (!response.query || !response.results.length) return '';
    return response.total === 1 ? '1 result' : `${response.total} results`;
  }, [response]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <form action="/search" method="get" role="search" className="space-y-2">
        <Label htmlFor="search-page-q">
          Search
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="search-page-q"
            name="q"
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={300}
            autoComplete="off"
            placeholder="Search this site"
            className="min-w-0 flex-1"
          />
          <Input id="search-page-type-input" name="type" readOnly type="hidden" value={params.type} />
          <Button type="submit">
            <Search className="h-4 w-4" />
            Search
          </Button>
        </div>
      </form>

      <nav className="flex flex-wrap gap-2" aria-label="Search result type">
        {FILTERS.map((type) => {
          const active = type === params.type;
          return (
            <Button key={type} asChild variant={active ? 'default' : 'outline'} size="sm">
              <a href={buildUrl({ q: params.q, type })} aria-current={active ? 'page' : undefined}>
                {TYPE_LABELS[type]}
                <Badge variant={active ? 'secondary' : 'outline'} className="ml-1">
                  {facetCount(response.facets, type)}
                </Badge>
              </a>
            </Button>
          );
        })}
      </nav>

      <div className="min-h-6 text-sm text-muted-foreground" aria-live="polite">
        {loading ? 'Searching...' : countLabel ? (
          <>
            {countLabel} for <strong className="font-medium text-foreground">{response.query}</strong>
          </>
        ) : !response.query ? null : (
          'No results'
        )}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3">
        {!response.query && !loading ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Enter a search term to find pages, resources, and events.
            </CardContent>
          </Card>
        ) : null}

        {response.query && !loading && !response.results.length ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No visible results matched your search.
            </CardContent>
          </Card>
        ) : null}

        {loading ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching
            </CardContent>
          </Card>
        ) : null}

        {!loading
          ? response.results.map((result) => (
              <Card key={`${result.type}:${result.id}`}>
                <CardHeader className="space-y-2 p-5 pb-2">
                  <Badge variant="outline" className="w-fit">
                    {TYPE_LABELS[result.type] || result.type}
                  </Badge>
                  <CardTitle className="text-xl tracking-normal">
                    <a className="text-primary underline-offset-4 hover:underline" href={result.url}>
                      {result.title}
                    </a>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  {result.snippet ? (
                    <CardDescription
                      className="text-sm leading-6 [&_mark]:rounded-sm [&_mark]:bg-primary/20 [&_mark]:px-0.5 [&_mark]:text-foreground"
                      dangerouslySetInnerHTML={{ __html: result.snippet }}
                    />
                  ) : null}
                  <a className="mt-3 block truncate text-xs text-muted-foreground hover:text-foreground" href={result.url}>
                    {result.url}
                  </a>
                </CardContent>
              </Card>
            ))
          : null}
      </div>

      {response.query && (params.page > 1 || response.has_next) ? (
        <nav className="flex items-center justify-center gap-3 pt-2" aria-label="Search pagination">
          {params.page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <a href={buildUrl({ q: response.query, type: response.type, page: params.page - 1 })}>Previous</a>
            </Button>
          ) : null}
          <span className="text-sm text-muted-foreground">Page {params.page}</span>
          {response.has_next ? (
            <Button asChild variant="outline" size="sm">
              <a href={buildUrl({ q: response.query, type: response.type, page: params.page + 1 })}>Next</a>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
