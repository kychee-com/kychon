import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Search } from 'lucide-react';

import { Badge, Button, Card, Input, Label } from '@/components/kychon/ui';
import { searchSite } from '@/lib/api';
import {
  normalizeSiteSearchConfig,
  type SiteSearchConfig,
  type SiteSearchPresentation,
} from '@/lib/site-search-config';
import type { SearchResult } from '@/lib/search';
import { cn } from '@/lib/ui/cn';

interface SiteSearchProps extends SiteSearchConfig {
  sectionId: string;
  zone: 'header' | 'main' | 'footer';
}

const roots = new WeakMap<HTMLElement, Root>();
const typeLabel: Record<SearchResult['type'], string> = {
  event: 'Event',
  page: 'Page',
  resource: 'Resource',
};

function presentationStyles(presentation: SiteSearchPresentation) {
  return {
    root: { maxWidth: presentation.max_width || undefined } satisfies React.CSSProperties,
    form: {
      background: presentation.form_bg || undefined,
      border: presentation.form_border || undefined,
      borderRadius: presentation.form_radius || undefined,
      gap: presentation.form_gap || undefined,
      overflow: presentation.form_overflow as React.CSSProperties['overflow'],
    } satisfies React.CSSProperties,
    input: {
      border: presentation.input_border || undefined,
      borderRadius: presentation.input_radius || undefined,
      height: presentation.input_height || undefined,
      padding: presentation.input_padding || undefined,
    } satisfies React.CSSProperties,
    submit: {
      background: presentation.submit_bg || undefined,
      border: presentation.submit_border || undefined,
      borderRadius: presentation.submit_radius || undefined,
      color: presentation.submit_color || undefined,
      minHeight: presentation.submit_height || undefined,
      padding: presentation.submit_padding || undefined,
    } satisfies React.CSSProperties,
  };
}

function SiteSearchIsland(props: SiteSearchProps) {
  const {
    compact,
    defaultType,
    destination,
    minChars,
    mode,
    placeholder,
    presentation,
    sectionId,
    submitLabel,
    zone,
  } = props;
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const requestSeq = React.useRef(0);
  const inputId = `site-search-${sectionId}`;
  const listId = `site-search-list-${sectionId}`;
  const isHeader = zone === 'header';
  const styles = React.useMemo(() => presentationStyles(presentation), [presentation]);

  const closeSuggestions = React.useCallback(() => {
    requestSeq.current += 1;
    setOpen(false);
    setResults([]);
    setActiveIndex(-1);
  }, []);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < minChars) {
      closeSuggestions();
      return;
    }

    const seq = ++requestSeq.current;
    const timer = window.setTimeout(async () => {
      try {
        const data = await searchSite({ q: trimmed, type: defaultType, suggest: true });
        if (seq !== requestSeq.current) return;
        const next = (data.results || []).slice(0, 5);
        setResults(next);
        setOpen(next.length > 0);
        setActiveIndex(-1);
      } catch {
        if (seq !== requestSeq.current) return;
        setResults([]);
        setOpen(false);
        setActiveIndex(-1);
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [closeSuggestions, defaultType, minChars, query]);

  React.useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) closeSuggestions();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [closeSuggestions, open]);

  function moveActive(next: number): void {
    if (!results.length) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((next + results.length) % results.length);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSuggestions();
      return;
    }

    if (!open || !results.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(activeIndex - 1);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      window.location.href = results[activeIndex]?.url || destination;
    }
  }

  if (mode === 'header_icon') {
    return (
      <Button asChild className="h-9 w-9" size="icon" title={placeholder} variant="outline">
        <a href={destination} aria-label={placeholder} data-site-search>
          <Search className="h-4 w-4" aria-hidden="true" />
        </a>
      </Button>
    );
  }

  return (
    <div
      className={cn('relative w-full min-w-0', compact && 'max-w-md', isHeader && 'sm:max-w-[18rem]')}
      data-site-search
      ref={rootRef}
      style={styles.root}
    >
      {isHeader && compact && (
        <Button asChild className="h-9 w-9 sm:hidden" size="icon" title={placeholder} variant="outline">
          <a href={destination} aria-label={placeholder}>
            <Search className="h-4 w-4" aria-hidden="true" />
          </a>
        </Button>
      )}
      <form
        action={destination}
        className={cn(
          'relative flex w-full min-w-0 items-stretch gap-2',
          isHeader && compact && 'hidden sm:flex',
        )}
        method="get"
        onSubmit={closeSuggestions}
        role="search"
        style={styles.form}
      >
        <Label className="sr-only" htmlFor={inputId}>
          {placeholder}
        </Label>
        <Input
          aria-activedescendant={activeIndex >= 0 ? `${inputId}-option-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open ? 'true' : 'false'}
          autoComplete="off"
          className={cn('min-w-0 flex-1', isHeader && 'h-8 text-sm')}
          id={inputId}
          maxLength={300}
          name="q"
          onInput={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={styles.input}
          type="search"
          value={query}
        />
        <Input name="type" readOnly type="hidden" value={defaultType} />
        <Button
          aria-label={submitLabel}
          className={cn('shrink-0', isHeader && 'h-8 px-3 text-xs')}
          size={isHeader ? 'sm' : 'default'}
          style={styles.submit}
          type="submit"
        >
          <Search className="h-4 w-4 sm:hidden" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only sm:inline">{submitLabel}</span>
        </Button>
        {open && (
          <Card
            className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-50 overflow-hidden p-1 shadow-lg"
            id={listId}
            role="listbox"
          >
            {results.map((result, index) => {
              const active = index === activeIndex;
              return (
                <a
                  aria-selected={active ? 'true' : 'false'}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-sm px-3 py-2 text-sm text-foreground no-underline outline-none hover:bg-accent hover:text-accent-foreground',
                    active && 'bg-accent text-accent-foreground',
                  )}
                  href={result.url}
                  id={`${inputId}-option-${index}`}
                  key={`${result.type}:${result.id}:${result.url}`}
                  onClick={closeSuggestions}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                >
                  <span className="min-w-0 truncate">{result.title}</span>
                  <Badge className="shrink-0" variant="secondary">
                    {typeLabel[result.type] || result.type}
                  </Badge>
                </a>
              );
            })}
          </Card>
        )}
      </form>
    </div>
  );
}

export function mountSiteSearchIsland(
  element: HTMLElement,
  props: {
    config: Record<string, unknown>;
    sectionId: string;
    zone: 'header' | 'main' | 'footer';
  },
): void {
  let root = roots.get(element);
  if (!root) {
    root = createRoot(element);
    roots.set(element, root);
  }
  root.render(
    <SiteSearchIsland
      {...normalizeSiteSearchConfig(props.config)}
      sectionId={props.sectionId}
      zone={props.zone}
    />,
  );
}
