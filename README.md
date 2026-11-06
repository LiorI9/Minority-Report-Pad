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
| `apps/testbed` | דף הבדיקות (Vite) — מעבדת מחוות, אזורי מטרה, לוג |
| `apps/extension` | תוסף הכרום (WXT) — טרם נבנה |

## פיתוח
```bash
npm install
npm run dev     # Test Bed מקומי
npm test        # בדיקות המנוע
npm run build
```
