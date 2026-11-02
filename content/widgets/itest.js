// ===== מסך בסגנון iTest, ותשובות פתוחות שנשמרות =====
// הבגרות בחלק א' נעשית במסך מפוצל: השאלה מימין, הגרפים והמקורות משמאל.
// התלמידות מתרגלות כאן על אותו מבנה, כדי שביום הבחינה הוא יהיה מוכר.
//
// itest   — כרטיס עם כפתור שפותח את "מסך הבחינה" על כל החלון.
//           { type: 'itest', key: 'sim1', title, questions: [{ title, intro,
//             resources: [...], parts: [{ label, points, instruction, items }] }] }
// answer  — טענה או שאלה פתוחה אחת בתוך שקף רגיל (אותו רכיב כמו במסך).
// review  — "סיימתי": התשובות שנכתבו בשקפים הקודמים, ולידן התשובה לדוגמה.
//           לתרגול של בגרות שלמה. { type: 'review', items: [{ key, title, model }] }
// source  — כרטיס של מקור מידע (כתבה, דוח). { type: 'source', title, publisher, date, html, icon }
//
// פריט (item): { id, kind: 'tf' | 'choice' | 'text', label, claim, prompt, options,
//                model: { answer, rubric: [...] } }
//   tf     — נכון / לא נכון, ונימוק
//   choice — בחירה מתוך options (למשל תומך / סותר), ונימוק
//   text   — תשובה כתובה בלבד
// משאב (resource): { tab: "גרף א'", chart: {...} } | { tab, source: {...} } | { tab, html }
//
// כל תשובה נשמרת דרך store.js כשדה open: true, ולכן מופיעה בלוח המורה כטקסט
// מלא. ה-key של כל שדה: `${block.key}-${item.id}`, ייחודי בכל הלומדה.
// התשובה לדוגמה נפתחת רק בלחיצה, אחרי שהתשובה של התלמידה כבר נשמרה.

import * as Store from './store.js';
import { renderChart, ltrRanges } from './chart.js';

// ===== עזרים =====
function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}
const plain = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const short = (s, n = 70) => (s.length > n ? `${s.slice(0, n)}…` : s);

// ===== מוכנות: לפני שמאפשרים לכתוב, מושכים מהשרת את מה שנכתב במכשיר אחר =====
// עד 4 שניות. בלי רשת — ממשיכים עם מה שיש במכשיר.
const readyByUnit = new Map();
export function ready(unitId) {
  if (!unitId) return Promise.resolve(false);
  if (!readyByUnit.has(unitId)) {
    const timeout = new Promise((r) => setTimeout(() => r(false), 4000));
    readyByUnit.set(unitId, Promise.race([Store.ensureFresh([unitId]).catch(() => false), timeout]));
  }
  return readyByUnit.get(unitId);
}

// ===== חיווי שמירה — תווית אחת קבועה בפינה =====
let statusEl = null;
const STATUS_TEXT = { saving: 'שומרת…', saved: '✓ נשמר', offline: '⚠️ נשמר במכשיר בלבד. יישלח כשהרשת תחזור' };
export function ensureStatusEl() {
  if (statusEl && statusEl.isConnected) return;
  statusEl = el('div', 'pa-save-status');
  statusEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(statusEl);
  Store.onSaveStatus((s) => {
    statusEl.textContent = STATUS_TEXT[s] || '';
    statusEl.dataset.state = s;
  });
}

// ===== source =====
export function renderSource(src) {
  const card = el('article', 'block pa-source');
  // icon לפי סוג המקור: 📰 כתבה (ברירת מחדל), 📊 דוח, 🐦 רשת חברתית, 🎙️ פודקאסט, 🏛️ מסמך רשמי
  card.appendChild(el('div', 'pa-source-head', `<span class="pa-source-icon">${src.icon || '📰'}</span><span class="pa-source-title">${src.title || ''}</span>`));
  const meta = [src.publisher, src.date].filter(Boolean).join(' · ');
  if (meta) card.appendChild(el('div', 'pa-source-meta', meta));
  card.appendChild(el('div', 'pa-source-body', ltrRanges(src.html)));
  return card;
}

function renderResource(res) {
  if (res.chart) return renderChart(res.chart);
  if (res.source) return renderSource(res.source);
  return el('div', 'block', res.html || '');
}

