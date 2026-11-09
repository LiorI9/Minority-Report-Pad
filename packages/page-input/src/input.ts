/**
 * Injects synthetic pointer/mouse events at the virtual cursor position.
 * This mirrors what the extension's content script will do in 0.1 (isTrusted === false).
 */
export type CursorMode = 'move' | 'click' | 'scroll' | 'grab' | 'idle' | 'zoom';

export class SyntheticInput {
  private x = 0;
  private y = 0;
  private dragging = false;

  constructor(private readonly cursorEl: HTMLElement) {}

  private mode: CursorMode = 'move';

  /** Cursor look follows the motion-hand pose. */
  setMode(mode: CursorMode): void {
    if (mode === this.mode) return;
    this.cursorEl.classList.replace(`mode-${this.mode}`, `mode-${mode}`);
    this.mode = mode;
  }

  /** Small text under the cursor (e.g. zoom level); empty hides it. */
  setLabel(text: string): void {
    const label = this.cursorEl.querySelector('.label');
    if (label && label.textContent !== text) label.textContent = text;
  }

  setVisible(visible: boolean): void {
    this.cursorEl.hidden = !visible;
  }

  move(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.cursorEl.style.left = `${x}px`;
    this.cursorEl.style.top = `${y}px`;
    if (this.dragging) {
      const el = this.target();
      this.fire(el, 'pointermove', 0, 1);
      this.fire(el, 'mousemove', 0, 1);
    }
  }

  click(): void {
    const el = this.target();
    this.pulse();
    this.fire(el, 'pointerdown', 0, 1);
    this.fire(el, 'mousedown', 0, 1);
    if (el instanceof HTMLElement) el.focus({ preventScroll: true });
    this.fire(el, 'pointerup', 0, 0);
    this.fire(el, 'mouseup', 0, 0);
    this.fire(el, 'click', 0, 0);
  }

  rightClick(): void {
    const el = this.target();
    this.pulse();
    this.fire(el, 'pointerdown', 2, 2);
    this.fire(el, 'mousedown', 2, 2);
    this.fire(el, 'pointerup', 2, 0);
    this.fire(el, 'mouseup', 2, 0);
    this.fire(el, 'contextmenu', 2, 0);
  }

  scroll(dx: number, dy: number): void {
    scrollableAncestor(this.target()).scrollBy({ left: dx, top: dy, behavior: 'instant' });
  }

  dragStart(): void {
    const el = this.target();
    this.dragging = true;
    this.cursorEl.classList.add('dragging');
    this.fire(el, 'pointerdown', 0, 1);
    this.fire(el, 'mousedown', 0, 1);
  }

  dragEnd(): void {
    if (!this.dragging) return;
    const el = this.target();
    this.dragging = false;
    this.cursorEl.classList.remove('dragging');
    this.fire(el, 'pointerup', 0, 0);
    this.fire(el, 'mouseup', 0, 0);
  }

  private target(): Element {
    return document.elementFromPoint(this.x, this.y) ?? document.documentElement;
  }

  private pulse(): void {
    this.cursorEl.classList.add('pressed');
    setTimeout(() => this.cursorEl.classList.remove('pressed'), 150);
  }

  private fire(el: Element, type: string, button: number, buttons: number): void {
    const init: PointerEventInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: this.x,
      clientY: this.y,
      screenX: this.x,
      screenY: this.y,
      button,
      buttons,
    };
    const event = type.startsWith('pointer')
      ? new PointerEvent(type, { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true })
      : new MouseEvent(type, init);
    el.dispatchEvent(event);
  }
}

function scrollableAncestor(el: Element): Element {
  for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
    const { overflowY, overflowX } = getComputedStyle(node);
    const canY = /(auto|scroll)/.test(overflowY) && node.scrollHeight > node.clientHeight;
    const canX = /(auto|scroll)/.test(overflowX) && node.scrollWidth > node.clientWidth;
    if (canY || canX) return node;
  }
  return document.scrollingElement ?? document.documentElement;
}
