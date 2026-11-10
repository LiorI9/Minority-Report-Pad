import { LM, at, dist, type HandLandmarks, type Landmark } from './landmarks.js';

export interface FingerState {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

/**
 * A long finger counts as extended while its total flexion (knuckle + two joints) is below this.
 * On real hands (test/fixtures/real-hands.json) extended fingers measure up to ~45°, folded from ~160°.
 */
export const EXTENDED_MAX_FLEXION_DEG = 100;

type Vec = [number, number, number];

/**
 * Landmark x is a fraction of the frame width and y of its height, so angles are only true
 * after scaling x (and z, which MediaPipe reports on the x scale) by the frame's aspect ratio.
 */
function vec(a: Landmark, b: Landmark, aspect: number): Vec {
  return [(b.x - a.x) * aspect, b.y - a.y, (b.z - a.z) * aspect];
}

function angleDeg(u: Vec, w: Vec): number {
  const nu = Math.hypot(...u);
  const nw = Math.hypot(...w);
  if (nu === 0 || nw === 0) return 0;
  const cos = (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (nu * nw);
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

/** Total bend of a long finger: at the knuckle (vs. the wrist→knuckle line) plus its two joints. */
export function fingerFlexion(hand: HandLandmarks, mcp: number, aspect = 1): number {
  const wrist = at(hand, LM.WRIST);
  const a = at(hand, mcp);
  const b = at(hand, mcp + 1);
  const c = at(hand, mcp + 2);
  const d = at(hand, mcp + 3);
  const palm = vec(wrist, a, aspect);
  const s1 = vec(a, b, aspect);
  const s2 = vec(b, c, aspect);
  const s3 = vec(c, d, aspect);
  return angleDeg(palm, s1) + angleDeg(s1, s2) + angleDeg(s2, s3);
}

function longFingerExtended(hand: HandLandmarks, mcp: number, aspect: number): boolean {
  return fingerFlexion(hand, mcp, aspect) < EXTENDED_MAX_FLEXION_DEG;
}

/**
 * Thumb is extended when its tip is farther from the pinky base than its IP joint is.
 * The thumb is the least reliable finger, so poses and the clutch ignore it (ADR-018).
 */
function thumbExtended(hand: HandLandmarks): boolean {
  const pinkyBase = at(hand, LM.PINKY_MCP);
  return dist(at(hand, LM.THUMB_TIP), pinkyBase) > dist(at(hand, LM.THUMB_IP), pinkyBase) * 1.05;
}

/** `aspect` = camera frame width / height (1 when coordinates are already uniform). */
export function fingerState(hand: HandLandmarks, aspect = 1): FingerState {
  return {
    thumb: thumbExtended(hand),
    index: longFingerExtended(hand, LM.INDEX_MCP, aspect),
    middle: longFingerExtended(hand, LM.MIDDLE_MCP, aspect),
    ring: longFingerExtended(hand, LM.RING_MCP, aspect),
    pinky: longFingerExtended(hand, LM.PINKY_MCP, aspect),
  };
}

/** All five fingers, thumb included. For display only. */
export function countFingers(hand: HandLandmarks, aspect = 1): number {
  return Object.values(fingerState(hand, aspect)).filter(Boolean).length;
}

/** Extended long fingers (index..pinky), 0–4. This is what poses and the clutch use. */
export function countLongFingers(hand: HandLandmarks, aspect = 1): number {
  const s = fingerState(hand, aspect);
  return [s.index, s.middle, s.ring, s.pinky].filter(Boolean).length;
}
