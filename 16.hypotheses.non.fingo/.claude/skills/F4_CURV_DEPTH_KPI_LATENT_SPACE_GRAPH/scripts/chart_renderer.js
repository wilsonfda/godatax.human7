/**
 * Self-contained SVG renderer for F4_CURV_DEPTH_KPI_LATENT_SPACE_GRAPH.
 *
 * Byte-identical to F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS_GRAPH's own scripts/chart_renderer.js --
 * the three card renderers below are already generic over a labeled "feature-like" axis (code,
 * name, optional perspective/group, RMS/weight or signed difference), so plotting real
 * GDX_HNF_CDIH_* rows (CDIh instead of CDIx, latent dimensions instead of features) needs no
 * renderer change, only different data at the call site in generate_curvature_depth_graph_latent.js:
 *   1. a histogram of every complete-case person's own CDIh(t)/CDIh_w(t) in one run,
 *   2. a per-latent-dimension ranking of how much each dimension contributes to that run's own
 *      CDIh (the RMS of each dimension's real per-person difference, across the whole run) --
 *      the layer's own per-dimension breakdown, never discarded behind the aggregate scalar,
 *   3. one diverging bar chart per representative person (lowest / median-closest / highest CDIh
 *      in the run), showing that person's own real per-dimension signed difference vector.
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
// Slot 1 (blue) = the CDI distribution / positive (above-reference) differences; slot 2 (orange)
// = the median marker / negative (below-reference) differences -- same two-hue convention this
// folder's other graph skills already use for "primary series" vs "secondary marker".
const PRIMARY_COLOR = { light: PALETTE.categorical.light[0], dark: PALETTE.categorical.dark[0] };
const SECONDARY_COLOR = { light: PALETTE.categorical.light[1], dark: PALETTE.categorical.dark[1] };

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

/**
 * Card 1 -- histogram of every complete-case person's own metric value in this run.
 * values: [{ personId, cdiValue }], already real, non-fabricated rows (GDX_HNF_CDI_VALUE for
 * CDIx, GDX_HNF_CDIH_VALUE for CDIh). metricLabel/metricNoun default to the original CDIx
 * wording so this call stays a no-op for F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS_GRAPH's own
 * (unparameterized) call site; F4_CURV_DEPTH_KPI_LATENT_SPACE_GRAPH passes 'CDIh'/'this run's own
 * fitted latent space'.
 */
