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
