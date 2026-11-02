// ===== קידוד תוכן המיני-בגרות =====
// הריפו ציבורי, ולכן השאלות לא יושבות בקובץ כטקסט קריא. הן מקודדות בקוד
// שהמורה כותבת על הלוח ביום המבחן. זו לא הגנה מלאה (אפשר לנחש קוד), אבל
// מספיקה לכיתה. אותו קובץ משמש גם את הדפדפן וגם את סקריפט הבנייה
// (..\..\..\מיני-בגרות 25.11\_build_exam.mjs), ולכן אין בו DOM.

const MARK = 'PAEXAM1|';

export function normalizeCode(code) {
  return String(code || '').replace(/\s+/g, '').toLowerCase();
}

// FNV-1a: מהקוד למספר התחלתי
function seedOf(code) {
  let h = 0x811c9dc5;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: רצף בתים שנגזר מהקוד
function stream(code) {
  let a = seedOf(normalizeCode(code));
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) & 255;
  };
}

function xor(bytes, code) {
  const next = stream(code);
  return bytes.map((b) => b ^ next());
}

export function encodeExam(obj, code) {
  const bytes = xor(new TextEncoder().encode(MARK + JSON.stringify(obj)), code);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// קוד שגוי → null
export function decodeExam(b64, code) {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const text = new TextDecoder().decode(xor(bytes, code));
    if (!text.startsWith(MARK)) return null;
    return JSON.parse(text.slice(MARK.length));
  } catch (e) {
    return null;
  }
}
