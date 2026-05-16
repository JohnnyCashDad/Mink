# Mink — Project Context

Dark-mode PWA task app. Live at `https://johnnycashdad.github.io/Mink/`
Repo: `https://github.com/JohnnyCashDad/Mink`
Swift/iOS app is a future phase — web app is the active product.

---

## Current status

All v1 screens built and deployed. UI refinement ongoing screen by screen.

### Completed
- Full dark-mode design system (deep forest-green palette, DM Sans + DM Serif Display)
- Today view: time-aware greeting, progress ring, priority sections, rolled-over tasks, inline search, swipe gestures
- Upcoming view: tasks grouped by day
- Projects view: color + icon coded, per-project task lists, tag management
- Stats view: completion metrics, 7-day bar chart
- Someday view: backlog for undated tasks
- Capture sheet (rebuilt): bare title input, full-width priority chips, schedule quick-chips (Today/Tomorrow/Pick date/Someday), collapsible field rows for project/tags/notes, subtasks with slide-out delete, voice-to-text mic
- Subtask expand on task cards: tap card body → drawer slides open → check off subtasks inline, progress bar + count update live without re-render
- Text contrast updated: --text-primary #F2F8F4, --text-secondary #C8E0D4, --text-tertiary #7ABFA0
- PWA: installable, offline-capable via service worker
- Dexie/IndexedDB persistence (no backend)

### Pending (v1 remaining)
- [ ] Task detail / edit view (tap a task with no subtasks → full detail screen)
- [ ] Drag-to-reorder tasks within a day
- [ ] Configurable digest notification time (hardcoded 8am)

### v1.1
- [ ] Recurring tasks — needs recurrenceRule logic in services.js
- [ ] Dark/light mode toggle
- [ ] Tag editing (create + delete only right now)
- [ ] Search results view (currently filters inline)

### Future — native iOS
- [ ] Swift / SwiftUI + SwiftData + CloudKit
- [ ] App Store submission

---

## Tech stack

- Vanilla JS (ES2020) — no framework, no build step
- Dexie.js — IndexedDB wrapper
- Tabler Icons webfont (cdn.jsdelivr.net)
- Google Fonts — DM Sans + DM Serif Display
- Service Worker — cache-first offline
- GitHub Pages — static hosting

---

## File map

```
mink-web/
├── index.html          Shell, tab bar, FAB, capture overlay divs
├── manifest.json       PWA manifest (theme #0E1512)
├── sw.js               Service worker, cache-first
├── icon.svg            Dark bg, italic green "m"
├── README.md           Deploy instructions
├── CLAUDE.md           This file
├── css/
│   ├── tokens.css      ALL design tokens (colors, spacing, radius, type)
│   └── app.css         All component styles — appended in sections, never rewritten wholesale
└── js/
    ├── db.js           Dexie schema + Tasks/Projects/Tags CRUD
    ├── utils.js        todayStr(), tomorrowStr(), isSomeday(), formatDue(), greeting(),
    │                   friendlyDate(), sortByPriority(), esc(), priBarClass(),
    │                   emptyState(), ringOffset()
    ├── services.js     performRollover(), setupNotifications()
    ├── taskrow.js      buildTaskRow(), toggleSubDrawer(), toggleSubtask(),
    │                   initSwipe(), toggleTask(), confirmDeleteTask(),
    │                   moveToSomeday(), moveToToday()
    ├── capture.js      cap{} state, openCapture(), openEdit(), closeCapture(),
    │                   _renderSheet(), _buildHTML(), _attachListeners(),
    │                   saveTask(), SpeechService, _attachMic()
    ├── views.js        renderToday/Upcoming/Projects/Stats/Someday(),
    │                   _bindTaskDelegation(), _bindProjectsDelegation()
    └── app.js          activeTab, renderView(), switchTab(), boot
```

Script load order is critical — each file depends on globals from files before it:
db.js → utils.js → services.js → taskrow.js → capture.js → views.js → app.js

---

## Design tokens (css/tokens.css)

