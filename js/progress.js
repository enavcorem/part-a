// ===== ניהול תלמידה, התקדמות ונעילה — מבוסס על content/manifest.js בלבד =====
//
// שכבת אחסון: localStorage הוא תמיד "מטמון מקומי מיידי" — כל קריאה
// (getStudent, canAccessUnit, computeXP וכו') ממשיכה להיות סינכרונית,
// כדי ש-unit-runner.js/quiz-runner.js/roadmap-render.js לא יצטרכו להשתנות
// בכלל. Supabase הוא "מקור אמת חוצה-מכשירים": בכל כניסה (loginWithClassCode)
// שולפים ממנו את הנתונים העדכניים ומעדכנים את המטמון המקומי לפיהם, ובכל
// שינוי (saveProgress/markComplete/saveQuizAnswers/saveExemptionAttempt)
// כותבים קודם למטמון המקומי (מיידי, לא תלוי רשת) ובמקביל שולחים עדכון
// ל-Supabase ברקע ("fire and forget"). אם אין רשת/Supabase לא זמין —
// הכל ממשיך לעבוד מקומית בדיוק כמו קודם, רק בלי הסנכרון בין מכשירים.
//
// חשוב: אין כאן יותר MODULE_CONFIG נפרד. הנעילה וההתקדמות תמיד נגזרות
// מ-content/manifest.js — זה מתקן מבנית את הבאג שבו יחידות "נשכחו" מרשימה
// שנייה שלא עודכנה (מה שקרה באפליקציה הישנה ליחידות המבוא והמבחן הסופי).
//
// כניסה עם קוד כיתה (loginWithClassCode): הקוד מזהה את הכיתה, והתלמידה
// בוחרת את השם שלה מרשימה, או "אני חדשה". בית הספר והכיתה נגזרים מהקוד,
// ולכן אין טעויות כתיב. הזהות היא ה-id של התלמידה, והכיתה היא רק שיוך
// (טבלת enrollments), כך שמעבר שנה לא מאפס התקדמות.
//
// מחשבים משותפים: כל התלמידות שמורות באותו localStorage, בתוך "תיקיות"
// נפרדות. תיקיות מהטופס הישן (מפתח בית ספר__שם__כיתה) נשארות כמו שהן —
// מי שכבר מחוברת במכשיר נכנסת אוטומטית, בלי קוד. תיקייה חדשה מקבלת מפתח
// לפי ה-id, ובכניסה מחפשים קודם תיקייה קיימת עם אותו id.

import { COURSE, COURSE_ID, getFlatUnits, findUnit, findChapter } from '../content/manifest.js';
import { supabaseClient } from './supabase-config.js';

// מפתחות האחסון נגזרים מ-COURSE_ID של הקורס, ולא קבועים בקוד המנוע: אם
// שתי לומדות מתארחות על אותו דומיין (תת-תיקיות של אותו GitHub Pages) הן
// חולקות localStorage אחד, ובלי הפרדה הן היו דורסות זו את הבחירות של זו.
// בשרת (Supabase) הן דווקא כן חולקות את טבלת התלמידות בכוונה — אותה
// תלמידה, אותה שורה, בכל הקורסים.
const KEY_ALL = `${COURSE_ID}_data_v3`;
const KEY_CURRENT = `${COURSE_ID}_current_key_v3`;

// ===== מצב כיתה — תכונה בהצטרפות מרצון, לכל קורס בנפרד =====
// המנוע בנוי ללמידה עצמית בקצב אישי: יחידה נפתחת רק אחרי שקודמתה הושלמה.
// בשיעור פרונטלי הנעילה מפריעה — המורה רוצה לקפוץ ישר ליחידה שהיא מקרינה.
// כניסה לכתובת עם ?class=1 מבטלת את הנעילה במכשיר הזה בלבד; ?class=0 מחזירה.
//
// ⚠️ התכונה **כבויה אלא אם הקורס ביקש אותה במפורש**, עם
// `classMode: true` ב-COURSE שב-content/manifest.js. קורס שלא ביקש —
// ?class=1 לא עושה אצלו כלום, ו-canAccessUnit מתנהגת בדיוק כמו לפני
// שהתכונה נוספה. כך אפשר להוסיף אותה למנוע המשותף בלי לגעת בקורס שבו
// הנעילה ההדרגתית היא עיקר הפדגוגיה.
const CLASS_MODE_ENABLED = COURSE.classMode === true;
const KEY_CLASS_MODE = `${COURSE_ID}_class_mode`;