// ===== פריט אחד: טענה / בחירה / שאלה פתוחה =====
// ctx: { unitId, key, label, locked }
function renderItem(item, ctx) {
  const wrap = el('div', 'pa-item');
  if (item.label || item.claim) {
    const head = el('div', 'pa-item-head');
    if (item.label) head.appendChild(el('span', 'pa-item-label', item.label));
    if (item.claim) head.appendChild(el('div', 'pa-item-claim', ltrRanges(item.claim)));
    wrap.appendChild(head);
  }
  if (item.prompt) wrap.appendChild(el('div', 'pa-item-prompt', ltrRanges(item.prompt)));

  const saved = Store.getValue(ctx.key);
  const state = {
    choice: (saved && typeof saved === 'object') ? saved.choice || '' : '',
    text: (saved && typeof saved === 'object') ? saved.text || '' : (typeof saved === 'string' ? saved : ''),
  };
  const kind = item.kind || 'text';
  const options = kind === 'tf' ? ['נכון', 'לא נכון'] : (item.options || []);
  const controls = [];

  const commit = () => {
    const display = kind === 'text' ? state.text : [state.choice || '(לא נבחר)', state.text].filter(Boolean).join(' — ');
    Store.setValue(ctx.unitId, ctx.key, ctx.label, kind === 'text' ? state.text : { ...state }, display);
    wrap.dispatchEvent(new CustomEvent('pa-answer', { bubbles: true }));
  };

  if (kind !== 'text') {
    const row = el('div', 'pa-choices');
    row.setAttribute('role', 'radiogroup');
    options.forEach((opt, i) => {
      if (kind === 'tf' && i === 1) row.appendChild(el('span', 'pa-choice-sep', '/'));
      const b = el('button', 'pa-choice', opt);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(state.choice === opt));
      b.addEventListener('click', () => {
        state.choice = opt;
        row.querySelectorAll('.pa-choice').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
        commit();
      });
      row.appendChild(b);
      controls.push(b);
    });
    wrap.appendChild(row);
  }

  const ta = el('textarea', 'input-field pa-textarea');
  ta.rows = item.rows || (kind === 'text' ? 4 : 3);
  ta.placeholder = item.placeholder || (kind === 'text' ? 'כתבו כאן את התשובה' : '');
  ta.setAttribute('aria-label', kind === 'text' ? 'תשובה' : 'נימוק');
  ta.value = state.text;
  ta.addEventListener('input', () => { state.text = ta.value; commit(); });
  if (kind !== 'text') wrap.appendChild(el('div', 'pa-why-label', 'נימוק:'));
  wrap.appendChild(ta);
  controls.push(ta);

  if (item.model) {
    const model = buildModel(item.model, ctx.key);
    model.hidden = true;
    wrap.appendChild(model);
  }

  const setLocked = (on) => controls.forEach((c) => { c.disabled = on; });
  setLocked(true);
  wrap.classList.add('pa-loading');
  ready(ctx.unitId).then((changed) => {
    // ready() שמור לכל יחידה, ולכן changed נשאר true. מציירים מחדש פעם אחת בלבד,
    // אחרת הפריט החדש מצייר את עצמו שוב ושוב והדף נתקע.
    if (changed && wrap.isConnected && !ctx.refreshed) { wrap.replaceWith(renderItem(item, { ...ctx, refreshed: true })); return; }
    setLocked(!!ctx.locked);
    wrap.classList.remove('pa-loading');
  });

  wrap.isAnswered = () => (kind === 'text' ? state.text.trim() !== '' : state.choice !== '' && state.text.trim() !== '');
  return wrap;
}

// תשובה לדוגמה ומחוון (רשימת סימון). משמש גם את הפריט וגם את review.
function buildModel(m, key) {
  const model = el('div', 'pa-model');
  model.appendChild(el('div', 'pa-model-title', '✍️ תשובה לדוגמה'));
  model.appendChild(el('div', 'pa-model-answer', ltrRanges(m.answer)));
  if (m.rubric && m.rubric.length) {
    model.appendChild(el('div', 'pa-model-title', '✅ בדקו את התשובה שלכם: מה צריך להופיע'));
    const list = el('ul', 'pa-rubric');
    m.rubric.forEach((r) => {
      const li = el('li');
      const id = `rb-${key}-${Math.random().toString(36).slice(2, 7)}`;
      li.innerHTML = `<input type="checkbox" id="${id}"><label for="${id}">${r}</label>`;
      list.appendChild(li);
    });
    model.appendChild(list);
  }
  return model;
}

function revealModels(scope) {
  scope.querySelectorAll('.pa-model').forEach((m) => { m.hidden = false; });
}

