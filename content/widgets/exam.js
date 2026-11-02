// ===== המיני-בגרות: מבחן נעול בקוד, בשעון, עם הגשה =====
// { type: 'exam', key: 'pa-exam25', title, minutes: 45, payload }
// payload — השאלות המקודדות (ch3-u3-exam-data.js). אחרי הקוד הן נפתחות באותו
// מסך iTest של הלומדה (itest.js), עם שלושה דברים נוספים:
//   קוד      — שהמורה כותבת על הלוח. נשמר במכשיר, כדי לא להקליד אותו שוב.
//   שעון     — נספר מהכניסה הראשונה (`${key}-started`, נשמר בשרת, ולכן ממשיך גם
//              במכשיר אחר). בסוף הזמן אפשר להמשיך לכתוב, והשעון נצבע באדום.
//              את הזמן אוכפת המורה.
//   הגשה     — `${key}-submitted`. אחריה כל השדות נעולים, כדי שההערות של
//              המורה לא יידרסו.
//   ציונים   — דף הבדיקה (content/grading/) כותב אותם בשורה נפרדת, FB_UNIT. התלמידה
//              רואה אותם רק אחרי שהמורה סימנה "הוחזר" (_released).
// התשובות נשמרות כמו בכל הלומדה: store.js, ‏`${key}-${item.id}`, ‏open: true.

import * as Store from './store.js';
import * as Progress from '../../js/progress.js';
import { openOverlay, allItems, itemKey, ready, ensureStatusEl } from './itest.js';
import { decodeExam, normalizeCode } from './exam-codec.js';

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

// localStorage יכול להיות חסום (גלישה בסתר, חשבון חינוך)
const codeStore = {
  get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* */ } },
};

