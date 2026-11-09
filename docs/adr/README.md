# Architecture Decision Records

כל החלטה משמעותית מתועדת כאן: הקשר, החלטה, חלופות והשלכות. החלטה שמשתנה לא נמחקת — מסמנים אותה "הוחלפה ב-ADR-XXX" וכותבים חדשה.

| # | החלטה |
|---|---|
| [001](001-two-hand-model.md) | מודל שתי ידיים: יד ייחוס כעוגן ומצמד |
| [002](002-mac-trackpad-mapping.md) | מיפוי אצבעות כמו טרקפד מק |
| [003](003-hybrid-input-injection.md) | הזרקת קלט היברידית; debugger לפי אתר |
| [004](004-offscreen-tracking.md) | זיהוי ידיים ב-Offscreen document |
| [005](005-wxt-typescript.md) | סטאק התוסף: WXT + TypeScript |
| [006](006-testbed-first-shared-engine.md) | Test Bed לפני התוסף, מנוע משותף במונוריפו |
| [007](007-github-pages-hosting.md) | אירוח ב-GitHub Pages, ריפו ציבורי |
| [008](008-mvp-scope.md) | תכולת 0.1: כל מיפוי המק + קליברציה בסיסית |
| [009](009-distance-validation.md) | אימות מרחק: 90% ב-1 מטר, אימות ויזואלי |
| [010](010-gesture-engine-design.md) | תכנון מנוע המחוות |
| [011](011-handedness-swap.md) | החלפת תוויות ימין/שמאל של MediaPipe |
| [012](012-activation.md) | הפעלה — פופאפ + קיצור מקלדת + תג |
| [013](013-mediapipe-packaging.md) | אריזת MediaPipe בתוך התוסף |
| [014](014-two-hand-zoom.md) | זום בשתי ידיים — V ביד הייחוס + מרחק |
| [015](015-hands-overlay.md) | הצגת הידיים כשלד שקוף על הדף |
| [016](016-fist-zoom-lower-to-pause.md) | זום באגרוף ביד הייחוס; השהיה בהורדת היד |
| [017](017-store-publishing.md) | פרסום ב-Chrome Web Store — Unlisted, עם השם הנוכחי |

## תבנית
```markdown
# ADR-NNN: כותרת

- **סטטוס:** מוצע / מאושר / הוחלף ב-ADR-XXX
- **תאריך:** YYYY-MM-DD

## הקשר
## החלטה
## חלופות שנשקלו
## השלכות
```
