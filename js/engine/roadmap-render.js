// ===== מסך הבית: פס מסלול פשוט + כרטיסיות פרקים =====
// קורא הכל מ-content/manifest.js — הוספת פרק/יחידה חדשה מופיעה כאן אוטומטית.

import { CHAPTERS } from '../../content/manifest.js';
import * as Progress from '../progress.js';
import { COURSE } from '../../content/manifest.js';
import { t } from './phrases.js';
import { consumeRoadmapScrollHint } from './scroll-hint.js';

const STATUS_ICON = {
  locked: '🔒',
  'not-started': '▶',
  current: '✍️',
  completed: '✅',
  exempted: '🏅',
};

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== מסך הכניסה: קוד כיתה → בחירת שם מרשימה (או "אני חדשה") → לשון פנייה =====
// בית הספר והכיתה נגזרים מהקוד, ולכן אין כאן אף שדה טקסט חופשי חוץ
// מהשם של מי שחדשה. הקוד מגיע מהקישור (?code=) או מהכניסה הקודמת במכשיר.
const LOGIN_MSG = {
  bad_code: () => 'לא מצאנו כיתה עם הקוד הזה. כדאי לבדוק שוב את הספרות.',
  network: () => 'אין חיבור לשרת כרגע. כדאי לבדוק את האינטרנט ולנסות שוב.',
  name_taken: (g) => (g === 'm' ? 'השם הזה כבר ברשימה — בחר אותו למעלה.' : 'השם הזה כבר ברשימה — בחרי אותו למעלה.'),
  bad_name: () => 'צריך לכתוב שם מלא.',
  no_pick: (g) => (g === 'm' ? 'בחר את השם שלך מהרשימה.' : 'בחרי את השם שלך מהרשימה.'),
  bad_username: () => 'לא מצאנו את שם המשתמש הזה בכיתה. כדאי לבדוק מול הפתק מהמורה.',
  no_username: (g) => (g === 'm' ? 'הקלד את שם המשתמש שקיבלת מהמורה.' : 'הקלידי את שם המשתמש שקיבלת מהמורה.'),
  locked: () => 'בכיתה הזו נכנסים עם שם משתמש מהמורה.',
};