const pad = (n) => String(n).padStart(2, '0');
const clock = (sec) => `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
const when = (iso) => {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const FB_UNIT = 'pa-ch3-u3-fb'; // גם ב-grading/grade.js

// הציונים וההערות, אם המורה כבר החזירה. קוראים ישר מהשרת, ולא כותבים לשורה הזו.
async function fetchFeedback() {
  const row = await Progress.fetchRemoteQuizAnswers(FB_UNIT);
  if (!row || !Array.isArray(row.answers)) return null;
  const fb = { items: {}, total: null, general: '', released: false };
  row.answers.forEach((a) => {
    if (a.key === '_released') fb.released = a.value === true;
    else if (a.key === '_total') fb.total = a.value && a.value.score;
    else if (a.key === '_general') fb.general = (a.value && a.value.note) || '';
    else if (a.key) fb.items[a.key] = a.value || {};
  });
  return fb.released ? fb : null;
}

function feedbackBox(g, points) {
  const box = el('div', 'pa-exam-fb');
  const score = typeof g.score === 'number' ? `${g.score} מתוך ${points}` : 'לא נבדק';
  box.appendChild(el('div', 'pa-exam-fb-score', `👩‍🏫 ציון: ${score}`));
  if (g.note) box.appendChild(el('div', 'pa-exam-fb-note')).textContent = g.note;
  return box;
}

function answered(exam, it) {
  const v = Store.getValue(itemKey(exam, it));
  if (!v) return false;
  return typeof v === 'object' ? !!(v.choice && (v.text || '').trim()) : String(v).trim() !== '';
}

function renderExam(block) {
  ensureStatusEl();
  const unitId = Store.currentUnitId();
  const minutes = block.minutes || 45;
  const startKey = `${block.key}-started`;
  const submitKey = `${block.key}-submitted`;
  const codeKey = `parta_exam_code_${block.key}`;
  const isSubmitted = () => !!Store.getValue(submitKey);

  let exam = null;
  let feedback = null;
  const tryCode = (code) => {
    const data = decodeExam(block.payload, code);
    if (!data) return false;
    exam = { ...data, key: block.key, title: block.title || data.title };
    codeStore.set(codeKey, normalizeCode(code));
    return true;
  };

  const card = el('div', 'block pa-itest-card pa-exam-card');
  card.appendChild(el('div', 'pa-itest-card-icon', '🏛️'));
  const body = el('div', 'pa-itest-card-body');
  card.appendChild(body);
  body.appendChild(el('div', 'pa-itest-card-status', 'טוען…'));

  function render() {
    body.innerHTML = '';
    body.appendChild(el('div', 'pa-itest-card-title', block.title || 'מבחן'));
    if (!exam) tryCode(codeStore.get(codeKey));

    if (!exam) {
      body.appendChild(el('div', 'pa-itest-card-desc', `🔒 המבחן נעול. הקלידו את הקוד שהמורה כתבה על הלוח. מהרגע שנפתח המבחן מתחיל שעון של ${minutes} דקות.`));
      const form = el('form', 'pa-exam-code');
      const input = el('input', 'input-field');
      input.inputMode = 'numeric';
      input.autocomplete = 'off';
      input.setAttribute('aria-label', 'קוד המבחן');
      input.placeholder = 'קוד המבחן';
      const go = el('button', 'btn btn-primary', 'פתיחה');
      go.type = 'submit';
      const msg = el('div', 'pa-exam-msg');
      msg.setAttribute('aria-live', 'polite');
      form.append(input, go);
      body.append(form, msg);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (tryCode(input.value)) render();
        else msg.textContent = 'הקוד לא נכון. בדקו שוב מול הלוח.';
      });
      return;
    }

    const items = allItems(exam);
    const n = items.filter(({ it }) => answered(exam, it)).length;
    const submitted = Store.getValue(submitKey);
    const started = Store.getValue(startKey);
    const status = submitted
      ? `✓ הוגש ב-${when(submitted)}.${feedback ? '' : ' אי אפשר לשנות את התשובות. המורה תחזיר ציון והערות.'}`
      : `עניתם על ${n} מתוך ${items.length} פריטים${started ? ` · התחלתם ב-${when(started)}` : ''}`;
    body.appendChild(el('div', 'pa-itest-card-status', status));
    if (feedback) {
      const fbBox = el('div', 'pa-exam-fb');
      fbBox.appendChild(el('div', 'pa-exam-fb-score', `👩‍🏫 הציון שלכם: ${feedback.total ?? '—'} מתוך 100`));
      if (feedback.general) fbBox.appendChild(el('div', 'pa-exam-fb-note')).textContent = feedback.general;
      fbBox.appendChild(el('div', 'pa-itest-card-desc', 'את הציון וההערה לכל סעיף רואים בתוך המבחן, מתחת לכל תשובה.'));
      body.appendChild(fbBox);
    }
    const label = submitted ? (feedback ? 'לציונים ולהערות ←' : 'צפייה במה שהגשתם') : (started ? 'המשיכו במבחן ←' : 'התחילו את המבחן ←');
    const open = el('button', 'btn btn-primary', label);
    open.type = 'button';
    open.addEventListener('click', start);
    body.appendChild(open);
  }

  function start() {
    if (!Store.getValue(startKey)) {
      const now = new Date().toISOString();
      Store.setValue(unitId, startKey, 'התחלת המבחן', now, when(now));
      Store.flushAll();
    }
    const timer = el('div', 'pa-exam-timer');
    timer.setAttribute('role', 'timer');
    const tick = () => {
      if (isSubmitted()) { timer.textContent = '✓ הוגש'; timer.classList.remove('is-over'); return; }
      const left = Math.round(minutes * 60 - (Date.now() - new Date(Store.getValue(startKey)).getTime()) / 1000);
      timer.classList.toggle('is-over', left <= 0);
      timer.textContent = left > 0 ? `⏱️ נשארו ${clock(left)}` : `⏱️ הזמן נגמר (עברו ${clock(-left)})`;
    };
    tick();
    const interval = setInterval(tick, 1000);

    openOverlay(exam, () => { clearInterval(interval); render(); }, {
      locked: isSubmitted,
      barExtra: timer,
      itemFooter: (it) => (feedback ? feedbackBox(feedback.items[it.id] || {}, it.points) : null),
      afterQuestion(qPane, qi, isLast, rerender) {
        if (!isLast) return;
        const box = el('div', 'pa-exam-submit');
        if (isSubmitted()) {
          box.appendChild(el('p', '', `✓ המבחן הוגש ב-${when(Store.getValue(submitKey))}. אפשר לסגור את המסך.`));
          qPane.appendChild(box);
          return;
        }
        const items = allItems(exam);
        const missing = items.filter(({ it }) => !answered(exam, it));
        const info = el('p', '', missing.length
          ? `סיימתם? חסרות עוד ${missing.length} תשובות (בטענה צריך גם בחירה וגם נימוק). אפשר לחזור לשאלה 1 בסרגל העליון.`
          : 'עניתם על הכול. כשאתם מוכנים, הגישו.');
        const btn = el('button', 'btn btn-primary', 'הגשת המבחן');
        btn.type = 'button';
        // שתי לחיצות, בלי חלון קופץ: הראשונה שואלת, השנייה מגישה
        let armed = false;
        btn.addEventListener('click', () => {
          if (!armed) {
            armed = true;
            btn.textContent = 'בטוחים? אחרי ההגשה אי אפשר לשנות. לחצו שוב להגשה';
            btn.classList.add('is-armed');
            return;
          }
          const now = new Date().toISOString();
          Store.setValue(unitId, submitKey, 'הגשת המבחן', now, when(now));
          Store.flushAll();
          tick();
          rerender();
        });
        box.append(info, btn);
        qPane.appendChild(box);
      },
    });
  }

  // קודם מושכים מהשרת (אולי התחילו או הגישו במכשיר אחר), ורק אז מציגים
  Promise.all([ready(unitId), fetchFeedback().catch(() => null)]).then(([, fb]) => { feedback = fb; render(); });
  return card;
}

export const BLOCKS = { exam: renderExam };
