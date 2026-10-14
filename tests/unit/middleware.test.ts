import { beforeEach, describe, expect, it, vi } from 'vitest';

const ssrConfigLookup = vi.fn();

vi.mock('astro:middleware', () => ({ defineMiddleware: (fn: unknown) => fn }));
vi.mock('../../src/lib/ssr-api', () => ({ ssrConfigLookup }));

type Handler = (context: unknown, next: () => Promise<Response>) => Promise<Response>;

async function loadMiddleware(): Promise<Handler> {
  vi.resetModules();
  return (await import('../../src/middleware')).onRequest as unknown as Handler;
}

function makeContext(url: string, { isPrerendered, routePattern }: { isPrerendered: boolean; routePattern?: string }) {
  const headers = new Headers({ host: 'eagles.kychon.com' });
  const headersGet = vi.spyOn(headers, 'get');
  const redirect = vi.fn(
    (target: string, status: number) => new Response(null, { status, headers: { location: target } }),
  );
  const context = {
    isPrerendered,
    routePattern,
    url: new URL(url),
    request: { headers },
    redirect,
  };
  return { context, headersGet, redirect };
}

describe('middleware', () => {
  beforeEach(() => {
    ssrConfigLookup.mockReset();
    vi.useRealTimers();
  });

  it('does not read request headers on prerendered routes, using the URL host instead', async () => {
    ssrConfigLookup.mockResolvedValue({ status: 'ok', value: null });
    const onRequest = await loadMiddleware();
    const { context, headersGet } = makeContext('http://localhost:4321/events', { isPrerendered: true });
    const next = vi.fn(async () => new Response('ok'));

    const response = await onRequest(context, next);

    expect(headersGet).not.toHaveBeenCalled();
    expect(ssrConfigLookup).toHaveBeenCalledWith({ key: 'path_aliases', host: 'localhost:4321' });
    expect(next).toHaveBeenCalledOnce();
    expect(await response.text()).toBe('ok');
  });

  it('uses the Host header on SSR requests and redirects a seeded alias', async () => {
    ssrConfigLookup.mockResolvedValue({ status: 'ok', value: { '/Classified-Ads': '/classifieds' } });
    const onRequest = await loadMiddleware();
    const { context, headersGet, redirect } = makeContext('http://internal/Classified-Ads', { isPrerendered: false });
    const next = vi.fn(async () => new Response('ok'));

    await onRequest(context, next);

    expect(headersGet).toHaveBeenCalledWith('host');
    expect(ssrConfigLookup).toHaveBeenCalledWith({ key: 'path_aliases', host: 'eagles.kychon.com' });
    expect(redirect).toHaveBeenCalledWith('/classifieds', 301);
    expect(next).not.toHaveBeenCalled();
  });

  it('caches a successful read for the life of the container', async () => {
    ssrConfigLookup.mockResolvedValue({ status: 'ok', value: null });
    const onRequest = await loadMiddleware();
    const next = vi.fn(async () => new Response('ok'));

    await onRequest(makeContext('http://internal/a', { isPrerendered: false }).context, next);
    await onRequest(makeContext('http://internal/b', { isPrerendered: false }).context, next);

    expect(ssrConfigLookup).toHaveBeenCalledOnce();
  });

  it('does not cache a failed read: falls through, then retries after the backoff (kychon#226)', async () => {
    vi.useFakeTimers();
    ssrConfigLookup.mockResolvedValueOnce({ status: 'error' });
    ssrConfigLookup.mockResolvedValue({ status: 'ok', value: { '/Classified-Ads': '/classifieds' } });
    const onRequest = await loadMiddleware();
    const { ALIAS_RETRY_MS } = await import('../../src/middleware');
    const next = vi.fn(async () => new Response('ok'));

    const first = makeContext('http://internal/Classified-Ads', { isPrerendered: false });
    await onRequest(first.context, next);
    expect(first.redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();

    const withinBackoff = makeContext('http://internal/Classified-Ads', { isPrerendered: false });
    await onRequest(withinBackoff.context, next);
    expect(ssrConfigLookup).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(ALIAS_RETRY_MS);
    const afterBackoff = makeContext('http://internal/Classified-Ads', { isPrerendered: false });
    await onRequest(afterBackoff.context, next);
    expect(ssrConfigLookup).toHaveBeenCalledTimes(2);
    expect(afterBackoff.redirect).toHaveBeenCalledWith('/classifieds', 301);
  });

  it('skips the alias read for a request that matched a concrete route (cold /calendar)', async () => {
    ssrConfigLookup.mockResolvedValue({ status: 'ok', value: { '/calendar': '/elsewhere' } });
    const onRequest = await loadMiddleware();
    const next = vi.fn(async () => new Response('ok'));

    for (const routePattern of ['/calendar', '/search', '/event', '/.well-known/kychon.json']) {
      const { context, redirect } = makeContext(`http://internal${routePattern}`, {
        isPrerendered: false,
        routePattern,
      });
      await onRequest(context, next);
      expect(redirect).not.toHaveBeenCalled();
    }
    expect(ssrConfigLookup).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(4);
  });

  it('still resolves aliases on catch-all, dynamic and error routes', async () => {
    const { mayBeAliasSource } = await import('../../src/middleware');
    for (const pattern of ['/[...alias]', '/[customPage]', '/404', '/500', undefined]) {
      expect(mayBeAliasSource(pattern), String(pattern)).toBe(true);
    }
    expect(mayBeAliasSource('/calendar')).toBe(false);

    ssrConfigLookup.mockResolvedValue({ status: 'ok', value: { '/Classified-Ads': '/classifieds' } });
    const onRequest = await loadMiddleware();
    const { context, redirect } = makeContext('http://internal/Classified-Ads', {
      isPrerendered: false,
      routePattern: '/[...alias]',
    });
    await onRequest(
      context,
      vi.fn(async () => new Response('ok')),
    );
    expect(redirect).toHaveBeenCalledWith('/classifieds', 301);
  });
});

describe('middleware sign-in flow on ports (kychon#144)', () => {
  beforeEach(() => {
    ssrConfigLookup.mockReset();
    ssrConfigLookup.mockResolvedValue({ status: 'ok', value: { '/join': '/join-us', '/admin': '/club-admin' } });
  });

  it('sends a signed-out redirect to the sign-in form, not the aliased source page', async () => {
    const onRequest = await loadMiddleware();
    const { context, redirect } = makeContext('http://internal/join?returnTo=%2Fadmin', { isPrerendered: false });
    const next = vi.fn(async () => new Response('sign-in form'));

    const response = await onRequest(context, next);

    expect(redirect).not.toHaveBeenCalled();
    expect(await response.text()).toBe('sign-in form');
  });

  it('still redirects a bare /join to the copied membership page', async () => {
    const onRequest = await loadMiddleware();
    const { context, redirect } = makeContext('http://internal/join', { isPrerendered: false });

    await onRequest(
      context,
      vi.fn(async () => new Response('ok')),
    );

    expect(redirect).toHaveBeenCalledWith('/join-us', 301);
  });

  it('never aliases /admin', async () => {
    const onRequest = await loadMiddleware();
    const { context, redirect } = makeContext('http://internal/admin', { isPrerendered: false });
    const next = vi.fn(async () => new Response('admin'));

    await onRequest(context, next);

    expect(redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });
});