export function renderLogin(container) {
  container.innerHTML = '';
  if (!Progress.isStorageAvailable()) {
    const warn = el('div', 'box box-trap');
    warn.style.marginBottom = 'var(--space-4)';
    warn.innerHTML = `<div class="box-icon">⚠️</div><div><div class="box-title">שימו לב</div><div class="box-body">נראה שהדפדפן חוסם שמירת נתונים כאן (למשל גלישה פרטית/incognito). ההתקדמות <strong>לא תישמר</strong> אחרי סגירת הדף. כדאי לצאת ממצב גלישה פרטית ולנסות שוב.</div></div>`;
    container.appendChild(warn);
  }
  const wrap = el('div', 'card fade-in login-card-student');
  wrap.style.marginTop = 'var(--space-6)';
  wrap.innerHTML = `
    <div style="text-align:center;margin-bottom:var(--space-4);">
      <svg class="mascot" style="width:96px;height:96px;"><use href="assets/mascot.svg#mascot-wave"></use></svg>
      <h1 id="login-title">${t('welcome_title', 'f')}</h1>
    </div>
    <div id="login-step"></div>
  `;
  container.appendChild(wrap);
  const stepEl = wrap.querySelector('#login-step');
  const setTitle = (g) => { wrap.querySelector('#login-title').textContent = t('welcome_title', g); };

  function showCodeStep(prefill, message) {
    stepEl.innerHTML = `
      <form id="code-form" novalidate>
        <p class="muted" style="text-align:center;">הקוד של הכיתה נמצא בקלאסרום, או אצל המורה</p>
        <label class="muted" for="class-code">קוד כיתה</label>
        <input id="class-code" class="input-field class-code-input" type="text" inputmode="numeric" autocomplete="off"
               maxlength="9" placeholder="123456" value="${escapeHtml(prefill || '')}">
        <div class="login-msg" role="alert">${escapeHtml(message || '')}</div>
        <button type="submit" class="btn btn-primary btn-block">המשך</button>
      </form>
    `;
    const form = stepEl.querySelector('#code-form');
    const input = form.querySelector('#class-code');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await tryCode(input.value, form.querySelector('button'));
    });
    if (!prefill) input.focus();
  }

  async function tryCode(code, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'רגע…'; }
    const res = await Progress.fetchClassRoster(code);
    if (res.ok && res.cls.login_mode === 'username') showUsernameStep(code, res.cls);
    else if (res.ok) showPickStep(code, res.cls, res.students);
    else showCodeStep(code, LOGIN_MSG[res.reason]());
  }

  // כיתה שבה המורה נותנת שמות משתמש: שדה אחד, בלי רשימה ובלי "אני חדשה".
  // לשון הפנייה נלקחת מהכיתה עכשיו, ומהתלמיד עצמו אחרי הכניסה.
  function showUsernameStep(code, cls) {
    const gender = cls.default_gender === 'm' ? 'm' : 'f';
    setTitle(gender);
    stepEl.innerHTML = `
      <div class="class-chip">
        <span>🏫 ${escapeHtml(cls.label)} · ${escapeHtml(cls.school_year)}</span>
        <button type="button" class="link-btn" id="change-code">קוד אחר</button>
      </div>
      <form id="username-form" novalidate>
        <label class="muted" for="username">שם המשתמש שקיבלת מהמורה</label>
        <input id="username" class="input-field" type="text" maxlength="40" autocomplete="off"
               autocapitalize="off" spellcheck="false">
        <div class="login-msg" role="alert"></div>
        <button type="submit" class="btn btn-primary btn-block">${escapeHtml(t('start_btn', gender))}</button>
      </form>
    `;
    const form = stepEl.querySelector('#username-form');
    const input = form.querySelector('#username');
    const msgEl = form.querySelector('.login-msg');
    const submitBtn = form.querySelector('button[type=submit]');
    stepEl.querySelector('#change-code').addEventListener('click', () => { setTitle('f'); showCodeStep(''); });
    input.focus();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (input.value.trim().length < 2) { msgEl.textContent = LOGIN_MSG.no_username(gender); return; }
      submitBtn.disabled = true;
      submitBtn.textContent = 'רגע…';
      const res = await Progress.loginWithClassCode(code, { username: input.value });
      if (res.ok) { location.hash = '#roadmap'; return; }
      if (res.reason === 'bad_code') { showCodeStep(code, LOGIN_MSG.bad_code()); return; }
      msgEl.textContent = (LOGIN_MSG[res.reason] || LOGIN_MSG.network)(gender);
      submitBtn.disabled = false;
      submitBtn.textContent = t('start_btn', gender);
    });
  }

  function showPickStep(code, cls, students) {
    let gender = cls.default_gender === 'm' ? 'm' : 'f';
    let picked = null; // id של תלמידה מהרשימה, או 'new'
    setTitle(gender);
    stepEl.innerHTML = `
      <div class="class-chip">
        <span>🏫 ${escapeHtml(cls.label)} · ${escapeHtml(cls.school_year)}</span>
        <button type="button" class="link-btn" id="change-code">קוד אחר</button>
      </div>
      <form id="pick-form" novalidate>
        <div class="muted" id="pick-label" style="margin-bottom:var(--space-2);"></div>
        <div class="name-list" role="group" aria-labelledby="pick-label">
          ${students.map((s) => `<button type="button" class="name-option" data-id="${escapeHtml(s.id)}" data-gender="${escapeHtml(s.gender)}" aria-pressed="false">${escapeHtml(s.name)}</button>`).join('')}
          <button type="button" class="name-option name-option-new" data-id="new" aria-pressed="false"></button>
        </div>
        <div id="new-name-wrap" style="display:none;">
          <label class="muted" for="new-name">שם מלא</label>
          <input id="new-name" class="input-field" type="text" maxlength="60" autocomplete="off" placeholder="לדוגמה: נועה לוי">
        </div>
        <label class="muted" for="student-gender" id="gender-label">איך נפנה אלייך?</label>
        <select id="student-gender" class="input-field">
          <option value="f">בלשון נקבה</option>
          <option value="m">בלשון זכר</option>
        </select>
        <div class="login-msg" role="alert"></div>
        <button type="submit" class="btn btn-primary btn-block" id="login-submit"></button>
      </form>
    `;
    const form = stepEl.querySelector('#pick-form');
    const genderSelect = form.querySelector('#student-gender');
    const msgEl = form.querySelector('.login-msg');
    const newWrap = form.querySelector('#new-name-wrap');
    const newInput = form.querySelector('#new-name');
    const submitBtn = form.querySelector('#login-submit');

    function applyGender(g) {
      gender = g;
      genderSelect.value = g;
      setTitle(g);
      submitBtn.textContent = t('start_btn', g);
      form.querySelector('#gender-label').textContent = g === 'm' ? 'איך נפנה אליך?' : 'איך נפנה אלייך?';
      form.querySelector('#pick-label').textContent = students.length
        ? (g === 'm' ? 'מי אתה? בחר את השם שלך' : 'מי את? בחרי את השם שלך')
        : (g === 'm' ? 'עוד אין אף אחד ברשימה של הכיתה' : 'עוד אין אף אחת ברשימה של הכיתה');
      form.querySelector('.name-option-new').textContent = g === 'm' ? '➕ אני חדש' : '➕ אני חדשה';
    }

    function choose(btn) {
      form.querySelectorAll('.name-option').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      picked = btn.dataset.id;
      msgEl.textContent = '';
      newWrap.style.display = picked === 'new' ? 'block' : 'none';
      if (picked === 'new') newInput.focus();
      else if (btn.dataset.gender) applyGender(btn.dataset.gender === 'm' ? 'm' : 'f');
    }

    form.querySelectorAll('.name-option').forEach((b) => b.addEventListener('click', () => choose(b)));
    genderSelect.addEventListener('change', () => applyGender(genderSelect.value));
    stepEl.querySelector('#change-code').addEventListener('click', () => { setTitle('f'); showCodeStep(''); });
    applyGender(gender);
    if (!students.length) choose(form.querySelector('.name-option-new'));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!picked) { msgEl.textContent = LOGIN_MSG.no_pick(gender); return; }
      const pick = picked === 'new' ? { newName: newInput.value } : { studentId: picked };
      if (pick.newName !== undefined && pick.newName.trim().length < 2) { msgEl.textContent = LOGIN_MSG.bad_name(); return; }
      submitBtn.disabled = true;
      submitBtn.textContent = 'רגע…';
      const res = await Progress.loginWithClassCode(code, pick, gender);
      if (res.ok) { location.hash = '#roadmap'; return; }
      if (res.reason === 'bad_code') { showCodeStep(code, LOGIN_MSG.bad_code()); return; }
      msgEl.textContent = LOGIN_MSG[res.reason](gender);
      submitBtn.disabled = false;
      submitBtn.textContent = t('start_btn', gender);
    });
  }

  const suggested = Progress.getSuggestedClassCode();
  if (suggested) {
    showCodeStep(suggested);
    tryCode(suggested, stepEl.querySelector('button[type=submit]'));
  } else {
    showCodeStep('');
  }
}

