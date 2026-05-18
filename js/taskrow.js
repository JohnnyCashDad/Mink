'use strict';

// ── Task row HTML ─────────────────────────────────────────────────────────────
function buildTaskRow(task, { projectName = '', tagNames = [], ctx = '' } = {}) {
  const dueHTML = (() => {
    if (!task.dueDate || task.isComplete) return '';
    const f = formatDue(task.dueDate);
    return `<span class="chip ${f.overdue ? 'chip-over' : 'chip-due'}">${esc(f.label)}</span>`;
  })();

  const projHTML   = projectName ? `<span class="chip chip-proj">${esc(projectName)}</span>` : '';
  const tagHTML    = tagNames.map(n => `<span class="chip chip-tag">${esc(n)}</span>`).join('');
  const rolledHTML = task.isRolledOver && !task.isComplete
    ? `<span class="chip chip-roll">rolled over</span>` : '';

  const subtasks      = task.subtasks || [];
  const subtotalCount = subtasks.length;
  const subtotalDone  = subtasks.filter(s => s.isComplete).length;
  const allSubsDone   = subtotalCount > 0 && subtotalDone === subtotalCount;
  const subPct        = subtotalCount > 0 ? Math.round((subtotalDone / subtotalCount) * 100) : 0;

  const subtaskSummaryHTML = subtotalCount > 0 ? `
    <div class="sub-summary">
      <div class="sub-bar-wrap">
        <div class="sub-bar-fill" id="subbar-${task.id}" style="width:${subPct}%"></div>
      </div>
      <span class="sub-count ${allSubsDone ? 'sub-count-done' : ''}" id="subcount-${task.id}">
        ${allSubsDone ? `${subtotalCount} of ${subtotalCount} ✓` : `${subtotalDone} of ${subtotalCount}`}
      </span>
      <i class="ti ti-chevron-down sub-expand-chev" aria-hidden="true"></i>
    </div>` : '';

  const subtaskDrawerHTML = subtotalCount > 0 ? `
    <div class="sub-drawer" id="subdrawer-${task.id}">
      <div class="sub-drawer-inner">
        ${subtasks.map((s, i) => `
        <div class="sub-row" data-action="toggle-subtask"
             data-task-id="${task.id}" data-sub-idx="${i}">
          <button class="sub-chk ${s.isComplete ? 'sub-chk-done' : ''}"
                  aria-label="${s.isComplete ? 'Mark incomplete' : 'Mark complete'}"></button>
          <span class="sub-row-label ${s.isComplete ? 'sub-label-done' : ''}">${esc(s.title)}</span>
        </div>`).join('')}
        <div class="sub-row sub-row-add">
          <span class="sub-chk sub-chk-placeholder" aria-hidden="true">
            <i class="ti ti-plus"></i>
          </span>
          <input class="sub-add-input" type="text" placeholder="Add subtask…"
                 data-task-id="${task.id}" maxlength="200">
        </div>
        <button class="sub-edit-btn" data-action="edit-task" data-id="${task.id}">
          <i class="ti ti-pencil" aria-hidden="true"></i>Edit task details
        </button>
      </div>
    </div>` : '';

  const notesHTML = task.notes ? `
    <div class="notes-indicator">
      <i class="ti ti-notes" aria-hidden="true"></i>
      <span>${esc(task.notes.slice(0, 60))}${task.notes.length > 60 ? '…' : ''}</span>
    </div>` : '';

  const rolledFooter = task.isRolledOver && !task.isComplete ? `
    <div class="rolled-footer">
      <i class="ti ti-rotate-clockwise" style="font-size:12px" aria-hidden="true"></i>
      <span>Rolled over from ${task.originalDate
        ? new Date(task.originalDate + 'T00:00:00').toLocaleDateString(undefined, { month:'short', day:'numeric' })
        : 'yesterday'}</span>
    </div>` : '';

  let moveLabel, moveIcon;
  if (ctx === 'completed')                              { moveLabel = 'Restore';        moveIcon = 'ti-arrow-back-up'; }
  else if (ctx === 'upcoming' || ctx === 'someday')     { moveLabel = 'Move to Today';  moveIcon = 'ti-sun'; }
  else                                                  { moveLabel = 'Someday';        moveIcon = 'ti-inbox'; }

  const expandable = subtotalCount > 0 ? 'data-expandable="true"' : '';

  // Drag handle — shown on draggable contexts (today, upcoming)
  const draggable = (ctx === 'today' || ctx === 'upcoming') && !task.isComplete;
  const dragHandle = draggable
    ? `<div class="drag-handle" aria-label="Drag to reorder">
        <i class="ti ti-grip-vertical" aria-hidden="true"></i>
       </div>` : '';

  return `
<li class="task-card ${task.isComplete ? 'is-done' : ''}" data-id="${task.id}" data-ctx="${ctx}" ${expandable}>
  <div class="swipe-bg swipe-left">
    <i class="ti ${moveIcon}" style="margin-right:4px" aria-hidden="true"></i>${moveLabel}
  </div>
  <div class="swipe-bg swipe-right">
    <i class="ti ti-trash" style="margin-right:4px" aria-hidden="true"></i>Delete
  </div>
  <div class="task-content-wrap">
    <div class="task-inner" data-action="${subtotalCount > 0 ? 'expand' : 'edit'}" data-id="${task.id}">
      <div class="pri-bar ${priBarClass(task.priority)}"></div>
      <button class="task-chk ${task.isComplete ? 'chk-done' : ''}"
              data-action="toggle" data-id="${task.id}"
              aria-label="${task.isComplete ? 'Mark incomplete' : 'Mark complete'}"></button>
      <div class="task-body">
        <p class="task-name ${task.isComplete ? 'name-done' : ''}">${esc(task.title)}</p>
        <div class="chip-row">${rolledHTML}${dueHTML}${projHTML}${tagHTML}</div>
        ${subtaskSummaryHTML}
        ${notesHTML}
      </div>
      ${dragHandle}
    </div>
    ${rolledFooter}
  </div>
  ${subtaskDrawerHTML}
</li>`;
}