| Token | Value | Usage |
|---|---|---|
| --bg-base | #0E1512 | App background |
| --bg-card | #141F1A | Task cards, capture sheet |
| --bg-elevated | #1A2920 | Inputs, pills, chips |
| --border-subtle | #1A2920 | Drawer borders, dividers |
| --border-default | #1E2B24 | Card borders |
| --border-strong | #253B2E | Hover, focus borders |
| --accent | #1D9E75 | Brand green — ring, FAB, active tab |
| --text-primary | #F2F8F4 | Task titles, main content |
| --text-secondary | #C8E0D4 | Subtitles, meta, chips |
| --text-tertiary | #7ABFA0 | Section labels, placeholders |
| --text-inverse | #0E1512 | Text on accent backgrounds |
| --pri-high | #E24B4A | High priority, overdue |
| --pri-med | #EF9F27 | Medium priority |

Typography: DM Serif Display italic for hero greeting only. DM Sans everywhere else.

---

## Data model

Dexie schema: tasks: 'id, scheduledFor, isComplete, projectId, createdAt, sortOrder'

Task shape:
{
  id:             string (UUID),
  title:          string,
  notes:          string,
  priority:       'high'|'medium'|'low'|'none',
  scheduledFor:   string YYYY-MM-DD. '9999-01-01' = Someday sentinel,
  dueDate:        string|null,
  isComplete:     boolean,
  isRolledOver:   boolean,
  originalDate:   string|null,
  projectId:      string|null,
  tagIds:         string[],
  subtasks:       [{id, title, isComplete}],
  recurrenceRule: null  ('daily'|'weekly'|'monthly' in v1.1),
  sortOrder:      number (Date.now() at creation),
  createdAt:      string ISO,
}

Key conventions:
- Someday: use isSomeday(task) which checks >= '9000', never strict equality
- Date filtering: always fetch all, filter in JS — never Dexie compound date queries
- Rollover: performRollover() is idempotent, stamps localStorage['mink.lastRollover']
- Sorting: sortByPriority() → high/med/low/none → fallback sortOrder → createdAt

---

## Key component behaviours

### Task card
- Left-edge priority bar (3px, color-coded)
- Checkbox (data-action="toggle") stops propagation — never triggers expand/edit
- Card body with subtasks: data-action="expand" → toggleSubDrawer()
- Card body without subtasks: data-action="edit" → openEdit()
- Subtask drawer: slides open via max-height transition on .sub-expanded class
- Subtask rows: data-action="toggle-subtask" → toggleSubtask() updates DB + DOM directly (no re-render)
- Progress bar + count update live; count turns accent green when all done
- Swipe left → delete (animated), swipe right → move Today/Someday

### Capture sheet
- State object cap{} holds all draft values
- Schedule stored as cap.schedule: 'today'|'tomorrow'|'date'|'someday'
- saveTask() maps schedule → scheduledFor date string
- Title textarea auto-grows; header "Add" button activates as you type (second submit path)
- Tags expand inline below tags field row when tapped
- Project uses hidden <select> overlaid on a styled field row
- Mic button: click to start/stop; .recording class triggers red pulse animation

### Event delegation pattern
All interactions use data-action + data-id attributes.
_bindTaskDelegation(root) handles: toggle, expand, edit, toggle-subtask
_bindProjectsDelegation(root) handles: open-proj, back-proj, save/cancel-new-proj, del-proj, del-tag, show-tag-form
Never add direct per-element listeners to task cards — always use delegation.

### renderView()
Single re-render entry point in app.js. Always call after data mutations.
Exception: toggleSubtask() updates DOM directly for performance — no re-render.

---

## CSS conventions

- tokens.css: colors, spacing, radius, type ONLY. Never layout.
- app.css: append new sections at the bottom with /* === SECTION NAME === */ header. Never rewrite the whole file.
- All user strings through esc() before HTML interpolation.

---

## Deployment

cd "C:\Users\Brad\OneDrive\Documents\mink-web"
git add -A
git commit -m "description"
git push origin main
# Live at https://johnnycashdad.github.io/Mink/ in ~60s
