// ===== דשבורד מורה — קורא ישירות מ-Supabase, לפי content/manifest.js =====
// לא משתמש ב-js/progress.js (זה מיועד לסשן של תלמידה בודדת, מבוסס
// localStorage) — כאן צריך לחשב התקדמות לכל התלמידות בבת אחת מהשורות
// שחזרו מהשרת, אז יש כאן גרסה מקבילה קטנה של אותה לוגיקה (isUnitDone,
// סטטוס פרק), שמקורה עדיין manifest.js כדי שלא יהיו שני "מקורות אמת".

// נתיבים יחסיים ולא מוחלטים (`/content/...`): כך הדשבורד עובד גם כשהאתר
// מתארח בתת-תיקייה (GitHub Pages של ריפו אחד עם כמה לומדות), ולא רק
// כשהוא יושב בשורש הדומיין.
import { CHAPTERS, COURSE, COURSE_ID, getFlatUnits, findChapter } from '../content/manifest.js';
import { supabaseClient } from '../js/supabase-config.js';
import { XP_VALUES } from '../js/progress.js';
import { coursesForTeacher, groupByGrade, teacherUrl } from './courses.js';
import { showRosterPanel } from './roster-panel.js';
import { showNewTeacherForm, showTeachersPanel } from './admin-panel.js';

// המורות יושבות במסד (טבלת teachers, מיגרציה 02). הסיסמה נבדקת בשרת,
// וכל מורה מקבלת רק את הכיתות שלה, ורק את הלומדות שהמנהלת סימנה לה
// (מיגרציה 04). בשיחה 2ג: כניסה עם גוגל, ו-RLS שסוגר את טבלאות התלמידות.

document.title = COURSE.teacherTitle;
const titleEl = document.getElementById('teacher-title');
if (titleEl) titleEl.textContent = COURSE.teacherTitle;

const ALL_UNITS = getFlatUnits();
// כל הלומדות חולקות פרויקט Supabase אחד (ואותה טבלת תלמידות), וכל אחת
// מסמנת את היחידות שלה בקידומת משלה. הדשבורד הזה הוא של קורס אחד בלבד,
// אז שורות ששייכות לקורס אחר מסוננות כאן — אחרת הן היו מופיעות בדוח של
// התלמידה כמזהה גולמי בלי כותרת.
const MY_UNIT_IDS = new Set(ALL_UNITS.map((u) => u.id));
const MY_CHAPTER_IDS = new Set(CHAPTERS.map((ch) => ch.id));
const GATING_UNITS = ALL_UNITS.filter((u) => u.type !== 'exemption' && u.type !== 'bonus');

function isUnitDone(unitId, progressMap) {
  const p = progressMap[unitId];
  return !!p && (p.status === 'completed' || p.status === 'exempted');
}

function chapterStatusFor(chapter, progressMap) {
  const gating = chapter.units.filter((u) => u.type !== 'exemption' && u.type !== 'bonus');
  // פרק שכולו בונוס — ראו ההערה המקבילה ב-js/progress.js. שתי הפונקציות
  // חייבות להישאר מסונכרנות, אחרת התלמידה והמורה רואות סטטוס שונה על
  // אותו פרק בדיוק.
  const relevant = gating.length ? gating : chapter.units.filter((u) => u.type !== 'exemption');
  if (!relevant.length) return 'not-started';
  const doneCount = relevant.filter((u) => isUnitDone(u.id, progressMap)).length;
  if (doneCount === 0) return 'not-started';
  if (doneCount === relevant.length) return 'completed';
  return 'current';
}

function computeXP(progressMap) {
  let xp = 0;
  GATING_UNITS.forEach((u) => {
    if (isUnitDone(u.id, progressMap)) xp += XP_VALUES[u.type] || 10;
  });
  return xp;
}

// תלמיד שהמורה הוסיפה ועוד לא נכנס: last_seen לפני created_at (מיגרציה 03)
function hasLoggedIn(s) {
  return !!s.last_seen && (!s.created_at || new Date(s.last_seen) >= new Date(s.created_at));
}

