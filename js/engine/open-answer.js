// ===== בלוק open-answer: שדה כתיבה שנשמר, משותף לכל הלומדות =====
// שאלת הסקה פתוחה בתוך שקף רגיל. התשובה נשמרת כשורת quiz_answers של היחידה
// (Progress.saveQuizAnswers), וכל שדה מסומן open: true — כך לוח המורה מציג
// אותו כטקסט מלא ולא כשאלה עם ציון. אין כאן ציון ואין חסימה של המשך היחידה.
//
// { type: 'open-answer', key: 'pc-st2-why',          ← ייחודי בכל הלומדה. לא משנים אחרי שתלמידות כתבו
//   prompt: '<p>…</p>',                              ← השאלה (HTML)
//   kind: 'text' | 'tf' | 'choice',                  ← ברירת מחדל text. tf = נכון / לא נכון ונימוק
//   options: ['תומך', 'סותר'],                       ← רק ל-choice
//   label: 'תחנה 2: איזה סוג פוסט',                  ← השם בלוח המורה (אחרת: תחילת ה-prompt)
//   rows, placeholder, revealLabel,                  ← אופציונלי
//   model: { answer: '…', rubric: ['…'] } }          ← אופציונלי: "תשובה לדוגמה", נפתחת רק אחרי שכתבו
//
// המודול נטען רק כשיש בלוק כזה בשקף (ייבוא דינמי מ-blocks.js), ולכן בלומדה
// שלא משתמשת בו לא נוסף שום מאזין ושום מפתח ב-localStorage.
//
// שלוש בעיות שהקובץ פותר (כמו store.js של חלק א' ושל הלקוח, שממנו הוא נבנה):
// 1. שדות של אותה יחידה יושבים בשקפים שונים, ורק שקף אחד מוצג בכל רגע.
//    לכן כל שמירה ממזגת לתוך מה שכבר שמור ליחידה, לפי key.
// 2. השרת נקרא רק בכניסה. מכשיר שנשאר מחובר (הבית) מחזיק עותק ישן אם
//    בינתיים כתבו בבית הספר. לכן בכניסה ליחידה מושכים את השורה מהשרת,
//    ולוקחים אותה — אלא אם יש במכשיר הזה שינוי שעוד לא הגיע לשרת.
// 3. שמירה שנכשלה (אין רשת) מסומנת, ונשלחת שוב כשהרשת חוזרת.

import * as Progress from '../progress.js';
import { COURSE_ID } from '../../content/manifest.js';
import { tv } from './phrases.js';

// בתצוגת מורה מפתח נפרד: אחרת התצוגה הייתה מנקה "שינוי שלא הגיע לשרת" של תלמידה אמיתית באותו מכשיר
const UNSYNCED_KEY = `${COURSE_ID || 'lomda'}_open_unsynced${Progress.isPreview() ? '_preview' : ''}_v1`;
const SAVE_DELAY_MS = 800;
const READY_TIMEOUT_MS = 4000;

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}
const plain = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const short = (s, n = 70) => (s.length > n ? `${s.slice(0, n)}…` : s);

// ===== יחידות שיש בהן שינוי שלא הגיע לשרת =====
function readUnsynced() {
  try { return new Set(JSON.parse(localStorage.getItem(UNSYNCED_KEY) || '[]')); } catch (e) { return new Set(); }
}
function markUnsynced(unitId, isUnsynced) {
  const set = readUnsynced();
  if (isUnsynced) set.add(unitId); else set.delete(unitId);
  try { localStorage.setItem(UNSYNCED_KEY, JSON.stringify([...set])); } catch (e) { /* לא קריטי */ }
}

// ===== מאזינים לחיווי השמירה =====
const statusListeners = new Set();
function onSaveStatus(fn) { statusListeners.add(fn); return () => statusListeners.delete(fn); }
function emitStatus(status) { statusListeners.forEach((fn) => { try { fn(status); } catch (e) { /* */ } }); }

