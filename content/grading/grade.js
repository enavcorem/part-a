// ===== דף בדיקה למיני-בגרות 25.11 =====
// המורה בוחרת כיתה, ועוברת סעיף אחרי סעיף: התשובות של כל התלמידות לאותו
// סעיף, ולכל אחת ציון והערה. בלשונית "סיכום" יש ציון כולל, הערה כללית,
// החזרה לתלמידות וייצוא לאקסל.
//
// איפה זה נשמר: בטבלה quiz_answers, בשורה נפרדת לכל תלמידה, עם unit_id
// 'pa-ch3-u3-fb' (FB_UNIT). לא באותה שורה של התשובות: מכשיר של תלמידה שיש
// בו שינוי שלא הגיע לשרת דוחף את כל השורה שלו, והיה מוחק את ההערות. את
// השורה הזו רק הדף הזה כותב. בלי מיגרציה. כל רשומה בה open: true, ולכן גם
// לוח המורה מציג אותה כטקסט.
// התלמידה רואה את הציונים ביחידת המבחן (exam.js) רק אחרי "החזרה" (_released).
//
// ⚠️ כניסה עם גוגל (2ג): כשה-RLS ייסגר, הקריאה מ-quiz_answers והכתיבה אליה
// מכאן יפסיקו לעבוד, וצריך פונקציה במסד (RPC) שבודקת את המורה.
// הכניסה: הטוקן שלוח המורה שומר בלשונית (sessionStorage). בלי כניסה ללוח
// באותה לשונית, הדף מפנה אליו.

import { supabaseClient } from '../../js/supabase-config.js';
import { decodeExam, normalizeCode } from '../widgets/exam-codec.js';
import { PAYLOAD } from '../ch3/ch3-u3-exam-data.js';

const EXAM_UNIT = 'pa-ch3-u3';
const FB_UNIT = 'pa-ch3-u3-fb'; // גם ב-exam.js
const EXAM_KEY = 'pa-exam25';
const CODE_KEY = `parta_exam_code_${EXAM_KEY}`;
const KEY_TEACHER_SESSION = 'lomda_teacher_session';
const SAVE_DELAY_MS = 800;

const $ = (id) => document.getElementById(id);
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
const pad = (n) => String(n).padStart(2, '0');
const when = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const plain = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const store = {
  get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* */ } },
};

// ===== מצב =====
let session = null;     // { login, token, teacher }
let exam = null;        // המבחן המפוענח
let items = [];         // [{ id, points, short, text, qTitle }]
let classes = [];
let enrollments = [];
let studentsById = {};
let examRows = {};      // student_id → { answers, submitted_at }
let fbByStudent = {};   // student_id → { items: { id: { score, note } }, general, released }
let current = { classId: '', view: 'item', itemIdx: 0 };

// ===== כניסה =====
async function resume() {
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(KEY_TEACHER_SESSION) || 'null'); } catch (e) { /* */ }
  if (!saved || !saved.login || !saved.token) return null;
  const { data, error } = await supabaseClient.rpc('teacher_login', { p_login: saved.login, p_password: saved.token });
  if (error || !data) return null;
  return { login: saved.login, token: saved.token, teacher: data };
}

function needLogin() {
  const box = el('div', 'card gr-card');
  box.appendChild(el('p', '', 'כדי לבדוק, צריך להיכנס קודם ללוח המורה של הלומדה, באותה לשונית. אחרי הכניסה חוזרים לכאן.'));
  const a = el('a', 'btn btn-primary', 'ללוח המורה ←');
  a.href = '../../teacher/';
  box.appendChild(a);
  $('gr-app').replaceChildren(box);
}

// ===== קוד המבחן: בלעדיו אין את נוסח השאלות =====
function askCode() {
  const box = el('form', 'card gr-card');
  box.appendChild(el('p', '', 'הקלידו את קוד המבחן (אותו קוד שכתבתם על הלוח). הוא נשמר במחשב הזה.'));
  const input = el('input', 'input-field gr-code');
  input.inputMode = 'numeric';
  input.setAttribute('aria-label', 'קוד המבחן');
  const go = el('button', 'btn btn-primary', 'המשך');
  go.type = 'submit';
  const err = el('div', 'gr-err');
  box.append(input, go, err);
  box.addEventListener('submit', (e) => {
    e.preventDefault();
    if (openExam(input.value)) start();
    else err.textContent = 'הקוד לא נכון.';
  });
  $('gr-app').replaceChildren(box);
  input.focus();
}

