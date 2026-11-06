import { LM, at, dist, type HandLandmarks } from './landmarks.js';

export interface FingerState {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

/** Ratio tip/pip distance from the wrist above which a finger counts as extended. Tuned in the Test Bed. */
export const EXTENDED_RATIO = 1.15;

function fingerExtended(hand: HandLandmarks, pip: number, tip: number): boolean {
  const wrist = at(hand, LM.WRIST);
  return dist(wrist, at(hand, tip)) > dist(wrist, at(hand, pip)) * EXTENDED_RATIO;
}

/** Thumb is extended when its tip is farther from the pinky base than its IP joint is. */
function thumbExtended(hand: HandLandmarks): boolean {
  const pinkyBase = at(hand, LM.PINKY_MCP);
  return dist(at(hand, LM.THUMB_TIP), pinkyBase) > dist(at(hand, LM.THUMB_IP), pinkyBase) * 1.05;
}

export function fingerState(hand: HandLandmarks): FingerState {
  return {
    thumb: thumbExtended(hand),
    index: fingerExtended(hand, LM.INDEX_PIP, LM.INDEX_TIP),
    middle: fingerExtended(hand, LM.MIDDLE_PIP, LM.MIDDLE_TIP),
    ring: fingerExtended(hand, LM.RING_PIP, LM.RING_TIP),
    pinky: fingerExtended(hand, LM.PINKY_PIP, LM.PINKY_TIP),
  };
}

export function countFingers(hand: HandLandmarks): number {
  return Object.values(fingerState(hand)).filter(Boolean).length;
}
