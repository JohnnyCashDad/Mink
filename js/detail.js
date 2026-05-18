'use strict';

// ── Task Detail Panel ─────────────────────────────────────────────────────────
// Full-screen slide-in for viewing + editing a task without subtasks.
// Opened by openTaskDetail(id), called from _bindTaskDelegation in views.js.
// Saves automatically on Back or Done tap.
//
// Conventions:
//   - esc() on all user strings
//   - isSomeday() for sentinel check, SOMEDAY constant for scheduling
//   - todayStr() / tomorrowStr() from utils.js
//   - renderView() after close to refresh the underlying tab
//   - data-action / data-id delegation — no per-element listeners on dynamic nodes
//   - Tabler icon classes (ti ti-*) matching the rest of the app

// ── State ─────────────────────────────────────────────────────────────────────
const det = {
  taskId: null,
  draft:  {},
};

// ── Open ──────────────────────────────────────────────────────────────────────
async function openTaskDetail(id) {
  const task = await Tasks.get(id);
  if (!task) return;

  let schedule = 'today';
  if (isSomeday(task))                          schedule = 'someday';
  else if (task.scheduledFor === tomorrowStr())  schedule = 'tomorrow';
  else if (task.scheduledFor !== todayStr())     schedule = 'date';

  det.taskId = id;
  det.draft = {
    title:        task.title,
    notes:        task.notes || '',
    priority:     task.priority,
    schedule,
    scheduledFor: task.scheduledFor,
    hasDueDate:   !!task.dueDate,
    dueDate:      task.dueDate || todayStr(),
    projectId:    task.projectId,
    tagIds:       [...(task.tagIds || [])],
    subtasks:     (task.subtasks || []).map(s => ({ ...s })),
    isComplete:   task.isComplete,
    isRolledOver: task.isRolledOver,
    originalDate: task.originalDate,
    createdAt:    task.createdAt,
  };

  const panel = document.getElementById('detail-panel');
  panel.classList.remove('hidden');
  panel.getBoundingClientRect(); // force reflow so transition fires
  panel.classList.add('det-open');

  await _renderPanel();
}

// ── Close ─────────────────────────────────────────────────────────────────────
async function closeTaskDetail(shouldSave = true) {
  if (shouldSave && det.taskId) await _saveDetail();

  const panel = document.getElementById('detail-panel');
  panel.classList.remove('det-open');
  panel.addEventListener('transitionend', () => {
    panel.classList.add('hidden');
    panel.innerHTML = '';
    det.taskId = null;
    renderView();
  }, { once: true });
}

// ── Render ────────────────────────────────────────────────────────────────────
async function _renderPanel() {
  const [allProjects, allTags] = await Promise.all([Projects.all(), Tags.all()]);
  const project = allProjects.find(p => p.id === det.draft.projectId);
  document.getElementById('detail-panel').innerHTML = _buildPanelHTML(allProjects, allTags, project);
  _bindPanelListeners();
}

