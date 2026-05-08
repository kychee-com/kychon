# Kychon Components

Product features import composed Kychon UI from this namespace.

- `src/components/kychon/ui.ts` is the product-facing facade for owned shadcn/ui components.
- `src/components/ui/*` remains generated/owned component source, but feature code should not import it directly.
- Direct Radix/Base UI primitive imports belong behind the owned UI boundary.
