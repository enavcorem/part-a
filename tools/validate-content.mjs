// בדיקת שפיות לכל קבצי התוכן של הלומדה.
//
// מה נבדק: שכל קובץ נטען, שכל סוג בלוק וסוג שאלה באמת רשומים במנוע,
// שלכל שאלה יש בדיוק תשובה נכונה אחת, ושמבחן לא משתמש בסוג שאלה שנתמך
// רק בשיעור. זול להריץ, ותופס בדיוק את סוג הטעות שמתגלה אחרת רק כשתלמידה
// נתקעת באמצע יחידה.
//
// הרצה (מתוך תיקיית הלומדה):
//   node tools/validate-content.mjs
//
// הקובץ הזה גנרי — הוא לא מחזיק רשימת סוגים משלו אלא שואל את המנוע מה
// רשום אצלו, אחרי טעינת content/widgets/index.js של הקורס. לכן הוא עובד
// כמו שהוא בכל לומדה חדשה.

import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
import { register } from 'module';

// חייב לרוץ לפני כל ייבוא דינמי: מנטרל ייבוא מ-CDN (ראו tools/https-stub.mjs).
register('./https-stub.mjs', import.meta.url);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] || path.resolve(HERE, '..');
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const manifest = await load('content/manifest.js');

// טוענים קודם את הווידג'טים של הקורס, כדי שהרישומים שלהם ייכנסו למנוע —
// בדיוק כמו ב-js/router.js בדפדפן.
await load('content/widgets/index.js');
const { getBlockTypes } = await load('js/engine/blocks.js');
const { getQuestionTypes } = await load('js/engine/question-types.js');

const BLOCKS = new Set(getBlockTypes());
const QT = getQuestionTypes();
const PRACTICE_Q = new Set(QT.practice);
const EXAM_Q = new Set(QT.exam);

const problems = [];
let slides = 0;
const openKeys = new Map(); // key של open-answer → איפה הופיע
let questions = 0;

function checkQuestion(q, where, isExam) {
  questions++;
  const allowed = isExam ? EXAM_Q : PRACTICE_Q;
  if (!allowed.has(q.type)) {
    problems.push(`${where}: סוג שאלה לא נתמך ${isExam ? 'במבחן' : 'בשיעור'} — "${q.type}"`);
  }
  if (!q.prompt) problems.push(`${where}: שאלה בלי prompt`);

  // "תשובה נכונה אחת" נבדקת לפי צורת השאלה, לא לפי שם הסוג: כל שאלה שיש בה
  // options עם correct (mc, chart-mc, וכל סוג שיירשם בעתיד) צריכה בדיוק אחת.
  // mc נבדק תמיד, גם אם שכחו לכתוב correct בכל האפשרויות.
  const hasCorrectShape = Array.isArray(q.options)
    && q.options.some((o) => o && typeof o === 'object' && 'correct' in o);
  if (q.type === 'mc' || hasCorrectShape) {
    const n = (q.options || []).filter((o) => o && o.correct).length;
    if (n !== 1) problems.push(`${where}: ל-${q.type} יש ${n} תשובות נכונות (צריך בדיוק 1)`);
  }
  // כל סוג שהשם שלו מסתיים ב-numeric (numeric, chart-numeric...) צריך answer מספרי
  if (typeof q.type === 'string' && q.type.endsWith('numeric')
      && !(typeof q.answer === 'number' && Number.isFinite(q.answer))) {
    problems.push(`${where}: לשאלה מסוג ${q.type} אין answer מספרי`);
  }
  if (q.type === 'match') {
    if (!Array.isArray(q.pairs) || q.pairs.length < 2) problems.push(`${where}: שאלת התאמה צריכה לפחות שני זוגות`);
  }
  if (q.type === 'formula-parts') {
    for (const key of ['value', 'lookup', 'ret']) {
      const opts = q.parts?.[key];
      if (!Array.isArray(opts) || !opts.length) { problems.push(`${where}: חסר parts.${key}`); continue; }
      const n = opts.filter((o) => o.correct).length;
      if (n !== 1) problems.push(`${where}: parts.${key} — ${n} תשובות נכונות (צריך 1)`);
      opts.forEach((o, i) => { if (!o.ref) problems.push(`${where}: parts.${key}[${i}] בלי ref`); });
    }
  }
}

