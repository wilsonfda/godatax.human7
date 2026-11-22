/**
 * Self-contained SVG renderer for F1_GDX_SKILL_MFS_GRAPH.
 *
 * Template: GDX_CTP_H7/GDX_DOCUMENTS/GDX_HUMAN/GoDataX_Human7ph_Documento_Unificado_Completo.docx,
 * section 3 ("F1 -- Normalizacao e comparabilidade"), figure 3.F1 ("Figura -- Curva de
 * referencia e observacao em escala z; valores apenas ilustrativos" / "Figure -- Reference
 * curve and observation in z-scale; illustrative values only", embedded as word/media/image2.png).
 * That figure plots the standard normal density, a dashed line at the reference mean (z=0), and
 * one solid vertical rule at one illustrative observation (z=1.35). This module draws the exact
 * same three marks, but every rule drawn by generate_mfs_graph.js is a real, non-fabricated
 * GDX_HNF_FEATURE_VALUE.NORMALIZED_VALUE row -- never a placeholder number -- and a study usually
 * has many observations per feature (one per participant), not one.
 *
 * Follows this repo's existing dataviz-skill-derived house style (8.gdx.dashboards/.claude/
 * skills/GDX_SKILL_MAKE_DASHBOARS_DW/scripts/chart_lib.js): same validated categorical palette
 * and chrome tokens, 2px lines, hairline solid gridlines, a legend for >=2 series, hover
 * tooltips, a table-view fallback, light+dark theme via CSS custom properties. Duplicated here
 * (not require()'d from 8.gdx.dashboards) because each numbered folder in this repo is its own
 * close-to-self-contained unit (see this repo's CLAUDE.md "Folder map").
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
// Slot 1 (blue) = reference distribution; slot 2 (orange) = observations -- same two hues the
// template figure itself uses for the curve and the observation rule.
const CURVE_COLOR = { light: PALETTE.categorical.light[0], dark: PALETTE.categorical.dark[0] };
const OBS_COLOR = { light: PALETTE.categorical.light[1], dark: PALETTE.categorical.dark[1] };

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function normalPdf(z) {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
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
  for (let t = niceMin; t <= niceMax + niceStep / 2; t += niceStep) ticks.push(Math.round(t * 1000) / 1000);
  return ticks;
}

function fmt(n, digits = 2) {
  return (n === null || n === undefined) ? '—' : Number(n).toFixed(digits);
}

function pageShell({ title, description, metaLines, bodyHtml, favicon, script = '', extraStyle = '' }) {
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
  .grid-line { stroke: var(--grid); stroke-width: 1; }
  .baseline { stroke: var(--axis); stroke-width: 1; }
  .legend { display: flex; flex-wrap: wrap; gap: 14px; margin: 10px 2px 4px; font-size: 12px; color: var(--ink-secondary); }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-swatch { width: 16px; height: 0; border-top: 2px solid; flex: none; }
  .legend-swatch.dashed { border-top-style: dashed; }
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

/**
 * One feature's reference-curve card: the standard normal density (this run's reference
 * distribution -- every GDX_HNF_FEATURE_VALUE.NORMALIZED_VALUE in a ZSCORE run is already
 * expressed in units of this run's own study-sample mean/std, so N(0,1) is the correct, shared
 * reference curve for every feature, not an approximation), a dashed rule at the reference mean
 * (z=0), and one solid rule per real, non-missing observation in this run.
 *
 * observations: [{ personId, rawValue, zValue }], already filtered to IS_MISSING=0 and
 * NORMALIZED_VALUE IS NOT NULL by the caller.
 * refParams: { mean, std, sampleSize } -- this run's frozen GDX_HNF_NORMALIZATION_PARAM row for
 * this feature, in raw units (shown for traceability; not used to redraw the curve itself, which
 * is always N(0,1) once values are already expressed as z).
 */
