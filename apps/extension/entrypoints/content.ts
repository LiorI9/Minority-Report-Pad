import { HandsOverlay, SyntheticInput, TargetHighlight, mountCursor, type CursorMode } from '@mrp/page-input';
import { loadSettings, type ContentMessage, type FrameMessage } from '@/utils/messages';

const MODE_BY_POSE: Record<number, CursorMode> = { 0: 'idle', 1: 'click', 2: 'scroll', 3: 'grab', 5: 'move' };
/** Hide the cursor if frames stop arriving (tab switched, extension off, tracker stalled). */
const STALE_MS = 600;

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    const w = window as Window & { __mrpLoaded?: boolean };
    if (w.__mrpLoaded) return; // guard against double injection
    w.__mrpLoaded = true;

    // Shadow DOM keeps the cursor's styles isolated from the page and vice versa.
    const host = document.createElement('mrp-pad');
    host.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; pointer-events: none;';
    const shadow = host.attachShadow({ mode: 'closed' });
    document.documentElement.append(host);
    const overlay = new HandsOverlay(shadow); // appended first, so the cursor draws above it
    const highlight = new TargetHighlight(shadow);
    const input = new SyntheticInput(mountCursor(shadow));
    const applySettings = () =>
      loadSettings().then((s) => {
        overlay.setEnabled(s.showHands);
        highlight.setEnabled(s.highlightTarget);
      });
    void applySettings();
    browser.storage.onChanged.addListener((changes) => {
      if (changes.settings) void applySettings();
    });

    let staleTimer: number | undefined;
    const hide = () => {
      input.dragEnd();
      input.setVisible(false);
      overlay.clear();
      highlight.hide();
    };

    const onFrame = (frame: FrameMessage, zoomPercent?: number) => {
      clearTimeout(staleTimer);
      staleTimer = window.setTimeout(hide, STALE_MS);

      input.setVisible(frame.clutch === 'active');
      input.setMode(frame.zooming ? 'zoom' : frame.pose === null ? 'move' : (MODE_BY_POSE[frame.pose] ?? 'move'));
      input.setLabel(frame.zooming && zoomPercent !== undefined ? `${zoomPercent}%` : '');
      overlay.draw(frame.hands, frame.aspect);
      const x = frame.cursor.x * window.innerWidth;
      const y = frame.cursor.y * window.innerHeight;
      input.move(x, y);
      // Frame what a click would hit, while moving (5) or clicking (1).
      const aiming = frame.clutch === 'active' && !frame.zooming && !frame.dragging && (frame.pose === null || frame.pose === 5 || frame.pose === 1);
      highlight.update(x, y, aiming);

      for (const e of frame.events) {
        switch (e.type) {
          case 'click': input.click(); highlight.pulse(); break;
          case 'rightClick': input.rightClick(); break;
          case 'scroll': input.scroll(e.dx, e.dy); break;
          case 'dragStart': input.dragStart(); break;
          case 'dragEnd': input.dragEnd(); break;
          case 'clutch': if (e.state !== 'active') input.dragEnd(); break;
          default: break; // swipe is handled by the service worker (chrome.tabs)
        }
      }
    };

    browser.runtime.onMessage.addListener((msg: ContentMessage) => {
      if (msg.type === 'frame') onFrame(msg.frame, msg.zoomPercent);
      else if (msg.type === 'disable') hide();
      // 'ping' needs no handling: a successful sendMessage is the answer.
    });
  },
});
