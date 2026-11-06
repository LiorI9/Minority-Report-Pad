import { countFingers } from './fingers.js';
import { OneEuroFilter } from './filter.js';
import { LM, at, type HandLandmarks } from './landmarks.js';

/** The user's real hand (not the camera-image label). */
export type Handedness = 'Left' | 'Right';

export interface HandInput {
  landmarks: HandLandmarks;
  handedness: Handedness;
}

export type ClutchState = 'no-hands' | 'paused' | 'active';

/** Stable motion-hand poses. 4 and 5 fingers both count as "open" (5). */
export type Pose = 0 | 1 | 2 | 3 | 5;

export type GestureEvent =
  | { type: 'clutch'; state: ClutchState }
  | { type: 'pose'; pose: Pose }
  | { type: 'click' }
  | { type: 'rightClick' }
  | { type: 'scroll'; dx: number; dy: number }
  | { type: 'dragStart' }
  | { type: 'dragMove' }
  | { type: 'dragEnd' }
  | { type: 'swipe'; direction: 'left' | 'right' };

export interface EngineOptions {
  /** The hand that moves the cursor. The other hand is the reference (anchor + clutch). */
  dominant: Handedness;
  /** How long a new finger count must hold before it is accepted. */
  stableMs: number;
  /** Cursor travel (fraction of screen) per unit of hand travel (fraction of camera frame). */
  gain: number;
  /** Scroll pixels per unit of hand travel. */
  scrollGain: number;
  /** Natural scrolling (content follows the hand, like a Mac trackpad). false = classic/reversed. */
  naturalScroll: boolean;
  /** Hand travel needed before a 2-finger pose becomes a scroll instead of a right click. */
  scrollDeadzone: number;
  /** A 3-finger pose that travels `swipeDistance` within `swipeWindowMs` is a tab swipe, otherwise a drag. */
  swipeWindowMs: number;
  swipeDistance: number;
  /** Reference hand with at least this many fingers activates the clutch. */
  clutchOpenMin: number;
  /** Reference hand with at most this many fingers pauses the clutch. */
  clutchClosedMax: number;
}

export const DEFAULT_OPTIONS: EngineOptions = {
  dominant: 'Right',
  stableMs: 150,
  gain: 3,
  scrollGain: 2500,
  naturalScroll: true,
  scrollDeadzone: 0.02,
  swipeWindowMs: 300,
  swipeDistance: 0.08,
  clutchOpenMin: 4,
  clutchClosedMax: 1,
};

export interface Point {
  x: number;
  y: number;
}

export interface EngineFrame {
  clutch: ClutchState;
  /** Unstabilized finger count of the motion hand, if visible. */
  rawFingers: number | null;
  /** Accepted (stabilized) pose while the clutch is active. */
  pose: Pose | null;
  /** Cursor position in normalized screen coordinates (0..1). */
  cursor: Point;
  dragging: boolean;
  /** Indices into the input array, for visualization. */
  motionIndex: number | null;
  referenceIndex: number | null;
  events: GestureEvent[];
}

const PALM = [LM.WRIST, LM.INDEX_MCP, LM.MIDDLE_MCP, LM.RING_MCP, LM.PINKY_MCP];

function palmCenter(hand: HandLandmarks): Point {
  let x = 0;
  let y = 0;
  for (const i of PALM) {
    const p = at(hand, i);
    x += p.x;
    y += p.y;
  }
  return { x: x / PALM.length, y: y / PALM.length };
}