function renderPathStrip() {
  const strip = el('div', 'path-strip');
  CHAPTERS.forEach(ch => {
    const status = Progress.chapterStatus(ch.id);
    const nodeWrap = el('div', `path-node-wrap state-${status}`);
    nodeWrap.style.setProperty('--node-color', `var(--${ch.colorVar})`);
    const node = el('div', 'path-node', status === 'completed' ? '✓' : String(ch.number));
    nodeWrap.appendChild(node);
    nodeWrap.appendChild(el('div', 'path-node-label', ch.icon));
    strip.appendChild(nodeWrap);
  });
  return strip;
}

function renderUnitCard(unit, chapter) {
  const status = unit.modulePath ? Progress.unitStatus(unit.id) : 'locked';
  const comingSoon = !unit.modulePath;
  const isExemptionType = unit.type === 'exemption';
  const isBonusType = unit.type === 'bonus';
  const card = el('a', `unit-card ${status === 'locked' || comingSoon ? 'locked' : ''} ${isExemptionType ? 'type-exemption' : ''} ${isBonusType ? 'type-bonus' : ''} ${comingSoon ? 'coming-soon' : ''}`);
  card.href = comingSoon || status === 'locked' ? '#' : `#unit/${unit.id}`;
  card.dataset.unitId = unit.id;
  card.style.setProperty('--band-color', `var(--${chapter.colorVar})`);

  const icon = el('div', 'unit-icon', `<span>${unit.icon}</span>`);
  const mid = el('div');
  mid.appendChild(el('div', 'unit-title', unit.title));
  mid.appendChild(el('div', 'unit-meta', comingSoon ? 'בקרוב ✨' : `${unit.estMinutes} דק׳ · ${labelForType(unit.type)}`));

  card.appendChild(icon);
  card.appendChild(mid);
  card.appendChild(el('div', 'unit-status', comingSoon ? '🌱' : STATUS_ICON[status] || ''));
  return card;
}

function labelForType(type) {
  return { lesson: 'שיעור', lab: 'מעבדה', quiz: 'מבחן', exemption: 'אתגר פטור', reference: 'סיכום', bonus: '✨ בונוס (לא חובה)' }[type] || '';
}

