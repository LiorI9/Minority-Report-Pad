import { bindSettingsForm } from '@/utils/settings-form';

const grant = document.getElementById('grant')!;
const grantStatus = document.getElementById('grant-status')!;

async function showPermission(): Promise<void> {
  try {
    const p = await navigator.permissions.query({ name: 'camera' as PermissionName });
    grantStatus.textContent = p.state === 'granted' ? '✓ יש גישה למצלמה' : p.state === 'denied' ? '✗ הגישה נחסמה — אפשר לשנות בהגדרות האתר של התוסף' : '';
    grantStatus.className = p.state === 'granted' ? 'ok' : p.state === 'denied' ? 'bad' : 'muted';
  } catch {
    // permissions.query for camera is not available everywhere
  }
}

// The offscreen document cannot show a permission prompt, so it is granted once here.
grant.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    // reflected by showPermission
  }
  await showPermission();
});

void showPermission();
void bindSettingsForm(document);
