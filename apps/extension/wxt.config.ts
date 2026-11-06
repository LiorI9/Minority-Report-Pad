import { defineConfig } from 'wxt';

export default defineConfig({
  zip: { artifactTemplate: 'minority-report-pad-{{version}}-{{browser}}.zip' },
  manifest: {
    name: 'Minority Report Pad',
    description: 'שליטה בטאב באמצעות מחוות ידיים מול המצלמה, בהשראת הטרקפד של מק.',
    permissions: ['offscreen', 'storage', 'scripting', 'tabs'],
    host_permissions: ['<all_urls>'],
    action: { default_title: 'Minority Report Pad' },
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
