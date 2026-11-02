// ===== "👥 תלמידים ושמות משתמש" — חלון לכיתה אחת בלוח המורה =====
// מצב הכניסה של הכיתה (מיגרציה 03):
//   'pick'     — התלמידות בוחרות שם מהרשימה, או "אני חדשה" (כמו תמיד)
//   'username' — המורה מוסיפה את התלמידים כאן ונותנת לכל אחד שם משתמש,
//                והם מקלידים אותו. אין רשימה ואין "חדש".
// הוספה בשלושה צעדים: מדביקים שמות → המערכת מציעה שמות משתמש לפי מוסכמה
// (אפשר לערוך) → שמירה. ואחר כך: אקסל, פתקים להדפסה, הודעה להעתקה.
// המייל (רשות) נשמר לקראת כניסת גוגל: מי שיתחבר במייל הזה יקושר לתלמיד.

import { COURSE, COURSE_ID } from '../content/manifest.js';

let ctx = null;   // { teacherRpc, escapeHtml, onChange }
let cls = null;   // הכיתה מ-teacher_classes
let rows = [];    // מ-teacher_class_logins
let preview = []; // [{ name, email, username }] לפני שמירה

const $ = (id) => document.getElementById(id);

function esc(s) { return ctx.escapeHtml(s); }

function studentLink() {
  return new URL('../?code=' + cls.join_code, location.href).href;
}

// "גבעול 1" = "גבעול1" = "givol1" — בדיוק כמו lomda_username_norm במסד
function normUser(s) { return String(s || '').replace(/\s/g, '').toLowerCase(); }

export async function showRosterPanel(theClass, context) {
  ctx = context;
  cls = theClass;
  preview = [];
  const panel = $('form-panel');
  panel.style.display = 'block';
  panel.innerHTML = '<div class="empty-state">טוענת… ⏳</div>';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  await reload();
}

async function reload() {
  const { data, error } = await ctx.teacherRpc('teacher_class_logins', { p_class_id: cls.id });
  if (error || !data) {
    $('form-panel').innerHTML = `<p class="err">לא הצלחנו לטעון את התלמידים. כדאי לרענן את הדף ולנסות שוב.</p>
      <button type="button" class="btn btn-ghost" id="rp-close">סגירה</button>`;
    $('rp-close').addEventListener('click', close);
    return;
  }
  rows = data;
  render();
}

function close() {
  $('form-panel').style.display = 'none';
  $('form-panel').innerHTML = '';
}