function renderHistogramCard({ values, runLabel, weighting, referenceLabel, cardId, mode = 'light', metricLabel = 'CDI', metricNoun = 'normalized feature space' }) {
  const barColor = PRIMARY_COLOR[mode];
  const medianColor = SECONDARY_COLOR[mode];
  const n = values.length;
  const nums = values.map((v) => v.cdiValue);
  const min = Math.min(...nums), max = Math.max(...nums);
  const mean = nums.reduce((a, b) => a + b, 0) / n;
  const sorted = [...nums].sort((a, b) => a - b);
  const median = sorted.length % 2 === 1 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

  const binCount = Math.min(18, Math.max(6, Math.ceil(Math.sqrt(n))));
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

  const W = 900, H = 320, marginL = 50, marginR = 24, marginT = 14, marginB = 44;
  const plotW = W - marginL - marginR, plotH = H - marginT - marginB;
  const yTicks = niceTicks(0, maxCount * 1.08, 4);
  const yMax = yTicks[yTicks.length - 1];
  const xAt = (v) => marginL + ((v - min) / (domainMax - min)) * plotW;
  const yAt = (count) => marginT + plotH - (count / yMax) * plotH;

  const barsSvg = bins.map((count, i) => {
    const x0 = xAt(min + i * binWidth);
    const x1 = xAt(min + (i + 1) * binWidth);
    const y = yAt(count);
    const tip = `${esc(metricLabel)} in [${fmt(min + i * binWidth, 3)}, ${fmt(min + (i + 1) * binWidth, 3)})<br>${count} person(s)`;
    return `<rect class="bar" data-tip="${tip}" x="${(x0 + 1).toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(0, x1 - x0 - 2).toFixed(2)}" height="${(marginT + plotH - y).toFixed(2)}" fill="${barColor}" opacity="0.85"/>`;
  }).join('\n');

  const gridSvg = yTicks.map((t) => `<line class="grid-line" x1="${marginL}" x2="${W - marginR}" y1="${yAt(t).toFixed(2)}" y2="${yAt(t).toFixed(2)}"/>
    <text class="axis-label" x="${marginL - 8}" y="${(yAt(t) + 4).toFixed(2)}" text-anchor="end">${Math.round(t)}</text>`).join('\n');
  const xTicks = niceTicks(min, domainMax, 6);
  const xTicksSvg = xTicks.filter((t) => t >= min - 1e-9 && t <= domainMax + 1e-9)
    .map((t) => `<text class="axis-label" x="${xAt(t).toFixed(2)}" y="${H - marginB + 20}" text-anchor="middle">${fmt(t, 2)}</text>`).join('\n');

  const meanX = xAt(mean).toFixed(2);
  const medianX = xAt(median).toFixed(2);
  const meanLine = `<line x1="${meanX}" x2="${meanX}" y1="${marginT}" y2="${marginT + plotH}" stroke="var(--axis)" stroke-width="1.5" stroke-dasharray="5,4"/>`;
  const medianLine = `<line x1="${medianX}" x2="${medianX}" y1="${marginT}" y2="${marginT + plotH}" stroke="${medianColor}" stroke-width="1.5" stroke-dasharray="2,3"/>`;

  const legendSvg = `
    <div class="legend">
      <div class="legend-item"><span class="legend-swatch fill" style="background:${barColor}"></span>${esc(metricLabel)} distribution (n=${n} complete-case persons)</div>
      <div class="legend-item"><span class="legend-swatch dashed" style="border-color:var(--axis)"></span>Mean = ${fmt(mean)}</div>
      <div class="legend-item"><span class="legend-swatch dashed" style="border-color:${medianColor}"></span>Median = ${fmt(median)}</div>
    </div>`;

  const tableRows = [...values].sort((a, b) => a.cdiValue - b.cdiValue)
    .map((v, i) => `<tr><td>${i + 1}</td><td>Person #${esc(v.personId)}</td><td>${fmt(v.cdiValue)}</td></tr>`).join('');

  return `
    <div class="chart-card">
      <p class="card-title">${esc(metricLabel)} distribution across this run's own complete-case sample</p>
      <p class="card-subtitle">Run "${esc(runLabel)}" (${esc(weighting)}) against reference "${esc(referenceLabel)}" &middot; n=${n}, min=${fmt(min)}, mean=${fmt(mean)}, median=${fmt(median)}, max=${fmt(max)}.</p>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Histogram of ${esc(metricLabel)} values across complete-case persons">
        ${gridSvg}
        <line class="baseline" x1="${marginL}" x2="${W - marginR}" y1="${(marginT + plotH).toFixed(2)}" y2="${(marginT + plotH).toFixed(2)}"/>
        ${barsSvg}
        ${meanLine}
        ${medianLine}
        ${xTicksSvg}
        <text class="axis-label" x="${(marginL + plotW / 2).toFixed(2)}" y="${H - 6}" text-anchor="middle">${esc(metricLabel)} value (RMS displacement, ${esc(metricNoun)})</text>
        <text class="axis-label" x="12" y="${marginT + 10}" transform="rotate(-90 12 ${marginT + 10})" text-anchor="end">Persons</text>
      </svg>
      ${legendSvg}
      <table class="data-table" id="${cardId}-table"><thead><tr><th>Rank</th><th>Person</th><th>${esc(metricLabel)} value</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
    </div>`;
}

