'use strict';

// ── Capture state ─────────────────────────────────────────────────────────────
const cap = {
  editingId:      null,
  title:          '',
  notes:          '',
  priority:       'none',
  isSomeday:      false,
  hasDueDate:     false,
  dueDate:        '',
  projectId:      null,
  tagIds:         [],
  subtasks:       [],
};

// ── Open / close ──────────────────────────────────────────────────────────────
function openCapture({ asSomeday = false, projectId = null } = {}) {
  Object.assign(cap, {
    editingId: null, title: '', notes: '',
    priority: 'none', isSomeday: asSomeday,
    hasDueDate: false, dueDate: todayStr(),
    projectId, tagIds: [], subtasks: [],
  });
  _showSheet();
}

async function openEdit(id) {
  const t = await Tasks.get(id);
  if (!t) return;
  Object.assign(cap, {
    editingId:  id,
    title:      t.title,
    notes:      t.notes || '',
    priority:   t.priority,
    isSomeday:  isSomeday(t),
    hasDueDate: !!t.dueDate,
    dueDate:    t.dueDate || todayStr(),
    projectId:  t.projectId,
    tagIds:     [...(t.tagIds || [])],
    subtasks:   [...(t.subtasks || [])],
  });
  _showSheet();
}

function closeCapture() {
  document.getElementById('capture-overlay').classList.remove('open');
  document.getElementById('capture-sheet').classList.remove('open');
  if (typeof speech !== 'undefined' && speech.recording) speech.stop();
}

function _showSheet() {
  document.getElementById('capture-overlay').classList.add('open');
  document.getElementById('capture-sheet').classList.add('open');
  _renderSheet();
}

// ── Render ────────────────────────────────────────────────────────────────────
async function _renderSheet() {
  const [allProjects, allTags] = await Promise.all([Projects.all(), Tags.all()]);
  document.getElementById('capture-sheet').innerHTML = _buildHTML(allProjects, allTags);
  _attachListeners();
  const ta = document.getElementById('cap-title');
  if (ta) { ta.value = cap.title; ta.focus(); }
}

