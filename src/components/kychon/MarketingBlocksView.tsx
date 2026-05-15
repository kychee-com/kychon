import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarDays,
  Heart,
  Home,
  Info,
  MessageCircle,
  Settings,
  Shield,
  Sparkles,
  Star,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/kychon/ui';
import { canonicalizeKychonHref } from '@/lib/clean-routes';
import { cn } from '@/lib/ui/cn';

type MarketingBlockKind = 'features' | 'cta' | 'stats' | 'testimonials' | 'faq';

interface MarketingRenderOptions {
  editablePath?: (path: string) => string | undefined;
}

interface FeatureItem {
  icon?: string;
  title?: string;
  desc?: string;
  cta_text?: string;
  cta_href?: string;
}

interface StatItem {
  value?: string;
  label?: string;
  href?: string;
}

interface TestimonialItem {
  quote?: string;
  name?: string;
  role?: string;
}

interface FaqItem {
  q?: string;
  a?: string;
}

const FEATURE_ICONS: Record<string, LucideIcon> = {
  award: Award,
  'bar-chart': BarChart3,
  'bar-chart-2': BarChart3,
  briefcase: Briefcase,
  calendar: CalendarDays,
  heart: Heart,
  home: Home,
  info: Info,
  'message-circle': MessageCircle,
  'book-open': BookOpen,
  settings: Settings,
  shield: Shield,
  star: Star,
  users: Users,
  zap: Zap,
};

function editableAttrs(path: string, options: MarketingRenderOptions): { 'data-editable'?: string } {
  const editable = options.editablePath?.(path);
  return editable ? { 'data-editable': editable } : {};
}

function cleanHref(value: unknown, fallback = '#'): string {
  const href = String(value ?? '').trim() || fallback;
  return canonicalizeKychonHref(href);
}

function normalizeItems<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function columnClass(value: unknown): string {
  const columns = Math.max(1, Math.min(4, Number(value) || 3));
  if (columns === 1) return 'sm:grid-cols-1';
  if (columns === 2) return 'grid-cols-[repeat(auto-fit,minmax(min(16rem,100%),1fr))]';
  if (columns === 4) return 'grid-cols-[repeat(auto-fit,minmax(min(14rem,100%),1fr))]';
  return 'grid-cols-[repeat(auto-fit,minmax(min(15rem,100%),1fr))]';
}

function FeatureIcon({ name }: { name: string }) {
  const Icon = FEATURE_ICONS[name] || Sparkles;
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
      <Icon className="h-5 w-5" />
    </span>
  );
}

function MarketingContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  );
}

