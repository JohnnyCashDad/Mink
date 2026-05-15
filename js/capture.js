'use strict';

// ── Capture state ─────────────────────────────────────────────────────────────
const cap = {
  editingId:  null,
  title:      '',
  notes:      '',
  priority:   'none',
  schedule:   'today',
  dueDate:    '',
  hasDueDate: false,
  projectId:  null,
  tagIds:     [],
  subtasks:   [],
};

// ── Open / close ──────────────────────────────────────────────────────────────
function openCapture({ asSomeday = false, projectId = null } = {}) {
  Object.assign(cap, {
    editingId: null, title: '', notes: '',
    priority: 'none', schedule: asSomeday ? 'someday' : 'today',
    dueDate: todayStr(), hasDueDate: false, projectId, tagIds: [], subtasks: [],
  });
  _showSheet();
}

async function openEdit(id) {
  const t = await Tasks.get(id);
  if (!t) return;
  let schedule = 'today';
  if (isSomeday(t))                         schedule = 'someday';
  else if (t.scheduledFor === tomorrowStr()) schedule = 'tomorrow';
  else if (t.scheduledFor !== todayStr())    schedule = 'date';
  Object.assign(cap, {
    editingId: id, title: t.title, notes: t.notes || '',
    priority: t.priority, schedule,
    dueDate: t.dueDate || t.scheduledFor || todayStr(),
    hasDueDate: !!t.dueDate, projectId: t.projectId,
    tagIds: [...(t.tagIds || [])], subtasks: [...(t.subtasks || [])],
  });
  _showSheet();
}

function closeCapture() {
  document.getElementById('capture-overlay').classList.remove('open');
  document.getElementById('capture-sheet').classList.remove('open');
  if (speech.recording) speech.stop();
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
  if (ta) { ta.value = cap.title; ta.focus(); _autoGrow(ta); }
}

