/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Chrome reads an SSR page started early (src/lib/ssr-chrome-prefetch.ts). */
    ssrChrome?: import('./lib/ssr-chrome-prefetch').SsrChromePrefetch;
  }
}

// Tiptap CDN imports (loaded at runtime from esm.sh)
declare module 'https://esm.sh/@tiptap/core@2' {
  export const Editor: any;
}
declare module 'https://esm.sh/@tiptap/starter-kit@2' {
  const StarterKit: any;
  export default StarterKit;
  export { StarterKit };
}