(function initClassModeFromUrl() {
  if (!CLASS_MODE_ENABLED) return;
  try {
    const param = new URLSearchParams(location.search).get('class');
    if (param === '1') localStorage.setItem(KEY_CLASS_MODE, '1');
    else if (param === '0') localStorage.removeItem(KEY_CLASS_MODE);
  } catch (e) { /* בלי localStorage פשוט אין מצב כיתה — לא שוברים את הדף */ }
})();

export function isClassMode() {
  if (!CLASS_MODE_ENABLED) return false;
  try { return localStorage.getItem(KEY_CLASS_MODE) === '1'; }
  catch (e) { return false; }
}

// ===== לומדה פתוחה לכיתה — המורה מחליטה בלוח (מיגרציה 04) =====
// לפני מבחן המורה פותחת את כל הפרקים לכיתה מסוימת, בלומדה הזו בלבד.
// השרת הוא מקור האמת; במכשיר נשמר מזהה התלמידה שהלומדה פתוחה לה, כדי
// שגם בלי רשת יהיה ערך אחרון, ושתלמידה אחרת באותו מכשיר לא "תירש" אותו.
// בניגוד למצב כיתה, רק הנעילה בין פרקים נפתחת — בתוך פרק הכול כרגיל.
const KEY_COURSE_OPEN = `${COURSE_ID}_course_open`;

export function isCourseOpenForClass() {
  const s = getStudent();
  if (!s) return false;
  try { return localStorage.getItem(KEY_COURSE_OPEN) === s.id; }
  catch (e) { return false; }
}

// שואלת את השרת ומעדכנת את המטמון. מחזירה true אם המצב השתנה.
// מסד בלי מיגרציה 04 עונה בשגיאה — אז נשארים עם מה שהיה (סגור).
export async function refreshCourseOpen() {
  const s = getStudent();
  if (!s) return false;
  const before = isCourseOpenForClass();
  try {
    const { data, error } = await supabaseClient.rpc('student_course_open', { p_student_id: s.id, p_course: COURSE_ID });
    if (error) throw error;
    if (data === true) localStorage.setItem(KEY_COURSE_OPEN, s.id);
    else localStorage.removeItem(KEY_COURSE_OPEN);
  } catch (e) {
    console.warn('student_course_open נכשל (ממשיכים עם הערך האחרון):', e);
    return false;
  }
  return isCourseOpenForClass() !== before;
}

export const XP_VALUES = { lesson: 10, lab: 10, quiz: 20, reference: 5, exemption: 30 };

// בודקים שהאחסון באמת עובד (לא רק זמין) — גלישה פרטית/הגדרות דפדפן
// מסוימות נותנות ל-localStorage "להצליח" אבל לא לשמור כלום בפועל.
// המסך שמציג את זה (renderLogin) קורא לפונקציה הזו לפני שמישהי מתחילה
// למלא נתונים, כדי שהאזהרה תגיע *לפני* שההתקדמות הולכת לאיבוד, לא אחרי.
export function isStorageAvailable() {
  try {
    const testKey = '__lomda_storage_test__';
    localStorage.setItem(testKey, '1');
    const ok = localStorage.getItem(testKey) === '1';
    localStorage.removeItem(testKey);
    return ok;
  } catch (e) {
    return false;
  }
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn('localStorage read failed for', key, e);
    return fallback;
  }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.warn('localStorage write failed for', key, e); }
}

