import { afterEach, describe, expect, it, vi } from 'vitest';
import { markUpstreamStart, resetSsrTiming, ssrTimingHeader, startSsrTiming } from '../../src/lib/ssr-timing';

describe('ssr Server-Timing', () => {
  afterEach(() => {
    resetSsrTiming();
    vi.restoreAllMocks();
  });

  it("reports boot, upstream and app on a container's first request, marked cold", () => {
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValueOnce(1200); // request reaches the app 1.2 s after process start
    const mark = startSsrTiming();
    now.mockReturnValueOnce(1950); // first upstream call leaves 750 ms later
    markUpstreamStart();
    expect(ssrTimingHeader(mark, 2600)).toBe('boot;dur=1200, upstream;dur=750, app;dur=1400, cold');
  });

  it('reports only app on later requests', () => {
    startSsrTiming();
    const now = vi.spyOn(performance, 'now').mockReturnValueOnce(5000);
    const mark = startSsrTiming();
    now.mockRestore();
    expect(ssrTimingHeader(mark, 5300)).toBe('app;dur=300');
  });

  it('omits upstream when the request made no upstream call', () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(400);
    const mark = startSsrTiming();
    expect(ssrTimingHeader(mark, 450)).toBe('boot;dur=400, app;dur=50, cold');
  });
});