function toPose(fingers: number): Pose {
  if (fingers >= 4) return 5;
  return fingers as Pose;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Turns per-frame hand landmarks into trackpad-style gesture events.
 * Pure and deterministic: no DOM, no Chrome APIs, time is passed in.
 */
export class GestureEngine {
  readonly options: EngineOptions;

  private clutch: ClutchState = 'no-hands';
  private pose: Pose | null = null;
  private poseSince = 0;
  private candidate: Pose | null = null;
  private candidateSince = 0;
  private cursor: Point = { x: 0.5, y: 0.5 };
  private lastRel: Point | null = null;
  private lastRawRel: Point | null = null;
  private readonly fx = new OneEuroFilter();
  private readonly fy = new OneEuroFilter();

  // Per-pose accumulators.
  private travel: Point = { x: 0, y: 0 };
  private scrolled = false;
  private dragging = false;
  private swiped = false;

  constructor(options: Partial<EngineOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  setOptions(options: Partial<EngineOptions>): void {
    Object.assign(this.options, options);
  }

  update(hands: readonly HandInput[], tMs: number): EngineFrame {
    const events: GestureEvent[] = [];
    const { motionIndex, referenceIndex } = this.assignRoles(hands);
    const motion = motionIndex === null ? undefined : hands[motionIndex];
    const reference = referenceIndex === null ? undefined : hands[referenceIndex];

    this.updateClutch(reference, hands.length, events);
    const rawFingers = motion ? countFingers(motion.landmarks) : null;

    if (this.clutch === 'active' && motion && reference && rawFingers !== null) {
      this.updateActive(motion, reference, rawFingers, tMs, events);
    }

    return {
      clutch: this.clutch,
      rawFingers,
      pose: this.pose,
      cursor: { ...this.cursor },
      dragging: this.dragging,
      motionIndex,
      referenceIndex,
      events,
    };
  }

  private assignRoles(hands: readonly HandInput[]): { motionIndex: number | null; referenceIndex: number | null } {
    let motionIndex: number | null = null;
    let referenceIndex: number | null = null;
    hands.forEach((h, i) => {
      if (h.handedness === this.options.dominant && motionIndex === null) motionIndex = i;
      else if (referenceIndex === null) referenceIndex = i;
    });
    // Two hands both labelled as the reference hand: still use the second one for motion.
    if (motionIndex === null && hands.length >= 2) {
      motionIndex = referenceIndex === 0 ? 1 : 0;
    }
    return { motionIndex, referenceIndex };
  }

  private updateClutch(reference: HandInput | undefined, handCount: number, events: GestureEvent[]): void {
    let next: ClutchState;
    if (handCount === 0) next = 'no-hands';
    else if (!reference) next = 'paused';
    else {
      const f = countFingers(reference.landmarks);
      if (f >= this.options.clutchOpenMin) next = 'active';
      else if (f <= this.options.clutchClosedMax) next = 'paused';
      else next = this.clutch === 'active' ? 'active' : 'paused'; // hysteresis
    }
    if (next === this.clutch) return;
    if (this.clutch === 'active') this.deactivate(events);
    this.clutch = next;
    events.push({ type: 'clutch', state: next });
  }

  private deactivate(events: GestureEvent[]): void {
    if (this.dragging) events.push({ type: 'dragEnd' });
    this.dragging = false;
    this.pose = null;
    this.candidate = null;
    this.lastRel = null;
    this.lastRawRel = null;
    this.fx.reset();
    this.fy.reset();
  }

  private updateActive(
    motion: HandInput,
    reference: HandInput,
    rawFingers: number,
    tMs: number,
    events: GestureEvent[],
  ): void {
    // Stabilize the pose.
    const rawPose = toPose(rawFingers);
    if (rawPose !== this.candidate) {
      this.candidate = rawPose;
      this.candidateSince = tMs;
    }
    if (this.candidate !== this.pose && tMs - this.candidateSince >= this.options.stableMs) {
      this.transition(this.candidate, tMs, events);
    }

    // Motion hand position relative to the reference hand, smoothed.
    const m = palmCenter(motion.landmarks);
    const r = palmCenter(reference.landmarks);
    const raw = { x: m.x - r.x, y: m.y - r.y };
    const rel = { x: this.fx.filter(raw.x, tMs), y: this.fy.filter(raw.y, tMs) };
    const prev = this.lastRel;
    const prevRaw = this.lastRawRel;
    this.lastRel = rel;
    this.lastRawRel = raw;
    if (!prev || !prevRaw) return;

    // Freeze the cursor while a pose change is pending, so clicks land where they were aimed.
    if (this.candidate !== this.pose) return;

    // Camera image is not mirrored: the user moving right decreases image x.
    const dx = -(rel.x - prev.x);
    const dy = rel.y - prev.y;
    // Swipes are fast, so they use the unfiltered position to avoid smoothing lag.
    const rawDx = -(raw.x - prevRaw.x);
    this.applyPose(dx, dy, rawDx, tMs, events);
  }

  private applyPose(dx: number, dy: number, rawDx: number, tMs: number, events: GestureEvent[]): void {
    const o = this.options;
    switch (this.pose) {
      case 5:
        this.moveCursor(dx, dy);
        break;
      case 2: {
        this.travel.x += dx;
        this.travel.y += dy;
        if (!this.scrolled && Math.hypot(this.travel.x, this.travel.y) >= o.scrollDeadzone) this.scrolled = true;
        // Natural scrolling, like a Mac trackpad: content follows the hand.
        if (this.scrolled && (dx !== 0 || dy !== 0)) {
          const sign = o.naturalScroll ? -1 : 1;
          events.push({ type: 'scroll', dx: sign * dx * o.scrollGain, dy: sign * dy * o.scrollGain });
        }
        break;
      }
      case 3: {
        if (this.dragging) {
          this.moveCursor(dx, dy);
          if (dx !== 0 || dy !== 0) events.push({ type: 'dragMove' });
          break;
        }
        if (this.swiped) break;
        this.travel.x += rawDx;
        const within = tMs - this.poseSince <= o.swipeWindowMs;
        if (within && Math.abs(this.travel.x) >= o.swipeDistance) {
          this.swiped = true;
          events.push({ type: 'swipe', direction: this.travel.x > 0 ? 'right' : 'left' });
        } else if (!within) {
          this.dragging = true;
          events.push({ type: 'dragStart' });
        }
        break;
      }
      default:
        break; // 0 (fist) and 1 (click) do not move anything.
    }
  }

  private moveCursor(dx: number, dy: number): void {
    this.cursor = {
      x: clamp01(this.cursor.x + dx * this.options.gain),
      y: clamp01(this.cursor.y + dy * this.options.gain),
    };
  }

  private transition(to: Pose, tMs: number, events: GestureEvent[]): void {
    const from = this.pose;
    if (from === 2 && !this.scrolled) events.push({ type: 'rightClick' });
    if (from === 3 && this.dragging) events.push({ type: 'dragEnd' });

    this.pose = to;
    this.poseSince = tMs;
    this.travel = { x: 0, y: 0 };
    this.scrolled = false;
    this.dragging = false;
    this.swiped = false;
    events.push({ type: 'pose', pose: to });
    if (to === 1) events.push({ type: 'click' });
  }
}