function _buildHTML(allProjects, allTags) {
  const priOpts = ['none','low','medium','high'].map(p => {
    const color = p === 'high' ? 'var(--pri-high)' : p === 'medium' ? 'var(--pri-med)' : p === 'low' ? 'var(--border-strong)' : '#555';
    return `<button class="pri-chip ${cap.priority === p ? 'sel' : ''}" data-pri="${p}">
      <span class="pri-chip-dot" style="background:${color}"></span>
      ${p.charAt(0).toUpperCase() + p.slice(1)}
    </button>`;
  }).join('');

  const projOpts = allProjects.map(p =>
    `<option value="${p.id}" ${cap.projectId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');

  const tagChips = allTags.map(tag => {
    const sel = cap.tagIds.includes(tag.id);
    return `<button class="cap-tag ${sel ? 'sel' : ''}" data-tagid="${tag.id}"
      style="${sel ? `color:${tag.colorHex};border-color:${tag.colorHex}` : ''}">${esc(tag.name)}</button>`;
  }).join('');

  const subtaskRows = cap.subtasks.map((s, i) => `
    <div class="subtask-edit-row" style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <button class="task-chk ${s.isComplete ? 'chk-done' : ''}" data-action="toggle-sub" data-idx="${i}"
              style="flex-shrink:0" aria-label="Toggle subtask"></button>
      <input value="${esc(s.title)}" data-action="edit-sub" data-idx="${i}"
             style="flex:1;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:8px;padding:7px 10px;font-size:13px;color:var(--text-primary);outline:none">
      <button data-action="del-sub" data-idx="${i}"
              style="background:none;border:none;color:var(--pri-high);font-size:18px;padding:4px;line-height:1">×</button>
    </div>`).join('');

  return `
<div class="sheet-handle"></div>
<div class="sheet-header">
  <button class="sheet-cancel" id="cap-cancel">Cancel</button>
  <span class="sheet-title">${cap.editingId ? 'Edit Task' : 'New Task'}</span>
</div>
<div class="sheet-body">
  <div class="cap-title-row">
    <textarea id="cap-title" class="cap-title-input" placeholder="What's on your mind?" rows="2">${esc(cap.title)}</textarea>
    <button class="mic-btn" id="mic-btn" type="button" aria-label="Hold to record">
      <i class="ti ti-microphone" aria-hidden="true"></i>
    </button>
  </div>

  <div class="cap-label">Priority</div>
  <div class="pri-chip-row">${priOpts}</div>

  <div class="cap-label" style="margin-top:18px">Notes</div>
  <textarea id="cap-notes" class="cap-notes" placeholder="Add details…">${esc(cap.notes)}</textarea>

  <div class="toggle-row">
    <div class="toggle-info">
      <div class="toggle-title">Someday</div>
      <div class="toggle-sub">Park it — no specific date</div>
    </div>
    <input type="checkbox" class="ios-chk" id="someday-chk" ${cap.isSomeday ? 'checked' : ''}>
  </div>

  ${!cap.isSomeday ? `
  <div class="toggle-row">
    <div class="toggle-title">Due date</div>
    <input type="checkbox" class="ios-chk" id="duedate-chk" ${cap.hasDueDate ? 'checked' : ''}>
  </div>
  ${cap.hasDueDate ? `<input type="date" id="cap-due" class="cap-date-input" value="${cap.dueDate}" min="${todayStr()}">` : ''}
  ` : ''}

  ${allProjects.length ? `
  <div class="cap-label">Project</div>
  <select id="cap-proj" class="cap-select">
    <option value="">None</option>${projOpts}
  </select>` : ''}

  ${allTags.length ? `
  <div class="cap-label">Tags</div>
  <div class="cap-tags-row">${tagChips}</div>` : ''}

  <div class="cap-label">Subtasks</div>
  <div id="subtask-list">${subtaskRows}</div>
  <button id="add-subtask-btn" style="background:none;border:1.5px dashed var(--border-strong);color:var(--text-tertiary);padding:6px 12px;border-radius:8px;font-size:13px;margin-top:4px;width:100%;cursor:pointer">
    + Add subtask
  </button>
</div>
<div class="sheet-footer">
  <button class="add-btn" id="cap-submit" ${!cap.title.trim() ? 'disabled' : ''}>
    ${cap.editingId ? 'Save Changes' : 'Add Task'}
  </button>
</div>`;
}

// ── Listeners ─────────────────────────────────────────────────────────────────
function _attachListeners() {
  const titleEl = document.getElementById('cap-title');
  const submitEl = document.getElementById('cap-submit');

  titleEl?.addEventListener('input', () => {
    cap.title = titleEl.value;
    if (submitEl) submitEl.disabled = !cap.title.trim();
  });

  document.getElementById('cap-notes')?.addEventListener('input', e => {
    cap.notes = e.target.value;
  });

  document.querySelectorAll('.pri-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      cap.title = titleEl?.value || cap.title;
      cap.priority = btn.dataset.pri;
      document.querySelectorAll('.pri-chip').forEach(b => b.classList.toggle('sel', b === btn));
    });
  });

  document.getElementById('someday-chk')?.addEventListener('change', e => {
    cap.title = titleEl?.value || cap.title;
    cap.isSomeday = e.target.checked;
    if (cap.isSomeday) cap.hasDueDate = false;
    _renderSheet();
  });

  document.getElementById('duedate-chk')?.addEventListener('change', e => {
    cap.title = titleEl?.value || cap.title;
    cap.hasDueDate = e.target.checked;
    _renderSheet();
  });

  document.getElementById('cap-due')?.addEventListener('change', e => {
    cap.dueDate = e.target.value;
  });

  document.getElementById('cap-proj')?.addEventListener('change', e => {
    cap.projectId = e.target.value || null;
  });

  document.querySelectorAll('.cap-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      cap.title = titleEl?.value || cap.title;
      const id = btn.dataset.tagid;
      const idx = cap.tagIds.indexOf(id);
      idx === -1 ? cap.tagIds.push(id) : cap.tagIds.splice(idx, 1);
      _renderSheet();
    });
  });

  // Subtask interactions
  document.getElementById('add-subtask-btn')?.addEventListener('click', () => {
    cap.title = titleEl?.value || cap.title;
    cap.subtasks.push({ id: uid(), title: '', isComplete: false });
    _renderSheet();
    // focus last subtask input
    setTimeout(() => {
      const inputs = document.querySelectorAll('[data-action="edit-sub"]');
      if (inputs.length) inputs[inputs.length - 1].focus();
    }, 50);
  });

  document.querySelectorAll('[data-action="toggle-sub"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.idx);
      cap.subtasks[i].isComplete = !cap.subtasks[i].isComplete;
      btn.classList.toggle('chk-done', cap.subtasks[i].isComplete);
    });
  });

  document.querySelectorAll('[data-action="edit-sub"]').forEach(inp => {
    inp.addEventListener('input', e => {
      cap.subtasks[parseInt(inp.dataset.idx)].title = e.target.value;
    });
  });

  document.querySelectorAll('[data-action="del-sub"]').forEach(btn => {
    btn.addEventListener('click', () => {
      cap.title = titleEl?.value || cap.title;
      cap.subtasks.splice(parseInt(btn.dataset.idx), 1);
      _renderSheet();
    });
  });

  document.getElementById('cap-cancel')?.addEventListener('click', closeCapture);
  document.getElementById('capture-overlay')?.addEventListener('click', closeCapture);
  submitEl?.addEventListener('click', saveTask);
  _attachMic();
}

// ── Save ──────────────────────────────────────────────────────────────────────
async function saveTask() {
  const title = cap.title.trim();
  if (!title) return;

  const scheduledFor = cap.isSomeday        ? SOMEDAY
                     : (cap.hasDueDate && cap.dueDate) ? cap.dueDate
                     : todayStr();

  const patch = {
    title,
    notes:      cap.notes,
    priority:   cap.priority,
    scheduledFor,
    dueDate:    (cap.isSomeday || !cap.hasDueDate) ? null : cap.dueDate,
    projectId:  cap.projectId,
    tagIds:     [...cap.tagIds],
    subtasks:   cap.subtasks.filter(s => s.title.trim()),
  };

  if (cap.editingId) {
    await Tasks.update(cap.editingId, patch);
  } else {
    await Tasks.add(Tasks.create({ ...patch, sortOrder: Date.now() }));
  }

  closeCapture();
  renderView();
}

// ── Voice input ───────────────────────────────────────────────────────────────
class SpeechService {
  constructor() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.available  = !!SR;
    this.recording  = false;
    this.transcript = '';
    if (SR) {
      this.rec = new SR();
      this.rec.continuous     = false;
      this.rec.interimResults = true;
      this.rec.lang           = 'en-US';
    }
  }

  start(onUpdate, onDone) {
    if (!this.available || this.recording) return;
    this.recording = true; this.transcript = '';
    this.rec.onresult = e => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      this.transcript = t;
      onUpdate?.(t);
    };
    this.rec.onerror = () => this._end(onDone);
    this.rec.onend   = () => this._end(onDone);
    try { this.rec.start(); } catch { this.recording = false; }
  }

  stop() { if (this.recording) try { this.rec.stop(); } catch {} }

  _end(onDone) {
    const was = this.recording;
    this.recording = false;
    if (was) onDone?.(this.transcript);
  }
}

const speech = new SpeechService();

function _attachMic() {
  const btn = document.getElementById('mic-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (speech.recording) {
      speech.stop();
      btn.classList.remove('recording');
      return;
    }
    if (!speech.available) {
      alert('Speech recognition is not available in this browser.');
      return;
    }
    const before = (document.getElementById('cap-title')?.value || '').trimEnd();
    btn.classList.add('recording');

    speech.start(
      text => {
        const el = document.getElementById('cap-title');
        if (!el) return;
        el.value = before ? `${before} ${text}` : text;
        cap.title = el.value;
        const sub = document.getElementById('cap-submit');
        if (sub) sub.disabled = !cap.title.trim();
      },
      text => {
        btn.classList.remove('recording');
        if (text.trim()) {
          cap.title = before ? `${before} ${text.trim()}` : text.trim();
          const el = document.getElementById('cap-title');
          if (el) el.value = cap.title;
        }
        const sub = document.getElementById('cap-submit');
        if (sub) sub.disabled = !cap.title.trim();
      }
    );
  });
}
