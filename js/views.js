'use strict';

// ── Today view ────────────────────────────────────────────────────────────────
async function renderToday() {
  const content = document.getElementById('app-content');
  const today   = todayStr();
  const [allTasks, allProjects, allTags] = await Promise.all([Tasks.all(), Projects.all(), Tags.all()]);

  const projMap = Object.fromEntries(allProjects.map(p => [p.id, p]));
  const tagMap  = Object.fromEntries(allTags.map(t => [t.id, t.name]));
  const tn      = t => (t.tagIds || []).map(id => tagMap[id]).filter(Boolean);

  const todayTasks = allTasks.filter(t => t.scheduledFor === today);
  const rolled     = sortByPriority(todayTasks.filter(t => !t.isComplete &&  t.isRolledOver));
  const active     = sortByPriority(todayTasks.filter(t => !t.isComplete && !t.isRolledOver));
  const completed  = todayTasks.filter(t => t.isComplete);

  const totalOpen = rolled.length + active.length;
  const totalAll  = totalOpen + completed.length;
  const doneCount = completed.length;

  // Hero
  const highCount = [...rolled, ...active].filter(t => t.priority === 'high').length;
  const rolledCount = rolled.length;
  const offset = ringOffset(doneCount, totalAll);

  const heroHTML = `
<div id="today-hero">
  <div class="hero-eyebrow">${friendlyDate()}</div>
  <div class="hero-title">Good <em>${greeting()}.</em></div>
  <div class="progress-card">
    <div class="ring-wrap">
      <svg width="52" height="52" viewBox="0 0 40 40">
        <circle class="ring-track" cx="20" cy="20" r="18"/>
        <circle class="ring-arc" id="ring-arc" cx="20" cy="20" r="18" style="stroke-dashoffset:${offset}"/>
      </svg>
      <div class="ring-label" id="ring-pct">${totalAll > 0 ? Math.round((doneCount/totalAll)*100) : 0}%</div>
    </div>
    <div class="progress-info">
      <div class="progress-primary" id="prog-primary">${doneCount} of ${totalAll} done</div>
      <div class="progress-sub" id="prog-sub">${totalOpen === 0 ? 'All done — great work!' : `${totalOpen} remaining today`}</div>
      <div class="progress-pills">
        ${highCount ? `<div class="progress-pill"><span class="pill-dot" style="background:var(--pri-high)"></span>${highCount} high</div>` : ''}
        ${rolledCount ? `<div class="progress-pill"><span class="pill-dot" style="background:var(--pri-med)"></span>${rolledCount} rolled</div>` : ''}
        <div class="progress-pill"><span class="pill-dot" style="background:var(--accent)"></span>digest 8am</div>
      </div>
    </div>
  </div>
</div>`;

  // Task lists
  let listsHTML = `
<div class="search-bar">
  <i class="ti ti-search" aria-hidden="true"></i>
  <input placeholder="Search tasks…" id="search-inp" autocomplete="off">
</div>`;

  if (!totalAll) {
    listsHTML += emptyState('Nothing today', 'Tap + to add your first task', 'ti-sun');
  } else {
    if (rolled.length) {
      listsHTML += `<div class="section-lbl">Rolled Over</div>
        <ul class="task-list" id="rolled-list">
          ${rolled.map(t => buildTaskRow(t, { projectName: projMap[t.projectId]?.name || '', tagNames: tn(t), ctx: 'today' })).join('')}
        </ul>`;
    }
    if (active.length) {
      listsHTML += `<div class="section-lbl">Today</div>
        <ul class="task-list" id="active-list">
          ${active.map(t => buildTaskRow(t, { projectName: projMap[t.projectId]?.name || '', tagNames: tn(t), ctx: 'today' })).join('')}
        </ul>`;
    }
    if (completed.length) {
      listsHTML += `
<div class="done-toggle" id="done-toggle">
  <span class="done-toggle-lbl">Completed · ${completed.length}</span>
  <i class="ti ti-chevron-down done-toggle-chev" id="done-chev" aria-hidden="true"></i>
</div>
<ul class="task-list" id="done-list">
  ${completed.map(t => buildTaskRow(t, { projectName: projMap[t.projectId]?.name || '', tagNames: tn(t), ctx: 'today' })).join('')}
</ul>`;
    }
  }

  content.innerHTML = heroHTML + listsHTML;
  _bindToday();
}

