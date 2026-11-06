import { describe, expect, it } from 'vitest';
import { countFingers, fingerState, type Landmark } from '../src/index.js';

/**
 * Builds a synthetic upright right hand (palm facing camera, y grows downward).
 * `open` lists which fingers are extended.
 */
function hand(open: Partial<Record<'thumb' | 'index' | 'middle' | 'ring' | 'pinky', boolean>>): Landmark[] {
  const p = (x: number, y: number): Landmark => ({ x, y, z: 0 });
  const lm: Landmark[] = Array.from({ length: 21 }, () => p(0.5, 0.8));
  lm[0] = p(0.5, 0.8); // wrist
  // thumb: cmc, mcp, ip, tip
  lm[1] = p(0.44, 0.76);
  lm[2] = p(0.4, 0.72);
  lm[3] = p(0.37, 0.68);
  lm[4] = open.thumb ? p(0.33, 0.64) : p(0.47, 0.66);
  const fingers: [number, number][] = [
    [5, 0.45], // index
    [9, 0.5], // middle
    [13, 0.55], // ring
    [17, 0.6], // pinky
  ];
  const names = ['index', 'middle', 'ring', 'pinky'] as const;
  fingers.forEach(([base, x], i) => {
    const extended = open[names[i]!];
    lm[base] = p(x, 0.62); // mcp
    lm[base + 1] = p(x, 0.54); // pip
    lm[base + 2] = extended ? p(x, 0.48) : p(x, 0.6); // dip
    lm[base + 3] = extended ? p(x, 0.42) : p(x, 0.66); // tip
  });
  return lm;
}

describe('countFingers', () => {
  it('counts an open hand as 5', () => {
    expect(countFingers(hand({ thumb: true, index: true, middle: true, ring: true, pinky: true }))).toBe(5);
  });
  it('counts a fist as 0', () => {
    expect(countFingers(hand({}))).toBe(0);
  });
  it('counts index only as 1', () => {
    const h = hand({ index: true });
    expect(countFingers(h)).toBe(1);
    expect(fingerState(h).index).toBe(true);
  });
  it('counts index + middle as 2', () => {
    expect(countFingers(hand({ index: true, middle: true }))).toBe(2);
  });
  it('counts index + middle + ring as 3', () => {
    expect(countFingers(hand({ index: true, middle: true, ring: true }))).toBe(3);
  });
});
