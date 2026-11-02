// ===== chart — גרף SVG בסגנון הגרפים של הבגרות =====
// המנוע מכיר רק chart-bar פשוט. בחלק א' צריך גרף קו עם כמה סדרות, עמודות
// מקובצות, עמודות אופקיות ועמודות נערמות — עם כותרת, צירים, יחידות ומקרא,
// כי בדיוק עליהם שואלים בבחינה. כל הנתונים בלומדה מומצאים.
//
// { type: 'chart', kind: 'line' | 'bar' | 'hbar' | 'stacked' | 'pie',
//   title: "גרף א': ...", subtitle, categories: ['2018', ...],
//   series: [{ name: 'עוקבים', values: [...], type: 'line', axis: 'right' }],
//   xLabel, yLabel, unit: '%', yMin, yMax, valueLabels: true,
//   y2: { max, unit, label },            ← ציר ימני לגרף משולב
//   note: 'כיתוב מתחת לגרף', source: 'מקור: ...' }
// בלי title: גרף "מעיתון", שרק הכיתוב שמתחתיו (note) מסביר מה רואים.
//
// הצבעים: --pa-s1 ... --pa-s4 ב-parta.css. הגרף עצמו נקרא משמאל לימין,
// כמו בבגרות (ציר השנים מתקדם ימינה).

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (text !== undefined) node.textContent = text;
  return node;
}

// "2017–2024" בתוך משפט בעברית מתהפך ל-"2024–2017". עוטפים טווחים של מספרים ב-LTR.
export function ltrRanges(text) {
  return String(text || '').replace(/(\d[\d,.]*%?\s?[–-]\s?\d[\d,.]*%?)/g, '<span dir="ltr" class="pa-ltr">$1</span>');
}

function fmt(n, unit) {
  const s = Number(n).toLocaleString('en-US', { maximumFractionDigits: 1 });
  return unit ? `${s}${unit}` : s;
}

// צעד "עגול" לציר: 1, 2, 5, 10, 20, 50...
function niceStep(range, ticks = 5) {
  const raw = range / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const m = raw / pow;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * pow;
}

function axisMax(spec, values) {
  if (spec.yMax !== undefined) return spec.yMax;
  const max = Math.max(...values, 0);
  const step = niceStep(max);
  return Math.ceil(max / step) * step || 1;
}

export function renderChart(spec) {
  const fig = document.createElement('figure');
  fig.className = 'block pa-chart';
  if (spec.title) {
    const cap = document.createElement('figcaption');
    cap.className = 'pa-chart-title';
    cap.innerHTML = ltrRanges(spec.title);
    fig.appendChild(cap);
  }
  if (spec.subtitle) {
    const sub = document.createElement('div');
    sub.className = 'pa-chart-subtitle';
    sub.innerHTML = ltrRanges(spec.subtitle);
    fig.appendChild(sub);
  }

  const series = spec.series || [];
  // בעוגה המקרא הוא הקטגוריות. בשאר — הסדרות
  const legendItems = spec.kind === 'pie'
    ? (spec.categories || []).map((name) => ({ name, line: false }))
    : series.map((s) => ({ name: s.name, line: spec.kind === 'line' || s.type === 'line' }));
  if (legendItems.length > 1 || spec.legend) {
    const legend = document.createElement('div');
    legend.className = 'pa-chart-legend';
    legendItems.forEach((it, i) => {
      const item = document.createElement('span');
      item.className = `pa-legend-item pa-s${(i % 4) + 1}`;
      item.innerHTML = `<i class="pa-legend-swatch ${it.line ? 'is-line' : ''}"></i>`;
      item.appendChild(document.createTextNode(it.name));
      legend.appendChild(item);
    });
    fig.appendChild(legend);
  }

  const svg = spec.kind === 'hbar' ? drawHBar(spec) : spec.kind === 'pie' ? drawPie(spec) : drawVertical(spec);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', spec.title || spec.note || 'גרף');
  fig.appendChild(svg);

  // note: כיתוב מתחת לגרף, כמו בעיתון. לפעמים זה המקום היחיד שמסביר מה רואים
  if (spec.note) {
    const note = document.createElement('div');
    note.className = 'pa-chart-note';
    note.innerHTML = ltrRanges(spec.note);
    fig.appendChild(note);
  }
  if (spec.source) {
    const src = document.createElement('div');
    src.className = 'pa-chart-source';
    src.textContent = spec.source;
    fig.appendChild(src);
  }
  return fig;
}

