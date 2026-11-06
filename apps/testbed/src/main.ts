import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { GestureEngine, type EngineFrame, type GestureEvent, type HandInput, type Handedness } from '@mrp/gesture-engine';
import { SyntheticInput, mountCursor, type CursorMode } from '@mrp/page-input';
import { EventLog } from './log';
import { setupTargets } from './targets';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const video = $<HTMLVideoElement>('video');
const canvas = $<HTMLCanvasElement>('overlay');
const ctx = canvas.getContext('2d')!;
const ui = {
  status: $('status'),
  badge: $('clutch-badge'),
  clutch: $('clutch'),
  raw: $('raw'),
  pose: $('pose'),
  motionHand: $('motion-hand'),
  fps: $('fps'),
  latency: $('latency'),
  toast: $('toast'),
  dominant: $<HTMLSelectElement>('dominant'),
  swap: $<HTMLInputElement>('swap'),
  gain: $<HTMLInputElement>('gain'),
  stable: $<HTMLInputElement>('stable'),
  control: $<HTMLInputElement>('control'),
};

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const CLUTCH_LABEL = { 'no-hands': 'אין ידיים', paused: 'מושהה', active: 'פעיל' } as const;
const HAND_LABEL: Record<Handedness, string> = { Right: 'ימין', Left: 'שמאל' };
const POSE_LABEL: Record<number, string> = { 0: 'אגרוף', 1: '1 · לחיצה', 2: '2 · ימנית/גלילה', 3: '3 · גרירה/טאב', 5: '5 · תזוזה' };

const engine = new GestureEngine();
const input = new SyntheticInput(mountCursor(document.body));
const log = new EventLog($<HTMLTableSectionElement>('log-body'));
setupTargets();
log.watch(['click', 'contextmenu', 'mousedown', 'mouseup', 'wheel', 'scroll', 'dragstart', 'drop']);
$('clear-log').addEventListener('click', () => log.clear());

// --- Layout: full screen + collapsible panels ------------------------------
const fsButton = $('fullscreen');
function setFullscreen(on: boolean): void {
  document.body.classList.toggle('fs', on);
  fsButton.textContent = on ? '▣ תצוגה רגילה' : '⛶ מסך מלא';
  // On narrow screens start with the busy panels collapsed.
  if (on && window.innerWidth < 760) {
    document.querySelectorAll('.overlay-targets, .overlay-log').forEach((el) => setCollapsed(el, true));
  }
  if (!on) document.querySelectorAll('.collapsed').forEach((el) => setCollapsed(el, false));
  // Real browser full screen where supported (not on iPhone Safari).
  const root = document.documentElement;
  if (on && !document.fullscreenElement && root.requestFullscreen) void root.requestFullscreen().catch(() => {});
  if (!on && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
}
function setCollapsed(panel: Element, collapsed: boolean): void {
  panel.classList.toggle('collapsed', collapsed);
  const btn = panel.querySelector('.collapse');
  if (btn) btn.textContent = collapsed ? '+' : '–';
}
fsButton.addEventListener('click', () => setFullscreen(!document.body.classList.contains('fs')));
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && document.body.classList.contains('fs')) setFullscreen(false);
});
document.querySelectorAll('.collapse').forEach((btn) =>
  btn.addEventListener('click', () => {
    const panel = btn.closest('section');
    if (panel) setCollapsed(panel, !panel.classList.contains('collapsed'));
  }),
);

// --- Settings ---------------------------------------------------------------
function applySettings(): void {
  engine.setOptions({
    dominant: ui.dominant.value as Handedness,
    gain: Number(ui.gain.value),
    stableMs: Number(ui.stable.value),
  });
  $('gain-out').textContent = ui.gain.value;
  $('stable-out').textContent = ui.stable.value;
}
[ui.dominant, ui.gain, ui.stable].forEach((el) => el.addEventListener('input', applySettings));
applySettings();

// --- Camera + model ---------------------------------------------------------
let landmarker: HandLandmarker | undefined;
let lastVideoTime = -1;
let frames = 0;
let fpsWindowStart = performance.now();

async function start(): Promise<void> {
  $('start').setAttribute('disabled', '');
  try {
    ui.status.textContent = 'טוען מודל…';
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    });
    ui.status.textContent = 'מבקש גישה למצלמה…';
    video.srcObject = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    await video.play();
    ui.status.textContent = `מצלמה פעילה · ${video.videoWidth}×${video.videoHeight}`;
    requestAnimationFrame(loop);
  } catch (err) {
    ui.status.textContent = `שגיאה: ${(err as Error).message}`;
    $('start').removeAttribute('disabled');
  }
}
$('start').addEventListener('click', () => void start());

