import { SyntheticInput, mountCursor, type CursorMode } from '@mrp/page-input';
import type { ContentMessage, FrameMessage } from '@/utils/messages';

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
    const input = new SyntheticInput(mountCursor(shadow));

    let staleTimer: number | undefined;
    const hide = () => {
      input.dragEnd();
      input.setVisible(false);
    };

    const onFrame = (frame: FrameMessage) => {
      clearTimeout(staleTimer);
      staleTimer = window.setTimeout(hide, STALE_MS);

      input.setVisible(frame.clutch === 'active');
      input.setMode(frame.pose === null ? 'move' : (MODE_BY_POSE[frame.pose] ?? 'move'));
      input.move(frame.cursor.x * window.innerWidth, frame.cursor.y * window.innerHeight);

      for (const e of frame.events) {
        switch (e.type) {
          case 'click': input.click(); break;
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
      if (msg.type === 'frame') onFrame(msg.frame);
      else if (msg.type === 'disable') hide();
      // 'ping' needs no handling: a successful sendMessage is the answer.
    });
  },
});
