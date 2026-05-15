'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
const SOMEDAY      = '9999-01-01';
const ROLLOVER_KEY = 'mink.lastRollover';
const DIGEST_KEY   = 'mink.lastDigest';

const PROJECT_COLORS = [
  '#1D9E75','#E24B4A','#EF9F27','#3B82F6',
  '#8B5CF6','#F59E0B','#10B981','#6B7280',
];
const PROJECT_ICONS = ['📁','💼','🏠','🎯','📚','🔧','🎨','⭐','🚀','💡'];

const PRI_RANK = { high: 0, medium: 1, low: 2, none: 3 };

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function isSomeday(t) {
  return t.scheduledFor >= '9000';
}

function formatDue(dateStr) {
  const today = todayStr();
  const tom   = tomorrowStr();
  const d     = new Date(dateStr + 'T00:00:00');
  const label = dateStr < today  ? `Overdue · ${d.toLocaleDateString(undefined, { month:'short', day:'numeric' })}`
              : dateStr === today ? 'Due today'
              : dateStr === tom   ? 'Due tomorrow'
              : `Due ${d.toLocaleDateString(undefined, { month:'short', day:'numeric' })}`;
  return { label, overdue: dateStr < today };
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

function friendlyDate() {
  const now  = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const mons = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[now.getDay()]} · ${mons[now.getMonth()]} ${now.getDate()}`;
}

// ── Sorting ───────────────────────────────────────────────────────────────────
function sortByPriority(arr) {
  return [...arr].sort((a, b) => {
    const r = (PRI_RANK[a.priority] ?? 3) - (PRI_RANK[b.priority] ?? 3);
    if (r !== 0) return r;
    if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

// ── HTML helpers ──────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function priBarClass(p) {
  return p === 'high' ? 'pri-high' : p === 'medium' ? 'pri-med' : p === 'low' ? 'pri-low' : 'pri-none';
}

function emptyState(title, sub, icon = 'ti-sun') {
  return `
<div class="empty-state">
  <i class="ti ${icon}" aria-hidden="true"></i>
  <p class="empty-title">${esc(title)}</p>
  <p class="empty-sub">${esc(sub)}</p>
</div>`;
}

// ── Ring math ─────────────────────────────────────────────────────────────────
function ringOffset(done, total) {
  if (total === 0) return 113;
  const pct = Math.min(done / total, 1);
  return Math.round(113 - 113 * pct);
}
