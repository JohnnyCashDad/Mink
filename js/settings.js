'use strict';

// ── Settings — Digest notification time ───────────────────────────────────────
// digestHour stored in localStorage as an integer 0-23.
// Default: 8 (8 AM).
// Accessed by services.js via getDigestHour().
// UI: gear icon in Today hero opens a small bottom sheet.

const DIGEST_HOUR_KEY = 'mink.digestHour';

function getDigestHour() {
  const stored = localStorage.getItem(DIGEST_HOUR_KEY);
  const h = parseInt(stored, 10);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : 8;
}

function setDigestHour(h) {
  localStorage.setItem(DIGEST_HOUR_KEY, String(h));
  // Clear the digest-sent stamp so the new hour takes effect today if applicable
  localStorage.removeItem(DIGEST_KEY);
}

function formatHour(h) {
  if (h === 0)  return '12:00 AM';
  if (h < 12)   return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
}

// ── Open settings sheet ───────────────────────────────────────────────────────
function openSettings() {
  const overlay = document.getElementById('settings-overlay');
  const sheet   = document.getElementById('settings-sheet');
  if (!overlay || !sheet) return;

  overlay.classList.remove('hidden');
  overlay.getBoundingClientRect();
  overlay.classList.add('sett-open');
  sheet.classList.add('sett-open');

  _renderSettingsSheet();
}

function closeSettings() {
  const overlay = document.getElementById('settings-overlay');
  const sheet   = document.getElementById('settings-sheet');
  if (!overlay || !sheet) return;
  overlay.classList.remove('sett-open');
  sheet.classList.remove('sett-open');
  setTimeout(() => overlay.classList.add('hidden'), 280);
}

function _renderSettingsSheet() {
  const sheet = document.getElementById('settings-sheet');
  const hour  = getDigestHour();

  // Build hour options 5 AM – 11 PM (sensible range)
  const hours = [];
  for (let h = 5; h <= 23; h++) hours.push(h);
  // Also include midnight/early for completeness
  const opts = hours.map(h =>
    `<option value="${h}"${h === hour ? ' selected' : ''}>${formatHour(h)}</option>`
  ).join('');

  sheet.innerHTML = `
<div class="sheet-handle"></div>
<div class="cap-hd">
  <button class="cap-cancel-btn" id="sett-close">Cancel</button>
  <span class="cap-hd-title">Settings</span>
  <button class="cap-hd-add cap-hd-add-active" id="sett-save">Save</button>
</div>
<div class="cap-body" style="padding-bottom:20px">

  <div class="sett-row">
    <div class="sett-row-info">
      <div class="sett-row-title">
        <i class="ti ti-bell" aria-hidden="true"></i>
        Morning digest
      </div>
      <div class="sett-row-sub">Daily summary notification sent once after this time</div>
    </div>
    <select id="sett-hour-sel" class="sett-select">
      ${opts}
    </select>
  </div>

  <div class="sett-note">
    <i class="ti ti-info-circle" aria-hidden="true"></i>
    Notifications must be allowed in your browser or phone settings.
    The digest fires once per day, the first time you open Mink after the chosen hour.
  </div>

</div>`;

  document.getElementById('sett-close').addEventListener('click', closeSettings);
  document.getElementById('sett-save').addEventListener('click', () => {
    const sel = document.getElementById('sett-hour-sel');
    if (sel) setDigestHour(parseInt(sel.value, 10));
    closeSettings();
    // Re-render today hero so the pill shows the new time
    if (typeof renderView === 'function') renderView();
  });
  document.getElementById('settings-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('settings-overlay')) closeSettings();
  });
}
