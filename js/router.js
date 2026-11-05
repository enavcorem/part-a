// ===== ניתוב מבוסס hash — בלי שרת, בלי הגדרות אירוח מיוחדות =====
// #login | #roadmap | #unit/<unitId> | #grand-finale

import { findUnit } from '../content/manifest.js';
import * as Progress from './progress.js';
import { renderLogin, renderRoadmap, renderGrandFinale } from './engine/roadmap-render.js';
import { runUnit } from './engine/unit-runner.js';
import { runQuiz } from './engine/quiz-runner.js';
import { tv } from './engine/phrases.js';
// כל קורס חייב קובץ content/widgets/index.js — גם אם הוא ריק. הייבוא כאן
// בכוונה *בלי* try/catch: אם יש שגיאה בקובץ הווידג'טים של הקורס, עדיף
// שהיא תתפוצץ בקול ולא שהלומדה תרוץ בשקט בלי הבלוקים שלה.
import '../content/widgets/index.js';

const APP_ROOT_ID = 'app-root';

async function route() {
  const root = document.getElementById(APP_ROOT_ID);
  if (!root) return;
  const hash = location.hash.replace(/^#/, '') || 'roadmap';

  // תצוגת מורה: אין כניסה, יש משתמשת מקומית (progress.js)
  if (hash === 'login' && Progress.isPreview()) { location.hash = '#roadmap'; return; }
  if (hash === 'login') return renderLogin(root);

  if (!Progress.getStudent()) { location.hash = '#login'; return; }

  if (hash === 'roadmap' || hash === '') return renderRoadmap(root);
  if (hash === 'grand-finale') return renderGrandFinale(root);

  if (hash.startsWith('unit/')) {
    const unitId = hash.slice('unit/'.length);
    const unit = findUnit(unitId);
    if (!unit || !unit.modulePath) { location.hash = '#roadmap'; return; }
    if (!Progress.canAccessUnit(unitId)) {
      alert(tv('unit_locked_alert'));
      location.hash = '#roadmap';
      return;
    }
    root.innerHTML = `<p class="muted">${tv('loading')}</p>`;
    try {
      if (unit.type === 'quiz' || unit.type === 'exemption') {
        await runQuiz(unit, root);
      } else {
        await runUnit(unit, root);
      }
    } catch (err) {
      console.error('שגיאה בטעינת היחידה', unit.id, err);
      root.innerHTML = '<p class="muted">משהו השתבש בטעינת היחידה הזו. אפשר לחזור למסלול ולנסות שוב.</p>';
    }
    return;
  }

  location.hash = '#roadmap';
}

// טעינה כ-<script type="module"> קורית אחרי ניתוח ה-DOM, כמו defer —
// אין צורך גם ב-DOMContentLoaded בנוסף לקריאה הישירה.
window.addEventListener('hashchange', route);
route();

// תצוגת מורה: התג (מתג נקבה/זכר + יציאה) נטען רק כשצריך, ולכן לתלמידה אמיתית
// הוא לא מוריד ולא מוסיף כלום. החלפת לשון בתג מציירת את המסך מחדש.
if (Progress.isPreview()) {
  import('./engine/preview-badge.js').then((m) => m.mountPreviewBadge());
  window.addEventListener('lomda-preview-changed', route);
}

// המורה פותחת/סוגרת את הלומדה לכיתה בלוח — בודקים בכל טעינה. אם המצב
// השתנה ואנחנו במסלול, מציירים אותו מחדש (באמצע יחידה לא מפריעים).
Progress.refreshCourseOpen().then((changed) => {
  const hash = location.hash.replace(/^#/, '');
  if (changed && (hash === '' || hash === 'roadmap')) route();
});