// ===== קו / עמודות / נערמות / משולב — קטגוריות על ציר X =====
// בגרף עמודות, סדרה עם type: 'line' מצוירת כקו (גרף משולב), וסדרה עם
// axis: 'right' נמדדת בציר ימני משלה (spec.y2 = { max, unit, label }).
function drawVertical(spec) {
  const W = 640, H = 340;
  const y2spec = spec.y2 || {};
  const hasRight = (spec.series || []).some((s) => s.axis === 'right');
  const M = { top: 18, right: hasRight ? (y2spec.label ? 74 : 54) : 16, bottom: spec.xLabel ? 58 : 38, left: spec.yLabel ? 74 : 54 };
  const cats = spec.categories || [];
  const series = (spec.series || []).map((s, si) => ({ ...s, si, isLine: spec.kind === 'line' || s.type === 'line' }));
  const stacked = spec.kind === 'stacked';
  const leftSeries = series.filter((s) => s.axis !== 'right');
  const rightSeries = series.filter((s) => s.axis === 'right');
  const barSeries = series.filter((s) => !s.isLine);
  const lineSeries = series.filter((s) => s.isLine);
  const vals = (list) => list.flatMap((s) => s.values.filter((v) => v !== null && v !== undefined));
  const all = stacked
    ? cats.map((_, i) => barSeries.reduce((sum, s) => sum + (s.values[i] || 0), 0))
    : vals(leftSeries);
  const yMin = spec.yMin || 0;
  const yMax = axisMax(spec, all);
  const step = spec.yStep || niceStep(yMax - yMin);
  const y2Max = hasRight ? axisMax({ yMax: y2spec.max }, vals(rightSeries)) : 1;
  const pw = W - M.left - M.right, ph = H - M.top - M.bottom;
  const y = (v) => M.top + ph - ((v - yMin) / (yMax - yMin)) * ph;
  const yR = (v) => M.top + ph - (v / y2Max) * ph;
  const band = pw / Math.max(cats.length, 1);
  const cx = (i) => M.left + band * i + band / 2;

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'pa-chart-svg' });

  // קווי רשת וערכי ציר Y
  for (let v = yMin; v <= yMax + 1e-9; v += step) {
    svg.appendChild(svgEl('line', { x1: M.left, x2: W - M.right, y1: y(v), y2: y(v), class: 'pa-grid' }));
    svg.appendChild(svgEl('text', { x: M.left - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'pa-tick' }, fmt(v, spec.unit)));
  }
  // ציר ימני: על אותם קווי רשת, עם ערכים משלו
  if (hasRight) {
    const ticks = Math.max(Math.round((yMax - yMin) / step), 1);
    for (let k = 0; k <= ticks; k++) {
      const v = (y2Max / ticks) * k;
      svg.appendChild(svgEl('text', { x: W - M.right + 8, y: yR(v) + 4, 'text-anchor': 'start', class: 'pa-tick' }, fmt(v, y2spec.unit)));
    }
    if (y2spec.label) {
      svg.appendChild(svgEl('text', { x: M.top + ph / 2, y: -(W - 16), transform: 'rotate(90)', 'text-anchor': 'middle', class: 'pa-axis-label' }, y2spec.label));
    }
  }
  svg.appendChild(svgEl('line', { x1: M.left, x2: W - M.right, y1: y(yMin), y2: y(yMin), class: 'pa-axis' }));

  // ערכי ציר X — אם יש הרבה קטגוריות, מדלגים כדי שלא יתנגשו
  const every = Math.ceil(cats.length / 12);
  cats.forEach((c, i) => {
    if (i % every) return;
    svg.appendChild(svgEl('text', { x: cx(i), y: H - M.bottom + 18, 'text-anchor': 'middle', class: 'pa-tick' }, c));
  });
  if (spec.xLabel) svg.appendChild(svgEl('text', { x: M.left + pw / 2, y: H - 10, 'text-anchor': 'middle', class: 'pa-axis-label' }, spec.xLabel));
  if (spec.yLabel) {
    svg.appendChild(svgEl('text', {
      x: -(M.top + ph / 2), y: 18, transform: 'rotate(-90)', 'text-anchor': 'middle', class: 'pa-axis-label',
    }, spec.yLabel));
  }

  // עמודות קודם, כדי שהקווים יהיו מעליהן
  if (barSeries.length) {
    const groupW = band * 0.74;
    const barW = stacked ? groupW * 0.8 : groupW / barSeries.length;
    cats.forEach((_, i) => {
      let base = yMin;
      barSeries.forEach((s, bi) => {
        const v = s.values[i];
        if (v === null || v === undefined) return;
        const right = s.axis === 'right';
        const sy = right ? yR : y;
        const cls = `pa-s${(s.si % 4) + 1}`;
        const x = stacked ? cx(i) - barW / 2 : cx(i) - groupW / 2 + barW * bi;
        const top = stacked ? sy(base + v) : sy(v);
        const bottom = stacked ? sy(base) : sy(right ? 0 : yMin);
        svg.appendChild(svgEl('rect', { x: x + 1, y: top, width: Math.max(barW - 2, 1), height: Math.max(bottom - top, 0), class: `pa-bar ${cls}` }));
        if (spec.valueLabels) {
          const ty = stacked ? (top + bottom) / 2 + 4 : top - 5;
          svg.appendChild(svgEl('text', { x: x + barW / 2, y: ty, 'text-anchor': 'middle', class: stacked ? 'pa-value pa-value-in' : 'pa-value' }, fmt(v, right ? y2spec.unit : spec.unit)));
        }
        base += v;
      });
    });
  }

  lineSeries.forEach((s, li) => {
    const right = s.axis === 'right';
    const sy = right ? yR : y;
    const unit = right ? y2spec.unit : spec.unit;
    const cls = `pa-s${(s.si % 4) + 1}`;
    const pts = s.values.map((v, i) => (v === null || v === undefined ? null : [cx(i), sy(v)]));
    // קו נקטע במקום שאין בו נתון (null)
    let d = '';
    pts.forEach((p, i) => { if (p) d += `${d && pts[i - 1] ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)} `; });
    svg.appendChild(svgEl('path', { d, class: `pa-line ${cls}` }));
    pts.forEach((p, i) => {
      if (!p) return;
      svg.appendChild(svgEl('circle', { cx: p[0], cy: p[1], r: 3.6, class: `pa-dot ${cls}` }));
      // בקו השני התווית מתחת לנקודה, כדי שלא תתנגש בתווית של הקו הראשון
      const ly = li % 2 ? p[1] + 17 : p[1] - 9;
      if (spec.valueLabels) svg.appendChild(svgEl('text', { x: p[0], y: ly, 'text-anchor': 'middle', class: 'pa-value' }, fmt(s.values[i], unit)));
    });
  });
  return svg;
}

