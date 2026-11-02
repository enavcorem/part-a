// ===== גרפים ומקורות בתוך שאלת מבחן =====
// שאלת מבחן במנוע היא טקסט (HTML) בלבד. כדי להציג בה גרף בלי לשנות את המנוע:
// בתוך ה-prompt שמים "חריץ" קטן — chartSlot('a') — וכאן ממלאים אותו בגרף.
// ה-prompt נשמר במסד כמו שהוא (question_text), ולכן שומרים בו רק את החריץ
// עם שם הגרף כטקסט, ולא את כל ה-SVG. מחוץ ללומדה (למשל בלוח המורה) רואים את השם.
//
// בקובץ המבחן:
//   registerCharts({ a: { kind: 'bar', title, categories, series, ... } });
//   prompt: `${chartSlot('a')}הטענה: ...`
//   כמה גרפים בשאלה אחת: chartSlot('b1,b2')
//   מקור מידע (כרטיס כמו בבלוק source): registerCharts({ s1: { card: { title, publisher, html } } })

import { renderChart } from './chart.js';
import { renderSource } from './itest.js';

const REGISTRY = new Map();

export function registerCharts(specs) {
  Object.entries(specs).forEach(([id, spec]) => REGISTRY.set(id, spec));
}

export function chartSlot(ids) {
  const names = ids.split(',').map((id) => {
    const spec = REGISTRY.get(id);
    return spec?.card ? `מקור: ${spec.card.title}` : `גרף: ${spec?.title || id}`;
  }).join(' · ');
  return `<div class="pa-qchart" data-chart="${ids}">(${names})</div>`;
}

function fill(root) {
  if (!root.querySelectorAll) return;
  const sel = '.pa-qchart[data-chart]:not([data-filled])';
  const slots = [...root.querySelectorAll(sel)];
  if (root.matches(sel)) slots.push(root);
  slots.forEach((slot) => {
    const specs = slot.dataset.chart.split(',').map((id) => REGISTRY.get(id)).filter(Boolean);
    if (!specs.length) return;
    slot.dataset.filled = '1';
    slot.innerHTML = '';
    specs.forEach((spec) => slot.appendChild(spec.card ? renderSource(spec.card) : renderChart(spec)));
  });
}

// ממלאים כל חריץ שנכנס לדף, בכל מקום (שאלה, סיכום בסוף המבחן).
// validate-content רץ ב-node, בלי document, ולכן הבדיקה.
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  new MutationObserver((records) => {
    records.forEach((r) => r.addedNodes.forEach((n) => { if (n.nodeType === 1) fill(n); }));
  }).observe(document.documentElement, { childList: true, subtree: true });
}
