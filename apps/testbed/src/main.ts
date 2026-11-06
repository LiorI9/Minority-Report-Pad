import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { countFingers, type HandLandmarks } from '@mrp/gesture-engine';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const video = $<HTMLVideoElement>('video');
const canvas = $<HTMLCanvasElement>('overlay');
const ctx = canvas.getContext('2d')!;
const statusEl = $('status');
const handsEl = $('hands');
const fpsEl = $('fps');
const latencyEl = $('latency');

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

let landmarker: HandLandmarker | undefined;
let lastVideoTime = -1;
let frames = 0;
let fpsWindowStart = performance.now();

async function start(): Promise<void> {
  $('start').setAttribute('disabled', '');
  try {
    statusEl.textContent = 'טוען מודל…';
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    });
    statusEl.textContent = 'מבקש גישה למצלמה…';
    video.srcObject = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    await video.play();
    statusEl.textContent = `מצלמה פעילה · ${video.videoWidth}×${video.videoHeight}`;
    requestAnimationFrame(loop);
  } catch (err) {
    statusEl.textContent = `שגיאה: ${(err as Error).message}`;
    $('start').removeAttribute('disabled');
  }
}

function loop(): void {
  if (landmarker && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const t0 = performance.now();
    const result = landmarker.detectForVideo(video, t0);
    latencyEl.textContent = `${(performance.now() - t0).toFixed(1)} ms`;
    render(result);
    tickFps();
  }
  requestAnimationFrame(loop);
}

function tickFps(): void {
  frames++;
  const now = performance.now();
  if (now - fpsWindowStart >= 1000) {
    fpsEl.textContent = String(Math.round((frames * 1000) / (now - fpsWindowStart)));
    frames = 0;
    fpsWindowStart = now;
  }
}

function render(result: HandLandmarkerResult): void {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  handsEl.innerHTML = '';
  if (result.landmarks.length === 0) {
    handsEl.innerHTML = '<dt>ידיים</dt><dd>לא זוהו</dd>';
    return;
  }

  result.landmarks.forEach((hand: HandLandmarks, i) => {
    drawHand(hand);
    // The preview is mirrored, so MediaPipe's handedness matches the user's own hand.
    const side = result.handedness[i]?.[0]?.categoryName === 'Left' ? 'שמאל' : 'ימין';
    handsEl.insertAdjacentHTML('beforeend', `<dt>יד ${side}</dt><dd class="big">${countFingers(hand)}</dd>`);
  });
}

function drawHand(hand: HandLandmarks): void {
  const { width: w, height: h } = canvas;
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 3;
  for (const [a, b] of CONNECTIONS) {
    const p = hand[a];
    const q = hand[b];
    if (!p || !q) continue;
    ctx.beginPath();
    ctx.moveTo(p.x * w, p.y * h);
    ctx.lineTo(q.x * w, q.y * h);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  for (const p of hand) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

$('start').addEventListener('click', () => void start());
