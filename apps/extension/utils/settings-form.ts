import { loadSettings, type Settings } from './messages';

/** Binds inputs named after Settings keys to chrome.storage. Used by popup and options. */
export async function bindSettingsForm(root: ParentNode): Promise<void> {
  const settings = await loadSettings();
  const fields = root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]');
  for (const el of fields) {
    const key = el.dataset.setting as keyof Settings;
    const out = root.querySelector<HTMLOutputElement>(`output[for="${el.id}"]`);
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = Boolean(settings[key]);
    else el.value = String(settings[key]);
    if (out) out.value = el.value;
    el.addEventListener('input', async () => {
      const current = await loadSettings();
      const value =
        el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked
        : el instanceof HTMLInputElement && el.type === 'range' ? Number(el.value)
        : el.value;
      if (out) out.value = el.value;
      await browser.storage.local.set({ settings: { ...current, [key]: value } });
    });
  }
}
