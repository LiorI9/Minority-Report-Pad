import type { ClutchState } from '@mrp/gesture-engine';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  type ContentMessage,
  type FrameMessage,
  type Message,
  type PopupState,
  type TrackerStatus,
} from '@/utils/messages';

/**
 * Service worker: owns the on/off state, the offscreen document (camera + engine),
 * routes frames to the active tab and popup, and performs browser-level actions (tab switch).
 */
export default defineBackground(() => {
  let enabled = false;
  let status: TrackerStatus | 'off' = 'off';
  let detail: string | undefined;
  let lastClutch: ClutchState | null = null;
  const popupPorts = new Set<Browser.runtime.Port>();
  const injectAttempted = new Set<number>();
  let activeTabId: number | undefined;
  // Two-hand zoom (ADR-014): browser zoom relative to the zoom when the gesture started.
  let zoomBase: number | null = null;
  let zoomCurrent = 1;
  let zoomInFlight = false;
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 5;

  const OFFSCREEN_URL = browser.runtime.getURL('/offscreen.html');

  // --- Enable / disable -----------------------------------------------------
  async function setEnabled(next: boolean): Promise<void> {
    if (next === enabled) return;
    enabled = next;
    if (enabled) {
      status = 'starting';
      detail = undefined;
      await refreshActiveTab();
      await ensureOffscreen();
    } else {
      status = 'off';
      lastClutch = null;
      if (await hasOffscreen()) await browser.offscreen.closeDocument();
      if (activeTabId !== undefined) void sendToTab(activeTabId, { type: 'disable' });
    }
    updateBadge();
    broadcastState();
  }

  async function hasOffscreen(): Promise<boolean> {
    const contexts = await browser.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT' as Browser.runtime.ContextType],
      documentUrls: [OFFSCREEN_URL],
    });
    return contexts.length > 0;
  }

  async function ensureOffscreen(): Promise<void> {
    if (await hasOffscreen()) return;
    await browser.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['USER_MEDIA' as Browser.offscreen.Reason],
      justification: 'Camera hand tracking for gesture control',
    });
  }

  // --- Badge ----------------------------------------------------------------
  function updateBadge(): void {
    let text = '';
    let color = '#6e7681';
    if (enabled) {
      if (status === 'starting') text = '…';
      else if (status === 'no-permission' || status === 'error') [text, color] = ['!', '#f85149'];
      else if (lastClutch === 'active') [text, color] = ['●', '#3fb950'];
      else if (lastClutch === 'paused') text = '●';
      else text = '○';
    }
    void browser.action.setBadgeText({ text });
    void browser.action.setBadgeBackgroundColor({ color });
  }

  // --- Tabs -----------------------------------------------------------------
  async function refreshActiveTab(): Promise<void> {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    activeTabId = tab?.id;
  }
  browser.tabs.onActivated.addListener(({ tabId }) => {
    if (activeTabId !== undefined && activeTabId !== tabId) void sendToTab(activeTabId, { type: 'disable' });
    activeTabId = tabId;
  });
  browser.windows.onFocusChanged.addListener(() => void refreshActiveTab());
  browser.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === 'loading') injectAttempted.delete(tabId);
  });

  async function sendToTab(tabId: number, msg: ContentMessage): Promise<void> {
    try {
      await browser.tabs.sendMessage(tabId, msg);
    } catch {
      // Tabs opened before install/reload have no content script yet: inject once.
      if (injectAttempted.has(tabId)) return;
      injectAttempted.add(tabId);
      try {
        await browser.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/content.js'] });
      } catch {
        // chrome://, Web Store and similar pages cannot be scripted.
      }
    }
  }

  async function switchTab(direction: 'left' | 'right'): Promise<void> {
    const [current] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (!current?.windowId) return;
    const tabs = await browser.tabs.query({ windowId: current.windowId });
    const i = tabs.findIndex((t) => t.id === current.id);
    const forward = (direction === 'right') === (cachedSettings.swipeRight === 'next');
    const next = tabs[(i + (forward ? 1 : -1) + tabs.length) % tabs.length];
    if (next?.id !== undefined) await browser.tabs.update(next.id, { active: true });
  }

  // --- Zoom -----------------------------------------------------------------
  async function startZoom(): Promise<void> {
    if (activeTabId === undefined) return;
    try {
      zoomCurrent = await browser.tabs.getZoom(activeTabId);
    } catch {
      zoomCurrent = 1;
    }
    zoomBase = zoomCurrent;
  }

  async function applyZoom(factor: number): Promise<void> {
    if (zoomBase === null || activeTabId === undefined || zoomInFlight) return;
    const target = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomBase * factor));
    if (Math.abs(target - zoomCurrent) / zoomCurrent < 0.02) return;
    zoomInFlight = true;
    try {
      await browser.tabs.setZoom(activeTabId, target);
      zoomCurrent = target;
    } catch {
      // Some pages (chrome://, Web Store) cannot be zoomed by extensions.
    } finally {
      zoomInFlight = false;
    }
  }

  // --- Frames ---------------------------------------------------------------
  function onFrame(frame: FrameMessage): void {
    if (!enabled) return;
    if (status !== 'running') {
      status = 'running';
      broadcastState();
    }
    if (frame.clutch !== lastClutch) {
      lastClutch = frame.clutch;
      updateBadge();
    }
    for (const e of frame.events) {
      if (e.type === 'swipe') void switchTab(e.direction);
      else if (e.type === 'zoomStart') void startZoom();
      else if (e.type === 'zoom') void applyZoom(e.factor);
      else if (e.type === 'zoomEnd') zoomBase = null;
    }
    const zoomPercent = frame.zooming ? Math.round(zoomCurrent * 100) : undefined;
    if (activeTabId !== undefined) void sendToTab(activeTabId, { type: 'frame', frame, zoomPercent });
    for (const port of popupPorts) port.postMessage(frame);
  }

  // --- Popup ----------------------------------------------------------------
  function state(): PopupState {
    return { enabled, status, detail, settings: cachedSettings };
  }
  function broadcastState(): void {
    for (const port of popupPorts) port.postMessage({ type: 'state', state: state() });
  }
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'popup') return;
    popupPorts.add(port);
    port.postMessage({ type: 'state', state: state() });
    port.onDisconnect.addListener(() => popupPorts.delete(port));
  });

  // --- Settings -------------------------------------------------------------
  let cachedSettings: PopupState['settings'] = DEFAULT_SETTINGS;
  void loadSettings().then((s) => (cachedSettings = s));
  browser.storage.onChanged.addListener(async (changes) => {
    if (!changes.settings) return;
    cachedSettings = await loadSettings();
    void browser.runtime.sendMessage({ type: 'settings', settings: cachedSettings } satisfies Message).catch(() => {});
    broadcastState();
  });

  // --- Messages & commands --------------------------------------------------
  browser.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
    switch (msg.type) {
      case 'frame':
        onFrame(msg);
        return;
      case 'tracker-status':
        status = msg.status;
        detail = msg.detail;
        updateBadge();
        broadcastState();
        return;
      case 'get-settings':
        void loadSettings().then(sendResponse);
        return true; // async response
      case 'get-state':
        sendResponse(state());
        return;
      case 'set-enabled':
        void setEnabled(msg.enabled).then(() => sendResponse(state()));
        return true;
      default:
        return;
    }
  });

  browser.commands.onCommand.addListener((command) => {
    if (command === 'toggle') void setEnabled(!enabled);
  });

  updateBadge();
});