function unitTitle(unitId) {
  const unit = ALL_UNITS.find((u) => u.id === unitId);
  return unit ? unit.title : unitId;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  // גם גרשיים — הפונקציה משמשת גם בתוך מאפיינים (value="..."), ו-תשפ"ז מכיל "
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function $(id) { return document.getElementById(id); }

let allStudents = [];
let progressByStudent = {};
let quizByStudent = {};
let exemptionsByStudent = {};
let allClasses = [];
let classesByStudent = {};
let expandedId = null;
// { login, secret, teacher: { id, name, is_admin, courses, current_year, token } }.
// secret = הטוקן שהמסד נתן בכניסה (מיגרציה 04), או הסיסמה במסד ישן בלי טוקן.
let session = null;

// כל פעולה של מורה עוברת דרך פונקציה במסד שבודקת שם משתמש וסיסמה או
// טוקן (lomda_check_teacher, מיגרציות 02 ו-04)
function teacherRpc(fn, args = {}) {
  return supabaseClient.rpc(fn, { p_login: session.login, p_password: session.secret, ...args });
}

// ===== כניסה אחת לכל הלומדות =====
// כל הלומדות יושבות באותו דומיין, ולכן sessionStorage של הלשונית משותף לכולן:
// מעבר ללומדה אחרת או רענון לא מבקשים כניסה מחדש. נשמר הטוקן (8 שעות,
// במסד), אף פעם לא הסיסמה. סגירת הלשונית או "יציאה" מוחקות אותו.
const KEY_TEACHER_SESSION = 'lomda_teacher_session';

function saveSession() {
  try {
    if (session.teacher.token) sessionStorage.setItem(KEY_TEACHER_SESSION, JSON.stringify({ login: session.login, token: session.teacher.token }));
  } catch (e) { /* בלי אחסון — פשוט ייכנסו שוב בלומדה הבאה */ }
}

function readSavedSession() {
  try { return JSON.parse(sessionStorage.getItem(KEY_TEACHER_SESSION) || 'null'); }
  catch (e) { return null; }
}

function clearSavedSession() {
  try { sessionStorage.removeItem(KEY_TEACHER_SESSION); } catch (e) { /* לא קריטי */ }
}

async function tryLogin() {
  const login = $('teacher-login').value.trim();
  const password = $('teacher-pass').value;
  if (!login || !password) { $('pass-err').textContent = 'צריך שם משתמש וסיסמה'; return; }
  $('pass-err').textContent = '';
  const { data, error } = await supabaseClient.rpc('teacher_login', { p_login: login, p_password: password });
  if (error) {
    console.warn('teacher_login נכשל:', error);
    $('pass-err').textContent = 'אין חיבור לשרת כרגע. כדאי לנסות שוב בעוד רגע';
    return;
  }
  if (!data) { $('pass-err').textContent = 'שם משתמש או סיסמה שגויים'; return; }
  enterDashboard(login, data, data.token || password);
}

// כניסה שמורה מהלשונית (מלומדה אחרת, או לפני רענון). טוקן שפג → מסך הכניסה.
async function resumeSession() {
  const saved = readSavedSession();
  if (!saved || !saved.login || !saved.token) return;
  $('login-screen').style.display = 'none';
  const { data, error } = await supabaseClient.rpc('teacher_login', { p_login: saved.login, p_password: saved.token });
  if (error || !data) {
    if (!error) clearSavedSession();
    $('login-screen').style.display = '';
    $('teacher-login').value = saved.login;
    return;
  }
  enterDashboard(saved.login, data, saved.token);
}

async function logout() {
  if (session.teacher.token) await supabaseClient.rpc('teacher_logout', { p_token: session.teacher.token });
  clearSavedSession();
  location.reload();
}

function enterDashboard(login, teacher, secret) {
  session = { login, secret, teacher };
  saveSession();
  $('login-screen').style.display = 'none';
  $('dashboard').style.display = 'block';
  $('teacher-who').textContent = teacher.is_admin ? `${teacher.name} · מנהלת, כל הכיתות` : `${teacher.name} · הכיתות שלי`;
  const mine = coursesForTeacher(teacher);
  renderCourseSwitcher(mine);
  if (!teacher.is_admin && Array.isArray(teacher.courses) && !teacher.courses.includes(COURSE_ID)) {
    renderNoAccess(mine);
    return;
  }
  loadData();
}

// מעבר ללומדה אחרת: תפריט אחד, מקובץ לפי שכבה, כדי שגם הרבה לומדות ייכנסו
// בלי למלא את ראש הדף. הרשימה ב-teacher/courses.js.
function renderCourseSwitcher(mine) {
  const bar = $('courses-bar');
  const others = mine.filter((c) => c.id !== COURSE_ID);
  if (!bar || !others.length) return;
  const options = groupByGrade(others).map(([grade, list]) => `<optgroup label="${escapeHtml(grade)}">${
    list.map((c) => {
      const url = teacherUrl(c);
      return `<option value="${escapeHtml(url || '')}" ${url ? '' : 'disabled'}>${c.icon} ${escapeHtml(c.title)}${url ? '' : ' (עוד לא פורסמה)'}</option>`;
    }).join('')}</optgroup>`).join('');
  bar.innerHTML = `<label class="course-switch">🔀 מעבר ללומדה אחרת (אותה כניסה, אותן כיתות):
    <select class="input-field" id="course-switch"><option value="">בחירת לומדה...</option>${options}</select></label>`;
  $('course-switch').addEventListener('change', (e) => { if (e.target.value) location.href = e.target.value; });
}

// מורה שהגיעה ללוח של לומדה שהמנהלת לא סימנה לה: לא טוענים נתונים
function renderNoAccess(mine) {
  const links = mine.map((c) => (teacherUrl(c)
    ? `<a class="btn btn-ghost" href="${escapeHtml(teacherUrl(c))}">${c.icon} ${escapeHtml(c.title)}</a>` : '')).join('');
  $('stats-grid').innerHTML = '';
  $('courses-bar').innerHTML = '';
  $('class-codes').innerHTML = `<div class="card no-access">
      <h2>הלומדה הזו לא ברשימה שלך</h2>
      ${links ? `<p>הלומדות שלך:</p><div class="no-access-links">${links}</div>` : '<p>עוד לא נפתחה לך אף לומדה.</p>'}
      <p class="muted">רוצה גישה ללומדה הזו? צריך לבקש מהמנהלת.</p>
    </div>`;
  document.querySelectorAll('.filters-row, .legend-row, .table-card').forEach((el) => { el.style.display = 'none'; });
}

// כל השורות של טבלה, בדפים. Supabase מחזיר לכל היותר 1000 שורות לבקשה
// (API → Max rows) ולא מודיע שחתך, והטבלאות משותפות לכל הלומדות, כך
// שבלי דפדוף הלוח היה מראה התקדמות חסרה בלי שאף אחד ישים לב.
// מחזירה { data, error } כמו בקשה רגילה. orderBy חייב להסתיים במפתח ייחודי,
// כדי שהסדר יהיה יציב בין הדפים. ממשיכים עד דף ריק, ולא עד דף "קצר",
// כי ייתכן שבפרויקט הוגדר Max rows קטן מ-1000.
const PAGE = 1000;
async function fetchAll(table, orderBy = ['id']) {
  const all = [];
  for (;;) {
    let q = supabaseClient.from(table).select('*');
    orderBy.forEach((col) => { q = q.order(col); });
    const { data, error } = await q.range(all.length, all.length + PAGE - 1);
    if (error) { console.warn(`טעינת ${table} נכשלה:`, error); return { data: all, error }; }
    if (!data.length) return { data: all, error: null };
    all.push(...data);
  }
}

async function loadData() {
  $('loading-msg').style.display = 'block';
  $('students-table').style.display = 'none';
  $('no-students').style.display = 'none';
  expandedId = null;

  const [classesRes, enrollRes, studentsRes, progressRes, quizRes, exemptionRes] = await Promise.all([
    teacherRpc('teacher_classes'),
    fetchAll('enrollments', ['student_id', 'class_id']),
    fetchAll('students', ['class_name', 'name', 'id']),
    fetchAll('unit_progress'),
    fetchAll('quiz_answers'),
    fetchAll('exemption_attempts'),
  ]);

  // הכניסה פגה (טוקן של 8 שעות, או "יציאה" בלשונית אחרת): המסד עונה null
  // בלי שגיאה. בלי הבדיקה הזו הלוח היה נראה ריק, כאילו אין תלמידות.
  if (classesRes.data === null && !classesRes.error) {
    clearSavedSession();
    window.alert('הכניסה ללוח פגה. צריך להיכנס שוב');
    location.reload();
    return;
  }

  // הסינון כאן הוא עניין של סדר ולא של אבטחה: הכיתות מגיעות מהמסד לפי
  // המורה, אבל טבלאות התלמידות עדיין פתוחות ל-anon עד שיחה 2ג.
  allClasses = classesRes.data || [];
  const classById = Object.fromEntries(allClasses.map((c) => [c.id, c]));
  classesByStudent = {};
  (enrollRes.data || []).forEach((e) => {
    const cls = classById[e.class_id];
    if (!cls) return;
    (classesByStudent[e.student_id] = classesByStudent[e.student_id] || []).push(cls);
  });
  // הכיתה הפעילה קודם, ואחריה הארכיון מהחדש לישן
  Object.values(classesByStudent).forEach((list) => list.sort((a, b) => (a.archived - b.archived) || b.school_year.localeCompare(a.school_year)));

  // מנהלת רואה את כולן, כולל מי שנכנסה בטופס הישן ואין לה כיתה. מורה — רק את הכיתות שלה.
  allStudents = (studentsRes.data || []).filter((s) => session.teacher.is_admin || classesByStudent[s.id]);

  progressByStudent = {};
  (progressRes.data || []).forEach((r) => {
    if (!progressByStudent[r.student_id]) progressByStudent[r.student_id] = {};
    progressByStudent[r.student_id][r.unit_id] = { status: r.status, lastSlide: r.last_slide, completedAt: r.completed_at };
  });

  quizByStudent = {};
  (quizRes.data || []).forEach((r) => {
    if (!MY_UNIT_IDS.has(r.unit_id)) return;
    if (!quizByStudent[r.student_id]) quizByStudent[r.student_id] = {};
    quizByStudent[r.student_id][r.unit_id] = r.answers;
  });

  exemptionsByStudent = {};
  (exemptionRes.data || []).forEach((r) => {
    if (!MY_CHAPTER_IDS.has(r.chapter_id)) return;
    if (!exemptionsByStudent[r.student_id]) exemptionsByStudent[r.student_id] = [];
    exemptionsByStudent[r.student_id].push(r);
  });

  populateClassFilter();
  renderClassCodes();
  buildTableHeader();
  renderStats();
  renderTable();
  $('last-refresh').textContent = 'עודכן: ' + new Date().toLocaleTimeString('he-IL');
}

function populateClassFilter() {
  const sel = $('filter-class');
  const current = sel.value;
  const years = [...new Set(allClasses.map((c) => c.school_year))];
  let html = '<option value="">כל הכיתות</option>';
  years.forEach((y) => {
    html += `<optgroup label="${escapeHtml(y)}"><option value="year:${escapeHtml(y)}">כל ${escapeHtml(y)}</option>`;
    allClasses.filter((c) => c.school_year === y).forEach((c) => {
      html += `<option value="${c.id}">${escapeHtml(c.label)}${c.archived ? ' (ארכיון)' : ''}</option>`;
    });
    html += '</optgroup>';
  });
  if (allStudents.some((s) => !classesByStudent[s.id])) html += '<option value="none">בלי כיתה (הטופס הישן)</option>';
  sel.innerHTML = html;
  sel.value = [...sel.options].some((o) => o.value === current) ? current : '';
}

function matchesClassFilter(student, filter) {
  if (!filter) return true;
  const list = classesByStudent[student.id] || [];
  if (filter === 'none') return list.length === 0;
  if (filter.startsWith('year:')) return list.some((c) => c.school_year === filter.slice(5));
  return list.some((c) => c.id === filter);
}

// ===== הכיתות: קוד, קישור, ארכיון, כיתה חדשה (ולמנהלת: מורה חדשה) =====

function renderClassCodes() {
  const box = $('class-codes');
  const active = allClasses.filter((c) => !c.archived);
  const showTeacher = session.teacher.is_admin;
  box.innerHTML = active.map((c) => `
    <div class="class-code-tile">
      <div class="class-code-label">${escapeHtml(c.label)} · ${escapeHtml(c.school_year)}</div>
      ${showTeacher && c.teacher_name ? `<div class="class-code-meta">${escapeHtml(c.teacher_name)}</div>` : ''}
      <div class="class-code-num" dir="ltr">${escapeHtml(c.join_code)}</div>
      <div class="class-code-meta">${c.student_count} רשומות · ${c.login_mode === 'username' ? '🔑 שם משתמש מהמורה' : '📋 בחירה מרשימה'}${(c.open_courses || []).includes(COURSE_ID) ? ' · 🔓 כל הפרקים פתוחים' : ''}</div>
      <div class="class-code-actions">
        <button type="button" class="btn btn-ghost class-code-roster" data-id="${c.id}">👥 תלמידים והגדרות הכיתה</button>
        <button type="button" class="btn btn-ghost class-code-copy" data-code="${escapeHtml(c.join_code)}">📋 העתקת קישור</button>
        <button type="button" class="btn btn-ghost class-code-archive" data-id="${c.id}" title="הקוד יפסיק לעבוד. ההתקדמות של התלמידות נשמרת">🗄️ לארכיון</button>
      </div>
    </div>`).join('') + `
    <button type="button" class="class-code-tile class-code-add" id="add-class-btn">➕ כיתה חדשה</button>
    ${showTeacher ? `<button type="button" class="class-code-tile class-code-add" id="add-teacher-btn">👩‍🏫 מורה חדשה</button>
      <button type="button" class="class-code-tile class-code-add" id="teachers-btn">🗂️ מורות ולומדות</button>` : ''}`;

  box.querySelectorAll('.class-code-copy').forEach((btn) => btn.addEventListener('click', async () => {
    const link = new URL('../?code=' + btn.dataset.code, location.href).href;
    try {
      await navigator.clipboard.writeText(link);
      btn.textContent = '✅ הועתק';
    } catch (e) {
      window.prompt('הקישור לכיתה:', link);
    }
  }));
  box.querySelectorAll('.class-code-roster').forEach((btn) => btn.addEventListener('click', () => {
    showRosterPanel(allClasses.find((c) => c.id === btn.dataset.id), { teacherRpc, escapeHtml, onChange: loadData });
  }));
  box.querySelectorAll('.class-code-archive').forEach((btn) => btn.addEventListener('click', async () => {
    const cls = allClasses.find((c) => c.id === btn.dataset.id);
    if (!window.confirm(`להעביר את "${cls.label}" לארכיון?\nהקוד יפסיק לעבוד. ההתקדמות של התלמידות נשמרת, והכיתה תופיע בסינון עם (ארכיון).`)) return;
    const { data } = await teacherRpc('teacher_set_archived', { p_class_id: cls.id, p_archived: true });
    if (data) loadData(); else window.alert('לא הצלחנו להעביר לארכיון. כדאי לרענן ולנסות שוב');
  }));
  $('add-class-btn').addEventListener('click', showNewClassForm);
  if (showTeacher) {
    const adminCtx = { teacherRpc, escapeHtml, onChange: loadData };
    $('add-teacher-btn').addEventListener('click', () => showNewTeacherForm(adminCtx));
    $('teachers-btn').addEventListener('click', () => showTeachersPanel(adminCtx));
  }
}

function closeFormPanel() {
  $('form-panel').style.display = 'none';
  $('form-panel').innerHTML = '';
}

function showNewClassForm() {
  const panel = $('form-panel');
  panel.style.display = 'block';
  panel.innerHTML = `
    <h2>כיתה חדשה</h2>
    <form id="new-class-form" class="form-grid" novalidate>
      <label>שם הכיתה, כמו שהתלמידות יראו אותו
        <input class="input-field" id="nc-label" maxlength="60" placeholder="לדוגמה: אורט י״א 3" required>
      </label>
      <label>בית ספר
        <input class="input-field" id="nc-school" maxlength="60" placeholder="לדוגמה: אורט">
      </label>
      <label>שכבה
        <input class="input-field" id="nc-grade" maxlength="20" list="nc-grades" placeholder="י״א">
        <datalist id="nc-grades"><option value="י׳"></option><option value="י״א"></option><option value="י״ב"></option></datalist>
      </label>
      <label>שנת לימודים
        <input class="input-field" id="nc-year" maxlength="10" value="${escapeHtml(session.teacher.current_year)}">
      </label>
      <label>לשון פנייה ברירת מחדל
        <select class="input-field" id="nc-gender"><option value="f">נקבה</option><option value="m">זכר</option></select>
      </label>
      <label>איך נכנסים
        <select class="input-field" id="nc-mode">
          <option value="pick">בחירה מרשימה (כל אחד בוחר את שמו או מוסיף את עצמו)</option>
          <option value="username">שם משתמש מהמורה (אני מוסיפה את התלמידים)</option>
        </select>
      </label>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">יצירת כיתה</button>
        <button type="button" class="btn btn-ghost" id="nc-cancel">ביטול</button>
      </div>
      <div class="err" id="nc-err"></div>
    </form>`;
  $('nc-cancel').addEventListener('click', closeFormPanel);
  $('nc-label').focus();
  $('new-class-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data, error } = await teacherRpc('teacher_create_class', {
      p_label: $('nc-label').value, p_school: $('nc-school').value, p_grade: $('nc-grade').value,
      p_year: $('nc-year').value, p_default_gender: $('nc-gender').value,
    });
    if (error || !data) { $('nc-err').textContent = 'אין חיבור לשרת כרגע'; return; }
    if (data.status === 'bad_label') { $('nc-err').textContent = 'צריך שם לכיתה'; return; }
    if (data.status !== 'ok') { $('nc-err').textContent = 'הכניסה פגה. כדאי לרענן את הדף ולהיכנס שוב'; return; }
    // הכיתה נפתחת תמיד כ"בחירה מרשימה" (teacher_create_class לא השתנתה), ומיד מחליפים
    if ($('nc-mode').value === 'username') {
      await teacherRpc('teacher_set_login_mode', { p_class_id: data.class.id, p_mode: 'username' });
      data.class.login_mode = 'username';
      await loadData();
      showRosterPanel(data.class, { teacherRpc, escapeHtml, onChange: loadData });
      return;
    }
    panel.innerHTML = `<h2>✅ הכיתה נפתחה</h2>
      <p><strong>${escapeHtml(data.class.label)}</strong> · הקוד: <strong dir="ltr" class="class-code-inline">${escapeHtml(data.class.join_code)}</strong></p>
      <p class="muted">הקוד עובד בכל הלומדות. "העתקת קישור" בכרטיס של הכיתה נותן קישור שהקוד כבר בתוכו.</p>
      <button type="button" class="btn btn-ghost" id="nc-close">סגירה</button>`;
    $('nc-close').addEventListener('click', closeFormPanel);
    loadData();
  });
}

