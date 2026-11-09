import { defineConfig } from 'wxt';

export default defineConfig({
  zip: { artifactTemplate: 'minority-report-pad-{{version}}-{{browser}}.zip' },
  manifest: {
    name: 'Minority Report Pad',
    description: 'שליטה בטאב באמצעות מחוות ידיים מול המצלמה, בהשראת הטרקפד של מק.',
    // No 'tabs': only tab ids, indexes and zoom are used, which do not need it.
    permissions: ['offscreen', 'storage', 'scripting'],
    icons: { 16: '/icon/16.png', 32: '/icon/32.png', 48: '/icon/48.png', 128: '/icon/128.png' },
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Minority Report Pad',
      default_icon: { 16: '/icon/16.png', 32: '/icon/32.png', 48: '/icon/48.png' },
    },
    // MediaPipe runs WebAssembly in the offscreen document.
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    commands: {
      toggle: {
        suggested_key: { default: 'Alt+Shift+M' },
        description: 'הפעלה / כיבוי',
      },
    },
  },
});
