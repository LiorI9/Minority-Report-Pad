# Minority Report Pad — ארכיטקטורה

> **איך זה בנוי.** למה ולמי: [PRD.md](PRD.md). ההחלטות והנימוקים: [adr/](adr/).

## 1. מבט על
מונוריפו עם מנוע מחוות ושכבת קלט משותפים, ושני צרכנים: דף הבדיקות והתוסף ([ADR-006](adr/006-testbed-first-shared-engine.md)).

| חבילה | תפקיד | סטטוס |
|---|---|---|
| `packages/gesture-engine` | TypeScript טהור, בלי DOM ובלי Chrome: landmarks → מצמד, תנוחה, סמן, אירועים | ✅ |
| `packages/page-input` | `SyntheticInput` + `mountCursor` + `HandsOverlay`: סמן וירטואלי לפי תנוחה (כולל זום ותווית), הזרקת אירועים, ושלד ידיים שקוף | ✅ |
| `apps/testbed` | אפליקציית Vite: מצלמה, MediaPipe, אזורי מטרה, לוג | ✅ |
| `apps/extension` | תוסף WXT (MV3): Offscreen, Service worker, Content script, Popup, Options | ✅ שלד מקצה לקצה |

## 2. זרימת נתונים
```
מצלמה
  → MediaPipe HandLandmarker (VIDEO, 2 ידיים)
  → landmarks + handedness (מוחלפת, ראו ADR-011)
  → GestureEngine.update(hands, t)
  → { clutch, pose, cursor (0..1), events[] }
  → Test Bed: SyntheticInput (page-input) — סמן + אירועי pointer/mouse + scrollBy
  → תוסף:   Offscreen ─frame→ Service worker ─frame→ Content script (SyntheticInput)
                                    ├─ swipe → chrome.tabs.update
                                    └─ frame → Popup (שלד ידיים, FPS, זמן זיהוי)
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
// frame: { clutch, rawFingers, pose, cursor, dragging, zooming, motionIndex, referenceIndex, events }
```

אירועים: `clutch`, `pose`, `click`, `rightClick`, `scroll {dx, dy}`, `dragStart`, `dragMove`, `dragEnd`, `swipe {direction}`, `zoomStart`, `zoom {factor}`, `zoomEnd`.

### התנהגות
- **תפקידי ידיים:** היד הדומיננטית = יד תנועה, השנייה = יד ייחוס.
- **מצמד עם היסטרזיס:** יד ייחוס עם 4 אצבעות ומעלה = פעיל, עם אחת או פחות = מושהה, ובין לבין נשאר המצב הקודם. שחרור המצמד מסיים גרירה.
- **תנוחות:** 4 ו-5 אצבעות = 5. תנוחה חדשה מתקבלת אחרי `stableMs`. בזמן מעבר הסמן קפוא.
- **סמן:** מרכז כף יד התנועה (שורש + בסיסי האצבעות) יחסית למרכז כף יד הייחוס, דרך One Euro, כפול `gain`. ציר X הפוך כי הפריים לא מראתי.
- **2 אצבעות:** תנועה מעבר ל-`scrollDeadzone` = גלילה (טבעית כברירת מחדל, `naturalScroll`; עוצמה לפי `scrollGain`); בלי תנועה = `rightClick` ביציאה מהתנוחה.
- **3 אצבעות:** תנועה אופקית של `swipeDistance` (0.08) תוך `swipeWindowMs` (300ms) = `swipe`, אחרת `dragStart`. זיהוי ההחלקה משתמש במיקום הגולמי.
- **זום — V ביד הייחוס** ([ADR-014](adr/014-two-hand-zoom.md)):
  - יד ייחוס עם **בדיוק 2 אצבעות**, יציבה `stableMs`, בזמן שהמצמד פעיל → מצב זום. 2 אצבעות נמצאות ממילא באזור ההיסטרזיס של המצמד, ולכן המצמד נשאר פעיל.
  - בכניסה: `zoomStart`, ונשמר המרחק ההתחלתי `d0` בין מרכזי כפות הידיים. גרירה פעילה מסתיימת.
  - בכל פריים: `zoom { factor = d / d0 }` (מוחלק ב-One Euro), רק כשהשינוי מעל `zoomDeadzone`. הרחקת הידיים מגדילה, קירובן מקטין.
  - במצב זום יד התנועה לא מזיזה סמן ולא לוחצת.
  - ביציאה (V נעלם, או שהמצמד נסגר): `zoomEnd`.
  - הייצוב מונע זום בטעות כשסוגרים את יד הייחוס לאגרוף, כי בדרך עוברים דרך 2 אצבעות.

