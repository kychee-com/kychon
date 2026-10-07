/// <reference types="astro/client" />

// Tiptap CDN imports (loaded at runtime from esm.sh)
declare module 'https://esm.sh/@tiptap/core@2' {
  export const Editor: any;
}
declare module 'https://esm.sh/@tiptap/starter-kit@2' {
  const StarterKit: any;
  export default StarterKit;
  export { StarterKit };
}

// The external chrome snapshot's JSON, substituted by Vite's `define` in
// astro.config.mjs ('' when the build has none). Undefined outside Vite.
declare const __KYCHON_CHROME_SNAPSHOT_JSON__: string | undefined;
