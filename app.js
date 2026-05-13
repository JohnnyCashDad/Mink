'use strict';

// ── Database ──────────────────────────────────────────────────────────────────
const db = new Dexie('MinkDB');
db.version(1).stores({
  tasks:    'id, scheduledFor, isComplete, projectId, createdAt',
  projects: 'id, name',
  tags:     'id, name',
});

function uid() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
}

const Tasks = {
  all:    ()          => db.tasks.toArray(),
  get:    id          => db.tasks.get(id),
  add:    t           => db.tasks.add(t),
  update: (id, patch) => db.tasks.update(id, patch),
  remove: id          => db.tasks.delete(id),
  create({ title, priority = 'none', scheduledFor, dueDate = null, projectId = null, tagIds = [] }) {
    return {
      id: uid(), title, priority, scheduledFor, dueDate,
      isComplete: false, isRolledOver: false, originalDate: null,
      projectId, tagIds, createdAt: new Date().toISOString(),
    };
  },
};

const Projects = {
  all:    ()          => db.projects.toArray(),
  get:    id          => db.projects.get(id),
  add:    p           => db.projects.add(p),
  update: (id, patch) => db.projects.update(id, patch),
  remove: id          => db.projects.delete(id),
  create({ name, colorHex = '#1D9E75', icon = '📁' }) {
    return { id: uid(), name, colorHex, icon };
  },
};

const Tags = {
  all:    ()          => db.tags.toArray(),
  get:    id          => db.tags.get(id),
  add:    t           => db.tags.add(t),
  update: (id, patch) => db.tags.update(id, patch),
  remove: id          => db.tags.delete(id),
  create({ name, colorHex = '#1D9E75' }) {
    return { id: uid(), name, colorHex };
  },
};

// ── Constants & helpers ───────────────────────────────────────────────────────
const SOMEDAY      = '9999-01-01';
const ROLLOVER_KEY = 'mink.lastRollover';
const DIGEST_KEY   = 'mink.lastDigest';

const PROJECT_COLORS = ['#1D9E75','#E24B4A','#EF9F27','#3B82F6','#8B5CF6','#F59E0B','#10B981','#6B7280'];
const PROJECT_ICONS  = ['📁','💼','🏠','🎯','📚','🔧','🎨','⭐','🚀','💡'];

function todayStr() { return new Date().toISOString().slice(0, 10); }
function isSomeday(t) { return t.scheduledFor >= '9000'; }

