import { countLongFingers } from './fingers.js';
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
  | { type: 'swipe'; direction: 'left' | 'right' }
  | { type: 'zoomStart' }
  /** Zoom relative to when zoom mode started: hands apart > 1, closer < 1. */
  | { type: 'zoom'; factor: number }
  | { type: 'zoomEnd' };

export interface EngineOptions {
  /** The hand that moves the cursor. The other hand is the reference (anchor + clutch). */
  dominant: Handedness;
  /** Camera frame width / height, so finger angles are measured without distortion. */
  aspect: number;
  /** How long a new finger count must hold before it is accepted. */
  stableMs: number;
  /** Cursor travel (fraction of screen) per unit of hand travel (fraction of camera frame). */
  gain: number;
  /** Pointer acceleration: slow hand movement is fine-grained, fast movement travels further. */
  acceleration: boolean;
  /** One Euro filter for the cursor: jitter cutoff (Hz) at rest, and how fast it opens up with speed. */
  cursorMinCutoff: number;
  cursorBeta: number;
  /** Scroll pixels per unit of hand travel. */
  scrollGain: number;
  /** Natural scrolling (content follows the hand, like a Mac trackpad). false = classic/reversed. */
  naturalScroll: boolean;
  /** Hand travel needed before a 2-finger pose becomes a scroll instead of a right click. */
  scrollDeadzone: number;
  /** A 3-finger pose that travels `swipeDistance` within `swipeWindowMs` is a tab swipe, otherwise a drag. */
  swipeWindowMs: number;
  swipeDistance: number;
  /** Reference hand with at least this many long fingers activates the clutch. Lowering the hand pauses it. */
  clutchOpenMin: number;
  /** Reference hand with at most this many long fingers counts as a fist (= zoom mode, ADR-016). */
  fistMaxFingers: number;
  /** How long the reference fist must hold before zoom mode starts. */
  zoomHoldMs: number;
  /** Minimum change in zoom factor before a new zoom event is emitted. */
  zoomDeadzone: number;
}

export const DEFAULT_OPTIONS: EngineOptions = {
  dominant: 'Right',
  aspect: 1,
  stableMs: 150,
  gain: 3,
  acceleration: true,
  cursorMinCutoff: 1,
  cursorBeta: 15,
  scrollGain: 2500,
  naturalScroll: true,
  scrollDeadzone: 0.02,
  swipeWindowMs: 300,
  swipeDistance: 0.08,
  clutchOpenMin: 3,
  fistMaxFingers: 0,
  zoomHoldMs: 300,
  zoomDeadzone: 0.02,
};

export interface Point {
  x: number;
  y: number;
}

