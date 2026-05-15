'use strict';

// ── Database ──────────────────────────────────────────────────────────────────
const db = new Dexie('MinkDB');

db.version(1).stores({
  tasks:    'id, scheduledFor, isComplete, projectId, createdAt, sortOrder',
  projects: 'id, name',
  tags:     'id, name',
});

// ── ID generator ──────────────────────────────────────────────────────────────
function uid() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
const Tasks = {
  all:    ()          => db.tasks.toArray(),
  get:    id          => db.tasks.get(id),
  add:    t           => db.tasks.add(t),
  update: (id, patch) => db.tasks.update(id, patch),
  remove: id          => db.tasks.delete(id),

  create({ title, priority = 'none', scheduledFor, dueDate = null,
           projectId = null, tagIds = [], notes = '', subtasks = [],
           recurrenceRule = null, sortOrder = Date.now() }) {
    return {
      id: uid(),
      title,
      priority,
      scheduledFor,
      dueDate,
      isComplete: false,
      isRolledOver: false,
      originalDate: null,
      projectId,
      tagIds,
      notes,
      subtasks,          // [{id, title, isComplete}]
      recurrenceRule,    // null | 'daily' | 'weekly' | 'monthly' (v1.1)
      sortOrder,
      createdAt: new Date().toISOString(),
    };
  },
};

// ── Projects ──────────────────────────────────────────────────────────────────
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

// ── Tags ──────────────────────────────────────────────────────────────────────
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
