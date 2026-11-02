// ===== חגיגות: קונפטי CSS-בלבד + מודל קטן (סיום יחידה/פרק) =====
// נטען פעם אחת ומשמש גם את unit-runner וגם את quiz-runner, כדי שהחגיגה
// תרגיש עקבית בכל האפליקציה ולא תיכתב מחדש בכל מקום.

const CONFETTI_COLORS = ['#6C63FF', '#2EC4B6', '#FF9F1C', '#FF6B6B', '#4A90E2'];

export function fireConfetti(count = 24) {
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  document.body.appendChild(layer);
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.right = Math.random() * 100 + '%';
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.setProperty('--spin', (Math.random() > 0.5 ? 1 : -1) * 360 * (1 + Math.random()) + 'deg');
    const duration = 1400 + Math.random() * 900;
    piece.style.animationDuration = duration + 'ms';
    piece.style.animationDelay = (Math.random() * 250) + 'ms';
    layer.appendChild(piece);
  }
  setTimeout(() => layer.remove(), 2600);
}

export function showCelebrateModal({ icon = '🎉', title, subtitle, xpGained, onClose }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'celebrate-modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'celebrate-modal';
  modal.innerHTML = `
    <div class="celebrate-icon">${icon}</div>
    <h2>${title}</h2>
    ${subtitle ? `<p class="muted">${subtitle}</p>` : ''}
    ${xpGained != null ? `<div class="celebrate-xp">+${xpGained} XP ✨</div>` : ''}
    <button class="btn btn-primary btn-block" type="button">המשך</button>
  `;
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  fireConfetti();
  const close = () => { backdrop.remove(); if (onClose) onClose(); };
  modal.querySelector('button').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
}
