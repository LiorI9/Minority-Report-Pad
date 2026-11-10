import { describe, expect, it } from 'vitest';
import { countLongFingers, fingerFlexion, EXTENDED_MAX_FLEXION_DEG, LM, type Landmark } from '../src/index.js';
import fixtures from './fixtures/real-hands.json';

/**
 * Landmarks MediaPipe produced for its own sample photos of real hands
 * (open hands, victory, pointing up, thumbs up, thumbs down).
 */
interface RealHand {
  name: string;
  aspect: number;
  longFingers: number;
  landmarks: Landmark[];
}
const hands = fixtures as RealHand[];
const MCPS = [LM.INDEX_MCP, LM.MIDDLE_MCP, LM.RING_MCP, LM.PINKY_MCP];

/** Rotates a hand in the image plane, in uniform (aspect-corrected) units. */
function rotate(hand: RealHand, deg: number): Landmark[] {
  const a = (deg * Math.PI) / 180;
  return hand.landmarks.map((p) => {
    const x = p.x * hand.aspect;
    return { x: x * Math.cos(a) - p.y * Math.sin(a), y: x * Math.sin(a) + p.y * Math.cos(a), z: p.z * hand.aspect };
  });
}

describe('finger detection on real hands', () => {
  it.each(hands.map((h) => [h.name, h] as const))('%s: counts the long fingers', (_name, h) => {
    expect(countLongFingers(h.landmarks, h.aspect)).toBe(h.longFingers);
  });

  it('ignores the thumb: a thumbs-up is a fist, not one finger', () => {
    const thumbsUp = hands.find((h) => h.name === 'thumbs_up')!;
    expect(countLongFingers(thumbsUp.landmarks, thumbsUp.aspect)).toBe(0);
  });

  it('keeps a wide margin between extended and folded fingers', () => {
    const flexions = hands.flatMap((h) => MCPS.map((m) => fingerFlexion(h.landmarks, m, h.aspect)));
    const extended = flexions.filter((f) => f < EXTENDED_MAX_FLEXION_DEG);
    const folded = flexions.filter((f) => f >= EXTENDED_MAX_FLEXION_DEG);
    expect(Math.max(...extended)).toBeLessThan(EXTENDED_MAX_FLEXION_DEG - 30);
    expect(Math.min(...folded)).toBeGreaterThan(EXTENDED_MAX_FLEXION_DEG + 30);
  });

  it.each([45, 90, 135, 180, -60])('is unaffected by rotating the hand %d°', (deg) => {
    for (const h of hands) expect(countLongFingers(rotate(h, deg))).toBe(h.longFingers);
  });
});
