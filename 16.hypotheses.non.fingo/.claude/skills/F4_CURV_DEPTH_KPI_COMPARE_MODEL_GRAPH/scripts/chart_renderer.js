/**
 * Self-contained SVG renderer for F4_CURV_DEPTH_KPI_COMPARE_MODEL_GRAPH.
 *
 * Three card types, all built from real GDX_HNF_CDI_COMPARE_VALUE rows written by
 * F4_CURV_DEPTH_KPI_COMPARE_MODEL (never a fabricated/illustrative value, per this project's
 * "Never invent missing data" rule). Pearson r, ranks, and the three representative persons are
 * all computed HERE, at render time, directly from those already-frozen rows -- lightweight,
 * deterministic descriptive statistics, never persisted by the compute layer underneath them
 * (the same posture F3's own GRAPH skill already takes toward its own Pearson r, and F4's own
 * GRAPH skills take toward histogram mean/median and per-feature RMS contribution ranking):
 *   1. two histograms side by side -- CDIx's own distribution and CDIh's own distribution --
 *      over the SAME paired-person set, each kept on its own scale,
 *   2. a scatter of (CDIx, CDIh) per paired person, annotated with the real Pearson r -- an
 *      association, never an equivalence,
 *   3. a back-to-back bar panel for the three representative persons (lowest / median-closest /
 *      highest CDIx among the paired set), showing each one's own real CDIx (left, its own
 *      scale) and real CDIh (right, its own, separate scale) so a rank mismatch between the two
 *      spaces is directly visible.
 *
 * Follows this repo's existing dataviz-skill-derived house style (same validated categorical
 * palette and chrome tokens as this folder's other graph skills). Duplicated here (not
 * require()'d from a sibling skill) because each numbered folder in this repo is its own
 * close-to-self-contained unit (see this repo's CLAUDE.md "Folder map"), and each skill under
 * this folder duplicates it again for the same reason.
 */

const PALETTE = {
  categorical: {
    light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
    dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  },
  chrome: {
    light: { surface: '#fcfcfb', page: '#f9f9f7', ink: '#0b0b0b', inkSecondary: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7' },
    dark: { surface: '#1a1a19', page: '#0d0d0d', ink: '#ffffff', inkSecondary: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', axis: '#383835' },
  },
};
// Slot 1 (blue) = CDIx / the "original feature space" series; slot 2 (orange) = CDIh / the
// "latent space" series -- kept visually distinct everywhere the two spaces appear side by side.
const CDIX_COLOR = { light: PALETTE.categorical.light[0], dark: PALETTE.categorical.dark[0] };
const CDIH_COLOR = { light: PALETTE.categorical.light[1], dark: PALETTE.categorical.dark[1] };

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function niceTicks(min, max, count = 5) {
  if (min === max) { min -= 1; max += 1; }
  const range = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(range / count)));
  const err = (count * step) / range;
  let niceStep = step;
  if (err <= 0.15) niceStep = step * 10;
  else if (err <= 0.35) niceStep = step * 5;
  else if (err <= 0.75) niceStep = step * 2;
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  const ticks = [];
  for (let t = niceMin; t <= niceMax + niceStep / 2; t += niceStep) ticks.push(Math.round(t * 1e6) / 1e6);
  return ticks;
}

function fmt(n, digits = 3) {
  return (n === null || n === undefined || !Number.isFinite(n)) ? '—' : Number(n).toFixed(digits);
}

/** Pearson product-moment correlation coefficient of two equal-length real arrays, or null when
 * fewer than 3 points or a degenerate (zero-variance) series makes the statistic undefined --
 * never fabricated from too few points or a flat series. */
