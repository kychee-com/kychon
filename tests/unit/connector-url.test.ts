import { describe, expect, it } from 'vitest';

import { connectorMcpUrl } from '../../src/lib/connector-url.ts';

describe('connectorMcpUrl', () => {
  it('uses a custom domain as it is', () => {
    expect(connectorMcpUrl('https://eagles.kychon.com')).toBe('https://eagles.kychon.com/_run402/mcp');
    expect(connectorMcpUrl('https://eagles.kychon.com/events?x=1')).toBe('https://eagles.kychon.com/_run402/mcp');
  });

  it('moves a Run402 subdomain to its run402.app twin, where sign-in works', () => {
    expect(connectorMcpUrl('https://ocey.run402.com/')).toBe('https://ocey.run402.app/_run402/mcp');
  });

  it('leaves an app host and look-alikes alone', () => {
    expect(connectorMcpUrl('https://ocey.run402.app')).toBe('https://ocey.run402.app/_run402/mcp');
    expect(connectorMcpUrl('https://run402.com.example.org')).toBe('https://run402.com.example.org/_run402/mcp');
  });
});
