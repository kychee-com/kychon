import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ExternalLink } from 'lucide-react';

import { Badge, Button, Card, CardContent } from '@/components/kychon/ui';
import { get } from '@/lib/api';
import { canonicalizeKychonHref } from '@/lib/clean-routes';
import { cn } from '@/lib/ui/cn';

type LinkListLayout = 'bullets' | 'rows' | 'compact';
type LinkListSource = 'manual' | 'resources';
type LinkListOrder = 'newest' | 'oldest' | 'title';

interface LinkListConfig {
  heading?: string;
  source?: LinkListSource;
  layout?: LinkListLayout;
  items?: unknown[];
  filter?: {
    category?: string;
    limit?: number;
    order?: LinkListOrder;
  };
}

interface LinkItem {
  id: string;
  badge: string;
  date: string;
  external: boolean;
  href: string;
  label: string;
}

interface LinkListProps {
  config: LinkListConfig;
  headingEditablePath?: string;
  onEmptyChange?: (empty: boolean) => void;
}

type LinkListState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'ready'; items: LinkItem[] };

const roots = new WeakMap<HTMLElement, Root>();
const ALLOWED_LAYOUTS = new Set<LinkListLayout>(['bullets', 'rows', 'compact']);
const ALLOWED_ORDERS = new Set<LinkListOrder>(['newest', 'oldest', 'title']);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function cleanHref(value: unknown, fallback = '#'): string {
  const href = String(value ?? '').trim() || fallback;
  return canonicalizeKychonHref(href);
}

function normalizeLayout(value: unknown): LinkListLayout {
  return ALLOWED_LAYOUTS.has(value as LinkListLayout) ? (value as LinkListLayout) : 'bullets';
}

function normalizeOrder(value: unknown): LinkListOrder {
  return ALLOWED_ORDERS.has(value as LinkListOrder) ? (value as LinkListOrder) : 'newest';
}

function manualItemToLinkItem(item: unknown, index: number): LinkItem {
  const source = item && typeof item === 'object' ? item as Record<string, unknown> : {};
  const href = cleanHref(source.href);
  const absoluteExternal = /^https?:\/\//i.test(href) && !href.startsWith(window.location.origin);
  return {
    id: String(source.id || `${href}-${index}`),
    badge: String(source.badge || '').trim(),
    date: String(source.date || '').trim(),
    external: Boolean(source.external) || absoluteExternal,
    href,
    label: String(source.label || source.title || href),
  };
}

function resourceToLinkItem(resource: Record<string, unknown>, index: number): LinkItem {
  const href = cleanHref(resource.file_url || resource.url);
  const fileType = String(resource.file_type || '').toLowerCase();
  const isPdf = fileType === 'pdf' || /\.pdf(\?|$)/i.test(href);
  const isExternal = /^https?:\/\//i.test(href) && !href.startsWith(window.location.origin);
  return {
    id: String(resource.id || `${href}-${index}`),
    badge: isPdf ? 'PDF' : resource.is_members_only ? 'MEMBERS' : '',
    date: resource.created_at ? formatDate(String(resource.created_at)) : '',
    external: isExternal,
    href,
    label: String(resource.title || href),
  };
}

function queryFromFilter(filter: LinkListConfig['filter']): string {
  const category = String(filter?.category || '').trim();
  const limit = Math.max(1, Math.min(50, Number(filter?.limit) || 6));
  const order = normalizeOrder(filter?.order);
  const orderParam = order === 'title' ? 'title.asc' : order === 'oldest' ? 'created_at.asc' : 'created_at.desc';
  const params: string[] = [];
  if (category) params.push(`category=eq.${encodeURIComponent(category)}`);
  params.push(`order=${orderParam}`);
  params.push(`limit=${limit}`);
  return params.join('&');
}

async function loadItems(config: LinkListConfig): Promise<LinkItem[]> {
  if ((config.source || 'manual') !== 'resources') {
    return (Array.isArray(config.items) ? config.items : []).map(manualItemToLinkItem);
  }

  const resources = await get(`resources?${queryFromFilter(config.filter)}`) as Record<string, unknown>[];
  return resources.map(resourceToLinkItem);
}