function openExam(code) {
  const data = decodeExam(PAYLOAD, code);
  if (!data) return false;
  store.set(CODE_KEY, normalizeCode(code));
  exam = data;
  items = [];
  data.questions.forEach((q, qi) => q.parts.forEach((p) => p.items.forEach((it) => {
    items.push({
      id: it.id,
      points: it.points || 0,
      short: `${qi + 1}${p.label}${it.label ? ` ${it.label}` : ''}`,
      title: `${q.title} · ${p.label}${it.label ? ` ${it.label}` : ''}`,
      // בטענה מספיק הטענה עצמה. ההוראה של נכון/לא נכון חוזרת בכל טענה
      text: it.claim ? `טענה: ${plain(it.claim)}` : [plain(p.instruction), plain(it.prompt)].filter(Boolean).join(' '),
      options: it.kind === 'tf' ? ['נכון', 'לא נכון'] : it.options,
    });
  })));
  return true;
}

// ===== טעינה =====
async function fetchUnit(unitId) {
  const all = [];
  for (;;) {
    const { data, error } = await supabaseClient.from('quiz_answers').select('*')
      .eq('unit_id', unitId).order('id').range(all.length, all.length + 999);
    if (error) throw error;
    if (!data.length) return all;
    all.push(...data);
  }
}

async function load() {
  flash('טוען…');
  const [cls, enr, stu, rows, fbs] = await Promise.all([
    supabaseClient.rpc('teacher_classes', { p_login: session.login, p_password: session.token }),
    supabaseClient.from('enrollments').select('*').order('student_id').order('class_id'),
    supabaseClient.from('students').select('*').order('name').order('id'),
    fetchUnit(EXAM_UNIT),
    fetchUnit(FB_UNIT),
  ]);
  if (cls.error || !cls.data) throw cls.error || new Error('הכניסה פגה');
  classes = cls.data.filter((c) => !c.archived);
  enrollments = enr.data || [];
  studentsById = Object.fromEntries((stu.data || []).map((s) => [s.id, s]));
  examRows = Object.fromEntries(rows.map((r) => [r.student_id, r]));
  fbByStudent = Object.fromEntries(fbs.map((r) => [r.student_id, fromRow(r.answers)]));
  flash('');
}

// ===== השורה של ההערות: מהמסד ובחזרה =====
function fromRow(answers) {
  const fb = { items: {}, general: '', released: false };
  (answers || []).forEach((a) => {
    if (a.key === '_general') fb.general = (a.value && a.value.note) || '';
    else if (a.key === '_released') fb.released = a.value === true;
    else if (a.key && a.key[0] !== '_') fb.items[a.key] = { score: a.value && a.value.score, note: (a.value && a.value.note) || '' };
  });
  return fb;
}

function toRow(fb) {
  const list = [];
  const push = (key, label, value, display) => list.push({
    question_number: list.length + 1, question_text: label, answer_given: display,
    is_correct: null, open: true, key, value,
  });
  items.forEach((it) => {
    const g = fb.items[it.id];
    if (!g || (g.score === null || g.score === undefined) && !g.note) return;
    const score = g.score === null || g.score === undefined ? '—' : g.score;
    push(it.id, `ציון · ${it.title}`, { score: g.score, note: g.note }, `${score}/${it.points}${g.note ? ` · ${g.note}` : ''}`);
  });
  const t = total(fb);
  push('_total', 'ציון כולל', { score: t.score, graded: t.graded }, `${t.score}/100${t.graded < items.length ? ` (נבדקו ${t.graded} מתוך ${items.length})` : ''}`);
  if (fb.general) push('_general', 'הערה כללית', { note: fb.general }, fb.general);
  push('_released', 'הוחזר לתלמידה', fb.released, fb.released ? 'כן' : 'לא');
  return list;
}

function total(fb) {
  let score = 0, graded = 0;
  items.forEach((it) => {
    const g = fb && fb.items[it.id];
    if (g && typeof g.score === 'number') { score += g.score; graded++; }
  });
  return { score, graded };
}

