// ===== מנוע רינדור שאלות: רב-ברירה / מספרי / התאמה =====
// שני מצבי הפעלה:
//  - "practice" (בתוך שיעור/מעבדה): משוב מיידי, ניסיון חוזר עם רמז, onSolved() כשנפתר.
//  - "exam" (במבחן): בחירה בלי חשיפה מיידית, ואז check()/reveal() בסיום המבחן.
// הוספת סוג שאלה חדש = הוספת מקרה כאן; שאר המנוע (unit-runner/quiz-runner) לא צריך להשתנות.
//
// שאלות "כתבי נוסחת אקסל" בטקסט חופשי הוסרו בכוונה — קשה מדי לכתוב תחביר
// מדויק בלי אקסל מול העיניים. תרגול נוסחאות נעשה עכשיו כ-mc: בוחרים בין
// כמה נוסחאות, כשהמסיחים משקפים טעויות נפוצות (טווח שגוי, פונקציה שגויה
// וכד').
//
// הרמזים המובנים (כשלא נכתב hint מפורש בתוכן) פונים בלשון התלמידה/תלמיד
// לפי student.gender — כל שאר הטקסט הפדגוגי בקבצי content/ נכתב בכוונה
// בלי לשון פנייה ישירה כדי שלא יצטרך שתי גרסאות.

import * as Progress from '../progress.js';
import { t } from './phrases.js';

function gender() {
  const s = Progress.getStudent();
  return (s && s.gender === 'm') ? 'm' : 'f';
}

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

// ===================== PRACTICE MODE =====================

function practiceMC(question, onSolved) {
  const wrap = el('div', 'question-block');
  wrap.appendChild(el('div', 'question-prompt', question.prompt));
  const opts = el('div', 'options');
  const feedback = el('div', 'feedback');
  let solved = false;

  question.options.forEach((opt) => {
    const btn = el('button', 'btn-option', opt.text);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      if (solved) return;
      if (opt.correct) {
        solved = true;
        btn.classList.add('correct');
        opts.querySelectorAll('.btn-option').forEach(b => b.disabled = true);
        feedback.className = 'feedback ok';
        feedback.textContent = 'כל הכבוד! 🎉 תשובה נכונה.';
        onSolved(true);
      } else {
        btn.classList.add('wrong');
        btn.disabled = true;
        feedback.className = 'feedback hint';
        feedback.textContent = opt.hint ? ('💡 ' + opt.hint) : t('try_again_hint', gender());
      }
    });
    opts.appendChild(btn);
  });

  wrap.appendChild(opts);
  wrap.appendChild(feedback);
  return wrap;
}

function practiceNumeric(question, onSolved) {
  const wrap = el('div', 'question-block');
  wrap.appendChild(el('div', 'question-prompt', question.prompt));
  const row = el('div', 'numeric-row');
  const input = el('input', 'input-field ltr-field');
  input.type = 'number';
  input.step = 'any';
  row.appendChild(input);
  if (question.unitLabel) row.appendChild(el('span', 'unit-label', question.unitLabel));
  const btn = el('button', 'btn btn-primary', 'בדקי');
  row.appendChild(btn);
  const feedback = el('div', 'feedback');
  let solved = false;

  const check = () => {
    if (solved) return;
    const val = parseFloat(input.value);
    if (Number.isNaN(val)) {
      feedback.className = 'feedback hint';
      feedback.textContent = 'צריך להזין מספר.';
      return;
    }
    const tolerance = question.tolerance || 0;
    if (Math.abs(val - question.answer) <= tolerance) {
      solved = true;
      feedback.className = 'feedback ok';
      feedback.textContent = 'כל הכבוד! 🎉 בדיוק נכון.';
      input.disabled = true;
      btn.disabled = true;
      onSolved(true);
    } else {
      feedback.className = 'feedback hint';
      feedback.textContent = question.hint ? ('💡 ' + question.hint) : t('check_again_hint', gender());
    }
  };
  btn.addEventListener('click', check);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });

  wrap.appendChild(row);
  wrap.appendChild(feedback);
  return wrap;
}

function practiceMatch(question, onSolved) {
  const wrap = el('div', 'question-block');
  wrap.appendChild(el('div', 'question-prompt', question.prompt));
  const grid = el('div', 'match-grid');
  const leftCol = el('div', 'match-col');
  const rightCol = el('div', 'match-col');
  const feedback = el('div', 'feedback');

  const pairs = question.pairs;
  const rightShuffled = pairs.map((p, i) => ({ text: p.right, pairIndex: i })).sort(() => Math.random() - 0.5);

  let selectedLeft = null;
  let matchedCount = 0;

  // נגישות מקלדת: כל פריט הוא div לחיץ (לא button, כדי לשלוט בעיצוב בקלות),
  // אז צריך tabindex + role + מקש Enter/רווח בנוסף ל-click.
  function makeSelectable(item, onActivate) {
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.addEventListener('click', onActivate);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); }
    });
  }

  pairs.forEach((p, i) => {
    const item = el('div', 'match-item', p.left);
    item.dataset.pairIndex = i;
    makeSelectable(item, () => {
      if (item.classList.contains('matched')) return;
      leftCol.querySelectorAll('.match-item').forEach(x => x.classList.remove('selected'));
      item.classList.add('selected');
      selectedLeft = i;
    });
    leftCol.appendChild(item);
  });

  rightShuffled.forEach((r) => {
    const item = el('div', 'match-item', r.text);
    item.dataset.pairIndex = r.pairIndex;
    makeSelectable(item, () => {
      if (item.classList.contains('matched') || selectedLeft === null) return;
      const leftItem = leftCol.querySelector(`.match-item[data-pair-index="${selectedLeft}"]`);
      if (String(r.pairIndex) === String(selectedLeft)) {
        leftItem.classList.remove('selected');
        leftItem.classList.add('matched');
        item.classList.add('matched');
        matchedCount++;
        selectedLeft = null;
        if (matchedCount === pairs.length) {
          feedback.className = 'feedback ok';
          feedback.textContent = 'כל הכבוד! 🎉 כל ההתאמות נכונות.';
          onSolved(true);
        }
      } else {
        item.classList.add('wrong');
        setTimeout(() => item.classList.remove('wrong'), 350);
        feedback.className = 'feedback hint';
        feedback.textContent = t('match_hint', gender());
      }
    });
    rightCol.appendChild(item);
  });

  grid.appendChild(leftCol);
  grid.appendChild(rightCol);
  wrap.appendChild(grid);
  wrap.appendChild(feedback);
  return wrap;
}