function LinkListIsland({ config, headingEditablePath, onEmptyChange }: LinkListProps) {
  const [state, setState] = React.useState<LinkListState>({ status: 'loading' });
  const layout = normalizeLayout(config.layout);
  const heading = String(config.heading || '').trim();

  React.useEffect(() => {
    let ignore = false;
    async function refresh(): Promise<void> {
      try {
        const items = await loadItems(config);
        if (ignore) return;
        setState(items.length > 0 ? { status: 'ready', items } : { status: 'empty' });
      } catch (error) {
        console.warn('link_list hydrate failed:', error);
        if (!ignore) setState({ status: 'empty' });
      }
    }
    void refresh();
    return () => {
      ignore = true;
    };
  }, [config]);

  React.useEffect(() => {
    onEmptyChange?.(state.status === 'empty');
  }, [onEmptyChange, state.status]);

  if (state.status === 'empty') {
    return <div data-link-list-empty="true" hidden />;
  }

  return (
    <div className="space-y-4" data-link-list>
      {heading && (
        <h2 className="text-2xl font-semibold tracking-normal" data-editable={headingEditablePath || undefined}>
          {heading}
        </h2>
      )}
      {state.status === 'loading' ? <LinkListLoading layout={layout} /> : <LinkListItems items={state.items} layout={layout} />}
    </div>
  );
}

function LinkListLoading({ layout }: { layout: LinkListLayout }) {
  const count = layout === 'compact' ? 4 : 3;
  return (
    <div className={cn(layout === 'compact' ? 'flex flex-wrap gap-2' : 'grid gap-2')} aria-label="Loading links">
      {Array.from({ length: count }).map((_, index) => (
        <div
          className={cn(
            'rounded-md bg-muted',
            layout === 'compact' ? 'h-8 w-24 rounded-full' : 'h-10 w-full',
          )}
          key={index}
        />
      ))}
    </div>
  );
}

function LinkListItems({ items, layout }: { items: LinkItem[]; layout: LinkListLayout }) {
  if (layout === 'compact') {
    return (
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Button asChild className="rounded-full" key={item.id} size="sm" variant="outline">
            <a {...linkAttrs(item)} data-link-list-item>
              <LinkContent item={item} layout={layout} />
            </a>
          </Button>
        ))}
      </div>
    );
  }

  if (layout === 'rows') {
    return (
      <div className="grid gap-2">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-0">
              <a
                {...linkAttrs(item)}
                className="grid gap-2 px-4 py-3 text-sm text-foreground no-underline hover:bg-accent hover:text-accent-foreground sm:grid-cols-[7rem_minmax(0,1fr)_auto]"
                data-link-list-item
              >
                <LinkContent item={item} layout={layout} />
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item) => (
        <li key={item.id}>
          <a
            {...linkAttrs(item)}
            className="inline-flex min-w-0 flex-wrap items-center gap-2 text-primary underline-offset-4 hover:underline"
            data-link-list-item
          >
            <LinkContent item={item} layout={layout} />
          </a>
        </li>
      ))}
    </ul>
  );
}

function LinkContent({ item, layout }: { item: LinkItem; layout: LinkListLayout }) {
  const showDate = (layout === 'rows' || layout === 'compact') && item.date;
  return (
    <>
      {showDate && <span className="text-xs tabular-nums text-muted-foreground">{item.date}</span>}
      {item.badge && (
        <Badge className="shrink-0 uppercase" variant={item.badge === 'PDF' ? 'destructive' : 'secondary'}>
          {item.badge}
        </Badge>
      )}
      <span className="min-w-0 break-words">{item.label}</span>
      {item.external && <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
    </>
  );
}

function linkAttrs(item: LinkItem) {
  return item.external
    ? { href: item.href, rel: 'noopener noreferrer', target: '_blank' }
    : { href: item.href };
}

export function mountLinkListIsland(
  element: HTMLElement,
  props: {
    config: LinkListConfig;
    headingEditablePath?: string;
    onEmptyChange?: (empty: boolean) => void;
  },
): void {
  let root = roots.get(element);
  if (!root) {
    root = createRoot(element);
    roots.set(element, root);
  }
  root.render(<LinkListIsland {...props} />);
}
