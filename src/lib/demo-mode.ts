import type { ProjectSeed } from '../seeds/types.js';
import { seedValue } from './chrome-bake.js';

export function isDemoModeSeed(seed: ProjectSeed): boolean {
  const value = seedValue(seed, 'demo_mode');
  return value === true || value === 'true';
}