function _autoGrow(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

function _buildHTML(allProjects, allTags) {
  const hasTitle = cap.title.trim().length > 0;

  const priDefs = [
    { val: 'none',   label: 'None', color: 'var(--text-tertiary)' },
    { val: 'low',    label: 'Low',  color: '#7ABFA0' },
    { val: 'medium', label: 'Med',  color: 'var(--pri-med)' },
    { val: 'high',   label: 'High', color: 'var(--pri-high)' },
  ];
  const priChips = priDefs.map(({ val, label, color }) => {
    const sel = cap.priority === val;
    return `<button class="cap-pri-btn${sel ? ' cap-pri-sel' : ''}" data-pri="${val}" ${sel ? `style="--sel-color:${color}"` : ''}>
      <span class="cap-pri-dot" style="background:${color}"></span>${label}
    </button>`;
  }).join('');

  const schedDefs = [
    { val: 'today',    label: 'Today',     icon: 'ti-sun' },
    { val: 'tomorrow', label: 'Tomorrow',  icon: 'ti-calendar' },
    { val: 'date',     label: 'Pick date', icon: 'ti-calendar-event' },
    { val: 'someday',  label: 'Someday',   icon: 'ti-inbox' },
  ];
  const schedChips = schedDefs.map(({ val, label, icon }) =>
    `<button class="cap-sched-btn${cap.schedule === val ? ' cap-sched-sel' : ''}" data-sched="${val}">
      <i class="ti ${icon}" aria-hidden="true"></i>${label}
    </button>`
  ).join('');

  const datePicker = cap.schedule === 'date'
    ? `<input type="date" id="cap-due" class="cap-date-input" value="${cap.dueDate || todayStr()}" min="${todayStr()}">` : '';

  const projLabel = allProjects.find(p => p.id === cap.projectId)?.name || 'None';
  const projOpts  = allProjects.map(p =>
    `<option value="${p.id}"${cap.projectId === p.id ? ' selected' : ''}>${esc(p.name)}</option>`
  ).join('');
  const projField = allProjects.length ? `
    <div class="cap-field-row" id="proj-field">
      <i class="ti ti-folder" aria-hidden="true"></i>
      <span class="cap-field-label">Project</span>
      <span class="cap-field-val" id="proj-display">${esc(projLabel)}</span>
      <select id="cap-proj" class="cap-field-select" aria-label="Select project">
        <option value="">None</option>${projOpts}
      </select>
      <i class="ti ti-chevron-right cap-field-chev" aria-hidden="true"></i>
    </div>` : '';

  const selTagNames = cap.tagIds.map(id => allTags.find(t => t.id === id)?.name).filter(Boolean);
  const tagsLabel   = selTagNames.length ? selTagNames.join(', ') : 'None';
  const tagChips    = allTags.map(tag => {
    const sel = cap.tagIds.includes(tag.id);
    return `<button class="cap-tag-chip${sel ? ' cap-tag-sel' : ''}" data-tagid="${tag.id}"
      ${sel ? `style="--tag-color:${tag.colorHex}"` : ''}>${esc(tag.name)}</button>`;
  }).join('');
  const tagsField = allTags.length ? `
    <div class="cap-field-row" id="tags-field">
      <i class="ti ti-tag" aria-hidden="true"></i>
      <span class="cap-field-label">Tags</span>
      <span class="cap-field-val" id="tags-display">${esc(tagsLabel)}</span>
      <i class="ti ti-chevron-right cap-field-chev" aria-hidden="true"></i>
    </div>
    <div class="cap-tags-expanded hidden" id="tags-expanded">
      <div class="cap-tag-chips">${tagChips}</div>
    </div>` : '';

  const subtaskRows = cap.subtasks.map((s, i) => `
    <div class="cap-sub-row" id="subrow-${i}">
      <button class="cap-sub-chk${s.isComplete ? ' cap-sub-done' : ''}"
              data-action="toggle-sub" data-idx="${i}" aria-label="Toggle subtask"></button>
      <input class="cap-sub-input" value="${esc(s.title)}"
             data-action="edit-sub" data-idx="${i}" placeholder="Subtask…">
      <button class="cap-sub-del" data-action="del-sub" data-idx="${i}" aria-label="Delete subtask">
        <i class="ti ti-x" aria-hidden="true"></i>
      </button>
    </div>`).join('');

  return `
<div class="sheet-handle"></div>
<div class="cap-hd">
  <button class="cap-cancel-btn" id="cap-cancel">Cancel</button>
  <span class="cap-hd-title">${cap.editingId ? 'Edit task' : 'New task'}</span>
  <button class="cap-hd-add${hasTitle ? ' cap-hd-add-active' : ''}" id="cap-hd-submit" ${!hasTitle ? 'disabled' : ''}>
    ${cap.editingId ? 'Save' : 'Add'}
  </button>
</div>
<div class="cap-body">
  <div class="cap-title-wrap">
    <textarea id="cap-title" class="cap-title-bare" placeholder="What needs to get done?" rows="1"></textarea>
    <button class="cap-mic-btn" id="mic-btn" type="button" aria-label="Voice input">
      <i class="ti ti-microphone" aria-hidden="true"></i>
    </button>
  </div>
  <div class="cap-divider"></div>
  <div class="cap-sec-lbl">Priority</div>
  <div class="cap-pri-row">${priChips}</div>
  <div class="cap-sec-lbl">Schedule</div>
  <div class="cap-sched-row">${schedChips}</div>
  ${datePicker}
  ${projField}
  ${tagsField}
  <div class="cap-field-row cap-notes-row">
    <i class="ti ti-notes" aria-hidden="true"></i>
    <textarea id="cap-notes" class="cap-notes-input" placeholder="Add notes…" rows="1">${esc(cap.notes)}</textarea>
  </div>
  <div class="cap-sec-lbl" style="margin-top:6px">Subtasks</div>
  <div id="cap-sub-list">${subtaskRows}</div>
  <button class="cap-add-sub-btn" id="add-sub-btn">
    <i class="ti ti-plus" aria-hidden="true"></i>Add subtask
  </button>
</div>
<div class="cap-footer">
  <button class="cap-submit-btn" id="cap-submit" ${!hasTitle ? 'disabled' : ''}>
    ${cap.editingId ? 'Save changes' : 'Add task'}
  </button>
</div>`;
}

// ── Listeners ─────────────────────────────────────────────────────────────────
function _attachListeners() {
  const titleEl  = document.getElementById('cap-title');
  const submitEl = document.getElementById('cap-submit');
  const hdAdd    = document.getElementById('cap-hd-submit');

  function _syncSubmit() {
    const ok = !!(titleEl?.value.trim());
    if (submitEl) submitEl.disabled = !ok;
    if (hdAdd)    { hdAdd.disabled = !ok; hdAdd.classList.toggle('cap-hd-add-active', ok); }
  }

  titleEl?.addEventListener('input', () => {
    cap.title = titleEl.value;
    _autoGrow(titleEl);
    _syncSubmit();
  });

  const notesEl = document.getElementById('cap-notes');
  notesEl?.addEventListener('input', () => { cap.notes = notesEl.value; _autoGrow(notesEl); });
  if (notesEl) _autoGrow(notesEl);

  document.querySelectorAll('.cap-pri-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      cap.priority = btn.dataset.pri;
      document.querySelectorAll('.cap-pri-btn').forEach(b => {
        b.classList.remove('cap-pri-sel');
        b.style.removeProperty('--sel-color');
      });
      btn.classList.add('cap-pri-sel');
      const dot = btn.querySelector('.cap-pri-dot');
      if (dot) btn.style.setProperty('--sel-color', dot.style.background);
    });
  });

  document.querySelectorAll('.cap-sched-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      cap.schedule = btn.dataset.sched;
      document.querySelectorAll('.cap-sched-btn').forEach(b => b.classList.remove('cap-sched-sel'));
      btn.classList.add('cap-sched-sel');
      const existing = document.getElementById('cap-due');
      if (cap.schedule === 'date' && !existing) {
        const picker = document.createElement('input');
        picker.type = 'date'; picker.id = 'cap-due';
        picker.className = 'cap-date-input';
        picker.value = cap.dueDate || todayStr();
        picker.min = todayStr();
        btn.closest('.cap-sched-row').insertAdjacentElement('afterend', picker);
        picker.addEventListener('change', e => { cap.dueDate = e.target.value; });
      } else if (cap.schedule !== 'date' && existing) {
        existing.remove();
      }
    });
  });

  document.getElementById('cap-due')?.addEventListener('change', e => { cap.dueDate = e.target.value; });

  document.getElementById('cap-proj')?.addEventListener('change', e => {
    cap.projectId = e.target.value || null;
    const d = document.getElementById('proj-display');
    if (d) d.textContent = e.target.options[e.target.selectedIndex].text;
  });

  document.getElementById('tags-field')?.addEventListener('click', () => {
    document.getElementById('tags-expanded')?.classList.toggle('hidden');
  });

  document.querySelectorAll('.cap-tag-chip').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.tagid;
      const idx = cap.tagIds.indexOf(id);
      if (idx === -1) { cap.tagIds.push(id); btn.classList.add('cap-tag-sel'); }
      else            { cap.tagIds.splice(idx, 1); btn.classList.remove('cap-tag-sel'); }
      const d = document.getElementById('tags-display');
      if (d) {
        const names = cap.tagIds.map(tid =>
          document.querySelector(`.cap-tag-chip[data-tagid="${tid}"]`)?.textContent.trim()
        ).filter(Boolean);
        d.textContent = names.length ? names.join(', ') : 'None';
      }
    });
  });

  document.getElementById('add-sub-btn')?.addEventListener('click', () => {
    cap.title = titleEl?.value || cap.title;
    cap.subtasks.push({ id: uid(), title: '', isComplete: false });
    _renderSheet();
    setTimeout(() => {
      const inputs = document.querySelectorAll('.cap-sub-input');
      if (inputs.length) inputs[inputs.length - 1].focus();
    }, 40);
  });

  document.querySelectorAll('[data-action="toggle-sub"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.idx);
      cap.subtasks[i].isComplete = !cap.subtasks[i].isComplete;
      btn.classList.toggle('cap-sub-done', cap.subtasks[i].isComplete);
    });
  });

  document.querySelectorAll('[data-action="edit-sub"]').forEach(inp => {
    inp.addEventListener('input', () => { cap.subtasks[parseInt(inp.dataset.idx)].title = inp.value; });
  });

  document.querySelectorAll('[data-action="del-sub"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.idx);
      const row = document.getElementById(`subrow-${i}`);
      if (row) {
        row.style.transition = 'opacity 0.15s, transform 0.15s';
        row.style.opacity = '0'; row.style.transform = 'translateX(8px)';
        setTimeout(() => { cap.subtasks.splice(i, 1); _renderSheet(); }, 150);
      }
    });
  });

  document.getElementById('cap-cancel')?.addEventListener('click', closeCapture);
  document.getElementById('capture-overlay')?.addEventListener('click', closeCapture);
  submitEl?.addEventListener('click', saveTask);
  hdAdd?.addEventListener('click', saveTask);
  _attachMic();
}

