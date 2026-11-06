import type { ClutchState, GestureEvent, Pose } from '@mrp/gesture-engine';

export interface Settings {
  dominant: 'Right' | 'Left';
  swapHandedness: boolean;
  gain: number;
  stableMs: number;
  /** Scroll pixels per unit of hand travel. */
  scrollGain: number;
  naturalScroll: boolean;
  /** Which tab a rightward swipe opens. */
  swipeRight: 'next' | 'previous';
}

export const DEFAULT_SETTINGS: Settings = {
  dominant: 'Right',
  swapHandedness: true,
  gain: 3,
  stableMs: 150,
  scrollGain: 2500,
  naturalScroll: true,
  swipeRight: 'next',
};

/** The subset of settings the gesture engine consumes. */
export const engineOptions = (s: Settings) => ({
  dominant: s.dominant,
  gain: s.gain,
  stableMs: s.stableMs,
  scrollGain: s.scrollGain,
  naturalScroll: s.naturalScroll,
});

/** One processed camera frame, as sent from the offscreen document. */
export interface FrameMessage {
  type: 'frame';
  clutch: ClutchState;
  pose: Pose | null;
  rawFingers: number | null;
  cursor: { x: number; y: number };
  dragging: boolean;
  events: GestureEvent[];
  /** Simplified landmarks for the popup preview: [x, y] per point, per hand; and role per hand. */
  hands: { points: [number, number][]; role: 'motion' | 'reference' | 'other' }[];
  fps: number;
  /** MediaPipe detection time for this frame, ms. */
  detectMs: number;
}

export type TrackerStatus = 'starting' | 'running' | 'no-permission' | 'error';

export type Message =
  | FrameMessage
  | { type: 'tracker-status'; status: TrackerStatus; detail?: string }
  | { type: 'settings'; settings: Settings }
  | { type: 'get-state' }
  | { type: 'get-settings' }
  | { type: 'set-enabled'; enabled: boolean };

export interface PopupState {
  enabled: boolean;
  status: TrackerStatus | 'off';
  detail?: string;
  settings: Settings;
}

/** Messages to the content script. */
export type ContentMessage = { type: 'frame'; frame: FrameMessage } | { type: 'disable' } | { type: 'ping' };

export async function loadSettings(): Promise<Settings> {
  const { settings } = await browser.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings> | undefined) };
}
