'use strict';

// ── Task row HTML ─────────────────────────────────────────────────────────────
function buildTaskRow(task, { projectName = '', tagNames = [], ctx = '' } = {}) {
  const dueHTML = (() => {
    if (!task.dueDate || task.isComplete) return '';
    const f = formatDue(task.dueDate);
    return `<span class="chip ${f.overdue ? 'chip-over' : 'chip-due'}">${esc(f.label)}</span>`;
  })();

  const projHTML = projectName
    ? `<span class="chip chip-proj">${esc(projectName)}</span>` : '';

  const tagHTML = tagNames
    .map(n => `<span class="chip chip-tag">${esc(n)}</span>`)
    .join('');

  const rolledHTML = task.isRolledOver && !task.isComplete
    ? `<span class="chip chip-roll">rolled over</span>` : '';

  const subtasksTotal    = (task.subtasks || []).length;
  const subtasksDone     = (task.subtasks || []).filter(s => s.isComplete).length;
  const subtaskHTML = subtasksTotal > 0 ? `
    <div class="subtask-meta">
      <i class="ti ti-list-check" aria-hidden="true"></i>
      <span>${subtasksDone} of ${subtasksTotal} subtasks</span>
    </div>
    <div class="subtask-bar">
      <div class="subtask-fill" style="width:${Math.round((subtasksDone/subtasksTotal)*100)}%"></div>
    </div>` : '';

  const notesHTML = task.notes
    ? `<div class="notes-indicator">
        <i class="ti ti-notes" aria-hidden="true"></i>
        <span>${esc(task.notes.slice(0, 60))}${task.notes.length > 60 ? '…' : ''}</span>
       </div>` : '';

  const rolledFooter = task.isRolledOver && !task.isComplete ? `
    <div class="rolled-footer">
      <i class="ti ti-rotate-clockwise" style="font-size:12px" aria-hidden="true"></i>
      <span>Rolled over from ${task.originalDate ? new Date(task.originalDate + 'T00:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'}) : 'yesterday'}</span>
    </div>` : '';

  const moveLabel = (ctx === 'upcoming' || ctx === 'someday') ? 'Move to Today' : 'Someday';
  const moveIcon  = (ctx === 'upcoming' || ctx === 'someday') ? 'ti-sun' : 'ti-inbox';

  return `
<li class="task-card ${task.isComplete ? 'is-done' : ''}" data-id="${task.id}" data-ctx="${ctx}">
  <div class="swipe-bg swipe-left">
    <i class="ti ${moveIcon}" style="margin-right:4px" aria-hidden="true"></i>${moveLabel}
  </div>
  <div class="swipe-bg swipe-right">
    <i class="ti ti-trash" style="margin-right:4px" aria-hidden="true"></i>Delete
  </div>
  <div class="task-content-wrap">
    <div class="task-inner">
      <div class="pri-bar ${priBarClass(task.priority)}"></div>
      <button class="task-chk ${task.isComplete ? 'chk-done' : ''}"
              data-action="toggle" data-id="${task.id}"
              aria-label="${task.isComplete ? 'Mark incomplete' : 'Mark complete'}"></button>
      <div class="task-body" data-action="edit" data-id="${task.id}" role="button" tabindex="0">
        <p class="task-name ${task.isComplete ? 'name-done' : ''}">${esc(task.title)}</p>
        <div class="chip-row">
          ${rolledHTML}${dueHTML}${projHTML}${tagHTML}
        </div>
        ${subtaskHTML}
        ${notesHTML}
      </div>
    </div>
    ${rolledFooter}
  </div>
</li>`;
}

// ── Swipe interaction ─────────────────────────────────────────────────────────
function initSwipe(li) {
  const wrap  = li.querySelector('.task-content-wrap');
  const left  = li.querySelector('.swipe-bg.swipe-left');
  const right = li.querySelector('.swipe-bg.swipe-right');
  if (!wrap) return;

  let sx = 0, sy = 0, axis = null;
  const MAX = 100, THRESH = 65;

  li.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    axis = null;
    wrap.style.transition = 'none';
  }, { passive: true });

  li.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - sx;
    const dy = e.touches[0].clientY - sy;
    if (axis === null) axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    if (axis !== 'h') return;
    const clamped = Math.max(-MAX, Math.min(MAX, dx));
    wrap.style.transform = `translateX(${clamped}px)`;
    if (left)  left.style.opacity  = dx > 0 ? Math.min(dx / THRESH, 1) : 0;
    if (right) right.style.opacity = dx < 0 ? Math.min(-dx / THRESH, 1) : 0;
  }, { passive: true });

  li.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    wrap.style.transition = 'transform 0.22s ease';
    wrap.style.transform  = '';
    if (left)  left.style.opacity  = 0;
    if (right) right.style.opacity = 0;
    if (axis !== 'h') return;

    const id  = li.dataset.id;
    const ctx = li.dataset.ctx;

    if (dx > THRESH) {
      // swipe right → move
      if (ctx === 'upcoming' || ctx === 'someday') moveToToday(id);
      else moveToSomeday(id);
    } else if (dx < -THRESH) {
      // swipe left → delete
      confirmDeleteTask(id);
    }
  }, { passive: true });
}

// ── Task CRUD actions ─────────────────────────────────────────────────────────
async function toggleTask(id) {
  const t = await Tasks.get(id);
  if (!t) return;
  await Tasks.update(id, { isComplete: !t.isComplete });
  renderView();
}

async function confirmDeleteTask(id) {
  // Animate card out then delete
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) {
    el.style.transition = 'opacity 0.2s, transform 0.2s, max-height 0.3s 0.15s, margin 0.3s 0.15s, padding 0.3s 0.15s';
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
