// ===== "נגן" יחידת שיעור/מעבדה (סליידים) =====
// טוען את קובץ התוכן דינמית (code-splitting טבעי — כל תלמידה מורידה רק את
// היחידה שהיא נמצאת בה כרגע), ומרנדר אותו לפי הסכימה המשותפת (blocks + question).

import { renderBlocks } from './blocks.js';
import { renderQuestionPractice } from './question-types.js';
import { showCelebrateModal } from './celebrate.js';
import { setRoadmapScrollHint } from './scroll-hint.js';
import { getNextUnit } from '../../content/manifest.js';
import * as Progress from '../progress.js';

export async function runUnit(unit, container) {
  const mod = await import(`../../content/${unit.modulePath}`);
  const data = mod.default;

  // כל כניסה ליחידה מתחילה מהסליידה הראשונה — גם אם יש התקדמות שמורה
  // מביקור קודם שלא הושלם. "המשך מאיפה שעצרת" בלבל יותר משעזר: תלמידה
  // שחוזרת ליחידה (למשל לחזור על משהו) מצפה להתחיל מההתחלה, לא לנחות
  // באמצע בלי הקשר.
  let slideIndex = 0;

  function render(isFirstSlide) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'fade-in';

    const header = document.createElement('div');
    header.style.marginBottom = 'var(--space-4)';
    const pct = ((slideIndex + 1) / data.slides.length * 100).toFixed(0);
    header.innerHTML = `
      <a href="#roadmap" class="muted" style="text-decoration:none;font-size:0.85rem;">→ חזרה למסלול</a>
      <h1>${data.title || unit.title}</h1>
      <div class="overall-progress-track"><div class="overall-progress-fill" style="width:${pct}%;background:var(--${unit.colorVar})"></div></div>
      <div class="overall-progress-text">סליידה ${slideIndex + 1} מתוך ${data.slides.length}</div>
    `;
    wrap.appendChild(header);

    const card = document.createElement('div');
    card.className = 'card';
    const slide = data.slides[slideIndex];
    card.appendChild(renderBlocks(slide.blocks));

    let solved = !slide.question;
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'btn btn-primary btn-block';
    nextBtn.style.marginTop = 'var(--space-4)';
    nextBtn.textContent = slideIndex === data.slides.length - 1 ? 'סיימי יחידה 🏁' : 'הבא ←';
    nextBtn.disabled = !solved;

    if (slide.question) {
      const qEl = renderQuestionPractice(slide.question, () => {
        solved = true;
        nextBtn.disabled = false;
      });
      card.appendChild(qEl);
    }

    card.appendChild(nextBtn);
    wrap.appendChild(card);
    container.appendChild(wrap);
    if (isFirstSlide) {
      // כניסה טרייה ליחידה: גוללים לראש הדף, כדי שהכותרת (שם היחידה,
      // "חזרה למסלול") תיראה מיד — לא ממורכזים, כי זה בדיוק מה שהסתיר
      // אותה וגרם לבלבול על איזו יחידה בכלל נמצאים.
      window.scrollTo({ top: 0, behavior: 'instant' });
      // ושוב בפריים הבא. הקריאה הראשונה רצה לפני שהדפדפן סיים לפרוס את
      // התוכן החדש (גופן שנטען, טבלה שמתרחבת), ואם הפריסה משתנה אחריה
      // הדפדפן עלול להחזיר את הגלילה לאן שהייתה במסלול. החזרה הזו מבטיחה
      // שכניסה ליחידה תמיד מתחילה מההתחלה.
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    } else {
      // מעבר בין סליידות בתוך אותה יחידה: ממורכזים על התוכן החדש, לא
      // קופצים לראש כל היחידה — זה מה שהרגיש כ"עולה למעלה" במקום להראות
      // את החלק הבא. instant ולא smooth: smooth תלוי בלולאת אנימציה שלא
      // רצה כשהטאב לא פעיל, וגורם לגלילה "להיבלע" בלי אזהרה.
      //
      // אבל למרכז כרטיס שגבוה מהחלון = לדחוף את תחילת התוכן אל מעל קצה
      // המסך, והתלמידה נוחתת באמצע משפט בלי לדעת שפספסה את ההתחלה. זה
      // בולט במיוחד בטלפון, שם כמעט כל סליידה גבוהה מהמסך. לכן: ממרכזים
      // רק כשזה באמת נכנס, ואחרת מיישרים לראש הכרטיס.
      const rect = card.getBoundingClientRect();
      if (rect.height <= window.innerHeight - 24) {
        card.scrollIntoView({ behavior: 'instant', block: 'center' });
      } else {
        window.scrollTo({ top: window.scrollY + rect.top - 16, behavior: 'instant' });
      }
    }

    nextBtn.addEventListener('click', () => {
      if (slideIndex < data.slides.length - 1) {
        slideIndex++;
        Progress.saveProgress(unit.id, slideIndex);
        render(false);
      } else {
        Progress.markComplete(unit.id);
        const next = getNextUnit(unit.id);
        if (next) {
          setRoadmapScrollHint(next.chapterId === unit.chapterId
            ? { type: 'unit', id: next.id }
            : { type: 'chapter', id: next.chapterId });
        }
        showCelebrateModal({
          icon: '🎉',
          title: 'כל הכבוד! סיימת את היחידה',
          subtitle: data.title || unit.title,
          xpGained: 10,
          onClose: () => { location.hash = '#roadmap'; },
        });
      }
    });
  }

  render(true);
}
