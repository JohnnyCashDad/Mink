'use strict';

// ── Rollover ──────────────────────────────────────────────────────────────────
async function performRollover() {
  const today = todayStr();
  if (localStorage.getItem(ROLLOVER_KEY) === today) return;

  const all = await Tasks.all();
  const stale = all.filter(t =>
    !t.isComplete &&
    !isSomeday(t) &&
    t.scheduledFor < today
  );

  await Promise.all(stale.map(t =>
    Tasks.update(t.id, {
      scheduledFor: today,
      isRolledOver: true,
      originalDate: t.originalDate ?? t.scheduledFor,
    })
  ));

  localStorage.setItem(ROLLOVER_KEY, today);
}

// ── Notifications ─────────────────────────────────────────────────────────────
async function setupNotifications() {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  if (Notification.permission !== 'granted') return;

  const today = todayStr();
  if (localStorage.getItem(DIGEST_KEY) === today) return;

  const now = new Date();
  if (now.getHours() < 8) return;

  const all       = await Tasks.all();
  const todayOpen = sortByPriority(
    all.filter(t => !t.isComplete && t.scheduledFor === today)
  );
  const n    = todayOpen.length;
  const body = n === 0
    ? "Nothing on today's list yet. Tap to plan your day."
    : `You have ${n} task${n === 1 ? '' : 's'} today. First up: ${todayOpen[0].title}`;

  new Notification('Mink · Good morning', { body, icon: './icon.svg' });
  localStorage.setItem(DIGEST_KEY, today);
}
