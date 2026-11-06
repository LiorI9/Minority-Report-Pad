/** A single hand landmark in normalized image coordinates (MediaPipe Hands format). */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

/** 21 landmarks per hand, indexed as in MediaPipe Hands. */
export type HandLandmarks = readonly Landmark[];

export const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_TIP: 20,
} as const;

export function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function at(hand: HandLandmarks, i: number): Landmark {
  const p = hand[i];
  if (!p) throw new Error(`Missing landmark ${i}`);
  return p;
}
