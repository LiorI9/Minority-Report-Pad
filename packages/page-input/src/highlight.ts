const CLICKABLE =
  'a[href], button, input:not([type="hidden"]), select, textarea, summary, label, [role="button"], [role="link"], ' +
  '[role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [onclick], [tabindex]:not([tabindex="-1"])';

const HIGHLIGHT_CSS = `
.mrp-target { position: fixed; z-index: 2147483645; pointer-events: none; box-sizing: border-box; left: 0; top: 0;
  border: 2px solid #f5c518; border-radius: 8px; background: #f5c51814;
  box-shadow: 0 0 0 4px #f5c51826, 0 0 18px 2px #f5c51880;
  transition: transform 90ms ease-out, width 90ms ease-out, height 90ms ease-out, opacity 120ms; }
.mrp-target[hidden] { display: none; }
.mrp-target.hit { animation: mrp-hit 320ms ease-out; }
@keyframes mrp-hit {
  0% { box-shadow: 0 0 0 0 #f5c518cc, 0 0 18px 2px #f5c51880; background: #f5c51855; }
  100% { box-shadow: 0 0 0 22px #f5c51800, 0 0 18px 2px #f5c51880; background: #f5c51814; }
}
`;

/** The element a click at (x, y) would act on, if it is something clickable. */
export function clickableAt(x: number, y: number): Element | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const match = el.closest(CLICKABLE);
  if (match) return match;
  // Sites often make plain elements clickable with a pointer cursor.
  for (let node: Element | null = el, depth = 0; node && depth < 3; node = node.parentElement, depth++) {
    if (node === document.body || node === document.documentElement) break;
    if (getComputedStyle(node).cursor === 'pointer') return node;
  }
  return null;
}

/**
 * Glowing frame around the element the cursor is about to click (ADR-020).
 * It only shows what a click would hit; it never changes where the click lands.
 */
export class TargetHighlight {
  private readonly box: HTMLElement;
  private enabled = true;
  private current: Element | null = null;

  constructor(root: ParentNode) {
    const style = document.createElement('style');
    style.textContent = HIGHLIGHT_CSS;
    this.box = document.createElement('div');
    this.box.className = 'mrp-target';
    this.box.hidden = true;
    root.append(style, this.box);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.hide();
  }

  hide(): void {
    this.current = null;
    this.box.hidden = true;
  }

  /** Call every frame with the cursor position; `active` is false when no click could happen now. */
  update(x: number, y: number, active: boolean): void {
    if (!this.enabled || !active) return this.hide();
    const target = clickableAt(x, y);
    if (!target) return this.hide();
    const r = target.getBoundingClientRect();
    // Page-sized containers are not useful targets to frame.
    if (r.width === 0 || r.height === 0 || (r.width > innerWidth * 0.9 && r.height > innerHeight * 0.6)) return this.hide();
    const pad = 4;
    const firstShow = this.box.hidden || this.current === null;
    if (firstShow) this.box.style.transition = 'none';
    this.box.style.transform = `translate(${r.left - pad}px, ${r.top - pad}px)`;
    this.box.style.width = `${r.width + pad * 2}px`;
    this.box.style.height = `${r.height + pad * 2}px`;
    const radius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 4;
    this.box.style.borderRadius = `${Math.min(radius + pad, (r.height + pad * 2) / 2)}px`;
    this.box.hidden = false;
    if (firstShow) {
      void this.box.offsetWidth; // apply the position before re-enabling the transition
      this.box.style.transition = '';
    }
    this.current = target;
  }

  /** Flash on click. */
  pulse(): void {
    if (this.box.hidden) return;
    this.box.classList.remove('hit');
    void this.box.offsetWidth;
    this.box.classList.add('hit');
  }
}
