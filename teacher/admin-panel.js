// ===== למנהלת בלבד: מורה חדשה, ו"מורות ולומדות" (מיגרציה 04) =====
// כל מורה רואה בלוח רק את הלומדות שהמנהלת סימנה לה. זה עניין של סדר
// ולא של התלמידות: קוד כיתה עובד בכל הלומדות.
// המסך בנוי להרבה לומדות: לכל מורה שורה של צ'יפים, מקובצים לפי שכבה,
// והשורה נשברת לשורות כשהיא מתמלאת. לחיצה על צ'יפ שומרת מיד.

import { COURSE_ID } from '../content/manifest.js';
import { COURSES, groupByGrade, teacherUrl } from './courses.js';

let ctx = null;   // { teacherRpc, escapeHtml, onChange }

function $(id) { return document.getElementById(id); }
const esc = (s) => ctx.escapeHtml(s);

function openPanel(html) {
  const panel = $('form-panel');
  panel.style.display = 'block';
  panel.innerHTML = html;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return panel;
}

function closePanel() {
  $('form-panel').style.display = 'none';
  $('form-panel').innerHTML = '';
}

// שורת צ'יפים של כל הלומדות, מקובצות לפי שכבה. צ'יפ לחוץ = יש גישה.
function courseChipsHtml(selected, dataAttrs = '') {
  return groupByGrade(COURSES).map(([grade, list]) => `
    <span class="ap-grade">${esc(grade)}</span>
    ${list.map((c) => `<button type="button" class="ap-chip" aria-pressed="${selected.includes(c.id)}"
        data-course="${esc(c.id)}" ${dataAttrs}>${c.icon} ${esc(c.title)}${c.url ? '' : ' <span class="muted">(עוד לא פורסמה)</span>'}</button>`).join('')}`).join('');
}

// ===== "מורות ולומדות" =====

export async function showTeachersPanel(context) {
  ctx = context;
  openPanel('<h2>🗂️ מורות ולומדות</h2><p class="muted">טוענת... ⏳</p>');
  const { data, error } = await ctx.teacherRpc('admin_teachers');
  if (error || !Array.isArray(data)) {
    openPanel(`<h2>🗂️ מורות ולומדות</h2>
      <p class="rp-warn">לא הצלחנו לטעון את רשימת המורות. ייתכן שמיגרציה 04 עוד לא רצה במסד.</p>
      <button type="button" class="btn btn-ghost" id="ap-close">סגירה</button>`);
    $('ap-close').addEventListener('click', closePanel);
    return;
  }
  const byId = Object.fromEntries(data.map((t) => [t.id, t]));
  const panel = openPanel(`
    <div class="rp-head">
      <h2>🗂️ מורות ולומדות</h2>
      <button type="button" class="btn btn-ghost" id="ap-close">סגירה</button>
    </div>
    <p class="muted">לחיצה על לומדה פותחת או סוגרת אותה למורה, ונשמרת מיד.
      מורה רואה בלוח רק את הלומדות המסומנות, והשינוי מופיע אצלה בכניסה הבאה.</p>
    <div class="ap-list">
      ${data.map((t) => `
        <div class="ap-row">
          <div class="ap-who">
            <strong>${esc(t.name)}</strong>
            <span class="muted" dir="ltr">${esc(t.login)}</span>
            <span class="muted">· ${t.class_count} כיתות</span>
            <span class="ap-status" id="ap-status-${esc(t.id)}"></span>
          </div>
          <div class="ap-chips">
            ${t.is_admin ? '<span class="muted">מנהלת — רואה את כל הלומדות</span>' : courseChipsHtml(t.courses || [], `data-teacher="${esc(t.id)}"`)}
          </div>
        </div>`).join('')}
    </div>`);
  $('ap-close').addEventListener('click', closePanel);

  panel.querySelectorAll('.ap-chip[data-teacher]').forEach((chip) => chip.addEventListener('click', async () => {
    const t = byId[chip.dataset.teacher];
    const status = $(`ap-status-${t.id}`);
    const on = chip.getAttribute('aria-pressed') !== 'true';
    const next = on ? [...t.courses, chip.dataset.course] : t.courses.filter((c) => c !== chip.dataset.course);
    // בזמן השמירה הצ'יפים של המורה הזו נעולים, כדי ששתי לחיצות מהירות לא ידרסו זו את זו
    const chips = panel.querySelectorAll(`.ap-chip[data-teacher="${t.id}"]`);
    chips.forEach((c) => { c.disabled = true; });
    chip.setAttribute('aria-pressed', String(on));
    status.textContent = '';
    const { data: ok } = await ctx.teacherRpc('admin_set_teacher_courses', { p_teacher_id: t.id, p_courses: next });
    chips.forEach((c) => { c.disabled = false; });
    if (ok) {
      t.courses = next;
      status.textContent = '✓ נשמר';
      status.className = 'ap-status ap-ok';
    } else {
      chip.setAttribute('aria-pressed', String(!on));
      status.textContent = 'לא נשמר. כדאי לרענן ולנסות שוב';
      status.className = 'ap-status ap-bad';
    }
  }));
}