const PRANK = { high: 0, medium: 1, low: 2, none: 3 };
function sortByPriority(arr) {
  return [...arr].sort((a, b) => {
    const r = (PRANK[a.priority] ?? 3) - (PRANK[b.priority] ?? 3);
    return r || new Date(a.createdAt) - new Date(b.createdAt);
  });
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function priorityColor(p) {
  return p === 'high' ? 'var(--pri-high)' : p === 'medium' ? 'var(--pri-medium)' : 'var(--pri-low)';
}
function sectionHeader(label) {
  return `<div class="section-hd">${esc(label)}</div>`;
}

const EMPTY_ICONS = {
  sun:      `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  calendar: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  folder:   `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  inbox:    `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
};
function emptyState(title, sub, icon = 'sun') {
  return `<div class="empty-state">${EMPTY_ICONS[icon]}<p class="empty-title">${esc(title)}</p><p class="empty-sub">${esc(sub)}</p></div>`;
}

function formatDueDate(dateStr) {
  const today = todayStr();
  const d = new Date(dateStr + 'T00:00:00');
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  if (dateStr < today)        return { label: `Overdue · ${d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}`, overdue: true };
  if (dateStr === today)      return { label: 'Due today', overdue: false };
  if (dateStr === tomorrowStr) return { label: 'Due tomorrow', overdue: false };
  return { label: `Due ${d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}`, overdue: false };
}

// ── Task row ──────────────────────────────────────────────────────────────────
function taskRow(task, projectName = '', ctx = '', tagNames = []) {
  const rightLabel = (ctx === 'upcoming' || ctx === 'someday') ? 'Today' : 'Someday';
  const rightColor = (ctx === 'upcoming' || ctx === 'someday') ? 'var(--accent)' : '#6b7280';
  const tagChips = tagNames.length
    ? `<div class="row-tags">${tagNames.map(n => `<span class="row-tag">${esc(n)}</span>`).join('')}</div>` : '';
  return `
<li class="task-row" data-id="${task.id}" data-ctx="${ctx}">
  <div class="swipe-action action-delete">Delete</div>
  <div class="swipe-action action-move" style="background:${rightColor}">${rightLabel}</div>
  <div class="task-content">
    <div class="priority-dot" style="background:${priorityColor(task.priority)}"></div>
    <button class="task-checkbox ${task.isComplete ? 'checked' : ''}"
            data-action="toggle" data-id="${task.id}"
            aria-label="${task.isComplete ? 'Mark incomplete' : 'Mark complete'}"></button>
    <div class="task-body" data-action="edit-task" data-id="${task.id}">
      <span class="task-title ${task.isComplete ? 'done' : ''}">${esc(task.title)}</span>
      ${task.isRolledOver && !task.isComplete ? '<span class="rolled-tag">rolled over</span>' : ''}
      ${(() => { if (!task.dueDate || task.isComplete) return ''; const f = formatDueDate(task.dueDate); return `<span class="task-due${f.overdue?' overdue':''}">${f.label}</span>`; })()}
      ${projectName ? `<span class="task-project">${esc(projectName)}</span>` : ''}
      ${tagChips}
    </div>
  </div>
</li>`;
}

function initRowSwipe(row) {
  const inner = row.querySelector('.task-content');
  let sx = 0, sy = 0, horiz = null;
  const MAX = 90, THRESH = 60;

  row.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    horiz = null;
    inner.style.transition = 'none';
  }, { passive: true });

  row.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
    if (horiz === null) horiz = Math.abs(dx) > Math.abs(dy);
    if (!horiz) return;
    inner.style.transform = `translateX(${Math.max(-MAX, Math.min(MAX, dx))}px)`;
  }, { passive: true });

  row.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    inner.style.transition = 'transform 0.2s ease';
    inner.style.transform = '';
    if (!horiz) return;
    if      (dx < -THRESH) deleteTaskById(row.dataset.id);
    else if (dx >  THRESH) {
      const ctx = row.dataset.ctx;
      if (ctx === 'upcoming' || ctx === 'someday') moveToToday(row.dataset.id);
      else moveToSomeday(row.dataset.id);
    }
  }, { passive: true });
}

// ── Step 7: Rollover ──────────────────────────────────────────────────────────
async function performRollover() {
  const today = todayStr();
  if (localStorage.getItem(ROLLOVER_KEY) === today) return;
  const all = await Tasks.all();
  await Promise.all(
    all
      .filter(t => !t.isComplete && !isSomeday(t) && t.scheduledFor < today)
      .map(t => Tasks.update(t.id, {
        scheduledFor: today,
        isRolledOver: true,
        originalDate: t.originalDate ?? t.scheduledFor,
      }))
  );
  localStorage.setItem(ROLLOVER_KEY, today);
}

// ── Step 5: Today view ────────────────────────────────────────────────────────
async function renderToday() {
  const content = document.getElementById('content');
  const today   = todayStr();
  const [allTasks, allProjects, allTags] = await Promise.all([Tasks.all(), Projects.all(), Tags.all()]);
  const projMap = Object.fromEntries(allProjects.map(p => [p.id, p.name]));
  const tagMap  = Object.fromEntries(allTags.map(t => [t.id, t.name]));

  const todayTasks = allTasks.filter(t => t.scheduledFor === today);
  const rolledOver = sortByPriority(todayTasks.filter(t => !t.isComplete &&  t.isRolledOver));
  const incomplete = sortByPriority(todayTasks.filter(t => !t.isComplete && !t.isRolledOver));
  const completed  = todayTasks.filter(t => t.isComplete);

  if (!rolledOver.length && !incomplete.length && !completed.length) {
    content.innerHTML = emptyState('Nothing scheduled for today', 'Tap + to capture something', 'sun');
    return;
  }

  const tn = t => (t.tagIds||[]).map(id => tagMap[id]).filter(Boolean);
  let html = '';
  if (rolledOver.length) {
    html += sectionHeader('Rolled Over');
    html += `<ul class="task-list">${rolledOver.map(t => taskRow(t, projMap[t.projectId]||'', 'today', tn(t))).join('')}</ul>`;
  }
  if (incomplete.length) {
    html += sectionHeader('Today');
    html += `<ul class="task-list">${incomplete.map(t => taskRow(t, projMap[t.projectId]||'', 'today', tn(t))).join('')}</ul>`;
  }
  if (completed.length) {
    html += `<details class="done-section"><summary class="section-hd">Completed (${completed.length})</summary><ul class="task-list">${completed.map(t => taskRow(t, projMap[t.projectId]||'', 'today', tn(t))).join('')}</ul></details>`;
  }
  content.innerHTML = html;
  content.querySelectorAll('.task-row').forEach(initRowSwipe);
}

// ── Step 8: Upcoming view ─────────────────────────────────────────────────────
async function renderUpcoming() {
  const content = document.getElementById('content');
  const today      = todayStr();
  const tomorrow   = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const [allTasks, allProjects, allTags] = await Promise.all([Tasks.all(), Projects.all(), Tags.all()]);
  const projMap = Object.fromEntries(allProjects.map(p => [p.id, p.name]));
  const tagMap  = Object.fromEntries(allTags.map(t => [t.id, t.name]));
  const upcoming = allTasks.filter(t => !t.isComplete && !isSomeday(t) && t.scheduledFor > today);

  if (!upcoming.length) {
    content.innerHTML = emptyState('Nothing coming up', 'Future tasks appear here', 'calendar');
    return;
  }

  const groups = {};
  upcoming.forEach(t => { (groups[t.scheduledFor] ??= []).push(t); });

  const tn = t => (t.tagIds||[]).map(id => tagMap[id]).filter(Boolean);
  let html = '';
  Object.keys(groups).sort().forEach(ds => {
    const label = ds === tomorrowStr
      ? 'Tomorrow'
      : new Date(ds + 'T00:00:00').toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric' });
    html += sectionHeader(label);
    html += `<ul class="task-list">${sortByPriority(groups[ds]).map(t => taskRow(t, projMap[t.projectId]||'', 'upcoming', tn(t))).join('')}</ul>`;
  });
  content.innerHTML = html;
  content.querySelectorAll('.task-row').forEach(initRowSwipe);
}

// ── Step 9a: Projects view ────────────────────────────────────────────────────
let activeProjectId    = null;
let showNewProjectForm = false;
const newProjectDraft  = { name: '', colorHex: PROJECT_COLORS[0], icon: PROJECT_ICONS[0] };

async function renderProjects() {
  const content = document.getElementById('content');

  if (activeProjectId)   { await renderProjectDetail(activeProjectId); return; }
  if (showNewProjectForm) { renderNewProjectForm(content); return; }

  const [allProjects, allTasks] = await Promise.all([Projects.all(), Tasks.all()]);
  if (!allProjects.length) {
    content.innerHTML = emptyState('No projects yet', 'Tap + to create one', 'folder');
    return;
  }

  const countMap = {};
  allTasks.forEach(t => { if (t.projectId && !t.isComplete) countMap[t.projectId] = (countMap[t.projectId]||0) + 1; });

  content.innerHTML = `<div class="proj-list">${allProjects.map(p => `
<div class="proj-row" data-action="open-project" data-id="${p.id}">
  <div class="proj-icon" style="background:${p.colorHex}22;color:${p.colorHex}">${p.icon}</div>
  <span class="proj-name">${esc(p.name)}</span>
  ${countMap[p.id] ? `<span class="proj-badge">${countMap[p.id]}</span>` : ''}
  <svg class="proj-chevron" width="8" height="13" viewBox="0 0 8 13"><path d="M1 1l6 5.5L1 12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>
</div>`).join('')}</div>`;
}

function renderNewProjectForm(content) {
  content.innerHTML = `
<div class="new-proj-form">
  <div class="field-label">Project name</div>
  <input id="new-proj-name" class="new-proj-input" type="text" placeholder="Project name" value="${esc(newProjectDraft.name)}" autocapitalize="sentences">
  <div class="field-label" style="margin-top:16px">Color</div>
  <div class="swatch-row">${PROJECT_COLORS.map(c => `<button class="color-swatch ${c===newProjectDraft.colorHex?'active':''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div>
  <div class="field-label" style="margin-top:12px">Icon</div>
  <div class="icon-row">${PROJECT_ICONS.map((i, idx) => `<button class="icon-opt ${i===newProjectDraft.icon?'active':''}" data-icon-idx="${idx}">${i}</button>`).join('')}</div>
  <div class="new-proj-actions">
    <button class="btn-cancel" data-action="cancel-new-project">Cancel</button>
    <button class="btn-save"   data-action="save-new-project">Create</button>
  </div>
</div>`;
  const ni = document.getElementById('new-proj-name');
  ni.focus();
  ni.addEventListener('input', e => { newProjectDraft.name = e.target.value; });

  document.querySelectorAll('.new-proj-form .color-swatch').forEach(s => {
    s.addEventListener('click', () => {
      newProjectDraft.colorHex = s.dataset.color;
      document.querySelectorAll('.new-proj-form .color-swatch').forEach(x => x.classList.toggle('active', x === s));
    });
  });

  document.querySelectorAll('.new-proj-form .icon-opt').forEach(o => {
    o.addEventListener('click', () => {
      newProjectDraft.icon = PROJECT_ICONS[parseInt(o.dataset.iconIdx)];
      document.querySelectorAll('.new-proj-form .icon-opt').forEach(x => x.classList.toggle('active', x === o));
    });
  });
}

async function renderProjectDetail(id) {
  const content = document.getElementById('content');
  const [project, allTasks, allProjects, allTags] = await Promise.all([Projects.get(id), Tasks.all(), Projects.all(), Tags.all()]);
  const tagMap = Object.fromEntries(allTags.map(t => [t.id, t.name]));
  const tn = t => (t.tagIds||[]).map(id => tagMap[id]).filter(Boolean);
  if (!project) { activeProjectId = null; await renderProjects(); return; }

  const projTasks = allTasks.filter(t => t.projectId === id);
  const open = sortByPriority(projTasks.filter(t => !t.isComplete));
  const done = projTasks.filter(t => t.isComplete);

  let html = `
<div class="proj-detail-header" style="background:${project.colorHex}">
  <button class="back-btn" data-action="back-to-projects">‹ Projects</button>
  <div class="proj-detail-icon">${project.icon}</div>
  <div class="proj-detail-name">${esc(project.name)}</div>
</div>`;

  if (!open.length && !done.length) {
    html += emptyState('No tasks yet', 'Tap + to add one', 'sun');
  } else {
    if (open.length) html += sectionHeader('Open') + `<ul class="task-list">${open.map(t => taskRow(t,'','project',tn(t))).join('')}</ul>`;
    if (done.length) html += `<details class="done-section"><summary class="section-hd">Done (${done.length})</summary><ul class="task-list">${done.map(t => taskRow(t,'','project',tn(t))).join('')}</ul></details>`;
  }

  // Tags management
  const tagRows = allTags.map(t => `
<div class="tag-row">
  <span class="tag-dot" style="background:${t.colorHex}"></span>
  <span class="tag-name">${esc(t.name)}</span>
  <button class="tag-del-btn" data-action="delete-tag" data-id="${t.id}">×</button>
</div>`).join('');

  html += `
<div class="tags-section">
  <div class="section-hd" style="padding-top:20px">Tags</div>
  ${tagRows}
  <div id="new-tag-form" class="new-tag-form hidden"></div>
  <button class="new-tag-btn" data-action="show-new-tag-form">+ New Tag</button>
</div>
<div class="danger-zone">
  <button class="danger-btn" data-action="delete-project" data-id="${id}">Delete Project</button>
</div>`;

  content.innerHTML = html;
  content.querySelectorAll('.task-row').forEach(initRowSwipe);
}

// ── Step 9b: Someday view ─────────────────────────────────────────────────────
async function renderSomeday() {
  const content = document.getElementById('content');
  const [allTasks, allProjects, allTags] = await Promise.all([Tasks.all(), Projects.all(), Tags.all()]);
  const projMap = Object.fromEntries(allProjects.map(p => [p.id, p.name]));
  const tagMap  = Object.fromEntries(allTags.map(t => [t.id, t.name]));
  const someday = sortByPriority(allTasks.filter(t => !t.isComplete && isSomeday(t)));

  if (!someday.length) {
    content.innerHTML = emptyState('Backlog is clear', 'Tasks parked for someday appear here', 'inbox');
    return;
  }
  const tn = t => (t.tagIds||[]).map(id => tagMap[id]).filter(Boolean);
  content.innerHTML = `<ul class="task-list">${someday.map(t => taskRow(t, projMap[t.projectId]||'', 'someday', tn(t))).join('')}</ul>`;
  content.querySelectorAll('.task-row').forEach(initRowSwipe);
}

// ── Step 6: Capture modal ─────────────────────────────────────────────────────
const capture = { title:'', priority:'none', isSomeday:false, hasDueDate:false, dueDate:'', projectId:null, tagIds:[], editingId:null };

function openCapture({ asSomeday = false, projectId = null } = {}) {
  Object.assign(capture, { editingId:null, title:'', priority:'none', isSomeday:asSomeday, hasDueDate:false, dueDate:todayStr(), projectId, tagIds:[] });
  document.getElementById('capture-overlay').classList.add('open');
  document.getElementById('capture-sheet').classList.add('open');
  renderCaptureSheet();
}

async function openEdit(id) {
  const task = await Tasks.get(id);
  if (!task) return;
  Object.assign(capture, {
    editingId: id,
    title:      task.title,
    priority:   task.priority,
    isSomeday:  isSomeday(task),
    hasDueDate: !!task.dueDate,
    dueDate:    task.dueDate || todayStr(),
    projectId:  task.projectId,
    tagIds:     [...(task.tagIds || [])],
  });
  document.getElementById('capture-overlay').classList.add('open');
  document.getElementById('capture-sheet').classList.add('open');
  renderCaptureSheet();
}

function closeCapture() {
  document.getElementById('capture-overlay').classList.remove('open');
  document.getElementById('capture-sheet').classList.remove('open');
  if (speech.recording) speech.stop();
}

async function renderCaptureSheet() {
  const [allProjects, allTags] = await Promise.all([Projects.all(), Tags.all()]);
  document.getElementById('capture-sheet').innerHTML = buildCaptureHTML(allProjects, allTags);
  attachCaptureListeners();
  const el = document.getElementById('capture-title');
  if (el) { el.value = capture.title; el.focus(); }
}

function buildCaptureHTML(allProjects, allTags) {
  const priChips = ['none','low','medium','high'].map(p => `
<button class="pri-chip${capture.priority===p?' active':''}" data-pri="${p}">
  <span class="chip-dot" style="background:${priorityColor(p)}"></span>
  ${p.charAt(0).toUpperCase()+p.slice(1)}
</button>`).join('');

  const projOpts = allProjects.map(p =>
    `<option value="${p.id}"${capture.projectId===p.id?' selected':''}>${esc(p.name)}</option>`).join('');

  const tagChips = allTags.map(tag => {
    const sel = capture.tagIds.includes(tag.id);
    return `<button class="capture-tag${sel?' active':''}" data-tagid="${tag.id}"
      style="${sel?`background:${tag.colorHex}22;color:${tag.colorHex};border-color:${tag.colorHex}`:''}">${esc(tag.name)}</button>`;
  }).join('');

  return `
<div class="sheet-handle"></div>
<div class="sheet-header">
  <button class="sheet-cancel" id="capture-cancel">Cancel</button>
  <span class="sheet-title">${capture.editingId ? 'Edit Task' : 'New Task'}</span>
</div>
<div class="sheet-body">
  <div class="capture-title-row">
    <textarea id="capture-title" class="capture-title-input" placeholder="What's on your mind?" rows="2"></textarea>
    <button class="mic-btn" id="mic-btn" type="button" aria-label="Hold to record">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V20H9v2h6v-2h-2v-2.07A7 7 0 0 0 19 11h-2z"/>
      </svg>
    </button>
  </div>
  <div class="field-label">Priority</div>
  <div class="pri-chips">${priChips}</div>
  <div class="toggle-row">
    <div class="toggle-info">
      <div class="toggle-title">Someday</div>
      <div class="toggle-sub">No specific date — park it in the backlog</div>
    </div>
    <label class="ios-toggle"><input type="checkbox" id="someday-chk"${capture.isSomeday?' checked':''}><span class="ios-thumb"></span></label>
  </div>
  ${!capture.isSomeday ? `
  <div class="toggle-row">
    <div class="toggle-title">Due date</div>
    <label class="ios-toggle"><input type="checkbox" id="duedate-chk"${capture.hasDueDate?' checked':''}><span class="ios-thumb"></span></label>
  </div>
  ${capture.hasDueDate ? `<input type="date" id="due-date" class="due-date-input" value="${capture.dueDate}" min="${todayStr()}">` : ''}
  ` : ''}
  ${allProjects.length ? `
  <div class="field-label">Project</div>
  <select id="project-sel" class="project-select">
    <option value="">None</option>${projOpts}
  </select>` : ''}
  ${allTags.length ? `
  <div class="field-label">Tags</div>
  <div class="capture-tags">${tagChips}</div>` : ''}
</div>
<div class="sheet-footer">
  <button class="add-task-btn" id="add-task-btn"${!capture.title.trim()?' disabled':''}>${capture.editingId ? 'Save Changes' : 'Add Task'}</button>
</div>`;
}

function attachCaptureListeners() {
  const titleEl = document.getElementById('capture-title');

  titleEl.addEventListener('input', () => {
    capture.title = titleEl.value;
    document.getElementById('add-task-btn').disabled = !capture.title.trim();
  });

  document.querySelectorAll('.pri-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      capture.priority = btn.dataset.pri;
      document.querySelectorAll('.pri-chip').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  document.getElementById('someday-chk').addEventListener('change', e => {
    capture.title = titleEl.value;
    capture.isSomeday = e.target.checked;
    if (capture.isSomeday) capture.hasDueDate = false;
    renderCaptureSheet();
  });

  const ddChk = document.getElementById('duedate-chk');
  if (ddChk) ddChk.addEventListener('change', e => {
    capture.title = titleEl.value;
    capture.hasDueDate = e.target.checked;
    renderCaptureSheet();
  });

  const ddInput = document.getElementById('due-date');
  if (ddInput) ddInput.addEventListener('change', e => { capture.dueDate = e.target.value; });

  const projSel = document.getElementById('project-sel');
  if (projSel) projSel.addEventListener('change', e => { capture.projectId = e.target.value || null; });

  document.querySelectorAll('.capture-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      capture.title = titleEl.value;
      const id = btn.dataset.tagid;
      const idx = capture.tagIds.indexOf(id);
      idx === -1 ? capture.tagIds.push(id) : capture.tagIds.splice(idx, 1);
      renderCaptureSheet();
    });
  });

  document.getElementById('capture-cancel').addEventListener('click', closeCapture);
  document.getElementById('add-task-btn').addEventListener('click', saveTask);
  document.getElementById('capture-overlay').addEventListener('click', closeCapture);
  attachMicButton();
}

async function saveTask() {
  const title = capture.title.trim();
  if (!title) return;
  let scheduledFor;
  if (capture.isSomeday)                          scheduledFor = SOMEDAY;
  else if (capture.hasDueDate && capture.dueDate) scheduledFor = capture.dueDate;
  else                                            scheduledFor = todayStr();

  const patch = {
    title, priority: capture.priority, scheduledFor,
    dueDate:   (capture.isSomeday || !capture.hasDueDate) ? null : capture.dueDate,
    projectId: capture.projectId,
    tagIds:    [...capture.tagIds],
  };

  if (capture.editingId) {
    await Tasks.update(capture.editingId, patch);
  } else {
    await Tasks.add(Tasks.create(patch));
  }
  closeCapture();
  renderView();
}

// ── Step 10: Voice input ──────────────────────────────────────────────────────
class Speech {
  constructor() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.available = !!SR;
    if (SR) {
      this.rec = new SR();
      this.rec.continuous = false;
      this.rec.interimResults = true;
      this.rec.lang = 'en-US';
    }
    this.recording = false; this.transcript = '';
    this.onUpdate = null; this.onDone = null;
  }
  start() {
    if (!this.available || this.recording) return;
    this.transcript = ''; this.recording = true;
    this.rec.onresult = e => {
      let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      this.transcript = t;
      if (this.onUpdate) this.onUpdate(t);
    };
    this.rec.onerror = () => this._done();
    this.rec.onend   = () => this._done();
    try { this.rec.start(); } catch(e) { this.recording = false; }
  }
  stop() { if (this.recording) try { this.rec.stop(); } catch(e) {} }
  _done() {
    const was = this.recording; this.recording = false;
    if (was && this.onDone) this.onDone(this.transcript);
  }
}
const speech = new Speech();