function _buildPanelHTML(allProjects, allTags, project) {
  // Priority chips
  const priDefs = [
    { val: 'none',   label: 'None',   color: 'var(--text-tertiary)' },
    { val: 'low',    label: 'Low',    color: '#7ABFA0' },
    { val: 'medium', label: 'Medium', color: 'var(--pri-med)' },
    { val: 'high',   label: 'High',   color: 'var(--pri-high)' },
  ];
  const priChips = priDefs.map(({ val, label, color }) => {
    const sel = det.draft.priority === val;
    return `<button class="det-pri-chip${sel ? ' det-sel' : ''}" data-action="det-pri" data-val="${val}"
      ${sel ? `style="--det-color:${color}"` : ''}>
      <span class="det-chip-dot" style="background:${color}"></span>${label}
    </button>`;
  }).join('');

  // Schedule chips
  const schedDefs = [
    { val: 'today',    label: 'Today',     icon: 'ti-sun' },
    { val: 'tomorrow', label: 'Tomorrow',  icon: 'ti-calendar' },
    { val: 'date',     label: 'Pick date', icon: 'ti-calendar-event' },
    { val: 'someday',  label: 'Someday',   icon: 'ti-inbox' },
  ];
  const schedChips = schedDefs.map(({ val, label, icon }) =>
    `<button class="det-sched-chip${det.draft.schedule === val ? ' det-sel' : ''}" data-action="det-sched" data-val="${val}">
      <i class="ti ${icon}" aria-hidden="true"></i>${label}
    </button>`
  ).join('');

  const datePicker = det.draft.schedule === 'date'
    ? `<input type="date" id="det-sched-date" class="det-date-input"
         value="${esc(det.draft.scheduledFor !== SOMEDAY ? det.draft.scheduledFor : todayStr())}"
         min="${todayStr()}">` : '';

  // Project field
  const projOpts = allProjects.map(p =>
    `<option value="${p.id}"${det.draft.projectId === p.id ? ' selected' : ''}>${esc(p.name)}</option>`
  ).join('');
  const projDisplay = project ? esc(project.name) : 'None';
  const projField = allProjects.length ? `
    <div class="det-field-row" id="det-proj-row">
      ${project
        ? `<span class="det-proj-icon" style="background:${project.colorHex}22;color:${project.colorHex}">${project.icon}</span>`
        : `<i class="ti ti-folder" style="color:var(--text-tertiary)" aria-hidden="true"></i>`}
      <span class="det-field-label">Project</span>
      <span class="det-field-val" id="det-proj-display">${projDisplay}</span>
      <select id="det-proj-sel" class="det-field-select" aria-label="Select project">
        <option value="">None</option>${projOpts}
      </select>
      <i class="ti ti-chevron-right det-field-chev" aria-hidden="true"></i>
    </div>` : '';

  // Tags field
  const tagChips = allTags.map(tag => {
    const sel = det.draft.tagIds.includes(tag.id);
    return `<button class="det-tag-chip${sel ? ' det-tag-sel' : ''}" data-action="det-tag" data-id="${tag.id}"
      ${sel ? `style="border-color:${tag.colorHex};color:${tag.colorHex}"` : ''}>${esc(tag.name)}</button>`;
  }).join('');
  const selTagNames = det.draft.tagIds.map(id => allTags.find(t => t.id === id)?.name).filter(Boolean);
  const tagsLabel   = selTagNames.length ? selTagNames.join(', ') : 'None';
  const tagsField   = allTags.length ? `
    <div class="det-field-row" id="det-tags-row">
      <i class="ti ti-tag" style="color:var(--text-tertiary)" aria-hidden="true"></i>
      <span class="det-field-label">Tags</span>
      <span class="det-field-val" id="det-tags-display">${esc(tagsLabel)}</span>
      <i class="ti ti-chevron-right det-field-chev" aria-hidden="true"></i>
    </div>
    <div class="det-tags-expanded hidden" id="det-tags-expanded">
      <div class="det-tag-chips">${tagChips}</div>
    </div>` : '';

  // Due date toggle row
  const dueSub = det.draft.hasDueDate && det.draft.dueDate
    ? (() => { const f = formatDue(det.draft.dueDate); return `<span class="det-toggle-sub${f.overdue ? ' det-overdue' : ''}">${esc(f.label)}</span>`; })()
    : '';
  const dueRow = `
    <div class="det-toggle-row">
      <div class="det-toggle-info">
        <span class="det-toggle-title">Due date</span>
        ${dueSub}
      </div>
      <input type="checkbox" class="det-ios-toggle" id="det-due-chk"${det.draft.hasDueDate ? ' checked' : ''}>
    </div>
    ${det.draft.hasDueDate
      ? `<input type="date" id="det-due-date" class="det-date-input"
           value="${esc(det.draft.dueDate)}" min="${todayStr()}" style="margin-bottom:14px">`
      : ''}`;

  // Subtasks section
  const subRows = det.draft.subtasks.map((s, i) => `
    <div class="det-sub-row" id="det-subrow-${i}">
      <button class="det-sub-chk${s.isComplete ? ' det-sub-chk-done' : ''}"
              data-action="det-sub-toggle" data-idx="${i}" aria-label="Toggle subtask"></button>
      <input class="det-sub-input" type="text" value="${esc(s.title)}"
             data-action="det-sub-edit" data-idx="${i}" placeholder="Subtask…">
      <button class="det-sub-del" data-action="det-sub-del" data-idx="${i}" aria-label="Delete subtask">
        <i class="ti ti-x" aria-hidden="true"></i>
      </button>
    </div>`).join('');
  const subSection = `
    <div class="det-sec-lbl">Subtasks</div>
    <div id="det-sub-list">${subRows}</div>
    <button class="det-sub-add-btn" data-action="det-sub-add">
      <i class="ti ti-plus" aria-hidden="true"></i>Add subtask
    </button>`;

  // Rolled-over note
  const rolledNote = det.draft.isRolledOver && !det.draft.isComplete && det.draft.originalDate
    ? `<span class="det-meta-chip">
        <i class="ti ti-rotate-clockwise" aria-hidden="true"></i>
        Rolled from ${new Date(det.draft.originalDate + 'T00:00:00').toLocaleDateString(undefined, { month:'short', day:'numeric' })}
       </span>` : '';

  const createdLabel = (() => {
    try { return new Date(det.draft.createdAt).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }); }
    catch { return ''; }
  })();

  return `
<div class="det-header">
  <button class="det-back-btn" data-action="det-back">
    <i class="ti ti-chevron-left" aria-hidden="true"></i>Back
  </button>
  <button class="det-done-btn" data-action="det-done">Done</button>
</div>

<div class="det-body">

  <div class="det-title-row">
    <button class="det-chk${det.draft.isComplete ? ' det-chk-done' : ''}"
            data-action="det-toggle" aria-label="Toggle complete"></button>
    <textarea class="det-title-input${det.draft.isComplete ? ' det-title-done' : ''}"
              id="det-title" placeholder="Task title" rows="1">${esc(det.draft.title)}</textarea>
  </div>

  <div class="det-field-row det-notes-wrap">
    <i class="ti ti-notes" style="color:var(--text-tertiary)" aria-hidden="true"></i>
    <textarea id="det-notes" class="det-notes-input" placeholder="Add notes…" rows="1">${esc(det.draft.notes)}</textarea>
  </div>

  <div class="det-sec-lbl">Priority</div>
  <div class="det-pri-row">${priChips}</div>

  <div class="det-sec-lbl">Schedule</div>
  <div class="det-sched-row">${schedChips}</div>
  ${datePicker}

  ${dueRow}

  ${projField}
  ${tagsField}

  ${subSection}

  <div class="det-meta">
    ${rolledNote}
    ${createdLabel ? `<span class="det-meta-chip"><i class="ti ti-clock" aria-hidden="true"></i>Added ${esc(createdLabel)}</span>` : ''}
  </div>

  <div class="det-danger">
    <button class="det-delete-btn" data-action="det-delete">
      <i class="ti ti-trash" aria-hidden="true"></i>Delete task
    </button>
  </div>

</div>`;
}

