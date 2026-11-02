// ===== מקור האמת היחיד למבנה הקורס =====
// כל פרק ויחידה מוגדרים כאן פעם אחת. גם מפת המסלול וגם לוגיקת הנעילה
// קוראות מהרשימה הזאת בלבד. להוספת יחידה: אובייקט חדש ל-units + קובץ
// תוכן תחת content/chX/. אין צורך לגעת בשום קובץ אחר.

// ⚠️ מזהה הקורס. ממנו נגזרים מפתחות ה-localStorage של התלמידות
// ('parta_data_v3' ו-'parta_current_key_v3'). שינוי הערך כאן
// אחרי שתלמידות כבר נכנסו = התקדמות שנראית להן כאילו נמחקה.
export const COURSE_ID = 'parta';

export const COURSE = {
  title: 'לומדת חלק א׳ — גרפים ומקורות',
  icon: '📈',
  welcome: {
    f: 'ברוכה הבאה ללומדת חלק א׳! 📈',
    m: 'ברוך הבא ללומדת חלק א׳! 📈',
  },
  finaleText: 'סיימת את כל יחידות הלומדה 📈',
  teacherTitle: '📈 לוח מורה — לומדת חלק א׳ (גרפים ומקורות)',

  // גבעול: את חלק א' מלמדת המורה השנייה, ויכולה להציג במקרן (?class=1).
  classMode: true,
};

// לשון: התוכן כתוב ברבים ("בחרו", "נמקו"), כמו בבגרות. כך הוא מתאים
// גם לצביה (בנות) וגם לגבעול (בנים).
// כל הנתונים בגרפים ובמקורות מומצאים. על הבחינות ב-testbox כתוב "אין
// להעתיק או לפרסם", ולכן שאלות אמיתיות מופיעות רק כקישור (פרק 3).
export const CHAPTERS = [
  {
    id: 'pa-ch1',
    number: 1,
    title: 'גרפים',
    icon: '📈',
    colorVar: 'chapter-1',
    units: [
      { id: 'pa-ch1-u1', title: 'איך נראית שאלת גרפים', type: 'lesson', icon: '🖥️', estMinutes: 8, modulePath: 'ch1/ch1-u1-anatomy.js' },
      { id: 'pa-ch1-u2', title: 'פענוח גרף, צעד אחר צעד', type: 'lesson', icon: '🔎', estMinutes: 18, modulePath: 'ch1/ch1-u2-decode.js' },
      { id: 'pa-ch1-u3', title: 'גרפים מורכבים', type: 'lesson', icon: '🧩', estMinutes: 18, modulePath: 'ch1/ch1-u3-complex.js' },
      { id: 'pa-ch1-u4', title: 'נכון או לא נכון: נימוק מלא', type: 'lesson', icon: '✍️', estMinutes: 12, modulePath: 'ch1/ch1-u4-full-answer.js' },
      { id: 'pa-ch1-u5', title: 'המוקשים בטענות', type: 'lesson', icon: '⚠️', estMinutes: 18, modulePath: 'ch1/ch1-u5-traps.js' },
      { id: 'pa-ch1-u6', title: 'מדדים מתוך גרף', type: 'lesson', icon: '📏', estMinutes: 12, modulePath: 'ch1/ch1-u6-measures.js' },
      { id: 'pa-ch1-u7', title: 'סימולציה: שאלת גרפים', type: 'lab', icon: '🎯', estMinutes: 20, modulePath: 'ch1/ch1-u7-simulation.js' },
      { id: 'pa-ch1-quiz', title: 'מבחן פרק: גרפים', type: 'quiz', icon: '📝', estMinutes: 10, modulePath: 'ch1/ch1-quiz.js' },
    ],
  },
  {
    id: 'pa-ch2',
    number: 2,
    title: 'מקורות',
    icon: '📰',
    colorVar: 'chapter-2',
    units: [
      { id: 'pa-ch2-u1', title: 'פענוח מקור, צעד אחר צעד', type: 'lesson', icon: '🔎', estMinutes: 12, modulePath: 'ch2/ch2-u1-decode.js' },
      { id: 'pa-ch2-u2', title: 'מקור מול גרף: תומך, סותר, משלים או לא קשור', type: 'lesson', icon: '🔗', estMinutes: 15, modulePath: 'ch2/ch2-u2-relations.js' },
      { id: 'pa-ch2-u3', title: 'הסבר, השלמה והמלצה', type: 'lesson', icon: '💡', estMinutes: 15, modulePath: 'ch2/ch2-u3-explain.js' },
      { id: 'pa-ch2-u4', title: 'סימולציה: שאלת מקורות', type: 'lab', icon: '🎯', estMinutes: 20, modulePath: 'ch2/ch2-u4-simulation.js' },
      { id: 'pa-ch2-quiz', title: 'מבחן פרק: מקורות', type: 'quiz', icon: '📝', estMinutes: 10, modulePath: 'ch2/ch2-quiz.js' },
    ],
  },
  {
    // תרגול על שאלות אמיתיות, כבגרות שלמה ולא שאלה-שאלה, ובסוף המיני-בגרות של 25.11.
    id: 'pa-ch3',
    number: 3,
    title: 'תרגול לקראת המבחן',
    icon: '🏛️',
    colorVar: 'chapter-3',
    // בלי סדר בתוך הפרק: המיני-בגרות נפתחת גם למי שלא עשתה את התרגול. ביום המבחן
    // המורה פותחת את הלומדה לכיתה ("🔓 הכול פתוח"), וכך מגיעים לפרק 3 גם בלי פרקים 1-2.
    unordered: true,
    units: [
      { id: 'pa-ch3-u1', title: 'תרגול בגרות: 2024, שאלות 2 ו-3', type: 'lab', icon: '⏱️', estMinutes: 60, modulePath: 'ch3/ch3-u1-practice.js' },
      { id: 'pa-ch3-u2', title: 'מפת שאלות מהבגרויות', type: 'lesson', icon: '🗺️', estMinutes: 5, modulePath: 'ch3/ch3-u2-map.js' },
      // המיני-בגרות של 25.11: נעולה בקוד מהמורה. ביום המבחן פותחים את הלומדה לכיתה בלוח.
      { id: 'pa-ch3-u3', title: 'מיני-בגרות 25.11: חלק א׳', type: 'lab', icon: '🏛️', estMinutes: 45, modulePath: 'ch3/ch3-u3-exam.js' },
    ],
  },
];