### בדיקות
בדיקות Vitest על ידיים סינתטיות (`test/hands.ts`): ספירת אצבעות, מצמד, ייצוב, כיוון סמן, ימנית מול גלילה, גלילה הפוכה, החלקה מול גרירה, שחרור מצמד באמצע גרירה, וזום (כניסה, כיוון, יציאה, ומעבר חולף דרך V בדרך לאגרוף שלא מפעיל זום).

## 4. דף הבדיקות — `apps/testbed`
| קובץ | תפקיד |
|---|---|
| `main.ts` | מצלמה, MediaPipe, לולאת פריימים, רינדור שלד, כיול, מסך מלא וכיווץ פאנלים |
| `targets.ts` | אזורי המטרה |
| `log.ts` | לוג אירועים (capture על `document`) עם `isTrusted` |

- **MediaPipe** נטען מ-CDN (jsdelivr ל-WASM, Google Storage למודל). גרסת ה-WASM מוצמדת לגרסת החבילה.
- **`window.mrp`** חושף `engine`, `input`, `log` לקונסול ולבדיקות אוטומטיות.
- **מסך מלא:** `body.fs`. הווידאו `fixed` על כל המסך והפאנלים שכבה שקופה. פאנל עם תוכן שגדל חייב גובה קבוע (ראו ממצאים).

## 5. התוסף — `apps/extension`
WXT + TypeScript, MV3 ([ADR-005](adr/005-wxt-typescript.md)).

| entrypoint | תפקיד |
|---|---|
| `background.ts` | מצב הפעלה, יצירה וסגירה של ה-Offscreen, ניתוב פריימים לטאב הפעיל ולפופאפ, החלפת טאב ב-swipe, תג האייקון, קיצור מקלדת, העברת הגדרות |
| `offscreen/` | מצלמה + MediaPipe + `GestureEngine` בלולאת `setTimeout` (~30 FPS; `requestAnimationFrame` לא רץ במסמך מוסתר). GPU עם נפילה ל-CPU ([ADR-004](adr/004-offscreen-tracking.md)) |
| `content.ts` | `SyntheticInput` בתוך Shadow DOM (`<mrp-pad>`), מבודד מעיצוב הדף. מסתיר את הסמן אם לא הגיע פריים 600ms |
| `popup/` | מתג הפעלה, סטטוס, שלד ידיים חי (בלי וידאו), מצמד, תנוחה, FPS, זמן זיהוי, הגדרות מהירות |
| `options/` | אישור מצלמה חד-פעמי (Offscreen לא יכול לבקש הרשאה) + כיול מלא. נפתח **בטאב** (`open_in_tab`), כי בתוך הדיאלוג של `chrome://extensions` כרום לא מציג בקשת הרשאה |

### הפעלה ([ADR-012](adr/012-activation.md))
- קליק על האייקון פותח פופאפ עם מתג. `Alt+Shift+M` מדליק ומכבה ישירות.
- **תג האייקון:** ריק = כבוי, `…` = עולה, `○` = אין ידיים, `●` אפור = מושהה, `●` ירוק = מצמד פעיל, `!` אדום = שגיאה או אין הרשאה.
- **כיבוי** סוגר את ה-Offscreen document, וזה מכבה את המצלמה.