// ── Save ──────────────────────────────────────────────────────────────────────
async function _saveDetail() {
  if (!det.taskId) return;

  const titleEl = document.getElementById('det-title');
  const notesEl = document.getElementById('det-notes');
  if (titleEl) det.draft.title = titleEl.value.trim();
  if (notesEl) det.draft.notes = notesEl.value;
  if (!det.draft.title) return;

  let scheduledFor;
  switch (det.draft.schedule) {
    case 'someday':  scheduledFor = SOMEDAY; break;
    case 'tomorrow': scheduledFor = tomorrowStr(); break;
    case 'date':     scheduledFor = det.draft.scheduledFor; break;
    default:         scheduledFor = todayStr();
  }

  // Flush in-flight subtask input edits before save
  document.querySelectorAll('.det-sub-input').forEach(inp => {
    const i = parseInt(inp.dataset.idx);
    if (det.draft.subtasks[i]) det.draft.subtasks[i].title = inp.value;
  });

  await Tasks.update(det.taskId, {
    title:       det.draft.title,
    notes:       det.draft.notes,
    priority:    det.draft.priority,
    scheduledFor,
    dueDate:     (det.draft.schedule === 'someday' || !det.draft.hasDueDate) ? null : det.draft.dueDate,
    projectId:   det.draft.projectId,
    tagIds:      [...det.draft.tagIds],
    subtasks:    det.draft.subtasks.filter(s => s.title.trim()).map(s => ({ ...s, title: s.title.trim() })),
  });
}

