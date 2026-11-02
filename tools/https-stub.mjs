// Loader זעיר ל-node, שמשמש רק את tools/validate-content.mjs.
//
// למה הוא נחוץ: הבדיקה טוענת את content/widgets/index.js של הקורס כדי
// לשאול את המנוע אילו בלוקים וסוגי שאלות רשומים אצלו. השרשרת הזו מגיעה
// ל-js/supabase-config.js, שמייבא את ספריית supabase ישירות מ-CDN
// (https://...). דפדפן יודע לטעון כתובת כזו; node לא, והוא נופל.
//
// הפתרון: מחליפים כל ייבוא https בגרסת דמה. הבדיקה לא נוגעת ברשת ולא
// בבסיס הנתונים ממילא — היא רק קוראת קבצי תוכן.

const STUB = 'data:text/javascript,'
  + encodeURIComponent('export function createClient(){return new Proxy(function(){},{get:()=>()=>{},apply:()=>({})});}');

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('https://') || specifier.startsWith('http://')) {
    return { url: STUB, shortCircuit: true };
  }
  return next(specifier, context);
}