function _bindToday() {
  // Done toggle
  document.getElementById('done-toggle')?.addEventListener('click', () => {
    document.getElementById('done-list')?.classList.toggle('open');
    document.getElementById('done-chev')?.classList.toggle('open');
  });

  // Search
  document.getElementById('search-inp')?.addEventListener('input', function() {
    const q = this.value.toLowerCase();
    document.querySelectorAll('.task-card').forEach(card => {
      const name = card.querySelector('.task-name');
      card.style.display = (!q || (name && name.textContent.toLowerCase().includes(q))) ? '' : 'none';
    });
  });

  // Swipe + delegation
  document.querySelectorAll('.task-card').forEach(initSwipe);
  _bindTaskDelegation(document.getElementById('app-content'));
}

// ── Upcoming view ─────────────────────────────────────────────────────────────
async function renderUpcoming() {
  const content = document.getElementById('app-content');
  const today   = todayStr();
  const tom     = tomorrowStr();

  const [allTasks, allProjects, allTags] = await Promise.all([Tasks.all(), Projects.all(), Tags.all()]);
  const projMap = Object.fromEntries(allProjects.map(p => [p.id, p]));
  const tagMap  = Object.fromEntries(allTags.map(t => [t.id, t.name]));
  const tn      = t => (t.tagIds || []).map(id => tagMap[id]).filter(Boolean);

  const upcoming = allTasks.filter(t => !t.isComplete && !isSomeday(t) && t.scheduledFor > today);

  let html = `<div class="page-header">Upcoming</div>
  <div class="search-bar" style="margin-bottom:8px">
    <i class="ti ti-search" aria-hidden="true"></i>
    <input placeholder="Search upcoming…" id="search-inp" autocomplete="off">
  </div>`;

  if (!upcoming.length) {
    html += emptyState('Nothing coming up', 'Schedule tasks with a future date', 'ti-calendar');
  } else {
    const groups = {};
    upcoming.forEach(t => { (groups[t.scheduledFor] = groups[t.scheduledFor] || []).push(t); });

    Object.keys(groups).sort().forEach(ds => {
      const d     = new Date(ds + 'T00:00:00');
      const label = ds === tom ? 'Tomorrow'
                  : d.toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric' });
      html += `<div class="section-lbl">${esc(label)}</div>
        <ul class="task-list">
          ${sortByPriority(groups[ds]).map(t => buildTaskRow(t, { projectName: projMap[t.projectId]?.name || '', tagNames: tn(t), ctx: 'upcoming' })).join('')}
        </ul>`;
    });
  }

  content.innerHTML = html;
  document.querySelectorAll('.task-card').forEach(initSwipe);
  _bindTaskDelegation(content);
  document.getElementById('search-inp')?.addEventListener('input', function() {
    const q = this.value.toLowerCase();
    document.querySelectorAll('.task-card').forEach(card => {
      const name = card.querySelector('.task-name');
      card.style.display = (!q || (name && name.textContent.toLowerCase().includes(q))) ? '' : 'none';
    });
  });
}

// ── Projects view ─────────────────────────────────────────────────────────────
let activeProjId    = null;
let showNewProjForm = false;
const newProjDraft  = { name: '', colorHex: PROJECT_COLORS[0], icon: PROJECT_ICONS[0] };

async function renderProjects() {
  const content = document.getElementById('app-content');

  if (activeProjId)    { await _renderProjectDetail(activeProjId); return; }
  if (showNewProjForm) { _renderNewProjForm(content); return; }

  const [allProjects, allTasks] = await Promise.all([Projects.all(), Tasks.all()]);
  const countMap = {};
  allTasks.forEach(t => { if (t.projectId && !t.isComplete) countMap[t.projectId] = (countMap[t.projectId] || 0) + 1; });

  let html = `<div class="page-header">Projects</div>`;
  if (!allProjects.length) {
    html += emptyState('No projects yet', 'Tap + to create your first project', 'ti-folder');
  } else {
    html += allProjects.map(p => `
<div class="proj-row" data-action="open-proj" data-id="${p.id}">
  <div class="proj-icon" style="background:${p.colorHex}22;color:${p.colorHex}">${p.icon}</div>
  <span class="proj-name">${esc(p.name)}</span>
  ${countMap[p.id] ? `<span class="proj-badge">${countMap[p.id]}</span>` : ''}
  <i class="ti ti-chevron-right proj-chevron" aria-hidden="true"></i>
</div>`).join('');
  }

  content.innerHTML = html;
  _bindProjectsDelegation(content);
}