// ── Listeners ─────────────────────────────────────────────────────────────────
function _bindPanelListeners() {
  const panel = document.getElementById('detail-panel');

  const titleEl = document.getElementById('det-title');
  if (titleEl) {
    _detAutoGrow(titleEl);
    titleEl.addEventListener('input', () => { det.draft.title = titleEl.value; _detAutoGrow(titleEl); });
  }

  const notesEl = document.getElementById('det-notes');
  if (notesEl) {
    _detAutoGrow(notesEl);
    notesEl.addEventListener('input', () => { det.draft.notes = notesEl.value; _detAutoGrow(notesEl); });
  }

  document.getElementById('det-sched-date')?.addEventListener('change', e => {
    det.draft.scheduledFor = e.target.value;
  });

  document.getElementById('det-due-chk')?.addEventListener('change', async e => {
    det.draft.hasDueDate = e.target.checked;
    // Flush title/notes before re-render so they aren't lost
    const t = document.getElementById('det-title');
    const n = document.getElementById('det-notes');
    if (t) det.draft.title = t.value.trim();
    if (n) det.draft.notes = n.value;
    await _renderPanel();
  });

  document.getElementById('det-due-date')?.addEventListener('change', e => {
    det.draft.dueDate = e.target.value;
  });

  document.getElementById('det-proj-sel')?.addEventListener('change', e => {
    det.draft.projectId = e.target.value || null;
    const d = document.getElementById('det-proj-display');
    if (d) d.textContent = e.target.options[e.target.selectedIndex].text;
  });

  document.getElementById('det-tags-row')?.addEventListener('click', () => {
    document.getElementById('det-tags-expanded')?.classList.toggle('hidden');
  });

  // Subtask input edits — sync to draft on every keystroke
  document.querySelectorAll('.det-sub-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const i = parseInt(inp.dataset.idx);
      if (det.draft.subtasks[i]) det.draft.subtasks[i].title = inp.value;
    });
  });

  // Panel click delegation — bind once (innerHTML doesn't drop parent listeners)
  if (!panel._delegationBound) {
    panel._delegationBound = true;
    panel.addEventListener('click', _handlePanelClick);
  }
}