function pearsonR(xs, ys) {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Ranks (1 = lowest) every entry of `paired` by `field`, ascending. Returns a Map personId ->
 * rank. Ties keep stable input order (no special tie-breaking beyond that). */
function rankByField(paired, field) {
  const sorted = [...paired].sort((a, b) => a[field] - b[field]);
  return new Map(sorted.map((p, i) => [p.personId, i + 1]));
}

/** Picks the three representative persons by CDIx rank within the paired set (lowest,
 * median-closest, highest) and attaches each one's own CDIx/CDIh rank among the paired persons --
 * the concrete, checkable form of "ranks need not agree between the two spaces". */
function pickRepresentatives(paired) {
  const n = paired.length;
  const byCdiAsc = [...paired].sort((a, b) => a.cdiValue - b.cdiValue);
  const cdiRank = rankByField(paired, 'cdiValue');
  const cdihRank = rankByField(paired, 'cdihValue');

  const lowest = byCdiAsc[0];
  const highest = byCdiAsc[n - 1];
  const medianValue = n % 2 === 1 ? byCdiAsc[(n - 1) / 2].cdiValue : (byCdiAsc[n / 2 - 1].cdiValue + byCdiAsc[n / 2].cdiValue) / 2;
  let medianClosest = byCdiAsc[0];
  let bestDist = Infinity;
  for (const p of byCdiAsc) {
    const dist = Math.abs(p.cdiValue - medianValue);
    if (dist < bestDist) { bestDist = dist; medianClosest = p; }
  }

  const annotate = (p, roleLabel) => ({
    personId: p.personId, cdiValue: p.cdiValue, cdihValue: p.cdihValue, roleLabel,
    cdiRank: cdiRank.get(p.personId), cdihRank: cdihRank.get(p.personId), totalPaired: n,
  });
  return [
    annotate(lowest, 'lowest CDIx'),
    annotate(medianClosest, 'closest to median CDIx'),
    annotate(highest, 'highest CDIx'),
  ];
}

function pageShell({ title, description, metaLines, bodyHtml, script = '', extraStyle = '' }) {
  const metaHtml = (metaLines || []).map((l) => esc(l)).join('<br>');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px 24px 48px;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    background: var(--page); color: var(--ink);
    display: flex; flex-direction: column; align-items: center;
  }
  .viz-root {
    color-scheme: light;
    --surface: ${PALETTE.chrome.light.surface}; --page: ${PALETTE.chrome.light.page};
    --ink: ${PALETTE.chrome.light.ink}; --ink-secondary: ${PALETTE.chrome.light.inkSecondary};
    --muted: ${PALETTE.chrome.light.muted}; --grid: ${PALETTE.chrome.light.grid}; --axis: ${PALETTE.chrome.light.axis};
    width: 100%; max-width: 1040px;
  }
  @media (prefers-color-scheme: dark) {
    :root:where(:not([data-theme="light"])) .viz-root {
      color-scheme: dark;
      --surface: ${PALETTE.chrome.dark.surface}; --page: ${PALETTE.chrome.dark.page};
      --ink: ${PALETTE.chrome.dark.ink}; --ink-secondary: ${PALETTE.chrome.dark.inkSecondary};
      --muted: ${PALETTE.chrome.dark.muted}; --grid: ${PALETTE.chrome.dark.grid}; --axis: ${PALETTE.chrome.dark.axis};
    }
  }
  :root[data-theme="dark"] .viz-root {
    color-scheme: dark;
    --surface: ${PALETTE.chrome.dark.surface}; --page: ${PALETTE.chrome.dark.page};
    --ink: ${PALETTE.chrome.dark.ink}; --ink-secondary: ${PALETTE.chrome.dark.inkSecondary};
    --muted: ${PALETTE.chrome.dark.muted}; --grid: ${PALETTE.chrome.dark.grid}; --axis: ${PALETTE.chrome.dark.axis};
  }
  body { background: var(--page); color: var(--ink); }
  h1 { font-size: 19px; font-weight: 600; margin: 0 0 4px; color: var(--ink); }
  .subtitle { font-size: 13px; color: var(--ink-secondary); margin: 0 0 10px; max-width: 760px; line-height: 1.5; }
  .meta { font-size: 11.5px; color: var(--muted); margin: 0 0 18px; max-width: 760px; line-height: 1.6; }
  .warning-banner {
    font-size: 12.5px; color: var(--ink-secondary); background: var(--surface);
    border: 1px solid var(--grid); border-left: 3px solid var(--axis); border-radius: 8px;
    padding: 10px 14px; margin: 0 0 18px; max-width: 760px; line-height: 1.55;
  }
  .toggle-row { display: flex; justify-content: flex-end; margin: 0 2px 10px; width: 100%; }
  .toggle-btn {
    font: inherit; font-size: 12px; color: var(--ink-secondary); background: transparent;
    border: 1px solid var(--grid); border-radius: 6px; padding: 5px 10px; cursor: pointer;
  }
  .toggle-btn:hover { border-color: var(--axis); color: var(--ink); }
  .chart-card {
    background: var(--surface); border-radius: 12px; padding: 18px 20px 14px;
    border: 1px solid var(--grid); overflow-x: auto; margin-bottom: 18px; width: 100%;
  }
  .card-title { font-size: 14px; font-weight: 600; color: var(--ink); margin: 0 0 2px; }
  .card-subtitle { font-size: 12px; color: var(--muted); margin: 0 0 10px; line-height: 1.5; }
  .card-note { font-size: 11.5px; color: var(--muted); margin: 8px 2px 0; line-height: 1.5; }
  svg { display: block; max-width: 100%; height: auto; font-family: inherit; }
  .axis-label { fill: var(--muted); font-size: 11px; }
  .bar-label { fill: var(--ink-secondary); font-size: 11px; }
  .grid-line { stroke: var(--grid); stroke-width: 1; }
  .baseline { stroke: var(--axis); stroke-width: 1; }
  .legend { display: flex; flex-wrap: wrap; gap: 14px; margin: 10px 2px 4px; font-size: 12px; color: var(--ink-secondary); }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-swatch { width: 16px; height: 0; border-top: 2px solid; flex: none; }
  .legend-swatch.dashed { border-top-style: dashed; }
  .legend-swatch.fill { width: 12px; height: 12px; border-top: none; border-radius: 2px; }
  .panel-row { display: flex; flex-wrap: wrap; gap: 18px; }
  .panel-half { flex: 1 1 380px; min-width: 0; }
  .panel-title { font-size: 12.5px; font-weight: 600; color: var(--ink-secondary); margin: 0 0 6px; }
  .tooltip {
    position: fixed; pointer-events: none; background: var(--ink); color: var(--surface);
    font-size: 12px; padding: 6px 9px; border-radius: 6px; line-height: 1.45;
    opacity: 0; transform: translate(-50%, -100%); transition: opacity 0.08s;
    z-index: 10; white-space: nowrap;
  }
  table.data-table { border-collapse: collapse; font-size: 12px; width: 100%; margin-top: 10px; display: none; }
  table.data-table.visible { display: table; }
  table.data-table th, table.data-table td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--grid); font-variant-numeric: tabular-nums; }
  table.data-table th { color: var(--muted); font-weight: 600; }
  table.data-table td { color: var(--ink-secondary); }
  .chart-svg.hidden-by-table { display: none; }
  .empty-note { font-size: 13px; color: var(--muted); padding: 8px 2px 4px; }
  ${extraStyle}