function FeaturesBlock({ config, options }: { config: Record<string, unknown>; options: MarketingRenderOptions }) {
  const items = normalizeItems<FeatureItem>(config.items);
  return (
    <MarketingContainer>
      <div className={cn('grid gap-4', columnClass(config.columns))}>
        {items.map((item, index) => {
          const ctaText = String(item.cta_text || '').trim();
          const ctaHref = String(item.cta_href || '').trim();
          return (
            <Card className="h-full" key={`${item.title || 'feature'}-${index}`}>
              <CardHeader>
                {item.icon && <FeatureIcon name={String(item.icon)} />}
                <CardTitle className="text-xl tracking-normal" {...editableAttrs(`items.${index}.title`, options)}>
                  {item.title || 'Feature'}
                </CardTitle>
                <CardDescription className="text-base" {...editableAttrs(`items.${index}.desc`, options)}>
                  {item.desc || ''}
                </CardDescription>
              </CardHeader>
              {ctaText && ctaHref && (
                <CardContent>
                  <Button asChild>
                    <a href={cleanHref(ctaHref)} {...editableAttrs(`items.${index}.cta_text`, options)}>
                      {ctaText}
                    </a>
                  </Button>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </MarketingContainer>
  );
}

function CtaBlock({ config, options }: { config: Record<string, unknown>; options: MarketingRenderOptions }) {
  const heading = String(config.heading || '').trim();
  const text = String(config.text || '').trim();
  const ctaText = String(config.cta_text || '').trim();
  return (
    <MarketingContainer className="max-w-4xl text-center">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="items-center">
          {heading && (
            <CardTitle className="text-3xl tracking-normal sm:text-4xl" {...editableAttrs('heading', options)}>
              {heading}
            </CardTitle>
          )}
          {text && (
            <CardDescription className="max-w-2xl text-base" {...editableAttrs('text', options)}>
              {text}
            </CardDescription>
          )}
        </CardHeader>
        {ctaText && (
          <CardContent className="flex justify-center">
            <Button asChild size="lg">
              <a href={cleanHref(config.cta_href, '#')} {...editableAttrs('cta_text', options)}>
                {ctaText}
              </a>
            </Button>
          </CardContent>
        )}
      </Card>
    </MarketingContainer>
  );
}

function StatsBlock({ config, options }: { config: Record<string, unknown>; options: MarketingRenderOptions }) {
  const items = normalizeItems<StatItem>(config.items);
  return (
    <MarketingContainer>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(14rem,100%),1fr))] gap-4">
        {items.map((item, index) => {
          const content = (
            <Card className="h-full transition-colors hover:bg-accent/40">
              <CardHeader>
                <CardTitle className="text-4xl tracking-normal text-primary" {...editableAttrs(`items.${index}.value`, options)}>
                  {item.value || '0'}
                </CardTitle>
                <CardDescription className="text-base" {...editableAttrs(`items.${index}.label`, options)}>
                  {item.label || ''}
                </CardDescription>
              </CardHeader>
            </Card>
          );
          if (!item.href) return <React.Fragment key={`${item.label || 'stat'}-${index}`}>{content}</React.Fragment>;
          return (
            <a className="block text-foreground no-underline" href={cleanHref(item.href)} key={`${item.label || 'stat'}-${index}`}>
              {content}
            </a>
          );
        })}
      </div>
    </MarketingContainer>
  );
}

function TestimonialsBlock({ config, options }: { config: Record<string, unknown>; options: MarketingRenderOptions }) {
  const items = normalizeItems<TestimonialItem>(config.items);
  return (
    <MarketingContainer>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(16rem,100%),1fr))] gap-4">
        {items.map((item, index) => (
          <Card className="h-full" key={`${item.name || 'testimonial'}-${index}`}>
            <CardContent className="space-y-4 p-6">
              <blockquote className="text-lg font-medium leading-relaxed tracking-normal" {...editableAttrs(`items.${index}.quote`, options)}>
                &ldquo;{item.quote || ''}&rdquo;
              </blockquote>
              <figcaption className="text-sm text-muted-foreground" {...editableAttrs(`items.${index}.name`, options)}>
                {item.name || 'Member'}
                {item.role ? `, ${item.role}` : ''}
              </figcaption>
            </CardContent>
          </Card>
        ))}
      </div>
    </MarketingContainer>
  );
}

function FaqBlock({ config, options }: { config: Record<string, unknown>; options: MarketingRenderOptions }) {
  const items = normalizeItems<FaqItem>(config.items);
  return (
    <MarketingContainer className="max-w-4xl">
      <h2 className="mb-5 text-2xl font-semibold tracking-normal">FAQ</h2>
      <div className="grid gap-3">
        {items.map((item, index) => (
          <Card key={`${item.q || 'faq'}-${index}`}>
            <details className="group">
              <summary className="cursor-pointer list-none px-6 py-4 text-base font-medium tracking-normal marker:hidden" {...editableAttrs(`items.${index}.q`, options)}>
                {item.q || 'Question?'}
              </summary>
              <CardContent className="pt-0 text-muted-foreground" {...editableAttrs(`items.${index}.a`, options)}>
                {item.a || ''}
              </CardContent>
            </details>
          </Card>
        ))}
      </div>
    </MarketingContainer>
  );
}

function MarketingBlock({ kind, config, options }: { kind: MarketingBlockKind; config: Record<string, unknown>; options: MarketingRenderOptions }) {
  if (kind === 'features') return <FeaturesBlock config={config} options={options} />;
  if (kind === 'cta') return <CtaBlock config={config} options={options} />;
  if (kind === 'stats') return <StatsBlock config={config} options={options} />;
  if (kind === 'testimonials') return <TestimonialsBlock config={config} options={options} />;
  return <FaqBlock config={config} options={options} />;
}

export function renderMarketingBlockHtml(
  kind: MarketingBlockKind,
  config: Record<string, unknown>,
  options: MarketingRenderOptions = {},
): string {
  return renderToStaticMarkup(<MarketingBlock kind={kind} config={config || {}} options={options} />);
}