async function _handlePanelClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action } = el.dataset;

  if (action === 'det-back' || action === 'det-done') {
    const t = document.getElementById('det-title');
    const n = document.getElementById('det-notes');
    if (t) det.draft.title = t.value.trim();
    if (n) det.draft.notes = n.value;
    closeTaskDetail(true);
  }

  else if (action === 'det-pri') {
    det.draft.priority = el.dataset.val;
    document.querySelectorAll('.det-pri-chip').forEach(c => {
      const active = c.dataset.val === det.draft.priority;
      c.classList.toggle('det-sel', active);
      if (active) {
        const dot = c.querySelector('.det-chip-dot');
        if (dot) c.style.setProperty('--det-color', dot.style.background);
      } else {
        c.style.removeProperty('--det-color');
      }
    });
  }

  else if (action === 'det-sched') {
    // Flush inputs before any DOM change
    const t = document.getElementById('det-title');
    const n = document.getElementById('det-notes');
    if (t) det.draft.title = t.value.trim();
    if (n) det.draft.notes = n.value;

    det.draft.schedule = el.dataset.val;
    if (det.draft.schedule === 'today')    det.draft.scheduledFor = todayStr();
    if (det.draft.schedule === 'tomorrow') det.draft.scheduledFor = tomorrowStr();
    if (det.draft.schedule === 'someday')  det.draft.scheduledFor = SOMEDAY;

    document.querySelectorAll('.det-sched-chip').forEach(c =>
      c.classList.toggle('det-sel', c.dataset.val === det.draft.schedule)
    );

    // Toggle date picker visibility
    const existing = document.getElementById('det-sched-date');
    const schedRow = document.querySelector('.det-sched-row');
    if (det.draft.schedule === 'date' && !existing && schedRow) {
      const picker = document.createElement('input');
      picker.type = 'date'; picker.id = 'det-sched-date'; picker.className = 'det-date-input';
      picker.value = det.draft.scheduledFor !== SOMEDAY ? det.draft.scheduledFor : todayStr();
      picker.min = todayStr();
      schedRow.insertAdjacentElement('afterend', picker);
      picker.addEventListener('change', ev => { det.draft.scheduledFor = ev.target.value; });
    } else if (det.draft.schedule !== 'date' && existing) {
      existing.remove();
    }
  }

  else if (action === 'det-tag') {
    const id  = el.dataset.id;
    const idx = det.draft.tagIds.indexOf(id);
    if (idx === -1) {
      det.draft.tagIds.push(id);
      el.classList.add('det-tag-sel');
      const allTags = await Tags.all();
      const tag = allTags.find(t => t.id === id);
      if (tag) { el.style.borderColor = tag.colorHex; el.style.color = tag.colorHex; }
    } else {
      det.draft.tagIds.splice(idx, 1);
      el.classList.remove('det-tag-sel');
      el.style.borderColor = ''; el.style.color = '';
    }
    const allTags = await Tags.all();
    const names   = det.draft.tagIds.map(tid => allTags.find(t => t.id === tid)?.name).filter(Boolean);
    const display = document.getElementById('det-tags-display');
    if (display) display.textContent = names.length ? names.join(', ') : 'None';
  }

  else if (action === 'det-toggle') {
    const task = await Tasks.get(det.taskId);
    if (!task) return;
    const nowDone = !task.isComplete;
    await Tasks.update(det.taskId, {
      isComplete: nowDone,
      completedAt: nowDone ? new Date().toISOString() : null,
    });
    det.draft.isComplete = nowDone;
    el.classList.toggle('det-chk-done', nowDone);
    document.getElementById('det-title')?.classList.toggle('det-title-done', nowDone);
  }

  else if (action === 'det-sub-toggle') {
    const i = parseInt(el.dataset.idx);
    det.draft.subtasks[i].isComplete = !det.draft.subtasks[i].isComplete;
    el.classList.toggle('det-sub-chk-done', det.draft.subtasks[i].isComplete);
  }

  else if (action === 'det-sub-del') {
    const i = parseInt(el.dataset.idx);
    const row = document.getElementById(`det-subrow-${i}`);
    if (row) {
      row.style.transition = 'opacity 0.15s, transform 0.15s';
      row.style.opacity = '0';
      row.style.transform = 'translateX(8px)';
      setTimeout(() => { det.draft.subtasks.splice(i, 1); _renderPanel(); }, 150);
    }
  }

  else if (action === 'det-sub-add') {
    // Flush title/notes so they aren't lost on re-render
    const t = document.getElementById('det-title');
    const n = document.getElementById('det-notes');
    if (t) det.draft.title = t.value.trim();
    if (n) det.draft.notes = n.value;
    document.querySelectorAll('.det-sub-input').forEach(inp => {
      const i = parseInt(inp.dataset.idx);
      if (det.draft.subtasks[i]) det.draft.subtasks[i].title = inp.value;
    });

    det.draft.subtasks.push({ id: uid(), title: '', isComplete: false });
    await _renderPanel();
    setTimeout(() => {
      const inputs = document.querySelectorAll('.det-sub-input');
      if (inputs.length) inputs[inputs.length - 1].focus();
    }, 40);
  }

  else if (action === 'det-delete') {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    await Tasks.remove(det.taskId);
    const panel = document.getElementById('detail-panel');
    panel.classList.remove('det-open');
    panel.addEventListener('transitionend', () => {
      panel.classList.add('hidden');
      panel.innerHTML = '';
      det.taskId = null;
      renderView();
    }, { once: true });
  }
}

function _detAutoGrow(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}