</style>
</head>
<body>
<div class="viz-root">
  <h1>${esc(title)}</h1>
  <p class="subtitle">${description}</p>
  ${metaHtml ? `<p class="meta">${metaHtml}</p>` : ''}
  <div class="warning-banner">
    This project's own design document introduces this comparison with a single <em>fictitious</em>
    pair of numbers and the caption <em>"Figura &mdash; Compara&ccedil;&atilde;o puramente fict&iacute;cia de
    &iacute;ndices em dois espa&ccedil;os; valores n&atilde;o s&atilde;o uma avalia&ccedil;&atilde;o de desempenho"</em>
    (&sect;7.1). Every value on this page is real and paired from this study's own database rows,
    but the same warning applies in full: CDIx and CDIh live in two different, generally
    non-comparable spaces and scales. A smaller or larger value in one space is <strong>never</strong>
    evidence of improvement, anomaly, or algorithm superiority, and this page is
    <strong>not a performance evaluation</strong> of either space or method.
  </div>
  <div class="toggle-row"><button class="toggle-btn" id="toggle-view">Show tables</button></div>
  ${bodyHtml}
</div>
<div class="tooltip" id="tooltip"></div>
<script>
  const tooltip = document.getElementById('tooltip');
  function showTip(evt, html) {
    tooltip.innerHTML = html;
    tooltip.style.left = evt.clientX + 'px';
    tooltip.style.top = (evt.clientY - 10) + 'px';
    tooltip.style.opacity = '1';
  }
  function hideTip() { tooltip.style.opacity = '0'; }
  document.getElementById('toggle-view').addEventListener('click', function () {
    const svgEls = document.querySelectorAll('.chart-svg');
    const tableEls = document.querySelectorAll('.data-table');
    const showingTable = tableEls.length ? !tableEls[0].classList.contains('visible') : false;
    svgEls.forEach(function (el) { el.classList.toggle('hidden-by-table', showingTable); });
    tableEls.forEach(function (el) { el.classList.toggle('visible', showingTable); });
    this.textContent = showingTable ? 'Show charts' : 'Show tables';
  });
  ${script}