/**
 * Card 2 -- per-axis ranking of real RMS contribution to this run's own metric
 * (sqrt(mean over persons of DIFFERENCE^2) for each item), sorted descending.
 * features: [{ featureCode, featureName, perspectiveName, weight, rmsDiff, sampleSize }].
 * metricLabel/axisNoun default to the original CDIx/feature wording so this call stays a no-op
 * for F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS_GRAPH's own (unparameterized) call site;
 * F4_CURV_DEPTH_KPI_LATENT_SPACE_GRAPH passes 'CDIh'/'dimension'.
 */
function renderFeatureContributionCard({ features, weighting, cardId, mode = 'light', metricLabel = 'CDI', axisNoun = 'feature' }) {
  const axisNounCap = axisNoun.charAt(0).toUpperCase() + axisNoun.slice(1);
  const barColor = PRIMARY_COLOR[mode];
  const sorted = [...features].sort((a, b) => b.rmsDiff - a.rmsDiff);
  const maxVal = Math.max(...sorted.map((f) => f.rmsDiff), 1e-9);

  const rowH = 26, topPad = 10, labelW = 230;
  const W = 900, H = topPad * 2 + rowH * sorted.length;
  const plotL = labelW, plotR = W - 70, plotW = plotR - plotL;
  const xAt = (v) => plotL + (v / maxVal) * plotW;

  const barsSvg = sorted.map((f, i) => {
    const y = topPad + i * rowH;
    const barW = Math.max(1, xAt(f.rmsDiff) - plotL);
    const weightNote = weighting === 'WEIGHTED' ? `, weight=${fmt(f.weight, 2)}` : '';
    const tip = `${esc(f.featureName)} (${esc(f.featureCode)})<br>${esc(f.perspectiveName)}<br>RMS difference = ${fmt(f.rmsDiff)}${weightNote}`;
    return `
      <text class="bar-label" x="${(labelW - 10).toFixed(2)}" y="${(y + rowH / 2 + 4).toFixed(2)}" text-anchor="end">${esc(f.featureCode)}</text>
      <rect class="bar" data-tip="${tip}" x="${plotL}" y="${(y + 4).toFixed(2)}" width="${barW.toFixed(2)}" height="${(rowH - 10).toFixed(2)}" fill="${barColor}" opacity="0.85"/>
      <text class="bar-label" x="${(xAt(f.rmsDiff) + 6).toFixed(2)}" y="${(y + rowH / 2 + 4).toFixed(2)}">${fmt(f.rmsDiff, 3)}${weighting === 'WEIGHTED' ? ` (w=${fmt(f.weight, 2)})` : ''}</text>`;
  }).join('\n');

  const tableRows = sorted.map((f) =>
    `<tr><td>${esc(f.featureCode)}</td><td>${esc(f.featureName)}</td><td>${esc(f.perspectiveName)}</td><td>${fmt(f.rmsDiff)}</td><td>${weighting === 'WEIGHTED' ? fmt(f.weight, 2) : '1 (unweighted)'}</td></tr>`).join('');

  return `
    <div class="chart-card">
      <p class="card-title">Per-${esc(axisNoun)} contribution to this run's own ${esc(metricLabel)}</p>
      <p class="card-subtitle">RMS of each ${esc(axisNoun)}'s real signed difference (current − reference) across every complete-case person in this run, sorted descending. This is the breakdown summarized away by the single ${esc(metricLabel)} scalar -- it never replaces examining the full per-${esc(axisNoun)} difference vector.</p>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Per-${esc(axisNoun)} RMS contribution to the ${esc(metricLabel)}">
        ${barsSvg}
      </svg>
      <table class="data-table" id="${cardId}-table"><thead><tr><th>${esc(axisNounCap)}</th><th>Name</th><th>Perspective</th><th>RMS difference</th><th>Weight</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
    </div>`;
}