function _renderNewProjForm(content) {
  content.innerHTML = `
<div class="page-header" style="padding-bottom:8px">New Project</div>
<div class="new-proj-form">
  <div class="cap-label">Name</div>
  <input id="np-name" class="new-proj-input" type="text" placeholder="Project name" value="${esc(newProjDraft.name)}" autocapitalize="sentences">
  <div class="cap-label" style="margin-top:16px">Color</div>
  <div class="swatch-row">${PROJECT_COLORS.map(c => `<button class="color-swatch ${c===newProjDraft.colorHex?'sel':''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div>
  <div class="cap-label" style="margin-top:14px">Icon</div>
  <div class="icon-row">${PROJECT_ICONS.map((ic, i) => `<button class="icon-opt ${ic===newProjDraft.icon?'sel':''}" data-icon-idx="${i}">${ic}</button>`).join('')}</div>
  <div class="new-proj-actions">
    <button class="btn-sec" data-action="cancel-new-proj">Cancel</button>
    <button class="btn-pri" data-action="save-new-proj">Create</button>
  </div>
</div>`;

  const ni = document.getElementById('np-name');
  ni?.focus();
  ni?.addEventListener('input', e => { newProjDraft.name = e.target.value; });
  content.querySelectorAll('.color-swatch').forEach(s => {
    s.addEventListener('click', () => {
      newProjDraft.colorHex = s.dataset.color;
      content.querySelectorAll('.color-swatch').forEach(x => x.classList.toggle('sel', x === s));
    });
  });
  content.querySelectorAll('.icon-opt').forEach(o => {
    o.addEventListener('click', () => {
      newProjDraft.icon = PROJECT_ICONS[parseInt(o.dataset.iconIdx)];
      content.querySelectorAll('.icon-opt').forEach(x => x.classList.toggle('sel', x === o));
    });
  });
  _bindProjectsDelegation(content);
}

async function _renderProjectDetail(id) {
  const content = document.getElementById('app-content');
  const [project, allTasks, allTags] = await Promise.all([Projects.get(id), Tasks.all(), Tags.all()]);

  if (!project) { activeProjId = null; renderProjects(); return; }

  const tagMap  = Object.fromEntries(allTags.map(t => [t.id, t.name]));
  const tn      = t => (t.tagIds || []).map(id => tagMap[id]).filter(Boolean);
  const projTasks = allTasks.filter(t => t.projectId === id);
  const open = sortByPriority(projTasks.filter(t => !t.isComplete));
  const done = projTasks.filter(t => t.isComplete);

  let html = `
<div class="proj-detail-hd" style="background:${project.colorHex}">
  <button class="back-btn" data-action="back-proj">
    <i class="ti ti-chevron-left" aria-hidden="true"></i> Projects
  </button>
  <div class="proj-detail-icon">${project.icon}</div>
  <div class="proj-detail-name">${esc(project.name)}</div>
</div>`;

  if (!open.length && !done.length) {
    html += emptyState('No tasks yet', 'Tap + to add one', 'ti-sun');
  } else {
    if (open.length) html += `<div class="section-lbl">Open (${open.length})</div>
      <ul class="task-list">${open.map(t => buildTaskRow(t, { tagNames: tn(t), ctx: 'project' })).join('')}</ul>`;
    if (done.length) html += `
<div class="done-toggle" id="done-toggle">
  <span class="done-toggle-lbl">Completed · ${done.length}</span>
  <i class="ti ti-chevron-down done-toggle-chev" id="done-chev" aria-hidden="true"></i>
</div>
<ul class="task-list" id="done-list">
  ${done.map(t => buildTaskRow(t, { tagNames: tn(t), ctx: 'project' })).join('')}
</ul>`;
  }

  // Tags management
  const tagRows = allTags.map(t => `
<div class="tag-row">
  <span class="tag-dot" style="background:${t.colorHex}"></span>
  <span class="tag-name-lbl">${esc(t.name)}</span>
  <button class="tag-del" data-action="del-tag" data-id="${t.id}" aria-label="Delete tag">×</button>
</div>`).join('');

  html += `
<div class="tags-mgmt">
  <div class="tags-mgmt-title">Tags</div>
  ${tagRows || '<p style="font-size:13px;color:var(--text-tertiary)">No tags yet.</p>'}
  <div id="new-tag-form" class="hidden"></div>
  <button class="new-tag-btn" data-action="show-tag-form">+ New tag</button>
</div>
<div class="danger-zone">
  <button class="danger-btn" data-action="del-proj" data-id="${id}">Delete project</button>
</div>`;

  content.innerHTML = html;
  document.getElementById('done-toggle')?.addEventListener('click', () => {
    document.getElementById('done-list')?.classList.toggle('open');
    document.getElementById('done-chev')?.classList.toggle('open');
  });
  document.querySelectorAll('.task-card').forEach(initSwipe);
  _bindTaskDelegation(content);
  _bindProjectsDelegation(content);
}

function _bindProjectsDelegation(root) {
  root.addEventListener('click', async e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;

    if (action === 'open-proj')  { activeProjId = id; renderView(); }
    else if (action === 'back-proj') { activeProjId = null; renderView(); }

    else if (action === 'cancel-new-proj') {
      showNewProjForm = false;
      Object.assign(newProjDraft, { name: '', colorHex: PROJECT_COLORS[0], icon: PROJECT_ICONS[0] });
      renderView();
    }
    else if (action === 'save-new-proj') {
      const name = (document.getElementById('np-name')?.value || newProjDraft.name).trim();
      if (!name) { document.getElementById('np-name')?.focus(); return; }
      await Projects.add(Projects.create({ name, colorHex: newProjDraft.colorHex, icon: newProjDraft.icon }));
      showNewProjForm = false; newProjDraft.name = '';
      renderView();
    }

    else if (action === 'del-proj') {
      if (!confirm(`Delete "${(await Projects.get(id))?.name}"? Tasks will be unassigned.`)) return;
      const all = await Tasks.all();
      await Promise.all(all.filter(t => t.projectId === id).map(t => Tasks.update(t.id, { projectId: null })));
      await Projects.remove(id);
      activeProjId = null; renderView();
    }

    else if (action === 'del-tag') {
      await Tags.remove(id);
      const all = await Tasks.all();
      await Promise.all(all.map(t => Tasks.update(t.id, { tagIds: (t.tagIds || []).filter(x => x !== id) })));
      renderView();
    }

    else if (action === 'show-tag-form') {
      const form = document.getElementById('new-tag-form');
      if (!form) return;
      form.classList.remove('hidden');
      let chosenColor = PROJECT_COLORS[0];
      form.innerHTML = `
<input id="new-tag-name" class="new-proj-input" type="text" placeholder="Tag name" style="margin-bottom:8px">
<div class="swatch-row">${PROJECT_COLORS.slice(0,6).map(c=>`<button class="tag-cs color-swatch ${c===chosenColor?'sel':''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div>
<div class="new-proj-actions" style="margin-top:8px">
  <button class="btn-sec" id="cancel-tag">Cancel</button>
  <button class="btn-pri" id="save-tag">Add tag</button>
</div>`;
      document.getElementById('new-tag-name')?.focus();
      form.querySelectorAll('.tag-cs').forEach(s => {
        s.addEventListener('click', () => { chosenColor = s.dataset.color; form.querySelectorAll('.tag-cs').forEach(x => x.classList.toggle('sel', x===s)); });
      });
      document.getElementById('cancel-tag')?.addEventListener('click', () => { form.classList.add('hidden'); form.innerHTML = ''; });
      document.getElementById('save-tag')?.addEventListener('click', async () => {
        const name = document.getElementById('new-tag-name')?.value.trim();
        if (!name) return;
        await Tags.add(Tags.create({ name, colorHex: chosenColor }));
        renderView();
      });
    }
  }, { once: true });
}