function buildTableHeader() {
  $('table-head-row').innerHTML = '<th>שם</th><th>בית ספר</th><th>כיתה</th><th>התקדמות</th>' +
    CHAPTERS.map((ch) => `<th title="${escapeHtml(ch.title)}" style="text-align:center;">${ch.number}</th>`).join('') +
    '<th>XP</th><th>נראתה לאחרונה</th>';
}

function renderStats() {
  const total = allStudents.length;
  const today = new Date().toDateString();
  let activeToday = 0;
  let completedAll = 0;
  let totalXP = 0;

  allStudents.forEach((s) => {
    if (hasLoggedIn(s) && new Date(s.last_seen).toDateString() === today) activeToday++;
    const pm = progressByStudent[s.id] || {};
    const doneCount = GATING_UNITS.filter((u) => isUnitDone(u.id, pm)).length;
    if (GATING_UNITS.length > 0 && doneCount === GATING_UNITS.length) completedAll++;
    totalXP += computeXP(pm);
  });

  const avgXP = total ? Math.round(totalXP / total) : 0;

  $('stats-grid').innerHTML = [
    ['תלמידות רשומות', total],
    ['פעילות היום', activeToday],
    ['סיימו את הקורס', completedAll],
    ['XP ממוצע', avgXP],
  ].map(([label, num]) => `<div class="stat-tile"><div class="stat-num">${num}</div><div class="stat-label">${label}</div></div>`).join('');
}

