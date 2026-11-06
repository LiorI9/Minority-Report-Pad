/**
 * One Euro filter (Casiez et al., 2012): smooths jitter at low speed while
 * staying responsive at high speed. Timestamps are in milliseconds.
 */
export class OneEuroFilter {
  private prevX: number | undefined;
  private prevDx = 0;
  private prevT: number | undefined;

  constructor(
    private readonly minCutoff = 1.0,
    private readonly beta = 0.007,
    private readonly dCutoff = 1.0,
  ) {}

  reset(): void {
    this.prevX = undefined;
    this.prevT = undefined;
    this.prevDx = 0;
  }

  filter(x: number, tMs: number): number {
    if (this.prevX === undefined || this.prevT === undefined || tMs <= this.prevT) {
      this.prevX = x;
      this.prevT = tMs;
      return x;
    }
    const dt = (tMs - this.prevT) / 1000;
    const dx = (x - this.prevX) / dt;
    const edx = lerp(this.prevDx, dx, alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const ex = lerp(this.prevX, x, alpha(cutoff, dt));
    this.prevX = ex;
    this.prevDx = edx;
    this.prevT = tMs;
    return ex;
  }
}

function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