// ── Drawer expand state ───────────────────────────────────────────────────────
// Tracks which drawers are open across renders so adding a subtask doesn't
// collapse the drawer the user is working in.
const _expandedDrawers = new Set();

function toggleSubDrawer(li) {
  const isOpen = li.classList.toggle('sub-expanded');
  const id     = li.dataset.id;
  if (isOpen) _expandedDrawers.add(id);
  else        _expandedDrawers.delete(id);
  const chev = li.querySelector('.sub-expand-chev');
  if (chev) chev.style.transform = isOpen ? 'rotate(180deg)' : '';
}

function restoreExpandedDrawers() {
  document.querySelectorAll('.task-card').forEach(li => {
    if (_expandedDrawers.has(li.dataset.id)) {
      li.classList.add('sub-expanded');
      const chev = li.querySelector('.sub-expand-chev');
      if (chev) chev.style.transform = 'rotate(180deg)';
    }
  });
}

// ── Add subtask inline ────────────────────────────────────────────────────────
let _refocusSubAddTaskId = null; // pass focus through a re-render

async function addSubtaskToTask(taskId, title) {
  const t = await Tasks.get(taskId);
  if (!t) return;
  const newSub = { id: uid(), title: title.trim(), isComplete: false };
  const subtasks = [...(t.subtasks || []), newSub];
  await Tasks.update(taskId, { subtasks });
  _expandedDrawers.add(taskId);  // keep drawer open after re-render
  _refocusSubAddTaskId = taskId; // re-focus the inline input for chaining
  renderView();
}

// ── Toggle a single subtask inline ────────────────────────────────────────────
async function toggleSubtask(taskId, subIdx) {
  const task = await Tasks.get(taskId);
  if (!task || !task.subtasks) return;

  const subtasks = [...task.subtasks];
  subtasks[subIdx] = { ...subtasks[subIdx], isComplete: !subtasks[subIdx].isComplete };
  await Tasks.update(taskId, { subtasks });

  const li = document.querySelector(`[data-id="${taskId}"]`);
  if (!li) return;

  const done    = subtasks.filter(s => s.isComplete).length;
  const total   = subtasks.length;
  const allDone = done === total;
  const pct     = Math.round((done / total) * 100);

  const bar = document.getElementById(`subbar-${taskId}`);
  if (bar) bar.style.width = pct + '%';

  const countEl = document.getElementById(`subcount-${taskId}`);
  if (countEl) {
    countEl.textContent = allDone ? `${total} of ${total} ✓` : `${done} of ${total}`;
    countEl.classList.toggle('sub-count-done', allDone);
  }

  const row = li.querySelectorAll('.sub-row')[subIdx];
  if (row) {
    const chk   = row.querySelector('.sub-chk');
    const label = row.querySelector('.sub-row-label');
    const isDone = subtasks[subIdx].isComplete;
    chk?.classList.toggle('sub-chk-done', isDone);
    label?.classList.toggle('sub-label-done', isDone);
  }
}

