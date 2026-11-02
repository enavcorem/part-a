// ===== לשון פנייה (נקבה/זכר) לכמה מחרוזות "חמות" בממשק =====
//
// רוב התוכן הפדגוגי בקבצי content/ נכתב בכוונה בגוף שלישי/רבים-נייטרלי או
// בעבר (לא מסמן מגדר בכתיב לא-מנוקד), כדי שיתאים לכל כיתה בלי כפילות.
// אבל כמה משפטי "חום" ישירים (מסך הכניסה, כפתור התחלה) נשמעים הרבה יותר
// טוב כשהם פונים בלשון ספציפית. כאן יש להם שתי גרסאות, ובורר אחד לפי
// student.gender ('f' כברירת מחדל, או 'm').

import { COURSE } from '../../content/manifest.js';

const PHRASES = {
  // הברכה היחידה שתלויה בקורס — מגיעה מ-content/manifest.js, לא מכאן.
  welcome_title: COURSE.welcome,
  start_btn: {
    f: 'בואי נתחיל! 🚀',
    m: 'בוא נתחיל! 🚀',
  },
  try_again_hint: {
    f: 'לא בדיוק — נסי שוב.',
    m: 'לא בדיוק — נסה שוב.',
  },
  check_again_hint: {
    f: 'עוד לא מדויק — נסי לבדוק שוב את החישוב.',
    m: 'עוד לא מדויק — נסה לבדוק שוב את החישוב.',
  },
  match_hint: {
    f: 'לא מתאים — נסי זוג אחר.',
    m: 'לא מתאים — נסה זוג אחר.',
  },
};

export function t(key, gender) {
  const entry = PHRASES[key];
  if (!entry) { console.warn('phrase missing:', key); return ''; }
  return entry[gender === 'm' ? 'm' : 'f'];
}