// ── Save ──────────────────────────────────────────────────────────────────────
async function saveTask() {
  const title = (document.getElementById('cap-title')?.value || cap.title).trim();
  if (!title) return;
  cap.title = title;

  let scheduledFor;
  switch (cap.schedule) {
    case 'someday':  scheduledFor = SOMEDAY; break;
    case 'tomorrow': scheduledFor = tomorrowStr(); break;
    case 'date':     scheduledFor = cap.dueDate || todayStr(); break;
    default:         scheduledFor = todayStr();
  }

  const patch = {
    title,
    notes:       (document.getElementById('cap-notes')?.value || cap.notes).trim(),
    priority:    cap.priority,
    scheduledFor,
    dueDate:     cap.hasDueDate && cap.dueDate && cap.schedule !== 'someday' ? cap.dueDate : null,
    projectId:   cap.projectId,
    tagIds:      [...cap.tagIds],
    subtasks:    cap.subtasks.filter(s => s.title.trim()),
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
    this.available = !!SR; this.recording = false; this.transcript = '';
    if (SR) {
      this.rec = new SR();
      this.rec.continuous = false; this.rec.interimResults = true; this.rec.lang = 'en-US';
    }
  }
  start(onUpdate, onDone) {
    if (!this.available || this.recording) return;
    this.recording = true; this.transcript = '';
    this.rec.onresult = e => {
      let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      this.transcript = t; onUpdate?.(t);
    };
    this.rec.onerror = () => this._end(onDone);
    this.rec.onend   = () => this._end(onDone);
    try { this.rec.start(); } catch { this.recording = false; }
  }
  stop() { if (this.recording) try { this.rec.stop(); } catch {} }
  _end(onDone) { const was = this.recording; this.recording = false; if (was) onDone?.(this.transcript); }
}