const fbOf = (sid) => (fbByStudent[sid] = fbByStudent[sid] || { items: {}, general: '', released: false });

// ===== שמירה: לכל תלמידה בנפרד, אחרי הפסקה בהקלדה =====
const timers = new Map();
function scheduleSave(sid) {
  saveStatus('saving');
  clearTimeout(timers.get(sid));
  timers.set(sid, setTimeout(() => save(sid), SAVE_DELAY_MS));
}
async function save(sid) {
  timers.delete(sid);
  const { error } = await supabaseClient.from('quiz_answers').upsert({
    student_id: sid, unit_id: FB_UNIT, answers: toRow(fbOf(sid)), submitted_at: new Date().toISOString(),
  }, { onConflict: 'student_id,unit_id' });
  if (error) { console.warn('שמירת ההערות נכשלה:', error); saveStatus('error'); return; }
  if (!timers.size) saveStatus('saved');
}
function flushAll() { [...timers.keys()].forEach((sid) => { clearTimeout(timers.get(sid)); save(sid); }); }
window.addEventListener('pagehide', flushAll);
window.addEventListener('beforeunload', (e) => { if (timers.size) { flushAll(); e.preventDefault(); } });

function saveStatus(s) {
  const t = { saving: 'שומרת…', saved: '✓ נשמר', error: '⚠️ לא נשמר. בדקו חיבור, ושנו משהו כדי לנסות שוב' };
  $('gr-save').textContent = t[s] || '';
  $('gr-save').dataset.state = s;
}
function flash(text) { $('gr-msg').textContent = text; }

