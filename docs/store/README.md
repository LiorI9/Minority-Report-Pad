# Chrome Web Store — חומרי הגשה

כל מה שצריך כדי למלא את דף התוסף ב-[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). ההחלטות: [ADR-017](../adr/017-store-publishing.md).

## קבצים
| קובץ | שדה בדשבורד | גודל |
|---|---|---|
| ZIP מ-GitHub Actions → Artifacts → `minority-report-pad-extension` (לחלץ פעם אחת; בפנים `minority-report-pad-<version>-chrome.zip`) | Package | — |
| `../../apps/extension/public/icon/128.png` | Store icon | 128×128 |
| `screenshot-1-gestures.png` | Screenshots | 1280×800 |
| `screenshot-2-zoom.png` | Screenshots | 1280×800 |
| `screenshot-3-gestures-guide.png` | Screenshots | 1280×800 |
| `promo-small-440x280.png` | Small promo tile | 440×280 |
| `promo-marquee-1400x560.png` | Marquee promo tile (אופציונלי) | 1400×560 |
| `icon.svg` | מקור האייקון | — |

## פרטי הרישום
- **Name:** Minority Report Pad
- **Category:** Accessibility (חלופה: Productivity)
- **Language:** English (אפשר להוסיף עברית כתרגום)
- **Visibility:** Unlisted
- **Privacy policy URL:** https://liori9.github.io/Minority-Report-Pad/privacy.html
- **Homepage / Support URL:** https://github.com/LiorI9/Minority-Report-Pad
- **Contact (privacy):** lior.israel.mrp@frenziQ.com — מופיע במדיניות הפרטיות.

### Summary (עד 132 תווים)
```
Control the browser with hand gestures in front of your camera, like a trackpad in the air. Processed on your device.
```

### Description
```
Minority Report Pad turns your hands into a trackpad. Stand in front of your screen and control the current tab with simple gestures — ideal for presenting.

HOW IT WORKS
• Left hand open: active. Lower it to pause, so you can talk freely with your hands.
• Right hand open: move the cursor.
• 1 finger: click.
• 2 fingers: right-click, or move to scroll.
• 3 fingers: drag, or swipe sideways to switch tabs.
• Left fist + spread or close your hands: zoom in and out.

FEATURES
• Shows a cursor that changes shape with each gesture.
• Optional translucent outline of your hands over the page, so your audience can follow.
• Turn on from the toolbar or with Alt+Shift+M.
• Adjustable: dominant hand, cursor sensitivity, scroll strength and direction, swipe direction.

PRIVACY
The camera runs only while the extension is on. Video is processed locally by a hand-tracking model bundled with the extension. No video, images, or browsing data are recorded, stored, or sent anywhere. No accounts, no analytics.

Tip: grant camera access once from the extension's settings page.
```

### תיאור בעברית (לתרגום)
```
Minority Report Pad הופך את הידיים שלך לטרקפד. עומדים מול המסך ושולטים בטאב במחוות פשוטות — מושלם למציגים.

איך זה עובד
• יד שמאל פתוחה: פעיל. מורידים אותה כדי להשהות, וכך אפשר לדבר עם הידיים בחופשיות.
• יד ימין פתוחה: הזזת הסמן.
• אצבע אחת: לחיצה.
• 2 אצבעות: לחיצה ימנית, או תנועה לגלילה.
• 3 אצבעות: גרירה, או החלקה הצידה להחלפת טאב.
• אגרוף ביד שמאל, ואז מרחיקים או מקרבים את הידיים: זום פנימה והחוצה.

פרטיות
המצלמה פועלת רק כשהתוסף דולק. הווידאו מעובד מקומית, ושום תמונה או מידע גלישה לא נשמרים ולא נשלחים.
```

## לשונית Privacy practices
### Single purpose
```
Control the active browser tab with hand gestures captured by the camera: move a cursor, click, scroll, drag, switch tabs and zoom.
```

### Permission justifications
| Permission | Justification |
|---|---|
| `offscreen` | Runs the camera and the on-device hand-tracking model in an offscreen document, so tracking keeps working when the user switches tabs (a page cannot keep the camera while hidden). |
| `storage` | Saves the user's settings (dominant hand, sensitivity, scroll and swipe direction, hand overlay) locally. |
| `scripting` | Injects the cursor script into tabs that were already open before the extension was installed or turned on, so gestures work there without reloading. |
| Host permission `<all_urls>` | The extension's purpose is to control whatever page the user is on: its content script draws the gesture cursor and performs clicks, scrolling and dragging on that page, and the extension sets the page zoom. It does not read or collect page content. |
| Remote code | **No.** All code and the hand-tracking model (WebAssembly + model file) are bundled in the package. |

### Data usage
- **Data collected:** סמנו **שום דבר**. התוסף לא אוסף אף אחד מסוגי המידע ברשימה.
- **Camera:** אם הטופס שואל: הווידאו מעובד מקומית בלבד, ולא נשמר ולא משודר.
- שלושת האישורים (לא מוכרים מידע, לא משתמשים בו למטרה שלא קשורה, לא לצורך אשראי): לסמן את שלושתם.

## צעדים
1. נרשמים ל-Developer Dashboard: תשלום חד-פעמי של 5$, וחשבון Google עם אימות דו-שלבי.
2. **Add new item** ומעלים את ה-ZIP.
3. **Store listing:** מעתיקים את השדות מלמעלה ומעלים את התמונות.
4. **Privacy practices:** מעתיקים את ה-single purpose, את הצדקות ההרשאות ואת דיווחי המידע.
5. **Distribution:** Visibility = **Unlisted**.
6. **Submit for review.** בתוסף עם `<all_urls>` הבדיקה בדרך כלל ארוכה יותר.
7. אחרי האישור: מי שמקבל את הקישור לדף התוסף יכול להתקין, והעדכונים מגיעים אוטומטית.

## גרסה חדשה
1. מעלים את `version` ב-`apps/extension/package.json`.
2. דוחפים ל-`main`, ומורידים את ה-ZIP החדש מ-Actions.
3. בדשבורד: **Package → Upload new package → Submit for review**.