// ── Stats view ────────────────────────────────────────────────────────────────
async function renderStats() {
  const content  = document.getElementById('app-content');
  const today    = todayStr();
  const allTasks = await Tasks.all();

  const completedAll   = allTasks.filter(t => t.isComplete);
  const completedToday = allTasks.filter(t => t.isComplete && t.scheduledFor === today);
  const openToday      = allTasks.filter(t => !t.isComplete && t.scheduledFor === today);
  const overdue        = allTasks.filter(t => !t.isComplete && !isSomeday(t) && t.scheduledFor < today);
  const someday        = allTasks.filter(t => !t.isComplete && isSomeday(t));

  // 7-day completion trend
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const count = allTasks.filter(t => t.isComplete && t.scheduledFor === ds).length;
    trend.push({ ds, count, day: d.toLocaleDateString(undefined, { weekday: 'short' }) });
  }
  const maxTrend = Math.max(...trend.map(t => t.count), 1);

  const barHTML = trend.map(({ count, day }) => {
    const h = Math.round((count / maxTrend) * 52);
    return `
<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
  <span style="font-size:11px;color:var(--text-tertiary);font-weight:600">${count || ''}</span>
  <div style="width:100%;background:var(--bg-elevated);border-radius:6px;height:52px;display:flex;align-items:flex-end;overflow:hidden">
    <div style="width:100%;height:${h}px;background:var(--accent);border-radius:6px;transition:height 0.4s"></div>
  </div>
  <span style="font-size:10px;color:var(--text-tertiary)">${esc(day)}</span>
</div>`;
  }).join('');

  const pct = openToday.length + completedToday.length > 0
    ? Math.round(completedToday.length / (openToday.length + completedToday.length) * 100)
    : 0;

  content.innerHTML = `
<div class="page-header">Stats</div>

<div class="stat-grid">
  <div class="stat-card">
    <div class="stat-label">Done today</div>
    <div class="stat-value">${completedToday.length}</div>
    <div class="stat-sub">${pct}% of today's tasks</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Total done</div>
    <div class="stat-value">${completedAll.length}</div>
    <div class="stat-sub">all time</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Overdue</div>
    <div class="stat-value" style="color:${overdue.length ? 'var(--pri-high)' : 'var(--text-primary)'}">${overdue.length}</div>
    <div class="stat-sub">need attention</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Someday</div>
    <div class="stat-value">${someday.length}</div>
    <div class="stat-sub">in backlog</div>
  </div>
</div>

<div class="section-lbl">7-day completions</div>
<div style="margin:0 12px;background:var(--bg-card);border:1px solid var(--border-default);border-radius:14px;padding:16px">
  <div style="display:flex;gap:6px;align-items:flex-end">${barHTML}</div>
</div>`;
}