// כפתור "תשובה לדוגמה" לחלק מסוים. אם עוד לא ענו על הכול, שואלים קודם.
function revealButton(scope, label = 'בדקו את עצמכם: הציגו תשובה לדוגמה') {
  const btn = el('button', 'btn btn-secondary pa-reveal-btn', label);
  btn.type = 'button';
  btn.addEventListener('click', () => {
    const items = [...scope.querySelectorAll('.pa-item')];
    const missing = items.filter((it) => it.isAnswered && !it.isAnswered()).length;
    if (missing && !confirm(`עוד לא עניתם על ${missing === 1 ? 'פריט אחד' : `${missing} פריטים`} (בחירה וגם נימוק). להציג את התשובה לדוגמה בכל זאת?`)) return;
    Store.flushAll();
    revealModels(scope);
    btn.remove();
  });
  return btn;
}

// ===== answer — פריט בודד בתוך שקף רגיל =====
function renderAnswer(block) {
  ensureStatusEl();
  const unitId = Store.currentUnitId();
  const wrap = el('div', 'block pa-answer');
  const itemEl = renderItem(block, { unitId, key: block.key, label: block.saveLabel || short(plain(block.claim || block.prompt || block.key)) });
  wrap.appendChild(itemEl);
  if (block.model) wrap.appendChild(revealButton(wrap, 'הציגו תשובה לדוגמה'));
  return wrap;
}

// ===== review — "סיימתי": התשובות שלכם, ולידן התשובה לדוגמה =====
// לתרגול של בגרות שלמה: בשקפים הקודמים יש שדות answer בלי model, כדי שלא
// יבדקו שאלה-שאלה. כאן, בסוף, הכול נפתח יחד.
// { type: 'review', items: [{ key, title, model: { answer, rubric } }] }
function answerText(v) {
  if (!v) return '';
  if (typeof v === 'object') return [v.choice, (v.text || '').trim()].filter(Boolean).join(' — ');
  return String(v).trim();
}

function renderReview(block) {
  ensureStatusEl();
  const unitId = Store.currentUnitId();
  const wrap = el('div', 'block pa-review');
  const btn = el('button', 'btn btn-primary', block.buttonLabel || 'סיימתי: הציגו את התשובות לדוגמה');
  btn.type = 'button';
  btn.addEventListener('click', async () => {
    Store.flushAll();
    btn.disabled = true;
    await ready(unitId);
    btn.disabled = false;
    const empty = block.items.filter((it) => !answerText(Store.getValue(it.key))).length;
    if (empty && !confirm(`עוד לא עניתם על ${empty === 1 ? 'סעיף אחד' : `${empty} סעיפים`}. להציג את התשובות לדוגמה בכל זאת?`)) return;
    btn.remove();
    block.items.forEach((it) => {
      const box = el('div', 'pa-review-item');
      box.appendChild(el('h3', 'pa-review-title', it.title));
      box.appendChild(el('div', 'pa-model-title', '📝 התשובה שלכם'));
      const mine = el('div', 'pa-review-mine');
      mine.textContent = answerText(Store.getValue(it.key)) || '(לא עניתם)';
      box.appendChild(mine);
      box.appendChild(buildModel(it.model, it.key));
      wrap.appendChild(box);
    });
  });
  wrap.appendChild(btn);
  return wrap;
}

// ===== itest — הכרטיס, ו"מסך הבחינה" שנפתח ממנו =====
export function allItems(block) {
  return block.questions.flatMap((q, qi) => q.parts.flatMap((p) => p.items.map((it) => ({ q, qi, p, it }))));
}
export function itemKey(block, it) { return `${block.key}-${it.id}`; }

function answeredCount(block) {
  return allItems(block).filter(({ it }) => {
    const v = Store.getValue(itemKey(block, it));
    if (!v) return false;
    return typeof v === 'object' ? !!(v.choice || (v.text || '').trim()) : String(v).trim() !== '';
  }).length;
}

function renderITest(block) {
  ensureStatusEl();
  const card = el('div', 'block pa-itest-card');
  card.appendChild(el('div', 'pa-itest-card-icon', '🖥️'));
  const body = el('div', 'pa-itest-card-body');
  body.appendChild(el('div', 'pa-itest-card-title', block.title || 'שאלה בסגנון הבגרות'));
  if (block.description) body.appendChild(el('div', 'pa-itest-card-desc', block.description));
  const status = el('div', 'pa-itest-card-status');
  const total = allItems(block).length;
  const refresh = () => {
    const n = answeredCount(block);
    status.textContent = n === 0 ? `${total} פריטים לענות עליהם` : `עניתם על ${n} מתוך ${total}`;
  };
  refresh();
  body.appendChild(status);
  const open = el('button', 'btn btn-primary', n0(block) ? 'המשיכו במסך הבחינה ←' : 'פתחו במסך הבחינה ←');
  open.type = 'button';
  open.addEventListener('click', () => openOverlay(block, () => {
    refresh();
    open.textContent = 'המשיכו במסך הבחינה ←';
  }));
  body.appendChild(open);
  card.appendChild(body);
  // ממתינים לסנכרון, ואז מעדכנים את הספירה (אולי ענו במכשיר אחר)
  ready(Store.currentUnitId()).then(refresh);
  return card;
}
function n0(block) { return answeredCount(block) > 0; }

