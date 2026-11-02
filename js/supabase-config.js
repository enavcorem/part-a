// ===== חיבור ל-Supabase =====
// טוענים את ספריית supabase-js ישירות מ-CDN כמודול ES — אין build step
// ואין תלות ב-npm, מתאים למבנה הפרויקט (vanilla JS + import/export טבעי).
//
// SUPABASE_URL / SUPABASE_ANON_KEY: פרויקט Supabase קיים (Settings → API).
// המפתח כאן הוא ה-anon/publishable key — הוא *מיועד* להיות גלוי בצד הלקוח
// (זו לא סיסמה), אבל הוא נותן גישה רק למה שמדיניות ה-RLS בטבלאות מתירה.
// ראו supabase/schema.sql להגדרת הטבלאות והמדיניות (יש להריץ פעם אחת
// ב-SQL Editor של הפרויקט לפני שימוש ראשון).

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://rldpknffxccmdhekhwth.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MxQy7AYaZ9oLbOBFkUxElQ_PA1PmPza';

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
