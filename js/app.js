'use strict';

// ── Navigation state ──────────────────────────────────────────────────────────
let activeTab        = 'today';
let viewingCompleted = false;

const TAB_CONFIG = {
  today:    { label: 'Today',    icon: 'ti-sun',       fabAction: () => openCapture({}) },
  upcoming: { label: 'Upcoming', icon: 'ti-calendar',  fabAction: () => openCapture({}) },
  someday:  { label: 'Someday',  icon: 'ti-inbox',     fabAction: () => openCapture({ asSomeday: true }) },
  projects: { label: 'Projects', icon: 'ti-folder',    fabAction: null }, // set dynamically
  stats:    { label: 'Stats',    icon: 'ti-chart-bar', fabAction: null },
};

// ── Render dispatcher ─────────────────────────────────────────────────────────
async function renderView() {
  const content = document.getElementById('app-content');
  content.scrollTop = 0;

  const fab = document.getElementById('fab');
  const completedBtn = document.getElementById('completed-btn');
  completedBtn?.classList.toggle('active', viewingCompleted);

  if (viewingCompleted) {
    fab.style.display = 'none';
    await renderCompleted();
    return;
  }

  if (activeTab === 'today') {
    fab.style.display = '';
    fab.onclick = () => openCapture({});
    await renderToday();

  } else if (activeTab === 'upcoming') {
    fab.style.display = '';
    fab.onclick = () => openCapture({});
    await renderUpcoming();

  } else if (activeTab === 'projects') {
    if (activeProjId) {
      fab.style.display = '';
      fab.onclick = () => openCapture({ projectId: activeProjId });
    } else if (showNewProjForm) {
      fab.style.display = 'none';
    } else {
      fab.style.display = '';
      fab.onclick = () => { showNewProjForm = true; renderView(); };
    }
    await renderProjects();

  } else if (activeTab === 'stats') {
    fab.style.display = 'none';
    await renderStats();

  } else if (activeTab === 'someday') {
    fab.style.display = '';
    fab.onclick = () => openCapture({ asSomeday: true });
    await renderSomeday();
  }
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  activeTab        = tab;
  activeProjId     = null;
  showNewProjForm  = false;
  viewingCompleted = false;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  renderView();
}

// ── Completed view toggle ─────────────────────────────────────────────────────
function toggleCompletedView() {
  viewingCompleted = !viewingCompleted;
  renderView();
}

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  // Tab bar clicks
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Capture overlay close on backdrop
  document.getElementById('capture-overlay')?.addEventListener('click', closeCapture);

  // Completed view toggle
  document.getElementById('completed-btn')?.addEventListener('click', toggleCompletedView);

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Boot sequence
  await performRollover();
  await backfillCompletedAt();
  setupNotifications();
  switchTab('today');
})();