for (const unit of manifest.getFlatUnits()) {
  const where = unit.id;
  if (!unit.modulePath) continue; // יחידה שעוד לא נכתבה — מוצגת כ"בקרוב"

  let mod;
  try {
    mod = await load(path.join('content', unit.modulePath));
  } catch (e) {
    problems.push(`${where}: הקובץ לא נטען — ${e.message}`);
    continue;
  }
  const data = mod.default;
  if (!data) { problems.push(`${where}: אין export default`); continue; }

  if (unit.type === 'quiz' || unit.type === 'exemption') {
    if (!Array.isArray(data.questions) || !data.questions.length) {
      problems.push(`${where}: מבחן בלי שאלות`);
      continue;
    }
    data.questions.forEach((q, i) => {
      checkQuestion(q, `${where} ש${i + 1}`, true);
      if (!q.topic) problems.push(`${where} ש${i + 1}: אין topic (נחוץ לדוח הנושאים)`);
    });
  } else {
    if (!Array.isArray(data.slides) || !data.slides.length) {
      problems.push(`${where}: יחידה בלי סליידים`);
      continue;
    }
    data.slides.forEach((s, i) => {
      slides++;
      (s.blocks || []).forEach((b, j) => {
        if (!BLOCKS.has(b.type)) {
          problems.push(`${where} סליידה ${i + 1} בלוק ${j + 1}: סוג לא מוכר — "${b.type}"`);
        }
        // open-answer: ה-key הוא מה שנשמר במסד, ולכן חייב להיות ייחודי בכל הלומדה
        if (b.type === 'open-answer') {
          if (!b.key) problems.push(`${where} סליידה ${i + 1} בלוק ${j + 1}: open-answer בלי key`);
          else if (openKeys.has(b.key)) problems.push(`${where} סליידה ${i + 1}: key כפול "${b.key}" (גם ב-${openKeys.get(b.key)})`);
          else openKeys.set(b.key, where);
          if (b.kind === 'choice' && !(b.options || []).length) problems.push(`${where} סליידה ${i + 1}: open-answer מסוג choice בלי options`);
        }
      });
      if (s.question) checkQuestion(s.question, `${where} סליידה ${i + 1}`, false);
    });
  }
}

// קידומת: כל הלומדות כותבות לאותו מסד, וההתקדמות וניסיונות הפטור נשמרים
// רק לפי מזהה היחידה/הפרק. שתי לומדות עם אותו מזהה (למשל 'ch1') מתערבבות
// בלוח המורה, ופטור בלומדה אחת עלול להיחשב בשנייה. לכן כל מזהה מתחיל
// בקידומת אחת של הלומדה ('xl-ch1', 'client-ch1-u2').
// סטטיסטיקה פטורה: היא הראשונה, ויש לה נתונים אמיתיים במזהים בלי קידומת.
if (manifest.COURSE_ID !== 'stat') {
  const ids = [...manifest.CHAPTERS.map((ch) => ch.id), ...manifest.getFlatUnits().map((u) => u.id)];
  const prefix = String(ids[0] || '').split('-')[0];
  if (!prefix || /^ch\d*$/.test(prefix)) {
    problems.push(`מזהה "${ids[0]}" בלי קידומת של הלומדה. צריך למשל "${manifest.COURSE_ID}-ch1"`);
  } else {
    ids.filter((id) => !id.startsWith(prefix + '-'))
      .forEach((id) => problems.push(`מזהה "${id}" לא מתחיל בקידומת "${prefix}-" כמו שאר הלומדה`));
  }
}

const units = manifest.getFlatUnits();
console.log(`קורס: ${manifest.COURSE?.title || manifest.COURSE_ID || '(ללא שם)'}`);
console.log(`נבדקו ${units.length} יחידות · ${slides} סליידים · ${questions} שאלות`);
console.log(`סוגי בלוק מוכרים: ${[...BLOCKS].join(', ')}`);
console.log(`סוגי שאלה — שיעור: ${QT.practice.join(', ')} · מבחן: ${QT.exam.join(', ')}`);

if (problems.length) {
  console.log(`\n❌ ${problems.length} בעיות:`);
  problems.forEach((p) => console.log('  - ' + p));
  process.exit(1);
}
console.log('\n✅ הכול תקין');