function renderZScaleCard({ featureCode, featureName, perspectiveName, unit, direction, observations, refParams, cardId, mode = 'light' }) {
  const curveColor = CURVE_COLOR[mode];
  const obsColor = OBS_COLOR[mode];
  const n = observations.length;

  const maxAbsZ = n > 0 ? Math.max(...observations.map((o) => Math.abs(o.zValue))) : 0;
  const domain = Math.max(4, Math.ceil(maxAbsZ + 0.5));

  const W = 900, H = 300, marginL = 56, marginR = 24, marginT = 14, marginB = 38;
  const plotW = W - marginL - marginR, plotH = H - marginT - marginB;
  const peak = normalPdf(0);
  // yMax must come FROM the tick set (not the other way around): niceTicks() can round its top
  // tick above whatever raw max is passed in, and a y-scale built from a smaller yMax would then
  // place that top tick's gridline/label above the plot area (off the top of the viewBox).
  const yTicks = niceTicks(0, peak * 1.08, 4);
  const yMax = yTicks[yTicks.length - 1];
  const xAt = (z) => marginL + ((z + domain) / (2 * domain)) * plotW;
  const yAt = (density) => marginT + plotH - (density / yMax) * plotH;

  const curvePoints = [];
  const STEPS = 240;
  for (let i = 0; i <= STEPS; i++) {
    const z = -domain + (2 * domain) * (i / STEPS);
    curvePoints.push(`${xAt(z).toFixed(2)},${yAt(normalPdf(z)).toFixed(2)}`);
  }

  const xTicks = [];
  for (let t = -domain; t <= domain; t += 1) xTicks.push(t);

  const gridSvg = yTicks.map((t) => `<line class="grid-line" x1="${marginL}" x2="${W - marginR}" y1="${yAt(t).toFixed(2)}" y2="${yAt(t).toFixed(2)}"/>
    <text class="axis-label" x="${marginL - 8}" y="${(yAt(t) + 4).toFixed(2)}" text-anchor="end">${t.toFixed(2)}</text>`).join('\n');
  const xTicksSvg = xTicks.map((t) => `<text class="axis-label" x="${xAt(t).toFixed(2)}" y="${H - marginB + 20}" text-anchor="middle">${t}</text>`).join('\n');

  // Overlapping rules read as density when there are many observations -- each rule's own
  // opacity backs off as n grows so the stack of lines does not just paint one solid orange wash.
  const obsOpacity = Math.max(0.14, Math.min(0.85, 7 / Math.max(n, 1)));

  const meanX = xAt(0).toFixed(2);
  const meanLineSvg = `<line class="ref-mean" x1="${meanX}" x2="${meanX}" y1="${marginT}" y2="${marginT + plotH}"
      stroke="var(--axis)" stroke-width="1.5" stroke-dasharray="5,4"/>`;

  const obsSvg = observations.map((o, i) => {
    const x = xAt(o.zValue).toFixed(2);
    const tip = `Person #${esc(o.personId)}<br>raw = ${fmt(o.rawValue, 3)}${unit ? ' ' + esc(unit) : ''}<br>z = ${fmt(o.zValue, 3)}`;
    return `<line class="obs-mark" data-tip="${tip}" x1="${x}" x2="${x}" y1="${marginT}" y2="${marginT + plotH}"
        stroke="${obsColor}" stroke-width="1.5" stroke-linecap="round" opacity="${obsOpacity.toFixed(2)}"/>
      <line class="obs-hit" data-tip="${tip}" x1="${x}" x2="${x}" y1="${marginT}" y2="${marginT + plotH}"
        stroke="${obsColor}" stroke-width="10" opacity="0"/>`;
  }).join('\n');

  const curveSvg = `<polyline points="${curvePoints.join(' ')}" fill="none" stroke="${curveColor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;

  const refLine = refParams
    ? `Reference mean = ${fmt(refParams.mean, 3)}${unit ? ' ' + esc(unit) : ''}, reference std = ${fmt(refParams.std, 3)}${unit ? ' ' + esc(unit) : ''} (this run's own study sample, n=${refParams.sampleSize}).`
    : 'This run has no frozen GDX_HNF_NORMALIZATION_PARAM row for this feature.';
  const directionLabel = direction && direction !== 'UNDEFINED' ? ` &middot; scale direction: ${esc(direction.replace('_', ' ').toLowerCase())}` : '';

  const legendSvg = `
    <div class="legend">
      <div class="legend-item"><span class="legend-swatch" style="border-color:${curveColor}"></span>Reference distribution (standard normal, z-scale)</div>
      <div class="legend-item"><span class="legend-swatch dashed" style="border-color:var(--axis)"></span>Mean = 0 (reference)</div>
      <div class="legend-item"><span class="legend-swatch" style="border-color:${obsColor}"></span>Observations (n=${n})</div>
    </div>`;

  const tableRows = observations.map((o) =>
    `<tr><td>Person #${esc(o.personId)}</td><td>${fmt(o.rawValue, 3)}${unit ? ' ' + esc(unit) : ''}</td><td>${fmt(o.zValue, 3)}</td></tr>`).join('');

  const bodyHtml = `
    <div class="chart-card">
      <p class="card-title">${esc(featureName)} <span style="color:var(--muted);font-weight:400">(${esc(featureCode)})</span></p>
      <p class="card-subtitle">${esc(perspectiveName)} perspective${directionLabel} &middot; ${refLine}</p>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Reference curve and observations in z-scale for ${esc(featureName)}">
        ${gridSvg}
        <line class="baseline" x1="${marginL}" x2="${W - marginR}" y1="${(marginT + plotH).toFixed(2)}" y2="${(marginT + plotH).toFixed(2)}"/>
        ${obsSvg}
        ${meanLineSvg}
        ${curveSvg}
        ${xTicksSvg}
        <text class="axis-label" x="${(marginL + plotW / 2).toFixed(2)}" y="${H - 4}" text-anchor="middle">Standardized value z</text>
        <text class="axis-label" x="16" y="${marginT + 10}" transform="rotate(-90 16 ${marginT + 10})" text-anchor="end">Density</text>
      </svg>
      ${legendSvg}
      <table class="data-table" id="${cardId}-table"><thead><tr><th>Person</th><th>Raw value</th><th>z (standardized)</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
    </div>`;

  return bodyHtml;
}

function emptyCard({ featureCode, featureName, perspectiveName, reason }) {
  return `
    <div class="chart-card">
      <p class="card-title">${esc(featureName)} <span style="color:var(--muted);font-weight:400">(${esc(featureCode)})</span></p>
      <p class="card-subtitle">${esc(perspectiveName)} perspective</p>
      <p class="empty-note">Not plotted: ${esc(reason)}</p>
    </div>`;
}

function hookTooltips(mode = 'light') {
  return `
    document.querySelectorAll('.obs-hit').forEach(function (el) {
      el.addEventListener('mouseenter', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mousemove', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mouseleave', hideTip);
    });`;
}

module.exports = { esc, normalPdf, niceTicks, pageShell, renderZScaleCard, emptyCard, hookTooltips, fmt, PALETTE };