const PRACTICE_RENDERERS = {
  mc: practiceMC,
  numeric: practiceNumeric,
  match: practiceMatch,
};

// סוגי שאלה ייחודיים לקורס נרשמים לכאן מ-content/widgets/index.js — ראו
// ההסבר המקביל ב-blocks.js. סוג שנרשם רק ל-practice ולא ל-exam יתנהג
// בדיוק כמו 'match' היום: יעבוד בשיעור, ויציג אזהרה גלויה אם ינסו לשים
// אותו במבחן.
const EXAM_RENDERERS = {};

export function registerQuestionType(type, { practice, exam } = {}) {
  if (practice) PRACTICE_RENDERERS[type] = practice;
  if (exam) EXAM_RENDERERS[type] = exam;
}

// סוגי השאלות המוכרים, בהפרדה בין שיעור למבחן. 'mc' ו-'numeric' מטופלים
// ישירות ב-renderQuestionExam ולכן הם רשומים כאן במפורש; כל סוג נוסף
// למבחן מגיע מרישום של קורס.
export function getQuestionTypes() {
  return {
    practice: Object.keys(PRACTICE_RENDERERS),
    exam: ['mc', 'numeric', ...Object.keys(EXAM_RENDERERS)],
  };
}

export function renderQuestionPractice(question, onSolved) {
  const renderer = PRACTICE_RENDERERS[question.type];
  if (!renderer) {
    console.warn('סוג שאלה לא מוכר (practice):', question.type);
    return document.createDocumentFragment();
  }
  return renderer(question, onSolved);
}

// ===================== EXAM MODE =====================

export function renderQuestionExam(question, index) {
  const custom = EXAM_RENDERERS[question.type];
  if (custom) return custom(question, index, el);

  const wrap = el('div', 'question-block');
  // question.topic בכוונה לא מוצג כאן ליד השאלה עצמה (במבחנים מסוימים
  // זה כמעט נותן את התשובה) — הוא עדיין קיים כנתון, ומשמש רק בדיווח
  // שאחרי ההגשה (נושאים לחיזוק / לחזרה).
  wrap.appendChild(el('div', 'question-prompt', `${index + 1}. ${question.prompt}`));

  let getAnswer = () => null;
  let reveal = () => {};

  if (question.type === 'mc') {
    const opts = el('div', 'options');
    let selectedBtn = null;
    let selectedOpt = null;
    question.options.forEach((opt) => {
      const btn = el('button', 'btn-option', opt.text);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        opts.querySelectorAll('.btn-option').forEach(b => b.classList.remove('selected-exam'));
        btn.style.borderColor = 'var(--color-primary)';
        opts.querySelectorAll('.btn-option').forEach(b => { if (b !== btn) b.style.borderColor = ''; });
        selectedBtn = btn;
        selectedOpt = opt;
      });
      opts.appendChild(btn);
    });
    wrap.appendChild(opts);
    getAnswer = () => selectedOpt;
    reveal = () => {
      const isCorrect = !!(selectedOpt && selectedOpt.correct);
      opts.querySelectorAll('.btn-option').forEach((b, i) => {
        b.disabled = true;
        if (question.options[i].correct) b.classList.add('correct');
        else if (b === selectedBtn) b.classList.add('wrong');
      });
      return { isCorrect, userAnswerText: selectedOpt ? selectedOpt.text : '(לא נענתה)' };
    };
  } else if (question.type === 'numeric') {
    const row = el('div', 'numeric-row');
    const input = el('input', 'input-field ltr-field');
    input.type = 'number';
    input.step = 'any';
    row.appendChild(input);
    if (question.unitLabel) row.appendChild(el('span', 'unit-label', question.unitLabel));
    wrap.appendChild(row);
    getAnswer = () => input.value;
    reveal = () => {
      const val = parseFloat(input.value);
      const tolerance = question.tolerance || 0;
      const isCorrect = !Number.isNaN(val) && Math.abs(val - question.answer) <= tolerance;
      input.disabled = true;
      input.style.borderColor = isCorrect ? 'var(--success)' : 'var(--danger)';
      return { isCorrect, userAnswerText: input.value || '(לא נענתה)' };
    };
  } else {
    // לא שקט: 'match' (וכל סוג עתידי) נתמך במצב practice בלבד כרגע. שגיאה
    // מוצגת בגלוי במקום ניקוד שגוי שקט, כדי שמי שמוסיפה שאלה מהסוג הזה
    // למבחן תגלה מיד שזה לא נתמך, ולא תגלה חודשים אחר כך שציונים היו שגויים.
    console.warn('סוג שאלה לא נתמך במבחן:', question.type);
    wrap.appendChild(el('div', 'feedback hint', `⚠️ סוג השאלה "${question.type}" עדיין לא נתמך במצב מבחן — פני למורה.`));
    reveal = () => ({ isCorrect: false, userAnswerText: '(סוג שאלה לא נתמך)' });
  }

  return { el: wrap, getAnswer, reveal };
}