function loop(): void {
  if (landmarker && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const t0 = performance.now();
    const result = landmarker.detectForVideo(video, t0);
    ui.latency.textContent = `${(performance.now() - t0).toFixed(1)} ms`;
    const hands = toHandInputs(result);
    const frame = engine.update(hands, t0);
    render(hands, frame);
    handle(frame);
    tickFps();
  }
  requestAnimationFrame(loop);
}

/**
 * MediaPipe labels handedness assuming a mirrored (selfie) image. We feed the raw
 * camera frame, so by default we swap the labels to get the user's real hand.
 */
function toHandInputs(result: HandLandmarkerResult): HandInput[] {
  return result.landmarks.map((landmarks, i) => {
    const label = result.handedness[i]?.[0]?.categoryName === 'Left' ? 'Left' : 'Right';
    const handedness: Handedness = ui.swap.checked ? (label === 'Left' ? 'Right' : 'Left') : label;
    return { landmarks, handedness };
  });
}

function tickFps(): void {
  frames++;
  const now = performance.now();
  if (now - fpsWindowStart >= 1000) {
    ui.fps.textContent = String(Math.round((frames * 1000) / (now - fpsWindowStart)));
    frames = 0;
    fpsWindowStart = now;
  }
}

// --- Rendering --------------------------------------------------------------
function render(hands: HandInput[], frame: EngineFrame): void {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hands.forEach((h, i) => {
    const color = i === frame.motionIndex ? '#f5c518' : i === frame.referenceIndex ? '#58a6ff' : '#8b98a5';
    drawHand(h, color);
  });

  ui.badge.textContent = CLUTCH_LABEL[frame.clutch];
  ui.badge.className = `badge ${frame.clutch}`;
  ui.clutch.textContent = CLUTCH_LABEL[frame.clutch];
  ui.raw.textContent = frame.rawFingers === null ? '–' : String(frame.rawFingers);
  ui.pose.textContent = frame.pose === null ? '–' : (POSE_LABEL[frame.pose] ?? String(frame.pose));
  const motion = frame.motionIndex === null ? undefined : hands[frame.motionIndex];
  ui.motionHand.textContent = motion ? HAND_LABEL[motion.handedness] : '–';
}

function drawHand(hand: HandInput, color: string): void {
  const { width: w, height: h } = canvas;
  const lm = hand.landmarks;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  for (const [a, b] of CONNECTIONS) {
    const p = lm[a];
    const q = lm[b];
    if (!p || !q) continue;
    ctx.beginPath();
    ctx.moveTo(p.x * w, p.y * h);
    ctx.lineTo(q.x * w, q.y * h);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  for (const p of lm) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Gesture events → page --------------------------------------------------
let toastTimer: number | undefined;
function toast(text: string): void {
  ui.toast.textContent = text;
  ui.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (ui.toast.hidden = true), 900);
}

function handle(frame: EngineFrame): void {
  const control = ui.control.checked;
  input.setVisible(control && frame.clutch === 'active');
  input.setMode(cursorMode(frame));
  if (control) input.move(frame.cursor.x * window.innerWidth, frame.cursor.y * window.innerHeight);

  for (const e of frame.events) {
    logGesture(e);
    if (!control) continue;
    switch (e.type) {
      case 'click': input.click(); break;
      case 'rightClick': input.rightClick(); break;
      case 'scroll': input.scroll(e.dx, e.dy); break;
      case 'dragStart': input.dragStart(); break;
      case 'dragEnd': input.dragEnd(); break;
      case 'swipe': toast(e.direction === 'right' ? 'טאב הבא ←' : '→ טאב קודם'); break;
      default: break;
    }
  }
  if (!control) input.dragEnd();
}

const MODE_BY_POSE: Record<number, CursorMode> = { 0: 'idle', 1: 'click', 2: 'scroll', 3: 'grab', 5: 'move' };
function cursorMode(frame: EngineFrame): CursorMode {
  return frame.pose === null ? 'move' : (MODE_BY_POSE[frame.pose] ?? 'move');
}

function logGesture(e: GestureEvent): void {
  switch (e.type) {
    case 'scroll':
    case 'dragMove':
      return; // too frequent; the DOM side of the log shows their effect
    case 'clutch': log.gesture('clutch', CLUTCH_LABEL[e.state]); break;
    case 'pose': log.gesture('pose', POSE_LABEL[e.pose] ?? String(e.pose)); break;
    case 'swipe': log.gesture('swipe', e.direction); break;
    default: log.gesture(e.type);
  }
}

// Debug handle for console experiments and automated checks.
Object.assign(window, { mrp: { engine, input, log } });
