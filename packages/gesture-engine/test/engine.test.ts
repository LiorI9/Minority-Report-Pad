import { describe, expect, it } from 'vitest';
import { GestureEngine, type EngineFrame, type GestureEvent, type HandInput } from '../src/index.js';
import { FIST, ONE, OPEN, THREE, TWO, hand, type Open } from './hands.js';

const FRAME = 33;

/** Drives the engine with a reference hand on the user's left and a motion hand on the right. */
function driver(engine = new GestureEngine({ stableMs: 100 })) {
  let t = 0;
  const events: GestureEvent[] = [];
  const step = (motion: Open, opts: { ref?: Open; dx?: number; dy?: number; frames?: number } = {}) => {
    const { ref = OPEN, dx = 0, dy = 0, frames = 1 } = opts;
    let frame: EngineFrame | undefined;
    for (let i = 0; i < frames; i++) {
      t += FRAME;
      // Image is not mirrored: user's right hand appears on the image's left.
      const hands: HandInput[] = [
        { handedness: 'Right', landmarks: hand(motion, -0.25 + dx * (i + 1), dy * (i + 1)) },
        { handedness: 'Left', landmarks: hand(ref, 0.25, 0) },
      ];
      frame = engine.update(hands, t);
      events.push(...frame.events);
    }
    if (!frame) throw new Error('frames must be >= 1');
    return frame;
  };
  const types = () => events.map((e) => e.type);
  const clear = () => (events.length = 0);
  return { step, events, types, clear, engine };
}

describe('GestureEngine clutch', () => {
  it('is active when the reference hand is open', () => {
    const d = driver();
    expect(d.step(OPEN).clutch).toBe('active');
  });
  it('pauses on a reference fist and ignores motion-hand poses', () => {
    const d = driver();
    const f = d.step(ONE, { ref: FIST, frames: 10 });
    expect(f.clutch).toBe('paused');
    expect(d.types()).not.toContain('click');
  });
  it('reports no-hands when nothing is visible', () => {
    const engine = new GestureEngine();
    expect(engine.update([], 0).clutch).toBe('no-hands');
  });
});

describe('GestureEngine poses', () => {
  it('waits for the pose to be stable before clicking', () => {
    const d = driver();
    d.step(OPEN, { frames: 5 });
    d.clear();
    d.step(ONE, { frames: 2 }); // 66ms < 100ms
    expect(d.types()).not.toContain('click');
    d.step(ONE, { frames: 3 });
    expect(d.types().filter((t) => t === 'click')).toHaveLength(1);
  });

  it('moves the cursor with an open hand, in the user direction', () => {
    const d = driver();
    const before = d.step(OPEN, { frames: 5 }).cursor;
    // User moves right => image x decreases.
    const after = d.step(OPEN, { dx: -0.01, frames: 10 }).cursor;
    expect(after.x).toBeGreaterThan(before.x);
  });

  it('turns a still two-finger pose into a right click', () => {
    const d = driver();
    d.step(OPEN, { frames: 5 });
    d.clear();
    d.step(TWO, { frames: 6 });
    d.step(OPEN, { frames: 6 });
    expect(d.types()).toContain('rightClick');
    expect(d.types()).not.toContain('scroll');
  });

  it('turns a moving two-finger pose into scrolling, without a right click', () => {
    const d = driver();
    d.step(OPEN, { frames: 5 });
    d.step(TWO, { frames: 6 });
    d.clear();
    d.step(TWO, { dy: -0.01, frames: 10 }); // hand up
    d.step(OPEN, { frames: 6 });
    const scrolls = d.events.filter((e) => e.type === 'scroll');
    expect(scrolls.length).toBeGreaterThan(0);
    // Natural scrolling: hand up scrolls the page down (positive dy).
    expect(scrolls.every((e) => e.type === 'scroll' && e.dy > 0)).toBe(true);
    expect(d.types()).not.toContain('rightClick');
  });

  it('reverses scrolling when natural scrolling is off', () => {
    const d = driver(new GestureEngine({ stableMs: 100, naturalScroll: false }));
    d.step(OPEN, { frames: 5 });
    d.step(TWO, { frames: 6 });
    d.clear();
    d.step(TWO, { dy: -0.01, frames: 10 }); // hand up
    const scrolls = d.events.filter((e) => e.type === 'scroll');
    expect(scrolls.length).toBeGreaterThan(0);
    expect(scrolls.every((e) => e.type === 'scroll' && e.dy < 0)).toBe(true);
  });

  it('turns a fast three-finger sideways move into a swipe', () => {
    const d = driver();
    d.step(OPEN, { frames: 5 });
    d.step(THREE, { frames: 4 });
    d.clear();
    d.step(THREE, { dx: -0.03, frames: 5 }); // user moves right
    expect(d.events).toContainEqual({ type: 'swipe', direction: 'right' });
    expect(d.types()).not.toContain('dragStart');
  });

  it('turns a held three-finger pose into a drag', () => {
    const d = driver();
    d.step(OPEN, { frames: 5 });
    d.clear();
    d.step(THREE, { frames: 20 });
    d.step(THREE, { dx: -0.005, frames: 5 });
    d.step(OPEN, { frames: 6 });
    const t = d.types();
    expect(t).toContain('dragStart');
    expect(t).toContain('dragMove');
    expect(t).toContain('dragEnd');
    expect(t).not.toContain('swipe');
  });

  it('ends a drag when the clutch is released', () => {
    const d = driver();
    d.step(OPEN, { frames: 5 });
    d.step(THREE, { frames: 20 });
    d.clear();
    d.step(THREE, { ref: FIST, frames: 2 });
    expect(d.types()).toContain('dragEnd');
  });
});