</script>
</body>
</html>`;
}

function hookTooltips() {
  return `
    document.querySelectorAll('[data-tip]').forEach(function (el) {
      el.addEventListener('mouseenter', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mousemove', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mouseleave', hideTip);
    });`;
}

/** One half-width histogram panel (no card wrapper, no legend/table -- the caller combines two of
 * these into one card). nums: real numbers for one series. */
function renderHistogramPanel({ nums, color, axisCaption, mode = 'light' }) {
  const n = nums.length;
  const min = Math.min(...nums), max = Math.max(...nums);
  const mean = nums.reduce((a, b) => a + b, 0) / n;
  const sorted = [...nums].sort((a, b) => a - b);
  const median = sorted.length % 2 === 1 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

  const binCount = Math.min(14, Math.max(5, Math.ceil(Math.sqrt(n))));
  const domainMax = max > min ? max : max + 1;
  const binWidth = (domainMax - min) / binCount || 1;
  const bins = new Array(binCount).fill(0);
  for (const v of nums) {
    let idx = Math.floor((v - min) / binWidth);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx] += 1;
  }
  const maxCount = Math.max(...bins, 1);

  const W = 440, H = 260, marginL = 42, marginR = 16, marginT = 10, marginB = 42;
  const plotW = W - marginL - marginR, plotH = H - marginT - marginB;
  const yTicks = niceTicks(0, maxCount * 1.1, 4);
  const yMax = yTicks[yTicks.length - 1];
  const xAt = (v) => marginL + ((v - min) / (domainMax - min)) * plotW;
  const yAt = (count) => marginT + plotH - (count / yMax) * plotH;

  const barsSvg = bins.map((count, i) => {
    const x0 = xAt(min + i * binWidth);
    const x1 = xAt(min + (i + 1) * binWidth);
    const y = yAt(count);
    const tip = `[${fmt(min + i * binWidth, 3)}, ${fmt(min + (i + 1) * binWidth, 3)})<br>${count} person(s)`;
    return `<rect class="bar" data-tip="${tip}" x="${(x0 + 1).toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(0, x1 - x0 - 2).toFixed(2)}" height="${(marginT + plotH - y).toFixed(2)}" fill="${color}" opacity="0.85"/>`;
  }).join('\n');

  const gridSvg = yTicks.map((t) => `<line class="grid-line" x1="${marginL}" x2="${W - marginR}" y1="${yAt(t).toFixed(2)}" y2="${yAt(t).toFixed(2)}"/>
    <text class="axis-label" x="${marginL - 6}" y="${(yAt(t) + 4).toFixed(2)}" text-anchor="end">${Math.round(t)}</text>`).join('\n');
  const xTicks = niceTicks(min, domainMax, 5);
  const xTicksSvg = xTicks.filter((t) => t >= min - 1e-9 && t <= domainMax + 1e-9)
    .map((t) => `<text class="axis-label" x="${xAt(t).toFixed(2)}" y="${H - marginB + 18}" text-anchor="middle">${fmt(t, 2)}</text>`).join('\n');

  const meanX = xAt(mean).toFixed(2);
  const medianX = xAt(median).toFixed(2);
  const meanLine = `<line x1="${meanX}" x2="${meanX}" y1="${marginT}" y2="${marginT + plotH}" stroke="var(--axis)" stroke-width="1.5" stroke-dasharray="5,4"/>`;
  const medianLine = `<line x1="${medianX}" x2="${medianX}" y1="${marginT}" y2="${marginT + plotH}" stroke-width="1.5" stroke-dasharray="2,3" stroke="${color}" opacity="0.55"/>`;

  return {
    svg: `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Histogram, ${esc(axisCaption)}">
        ${gridSvg}
        <line class="baseline" x1="${marginL}" x2="${W - marginR}" y1="${(marginT + plotH).toFixed(2)}" y2="${(marginT + plotH).toFixed(2)}"/>
        ${barsSvg}
        ${meanLine}
        ${medianLine}
        ${xTicksSvg}
        <text class="axis-label" x="${(marginL + plotW / 2).toFixed(2)}" y="${H - 6}" text-anchor="middle">${esc(axisCaption)}</text>
      </svg>`,
    mean, median, min, max, n,
  };
}

/**
 * Card 1 -- paired distributions, two spaces. cdiNums/cdihNums are the SAME paired persons' real
 * CDIx/CDIh values (same length).
 */
function renderPairedHistogramsCard({ cdiNums, cdihNums, cdiRunLabel, cdihRunLabel, cdiReferenceLabel, cdihReferenceLabel, cdihMethod, cardId, mode = 'light' }) {
  const cdiColor = CDIX_COLOR[mode];
  const cdihColor = CDIH_COLOR[mode];
  const cdiPanel = renderHistogramPanel({ nums: cdiNums, color: cdiColor, axisCaption: 'CDIx value (normalized feature space)', mode });
  const cdihPanel = renderHistogramPanel({ nums: cdihNums, color: cdihColor, axisCaption: `CDIh value (latent space, ${esc(cdihMethod)})`, mode });

  const tableRows = cdiNums.map((v, i) => `<tr><td>${i + 1}</td><td>${fmt(v)}</td><td>${fmt(cdihNums[i])}</td></tr>`).join('');

  return `
    <div class="chart-card">
      <p class="card-title">Paired distributions across this study's own two spaces</p>
      <p class="card-subtitle">CDIx run "${esc(cdiRunLabel)}" (reference "${esc(cdiReferenceLabel)}") vs. CDIh run "${esc(cdihRunLabel)}" (reference "${esc(cdihReferenceLabel)}") &middot; n=${cdiNums.length} persons present in both runs. Each panel keeps its own axis -- the two distributions are never overlaid on one shared scale.</p>
      <div class="panel-row">
        <div class="panel-half">
          <p class="panel-title">CDIx &mdash; n=${cdiPanel.n}, mean=${fmt(cdiPanel.mean)}, median=${fmt(cdiPanel.median)}</p>
          ${cdiPanel.svg}
        </div>
        <div class="panel-half">
          <p class="panel-title">CDIh &mdash; n=${cdihPanel.n}, mean=${fmt(cdihPanel.mean)}, median=${fmt(cdihPanel.median)}</p>
          ${cdihPanel.svg}
        </div>
      </div>
      <table class="data-table" id="${cardId}-table"><thead><tr><th>#</th><th>CDIx</th><th>CDIh</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
    </div>`;
}

/**
 * Card 2 -- scatter of real (CDIx, CDIh) pairs, with Pearson r computed here at render time.
 * points: [{ personId, cdiValue, cdihValue }], all real, paired GDX_HNF_CDI_COMPARE_VALUE rows.
 */
function renderComparisonScatterCard({ points, cardId, mode = 'light' }) {
  const dotColor = CDIX_COLOR[mode];
  const xs = points.map((p) => p.cdiValue);
  const ys = points.map((p) => p.cdihValue);
  const r = pearsonR(xs, ys);

  const W = 560, H = 420, marginL = 56, marginR = 20, marginT = 14, marginB = 46;
  const plotW = W - marginL - marginR, plotH = H - marginT - marginB;
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xTicks = niceTicks(xMin, xMax, 5);
  const yTicks = niceTicks(yMin, yMax, 5);
  const xDomain = [xTicks[0], xTicks[xTicks.length - 1]];
  const yDomain = [yTicks[0], yTicks[yTicks.length - 1]];
  const xAt = (v) => marginL + ((v - xDomain[0]) / (xDomain[1] - xDomain[0] || 1)) * plotW;
  const yAt = (v) => marginT + plotH - ((v - yDomain[0]) / (yDomain[1] - yDomain[0] || 1)) * plotH;

  const gridSvg = yTicks.map((t) => `<line class="grid-line" x1="${marginL}" x2="${W - marginR}" y1="${yAt(t).toFixed(2)}" y2="${yAt(t).toFixed(2)}"/>
    <text class="axis-label" x="${marginL - 8}" y="${(yAt(t) + 4).toFixed(2)}" text-anchor="end">${fmt(t, 2)}</text>`).join('\n') +
    xTicks.map((t) => `<text class="axis-label" x="${xAt(t).toFixed(2)}" y="${H - marginB + 20}" text-anchor="middle">${fmt(t, 2)}</text>`).join('\n');

  const dotsSvg = points.map((p) => {
    const tip = `Person #${esc(p.personId)}<br>CDIx = ${fmt(p.cdiValue)}<br>CDIh = ${fmt(p.cdihValue)}`;
    return `<circle class="dot" data-tip="${tip}" cx="${xAt(p.cdiValue).toFixed(2)}" cy="${yAt(p.cdihValue).toFixed(2)}" r="4.5" fill="${dotColor}" opacity="0.75"/>`;
  }).join('\n');

  const rText = r === null ? 'insufficient paired persons (n &lt; 3 or a degenerate series)' : `r = ${fmt(r, 3)}`;
  const tableRows = points.map((p) => `<tr><td>Person #${esc(p.personId)}</td><td>${fmt(p.cdiValue)}</td><td>${fmt(p.cdihValue)}</td></tr>`).join('');

  return `
    <div class="chart-card">
      <p class="card-title">CDIx vs. CDIh, real paired persons (n=${points.length})</p>
      <p class="card-subtitle">One point per person present in both runs. Pearson ${rText}. This tests whether the two indices are statistically <em>associated</em> across this sample -- it is not a test of whether they are the same quantity, and not a causal claim.</p>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Scatter of CDIx vs CDIh, Pearson ${rText}">
        ${gridSvg}
        <line class="baseline" x1="${marginL}" x2="${W - marginR}" y1="${(marginT + plotH).toFixed(2)}" y2="${(marginT + plotH).toFixed(2)}"/>
        <line class="baseline" x1="${marginL}" x2="${marginL}" y1="${marginT}" y2="${(marginT + plotH).toFixed(2)}"/>
        ${dotsSvg}
        <text class="axis-label" x="${(marginL + plotW / 2).toFixed(2)}" y="${H - 6}" text-anchor="middle">CDIx (normalized feature space)</text>
        <text class="axis-label" x="14" y="${marginT + 10}" transform="rotate(-90 14 ${marginT + 10})" text-anchor="end">CDIh (latent space)</text>
      </svg>
      <p class="card-note">Pearson r is a real, computed descriptive statistic from this run pair's own paired sample -- an association, never evidence that CDIx and CDIh measure the same thing, never a causal mechanism, and never a performance ranking of either space.</p>
      <table class="data-table" id="${cardId}-table"><thead><tr><th>Person</th><th>CDIx</th><th>CDIh</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
    </div>`;
}