// ===== עזרי מניפסט =====
// לוגיקה גנרית שלא תלויה בקורס. המנוע מייבא את הפונקציות האלה מהמניפסט,
// ולכן הן חייבות להיות מיוצאות מכאן בכל לומדה. new-course.mjs מוסיף אותן
// אוטומטית — אין צורך לכתוב או לערוך אותן ביד.

export function getFlatUnits() {
  const flat = [];
  CHAPTERS.forEach(ch => {
    ch.units.forEach(u => {
      flat.push({ ...u, chapterId: ch.id, chapterNumber: ch.number, chapterTitle: ch.title, colorVar: ch.colorVar });
    });
  });
  return flat;
}

export function findUnit(unitId) {
  return getFlatUnits().find(u => u.id === unitId) || null;
}

export function findChapter(chapterId) {
  return CHAPTERS.find(ch => ch.id === chapterId) || null;
}

// היחידה שבאה מיד אחרי unitId ברצף הכולל (לא לפי שם, לפי הסדר במניפסט) —
// null אם זו היחידה האחרונה בקורס (המבחן המסכם).
export function getNextUnit(unitId) {
  const flat = getFlatUnits();
  const idx = flat.findIndex(u => u.id === unitId);
  if (idx === -1 || idx === flat.length - 1) return null;
  return flat[idx + 1];
}

// הפרק שבא מיד אחרי chapterId — null אם זה הפרק האחרון.
export function getNextChapter(chapterId) {
  const idx = CHAPTERS.findIndex(ch => ch.id === chapterId);
  if (idx === -1 || idx === CHAPTERS.length - 1) return null;
  return CHAPTERS[idx + 1];
}