// ── Someday view ──────────────────────────────────────────────────────────────
async function renderSomeday() {
  const content = document.getElementById('app-content');
  const [allTasks, allProjects, allTags] = await Promise.all([Tasks.all(), Projects.all(), Tags.all()]);
  const projMap = Object.fromEntries(allProjects.map(p => [p.id, p]));
  const tagMap  = Object.fromEntries(allTags.map(t => [t.id, t.name]));
  const tn      = t => (t.tagIds || []).map(id => tagMap[id]).filter(Boolean);
  const someday = sortByPriority(allTasks.filter(t => !t.isComplete && isSomeday(t)));

  let html = `<div class="page-header">Someday</div>`;
  if (!someday.length) {
    html += emptyState('Backlog is clear', 'Tasks with no date live here', 'ti-inbox');
  } else {
    html += `<div class="someday-count">${someday.length} task${someday.length === 1 ? '' : 's'} parked</div>
      <ul class="task-list">
        ${someday.map(t => buildTaskRow(t, { projectName: projMap[t.projectId]?.name || '', tagNames: tn(t), ctx: 'someday' })).join('')}
      </ul>`;
  }

  content.innerHTML = html;
  document.querySelectorAll('.task-card').forEach(initSwipe);
  _bindTaskDelegation(content);
}

// ── Shared task event delegation ──────────────────────────────────────────────
function _bindTaskDelegation(root) {
  root.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id, taskId, subIdx } = el.dataset;

    if (action === 'toggle') {
      e.stopPropagation();
      toggleTask(id);
    }

    if (action === 'expand') {
      // Only expand — don't open edit — if card has subtasks
      const li = e.target.closest('.task-card');
      if (li && li.dataset.expandable) {
        // Don't expand when tapping the checkbox
        if (!e.target.closest('.task-chk')) {
          toggleSubDrawer(li);
        }
      } else {
        openEdit(id);
      }
    }

    if (action === 'edit') {
      openEdit(id);
    }

    if (action === 'toggle-subtask') {
      e.stopPropagation();
      toggleSubtask(el.dataset.taskId, parseInt(el.dataset.subIdx));
    }
  });
}
