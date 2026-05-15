# Mink

> Capture thoughts and tasks, effortlessly.

A dark-mode, PWA-first task app. Voice capture, subtasks, projects, tags, smart rollover, and a 7-day stats view. Runs entirely in the browser — no backend, no login.

---

## Deploy to GitHub Pages in 5 steps

1. **Create a new GitHub repo** — name it `mink` (or anything you like), set it to public.

2. **Upload these files** — drag the entire folder contents into the repo root via github.com, or push via git:
   ```bash
   git init
   git add .
   git commit -m "Initial Mink build"
   git remote add origin https://github.com/YOUR_USERNAME/mink.git
   git push -u origin main
   ```

3. **Enable GitHub Pages** — go to repo → Settings → Pages → Source: `Deploy from a branch` → Branch: `main` → Folder: `/ (root)` → Save.

4. **Wait ~60 seconds** — your app will be live at:
   ```
   https://YOUR_USERNAME.github.io/mink/
   ```

5. **Add to home screen** — open the URL in Safari (iOS) or Chrome (Android), tap Share → Add to Home Screen. Mink runs as a full-screen PWA with offline support.

---

## File structure

```
mink/
├── index.html          Entry point
├── manifest.json       PWA manifest
├── sw.js               Service worker (offline cache)
├── icon.svg            App icon
├── css/
│   ├── tokens.css      Design tokens & CSS variables
│   └── app.css         All component styles
└── js/
    ├── db.js           Dexie/IndexedDB schema + CRUD
    ├── utils.js        Date helpers, sorting, HTML utils
    ├── services.js     Rollover + notifications
    ├── taskrow.js      Task row builder + swipe gestures
    ├── capture.js      Capture sheet + voice input
    ├── views.js        All 5 view renderers
    └── app.js          Navigation + boot
```

---

## Features

- **Today view** — smart morning header with progress ring, priority sections, rolled-over tasks
- **Upcoming** — tasks grouped by day, up to 7 days ahead
- **Projects** — color + icon coded, per-project task lists and tag management
- **Stats** — completion metrics and 7-day bar chart
- **Someday** — backlog for undated tasks
- **Capture sheet** — title, voice-to-text, priority, notes, due date, project, tags, subtasks
- **Swipe gestures** — swipe left to delete, swipe right to move (Today ↔ Someday)
- **Auto rollover** — incomplete tasks carry forward each day automatically
- **PWA** — installable, works offline, no app store needed

---

## Tech

- Vanilla JS (ES2020) — no framework
- [Dexie.js](https://dexie.org/) — IndexedDB wrapper for local persistence
- [Tabler Icons](https://tabler.io/icons) — icon webfont
- DM Sans + DM Serif Display — Google Fonts
- Service Worker — offline-first caching

---

## Roadmap

- [ ] Drag-to-reorder tasks
- [ ] Recurring tasks (daily / weekly / monthly)
- [ ] iCloud sync (requires native Swift app)
- [ ] Dark/light mode toggle
- [ ] Configurable digest notification time
- [ ] Native iOS app (Swift / SwiftData)