function renderTable() {
  const filterClass = $('filter-class').value;
  const filterName = $('filter-name').value.trim().toLowerCase();

  if (allStudents.length === 0) {
    $('loading-msg').style.display = 'none';
    $('no-students').style.display = 'block';
    $('students-table').style.display = 'none';
    return;
  }

  const rows = allStudents.filter((s) => {
    if (!matchesClassFilter(s, filterClass)) return false;
    if (filterName && !s.name.toLowerCase().includes(filterName)) return false;
    return true;
  });

  const tbody = $('students-tbody');
  tbody.innerHTML = '';
  const colCount = 6 + CHAPTERS.length;

  rows.forEach((s) => {
    const pm = progressByStudent[s.id] || {};
    const doneCount = GATING_UNITS.filter((u) => isUnitDone(u.id, pm)).length;
    const pct = GATING_UNITS.length ? Math.round((doneCount / GATING_UNITS.length) * 100) : 0;
    const xp = computeXP(pm);

    const chapterDots = CHAPTERS.map((ch) => {
      const status = chapterStatusFor(ch, pm);
      const cls = status === 'completed' ? 'dot-completed' : status === 'current' ? 'dot-current' : 'dot-locked';
      const symbol = status === 'completed' ? '✓' : status === 'current' ? '▶' : '—';
      return `<td style="text-align:center;"><span class="dot ${cls}" title="${escapeHtml(ch.title)}">${symbol}</span></td>`;
    }).join('');

    const lastSeen = hasLoggedIn(s)
      ? new Date(s.last_seen).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '—';

    const tr = document.createElement('tr');
    tr.className = 'student-row';
    tr.innerHTML = `
      <td class="td-name">${escapeHtml(s.name)}</td>
      <td class="td-sub">${escapeHtml(s.school)}</td>
      <td class="td-sub">${escapeHtml(classesByStudent[s.id] ? classesByStudent[s.id][0].label : s.class_name)}</td>
      <td>
        <div class="completion-bar-wrap">
          <div class="completion-bar-outer"><div class="completion-bar-inner" style="width:${pct}%"></div></div>
          <div class="completion-bar-label">${doneCount}/${GATING_UNITS.length}</div>
        </div>
      </td>
      ${chapterDots}
      <td>⭐ ${xp}</td>
      <td class="td-sub">${lastSeen}</td>
    `;
    tr.addEventListener('click', () => toggleDetails(s.id));
    tbody.appendChild(tr);

    if (expandedId === s.id) {
      const detailTr = document.createElement('tr');
      detailTr.className = 'detail-row';
      detailTr.innerHTML = `<td colspan="${colCount}"><div class="detail-inner">${buildDetailHTML(s)}</div></td>`;
      tbody.appendChild(detailTr);
    }
  });

  $('loading-msg').style.display = 'none';
  $('no-students').style.display = 'none';
  $('students-table').style.display = 'table';
}

