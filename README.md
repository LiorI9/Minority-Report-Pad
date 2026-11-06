# Minority Report Pad

תוסף לכרום לשליטה בטאב באמצעות מחוות ידיים מול המצלמה, בהשראת הטרקפד של מק.

- 📄 מוצר: [docs/PRD.md](docs/PRD.md)
- 🏗️ ארכיטקטורה: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 🧭 החלטות: [docs/adr/](docs/adr/)
- 🧪 Test Bed: https://liori9.github.io/Minority-Report-Pad/

## מבנה
| תיקייה | תפקיד |
|---|---|
| `packages/gesture-engine` | מנוע המחוות — TypeScript טהור, בלי תלות בכרום |
| `packages/page-input` | סמן וירטואלי והזרקת אירועים — משותף לדף הבדיקות ולתוסף |
| `apps/testbed` | דף הבדיקות (Vite) — מעבדת מחוות, אזורי מטרה, לוג |
| `apps/extension` | תוסף הכרום (WXT, MV3) |

## פיתוח
```bash
npm install
npm run dev     # Test Bed מקומי
npm test        # בדיקות המנוע
npm run build
npm run build:extension   # ZIP של התוסף
```

## התקנת התוסף
1. **ZIP מוכן:** ב-GitHub → Actions → ההרצה האחרונה → Artifacts → `minority-report-pad-extension`. או מקומית: `npm install && npm run build -w @mrp/extension`.
2. מחלצים את ה-ZIP (או משתמשים ב-`apps/extension/.output/chrome-mv3`).
3. `chrome://extensions` → מדליקים **Developer mode** → **Load unpacked** → בוחרים את התיקייה.
4. בדף ההגדרות של התוסף לוחצים **אשר גישה למצלמה** (פעם אחת).
5. מדליקים מהפופאפ או ב-`Alt+Shift+M`.
