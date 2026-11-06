# Minority Report Pad

תוסף לכרום לשליטה בטאב באמצעות מחוות ידיים מול המצלמה, בהשראת הטרקפד של מק.

- 📄 תכנון: [docs/PRD.md](docs/PRD.md)
- 🧪 Test Bed: https://liori9.github.io/minority-report-pad/

## מבנה
| תיקייה | תפקיד |
|---|---|
| `packages/gesture-engine` | מנוע המחוות — TypeScript טהור, בלי תלות בכרום |
| `apps/testbed` | דף הבדיקות (Vite) — מעבדת מחוות, אזורי מטרה, לוג |
| `apps/extension` | תוסף הכרום (WXT) — בהמשך |

## פיתוח
```bash
npm install
npm run dev     # Test Bed מקומי
npm test        # בדיקות המנוע
npm run build
```
