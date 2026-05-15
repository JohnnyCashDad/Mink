# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Mink is a mobile-first PWA task manager hosted on GitHub Pages at `https://JohnnyCashDad.github.io/Mink/`. It is a companion to a native iOS SwiftUI app (in the sibling `mink/` folder) and is used for testing while the Apple Developer account decision is pending.

**Stack:** Vanilla JS (no build step, no npm), plain HTML + CSS, IndexedDB via Dexie.js (CDN). Three files: `index.html`, `style.css`, `app.js`.

**Deploy:** `git add index.html style.css app.js && git commit -m "..." && git push`. GitHub Pages auto-deploys within ~60 seconds. Remote: `https://github.com/JohnnyCashDad/Mink.git`.

**Local dev:** Open `index.html` directly in a browser. No server required.

## Architecture

Everything lives in `app.js` — no modules, no framework. The pattern is:

1. **Data layer** — `Tasks`, `Projects`, `Tags` objects wrap Dexie table operations (`all`, `get`, `add`, `update`, `remove`, `create`). `create()` builds a new record with defaults; `add()` writes it to IndexedDB.
2. **Render functions** — Each view (`renderToday`, `renderUpcoming`, `renderProjects`, `renderSomeday`) fetches all data, filters/sorts in JS, and sets `document.getElementById('content').innerHTML`. After setting innerHTML, each render function calls `initRowSwipe()` on every `.task-row`.
3. **Navigation** — `switchTab(tab)` sets `activeTab`, resets `activeProjectId` and `showNewProjectForm`, then calls `renderView()`. `renderView()` routes to the correct render function and wires up the FAB.
4. **Event delegation** — A single click listener on `#content` handles all `data-action` clicks. The pattern is `e.target.closest('[data-action]')`. Actions: `toggle`, `edit-task`, `open-project`, `back-to-projects`, `delete-project`, `cancel-new-project`, `save-new-project`, `delete-tag`, `show-new-tag-form`.
5. **Capture / Edit modal** — The `capture` object is the single source of truth for the sheet state (`title`, `priority`, `isSomeday`, `hasDueDate`, `dueDate`, `projectId`, `tagIds`, `editingId`). `openCapture()` resets and opens; `openEdit(id)` pre-fills from DB and opens. Both call `renderCaptureSheet()` → `buildCaptureHTML()` → `attachCaptureListeners()`. Toggling Someday or due-date re-renders the sheet (save `capture.title` before, restore after via `el.value = capture.title`). `saveTask()` does `Tasks.update` if `editingId` is set, otherwise `Tasks.add`.
6. **Boot sequence** — `performRollover()` → `setupNotifications()` → `switchTab('today')`.

## Key conventions

**SOMEDAY sentinel:** Tasks in the Someday backlog get `scheduledFor = '9999-01-01'`. Use `isSomeday(t)` (checks `>= '9000'`) rather than strict equality — safer after any serialisation round-trips. All date filters in Today/Upcoming naturally exclude this value.

**Date filtering:** `#Predicate` alternatives are not needed — all data is loaded with `Tasks.all()` and filtered in JS. Datasets are small; this is intentional.

**Task row signature:** `taskRow(task, projectName, ctx, tagNames)`. `ctx` drives swipe-action labels and behaviour: `'today'` → swipe-right = Someday; `'upcoming'`/`'someday'` → swipe-right = Today; swipe-left always deletes. Pass `(t.tagIds||[]).map(id => tagMap[id]).filter(Boolean)` for `tagNames`.

**Icon picker:** Icon buttons use `data-icon-idx` (index into `PROJECT_ICONS`) not the emoji string directly — emoji in data attributes are unreliable cross-browser. Read with `PROJECT_ICONS[parseInt(o.dataset.iconIdx)]`.

**Color/icon pickers in forms:** Attach direct event listeners after setting `innerHTML` (done in `renderNewProjectForm`). Do NOT use event delegation for these — the `if (!el) return` early-exit in the delegation handler will swallow clicks on elements without `data-action`.

**Swipe:** `initRowSwipe(row)` attaches touch listeners to each row. MAX travel = 90px, THRESH = 60px. Scroll direction detection (`horiz` flag) is set on first `touchmove` and gates all subsequent moves.

**Voice (mic button):** Uses `click` event (tap-to-toggle) rather than `pointerdown`/`touchstart` — iOS Safari does not reliably fire those on buttons inside a bottom sheet. `speech.recording` tracks state; click toggles start/stop.

**Rollover:** Idempotent via `localStorage` key `mink.lastRollover` (stores today's date string). Safe to call multiple times per day.

**Morning digest:** Fires once after 8 AM, gated by `localStorage` key `mink.lastDigest`. Body is computed at fire time from current task list.

**CSS tokens:** All brand colours are CSS custom properties on `:root` — `--accent`, `--header-bg`, `--dark-text`, `--pri-high`, `--pri-medium`, `--pri-low`. Do not hardcode hex values in JS or HTML; use `var(--token-name)` or reference the constants `PROJECT_COLORS[0]` etc.

**Top bar colour:** Driven by `data-tab` attribute on `#top-bar`. Today tab gets teal background; all others get white with a border — handled entirely in CSS.

## Data model

```
Task:    { id, title, priority('none'|'low'|'medium'|'high'), scheduledFor(YYYY-MM-DD),
           dueDate(YYYY-MM-DD|null), isComplete, isRolledOver, originalDate, projectId, tagIds[], createdAt }
Project: { id, name, colorHex, icon }
Tag:     { id, name, colorHex }
```

Tags are global labels (not folders). They are created inside the Projects tab → project detail view, and assigned to tasks in the capture/edit sheet.

## Known issues / outstanding work

- Voice capture (mic button) works in Safari on iPhone and Chrome on desktop. Does not work in Firefox.
- Data is device-local (IndexedDB). No sync between devices.
- Completed tasks from previous days are stored but not surfaced anywhere in the UI.
- No tag-based filtering view.