function attachMicButton() {
  const btn = document.getElementById('mic-btn');
  if (!btn) return;
  let before = '';

  function startVoice() {
    if (!speech.available) {
      alert('Speech recognition not available.\nbrowser: ' + navigator.userAgent.slice(0,80));
      return;
    }
    before = (document.getElementById('capture-title')?.value || '').trimEnd();
    speech.onUpdate = text => {
      const el = document.getElementById('capture-title');
      if (!el) return;
      el.value = before ? before + ' ' + text : text;
      capture.title = el.value;
      document.getElementById('add-task-btn').disabled = !el.value.trim();
    };
    speech.onDone = text => {
      const final = text.trim();
      if (final) {
        capture.title = before ? before + ' ' + final : final;
        const el = document.getElementById('capture-title');
        if (el) el.value = capture.title;
      }
      document.getElementById('mic-btn')?.classList.remove('recording');
      document.getElementById('add-task-btn').disabled = !capture.title.trim();
    };
    speech.start();
    btn.classList.add('recording');
  }

  btn.addEventListener('click', e => {
    e.preventDefault();
    if (speech.recording) speech.stop();
    else startVoice();
  });
}

// ── Step 11: Notifications ────────────────────────────────────────────────────
async function setupNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission !== 'granted') return;
  const now = new Date();
  if (now.getHours() < 8) return;
  const today = todayStr();
  if (localStorage.getItem(DIGEST_KEY) === today) return;
  const all = await Tasks.all();
  const todayTasks = sortByPriority(all.filter(t => !t.isComplete && t.scheduledFor === today));
  const n = todayTasks.length;
  const body = n === 0
    ? "Nothing on today's list yet. Tap to plan your day."
    : `You have ${n} task${n===1?'':'s'} today. First up: ${todayTasks[0].title}`;
  new Notification('Good morning', { body });
  localStorage.setItem(DIGEST_KEY, today);
}