// ===== קריאה =====
function currentUnitId() {
  const m = location.hash.match(/^#unit\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function unitAnswers(unitId) {
  const a = Progress.getQuizAnswers(unitId);
  return Array.isArray(a) ? a : [];
}

// קודם מה שהוקלד ועוד לא נשמר (pending), אחר כך מה ששמור במכשיר.
function getValue(unitId, key) {
  const p = pending.get(unitId);
  if (p && p.fields.has(key)) return p.fields.get(key).value;
  const hit = unitAnswers(unitId).find((a) => a.key === key);
  if (!hit) return '';
  return hit.value !== undefined ? hit.value : hit.answer_given;
}

// ===== כתיבה =====
const pending = new Map(); // unitId → { fields: Map(key → entry), timer }

function setValue(unitId, key, label, value, display) {
  let p = pending.get(unitId);
  if (!p) { p = { fields: new Map(), timer: null }; pending.set(unitId, p); }
  p.fields.set(key, { key, label, value, display });
  // לא שומרים בכל הקשה: מחכים להפסקה בכתיבה. ביציאה מהשקף או מהדף
  // flushAll שומר מיד (המנוע כותב למכשיר לפני שהוא פונה לרשת).
  emitStatus('saving');
  clearTimeout(p.timer);
  p.timer = setTimeout(() => flush(unitId), SAVE_DELAY_MS);
}

function toAnswer(entry, i) {
  return {
    question_number: i + 1,
    question_text: entry.label,
    answer_given: entry.display,
    is_correct: null,
    open: true,
    key: entry.key,
    value: entry.value,
  };
}

function merged(unitId, fields) {
  const list = unitAnswers(unitId).map((a) => ({ ...a }));
  fields.forEach((entry) => {
    const idx = list.findIndex((a) => a.key === entry.key);
    if (idx === -1) list.push(toAnswer(entry, list.length));
    else list[idx] = toAnswer(entry, idx);
  });
  return list;
}

async function flush(unitId) {
  const p = pending.get(unitId);
  if (!p) return;
  const list = merged(unitId, p.fields);
  pending.delete(unitId);
  markUnsynced(unitId, true);
  const ok = await Progress.saveQuizAnswers(unitId, list);
  if (ok) markUnsynced(unitId, false);
  emitStatus(ok ? 'saved' : 'offline');
}

function flushAll() {
  [...pending.keys()].forEach((id) => { clearTimeout(pending.get(id).timer); flush(id); });
}

// ===== סנכרון בכניסה ליחידה =====
// מחזיר true אם השורה מהשרת החליפה את מה שהיה במכשיר (ואז מציירים מחדש).
async function ensureFresh(unitId) {
  if (readUnsynced().has(unitId)) {
    // יש כאן שינוי שלא הגיע לשרת — המכשיר הזה הוא העדכני. דוחפים שוב.
    const ok = await Progress.saveQuizAnswers(unitId, unitAnswers(unitId));
    if (ok) markUnsynced(unitId, false);
    return false;
  }
  const remote = await Progress.fetchRemoteQuizAnswers(unitId);
  if (!remote || !Array.isArray(remote.answers)) return false; // אין שורה / אין רשת
  if (JSON.stringify(remote.answers) === JSON.stringify(unitAnswers(unitId))) return false;
  await Progress.saveQuizAnswers(unitId, remote.answers);
  return true;
}

// פעם אחת לכל יחידה, עד 4 שניות. בלי רשת — ממשיכים עם מה שיש במכשיר.
const readyByUnit = new Map();
function ready(unitId) {
  if (!unitId) return Promise.resolve(false);
  if (!readyByUnit.has(unitId)) {
    const timeout = new Promise((r) => setTimeout(() => r(false), READY_TIMEOUT_MS));
    readyByUnit.set(unitId, Promise.race([ensureFresh(unitId).catch(() => false), timeout]));
  }
  return readyByUnit.get(unitId);
}

// כשהרשת חוזרת — שולחים את מה שנשאר תקוע. ביציאה — שומרים מיד.
window.addEventListener('online', () => {
  readUnsynced().forEach(async (id) => {
    const ok = await Progress.saveQuizAnswers(id, unitAnswers(id));
    if (ok) { markUnsynced(id, false); emitStatus('saved'); }
  });
});
window.addEventListener('pagehide', flushAll);
window.addEventListener('hashchange', flushAll);

// ===== תצוגה =====
const STATUS_TEXT = { saving: 'שומר…', saved: '✓ נשמר', offline: '⚠️ נשמר במכשיר בלבד. יישלח כשהרשת תחזור' };

function buildModel(m, key) {
  const model = el('div', 'oa-model');
  model.hidden = true;
  model.appendChild(el('div', 'oa-model-title', '✍️ תשובה לדוגמה'));
  model.appendChild(el('div', 'oa-model-answer', m.answer || ''));
  if (m.rubric && m.rubric.length) {
    model.appendChild(el('div', 'oa-model-title', '✅ מה צריך להופיע בתשובה'));
    const list = el('ul', 'oa-rubric');
    m.rubric.forEach((r, i) => {
      const li = el('li');
      const id = `oa-${key}-${i}`;
      li.innerHTML = `<input type="checkbox" id="${id}"><label for="${id}">${r}</label>`;
      list.appendChild(li);
    });
    model.appendChild(list);
  }
  return model;
}

function build(block, wrap, refreshed) {
  const unitId = currentUnitId();
  const key = block.key;
  const label = block.label || short(plain(block.prompt || key));
  const kind = block.kind || 'text';
  const options = kind === 'tf' ? ['נכון', 'לא נכון'] : (block.options || []);

  const saved = getValue(unitId, key);
  const state = {
    choice: (saved && typeof saved === 'object') ? saved.choice || '' : '',
    text: (saved && typeof saved === 'object') ? saved.text || '' : (typeof saved === 'string' ? saved : ''),
  };
  const isAnswered = () => (kind === 'text' ? state.text.trim() !== '' : state.choice !== '' && state.text.trim() !== '');

  wrap.innerHTML = '';
  if (block.prompt) wrap.appendChild(el('div', 'oa-prompt', block.prompt));
  const controls = [];
  let revealBtn = null;

  const commit = () => {
    const display = kind === 'text' ? state.text : [state.choice || '(לא נבחר)', state.text].filter(Boolean).join(' — ');
    setValue(unitId, key, label, kind === 'text' ? state.text : { ...state }, display);
    if (revealBtn) revealBtn.disabled = !isAnswered();
  };

  if (kind !== 'text') {
    const row = el('div', 'oa-choices');
    row.setAttribute('role', 'radiogroup');
    options.forEach((opt) => {
      const b = el('button', 'oa-choice', opt);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(state.choice === opt));
      b.addEventListener('click', () => {
        state.choice = opt;
        row.querySelectorAll('.oa-choice').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
        commit();
      });
      row.appendChild(b);
      controls.push(b);
    });
    wrap.appendChild(row);
    wrap.appendChild(el('div', 'oa-why-label', 'נימוק:'));
  }

  const ta = el('textarea', 'input-field oa-textarea');
  ta.rows = block.rows || (kind === 'text' ? 4 : 3);
  ta.placeholder = block.placeholder || (kind === 'text' ? tv('oa_placeholder') : '');
  ta.setAttribute('aria-label', kind === 'text' ? 'תשובה' : 'נימוק');
  ta.value = state.text;
  ta.addEventListener('input', () => { state.text = ta.value; commit(); });
  wrap.appendChild(ta);
  controls.push(ta);

  const status = el('div', 'oa-status');
  status.setAttribute('aria-live', 'polite');
  wrap.appendChild(status);
  const off = onSaveStatus((s) => {
    if (!wrap.isConnected) { off(); return; }
    status.textContent = STATUS_TEXT[s] || '';
    status.dataset.state = s;
  });

  if (block.model) {
    const model = buildModel(block.model, key);
    revealBtn = el('button', 'btn btn-secondary oa-reveal-btn', block.revealLabel || tv('oa_reveal_btn'));
    revealBtn.type = 'button';
    revealBtn.disabled = !isAnswered();
    revealBtn.title = 'נפתח אחרי שכותבים תשובה';
    revealBtn.addEventListener('click', () => {
      flushAll();
      model.hidden = false;
      revealBtn.remove();
    });
    wrap.appendChild(revealBtn);
    wrap.appendChild(model);
  }

  // עד שהשורה מהשרת מגיעה, השדה נעול — כדי לא לכתוב מעל מה שנכתב במכשיר אחר.
  controls.forEach((c) => { c.disabled = true; });
  wrap.classList.add('oa-loading');
  ready(unitId).then((changed) => {
    // ready() שמור לכל יחידה, ולכן changed נשאר true. מציירים מחדש פעם אחת בלבד.
    if (changed && wrap.isConnected && !refreshed) { off(); build(block, wrap, true); return; }
    controls.forEach((c) => { c.disabled = false; });
    wrap.classList.remove('oa-loading');
  });
}

export function renderOpenAnswer(block, wrap) {
  build(block, wrap, false);
}
