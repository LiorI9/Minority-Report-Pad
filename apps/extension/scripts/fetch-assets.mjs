// Copies MediaPipe WASM and downloads the hand model into public/, so the
// extension ships them locally (MV3 forbids remotely hosted code).
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'mediapipe');
const require = createRequire(import.meta.url);
const wasmDir = join(dirname(require.resolve('@mediapipe/tasks-vision')), 'wasm');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// SIMD + no-SIMD fallback (MediaPipe picks at runtime; some Chromium builds report no SIMD).
// The ES-module variants are not used.
rmSync(join(out, 'wasm'), { recursive: true, force: true });
mkdirSync(join(out, 'wasm'), { recursive: true });
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) copyFileSync(join(wasmDir, f), join(out, 'wasm', f));

const model = join(out, 'hand_landmarker.task');
if (!existsSync(model)) {
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Model download failed: ${res.status}`);
  writeFileSync(model, Buffer.from(await res.arrayBuffer()));
  console.log('Downloaded hand_landmarker.task');
}