// מפתח התיקייה של תלמידה: תיקייה קיימת עם אותו id (גם מהטופס הישן), או חדשה
function bucketKeyForStudentId(studentId) {
  const all = getAllBuckets();
  const existing = Object.keys(all).find((k) => all[k] && all[k].student && all[k].student.id === studentId);
  return existing || `id__${studentId}`;
}

function getAllBuckets() {
  return readJSON(KEY_ALL, {});
}
function saveBucket(key, bucket) {
  const all = getAllBuckets();
  all[key] = bucket;
  writeJSON(KEY_ALL, all);
}
function getCurrentKey() {
  return readJSON(KEY_CURRENT, null);
}
function getCurrentBucket() {
  const key = getCurrentKey();
  if (!key) return null;
  const all = getAllBuckets();
  return all[key] || null;
}

// ===== סנכרון עם Supabase — כל הפונקציות כאן "fire and forget": =====
// לא חוסמות את החוויה, לא זורקות שגיאה החוצה, רק רושמות אזהרה בקונסול
// אם נכשלות (בלי רשת, למשל). זה מספיק לשלב הזה — לא בונים כאן מנגנון
// תור-נסיונות-חוזרים מלא; אם עדכון בודד לא הגיע לשרת, הוא פשוט יתעדכן
// בפעם הבאה שהערך הזה נשמר, או בכניסה הבאה מאותו מכשיר (הוא עדיין קיים
// במטמון המקומי).
function fireAndForget(promise) {
  promise.catch((e) => console.warn('סנכרון ל-Supabase נכשל (ממשיכים מקומית):', e));
}

async function throwOnError({ error }) {
  if (error) throw error;
}

async function supabaseUpsertUnitProgress(studentId, unitId, p) {
  await throwOnError(await supabaseClient.from('unit_progress').upsert({
    student_id: studentId,
    unit_id: unitId,
    status: p.status,
    last_slide: typeof p.lastSlide === 'number' ? p.lastSlide : null,
    completed_at: p.completedAt || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'student_id,unit_id' }));
}

async function supabaseUpsertQuizAnswers(studentId, unitId, answers) {
  await throwOnError(await supabaseClient.from('quiz_answers').upsert({
    student_id: studentId,
    unit_id: unitId,
    answers,
    submitted_at: new Date().toISOString(),
  }, { onConflict: 'student_id,unit_id' }));
}

async function supabaseInsertExemptionAttempt(studentId, chapterId, score, passed) {
  await throwOnError(await supabaseClient.from('exemption_attempts').insert({
    student_id: studentId,
    chapter_id: chapterId,
    score,
    passed,
    attempted_at: new Date().toISOString(),
  }));
}

// התלמידה עצמה נוצרת רק בשרת (join_class), ולכן כאן יש רק עדכון
function updateRemoteStudent(studentId, fields) {
  fireAndForget((async () => {
    await throwOnError(await supabaseClient.from('students').update(fields).eq('id', studentId));
  })());
}

// דוחפים לשרת התקדמות שנשמרה רק מקומית (למשל כשהמכשיר היה לא מקוון).
// ניסיון-אחד-כל-שדה, לא מחכה לתוצאה.
function pushLocalBucketToRemote(bucket) {
  Object.entries(bucket.progress).forEach(([unitId, p]) => {
    fireAndForget(supabaseUpsertUnitProgress(bucket.student.id, unitId, p));
  });
  Object.entries(bucket.quizAnswers).forEach(([unitId, answers]) => {
    fireAndForget(supabaseUpsertQuizAnswers(bucket.student.id, unitId, answers));
  });
  bucket.exemptionAttempts.forEach((a) => {
    fireAndForget(supabaseInsertExemptionAttempt(bucket.student.id, a.chapterId, a.score, a.passed));
  });
}