// ===== מורה חדשה =====

// סיסמה התחלתית למורה חדשה: בלי תווים שמתבלבלים (0/O, 1/l)
function suggestPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => chars[b % chars.length]).join('');
}

export function showNewTeacherForm(context) {
  ctx = context;
  const panel = openPanel(`
    <h2>מורה חדשה</h2>
    <p class="muted">היא תקבל אוטומטית "כיתת בדיקה" משלה, ותוכל לפתוח כיתות בעצמה.</p>
    <form id="new-teacher-form" class="form-grid" novalidate>
      <label>שם (מופיע בלוח)
        <input class="input-field" id="nt-name" maxlength="40" placeholder="לדוגמה: רחל" required>
      </label>
      <label>שם משתמש (אותיות באנגלית)
        <input class="input-field ltr-field" id="nt-login" maxlength="30" placeholder="rachel" autocomplete="off" required>
      </label>
      <label>סיסמה התחלתית
        <input class="input-field ltr-field" id="nt-pass" maxlength="40" value="${suggestPassword()}" autocomplete="off">
      </label>
      <div class="ap-field">
        <span>אילו לומדות היא תראה בלוח? (אפשר לשנות אחר כך ב"מורות ולומדות")</span>
        <div class="ap-chips">${courseChipsHtml([COURSE_ID])}</div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">יצירת מורה</button>
        <button type="button" class="btn btn-ghost" id="nt-cancel">ביטול</button>
      </div>
      <div class="err" id="nt-err"></div>
    </form>`);
  $('nt-cancel').addEventListener('click', closePanel);
  $('nt-name').focus();
  panel.querySelectorAll('.ap-chip').forEach((chip) => chip.addEventListener('click', () => {
    chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
  }));

  $('new-teacher-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('nt-name').value.trim();
    const login = $('nt-login').value.trim().toLowerCase();
    const pass = $('nt-pass').value;
    const chosen = [...panel.querySelectorAll('.ap-chip[aria-pressed="true"]')].map((c) => c.dataset.course);
    if (!chosen.length) { $('nt-err').textContent = 'צריך לסמן לפחות לומדה אחת'; return; }
    const { data, error } = await ctx.teacherRpc('admin_create_teacher', { p_new_login: login, p_new_name: name, p_new_password: pass });
    if (error || !data) { $('nt-err').textContent = 'אין חיבור לשרת כרגע'; return; }
    const msg = { bad_input: 'צריך שם, שם משתמש, וסיסמה של 6 תווים לפחות', login_taken: 'שם המשתמש הזה כבר תפוס', auth: 'רק מנהלת יכולה ליצור מורות' }[data.status];
    if (msg) { $('nt-err').textContent = msg; return; }

    // admin_create_teacher לא השתנתה (ולא מחזירה מזהה), אז מוצאים את המורה לפי שם המשתמש
    const { data: list } = await ctx.teacherRpc('admin_teachers');
    const created = Array.isArray(list) && list.find((t) => t.login === login);
    const { data: saved } = created
      ? await ctx.teacherRpc('admin_set_teacher_courses', { p_teacher_id: created.id, p_courses: chosen })
      : { data: false };

    const links = COURSES.filter((c) => chosen.includes(c.id) && teacherUrl(c))
      .map((c) => `${c.icon} ${c.title}:\n${new URL(teacherUrl(c), location.href).href}`).join('\n');
    const text = `שלום ${name}, הנה הכניסה ללוח המורה:\n${links}\nשם משתמש: ${login}\nסיסמה: ${pass}\n\nאותה כניסה עובדת בכל הלומדות, ובתוך הלוח יש תפריט למעבר ביניהן.\nמחכה לך שם "כיתת בדיקה" עם הקוד ${data.test_code}. אפשר להיכנס ללומדה עם הקוד, כמו תלמידה, ולראות איך זה נראה בלוח.`;
    openPanel(`<h2>✅ ${esc(name)} נוספה</h2>
      ${saved ? '' : '<p class="rp-warn">⚠️ המורה נוצרה, אבל הלומדות שלה לא נשמרו. אפשר לסמן אותן ב"מורות ולומדות".</p>'}
      <p class="muted">הודעה מוכנה לשליחה (הסיסמה לא נשמרת בשום מקום אחר — כדאי להעתיק עכשיו):</p>
      <textarea class="input-field" id="nt-msg" rows="9" readonly>${esc(text)}</textarea>
      <div class="form-actions">
        <button type="button" class="btn btn-primary" id="nt-copy">📋 העתקה</button>
        <button type="button" class="btn btn-ghost" id="nt-close">סגירה</button>
      </div>`);
    $('nt-copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); $('nt-copy').textContent = '✅ הועתק'; }
      catch (err) { $('nt-msg').select(); }
    });
    $('nt-close').addEventListener('click', closePanel);
    ctx.onChange();
  });
}