function render() {
  const isUser = cls.login_mode === 'username';
  const isOpen = (cls.open_courses || []).includes(COURSE_ID);
  const missing = rows.filter((r) => !r.username).length;
  const panel = $('form-panel');
  panel.innerHTML = `
    <div class="rp-head">
      <h2>👥 ${esc(cls.label)} · קוד <span dir="ltr">${esc(cls.join_code)}</span></h2>
      <button type="button" class="btn btn-ghost" id="rp-close">סגירה</button>
    </div>

    <fieldset class="rp-mode">
      <legend>איך נכנסים לכיתה?</legend>
      <label><input type="radio" name="rp-mode" value="pick" ${isUser ? '' : 'checked'}>
        <strong>בחירה מרשימה</strong> <span class="muted">— בוחרים שם מהרשימה, או מוסיפים את עצמם</span></label>
      <label><input type="radio" name="rp-mode" value="username" ${isUser ? 'checked' : ''}>
        <strong>שם משתמש מהמורה</strong> <span class="muted">— מקלידים שם משתמש שנתתי. אין רשימה ואין "חדש"</span></label>
    </fieldset>
    ${isUser && missing ? `<p class="rp-warn">⚠️ ${missing} בלי שם משתמש, ולכן לא יוכלו להיכנס. אפשר לתת להם עם ✏️ בטבלה.</p>` : ''}

    ${COURSE.openChapters === true ? '' : `
    <fieldset class="rp-mode">
      <legend>הפרקים בלומדה "${esc(COURSE.title)}"</legend>
      <label><input type="radio" name="rp-open" value="0" ${isOpen ? '' : 'checked'}>
        <strong>🔒 לפי הסדר</strong> <span class="muted">— פרק נפתח אחרי שמסיימים את הקודם, או עוברים את אתגר הפטור</span></label>
      <label><input type="radio" name="rp-open" value="1" ${isOpen ? 'checked' : ''}>
        <strong>🔓 הכול פתוח (לחזרה)</strong> <span class="muted">— כל הפרקים פתוחים לכיתה הזו, למשל לפני מבחן. בלומדות האחרות לא משתנה כלום</span></label>
    </fieldset>`}

    ${rows.length ? `
    <div class="rp-tools">
      <button type="button" class="btn btn-ghost" id="rp-csv">⬇️ אקסל</button>
      ${isUser ? `<button type="button" class="btn btn-ghost" id="rp-print">🖨️ פתקים להדפסה</button>
      <button type="button" class="btn btn-ghost" id="rp-msg">📋 הודעה להעתקה</button>` : ''}
    </div>
    <div class="rp-table-wrap"><table class="rp-table">
      <thead><tr><th>שם</th><th>שם משתמש</th><th>מייל (רשות)</th><th>כניסה אחרונה</th><th></th></tr></thead>
      <tbody>${rows.map((r, i) => `
        <tr data-i="${i}">
          <td>${esc(r.name)}</td>
          <td dir="auto">${r.username ? esc(r.username) : '<span class="muted">—</span>'}</td>
          <td dir="ltr">${esc(r.email || '')}</td>
          <td class="muted">${r.last_seen ? new Date(r.last_seen).toLocaleDateString('he-IL') : 'עוד לא'}</td>
          <td class="rp-actions">
            <button type="button" class="link-btn rp-edit" title="עריכה">✏️</button>
            <button type="button" class="link-btn rp-remove" title="הוצאה מהכיתה">🗑️</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>` : '<p class="muted">עוד אין תלמידים בכיתה.</p>'}

    <details class="rp-add" ${rows.length ? '' : 'open'}>
      <summary>➕ הוספת תלמידים</summary>
      <p class="muted">1. מדביקים שמות, <strong>שם בכל שורה</strong>. אפשר להעתיק עמודה מאקסל או מרשימת הקלאסרום.
        אם יש מייל, כותבים אותו באותה שורה אחרי פסיק (רשות, לקראת כניסה עם גוגל).</p>
      <textarea id="rp-names" class="input-field" rows="6" placeholder="דני כהן&#10;יוסי לוי, yossi@gmail.com"></textarea>
      <div class="rp-convention">
        <span>2. שמות משתמש לפי:</span>
        <select id="rp-pattern" class="input-field">
          <option value="num">תחילית + מספר (גבעול1, גבעול2…)</option>
          <option value="first">שם פרטי + אות משם המשפחה (דניכ)</option>
        </select>
        <input id="rp-prefix" class="input-field" maxlength="20" placeholder="תחילית" value="${esc(defaultPrefix())}">
        <button type="button" class="btn btn-ghost" id="rp-suggest">הצעה</button>
      </div>
      <div id="rp-preview"></div>
    </details>
    <div class="err" id="rp-err"></div>`;

  $('rp-close').addEventListener('click', close);
  panel.querySelectorAll('input[name=rp-mode]').forEach((r) => r.addEventListener('change', () => setMode(r.value)));
  panel.querySelectorAll('input[name=rp-open]').forEach((r) => r.addEventListener('change', () => setCourseOpen(r.value === '1')));
  $('rp-pattern').addEventListener('change', () => { $('rp-prefix').style.display = $('rp-pattern').value === 'num' ? '' : 'none'; });
  $('rp-suggest').addEventListener('click', suggest);
  if (rows.length) {
    $('rp-csv').addEventListener('click', exportCsv);
    if (isUser) {
      $('rp-print').addEventListener('click', printSlips);
      $('rp-msg').addEventListener('click', copyMessage);
    }
    panel.querySelectorAll('.rp-edit').forEach((b) => b.addEventListener('click', () => editRow(+b.closest('tr').dataset.i)));
    panel.querySelectorAll('.rp-remove').forEach((b) => b.addEventListener('click', () => removeRow(+b.closest('tr').dataset.i)));
  }
  renderPreview();
}

// המילה הראשונה בשם הכיתה: "גבעול י״א" → "גבעול"
function defaultPrefix() {
  return (cls.label || '').split(/\s+/)[0].replace(/[^\p{L}\p{N}]/gu, '') || 'כיתה';
}

async function setMode(mode) {
  const missing = rows.filter((r) => !r.username).length;
  if (mode === 'username' && missing &&
      !window.confirm(`${missing} מהרשומים בכיתה עוד בלי שם משתמש. אחרי המעבר הם לא יוכלו להיכנס עד שתתני להם (✏️ בטבלה).\nלעבור?`)) { render(); return; }
  if (mode === 'pick' &&
      !window.confirm('במצב "בחירה מרשימה" כל אחד יכול לבחור כל שם מהרשימה, או להוסיף שם חדש בעצמו.\nלעבור?')) { render(); return; }
  const { data } = await ctx.teacherRpc('teacher_set_login_mode', { p_class_id: cls.id, p_mode: mode });
  if (!data) { render(); $('rp-err').textContent = 'לא הצלחנו לשנות. כדאי לרענן את הדף ולנסות שוב'; return; }
  cls.login_mode = mode;
  render();
  ctx.onChange();
}

// פתיחת כל הפרקים בלומדה הזו, לכיתה הזו בלבד (מיגרציה 04)
async function setCourseOpen(open) {
  const msg = open
    ? `לפתוח את כל הפרקים בלומדה "${COURSE.title}" לכיתה ${cls.label}?
התלמידות יראו את השינוי בכניסה הבאה ללומדה (או ברענון הדף).`
    : `לחזור לפתיחה לפי הסדר בלומדה "${COURSE.title}"?
מה שהושלם נשאר מושלם. פרקים שעוד לא הגיעו אליהם לפי הסדר יינעלו שוב, גם אם התחילו אותם.`;
  if (!window.confirm(msg)) { render(); return; }
  const { data } = await ctx.teacherRpc('teacher_set_course_open', { p_class_id: cls.id, p_course: COURSE_ID, p_open: open });
  if (!data) { render(); $('rp-err').textContent = 'לא הצלחנו לשנות. ייתכן שמיגרציה 04 עוד לא רצה במסד. כדאי לרענן ולנסות שוב'; return; }
  const list = (cls.open_courses || []).filter((c) => c !== COURSE_ID);
  cls.open_courses = open ? [...list, COURSE_ID] : list;
  render();
  ctx.onChange();
}

// ===== הוספה: הדבקה → הצעה → שמירה =====

// שורה → { name, email }. פסיק או טאב מפרידים; מה שיש בו @ הוא מייל.
function parseLines(text) {
  return text.split(/\r?\n/).map((line) => {
    const parts = line.split(/[,\t]/).map((p) => p.trim()).filter(Boolean);
    const email = parts.find((p) => p.includes('@')) || '';
    const name = parts.filter((p) => p !== email).join(' ').replace(/\s+/g, ' ');
    return { name, email };
  }).filter((r) => r.name);
}

const nameNorm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

// מי שכבר בכיתה עם שם משתמש: שם → שם משתמש. אותו עורכים ב-✏️, לא דורסים בהוספה.
// מי שבכיתה בלי שם משתמש (נכנס פעם מהרשימה) — בהוספה הוא מקבל אחד.
function existingUsernames() {
  return new Map(rows.filter((r) => r.username).map((r) => [nameNorm(r.name), r.username]));
}

function suggest() {
  const hasUser = existingUsernames();
  const all = parseLines($('rp-names').value);
  const list = all.filter((r) => !hasUser.has(nameNorm(r.name)));
  const skipped = all.filter((r) => hasUser.has(nameNorm(r.name))).map((r) => r.name);
  $('rp-err').textContent = skipped.length ? `כבר בכיתה עם שם משתמש, ולכן דילגתי: ${skipped.join(', ')}` : '';
  if (!list.length) { if (!skipped.length) $('rp-err').textContent = 'צריך להדביק לפחות שם אחד'; preview = []; renderPreview(); return; }
  const taken = new Set(rows.map((r) => normUser(r.username)).filter(Boolean));
  const pattern = $('rp-pattern').value;

  if (pattern === 'num') {
    const prefix = $('rp-prefix').value.trim() || defaultPrefix();
    // ממשיכים מהמספר הכי גבוה שכבר קיים עם אותה תחילית
    let n = 0;
    taken.forEach((u) => {
      if (u.startsWith(normUser(prefix))) {
        const k = parseInt(u.slice(normUser(prefix).length), 10);
        if (k > n) n = k;
      }
    });
    preview = list.map((r) => {
      do { n++; } while (taken.has(normUser(prefix + n)));
      return { ...r, username: prefix + n };
    });
  } else {
    preview = list.map((r) => {
      const [first, ...rest] = r.name.split(' ');
      const last = rest.join('');
      let u = first + (last[0] || '');
      for (let i = 2; taken.has(normUser(u)); i++) u = i <= last.length ? first + last.slice(0, i) : first + (last[0] || '') + i;
      taken.add(normUser(u));
      return { ...r, username: u };
    });
  }
  renderPreview();
}

function previewProblems() {
  const existing = new Map(rows.filter((r) => r.username).map((r) => [normUser(r.username), r.name]));
  const seen = {};
  preview.forEach((p) => { const k = normUser(p.username); seen[k] = (seen[k] || 0) + 1; });
  const hasUser = existingUsernames();
  return preview.map((p) => {
    const k = normUser(p.username);
    if (hasUser.has(nameNorm(p.name))) return `כבר בכיתה (${hasUser.get(nameNorm(p.name))})`;
    if (k.length < 2) return 'קצר מדי';
    if (seen[k] > 1) return 'כפול ברשימה';
    if (existing.has(k) && existing.get(k) !== p.name) return `כבר של ${existing.get(k)}`;
    return '';
  });
}

function renderPreview() {
  const box = $('rp-preview');
  if (!box) return;
  if (!preview.length) { box.innerHTML = ''; return; }
  const problems = previewProblems();
  const bad = problems.filter(Boolean).length;
  box.innerHTML = `
    <table class="rp-table rp-preview-table">
      <thead><tr><th>שם</th><th>שם משתמש (אפשר לשנות)</th><th>מייל</th><th></th><th></th></tr></thead>
      <tbody>${preview.map((p, i) => `
        <tr class="${problems[i] ? 'rp-bad' : ''}">
          <td>${esc(p.name)}</td>
          <td><input class="input-field rp-user" data-i="${i}" value="${esc(p.username)}" maxlength="40"></td>
          <td dir="ltr">${esc(p.email)}</td>
          <td class="rp-problem">${esc(problems[i])}</td>
          <td><button type="button" class="link-btn rp-drop" data-i="${i}" title="להוריד מהרשימה">✕</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="form-actions">
      <button type="button" class="btn btn-primary" id="rp-save" ${bad ? 'disabled' : ''}>3. שמירה (${preview.length})</button>
      <button type="button" class="btn btn-ghost" id="rp-clear">ביטול</button>
      ${bad ? `<span class="err">${bad} שורות באדום — צריך לתקן לפני שמירה</span>` : ''}
    </div>`;
  box.querySelectorAll('.rp-user').forEach((inp) => inp.addEventListener('change', () => {
    preview[+inp.dataset.i].username = inp.value.trim();
    renderPreview();
  }));
  box.querySelectorAll('.rp-drop').forEach((btn) => btn.addEventListener('click', () => {
    preview.splice(+btn.dataset.i, 1);
    renderPreview();
  }));
  $('rp-save').addEventListener('click', savePreview);
  $('rp-clear').addEventListener('click', () => { preview = []; renderPreview(); });
}

const STATUS_TEXT = {
  ok: 'נשמר', bad_name: 'שם קצר מדי', bad_username: 'שם משתמש קצר מדי', username_taken: 'שם המשתמש תפוס',
  bad_email: 'מייל לא תקין', email_taken: 'המייל כבר של תלמיד אחר', name_taken: 'השם כבר קיים',
};

async function savePreview() {
  $('rp-save').disabled = true;
  const { data, error } = await ctx.teacherRpc('teacher_add_students', {
    p_class_id: cls.id,
    p_rows: preview.map((p) => ({ name: p.name, username: p.username, email: p.email })),
  });
  if (error || !data || data.status !== 'ok') {
    $('rp-err').textContent = 'השמירה נכשלה. כדאי לרענן את הדף ולהיכנס שוב';
    $('rp-save').disabled = false;
    return;
  }
  const failed = data.results.filter((r) => r.status !== 'ok');
  preview = failed.map((r) => preview.find((p) => p.name === r.name) || { name: r.name, username: r.username, email: '' });
  await reload();
  ctx.onChange();
  if (failed.length) {
    $('rp-err').textContent = `${data.results.length - failed.length} נשמרו. לא נשמרו: ` +
      failed.map((r) => `${r.name} (${STATUS_TEXT[r.status] || r.status})`).join(', ');
    const det = document.querySelector('.rp-add');
    if (det) det.open = true;
  }
}

// ===== עריכה והסרה =====

function editRow(i) {
  const r = rows[i];
  const tr = document.querySelector(`.rp-table tr[data-i="${i}"]`);
  tr.innerHTML = `
    <td><input class="input-field" id="rp-e-name" value="${esc(r.name)}" maxlength="60"></td>
    <td><input class="input-field" id="rp-e-user" value="${esc(r.username || '')}" maxlength="40"></td>
    <td><input class="input-field" id="rp-e-email" value="${esc(r.email || '')}" dir="ltr"></td>
    <td colspan="2" class="rp-actions">
      <button type="button" class="btn btn-primary" id="rp-e-save">שמירה</button>
      <button type="button" class="link-btn" id="rp-e-cancel">ביטול</button>
    </td>`;
  $('rp-e-user').focus();
  $('rp-e-cancel').addEventListener('click', render);
  $('rp-e-save').addEventListener('click', async () => {
    const { data, error } = await ctx.teacherRpc('teacher_update_student', {
      p_class_id: cls.id, p_student_id: r.student_id,
      p_name: $('rp-e-name').value, p_username: $('rp-e-user').value, p_email: $('rp-e-email').value,
    });
    if (error || !data) { $('rp-err').textContent = 'אין חיבור לשרת כרגע'; return; }
    if (data !== 'ok') { $('rp-err').textContent = STATUS_TEXT[data] || 'הכניסה פגה. כדאי לרענן את הדף ולהיכנס שוב'; return; }
    $('rp-err').textContent = '';
    await reload();
    ctx.onChange();
  });
}

async function removeRow(i) {
  const r = rows[i];
  if (!window.confirm(`להוציא את ${r.name} מהכיתה?\nההתקדמות נשמרת. אפשר להוסיף שוב בכל רגע, באותו שם.`)) return;
  const { data } = await ctx.teacherRpc('teacher_remove_student', { p_class_id: cls.id, p_student_id: r.student_id });
  if (!data) { $('rp-err').textContent = 'לא הצלחנו להוציא. כדאי לרענן ולנסות שוב'; return; }
  await reload();
  ctx.onChange();
}

// ===== העברה לתלמידים =====

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportCsv() {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['שם', 'שם משתמש', 'מייל', 'קוד כיתה', 'קישור'].map(cell).join(',')];
  rows.forEach((r) => lines.push([r.name, r.username || '', r.email || '', cls.join_code, studentLink()].map(cell).join(',')));
  // BOM — בלעדיו אקסל פותח את העברית כג'יבריש
  download(`${cls.label} - שמות משתמש.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
}

function printSlips() {
  const m = cls.default_gender === 'm';
  const slips = rows.filter((r) => r.username).map((r) => `
    <div class="slip">
      <div class="who">${esc(r.name)}</div>
      <div>שם משתמש: <strong>${esc(r.username)}</strong></div>
      <div class="small">${m ? 'נכנסים בקישור ומקלידים את שם המשתמש' : 'נכנסות בקישור ומקלידות את שם המשתמש'}.
        אותו שם משתמש עובד בכל הלומדות של הכיתה.</div>
      <div class="small" dir="ltr">${esc(studentLink())}</div>
      <div class="small">קוד כיתה: <span dir="ltr">${esc(cls.join_code)}</span></div>
    </div>`).join('');
  const w = window.open('', '_blank');
  if (!w) { window.alert('הדפדפן חסם חלון חדש. כדאי לאפשר חלונות קופצים לאתר הזה'); return; }
  w.document.write(`<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8">
    <title>${esc(cls.label)} — פתקים</title>
    <style>
      body { font-family: Rubik, Arial, sans-serif; margin: 12mm; }
      h1 { font-size: 14pt; margin: 0 0 6mm; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
      .slip { border: 1px dashed #888; padding: 5mm; break-inside: avoid; }
      .who { font-weight: 700; font-size: 13pt; margin-bottom: 2mm; }
      strong { font-size: 15pt; }
      .small { font-size: 9pt; color: #444; margin-top: 1.5mm; word-break: break-all; }
      @media print { h1 { display: none; } body { margin: 8mm; } }
    </style></head><body>
    <h1>${esc(COURSE.title)} · ${esc(cls.label)} — לגזור ולחלק</h1>
    <div class="grid">${slips}</div>
    <script>window.onload = () => window.print();<\/script>
    </body></html>`);
  w.document.close();
}

async function copyMessage() {
  const m = cls.default_gender === 'm';
  const text = [
    `נכנסים ללומדה "${COURSE.title}" בקישור הזה:`,
    studentLink(),
    m ? 'מקלידים את שם המשתמש שקיבלתם מהמורה (בפתק). אותו שם משתמש עובד בכל הלומדות של הכיתה.'
      : 'מקלידות את שם המשתמש שקיבלתן מהמורה (בפתק). אותו שם משתמש עובד בכל הלומדות של הכיתה.',
    m ? 'במחשב של בית הספר: בסוף העבודה לוחצים "התנתקות".' : 'במחשב של בית הספר: בסוף העבודה לוחצות "התנתקות".',
  ].join('\n');
  try {
    await navigator.clipboard.writeText(text);
    $('rp-msg').textContent = '✅ הועתק';
  } catch (e) {
    window.prompt('ההודעה:', text);
  }
}