// שולפים מ-Supabase bucket מלא (תלמידה + כל ההתקדמות שלה) לפי ה-id.
// מחזירים null אם לא נמצאה, או אם הייתה שגיאת רשת/שרת — במקרה הזה
// ממשיכים עם התיקייה המקומית, אם יש.
async function tryFetchRemoteBundle(studentId) {
  try {
    const { data: studentRow, error: studentErr } = await supabaseClient
      .from('students')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();
    if (studentErr) throw studentErr;
    if (!studentRow) return null;

    const [progressRes, quizRes, attemptsRes] = await Promise.all([
      supabaseClient.from('unit_progress').select('*').eq('student_id', studentRow.id),
      supabaseClient.from('quiz_answers').select('*').eq('student_id', studentRow.id),
      supabaseClient.from('exemption_attempts').select('*').eq('student_id', studentRow.id),
    ]);
    if (progressRes.error) throw progressRes.error;
    if (quizRes.error) throw quizRes.error;
    if (attemptsRes.error) throw attemptsRes.error;

    const progress = {};
    (progressRes.data || []).forEach((r) => {
      progress[r.unit_id] = { status: r.status, lastSlide: r.last_slide, completedAt: r.completed_at };
    });
    const quizAnswers = {};
    (quizRes.data || []).forEach((r) => { quizAnswers[r.unit_id] = r.answers; });
    const exemptionAttempts = (attemptsRes.data || []).map((r) => ({
      chapterId: r.chapter_id, score: r.score, passed: r.passed, attemptedAt: r.attempted_at,
    }));

    const student = {
      id: studentRow.id,
      name: studentRow.name,
      school: studentRow.school,
      class_name: studentRow.class_name,
      gender: studentRow.gender,
      created_at: studentRow.created_at,
      last_seen: studentRow.last_seen,
    };
    return { student, progress, quizAnswers, exemptionAttempts };
  } catch (e) {
    console.warn('לא הצלחנו לטעון נתונים מ-Supabase (ממשיכים עם נתונים מקומיים אם יש):', e);
    return null;
  }
}

// ===== זהות תלמידה =====

export function getStudent() {
  const bucket = getCurrentBucket();
  return bucket ? bucket.student : null;
}

export function logout() {
  writeJSON(KEY_CURRENT, null);
  location.hash = '#login';
  location.reload();
}

// ===== כניסה עם קוד כיתה =====

// הקוד האחרון נשמר בלי קידומת קורס: שתי לומדות על אותו דומיין חולקות אותו,
// ובמחשב כיתתי התלמידה הבאה רק בוחרת את השם שלה.
const KEY_LAST_CLASS_CODE = 'lomda_last_class_code';

export function normalizeClassCode(code) {
  return String(code || '').replace(/\D/g, '');
}

// קוד מהקישור (?code=123456) קודם, ואחריו הקוד האחרון שנכנסו איתו במכשיר
export function getSuggestedClassCode() {
  try {
    const fromUrl = normalizeClassCode(new URLSearchParams(location.search).get('code'));
    if (fromUrl) return fromUrl;
    return localStorage.getItem(KEY_LAST_CLASS_CODE) || '';
  } catch (e) { return ''; }
}

// { ok: true, cls, students } או { ok: false, reason: 'bad_code' | 'network' }
export async function fetchClassRoster(code) {
  const normCode = normalizeClassCode(code);
  if (normCode.length !== 6) return { ok: false, reason: 'bad_code' };
  const { data, error } = await supabaseClient.rpc('class_roster', { p_code: normCode });
  if (error) {
    console.warn('class_roster נכשל:', error);
    return { ok: false, reason: 'network' };
  }
  if (!data) return { ok: false, reason: 'bad_code' };
  return { ok: true, cls: data.class, students: data.students };
}

