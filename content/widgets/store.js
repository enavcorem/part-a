// ===== שמירת התשובות הפתוחות של לומדת חלק א' =====
// הועתק מלומדת הלקוח (client-learning), עם מפתח משלו. שייך לקורס, לא למנוע.
// כל יחידה שומרת את כל השדות שלה כשורת quiz_answers
// אחת (דרך Progress.saveQuizAnswers), וכל שדה מסומן open: true — כך לוח
// המורה מציג אותו כטקסט מלא ולא כשאלה עם ציון.
//
// שלוש בעיות שהקובץ הזה פותר:
// 1. שדות של אותה יחידה יושבים בסליידים שונים, ורק סלייד אחד מוצג בכל רגע.
//    לכן כל שמירה ממזגת לתוך מה שכבר שמור ליחידה, לפי key.
// 2. השרת נקרא רק בכניסה. מכשיר שנשאר מחובר (הבית) מחזיק עותק ישן אם
//    בינתיים כתבו בבית הספר. לכן בכניסה ליחידה מושכים את השורה מהשרת,
//    ולוקחים אותה — אלא אם יש במכשיר הזה שינוי שעוד לא הגיע לשרת.
// 3. שמירה שנכשלה (אין רשת) מסומנת, ונשלחת שוב כשהרשת חוזרת.

import * as Progress from '../../js/progress.js';
import { getFlatUnits } from '../manifest.js';

const UNSYNCED_KEY = 'parta_unsynced_v1';
const SAVE_DELAY_MS = 800;

// ===== יחידות שיש בהן שינוי שלא הגיע לשרת =====
function readUnsynced() {
  try { return new Set(JSON.parse(localStorage.getItem(UNSYNCED_KEY) || '[]')); } catch (e) { return new Set(); }
}
function writeUnsynced(set) {
  try { localStorage.setItem(UNSYNCED_KEY, JSON.stringify([...set])); } catch (e) { /* לא קריטי */ }
}
function markUnsynced(unitId, isUnsynced) {
  const set = readUnsynced();
  if (isUnsynced) set.add(unitId); else set.delete(unitId);
  writeUnsynced(set);
}

// ===== מאזינים לחיווי השמירה =====
const statusListeners = new Set();
export function onSaveStatus(fn) { statusListeners.add(fn); return () => statusListeners.delete(fn); }
function emitStatus(status) { statusListeners.forEach((fn) => { try { fn(status); } catch (e) { /* */ } }); }

// ===== קריאה =====
export function currentUnitId() {
  const m = (typeof location !== 'undefined' ? location.hash : '').match(/^#unit\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function unitAnswers(unitId) {
  const a = Progress.getQuizAnswers(unitId);
  return Array.isArray(a) ? a : [];
}

// הערך של שדה לפי key, מכל יחידה בקורס. ה-key ייחודי בכל הלומדה.
// קודם מה שהוקלד ועוד לא נשמר (pending), אחר כך מה ששמור במכשיר.
export function getValue(key) {
  for (const p of pending.values()) {
    if (p.fields.has(key)) return p.fields.get(key).value;
  }
  for (const u of getFlatUnits()) {
    const hit = unitAnswers(u.id).find((a) => a.key === key);
    if (hit) return hit.value !== undefined ? hit.value : hit.answer_given;
  }
  return '';
}

// ===== כתיבה =====
const pending = new Map(); // unitId → { fields: Map(key → entry), timer }

export function setValue(unitId, key, label, value, display) {
  let p = pending.get(unitId);
  if (!p) { p = { fields: new Map(), timer: null }; pending.set(unitId, p); }
  p.fields.set(key, { key, label, value, display });
  // לא שומרים בכל הקשה: מחכים להפסקה בכתיבה. בינתיים getValue קורא מ-pending,
  // וביציאה מהדף flushAll כותב למכשיר באופן סינכרוני (המנוע שומר מקומית
  // לפני שהוא פונה לרשת).
  emitStatus('saving');
  clearTimeout(p.timer);
  p.timer = setTimeout(() => flush(unitId), SAVE_DELAY_MS);
}

function toAnswer(entry, i) {
  const display = entry.display !== undefined ? entry.display
    : Array.isArray(entry.value) ? entry.value.join(' · ') : String(entry.value ?? '');
  return {
    question_number: i + 1,
    question_text: entry.label,
    answer_given: display,
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

// לפני יציאה מסלייד או מהדף — לא מחכים ל-800ms.
export function flushAll() {
  [...pending.keys()].forEach((id) => { clearTimeout(pending.get(id).timer); flush(id); });
}

// ===== סנכרון בכניסה ליחידה =====
const freshChecked = new Set();

export async function ensureFresh(unitIds) {
  const todo = unitIds.filter((id) => !freshChecked.has(id));
  if (!todo.length) return false;
  todo.forEach((id) => freshChecked.add(id));
  const unsynced = readUnsynced();
  let changed = false;
  await Promise.all(todo.map(async (id) => {
    if (unsynced.has(id)) {
      // יש כאן שינוי שלא הגיע לשרת — המכשיר הזה הוא העדכני. דוחפים שוב.
      const ok = await Progress.saveQuizAnswers(id, unitAnswers(id));
      if (ok) markUnsynced(id, false);
      return;
    }
    const remote = await Progress.fetchRemoteQuizAnswers(id);
    if (!remote || !Array.isArray(remote.answers)) return; // אין שורה / אין רשת
    if (JSON.stringify(remote.answers) !== JSON.stringify(unitAnswers(id))) {
      await Progress.saveQuizAnswers(id, remote.answers);
      changed = true;
    }
  }));
  return changed;
}

// כשהרשת חוזרת — שולחים את מה שנשאר תקוע.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    readUnsynced().forEach(async (id) => {
      const ok = await Progress.saveQuizAnswers(id, unitAnswers(id));
      if (ok) { markUnsynced(id, false); emitStatus('saved'); }
    });
  });
  window.addEventListener('pagehide', flushAll);
  window.addEventListener('hashchange', flushAll);
}
