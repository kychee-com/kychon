import { beforeEach, describe, expect, it, vi } from 'vitest';

const ssrConfigValue = vi.fn();

vi.mock('astro:middleware', () => ({ defineMiddleware: (fn: unknown) => fn }));
vi.mock('../../src/lib/ssr-api', () => ({ ssrConfigValue }));

type Handler = (context: unknown, next: () => Promise<Response>) => Promise<Response>;

async function loadMiddleware(): Promise<Handler> {
  vi.resetModules();
  return (await import('../../src/middleware')).onRequest as unknown as Handler;
}

function makeContext(url: string, { isPrerendered }: { isPrerendered: boolean }) {
  const headers = new Headers({ host: 'eagles.kychon.com' });
  const headersGet = vi.spyOn(headers, 'get');
  const redirect = vi.fn(
    (target: string, status: number) => new Response(null, { status, headers: { location: target } }),
  );
  const context = {
    isPrerendered,
    url: new URL(url),
    request: { headers },
    redirect,
  };
  return { context, headersGet, redirect };
}

describe('middleware', () => {
  beforeEach(() => {
    ssrConfigValue.mockReset();
  });

  it('does not read request headers on prerendered routes, using the URL host instead', async () => {
    ssrConfigValue.mockResolvedValue(null);
    const onRequest = await loadMiddleware();
    const { context, headersGet } = makeContext('http://localhost:4321/events', { isPrerendered: true });
    const next = vi.fn(async () => new Response('ok'));

    const response = await onRequest(context, next);

    expect(headersGet).not.toHaveBeenCalled();
    expect(ssrConfigValue).toHaveBeenCalledWith({ key: 'path_aliases', host: 'localhost:4321' });
    expect(next).toHaveBeenCalledOnce();
    expect(await response.text()).toBe('ok');
  });

  it('uses the Host header on SSR requests and redirects a seeded alias', async () => {
    ssrConfigValue.mockResolvedValue({ '/Classified-Ads': '/classifieds' });
    const onRequest = await loadMiddleware();
    const { context, headersGet, redirect } = makeContext('http://internal/Classified-Ads', { isPrerendered: false });
    const next = vi.fn(async () => new Response('ok'));

    await onRequest(context, next);

    expect(headersGet).toHaveBeenCalledWith('host');
    expect(ssrConfigValue).toHaveBeenCalledWith({ key: 'path_aliases', host: 'eagles.kychon.com' });
    expect(redirect).toHaveBeenCalledWith('/classifieds', 301);
    expect(next).not.toHaveBeenCalled();
  });
});