// pick: { studentId } לתלמידה מהרשימה, { newName } ל"אני חדשה",
// או { username } בכיתה שבה המורה נותנת שמות משתמש (login_mode: 'username').
// מחזירה { ok: true, student } או { ok: false, reason }:
// bad_code / bad_name / name_taken / bad_username / locked / network
export async function loginWithClassCode(code, pick, gender) {
  const normCode = normalizeClassCode(code);
  let g = gender === 'm' ? 'm' : 'f';
  let studentId = pick.studentId;

  if (pick.username !== undefined) {
    const { data, error } = await supabaseClient.rpc('login_with_username', { p_code: normCode, p_username: pick.username });
    if (error) {
      console.warn('login_with_username נכשל:', error);
      return { ok: false, reason: 'network' };
    }
    if (data.status !== 'ok') return { ok: false, reason: data.status };
    studentId = data.student_id;
    // לשון הפנייה נשמרת אצל התלמיד (המורה קבעה אותה בהוספה), ולא נשאלת במסך
    if (!gender) g = data.gender === 'm' ? 'm' : 'f';
  } else if (!studentId) {
    const { data, error } = await supabaseClient.rpc('join_class', { p_code: normCode, p_name: pick.newName, p_gender: g });
    if (error) {
      console.warn('join_class נכשל:', error);
      return { ok: false, reason: 'network' };
    }
    if (data.status !== 'ok') return { ok: false, reason: data.status };
    studentId = data.student_id;
  }

  const key = bucketKeyForStudentId(studentId);
  const localBucket = getAllBuckets()[key];
  const remote = await tryFetchRemoteBundle(studentId);

  let bucket;
  if (remote) {
    // Supabase הוא מקור האמת חוצה-המכשירים — מעדכנים את המטמון המקומי
    // לפיו, כדי שתלמידה שמתחברת ממחשב אחר תמשיך בדיוק מאיפה שעצרה.
    bucket = remote;
  } else if (localBucket) {
    // השרת לא ענה, אבל יש תיקייה במכשיר הזה — ממשיכים איתה ומנסים
    // לדחוף אותה ברקע.
    bucket = localBucket;
    pushLocalBucketToRemote(bucket);
  } else {
    return { ok: false, reason: 'network' };
  }

  const now = new Date().toISOString();
  const changed = { last_seen: now };
  if (bucket.student.gender !== g) changed.gender = g;
  bucket.student.last_seen = now;
  bucket.student.gender = g;
  updateRemoteStudent(studentId, changed);

  saveBucket(key, bucket);
  writeJSON(KEY_CURRENT, key);
  try { localStorage.setItem(KEY_LAST_CLASS_CODE, normCode); } catch (e) { /* לא קריטי */ }
  await refreshCourseOpen();
  return { ok: true, student: bucket.student };
}

// ===== התקדמות ליחידה =====

function getAllProgress() {
  const bucket = getCurrentBucket();
  return bucket ? bucket.progress : {};
}

function mutateBucket(mutator) {
  const key = getCurrentKey();
  if (!key) return;
  const all = getAllBuckets();
  const bucket = all[key];
  if (!bucket) return;
  mutator(bucket);
  saveBucket(key, bucket);
}

export function loadProgress(unitId) {
  const all = getAllProgress();
  return all[unitId] || null;
}

function syncUnitProgressToRemote(unitId) {
  const student = getStudent();
  const p = loadProgress(unitId);
  if (student && p) fireAndForget(supabaseUpsertUnitProgress(student.id, unitId, p));
}

export function saveProgress(unitId, slideIndex) {
  mutateBucket((bucket) => {
    const prev = bucket.progress[unitId] || {};
    bucket.progress[unitId] = { ...prev, status: prev.status === 'completed' ? prev.status : 'started', lastSlide: slideIndex };
  });
  syncUnitProgressToRemote(unitId);
}

export function markComplete(unitId, opts = {}) {
  mutateBucket((bucket) => {
    const prev = bucket.progress[unitId] || {};
    bucket.progress[unitId] = { ...prev, status: opts.exempted ? 'exempted' : 'completed', completedAt: new Date().toISOString() };
  });
  syncUnitProgressToRemote(unitId);
}

// ===== נעילה: תמיד נגזרת מ-manifest, לא ממערך נפרד =====

