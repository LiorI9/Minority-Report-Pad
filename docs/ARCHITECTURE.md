# Minority Report Pad — ארכיטקטורה

> **איך זה בנוי.** למה ולמי: [PRD.md](PRD.md). ההחלטות והנימוקים: [adr/](adr/).

## 1. מבט על
מונוריפו עם מנוע מחוות אחד ושני צרכנים: דף הבדיקות והתוסף ([ADR-006](adr/006-testbed-first-shared-engine.md)).

| חבילה | תפקיד | סטטוס |
|---|---|---|
| `packages/gesture-engine` | TypeScript טהור, בלי DOM ובלי Chrome: landmarks → מצמד, תנוחה, סמן, אירועים | ✅ |
| `apps/testbed` | אפליקציית Vite: מצלמה, MediaPipe, סמן וירטואלי, אזורי מטרה, לוג | ✅ |
| `apps/extension` | תוסף WXT (MV3) | ⏳ טרם נבנה |

## 2. זרימת נתונים
```
מצלמה
  → MediaPipe HandLandmarker (VIDEO, 2 ידיים)
  → landmarks + handedness (מוחלפת, ראו ADR-011)
  → GestureEngine.update(hands, t)
  → { clutch, pose, cursor (0..1), events[] }
  → Test Bed: SyntheticInput — סמן + אירועי pointer/mouse + scrollBy
  → תוסף:   Offscreen → Service worker → Content script / chrome.tabs
```

## 3. מנוע המחוות — `packages/gesture-engine`
פטור מתלות בסביבה: הזמן מועבר מבחוץ, ולכן הוא דטרמיניסטי ונבדק ביחידה ([ADR-010](adr/010-gesture-engine-design.md)).

| קובץ | תפקיד |
|---|---|
| `landmarks.ts` | טיפוסים ואינדקסים של 21 נקודות היד |
| `fingers.ts` | `fingerState` / `countFingers` — אצבע פרושה כשהקצה רחוק מהשורש יותר מהמפרק (יחס 1.15); אגודל לפי מרחק מבסיס הזרת |
| `filter.ts` | מסנן One Euro להחלקת רעד |
| `engine.ts` | `GestureEngine` — תפקידי ידיים, מצמד, ייצוב תנוחה, סמן, אירועים |

### API
```ts
const engine = new GestureEngine({ dominant: 'Right', stableMs: 150, gain: 3 });
const frame = engine.update([{ landmarks, handedness }], performance.now());
// frame: { clutch, rawFingers, pose, cursor, dragging, motionIndex, referenceIndex, events }
```

אירועים: `clutch`, `pose`, `click`, `rightClick`, `scroll {dx, dy}`, `dragStart`, `dragMove`, `dragEnd`, `swipe {direction}`.

### התנהגות
- **תפקידי ידיים:** היד הדומיננטית = יד תנועה, השנייה = יד ייחוס.
- **מצמד עם היסטרזיס:** יד ייחוס עם 4 אצבעות ומעלה = פעיל, עם אחת או פחות = מושהה, ובין לבין נשאר המצב הקודם. שחרור המצמד מסיים גרירה.
- **תנוחות:** 4 ו-5 אצבעות = 5. תנוחה חדשה מתקבלת אחרי `stableMs`. בזמן מעבר הסמן קפוא.
- **סמן:** מרכז כף יד התנועה (שורש + בסיסי האצבעות) יחסית למרכז כף יד הייחוס, דרך One Euro, כפול `gain`. ציר X הפוך כי הפריים לא מראתי.
- **2 אצבעות:** תנועה מעבר ל-`scrollDeadzone` = גלילה טבעית; בלי תנועה = `rightClick` ביציאה מהתנוחה.
- **3 אצבעות:** תנועה אופקית של `swipeDistance` (0.08) תוך `swipeWindowMs` (300ms) = `swipe`, אחרת `dragStart`. זיהוי ההחלקה משתמש במיקום הגולמי.

### בדיקות
15 בדיקות Vitest על ידיים סינתטיות (`test/hands.ts`): ספירת אצבעות, מצמד, ייצוב, כיוון סמן, ימנית מול גלילה, החלקה מול גרירה, שחרור מצמד באמצע גרירה.

## 4. דף הבדיקות — `apps/testbed`
| קובץ | תפקיד |
|---|---|
| `main.ts` | מצלמה, MediaPipe, לולאת פריימים, רינדור שלד, כיול, מסך מלא וכיווץ פאנלים |
| `input.ts` | `SyntheticInput` — סמן וירטואלי ומצביו + הזרקת pointer/mouse ו-`scrollBy`. **אב-הטיפוס של ה-content script.** |
| `targets.ts` | אזורי המטרה |
| `log.ts` | לוג אירועים (capture על `document`) עם `isTrusted` |

- **MediaPipe** נטען מ-CDN (jsdelivr ל-WASM, Google Storage למודל). גרסת ה-WASM מוצמדת לגרסת החבילה.
- **`window.mrp`** חושף `engine`, `input`, `log` לקונסול ולבדיקות אוטומטיות.
- **מסך מלא:** `body.fs`. הווידאו `fixed` על כל המסך והפאנלים שכבה שקופה. פאנל עם תוכן שגדל חייב גובה קבוע (ראו ממצאים).

## 5. התוסף — `apps/extension` (מתוכנן)
- **WXT + TypeScript, MV3** ([ADR-005](adr/005-wxt-typescript.md)).
- **Offscreen document:** מצלמה + MediaPipe + `GestureEngine`. שורד מעבר טאבים ([ADR-004](adr/004-offscreen-tracking.md)).
- **Service worker:** ניתוב אירועים; `chrome.tabs` להחלפת טאב, קדימה ואחורה וזום.
- **Content script:** סמן וירטואלי + אירועים סינתטיים, על בסיס `SyntheticInput`.
- **Options page:** אישור מצלמה חד-פעמי (Offscreen לא יכול לבקש הרשאה) + כיול.
- **מודל MediaPipe ארוז בתוך התוסף.** MV3 אוסר קוד מרוחק.
- **0.2:** `chrome.debugger` כהרשאה אופציונלית, לפי אתר ([ADR-003](adr/003-hybrid-input-injection.md)).

## 6. בנייה ופריסה
- `npm install`, `npm run dev`, `npm test`, `npm run build` משורש הריפו (npm workspaces).
- GitHub Actions: כל push ל-`main` מריץ בדיקות ו-build ומפרסם את `apps/testbed/dist` ל-GitHub Pages ([ADR-007](adr/007-github-pages-hosting.md)).

## 7. ממצאים
- אירועים סינתטיים מגיעים עם `isTrusted: false`, ובכל זאת כפתורים, לחיצה ימנית, סליידר מבוסס pointer וגרירת עכבר עובדים.
- `scrollBy` מייצר אירועי `scroll` עם `isTrusted: true`. הגלילה לא צריכה debugger.
- HTML5 Drag & Drop לא מגיב לאירועים סינתטיים, כצפוי.
- לוג שמוסיף שורה ב-`mousedown` וגדל כלפי מעלה מזיז כפתורים באמצע לחיצה → פאנל עם תוכן דינמי חייב גובה קבוע.
- `display` שמוגדר ב-CSS דורס את המאפיין `hidden` → צריך כלל `[hidden] { display: none }` מפורש.

## 8. פתוח לאימות עם מצלמה
- החלפת התוויות ימין/שמאל ([ADR-011](adr/011-handedness-swap.md)).
- רגישות הסמן (ברירת מחדל 3) ונראות הסמן מעל וידאו במסך מלא.
