'use strict';

// ── Drag-to-reorder ───────────────────────────────────────────────────────────
// Long-press (500ms) on a task card activates drag mode.
// Works on Today (rolled + active sections) and Upcoming lists.
// Coexists with swipe: axis detection locks to vertical during drag,
// preventing swipe actions from firing while dragging.
//
// sortOrder is written back to DB on drop — same field sortByPriority() uses.
// Reorder is purely within same-day / same-section; no cross-list moves.
//
// Conventions:
//   - Tasks.update(id, { sortOrder }) for persistence
//   - renderView() NOT called after drop — DOM is already correct, avoids flash
//   - No direct listeners on task cards; drag is initiated from taskrow.js
//     calling initDrag(li) after each render

let _dragState = null; // active drag session

function initDrag(li) {
  let pressTimer = null;
  let activated  = false;

  // ── Long-press detection ───────────────────────────────────────────────────
  li.addEventListener('touchstart', e => {
    // Don't activate on checkbox or swipe-bg
    if (e.target.closest('.task-chk') || e.target.closest('.swipe-bg')) return;

    const touch = e.touches[0];
    activated = false;

    pressTimer = setTimeout(() => {
      activated = true;
      _startDrag(li, touch.clientX, touch.clientY);
    }, 500);
  }, { passive: true });

  li.addEventListener('touchmove', e => {
    if (!activated && pressTimer) {
      // Cancel long-press if user moves before threshold
      const t  = e.touches[0];
      const dx = Math.abs(t.clientX - (li._pressX || t.clientX));
      const dy = Math.abs(t.clientY - (li._pressY || t.clientY));
      if (dx > 8 || dy > 8) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    }
    if (_dragState && _dragState.li === li) {
      e.preventDefault(); // block scroll while dragging
      _moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });

  li.addEventListener('touchend', () => {
    clearTimeout(pressTimer);
    pressTimer = null;
    if (_dragState && _dragState.li === li) _endDrag();
  });

  li.addEventListener('touchcancel', () => {
    clearTimeout(pressTimer);
    pressTimer = null;
    if (_dragState && _dragState.li === li) _cancelDrag();
  });
}

// ── Start ──────────────────────────────────────────────────────────────────────
function _startDrag(li, clientX, clientY) {
  const list = li.closest('.task-list');
  if (!list) return;

  // Haptic feedback (supported on iOS Safari 16+)
  if (navigator.vibrate) navigator.vibrate(30);

  const rect = li.getBoundingClientRect();

  // Create ghost — a visual clone that follows the finger
  const ghost = li.cloneNode(true);
  ghost.id = 'drag-ghost';
  ghost.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top:  ${rect.top}px;
    width: ${rect.width}px;
    z-index: 500;
    opacity: 0.92;
    pointer-events: none;
    box-shadow: 0 8px 32px rgba(0,0,0,0.45);
    border-radius: 14px;
    transform: scale(1.03);
    transition: transform 0.15s;
  `;
  document.body.appendChild(ghost);

  // Dim the original
  li.classList.add('drag-origin');

  _dragState = {
    li,
    list,
    ghost,
    offsetY:   clientY - rect.top,
    originTop: rect.top,
  };
}

// ── Move ──────────────────────────────────────────────────────────────────────
function _moveDrag(clientX, clientY) {
  if (!_dragState) return;
  const { ghost, list, li, offsetY } = _dragState;

  // Move ghost
  const newTop = clientY - offsetY;
  ghost.style.top = newTop + 'px';

  // Find which sibling the ghost center is over
  const ghostMid  = newTop + ghost.offsetHeight / 2;
  const siblings  = [...list.querySelectorAll('.task-card:not(.drag-origin)')];

  let target = null;
  let before = true; // insert before target

  for (const sib of siblings) {
    const r   = sib.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    if (ghostMid < mid) { target = sib; before = true; break; }
    target = sib; before = false;
  }

  // Show placeholder line
  list.querySelectorAll('.drag-placeholder').forEach(p => p.remove());
  const placeholder = document.createElement('li');
  placeholder.className = 'drag-placeholder';
  if (target) {
    before ? list.insertBefore(placeholder, target) : target.insertAdjacentElement('afterend', placeholder);
  } else {
    list.appendChild(placeholder);
  }

  _dragState.target = target;
  _dragState.before = before;
}

// ── End ───────────────────────────────────────────────────────────────────────
async function _endDrag() {
  if (!_dragState) return;
  const { li, list, ghost, target, before } = _dragState;

  // Clean up ghost + placeholder
  ghost.remove();
  list.querySelectorAll('.drag-placeholder').forEach(p => p.remove());
  li.classList.remove('drag-origin');
  _dragState = null;

  // Reorder DOM
  if (target && target !== li) {
    before ? list.insertBefore(li, target) : target.insertAdjacentElement('afterend', li);
  }

  // Persist new sortOrder values for all cards in this list
  const cards = [...list.querySelectorAll('.task-card')];
  const updates = cards.map((card, i) =>
    Tasks.update(card.dataset.id, { sortOrder: i * 1000 })
  );
  await Promise.all(updates);
}

// ── Cancel ────────────────────────────────────────────────────────────────────
function _cancelDrag() {
  if (!_dragState) return;
  const { li, list, ghost } = _dragState;
  ghost.remove();
  list.querySelectorAll('.drag-placeholder').forEach(p => p.remove());
  li.classList.remove('drag-origin');
  _dragState = null;
}
