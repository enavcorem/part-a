// המנוע מייבא את הקובץ הזה תמיד — גם אם הוא ריק. אל תמחקי אותו.
//
// הבלוקים של לומדת חלק א': chart (גרף SVG), source (מקור מידע), answer
// (טענה או שאלה פתוחה שנשמרת), itest (מסך בסגנון הבחינה הממוחשבת),
// ו-exam (המיני-בגרות: נעול בקוד, בשעון, עם הגשה, ב-exam.js).
// הקוד ב-itest.js ו-chart.js, השמירה ב-store.js, והעיצוב ב-parta.css.

import { registerBlockRenderer } from '../../js/engine/blocks.js';
import { BLOCKS } from './itest.js';
import { BLOCKS as EXAM_BLOCKS } from './exam.js';

Object.entries({ ...BLOCKS, ...EXAM_BLOCKS }).forEach(([type, fn]) => registerBlockRenderer(type, fn));

// גרפים בתוך שאלות המבחן (חריץ ב-prompt שמתמלא בגרף). ראו quiz-charts.js.
import './quiz-charts.js';
