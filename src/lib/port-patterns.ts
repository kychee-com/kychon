// port-patterns: the self-report coverage surface for the copy-website porter
// (#124/#123/#99/#91). It maps each recurring copied-site source pattern to the
// Kychon block(s) that cover it, so the porter can tell — for any source pattern
// — whether a first-class block exists or it must record a fallback in its copy
// report. The mapping is grounded in BLOCK_TYPES: every referenced block must be
// registered, so a retired block flavor can never leave a silent gap in the
// catalog (cleanup verbs as much as creation verbs).
import { BLOCK_TYPES } from './blocks';

export interface PortPattern {
  /** Stable source-pattern key the porter checks against. */
  pattern: string;
  /** Human-readable description for docs and the copy report. */
  label: string;
  /** Registered block type(s) that cover the pattern. */
  blocks: string[];
}

export const PORT_PATTERNS: PortPattern[] = [
  { pattern: 'homepage_panels', label: 'Association homepage panel grid', blocks: ['feature_panels'] },
  { pattern: 'menu', label: 'Restaurant or bar menu', blocks: ['menu'] },
  {
    pattern: 'utility_header',
    label: 'Wild Apricot-style utility header cluster',
    blocks: ['utility_bar', 'social_row', 'safety_cta'],
  },
  { pattern: 'member_login', label: 'Member login surface', blocks: ['member_login'] },
  { pattern: 'image_accordion', label: 'Image accordion', blocks: ['image_accordion'] },
  { pattern: 'shape_divider', label: 'SVG wave/shape divider', blocks: ['shape_divider'] },
];

function patternIsCovered(entry: PortPattern): boolean {
  return entry.blocks.length > 0 && entry.blocks.every((block) => BLOCK_TYPES[block] != null);
}

/** The covered port patterns whose blocks are all currently registered. */
export function listPortPatterns(): PortPattern[] {
  return PORT_PATTERNS.filter(patternIsCovered);
}

export interface PortPatternResolution {
  pattern: string;
  supported: boolean;
  blocks: string[];
  label?: string;
}

/**
 * Resolve a source pattern to its covering block(s). Unknown patterns — or
 * patterns whose block has been retired from the registry — resolve as
 * unsupported so the porter records a fallback instead of emitting a fossil.
 */
export function resolvePortPattern(pattern: string): PortPatternResolution {
  const entry = PORT_PATTERNS.find((candidate) => candidate.pattern === pattern);
  if (entry && patternIsCovered(entry)) {
    return { pattern, supported: true, blocks: entry.blocks, label: entry.label };
  }
  return { pattern, supported: false, blocks: [] };
}
