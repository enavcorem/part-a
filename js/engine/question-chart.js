// ===== גרף בתוך שאלה מובנית (mc / numeric) =====
// שאלה מסוג 'mc' או 'numeric' יכולה להחזיק שדה chart: { type: '<בלוק רשום>', ... }
// והגרף מוצג מתחת לטקסט השאלה, מעל האפשרויות — גם בשיעור (practice) וגם במבחן.
//
// למה זה קובץ נפרד, ולמה בלי לגעת ב-question-types.js:
// לומדות של כרמל רושמות סוגים מותאמים ('chart-mc', 'q-box-mc', 'r-mc', ...) שעוטפים
// את mc/numeric, מוסיפים את הגרף בעצמם, וקוראים ל-renderQuestionExam({ ...q, type: 'mc' })
// עם אותו q (כולל chart). אילו הציור היה בתוך renderQuestionExam/renderQuestionPractice,
// הגרף היה מצויר פעמיים. לכן הציור נעשה כאן, ברמת מי שמציג שאלה מתוך התוכן
// (unit-runner, quiz-runner), ורק כשסוג השאלה בתוכן הוא 'mc' או 'numeric' ממש.
// סוג מותאם = המנוע מדלג, והעטיפה שלו אחראית על הגרף כמו קודם.

import { renderBlock } from './blocks.js';
import { renderQuestionPractice, renderQuestionExam } from './question-types.js';

const BUILTIN_TYPES = ['mc', 'numeric'];

// האובייקט chart אם צריך לצייר אותו כאן, אחרת null.
export function builtinQuestionChart(question) {
  if (!question || !BUILTIN_TYPES.includes(question.type)) return null;
  const c = question.chart;
  return c && typeof c === 'object' && typeof c.type === 'string' ? c : null;
}

// בלוק גרף עטוף ב-div משלו (לעיצוב). בלוק לא מוכר: renderBlock מחזיר ריק ומזהיר בקונסול.
function chartElement(chart) {
  const box = document.createElement('div');
  box.className = 'question-chart';
  try {
    box.appendChild(renderBlock(chart));
  } catch (e) {
    console.warn('גרף בשאלה לא נטען:', chart && chart.type, e);
  }
  return box;
}

function insertUnderPrompt(root, chart) {
  const box = chartElement(chart);
  // בלוק לא מוכר = מסגרת ריקה עם שוליים. לא מכניסים אותה (validate כבר מסמן שגיאה).
  if (!box.hasChildNodes()) return;
  const prompt = root.querySelector('.question-prompt');
  if (prompt) prompt.after(box);
  else root.prepend(box);
}

export function renderContentQuestionPractice(question, onSolved) {
  const root = renderQuestionPractice(question, onSolved);
  const chart = builtinQuestionChart(question);
  if (chart && root && root.querySelector) insertUnderPrompt(root, chart);
  return root;
}

export function renderContentQuestionExam(question, index) {
  const r = renderQuestionExam(question, index);
  const chart = builtinQuestionChart(question);
  if (chart && r && r.el) insertUnderPrompt(r.el, chart);
  return r;
}