function isUnitDone(unitId, all) {
  const p = all[unitId];
  return !!p && (p.status === 'completed' || p.status === 'exempted');
}

export function canAccessUnit(unitId) {
  if (!getStudent()) return false;
  const unit = findUnit(unitId);
  if (!unit) return false;
  // במצב כיתה הכול פתוח — ההתקדמות עצמה עדיין נשמרת כרגיל.
  if (isClassMode()) return true;

  const chapter = findChapter(unit.chapterId);
  const flat = getFlatUnits();
  const all = getAllProgress();

  // כל הפרקים הקודמים חייבים להיות שלמים — גם לפני אתגר פטור של פרק
  // מאוחר יותר, לא רק לפני השיעורים שלו. אחרת אפשר "לדלג" ישר לאתגר
  // פטור של פרק 4 בלי לגעת בפרקים 1-3 בכלל — לא הגיוני, כי אתגר פטור
  // מניח שכבר שולטים בחומר הקודם. הפרקים עצמם נשארים ברצף, גם אם פרק
  // בודד מסומן "unordered" מבפנים.
  //
  // חריג: לומדת חזרה (`openChapters: true` ב-COURSE). שם כל פרק עומד בפני
  // עצמו, והתלמידה צריכה לקפוץ ישר לנושא שקשה לה לפני מבחן. קורס שלא
  // ביקש — מתנהג בדיוק כמו קודם.
  // וחריג שני: המורה פתחה את הלומדה לכיתה בלוח (isCourseOpenForClass).
  if (COURSE.openChapters !== true && !isCourseOpenForClass()) {
    for (const u of flat) {
      if (u.chapterNumber >= chapter.number) break;
      if (u.type === 'exemption' || u.type === 'bonus') continue;
      if (!isUnitDone(u.id, all)) return false;
    }
  }

  // בתוך הפרק עצמו, אתגר הפטור תמיד פתוח — הוא בדיוק החלופה לעבור על
  // השיעורים אחד-אחד, לא משהו שדורש להשלים אותם קודם.
  if (unit.type === 'exemption') return true;

  if (chapter.unordered) {
    // פרק "לא-מסודר": כל השיעורים/מעבדות/בונוסים בפרק פתוחים יחד ברגע
    // שהגענו לפרק — הסדר ביניהם לא משמעותי. סיכום/מבחן דורשים שכל
    // השיעורים/מעבדות (לא כולל בונוס) בפרק יושלמו קודם.
    if (unit.type === 'lesson' || unit.type === 'lab' || unit.type === 'bonus') return true;
    const required = chapter.units.filter(u => u.type === 'lesson' || u.type === 'lab');
    return required.every(u => isUnitDone(u.id, all));
  }

  // פרק רגיל (מסודר): רצף מלא בתוך הפרק, כמו קודם.
  const idxInChapter = chapter.units.findIndex(u => u.id === unitId);
  for (let i = 0; i < idxInChapter; i++) {
    const u = chapter.units[i];
    if (u.type === 'exemption' || u.type === 'bonus') continue;
    if (!isUnitDone(u.id, all)) return false;
  }
  return true;
}

export function unitStatus(unitId) {
  const p = loadProgress(unitId);
  if (p && (p.status === 'completed' || p.status === 'exempted')) return p.status;
  if (!canAccessUnit(unitId)) return 'locked';
  if (p && p.status === 'started') return 'current';
  return 'not-started';
}

export function chapterStatus(chapterId) {
  const ch = findChapter(chapterId);
  if (!ch) return 'locked';
  const gating = ch.units.filter(u => u.type !== 'exemption' && u.type !== 'bonus');
  // פרק שכולו בונוס (אין בו אף יחידת חובה): על מערך ריק, every() מחזיר
  // true — ולכן הפרק נצבע "הושלם" עוד לפני שהתלמידה נגעה בו. במקרה כזה
  // גוזרים את הסטטוס מהיחידות שכן יש בפרק (הבונוסים עצמם).
  const relevant = gating.length ? gating : ch.units.filter(u => u.type !== 'exemption');
  if (!relevant.length) return 'locked';
  const statuses = relevant.map(u => unitStatus(u.id));
  if (statuses.every(s => s === 'completed' || s === 'exempted')) return 'completed';
  if (statuses.some(s => s !== 'locked')) return 'current';
  return 'locked';
}