/**
 * Card 3 -- back-to-back bars for the three representative persons (lowest / median-closest /
 * highest CDIx among the paired set), each with its own real CDIx (left, own scale) and real
 * CDIh (right, own, separate scale). representatives: [{ personId, roleLabel, cdiValue,
 * cdihValue, cdiRank, cdihRank, totalPaired }].
 */
function renderRepresentativePairCard({ representatives, cardId, mode = 'light' }) {
  const cdiColor = CDIX_COLOR[mode];
  const cdihColor = CDIH_COLOR[mode];
  const maxCdi = Math.max(...representatives.map((r) => r.cdiValue), 1e-9);
  const maxCdih = Math.max(...representatives.map((r) => r.cdihValue), 1e-9);

  const rowH = 54, topPad = 16, labelW = 260;
  const W = 900, H = topPad * 2 + rowH * representatives.length + 20;
  const leftPlotL = 70, leftPlotR = (W - labelW) / 2;
  const rightPlotL = (W + labelW) / 2, rightPlotR = W - 70;
  const leftW = leftPlotR - leftPlotL, rightW = rightPlotR - rightPlotL;
  const xLeft = (v) => leftPlotR - (v / maxCdi) * leftW;
  const xRight = (v) => rightPlotL + (v / maxCdih) * rightW;

  const rowsSvg = representatives.map((rep, i) => {
    const y = topPad + i * rowH;
    const barY = y + 10, barH = rowH - 24;
    const leftX0 = xLeft(rep.cdiValue), leftX1 = leftPlotR;
    const rightX0 = rightPlotL, rightX1 = xRight(rep.cdihValue);
    const tipLeft = `Person #${esc(rep.personId)} (${esc(rep.roleLabel)})<br>CDIx = ${fmt(rep.cdiValue)} (rank ${rep.cdiRank} of ${rep.totalPaired} paired persons)`;
    const tipRight = `Person #${esc(rep.personId)} (${esc(rep.roleLabel)})<br>CDIh = ${fmt(rep.cdihValue)} (rank ${rep.cdihRank} of ${rep.totalPaired} paired persons)`;
    return `
      <rect class="bar" data-tip="${tipLeft}" x="${leftX0.toFixed(2)}" y="${barY.toFixed(2)}" width="${Math.max(1, leftX1 - leftX0).toFixed(2)}" height="${barH}" fill="${cdiColor}" opacity="0.85"/>
      <text class="bar-label" x="${(leftX0 - 6).toFixed(2)}" y="${(barY + barH / 2 + 4).toFixed(2)}" text-anchor="end">${fmt(rep.cdiValue)}</text>
      <rect class="bar" data-tip="${tipRight}" x="${rightX0.toFixed(2)}" y="${barY.toFixed(2)}" width="${Math.max(1, rightX1 - rightX0).toFixed(2)}" height="${barH}" fill="${cdihColor}" opacity="0.85"/>
      <text class="bar-label" x="${(rightX1 + 6).toFixed(2)}" y="${(barY + barH / 2 + 4).toFixed(2)}">${fmt(rep.cdihValue)}</text>
      <text class="bar-label" x="${(W / 2).toFixed(2)}" y="${(barY + barH / 2 - 10).toFixed(2)}" text-anchor="middle" style="font-weight:600">Person #${esc(rep.personId)}</text>
      <text class="axis-label" x="${(W / 2).toFixed(2)}" y="${(barY + barH / 2 + 12).toFixed(2)}" text-anchor="middle">${esc(rep.roleLabel)} &middot; CDIx rank ${rep.cdiRank}/${rep.totalPaired}, CDIh rank ${rep.cdihRank}/${rep.totalPaired}</text>`;
  }).join('\n');

  const divider = `<line x1="${(W / 2).toFixed(2)}" x2="${(W / 2).toFixed(2)}" y1="${topPad - 6}" y2="${H - topPad + 6}" class="grid-line"/>`;
  const headerSvg = `
      <text class="axis-label" x="${leftPlotL}" y="${topPad - 4}">&larr; CDIx (normalized feature space)</text>
      <text class="axis-label" x="${rightPlotR}" y="${topPad - 4}" text-anchor="end">CDIh (latent space) &rarr;</text>`;

  const tableRows = representatives.map((rep) =>
    `<tr><td>Person #${esc(rep.personId)}</td><td>${esc(rep.roleLabel)}</td><td>${fmt(rep.cdiValue)} (rank ${rep.cdiRank}/${rep.totalPaired})</td><td>${fmt(rep.cdihValue)} (rank ${rep.cdihRank}/${rep.totalPaired})</td></tr>`).join('');

  return `
    <div class="chart-card">
      <p class="card-title">Representative persons, two spaces side by side</p>
      <p class="card-subtitle">The three persons at the lowest, median-closest, and highest CDIx among the paired set, each shown with their own real CDIx (left, own scale) and real CDIh (right, own, separate scale). A person's rank need not agree between the two spaces -- that disagreement, when it happens, is itself the point of this card, not an error.</p>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Representative persons, CDIx and CDIh side by side">
        ${headerSvg}
        ${divider}
        ${rowsSvg}
      </svg>
      <div class="legend">
        <div class="legend-item"><span class="legend-swatch fill" style="background:${cdiColor}"></span>CDIx</div>
        <div class="legend-item"><span class="legend-swatch fill" style="background:${cdihColor}"></span>CDIh</div>
      </div>
      <table class="data-table" id="${cardId}-table"><thead><tr><th>Person</th><th>Role</th><th>CDIx</th><th>CDIh</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
    </div>`;
}

module.exports = {
  esc, niceTicks, fmt, pearsonR, pickRepresentatives, pageShell, hookTooltips,
  renderPairedHistogramsCard, renderComparisonScatterCard, renderRepresentativePairCard,
  PALETTE,
};
