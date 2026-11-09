/** One hand as sent by the tracker: [x, y] in camera-image coordinates (0..1), and its role. */
export interface HandPoints {
  points: [number, number][];
  role: 'motion' | 'reference' | 'other';
}

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const COLOR = { motion: '#f5c518', reference: '#58a6ff', other: '#8b98a5' } as const;

/**
 * Translucent full-viewport hand skeletons (ADR-015). Mirrored so the presenter sees
 * their hands as in a mirror, and fitted to the viewport by the camera aspect ratio.
 */
export class HandsOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private enabled = false;

  constructor(root: ParentNode) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText =
      'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483646;opacity:0.5;';
    this.canvas.hidden = true;
    this.ctx = this.canvas.getContext('2d')!;
    root.append(this.canvas);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.canvas.hidden = !enabled;
    if (!enabled) this.clear();
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(hands: HandPoints[], aspect: number): void {
    if (!this.enabled) return;
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (this.canvas.width !== Math.round(W * dpr) || this.canvas.height !== Math.round(H * dpr)) {
      this.canvas.width = Math.round(W * dpr);
      this.canvas.height = Math.round(H * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Fit the camera frame inside the viewport (contain), centered.
    const a = aspect > 0 ? aspect : 16 / 9;
    const fw = Math.min(W, H * a);
    const fh = fw / a;
    const ox = (W - fw) / 2;
    const oy = (H - fh) / 2;
    const map = ([x, y]: [number, number]) => [ox + (1 - x) * fw, oy + y * fh] as const;
    ctx.lineCap = 'round';
    for (const hand of hands) {
      ctx.strokeStyle = COLOR[hand.role];
      ctx.fillStyle = COLOR[hand.role];
      ctx.lineWidth = 6;
      for (const [i, j] of CONNECTIONS) {
        const p = hand.points[i];
        const q = hand.points[j];
        if (!p || !q) continue;
        const [x1, y1] = map(p);
        const [x2, y2] = map(q);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      for (const p of hand.points) {
        const [x, y] = map(p);
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