// opts (למיני-בגרות, exam.js): locked — פונקציה שמחזירה true אחרי הגשה ·
// barExtra — רכיב בסרגל העליון (השעון) · afterQuestion(qPane, qi, isLast, rerender)
// — מוסיף משהו בתחתית השאלה (כפתור ההגשה) · itemFooter(item) — רכיב מתחת לפריט
// (הציון וההערה של המורה).
export function openOverlay(block, onClose, opts = {}) {
  const unitId = Store.currentUnitId();
  const overlay = el('div', 'pa-itest');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', block.title || 'מסך הבחינה');
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  // --- סרגל עליון ---
  const bar = el('div', 'pa-itest-bar');
  bar.appendChild(el('div', 'pa-itest-bar-title', block.title || ''));
  const nav = el('nav', 'pa-itest-nav');
  nav.setAttribute('aria-label', 'ניווט בין השאלות');
  bar.appendChild(nav);
  const close = el('button', 'pa-itest-close', 'סגירה ✕');
  close.type = 'button';
  if (opts.barExtra) bar.appendChild(opts.barExtra);
  bar.appendChild(close);
  overlay.appendChild(bar);

  // --- בטלפון: מעבר בין השאלה לגרפים ---
  const mobileTabs = el('div', 'pa-itest-mobile-tabs');
  const mQ = el('button', 'is-active', '📝 השאלה');
  const mR = el('button', '', '📊 גרפים ומקורות');
  [mQ, mR].forEach((b) => { b.type = 'button'; mobileTabs.appendChild(b); });
  overlay.appendChild(mobileTabs);

  const main = el('div', 'pa-itest-main');
  const qPane = el('section', 'pa-itest-q');
  const rPane = el('section', 'pa-itest-r');
  main.appendChild(qPane);
  main.appendChild(rPane);
  overlay.appendChild(main);

  mQ.addEventListener('click', () => { main.dataset.show = 'q'; mQ.classList.add('is-active'); mR.classList.remove('is-active'); });
  mR.addEventListener('click', () => { main.dataset.show = 'r'; mR.classList.add('is-active'); mQ.classList.remove('is-active'); });

  let current = 0;
  const navBtns = block.questions.map((q, qi) => {
    const b = el('button', 'pa-itest-nav-btn', q.navLabel || q.title || `שאלה ${qi + 1}`);
    b.type = 'button';
    b.addEventListener('click', () => show(qi));
    nav.appendChild(b);
    return b;
  });
  if (block.questions.length < 2) nav.hidden = true;

  function show(qi) {
    Store.flushAll();
    current = qi;
    navBtns.forEach((b, i) => b.classList.toggle('is-active', i === qi));
    const q = block.questions[qi];
    renderQuestionPane(q, qi);
    renderResourcesPane(q);
    qPane.scrollTop = 0;
  }

  function renderQuestionPane(q, qi) {
    qPane.innerHTML = '';
    if (q.header) qPane.appendChild(el('div', 'pa-itest-header', q.header));
    qPane.appendChild(el('h2', 'pa-itest-qtitle', `${q.title || `שאלה ${qi + 1}`}${q.points ? ` <span class="pa-points">(${q.points} נקודות)</span>` : ''}`));
    if (q.intro) qPane.appendChild(el('div', 'pa-itest-intro', ltrRanges(q.intro)));
    q.parts.forEach((p) => {
      const part = el('div', 'pa-part');
      const head = el('div', 'pa-part-head');
      head.appendChild(el('span', 'pa-part-label', `${p.label}.`));
      head.appendChild(el('div', 'pa-part-instruction', `${ltrRanges(p.instruction)}${p.points ? ` <span class="pa-points">(${p.points} נקודות)</span>` : ''}`));
      part.appendChild(head);
      p.items.forEach((it) => {
        const label = `${q.saveTitle || q.title || `שאלה ${qi + 1}`} · ${p.label}${it.label ? ` ${it.label}` : ''}: ${short(plain(it.claim || it.prompt || p.instruction))}`;
        part.appendChild(renderItem(it, { unitId, key: itemKey(block, it), label, locked: typeof opts.locked === 'function' ? opts.locked() : !!opts.locked }));
        const foot = opts.itemFooter && opts.itemFooter(it);
        if (foot) part.appendChild(foot);
      });
      qPane.appendChild(part);
    });
    const hasModels = q.parts.some((p) => p.items.some((it) => it.model));
    if (hasModels) qPane.appendChild(revealButton(qPane));
    if (qi < block.questions.length - 1) {
      const next = el('button', 'btn btn-primary pa-itest-next', `לשאלה הבאה ←`);
      next.type = 'button';
      next.addEventListener('click', () => show(qi + 1));
      qPane.appendChild(next);
    }
    if (opts.afterQuestion) opts.afterQuestion(qPane, qi, qi === block.questions.length - 1, () => show(qi));
  }

  function renderResourcesPane(q) {
    rPane.innerHTML = '';
    const res = q.resources || [];
    if (!res.length) { rPane.appendChild(el('p', 'muted', 'בשאלה הזו אין גרפים או מקורות.')); return; }
    const tabs = el('div', 'pa-res-tabs');
    tabs.setAttribute('role', 'tablist');
    const view = el('div', 'pa-res-view');
    const buttons = [];
    // הכפתורים: ['הכול', ...משאבים] כשיש יותר ממשאב אחד. i = אינדקס משאב, 1- = הכול
    const offset = res.length > 1 ? 1 : 0;
    const select = (i) => {
      const active = i === -1 ? 0 : i + offset;
      buttons.forEach((b, j) => b.setAttribute('aria-selected', String(j === active)));
      view.innerHTML = '';
      if (i === -1) {
        // כל המשאבים יחד, כמו בבחינה: לחיצה פותחת בגדול
        const grid = el('div', 'pa-res-grid');
        res.forEach((r, ri) => {
          const cell = el('button', 'pa-res-thumb');
          cell.type = 'button';
          cell.setAttribute('aria-label', `פתיחה בגדול: ${r.tab}`);
          cell.appendChild(el('div', 'pa-res-thumb-label', r.tab));
          cell.appendChild(renderResource(r));
          cell.addEventListener('click', () => select(ri));
          grid.appendChild(cell);
        });
        view.appendChild(grid);
        return;
      }
      const r = res[i];
      view.appendChild(renderResource(r));
      const zoom = el('button', 'btn btn-secondary pa-zoom-btn', '⤢ הגדלה למסך מלא');
      zoom.type = 'button';
      zoom.addEventListener('click', () => openZoom(r));
      view.appendChild(zoom);
    };
    if (res.length > 1) {
      const all = el('button', 'pa-res-tab', 'הכול');
      all.type = 'button';
      all.setAttribute('role', 'tab');
      all.addEventListener('click', () => select(-1));
      tabs.appendChild(all);
      buttons.push(all);
    }
    res.forEach((r, i) => {
      const b = el('button', 'pa-res-tab', r.tab);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => select(i));
      tabs.appendChild(b);
      buttons.push(b);
    });
    rPane.appendChild(tabs);
    rPane.appendChild(view);
    select(res.length > 1 ? -1 : 0);
  }

  function openZoom(r) {
    const z = el('div', 'pa-zoom');
    z.setAttribute('role', 'dialog');
    z.setAttribute('aria-label', r.tab);
    const inner = el('div', 'pa-zoom-inner');
    const x = el('button', 'pa-itest-close', 'סגירה ✕');
    x.type = 'button';
    inner.appendChild(x);
    inner.appendChild(renderResource(r));
    z.appendChild(inner);
    const done = () => z.remove();
    x.addEventListener('click', done);
    z.addEventListener('click', (e) => { if (e.target === z) done(); });
    overlay.appendChild(z);
    x.focus();
  }

  function shut() {
    Store.flushAll();
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    document.body.style.overflow = prevOverflow;
    if (onClose) onClose();
  }
  function onKey(e) {
    if (e.key !== 'Escape') return;
    const z = overlay.querySelector('.pa-zoom');
    if (z) z.remove(); else shut();
  }
  close.addEventListener('click', shut);
  document.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);
  show(0);
  close.focus();
}

export const BLOCKS = {
  itest: renderITest,
  answer: renderAnswer,
  review: renderReview,
  source: (block) => renderSource(block),
  chart: (block) => renderChart(block),
};