export function renderRoadmap(container) {
  if (!Progress.getStudent()) { location.hash = '#login'; return; }
  const student = Progress.getStudent();

  container.innerHTML = '';
  const wrap = el('div', 'fade-in');

  const topBar = el('div');
  topBar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);';
  topBar.innerHTML = `
    <div>שלום, <strong id="greeting-name"></strong> 👋</div>
    ${Progress.isClassMode()
      ? '<div class="xp-counter class-mode-badge" title="כל היחידות פתוחות. לכיבוי: להוסיף ?class=0 לכתובת">👩‍🏫 מצב כיתה</div>'
      : `<div class="xp-counter">⭐ ${Progress.computeXP()} XP</div>`}
  `;
  // student.name הוקלד ע"י התלמידה בטופס הכניסה — לא סטטי/מפתחת, אז
  // חייבים textContent (לא innerHTML) כדי לא לפתוח פרצת XSS דרך שם עם
  // תגיות HTML.
  topBar.querySelector('#greeting-name').textContent = student.name;
  wrap.appendChild(topBar);
  wrap.appendChild(renderPathStrip());

  // המורה פתחה את הלומדה לכיתה (מיגרציה 04). עשרה פרקים פתוחים עלולים
  // לבלבל מי שרק מתחילה — לכן מכוונים לאתגר הפטור כנקודת פתיחה.
  if (Progress.isCourseOpenForClass() && !Progress.isClassMode()) {
    const open = el('div', 'course-open-note');
    const f = student.gender !== 'm';
    open.innerHTML = `🔓 <strong>כל הפרקים פתוחים לחזרה.</strong>
      ${f ? 'לא בטוחה' : 'לא בטוח'} מאיפה להתחיל? אתגר הפטור בראש כל פרק יגיד לך מה כבר יש לך ומה כדאי לחזק.`;
    wrap.appendChild(open);
  }

  const { done, total } = Progress.overallCompletion();
  const overall = el('div', 'overall-progress');
  overall.innerHTML = `
    <div class="overall-progress-track"><div class="overall-progress-fill" style="width:${total ? (done / total * 100) : 0}%"></div></div>
    <div class="overall-progress-text">${done} / ${total} יחידות הושלמו</div>
  `;
  wrap.appendChild(overall);

  CHAPTERS.forEach(ch => {
    const band = el('div', 'chapter-band');
    band.dataset.chapterId = ch.id;
    band.style.setProperty('--band-color', `var(--${ch.colorVar})`);
    band.innerHTML = `<span class="chapter-icon">${ch.icon}</span> פרק ${ch.number}: ${ch.title}`;
    wrap.appendChild(band);
    ch.units.forEach(u => wrap.appendChild(renderUnitCard(u, ch)));
  });

  const logoutBtn = el('button', 'btn btn-ghost', 'התנתקות');
  logoutBtn.style.marginTop = 'var(--space-5)';
  logoutBtn.addEventListener('click', Progress.logout);
  wrap.appendChild(logoutBtn);

  container.appendChild(wrap);

  // גלילה חכמה: אם מגיעים לכאן אחרי סיום יחידה/פרק, ממרכזים את החלק
  // הרלוונטי הבא (ראי scroll-hint.js) — אחרת פשוט חוזרים לראש המסך.
  // בכוונה "instant" ולא "smooth": גלילת smooth תלויה בלולאת האנימציה של
  // הדפדפן (requestAnimationFrame), שלא רצה כשהטאב לא פעיל/גלוי — מה
  // שגרם לגלילה "להיבלע" בלי אזהרה. instant הוא סנכרוני ותמיד עובד.
  const hint = consumeRoadmapScrollHint();
  const target = hint && hint.type === 'unit'
    ? wrap.querySelector(`[data-unit-id="${hint.id}"]`)
    : hint && hint.type === 'chapter'
      ? wrap.querySelector(`[data-chapter-id="${hint.id}"]`)
      : null;
  if (target) {
    target.scrollIntoView({ behavior: 'instant', block: 'center' });
  } else {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

export function renderGrandFinale(container) {
  container.innerHTML = '';
  const student = Progress.getStudent();
  const wrap = el('div', 'grand-celebrate pop-in');
  wrap.innerHTML = `
    <div class="grand-icon">🏆</div>
    <h1>כל הכבוד, <span id="finale-name"></span>!</h1>
    <div class="certificate">
      <h2>תעודת סיום — ${COURSE.title}</h2>
      <p class="muted">${COURSE.finaleText}</p>
      <div class="xp-counter" style="justify-content:center;font-size:1.3rem;">⭐ ${Progress.computeXP()} XP</div>
    </div>
    <a href="#roadmap" class="btn btn-primary">חזרה למסלול</a>
  `;
  // ראו הערה למעלה ב-renderRoadmap: student.name הוא קלט תלמידה, textContent לא innerHTML.
  wrap.querySelector('#finale-name').textContent = student ? student.name : '';
  container.appendChild(wrap);
  import('./celebrate.js').then(({ fireConfetti }) => { fireConfetti(40); });
}
