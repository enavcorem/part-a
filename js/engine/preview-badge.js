// ===== תג "תצוגת מורה" (נטען רק עם ?preview=1) =====
// פס קטן קבוע בתחתית המסך: מי אני (מורה, תצוגה), באיזו לשון מוצג הטקסט
// (מתג רבים/נקבה/זכר, ברירת מחדל רבים; בקורס `voice: 'plural'` רק חיווי "רבים"), ו"יציאה מהתצוגה".
// הנתונים עצמם נשמרים ב-progress.js במפתח נפרד, בלי מסד. ראו שם.

import * as Progress from '../progress.js';
import { PLURAL_VOICE } from './phrases.js';

export function mountPreviewBadge() {
  if (document.getElementById('preview-badge')) return;
  const bar = document.createElement('div');
  bar.id = 'preview-badge';
  bar.className = 'preview-badge';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'תצוגת מורה');

  const label = document.createElement('span');
  label.className = 'preview-badge-label';
  label.textContent = '👁️ תצוגת מורה';
  label.title = 'הכול פתוח, ושום דבר לא נשמר במסד';
  bar.appendChild(label);

  const group = document.createElement('div');
  group.className = 'preview-badge-voice';
  if (PLURAL_VOICE) {
    const fixed = document.createElement('span');
    fixed.className = 'preview-badge-fixed';
    fixed.textContent = 'לשון רבים';
    group.appendChild(fixed);
  } else {
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'לשון הפנייה');
    [['p', 'רבים'], ['f', 'נקבה'], ['m', 'זכר']].forEach(([g, text]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.gender = g;
      b.textContent = text;
      b.addEventListener('click', () => {
        Progress.setPreviewGender(g);
        paint();
        window.dispatchEvent(new CustomEvent('lomda-preview-changed'));
      });
      group.appendChild(b);
    });
  }
  bar.appendChild(group);

  const exit = document.createElement('button');
  exit.type = 'button';
  exit.className = 'preview-badge-exit';
  exit.textContent = 'יציאה מהתצוגה';
  exit.addEventListener('click', () => Progress.exitPreview());
  bar.appendChild(exit);

  function paint() {
    const s = Progress.getStudent();
    group.querySelectorAll('button[data-gender]').forEach((b) => {
      const cur = s && (s.gender === 'm' || s.gender === 'p') ? s.gender : 'f';
      b.setAttribute('aria-pressed', String(!!s && b.dataset.gender === cur));
    });
  }
  paint();
  document.body.appendChild(bar);
}
