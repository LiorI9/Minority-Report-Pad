# ADR-005: סטאק התוסף: WXT + TypeScript

- **סטטוס:** מאושר
- **תאריך:** 2026-11-06

## הקשר
תוסף MV3 עם ארבעה entrypoints (offscreen, background, content, options).

## החלטה
WXT (מבוסס Vite) עם TypeScript.

## חלופות שנשקלו
- **Vite + CRXJS** — יותר הגדרות ידניות.
- **Plasmo + React** — כבד מהנדרש, פחות פעיל.
- **Vanilla JS בלי build** — בלי טיפוסים, קשה לנהל מודל ותלויות.

## השלכות
- מניפסט נוצר מהקוד, HMR, מבנה entrypoints מוכן.
- המודל של MediaPipe חייב להיארז בתוך התוסף (MV3 אוסר קוד מרוחק).