### הודעות (`utils/messages.ts`)
- **Offscreen → Background:** `frame` (מצמד, תנוחה, סמן, זום, אירועים, נקודות ידיים מעוגלות, יחס הפריים של המצלמה, FPS, זמן זיהוי), `tracker-status`, `get-settings`.
- **Background → Content:** `frame`, `disable`.
- **Background ↔ Popup:** port בשם `popup` לפריימים ולמצב; `set-enabled`, `get-state`.
- **הגדרות** ב-`chrome.storage.local`. ל-Offscreen יש רק `chrome.runtime`, ולכן הוא מקבל אותן דרך ה-Background. שינוי נכנס לתוקף מיד, בלי הפעלה מחדש.

### הגדרות (`Settings`)
| הגדרה | ברירת מחדל | איפה | מי משתמש |
|---|---|---|---|
| `dominant` | ימין | פופאפ + הגדרות | מנוע |
| `swapHandedness` | כן | הגדרות | Offscreen ([ADR-011](adr/011-handedness-swap.md)) |
| `gain` — רגישות סמן | 3 | פופאפ + הגדרות | מנוע |
| `stableMs` — ייצוב תנוחה | 150 | הגדרות | מנוע |
| `scrollGain` — עוצמת גלילה | 2500 | הגדרות | מנוע |
| `naturalScroll` — גלילה טבעית | כן | הגדרות | מנוע |
| `swipeRight` — החלקה ימינה עוברת ל | הטאב הבא | הגדרות | Background |
| `showHands` — הצג ידיים על הדף | לא | פופאפ + הגדרות | Content |

קיצור המקלדת משתנה ב-`chrome://extensions/shortcuts`. ספי המנוע האחרים (החלקה, deadzone, מצמד) קבועים בקוד.

### זום ([ADR-014](adr/014-two-hand-zoom.md))
- **Background:** ב-`zoomStart` קורא את זום הטאב הנוכחי (`chrome.tabs.getZoom`) ושומר אותו כ-`z0`. בכל `zoom` קובע `chrome.tabs.setZoom(z0 × factor)`, בטווח 25%–500%. קריאה נשלחת רק כשהשינוי מעל 2%, וכל עוד אין קריאה קודמת שעוד לא הסתיימה.
- **Content:** הסמן עובר למצב `zoom` (זכוכית מגדלת) ומציג את אחוז הזום. ה-Background שולח את האחוז בפריים.
- **Test Bed:** אין `chrome.tabs`, ולכן הזום מדומה ב-CSS `zoom` על התוכן, עם אותו חישוב `z0 × factor`.

### הצגת ידיים ([ADR-015](adr/015-hands-overlay.md))
- **Content:** canvas שקוף על כל ה-viewport, בתוך ה-Shadow DOM, עם `pointer-events: none`. מצייר את השלד מנקודות הידיים שכבר נשלחות בכל פריים. צהוב = יד תנועה, כחול = יד ייחוס, שקיפות 50%.
- **מיפוי:** הציור מראתי (x → 1−x), כדי שהמציג יראה את הידיים כמו במראה. הפריים מותאם לגובה המסך לפי יחס המצלמה (`aspect`) וממורכז, בלי עיוות.
- **ההגדרה `showHands`:** מתג בפופאפ ובהגדרות, כבוי כברירת מחדל. כשהוא כבוי לא מצויר כלום.
- **הקוד:** `HandsOverlay` בחבילה `packages/page-input`, לצד הסמן.

### הזרקה
- Content script מוצהר על `<all_urls>`. בטאבים שנפתחו לפני ההתקנה, ה-Background מזריק אותו פעם אחת דרך `chrome.scripting`. בדפים כמו `chrome://` ו-Web Store אי אפשר להזריק.
- הרשאות: `offscreen`, `storage`, `scripting`, `tabs`, `host_permissions: <all_urls>`.