// ===== עוגה — סדרה אחת, כל קטגוריה היא פרוסה =====
function drawPie(spec) {
  const W = 640, H = 300, cx = W / 2, cy = H / 2, r = 120;
  const values = spec.series && spec.series[0] ? spec.series[0].values : [];
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'pa-chart-svg' });
  let angle = -Math.PI / 2;
  values.forEach((v, i) => {
    const a2 = angle + (v / total) * Math.PI * 2;
    const large = a2 - angle > Math.PI ? 1 : 0;
    const p1 = [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    const p2 = [cx + r * Math.cos(a2), cy + r * Math.sin(a2)];
    svg.appendChild(svgEl('path', { d: `M${cx},${cy} L${p1[0]},${p1[1]} A${r},${r} 0 ${large} 1 ${p2[0]},${p2[1]} Z`, class: `pa-bar pa-slice pa-s${(i % 4) + 1}` }));
    const mid = (angle + a2) / 2;
    if (spec.valueLabels !== false) {
      const lx = cx + (r + 18) * Math.cos(mid), ly = cy + (r + 18) * Math.sin(mid);
      svg.appendChild(svgEl('text', { x: lx, y: ly + 4, 'text-anchor': Math.cos(mid) >= 0 ? 'start' : 'end', class: 'pa-value' }, fmt(v, spec.unit)));
    }
    angle = a2;
  });
  return svg;
}

// ===== עמודות אופקיות — דירוג. התוויות מימין, כמו בגרפים בעברית =====
function drawHBar(spec) {
  const cats = spec.categories || [];
  const series = spec.series || [];
  const rowH = 30 * Math.max(series.length, 1) + 8;
  const W = 640, H = 30 + rowH * cats.length + (spec.xLabel ? 30 : 10);
  const M = { top: 10, right: 150, bottom: spec.xLabel ? 44 : 24, left: 48 };
  const all = series.flatMap((s) => s.values);
  const xMax = axisMax(spec, all);
  const step = spec.yStep || niceStep(xMax);
  const pw = W - M.left - M.right;
  // בעברית העמודות יוצאות מימין, צמוד לתוויות
  const x = (v) => W - M.right - (v / xMax) * pw;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'pa-chart-svg' });
  const bottomY = H - M.bottom;

  for (let v = 0; v <= xMax + 1e-9; v += step) {
    svg.appendChild(svgEl('line', { x1: x(v), x2: x(v), y1: M.top, y2: bottomY, class: 'pa-grid' }));
    svg.appendChild(svgEl('text', { x: x(v), y: bottomY + 16, 'text-anchor': 'middle', class: 'pa-tick' }, fmt(v, spec.unit)));
  }
  if (spec.xLabel) svg.appendChild(svgEl('text', { x: M.left + pw / 2, y: H - 6, 'text-anchor': 'middle', class: 'pa-axis-label' }, spec.xLabel));

  cats.forEach((c, i) => {
    const rowTop = M.top + rowH * i + 4;
    svg.appendChild(svgEl('text', { x: W - M.right + 10, y: rowTop + rowH / 2, 'text-anchor': 'start', class: 'pa-tick pa-cat', direction: 'rtl' }, c));
    series.forEach((s, si) => {
      const v = s.values[i];
      const h = (rowH - 8) / series.length;
      const top = rowTop + h * si;
      svg.appendChild(svgEl('rect', { x: x(v), y: top + 1, width: Math.max(x(0) - x(v), 0), height: h - 2, class: `pa-bar pa-s${(si % 4) + 1}` }));
      if (spec.valueLabels) svg.appendChild(svgEl('text', { x: x(v) - 5, y: top + h / 2 + 4, 'text-anchor': 'end', class: 'pa-value' }, fmt(v, spec.unit)));
    });
  });
  svg.appendChild(svgEl('line', { x1: x(0), x2: x(0), y1: M.top, y2: bottomY, class: 'pa-axis' }));
  return svg;
}