export interface EngineFrame {
  clutch: ClutchState;
  /** Unstabilized count of extended long fingers (0–4, thumb ignored) of the motion hand, if visible. */
  rawFingers: number | null;
  /** Accepted (stabilized) pose while the clutch is active. */
  pose: Pose | null;
  /** Cursor position in normalized screen coordinates (0..1). */
  cursor: Point;
  dragging: boolean;
  /** Two-hand zoom mode (reference hand shows V). */
  zooming: boolean;
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

/** Long-finger count → pose. All four long fingers = open hand (5); the thumb is ignored. */
function toPose(longFingers: number): Pose {
  if (longFingers >= 4) return 5;
  return longFingers as Pose;
}

/** Hand speed (frame fractions per second) below which the cursor is at its finest, and above which at its fastest. */
const ACCEL_SLOW = 0.05;
const ACCEL_FAST = 0.6;
const ACCEL_MIN = 0.5;
const ACCEL_MAX = 1.8;

/** Pointer acceleration, like a trackpad: precise when slow, far-reaching when fast. */
export function accelerationScale(speed: number): number {
  const t = Math.min(1, Math.max(0, (speed - ACCEL_SLOW) / (ACCEL_FAST - ACCEL_SLOW)));
  return ACCEL_MIN + (ACCEL_MAX - ACCEL_MIN) * t;
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
  private lastMoveT: number | null = null;
  private readonly fx: OneEuroFilter;
  private readonly fy: OneEuroFilter;

  // Per-pose accumulators.
  private travel: Point = { x: 0, y: 0 };
  private scrolled = false;
  private dragging = false;
  private swiped = false;

  // Two-hand zoom.
  private zooming = false;
  private fistSince: number | null = null;
  private zoomD0 = 0;
  private lastZoomFactor = 1;
  private readonly fz: OneEuroFilter;

  constructor(options: Partial<EngineOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    const { cursorMinCutoff, cursorBeta } = this.options;
    this.fx = new OneEuroFilter(cursorMinCutoff, cursorBeta);
    this.fy = new OneEuroFilter(cursorMinCutoff, cursorBeta);
    this.fz = new OneEuroFilter(cursorMinCutoff, cursorBeta);
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
    const rawFingers = motion ? countLongFingers(motion.landmarks, this.options.aspect) : null;

    if (this.clutch === 'active' && motion && reference && rawFingers !== null) {
      this.updateActive(motion, reference, rawFingers, tMs, events);
    }

    return {
      clutch: this.clutch,
      rawFingers,
      pose: this.pose,
      cursor: { ...this.cursor },
      dragging: this.dragging,
      zooming: this.zooming,
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
      // Open hand activates; anything else (including a fist = zoom) keeps the current state.
      // Pausing is done by lowering the reference hand out of the frame (ADR-016).
      const f = countLongFingers(reference.landmarks, this.options.aspect);
      if (f >= this.options.clutchOpenMin) next = 'active';
      else next = this.clutch === 'active' ? 'active' : 'paused';
    }
    if (next === this.clutch) return;
    if (this.clutch === 'active') this.deactivate(events);
    this.clutch = next;
    events.push({ type: 'clutch', state: next });
  }

  private deactivate(events: GestureEvent[]): void {
    if (this.dragging) events.push({ type: 'dragEnd' });
    if (this.zooming) events.push({ type: 'zoomEnd' });
    this.zooming = false;
    this.fistSince = null;
    this.dragging = false;
    this.pose = null;
    this.candidate = null;
    this.lastRel = null;
    this.lastRawRel = null;
    this.lastMoveT = null;
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
    if (this.updateZoom(motion, reference, tMs, events)) return;

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
    const prevT = this.lastMoveT;
    this.lastRel = rel;
    this.lastRawRel = raw;
    this.lastMoveT = tMs;
    if (!prev || !prevRaw) return;
    const elapsed = prevT === null ? 0 : (tMs - prevT) / 1000;
    const dt = elapsed > 0 && elapsed < 0.25 ? elapsed : 1 / 30;

    // Freeze the cursor while a pose change is pending, so clicks land where they were aimed.
    if (this.candidate !== this.pose) return;

    // Camera image is not mirrored: the user moving right decreases image x.
    const dx = -(rel.x - prev.x);
    const dy = rel.y - prev.y;
    // Swipes are fast, so they use the unfiltered position to avoid smoothing lag.
    const rawDx = -(raw.x - prevRaw.x);
    this.applyPose(dx, dy, rawDx, dt, tMs, events);
  }

  /**
   * Reference hand fist (held for zoomHoldMs) = zoom mode: the distance between the palms,
   * relative to the distance when the mode started, is the zoom factor.
   * Returns true while zooming, so the motion hand does nothing else.
   */
  private updateZoom(motion: HandInput, reference: HandInput, tMs: number, events: GestureEvent[]): boolean {
    const o = this.options;
    const isFist = countLongFingers(reference.landmarks, o.aspect) <= o.fistMaxFingers;
    if (!isFist) this.fistSince = null;
    else if (this.fistSince === null) this.fistSince = tMs;
    const want = this.fistSince !== null && tMs - this.fistSince >= o.zoomHoldMs;

    const m = palmCenter(motion.landmarks);
    const r = palmCenter(reference.landmarks);
    const d = Math.hypot(m.x - r.x, m.y - r.y);

    if (want && !this.zooming) {
      if (this.dragging) events.push({ type: 'dragEnd' });
      this.dragging = false;
      this.zooming = true;
      this.zoomD0 = Math.max(d, 1e-3);
      this.lastZoomFactor = 1;
      this.fz.reset();
      events.push({ type: 'zoomStart' });
    } else if (!want && this.zooming) {
      this.zooming = false;
      events.push({ type: 'zoomEnd' });
      // Resume cursor tracking from here, without a jump.
      this.lastRel = null;
      this.lastRawRel = null;
      this.lastMoveT = null;
      this.fx.reset();
      this.fy.reset();
    }
    if (!this.zooming) return false;

    const factor = this.fz.filter(d / this.zoomD0, tMs);
    if (Math.abs(factor - this.lastZoomFactor) >= o.zoomDeadzone) {
      this.lastZoomFactor = factor;
      events.push({ type: 'zoom', factor });
    }
    return true;
  }

  private applyPose(dx: number, dy: number, rawDx: number, dt: number, tMs: number, events: GestureEvent[]): void {
    const o = this.options;
    switch (this.pose) {
      case 5:
        this.moveCursor(dx, dy, dt);
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
          this.moveCursor(dx, dy, dt);
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

  private moveCursor(dx: number, dy: number, dt: number): void {
    const gain = this.options.gain * (this.options.acceleration ? accelerationScale(Math.hypot(dx, dy) / dt) : 1);
    this.cursor = {
      x: clamp01(this.cursor.x + dx * gain),
      y: clamp01(this.cursor.y + dy * gain),
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