// ── Task actions ──────────────────────────────────────────────────────────────
async function toggleTask(id)    { const t = await Tasks.get(id); if(t) await Tasks.update(id, {isComplete:!t.isComplete}); renderView(); }
async function deleteTaskById(id){ await Tasks.remove(id); renderView(); }
async function moveToSomeday(id) { await Tasks.update(id, {scheduledFor:SOMEDAY, dueDate:null, isRolledOver:false}); renderView(); }
async function moveToToday(id)   { await Tasks.update(id, {scheduledFor:todayStr(), isRolledOver:false}); renderView(); }

// ── Navigation ────────────────────────────────────────────────────────────────
const TAB_LABELS = { today:'Today', upcoming:'Upcoming', projects:'Projects', someday:'Someday' };
let activeTab = 'today';

async function renderView() {
  const fab = document.getElementById('fab');
  fab.style.display = '';

  if (activeTab === 'today') {
    fab.onclick = () => openCapture({});
    await renderToday();
  } else if (activeTab === 'upcoming') {
    fab.onclick = () => openCapture({});
    await renderUpcoming();
  } else if (activeTab === 'projects') {
    if (activeProjectId) {
      fab.onclick = () => openCapture({ projectId: activeProjectId });
    } else if (showNewProjectForm) {
      fab.style.display = 'none';
    } else {
      fab.onclick = () => { showNewProjectForm = true; renderView(); };
    }
    await renderProjects();
  } else if (activeTab === 'someday') {
    fab.onclick = () => openCapture({ asSomeday: true });
    await renderSomeday();
  }
}

