import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { GestureEngine, type EngineFrame, type HandInput, type Handedness } from '@mrp/gesture-engine';
import { engineOptions, type FrameMessage, type Message, type Settings, type TrackerStatus } from '@/utils/messages';

/**
 * Offscreen document: camera + MediaPipe + GestureEngine. Survives tab switches.
 * Only chrome.runtime is available here, so settings come from the service worker.
 */
const video = document.getElementById('video') as HTMLVideoElement;
const FRAME_INTERVAL_MS = 33; // rAF does not run in hidden documents
let settings: Settings;
let engine: GestureEngine;
let landmarker: HandLandmarker;
let frames = 0;
/** Asset URLs are generated at build time (scripts/fetch-assets.mjs), so they are not in WXT's typed paths. */
const assetUrl = (path: string) => (browser.runtime.getURL as (p: string) => string)(path);
let fps = 0;
let fpsWindowStart = performance.now();

const send = (msg: Message) => browser.runtime.sendMessage(msg).catch(() => {});
const setStatus = (status: TrackerStatus, detail?: string) => send({ type: 'tracker-status', status, detail });
const describe = (stage: string, err: unknown) =>
  `${stage}: ${err instanceof Error ? `${err.name} ${err.message}` : typeof err === 'object' && err && 'type' in err ? `event ${(err as Event).type}` : String(err)}`;

async function createLandmarker(): Promise<HandLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(assetUrl('/mediapipe/wasm'));
  const modelAssetPath = assetUrl('/mediapipe/hand_landmarker.task');
  const make = (delegate: 'GPU' | 'CPU') =>
    HandLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath, delegate }, runningMode: 'VIDEO', numHands: 2 });
  try {
    return await make('GPU');
  } catch (err) {
    console.warn('[mrp] GPU delegate failed, falling back to CPU', err);
    return make('CPU');
  }
}

async function start(): Promise<void> {
  void setStatus('starting');
  settings = (await browser.runtime.sendMessage({ type: 'get-settings' } satisfies Message)) as Settings;
  engine = new GestureEngine(engineOptions(settings));
  try {
    video.srcObject = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (err) {
    const name = (err as DOMException).name;
    void setStatus(name === 'NotAllowedError' ? 'no-permission' : 'error', describe('camera', err));
    return;
  }
  try {
    landmarker = await createLandmarker();
  } catch (err) {
    console.error('[mrp] model load failed', err);
    void setStatus('error', describe('model', err));
    return;
  }
  try {
    await video.play();
  } catch (err) {
    void setStatus('error', describe('video', err));
    return;
  }
  void setStatus('running');
  loop();
}

let lastVideoTime = -1;
function loop(): void {
  const t = performance.now();
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = landmarker.detectForVideo(video, t);
    const detectMs = Math.round(performance.now() - t);
    const hands = toHandInputs(result);
    const frame = engine.update(hands, t);
    tickFps(t);
    void send(toMessage(hands, frame, detectMs));
  }
  setTimeout(loop, Math.max(0, FRAME_INTERVAL_MS - (performance.now() - t)));
}

/** MediaPipe labels hands as if the image were mirrored; we pass the raw frame (ADR-011). */
function toHandInputs(result: HandLandmarkerResult): HandInput[] {
  return result.landmarks.map((landmarks, i) => {
    const label: Handedness = result.handedness[i]?.[0]?.categoryName === 'Left' ? 'Left' : 'Right';
    const handedness: Handedness = settings.swapHandedness ? (label === 'Left' ? 'Right' : 'Left') : label;
    return { landmarks, handedness };
  });
}

function toMessage(hands: HandInput[], f: EngineFrame, detectMs: number): FrameMessage {
  return {
    type: 'frame',
    clutch: f.clutch,
    pose: f.pose,
    rawFingers: f.rawFingers,
    cursor: f.cursor,
    dragging: f.dragging,
    events: f.events,
    fps,
    detectMs,
    hands: hands.map((h, i) => ({
      points: h.landmarks.map((p) => [Math.round(p.x * 1000) / 1000, Math.round(p.y * 1000) / 1000] as [number, number]),
      role: i === f.motionIndex ? 'motion' : i === f.referenceIndex ? 'reference' : 'other',
    })),
  };
}

function tickFps(now: number): void {
  frames++;
  if (now - fpsWindowStart >= 1000) {
    fps = Math.round((frames * 1000) / (now - fpsWindowStart));
    frames = 0;
    fpsWindowStart = now;
  }
}

browser.runtime.onMessage.addListener((msg: Message) => {
  if (msg.type !== 'settings') return;
  settings = msg.settings;
  engine?.setOptions(engineOptions(settings));
});

void start();