// ===== מבחנים =====

// מחזירה Promise שמתקיים ל-true כשהשמירה הגיעה ל-Supabase, ול-false אם
// נשארה רק במכשיר. קוראים ישנים מתעלמים מהערך — זה בסדר, השמירה המקומית
// קורית בכל מקרה ומיד.
export function saveQuizAnswers(unitId, answersArray) {
  mutateBucket((bucket) => { bucket.quizAnswers[unitId] = answersArray; });
  const student = getStudent();
  if (!student) return Promise.resolve(false);
  const sync = supabaseUpsertQuizAnswers(student.id, unitId, answersArray).then(() => true);
  fireAndForget(sync);
  return sync.catch(() => false);
}

// התשובות השמורות במכשיר ליחידה (או null). משמש בלוקים של קורס שצריכים
// להחזיר לתלמידה את מה שכתבה — למשל שדות כתיבה פתוחים.
export function getQuizAnswers(unitId) {
  const bucket = getCurrentBucket();
  return (bucket && bucket.quizAnswers[unitId]) || null;
}

// השורה של היחידה ישירות מ-Supabase, בלי לגעת במטמון המקומי.
// השרת נקרא רק בכניסה, ולכן במכשיר שנשאר מחובר (הבית) המטמון עלול להיות
// ישן אם בינתיים כתבו ממחשב אחר (בית הספר). הקורא מחליט מה עדכני יותר.
// מחזירה { answers, submittedAt }, או null אם אין שורה, ו-undefined בשגיאת רשת.
export async function fetchRemoteQuizAnswers(unitId) {
  const student = getStudent();
  if (!student) return undefined;
  try {
    const { data, error } = await supabaseClient.from('quiz_answers')
      .select('answers, submitted_at').eq('student_id', student.id).eq('unit_id', unitId).maybeSingle();
    if (error) throw error;
    return data ? { answers: data.answers, submittedAt: data.submitted_at } : null;
  } catch (e) {
    console.warn('לא הצלחנו לקרוא תשובות מ-Supabase:', e);
    return undefined;
  }
}

// ===== אתגר פטור =====

export function saveExemptionAttempt(chapterId, score, passed) {
  mutateBucket((bucket) => {
    bucket.exemptionAttempts.push({ chapterId, score, passed, attemptedAt: new Date().toISOString() });
  });
  const student = getStudent();
  if (student) fireAndForget(supabaseInsertExemptionAttempt(student.id, chapterId, score, passed));

  if (passed) {
    const ch = findChapter(chapterId);
    if (ch) {
      ch.units.forEach(u => {
        if (u.type !== 'exemption') markComplete(u.id, { exempted: true });
      });
    }
  }
}

// ===== משחקיות: XP ותגים — תמיד מחושבים מהנתונים, לא נשמרים כמונה נפרד =====

export function computeXP() {
  const all = getAllProgress();
  const flat = getFlatUnits();
  let xp = 0;
  flat.forEach(u => {
    const p = all[u.id];
    if (p && (p.status === 'completed' || p.status === 'exempted')) {
      xp += XP_VALUES[u.type] || 10;
    }
  });
  return xp;
}

export function overallCompletion() {
  // בונוס לא נספר במונה הכולל — כדי שהמספר ישקף את מה שבאמת נדרש להשלמת החלק.
  const flat = getFlatUnits().filter(u => u.type !== 'exemption' && u.type !== 'bonus');
  const all = getAllProgress();
  const done = flat.filter(u => {
    const p = all[u.id];
    return p && (p.status === 'completed' || p.status === 'exempted');
  }).length;
  return { done, total: flat.length };
}
