// ===== מנוע רינדור "בלוקים" — טקסט/מושג/דוגמה/מוקש/טבלה/גרף/סרטון =====
// כל יחידת תוכן (content/chX/*.js) מתארת סליידים כרשימת בלוקים כאלה;
// זה המקום היחיד שיודע איך להפוך אובייקט בלוק ל-HTML בפועל.
// הוספת סוג בלוק חדש = הוספת מקרה אחד כאן, לא שינוי בקבצי התוכן הקיימים.

import { tv } from './phrases.js';

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function renderText(block) {
  const wrap = el('div', 'block');
  wrap.innerHTML = block.html || `<p>${block.text || ''}</p>`;
  return wrap;
}

function renderBox(block, variant, icon) {
  const wrap = el('div', `box box-${variant} block`);
  const iconEl = el('div', 'box-icon', icon);
  const body = el('div');
  if (block.title) body.appendChild(el('div', 'box-title', block.title));
  body.appendChild(el('div', 'box-body', block.body || block.html || ''));
  wrap.appendChild(iconEl);
  wrap.appendChild(body);
  return wrap;
}

function renderTable(block) {
  const wrap = el('div', 'block table-scroll');
  const table = el('table', 'content-table');
  if (block.headers) {
    const thead = el('thead');
    const tr = el('tr');
    block.headers.forEach(h => tr.appendChild(el('th', null, h)));
    thead.appendChild(tr);
    table.appendChild(thead);
  }
  const tbody = el('tbody');
  (block.rows || []).forEach(row => {
    const tr = el('tr');
    row.forEach(cell => {
      const cellObj = (typeof cell === 'object' && cell !== null) ? cell : { text: cell };
      const td = el('td', cellObj.highlight ? `highlight-${cellObj.highlight}` : null, String(cellObj.text ?? cellObj));
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  // רמז ויזואלי (צל בקצה) רק כשהטבלה באמת רחבה מהמסך — כדי שגלילה
  // אופקית תהיה מורגשת ולא "שקטה" (זה בדיוק מה שהסתיר תשובה בשאלה
  // עם טבלה, לפני שהתגלה ותוקן).
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (wrap.scrollWidth > wrap.clientWidth + 1) wrap.classList.add('has-scroll');
    });
  });
  return wrap;
}

function renderChartBar(block) {
  const wrap = el('div', 'block');
  // gapless: true → עמודות נוגעות זו בזו (היסטוגרמה, נתון רציף/מקובץ).
  // בלי הדגל, יש רווח בין עמודות (גרף עמודות רגיל, נתון בדיד/קטגוריאלי).
  // ltr בכוונה: גרף (כמו ציר מספרים) קורא משמאל לימין תמיד, גם בעמוד RTL —
  // אחרת סדר העמודות מתהפך ביחס לסדר הנתונים (אותה בעיה שכבר נפתרה
  // בתרשים הקופסה למטה).
  const chart = el('div', block.gapless ? 'chart-bar gapless ltr' : 'chart-bar ltr');
  const data = block.data || [];
  // maxOverride: לזוגות גרפים "לפני/אחרי" שצריך להשוות זה לזה על אותו
  // סרגל (למשל במעבדה — אחרת כל גרף מתנרמל לגובה המקסימלי שלו בנפרד,
  // וההבדל האמיתי בין "לפני" ל"אחרי" לא נראה בכלל).
  const max = typeof block.maxOverride === 'number' ? block.maxOverride : Math.max(...data.map(d => d.value), 1);
  data.forEach(d => {
    const col = el('div', 'chart-bar-col');
    const fill = el('div', 'chart-bar-fill');
    fill.style.height = '0%';
    fill.style.background = block.color ? `var(--chapter-${block.color})` : 'var(--color-primary)';
    col.appendChild(el('div', 'chart-bar-value', String(d.value)));
    col.appendChild(fill);
    col.appendChild(el('div', 'chart-bar-label', d.label));
    chart.appendChild(col);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { fill.style.height = (d.value / max * 100) + '%'; });
    });
  });
  wrap.appendChild(chart);
  return wrap;
}

