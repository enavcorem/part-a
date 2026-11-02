// ===== כל הלומדות של המגמה — לתפריט "מעבר ללומדה" בלוח המורה =====
// חשבון מורה, הכיתות והתלמידים משותפים לכל הלומדות (פרויקט Supabase אחד),
// כך שאותה כניסה פותחת את לוח המורה בכל אחת מהן.
// לומדה חדשה = שורה כאן + שורה ב-lomdas.mjs (check-all בודק ששתי הרשימות תואמות),
// ואז sync-engine לכל הלומדות.
// grade: הקבוצה בתפריט. url: null = עוד לא פורסמה, ולא מוצג קישור.

export const COURSES = [
  { id: 'stat', title: 'סטטיסטיקה', icon: '📊', grade: 'י״א', url: 'https://enavcorem.github.io/statistics-learning/' },
  { id: 'xlookup', title: 'XLOOKUP', icon: '🔗', grade: 'י״א', url: 'https://enavcorem.github.io/xlookup-learning/' },
  { id: 'func', title: 'ארגז הכלים — פונקציות', icon: '🧰', grade: 'י״א', url: 'https://enavcorem.github.io/functions-learning/' },
  // אתר אחד, שלוש לומדות: enavcorem.github.io/excel/<id>/
  { id: 'percent', title: 'אחוזים', icon: '🧮', grade: 'י״א', url: 'https://enavcorem.github.io/excel/percent/' },
  { id: 'dates', title: 'תאריכים', icon: '📅', grade: 'י״א', url: 'https://enavcorem.github.io/excel/dates/' },
  { id: 'pivot', title: 'פיבוט מתקדם', icon: '🥧', grade: 'י״א', url: 'https://enavcorem.github.io/excel/pivot/' },
  { id: 'parta', title: 'חלק א׳: גרפים ומקורות', icon: '📈', grade: 'י״א', url: 'https://enavcorem.github.io/part-a-learning/' },
  { id: 'client', title: 'הלקוח שלנו (י״ב)', icon: '🤝', grade: 'י״ב', url: 'https://enavcorem.github.io/client-learning/' },
];

// אילו לומדות המורה רואה בלוח (מיגרציה 04). מנהלת — את כולן.
// מסד שעוד לא עבר את מיגרציה 04 לא מחזיר courses, ואז כולן, כמו קודם.
export function coursesForTeacher(teacher) {
  if (teacher.is_admin || !Array.isArray(teacher.courses)) return COURSES;
  return COURSES.filter((c) => teacher.courses.includes(c.id));
}

// הלומדות מקובצות לפי שכבה, לפי הסדר שבו הן מופיעות למעלה: [[grade, [courses]], ...]
export function groupByGrade(list) {
  const groups = new Map();
  list.forEach((c) => { if (!groups.has(c.grade)) groups.set(c.grade, []); groups.get(c.grade).push(c); });
  return [...groups];
}

// הקישור ללוח המורה של לומדה. בארגז החול כל הלומדות מוגשות מאותו שרת
// מקומי בנתיב /<id>/ (sandbox.mjs), ולכן מקשרים לשם ולא לגיטהאב.
export function teacherUrl(course) {
  const first = location.pathname.split('/')[1];
  const inSandbox = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && COURSES.some((c) => c.id === first);
  if (inSandbox) return `/${course.id}/teacher/`;
  return course.url ? `${course.url}teacher/` : null;
}
