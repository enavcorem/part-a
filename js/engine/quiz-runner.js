// ===== "נגן" מבחן — מבחן פרק רגיל, מבחן מסכם, ואתגר-פטור (אותו מנוע, מצב שונה) =====

import { renderQuestionExam } from './question-types.js';
import { showCelebrateModal, fireConfetti } from './celebrate.js';
import { setRoadmapScrollHint } from './scroll-hint.js';
import { getNextUnit, getNextChapter } from '../../content/manifest.js';
import * as Progress from '../progress.js';

const PASS_MARK_DEFAULT = 80;

export async function runQuiz(unit, container) {
  const mod = await import(`../../content/${unit.modulePath}`);
  const data = mod.default;
  const isExemption = unit.type === 'exemption';
  const passMark = data.passMark || PASS_MARK_DEFAULT;

  const wrap = document.createElement('div');
  wrap.className = 'fade-in';

  const header = document.createElement('div');
  header.style.marginBottom = 'var(--space-4)';
  header.innerHTML = `
    <a href="#roadmap" class="muted" style="text-decoration:none;font-size:0.85rem;">→ חזרה למסלול</a>
    <h1>${data.title || unit.title}</h1>
    ${isExemption
      ? `<p class="muted">ציון ${passMark}+ יזכה אותך בפטור מהיחידות של הפרק, ויפתח את הפרק הבא. פחות מזה? לא נורא — נחזור על השיעור הקצר. אפשר לנסות שוב בהמשך.</p>`
      : `<p class="muted">${data.questions.length} שאלות · ענו על כולן ולחצו על "בדיקת המבחן" בסוף.</p>`}
  `;
  wrap.appendChild(header);

  const card = document.createElement('div');
  card.className = 'card';

  const rendered = data.questions.map((q, i) => renderQuestionExam(q, i));
  rendered.forEach(r => card.appendChild(r.el));

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'btn btn-primary btn-block';
  submitBtn.style.marginTop = 'var(--space-4)';
  submitBtn.textContent = 'בדיקת המבחן ✓';
  card.appendChild(submitBtn);

  const resultArea = document.createElement('div');
  card.appendChild(resultArea);

  wrap.appendChild(card);
  container.innerHTML = '';
  container.appendChild(wrap);
  window.scrollTo({ top: 0, behavior: 'instant' });

  submitBtn.addEventListener('click', () => {
    const results = rendered.map((r, i) => ({ ...r.reveal(), question: data.questions[i] }));
    const correctCount = results.filter(r => r.isCorrect).length;
    const score = results.length ? Math.round((correctCount / results.length) * 100) : 0;
    submitBtn.disabled = true;

    Progress.saveQuizAnswers(unit.id, results.map((r, i) => ({
      question_number: i + 1,
      question_text: r.question.prompt,
      answer_given: r.userAnswerText,
      is_correct: r.isCorrect,
    })));

    resultArea.innerHTML = '';
    const passed = score >= passMark;
    const circle = document.createElement('div');
    circle.className = 'score-circle ' + (passed ? 'pass' : 'fail') + ' pop-in';
    circle.innerHTML = `<div class="score-num">${score}</div><div class="score-label">מתוך 100</div>`;
    resultArea.appendChild(circle);

    const mistakes = results.filter(r => !r.isCorrect);
    if (mistakes.length === 0) {
      resultArea.appendChild(Object.assign(document.createElement('div'), { className: 'all-correct', textContent: 'מושלם! כל התשובות נכונות 🌟' }));
    } else if (isExemption) {
      // באתגר פטור התלמידה עוברת בכל מקרה לשיעור אם לא הצליחה — לכן העיקר
      // הוא לא "מה טעית", אלא איזה נושאים כדאי לתת בהם תשומת לב מיוחדת
      // כשעוברים על השיעור. פירוט שאלה-שאלה לא מוסיף כאן הרבה.
      const topics = [...new Set(mistakes.map(m => m.question.topic || 'כללי'))];
      const report = document.createElement('div');
      report.className = 'mistake-report';
      report.appendChild(Object.assign(document.createElement('h3'), { textContent: 'נושאים שכדאי לחזור עליהם בשיעור:' }));
      const topicRow = document.createElement('div');
      topicRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';
      topics.forEach(t => topicRow.appendChild(Object.assign(document.createElement('span'), { className: 'question-topic-tag', textContent: t })));
      report.appendChild(topicRow);
      resultArea.appendChild(report);
    } else {
      const report = document.createElement('div');
      report.className = 'mistake-report';
      report.appendChild(Object.assign(document.createElement('h3'), { textContent: 'כדאי לחזק:' }));
      mistakes.forEach(m => {
        const item = document.createElement('div');
        item.className = 'mistake-item';
        item.innerHTML = `${m.question.topic ? `<div class="question-topic-tag">${m.question.topic}</div>` : ''}<div class="mi-q">${m.question.prompt}</div>${m.question.explanation ? `<div class="mi-expl">💡 ${m.question.explanation}</div>` : ''}`;
        report.appendChild(item);
      });
      resultArea.appendChild(report);
    }

    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.className = 'btn btn-primary btn-block';
    continueBtn.style.marginTop = 'var(--space-4)';
    resultArea.appendChild(continueBtn);

    if (isExemption) {
      // עוברת בפעם אחת מכמה יחידות ל-"exempted" — לכן ה-XP שמתקבל תלוי כמה
      // מהיחידות בפרק עדיין לא היו מושלמות. מודדים בפועל לפני/אחרי במקום
      // לנחש מספר קבוע, כדי שהתג שמוצג לתלמידה יהיה נכון תמיד.
      const xpBefore = Progress.computeXP();
      Progress.saveExemptionAttempt(unit.chapterId, score, passed);
      const xpGained = Progress.computeXP() - xpBefore;
      continueBtn.textContent = passed ? 'יאללה, לשלב הבא! 🚀' : 'קדימה, לשיעור הקצר 📖';
      continueBtn.addEventListener('click', () => {
        if (passed) {
          // "עושים פתור לפרק אז ממרכזים את הפרק הבא" — לא את היחידה הבודדת.
          const nextChapter = getNextChapter(unit.chapterId);
          if (nextChapter) setRoadmapScrollHint({ type: 'chapter', id: nextChapter.id });
          showCelebrateModal({ icon: '🏅', title: 'פטור התקבל בהצלחה!', subtitle: 'עברת את אתגר הפטור', xpGained, onClose: () => { location.hash = '#roadmap'; } });
        } else {
          location.hash = '#roadmap';
        }
      });
    } else if (unit.isGrandFinale) {
      continueBtn.textContent = 'אל מסך הסיום 🏆';
      continueBtn.addEventListener('click', () => {
        Progress.markComplete(unit.id);
        location.hash = '#grand-finale';
      });
    } else {
      Progress.markComplete(unit.id);
      const next = getNextUnit(unit.id);
      if (next) {
        setRoadmapScrollHint(next.chapterId === unit.chapterId
          ? { type: 'unit', id: next.id }
          : { type: 'chapter', id: next.chapterId });
      }
      continueBtn.textContent = 'חזרה למסלול';
      continueBtn.addEventListener('click', () => {
        showCelebrateModal({ icon: passed ? '🎉' : '💪', title: passed ? 'כל הכבוד!' : 'סיימת את המבחן', subtitle: data.title || unit.title, xpGained: 20, onClose: () => { location.hash = '#roadmap'; } });
      });
    }

    resultArea.scrollIntoView({ behavior: 'instant', block: 'center' });
    if (passed || !isExemption) fireConfetti(passed ? 26 : 10);
  });
}
