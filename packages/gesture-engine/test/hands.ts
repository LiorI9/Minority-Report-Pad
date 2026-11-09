import type { Landmark } from '../src/index.js';

export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
export type Open = Partial<Record<FingerName, boolean>>;

export const OPEN: Open = { thumb: true, index: true, middle: true, ring: true, pinky: true };
export const FIST: Open = {};
export const ONE: Open = { index: true };
export const TWO: Open = { index: true, middle: true };
export const THREE: Open = { index: true, middle: true, ring: true };
export const V: Open = { index: true, middle: true };

/**
 * Builds a synthetic upright hand (palm facing camera, y grows downward),
 * shifted by (ox, oy) in normalized image coordinates.
 */
export function hand(open: Open, ox = 0, oy = 0): Landmark[] {
  const p = (x: number, y: number): Landmark => ({ x: x + ox, y: y + oy, z: 0 });
  const lm: Landmark[] = Array.from({ length: 21 }, () => p(0.5, 0.8));
  lm[0] = p(0.5, 0.8);
  lm[1] = p(0.44, 0.76);
  lm[2] = p(0.4, 0.72);
  lm[3] = p(0.37, 0.68);
  lm[4] = open.thumb ? p(0.33, 0.64) : p(0.47, 0.66);
  const fingers: [number, number, FingerName][] = [
    [5, 0.45, 'index'],
    [9, 0.5, 'middle'],
    [13, 0.55, 'ring'],
    [17, 0.6, 'pinky'],
  ];
  for (const [base, x, name] of fingers) {
    const extended = open[name];
    lm[base] = p(x, 0.62);
    lm[base + 1] = p(x, 0.54);
    lm[base + 2] = extended ? p(x, 0.48) : p(x, 0.6);
    lm[base + 3] = extended ? p(x, 0.42) : p(x, 0.66);
  }
  return lm;
}