// ===== מי בכיתה =====
function studentsOfClass(classId) {
  return enrollments.filter((e) => e.class_id === classId)
    .map((e) => studentsById[e.student_id]).filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

function answerOf(sid, itemId) {
  const row = examRows[sid];
  if (!row) return null;
  const hit = (row.answers || []).find((a) => a.key === `${EXAM_KEY}-${itemId}`);
  if (!hit) return null;
  const v = hit.value !== undefined ? hit.value : hit.answer_given;
  return typeof v === 'object' && v ? { choice: v.choice || '', text: v.text || '' } : { choice: '', text: String(v || '') };
}
function metaOf(sid, suffix) {
  const row = examRows[sid];
  const hit = row && (row.answers || []).find((a) => a.key === `${EXAM_KEY}-${suffix}`);
  return hit ? hit.value : '';
}
function statusOf(sid) {
  const sub = metaOf(sid, 'submitted');
  if (sub) return `✓ הוגש ${when(sub)}`;
  if (metaOf(sid, 'started')) return `⏳ התחילה ${when(metaOf(sid, 'started'))}, לא הגישה`;
  return '— לא התחילה';
}

// ===== תצוגה =====
function render() {
  const app = $('gr-app');
  app.replaceChildren();

  const bar = el('div', 'gr-bar');
  const sel = el('select', 'input-field gr-class');
  sel.setAttribute('aria-label', 'כיתה');
  sel.appendChild(new Option('בחרו כיתה…', ''));
  classes.forEach((c) => sel.appendChild(new Option(`${c.label}${c.school_year ? ` · ${c.school_year}` : ''}`, c.id)));
  sel.value = current.classId;
  sel.addEventListener('change', () => { current.classId = sel.value; render(); });
  bar.appendChild(sel);
  if (current.classId) {
    [['item', '📝 לפי סעיף'], ['summary', '📊 סיכום, החזרה ואקסל']].forEach(([v, label]) => {
      const b = el('button', `btn ${current.view === v ? 'btn-primary' : 'btn-secondary'}`, label);
      b.type = 'button';
      b.addEventListener('click', () => { current.view = v; render(); });
      bar.appendChild(b);
    });
  }
  app.appendChild(bar);
  if (!current.classId) return;

  const list = studentsOfClass(current.classId);
  if (!list.length) { app.appendChild(el('p', 'muted', 'אין תלמידות רשומות בכיתה הזו.')); return; }
  app.appendChild(current.view === 'item' ? renderItemView(list) : renderSummary(list));
}

function renderItemView(list) {
  const wrap = el('div');
  const nav = el('nav', 'gr-items');
  nav.setAttribute('aria-label', 'סעיפים');
  items.forEach((it, i) => {
    const done = list.filter((s) => examRows[s.id] && typeof (fbOf(s.id).items[it.id] || {}).score === 'number').length;
    const withAns = list.filter((s) => examRows[s.id]).length;
    const b = el('button', `gr-item-btn${i === current.itemIdx ? ' is-active' : ''}${withAns && done === withAns ? ' is-done' : ''}`, it.short);
    b.type = 'button';
    b.title = `נבדקו ${done} מתוך ${withAns}`;
    b.addEventListener('click', () => { flushAll(); current.itemIdx = i; render(); });
    nav.appendChild(b);
  });
  wrap.appendChild(nav);

  const it = items[current.itemIdx];
  const head = el('div', 'card gr-card gr-item-head');
  head.appendChild(el('h2', '', `${it.title} (${it.points} נקודות)`));
  head.appendChild(el('p', '', it.text));
  head.appendChild(el('p', 'muted', 'התשובה לדוגמה והניקוד לכל רכיב: בקובץ "פתרון ומחוון - מיני-בגרות 25.11".'));
  wrap.appendChild(head);

  list.forEach((s) => {
    const card = el('div', 'card gr-card gr-student');
    const top = el('div', 'gr-student-top');
    top.appendChild(el('strong', '', s.name));
    top.appendChild(el('span', 'muted', statusOf(s.id)));
    card.appendChild(top);
    const ans = answerOf(s.id, it.id);
    const box = el('div', 'gr-answer');
    if (!ans || (!ans.choice && !ans.text.trim())) box.appendChild(el('span', 'muted', 'לא ענתה'));
    else {
      if (ans.choice) box.appendChild(el('div', 'gr-choice', ans.choice));
      if (ans.text) box.appendChild(el('div', 'gr-text', ans.text));
    }
    card.appendChild(box);

    if (examRows[s.id]) {
      const g = fbOf(s.id).items[it.id] || {};
      const row = el('div', 'gr-grade');
      const lab = el('label', 'gr-score-label', 'ציון ');
      const score = el('input', 'input-field gr-score');
      score.type = 'number'; score.min = '0'; score.max = String(it.points); score.step = '0.5';
      score.value = typeof g.score === 'number' ? String(g.score) : '';
      lab.append(score, document.createTextNode(` / ${it.points}`));
      const note = el('textarea', 'input-field gr-note');
      note.rows = 2;
      note.placeholder = 'הערה לתלמידה (רשות)';
      note.setAttribute('aria-label', `הערה ל${s.name}`);
      note.value = g.note || '';
      const update = () => {
        const fb = fbOf(s.id);
        let v = score.value === '' ? null : Number(score.value);
        if (v !== null && (Number.isNaN(v) || v < 0 || v > it.points)) { score.classList.add('is-bad'); return; }
        score.classList.remove('is-bad');
        fb.items[it.id] = { score: v, note: note.value };
        scheduleSave(s.id);
      };
      score.addEventListener('input', update);
      note.addEventListener('input', update);
      row.append(lab, note);
      card.appendChild(row);
    }
    wrap.appendChild(card);
  });

  if (current.itemIdx < items.length - 1) {
    const next = el('button', 'btn btn-primary', `לסעיף הבא (${items[current.itemIdx + 1].short}) ←`);
    next.type = 'button';
    next.addEventListener('click', () => { flushAll(); current.itemIdx++; render(); window.scrollTo(0, 0); });
    wrap.appendChild(next);
  }
  return wrap;
}

function renderSummary(list) {
  const wrap = el('div');
  const tools = el('div', 'gr-bar');
  const exp = el('button', 'btn btn-secondary', '⬇️ הורדה לאקסל');
  exp.type = 'button';
  exp.addEventListener('click', () => exportCsv(list));
  const rel = el('button', 'btn btn-primary', '📨 להחזיר לכל מי שנבדקה עד הסוף');
  rel.type = 'button';
  rel.addEventListener('click', () => {
    const ready = list.filter((s) => examRows[s.id] && total(fbOf(s.id)).graded === items.length && !fbOf(s.id).released);
    if (!ready.length) { flash('אין תלמידות שנבדקו בכל הסעיפים ועוד לא קיבלו את הציון.'); return; }
    if (!window.confirm(`להחזיר ל-${ready.length} תלמידות? הן יראו ביחידת המבחן את הציון ואת ההערות.`)) return;
    ready.forEach((s) => { fbOf(s.id).released = true; scheduleSave(s.id); });
    flash(`הוחזר ל-${ready.length} תלמידות.`);
    render();
  });
  tools.append(exp, rel);
  wrap.appendChild(tools);

  const scroller = el('div', 'gr-table-wrap');
  const table = el('table', 'gr-table');
  const thead = el('thead');
  const hr = el('tr');
  ['שם', 'מצב', ...items.map((it) => `${it.short} (${it.points})`), 'סה"כ', 'הערה כללית', 'הוחזר'].forEach((h) => hr.appendChild(el('th', '', h)));
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = el('tbody');
  list.forEach((s) => {
    const fb = fbOf(s.id);
    const tr = el('tr');
    tr.appendChild(el('td', '', s.name));
    tr.appendChild(el('td', 'muted', statusOf(s.id)));
    items.forEach((it) => {
      const g = fb.items[it.id];
      tr.appendChild(el('td', 'gr-num', g && typeof g.score === 'number' ? String(g.score) : '—'));
    });
    const t = total(fb);
    tr.appendChild(el('td', 'gr-num gr-total', examRows[s.id] ? `${t.score}${t.graded < items.length ? ` (${t.graded}/${items.length})` : ''}` : '—'));
    const gtd = el('td');
    if (examRows[s.id]) {
      const g = el('textarea', 'input-field gr-note');
      g.rows = 2;
      g.setAttribute('aria-label', `הערה כללית ל${s.name}`);
      g.value = fb.general;
      g.addEventListener('input', () => { fb.general = g.value; scheduleSave(s.id); });
      gtd.appendChild(g);
    }
    tr.appendChild(gtd);
    const rtd = el('td');
    if (examRows[s.id]) {
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = fb.released;
      cb.setAttribute('aria-label', `הוחזר ל${s.name}`);
      cb.addEventListener('change', () => { fb.released = cb.checked; scheduleSave(s.id); });
      rtd.appendChild(cb);
    }
    tr.appendChild(rtd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  scroller.appendChild(table);
  wrap.appendChild(scroller);
  wrap.appendChild(el('p', 'muted', 'תלמידה רואה את הציון וההערות ביחידת המבחן רק כשמסומן "הוחזר". אפשר לבטל את הסימון.'));
  return wrap;
}

// ===== אקסל: CSV עם BOM, כדי שהעברית תיפתח נכון =====
function exportCsv(list) {
  const cls = classes.find((c) => c.id === current.classId);
  const head = ['שם', 'התחלה', 'הגשה'];
  items.forEach((it) => head.push(`${it.short} תשובה`, `${it.short} ציון (${it.points})`, `${it.short} הערה`));
  head.push('סה"כ', 'נבדקו', 'הערה כללית', 'הוחזר');
  const rows = [head];
  list.forEach((s) => {
    const fb = fbOf(s.id);
    const r = [s.name, when(metaOf(s.id, 'started')), when(metaOf(s.id, 'submitted'))];
    items.forEach((it) => {
      const a = answerOf(s.id, it.id);
      const g = fb.items[it.id] || {};
      r.push(a ? [a.choice, a.text].filter(Boolean).join(' — ') : '', typeof g.score === 'number' ? g.score : '', g.note || '');
    });
    const t = total(fb);
    r.push(examRows[s.id] ? t.score : '', `${t.graded}/${items.length}`, fb.general, fb.released ? 'כן' : 'לא');
    rows.push(r);
  });
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = el('a');
  a.href = URL.createObjectURL(blob);
  a.download = `מיני-בגרות 25.11 - ${cls ? cls.label : 'כיתה'}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ===== התחלה =====
async function start() {
  try { await load(); } catch (e) {
    console.warn(e);
    flash('לא הצלחנו לטעון. ייתכן שהכניסה ללוח פגה: היכנסו שוב ללוח המורה, וחזרו לכאן.');
    return;
  }
  if (classes.length === 1) current.classId = classes[0].id;
  render();
}

(async function init() {
  session = await resume();
  if (!session) { needLogin(); return; }
  $('gr-who').textContent = session.teacher.name || '';
  if (!openExam(store.get(CODE_KEY))) { askCode(); return; }
  start();
})();
