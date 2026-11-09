import type { FrameMessage, Message, PopupState } from '@/utils/messages';
import { bindSettingsForm } from '@/utils/settings-form';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const toggle = $('toggle');
const statusEl = $('status');
const permission = $('permission');
const canvas = $<HTMLCanvasElement>('preview');
const ctx = canvas.getContext('2d')!;

const CLUTCH = { 'no-hands': 'אין ידיים', paused: 'מושהה', active: 'פעיל' } as const;
const POSE: Record<number, string> = { 0: 'אגרוף', 1: '1 · לחיצה', 2: '2 · ימנית/גלילה', 3: '3 · גרירה/טאב', 5: '5 · תזוזה' };
const STATUS: Record<PopupState['status'], string> = {
  off: 'כבוי · Alt+Shift+M להפעלה',
  starting: 'מפעיל מצלמה…',
  running: 'פעיל',
  'no-permission': 'אין הרשאת מצלמה',
  error: 'שגיאה',
};
const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const ROLE_COLOR = { motion: '#f5c518', reference: '#58a6ff', other: '#8b98a5' };

let enabled = false;

function renderState(s: PopupState): void {
  enabled = s.enabled;
  toggle.setAttribute('aria-checked', String(s.enabled));
  statusEl.textContent = STATUS[s.status] + (s.detail && s.status === 'error' ? ` · ${s.detail}` : '');
  statusEl.className = s.status === 'running' ? 'ok' : s.status === 'error' || s.status === 'no-permission' ? 'bad' : 'muted';
  permission.hidden = s.status !== 'no-permission';
  if (!s.enabled) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const id of ['clutch', 'pose', 'fps', 'detect']) $(id).textContent = '–';
  }
}

function renderFrame(f: FrameMessage): void {
  $('clutch').textContent = CLUTCH[f.clutch];
  $('pose').textContent = f.zooming ? 'זום (אגרוף ביד הייחוס)' : f.pose === null ? '–' : (POSE[f.pose] ?? String(f.pose));
  $('fps').textContent = String(f.fps || '–');
  $('detect').textContent = `\u200E${f.detectMs} ms`;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 2;
  for (const hand of f.hands) {
    ctx.strokeStyle = ROLE_COLOR[hand.role];
    for (const [a, b] of CONNECTIONS) {
      const p = hand.points[a];
      const q = hand.points[b];
      if (!p || !q) continue;
      ctx.beginPath();
      ctx.moveTo(p[0] * w, p[1] * h);
      ctx.lineTo(q[0] * w, q[1] * h);
      ctx.stroke();
    }
  }
}

const port = browser.runtime.connect({ name: 'popup' });
port.onMessage.addListener((msg: FrameMessage | { type: 'state'; state: PopupState }) => {
  if (msg.type === 'state') renderState(msg.state);
  else if (msg.type === 'frame') renderFrame(msg);
});

toggle.addEventListener('click', async () => {
  const s = (await browser.runtime.sendMessage({ type: 'set-enabled', enabled: !enabled } satisfies Message)) as PopupState;
  renderState(s);
});
const openOptions = (e?: Event) => {
  e?.preventDefault();
  void browser.runtime.openOptionsPage();
};
permission.addEventListener('click', () => openOptions());
$('options').addEventListener('click', openOptions);
void bindSettingsForm(document);
