/** Cursor look per motion-hand pose. Shared by the Test Bed and the extension content script. */
export const CURSOR_CSS = `
.mrp-cursor { position: fixed; z-index: 2147483647; left: 0; top: 0; width: 28px; height: 28px; margin: -14px 0 0 -14px;
  box-sizing: border-box; border-radius: 50%; border: 3px solid #f5c518; background: #f5c51833; pointer-events: none;
  display: grid; place-items: center; color: #f5c518;
  transition: transform 80ms, width 120ms, height 120ms, margin 120ms, border-radius 120ms, background 120ms, border-color 120ms; }
.mrp-cursor[hidden] { display: none; }
.mrp-cursor .icon { display: none; width: 60%; height: 60%; fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.mrp-cursor.mode-click { width: 22px; height: 22px; margin: -11px 0 0 -11px; border-color: #ff7b54; background: #ff7b5444; color: #ff7b54; }
.mrp-cursor.mode-click .icon-click { display: block; fill: currentColor; stroke: none; }
.mrp-cursor.mode-scroll { width: 30px; height: 42px; margin: -21px 0 0 -15px; border-radius: 15px; border-color: #58a6ff; background: #58a6ff33; color: #58a6ff; }
.mrp-cursor.mode-scroll .icon-scroll { display: block; width: 80%; height: 80%; }
.mrp-cursor.mode-grab { width: 40px; height: 40px; margin: -20px 0 0 -20px; border-color: #3fb950; background: #3fb95022; color: #3fb950; }
.mrp-cursor.mode-grab .icon-grab { display: block; }
.mrp-cursor.mode-grab.dragging { background: #3fb950; color: #000; transform: scale(0.85); }
.mrp-cursor.mode-idle { width: 20px; height: 20px; margin: -10px 0 0 -10px; border-color: #6e7681; border-style: dashed; background: transparent; }
.mrp-cursor.pressed { transform: scale(0.6); }
`;

const CURSOR_HTML = `
<svg class="icon icon-scroll" viewBox="0 0 24 24"><path d="M7 9l5-5 5 5M7 15l5 5 5-5"/></svg>
<svg class="icon icon-grab" viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>
<svg class="icon icon-click" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/></svg>`;

/**
 * Creates the cursor element and its styles inside `root` (a document body or a shadow root).
 * The element ignores pointer events so `elementFromPoint` sees the page beneath it.
 */
export function mountCursor(root: ParentNode): HTMLElement {
  const style = document.createElement('style');
  style.textContent = CURSOR_CSS;
  const cursor = document.createElement('div');
  cursor.className = 'mrp-cursor mode-move';
  cursor.hidden = true;
  cursor.innerHTML = CURSOR_HTML;
  root.append(style, cursor);
  return cursor;
}