// ── Swipe interaction ─────────────────────────────────────────────────────────
function initSwipe(li) {
  const wrap  = li.querySelector('.task-content-wrap');
  const left  = li.querySelector('.swipe-bg.swipe-left');
  const right = li.querySelector('.swipe-bg.swipe-right');
  if (!wrap) return;

  let sx = 0, sy = 0, axis = null, moved = false;
  const MAX = 100, THRESH = 65;

  li.addEventListener('touchstart', e => {
    sx    = e.touches[0].clientX;
    sy    = e.touches[0].clientY;
    axis  = null;
    moved = false;
    wrap.style.transition = 'none';
  }, { passive: true });

  li.addEventListener('touchmove', e => {
    // Don't swipe if drag is active on this card
    if (window._dragState && window._dragState.li === li) return;
    const dx = e.touches[0].clientX - sx;
    const dy = e.touches[0].clientY - sy;
    if (axis === null) axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    if (axis !== 'h') return;
    moved = true;
    const clamped = Math.max(-MAX, Math.min(MAX, dx));
    wrap.style.transform = `translateX(${clamped}px)`;
    if (left)  left.style.opacity  = dx > 0 ? Math.min(dx / THRESH, 1) : 0;
    if (right) right.style.opacity = dx < 0 ? Math.min(-dx / THRESH, 1) : 0;
  }, { passive: true });

  li.addEventListener('touchend', e => {
    if (window._dragState && window._dragState.li === li) return;
    const dx = e.changedTouches[0].clientX - sx;
    wrap.style.transition = 'transform 0.22s ease';
    wrap.style.transform  = '';
    if (left)  left.style.opacity  = 0;
    if (right) right.style.opacity = 0;
    if (axis !== 'h' || !moved) return;

    const id  = li.dataset.id;
    const ctx = li.dataset.ctx;

    if (dx > THRESH) {
      if      (ctx === 'completed')                       restoreCompletedTask(id);
      else if (ctx === 'upcoming' || ctx === 'someday')   moveToToday(id);
      else                                                moveToSomeday(id);
    }
    else if (dx < -THRESH) { confirmDeleteTask(id); }
  }, { passive: true });
}

// ── Init both swipe + drag on a card ──────────────────────────────────────────
function initCardInteractions(li) {
  initSwipe(li);
  const ctx = li.dataset.ctx;
  const isComplete = li.classList.contains('is-done');
  if ((ctx === 'today' || ctx === 'upcoming') && !isComplete) {
    initDrag(li);
  }

  // Restore expanded state if this drawer was open before a re-render
  if (_expandedDrawers.has(li.dataset.id)) {
    li.classList.add('sub-expanded');
    const chev = li.querySelector('.sub-expand-chev');
    if (chev) chev.style.transform = 'rotate(180deg)';
  }

  // Inline "add subtask" input — Enter to commit, focus stays for chaining
  const addInp = li.querySelector('.sub-add-input');
  if (addInp) {
    addInp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const title = addInp.value.trim();
      if (!title) return;
      addInp.value = '';
      addSubtaskToTask(addInp.dataset.taskId, title);
    });
    // Stop tap on input from bubbling to the card's expand handler
    addInp.addEventListener('click', e => e.stopPropagation());
    // Re-focus after add-driven re-render
    if (_refocusSubAddTaskId === li.dataset.id) {
      _refocusSubAddTaskId = null;
      setTimeout(() => addInp.focus(), 30);
    }
  }
}

// ── Task CRUD actions ─────────────────────────────────────────────────────────
async function toggleTask(id) {
  const t = await Tasks.get(id);
  if (!t) return;
  const nowDone = !t.isComplete;
  await Tasks.update(id, {
    isComplete: nowDone,
    completedAt: nowDone ? new Date().toISOString() : null,
  });
  renderView();
}

async function confirmDeleteTask(id) {
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) {
    el.style.transition = 'opacity 0.2s, transform 0.2s, max-height 0.3s 0.15s, margin 0.3s 0.15s';
    el.style.opacity    = '0';
    el.style.transform  = 'translateX(-100%)';
    el.style.maxHeight  = '0';
    el.style.margin     = '0';
    el.style.overflow   = 'hidden';
  }
  await Tasks.remove(id);
  setTimeout(() => renderView(), 320);
}

async function moveToSomeday(id) {
  await Tasks.update(id, { scheduledFor: SOMEDAY, dueDate: null, isRolledOver: false });
  renderView();
}

async function moveToToday(id) {
  await Tasks.update(id, { scheduledFor: todayStr(), isRolledOver: false });
  renderView();
}

// Restore a completed task: mark incomplete and ensure it lands somewhere visible.
// If the task's scheduledFor is in the past, bump to today (flagged as rolled over).
async function restoreCompletedTask(id) {
  const t = await Tasks.get(id);
  if (!t) return;
  const today = todayStr();
  const patch = { isComplete: false, completedAt: null };
  if (!isSomeday(t) && t.scheduledFor < today) {
    patch.scheduledFor = today;
    patch.isRolledOver = true;
    patch.originalDate = t.originalDate ?? t.scheduledFor;
  }
  await Tasks.update(id, patch);
  renderView();
}