function toggleDetails(studentId) {
  expandedId = expandedId === studentId ? null : studentId;
  renderTable();
}

function buildDetailHTML(student) {
  let html = '';

  const quizzes = quizByStudent[student.id] || {};
  const quizUnitIds = Object.keys(quizzes);
  const isOpenUnit = (id) => (quizzes[id] || []).length && quizzes[id].every((a) => a.open === true);
  const allOpen = quizUnitIds.length && quizUnitIds.every(isOpenUnit);
  html += `<div class="detail-section"><div class="detail-section-title">${allOpen ? '📝 מה נכתב' : '📝 תשובות מבחנים'}</div>`;
  if (quizUnitIds.length === 0) {
    html += '<div class="muted">עדיין לא הגישה שום מבחן.</div>';
  } else {
    quizUnitIds.forEach((unitId) => {
      const answers = quizzes[unitId] || [];
      // תשובות פתוחות (שדות כתיבה של קורס, מסומנות open: true): בלי ציון
      // ובלי ✅/❌, והטקסט המלא נשמר עם שורות, כי זה מה שהמורה באה לקרוא.
      if (isOpenUnit(unitId)) {
        html += `<div style="margin-bottom:var(--space-3);"><strong>${escapeHtml(unitTitle(unitId))}</strong>`;
        html += '<table class="answers-table"><thead><tr><th>שדה</th><th>מה נכתב</th></tr></thead><tbody>';
        answers.forEach((a) => {
          html += `<tr class="open-row">
            <td>${escapeHtml(a.question_text || '')}</td>
            <td class="open-answer">${escapeHtml(a.answer_given || '—')}</td>
          </tr>`;
        });
        html += '</tbody></table></div>';
        return;
      }
      const correctCount = answers.filter((a) => a.is_correct).length;
      const score = answers.length ? Math.round((correctCount / answers.length) * 100) : 0;
      html += `<div style="margin-bottom:var(--space-3);"><strong>${escapeHtml(unitTitle(unitId))}</strong> — ציון ${score} (${correctCount}/${answers.length})`;
      html += '<table class="answers-table"><thead><tr><th>#</th><th>שאלה</th><th>תשובה</th><th>תוצאה</th></tr></thead><tbody>';
      answers.forEach((a) => {
        html += `<tr class="${a.is_correct ? 'correct-row' : 'wrong-row'}">
          <td>${escapeHtml(a.question_number)}</td>
          <td>${escapeHtml(String(a.question_text || '').slice(0, 90))}</td>
          <td>${escapeHtml(a.answer_given || '—')}</td>
          <td>${a.is_correct ? '✅' : '❌'}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    });
  }
  html += '</div>';

  const attempts = exemptionsByStudent[student.id] || [];
  html += '<div class="detail-section"><div class="detail-section-title">🎯 ניסיונות אתגר פטור</div>';
  if (attempts.length === 0) {
    html += '<div class="muted">לא ניסתה אתגר פטור.</div>';
  } else {
    attempts
      .slice()
      .sort((a, b) => new Date(b.attempted_at) - new Date(a.attempted_at))
      .forEach((a) => {
        const chTitle = (findChapter(a.chapter_id) || {}).title || a.chapter_id;
        const when = new Date(a.attempted_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        html += `<span class="exemption-chip ${a.passed ? 'passed' : 'failed'}">${a.passed ? '✅' : '❌'} ${escapeHtml(chTitle)} — ${a.score} (${when})</span>`;
      });
  }
  html += '</div>';

  return html;
}

$('login-btn').addEventListener('click', tryLogin);
$('teacher-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
$('teacher-login').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('teacher-pass').focus(); });
$('refresh-btn').addEventListener('click', loadData);
$('filter-class').addEventListener('change', renderTable);
$('filter-name').addEventListener('input', renderTable);
$('logout-btn').addEventListener('click', logout);
// חזרה עם "אחורה": הדפדפן מחזיר את הדף מהזיכרון כמו שהיה. התפריט חוזר
// ל"בחירת לומדה...", כדי שאפשר יהיה לבחור שוב את אותה לומדה. ואם בינתיים
// יצאו מהלוח (בלשונית הזו או בלומדה אחרת), לא משאירים את הנתונים מוצגים.
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  if ($('course-switch')) $('course-switch').value = '';
  if (session && session.teacher.token && !readSavedSession()) location.reload();
});
resumeSession();