const speech = new SpeechService();

function _attachMic() {
  const btn = document.getElementById('mic-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (speech.recording) { speech.stop(); btn.classList.remove('recording'); return; }
    if (!speech.available) { alert('Speech recognition not available. Try Chrome or Safari on iOS.'); return; }
    const before = (document.getElementById('cap-title')?.value || '').trimEnd();
    btn.classList.add('recording');
    speech.start(
      text => {
        const el = document.getElementById('cap-title');
        if (!el) return;
        el.value = before ? `${before} ${text}` : text;
        cap.title = el.value; _autoGrow(el);
        const ok = !!cap.title.trim();
        const s = document.getElementById('cap-submit');
        const h = document.getElementById('cap-hd-submit');
        if (s) s.disabled = !ok;
        if (h) { h.disabled = !ok; h.classList.toggle('cap-hd-add-active', ok); }
      },
      text => {
        btn.classList.remove('recording');
        if (text.trim()) {
          cap.title = before ? `${before} ${text.trim()}` : text.trim();
          const el = document.getElementById('cap-title');
          if (el) { el.value = cap.title; _autoGrow(el); }
        }
        const ok = !!cap.title.trim();
        const s = document.getElementById('cap-submit');
        const h = document.getElementById('cap-hd-submit');
        if (s) s.disabled = !ok;
        if (h) { h.disabled = !ok; h.classList.toggle('cap-hd-add-active', ok); }
      }
    );
  });
}