### MediaPipe בתוך התוסף ([ADR-013](adr/013-mediapipe-packaging.md))
- `scripts/fetch-assets.mjs` מעתיק את ה-WASM (עם SIMD ובלי) ומוריד את המודל ל-`public/mediapipe/` לפני כל build.
- CSP: `script-src 'self' 'wasm-unsafe-eval'`. בלעדיו WebAssembly לא נטען.

### 0.2
- `chrome.debugger` כהרשאה אופציונלית, לפי אתר ([ADR-003](adr/003-hybrid-input-injection.md)).

## 6. בנייה ופריסה
- `npm install`, `npm run dev`, `npm test`, `npm run build` משורש הריפו (npm workspaces).
- `npm run build:extension` → `apps/extension/.output/minority-report-pad-<version>-chrome.zip`.
- GitHub Actions: כל push ל-`main` מריץ בדיקות, typecheck ו-build, מעלה את ZIP התוסף כ-artifact, ומפרסם את `apps/testbed/dist` ל-GitHub Pages ([ADR-007](adr/007-github-pages-hosting.md)).
- **בדיקת מקצה לקצה של זום והצגת ידיים** (Playwright, התוסף טעון): `zoomStart` ואחריו `zoom 1.5` → `chrome.tabs.getZoom` = 1.5, ואחרי `zoom 0.5` → 0.5. הסמן מציג 150%, והשלד מצויר מראתי וצבוע לפי תפקיד.
- **בדיקת מקצה לקצה של התוסף** (ידנית, Playwright): Chromium עם התוסף ומצלמה מזויפת (`--use-fake-device-for-media-stream`). נבדק: עליית ה-Offscreen ומעבר לסטטוס running, תג, פריים סינתטי שעובר דרך ה-Background ל-Content ולוחץ על כפתור, swipe שמחליף טאב, וכיבוי שסוגר את ה-Offscreen.

## 7. ממצאים
- אירועים סינתטיים מגיעים עם `isTrusted: false`, ובכל זאת כפתורים, לחיצה ימנית, סליידר מבוסס pointer וגרירת עכבר עובדים.
- `scrollBy` מייצר אירועי `scroll` עם `isTrusted: true`. הגלילה לא צריכה debugger.
- HTML5 Drag & Drop לא מגיב לאירועים סינתטיים, כצפוי.
- לוג שמוסיף שורה ב-`mousedown` וגדל כלפי מעלה מזיז כפתורים באמצע לחיצה → פאנל עם תוכן דינמי חייב גובה קבוע.
- בקשת הרשאת מצלמה לא מופיעה מתוך מסגרת מוטמעת (דיאלוג ההגדרות ב-`chrome://extensions`): הכפתור פשוט לא עושה כלום. → דף ההגדרות נפתח בטאב, ואם הוא בכל זאת מוטמע, הכפתור פותח טאב. שגיאת הרשאה מוצגת עם הוראות, כולל הרשאת מצלמה ברמת macOS.
- `upload-artifact` מדלג על תיקיות נסתרות (כמו `.output/` של WXT) → צריך `include-hidden-files: true`, ו-`if-no-files-found: error` כדי שזה ייכשל בקול ולא בשקט.
- `display` שמוגדר ב-CSS דורס את המאפיין `hidden` → צריך כלל `[hidden] { display: none }` מפורש.
- MediaPipe בוחר בזמן ריצה בין WASM עם SIMD לבלי SIMD. ב-Chromium של סביבת הבדיקה הוא בחר בלי SIMD, ולכן אורזים את שניהם.
- ב-Chromium בלי GPU, על 4 ליבות: ~290ms לזיהוי, כ-4 FPS. זה חסם CPU, לא האטת טיימרים. במכשיר עם GPU צפוי מהר בהרבה, למדוד.

## 8. פתוח לאימות עם מצלמה
- החלפת התוויות ימין/שמאל ([ADR-011](adr/011-handedness-swap.md)).
- רגישות הסמן (ברירת מחדל 3) ונראות הסמן מעל וידאו במסך מלא.
- FPS וזמן זיהוי של התוסף ב-Mac אמיתי.