/**
 * Card 3 -- one representative person's own full per-axis signed difference vector, as a
 * diverging bar chart from zero. details: [{ featureCode, featureName, difference }].
 * metricLabel/axisNoun default to the original CDIx/feature wording so this call stays a no-op
 * for F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS_GRAPH's own (unparameterized) call site;
 * F4_CURV_DEPTH_KPI_LATENT_SPACE_GRAPH passes 'CDIh'/'dimension'.
 */
function renderPersonProfileCard({ personId, cdiValue, roleLabel, details, cardId, mode = 'light', metricLabel = 'CDI', axisNoun = 'feature' }) {
  const axisNounCap = axisNoun.charAt(0).toUpperCase() + axisNoun.slice(1);
  const posColor = PRIMARY_COLOR[mode];
  const negColor = SECONDARY_COLOR[mode];
  const maxAbs = Math.max(...details.map((d) => Math.abs(d.difference)), 1e-9);

  const rowH = 24, topPad = 10, labelW = 230;
  const W = 900, H = topPad * 2 + rowH * details.length;
  const plotL = labelW, plotR = W - 20, plotW = plotR - plotL;
  const zeroX = plotL + plotW / 2;
  const xAt = (v) => zeroX + (v / maxAbs) * (plotW / 2);

  const barsSvg = details.map((d, i) => {
    const y = topPad + i * rowH;
    const x0 = xAt(0), x1 = xAt(d.difference);
    const barColor = d.difference >= 0 ? posColor : negColor;
    const tip = `${esc(d.featureName)} (${esc(d.featureCode)})<br>current − reference = ${fmt(d.difference)}`;
    return `
      <text class="bar-label" x="${(labelW - 10).toFixed(2)}" y="${(y + rowH / 2 + 4).toFixed(2)}" text-anchor="end">${esc(d.featureCode)}</text>
      <rect class="bar" data-tip="${tip}" x="${Math.min(x0, x1).toFixed(2)}" y="${(y + 3).toFixed(2)}" width="${Math.max(1, Math.abs(x1 - x0)).toFixed(2)}" height="${(rowH - 8).toFixed(2)}" fill="${barColor}" opacity="0.85"/>`;
  }).join('\n');
  const zeroLine = `<line x1="${zeroX.toFixed(2)}" x2="${zeroX.toFixed(2)}" y1="${topPad - 4}" y2="${H - topPad + 4}" stroke="var(--axis)" stroke-width="1"/>`;

  const legendSvg = `
    <div class="legend">
      <div class="legend-item"><span class="legend-swatch fill" style="background:${posColor}"></span>Above reference (current &gt; reference)</div>
      <div class="legend-item"><span class="legend-swatch fill" style="background:${negColor}"></span>Below reference (current &lt; reference)</div>
    </div>`;

  const tableRows = [...details].sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
    .map((d) => `<tr><td>${esc(d.featureCode)}</td><td>${esc(d.featureName)}</td><td>${fmt(d.difference)}</td></tr>`).join('');

  return `
    <div class="chart-card">
      <p class="card-title">Person #${esc(personId)} -- ${esc(roleLabel)} in this run (${esc(metricLabel)} = ${fmt(cdiValue)})</p>
      <p class="card-subtitle">Real per-${esc(axisNoun)} signed difference (current − reference) for this one person -- the aggregate ${esc(metricLabel)} scalar discards direction; this is what actually moved.</p>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Per-${esc(axisNoun)} difference profile for person ${esc(personId)}">
        ${zeroLine}
        ${barsSvg}
      </svg>
      ${legendSvg}
      <table class="data-table" id="${cardId}-table"><thead><tr><th>${esc(axisNounCap)}</th><th>Name</th><th>Difference</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
    </div>`;
}

module.exports = {
  esc, niceTicks, fmt, pageShell, hookTooltips,
  renderHistogramCard, renderFeatureContributionCard, renderPersonProfileCard,
  PALETTE,
};