function switchTab(tab) {
  activeTab = tab;
  activeProjectId = null;
  showNewProjectForm = false;
  document.getElementById('top-bar-title').textContent = TAB_LABELS[tab];
  document.getElementById('top-bar').dataset.tab = tab;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderView();
}

// ── Event delegation ──────────────────────────────────────────────────────────
document.getElementById('content').addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;

  if      (action === 'toggle')        { toggleTask(id); }
  else if (action === 'edit-task')     { openEdit(id); }
  else if (action === 'open-project')  { activeProjectId = id; renderView(); }
  else if (action === 'back-to-projects') { activeProjectId = null; renderView(); }

  else if (action === 'delete-project') {
    if (!confirm('Delete this project? Tasks will be unassigned.')) return;
    const all = await Tasks.all();
    await Promise.all(all.filter(t => t.projectId === id).map(t => Tasks.update(t.id, { projectId: null })));
    await Projects.remove(id);
    activeProjectId = null; renderView();
  }

  else if (action === 'cancel-new-project') {
    showNewProjectForm = false;
    Object.assign(newProjectDraft, { name:'', colorHex:PROJECT_COLORS[0], icon:PROJECT_ICONS[0] });
    renderView();
  }
  else if (action === 'save-new-project') {
    const name = (document.getElementById('new-proj-name')?.value || newProjectDraft.name).trim();
    if (!name) { document.getElementById('new-proj-name')?.focus(); return; }
    await Projects.add(Projects.create({ name, colorHex: newProjectDraft.colorHex, icon: newProjectDraft.icon }));
    showNewProjectForm = false; newProjectDraft.name = ''; renderView();
  }

  else if (action === 'delete-tag') {
    await Tags.remove(id);
    const all = await Tasks.all();
    await Promise.all(all.map(t => Tasks.update(t.id, { tagIds: t.tagIds.filter(x => x !== id) })));
    renderView();
  }

  else if (action === 'show-new-tag-form') {
    const form = document.getElementById('new-tag-form');
    if (!form) return;
    form.classList.remove('hidden');
    let chosenColor = PROJECT_COLORS[0];
    form.innerHTML = `
<input id="new-tag-name" class="new-proj-input" type="text" placeholder="Tag name" style="margin-bottom:8px">
<div class="swatch-row">${PROJECT_COLORS.slice(0,6).map(c=>`<button class="tag-color-swatch color-swatch${c===chosenColor?' active':''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div>
<div class="new-proj-actions" style="margin-top:8px">
  <button class="btn-cancel" id="cancel-tag-btn">Cancel</button>
  <button class="btn-save"   id="save-tag-btn">Add</button>
</div>`;
    document.getElementById('new-tag-name').focus();
    form.querySelectorAll('.tag-color-swatch').forEach(s => {
      s.addEventListener('click', () => {
        chosenColor = s.dataset.color;
        form.querySelectorAll('.tag-color-swatch').forEach(x => x.classList.toggle('active', x === s));
      });
    });
    document.getElementById('cancel-tag-btn').addEventListener('click', () => { form.classList.add('hidden'); form.innerHTML=''; });
    document.getElementById('save-tag-btn').addEventListener('click', async () => {
      const name = document.getElementById('new-tag-name')?.value.trim();
      if (!name) return;
      await Tags.add(Tags.create({ name, colorHex: chosenColor }));
      renderView();
    });
  }

});

document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  await performRollover();
  setupNotifications();
  switchTab('today');
})();