function renderBoxPlot(block) {
  // תרשים קופסה פשוט: min/q1/median/q3/max ל-% אופקי, תמיד LTR (ציר מספרים
  // עולה מימין לשמאל ב-RTL יבלבל) — כמו נוסחאות, זו קונבנציה מתמטית בין-לאומית.
  const { min, q1, median, q3, max } = block;
  const range = (max - min) || 1;
  const pct = (v) => ((v - min) / range) * 100;
  const wrap = el('div', 'block');
  const plot = el('div', 'box-plot ltr');
  plot.innerHTML = `
    <div class="box-plot-line"></div>
    <div class="box-plot-box" style="left:${pct(q1)}%;right:${100 - pct(q3)}%;"></div>
    <div class="box-plot-median" style="left:${pct(median)}%;"></div>
    <div class="box-plot-cap" style="left:${pct(min)}%;"></div>
    <div class="box-plot-cap" style="left:${pct(max)}%;"></div>
  `;
  wrap.appendChild(plot);
  const labels = el('div', 'box-plot-labels ltr');
  labels.innerHTML = [
    ['Min', min], ['Q1', q1], ['Median', median], ['Q3', q3], ['Max', max],
  ].map(([l, v]) => `<span>${l}<br><strong>${v}</strong></span>`).join('');
  wrap.appendChild(labels);
  return wrap;
}

function renderVideo(block) {
  if (!block.url) return document.createDocumentFragment();
  const wrap = el('div', 'block');
  const facade = el('div', 'video-block');
  facade.appendChild(el('div', 'video-play', '▶'));
  facade.setAttribute('role', 'button');
  facade.setAttribute('tabindex', '0');
  facade.setAttribute('aria-label', 'הפעלת סרטון: ' + (block.caption || ''));
  const play = () => {
    const iframe = el('iframe');
    iframe.src = block.url + (block.url.includes('?') ? '&' : '?') + 'autoplay=1';
    iframe.style.cssText = 'width:100%;height:100%;border:0;position:absolute;inset:0;';
    iframe.allow = 'autoplay; encrypted-media';
    iframe.allowFullscreen = true;
    facade.innerHTML = '';
    facade.style.position = 'relative';
    facade.appendChild(iframe);
  };
  facade.addEventListener('click', play);
  facade.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') play(); });
  wrap.appendChild(facade);
  if (block.caption) wrap.appendChild(el('div', 'video-caption', block.caption));
  return wrap;
}

// שדה כתיבה שנשמר (open: true בלוח המורה). הקוד ב-open-answer.js נטען רק
// כשיש בלוק כזה בשקף, כדי שלומדות שלא משתמשות בו לא ישתנו בכלום.
function renderOpenAnswer(block) {
  const wrap = el('div', 'block oa-answer oa-loading');
  import('./open-answer.js')
    .then((m) => m.renderOpenAnswer(block, wrap))
    .catch((e) => { console.warn('open-answer לא נטען:', e); wrap.textContent = tv('oa_load_failed'); });
  return wrap;
}

const RENDERERS = {
  text: renderText,
  'open-answer': renderOpenAnswer,
  concept: (b) => renderBox(b, 'concept', b.icon || '💡'),
  example: (b) => renderBox(b, 'example', b.icon || '🔍'),
  trap: (b) => renderBox(b, 'trap', b.icon || '⚠️'),
  table: renderTable,
  'chart-bar': renderChartBar,
  'box-plot': renderBoxPlot,
  video: renderVideo,
};

// ===== רישום בלוקים ייחודיים לקורס =====
// המנוע הזה משותף לכל הלומדות (סטטיסטיקה, XLOOKUP, והבאות), ולכן הוא לא
// מכיר סוגי בלוק שרלוונטיים רק לנושא אחד. קורס שצריך בלוק משלו (למשל
// ההנפשה של XLOOKUP) רושם אותו מ-content/widgets/index.js. כך js/ ו-css/
// נשארים זהים בין כל הקורסים — אפשר להחליף אותם במלואם בשדרוג בלי לאבד
// שום דבר שנכתב לקורס מסוים.
export function registerBlockRenderer(type, renderer) {
  if (RENDERERS[type]) console.warn('רישום בלוק דורס סוג קיים:', type);
  RENDERERS[type] = renderer;
}

// רשימת סוגי הבלוקים המוכרים כרגע (מנוע + מה שהקורס רשם). משמשת את
// tools/validate-content.mjs כדי לבדוק תוכן בלי להחזיק רשימה מקבילה
// שתשכח להתעדכן.
export function getBlockTypes() {
  return Object.keys(RENDERERS);
}

export function renderBlock(block) {
  const renderer = RENDERERS[block.type];
  if (!renderer) {
    console.warn('סוג בלוק לא מוכר:', block.type);
    return document.createDocumentFragment();
  }
  return renderer(block);
}

export function renderBlocks(blocks) {
  const frag = document.createDocumentFragment();
  (blocks || []).forEach(b => frag.appendChild(renderBlock(b)));
  return frag;
}
