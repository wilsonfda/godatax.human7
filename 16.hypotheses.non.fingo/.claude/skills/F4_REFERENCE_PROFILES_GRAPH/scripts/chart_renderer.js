/**
 * Self-contained SVG renderer for F4_REFERENCE_PROFILES_GRAPH.
 *
 * Template: this folder's own mathematical foundation for reference profiles, "8.1. Construcao
 * de baseline individual" ("Figura -- As quatro primeiras sessoes estabelecem uma referencia
 * constante, comparada com sessoes posteriores" / "Figure -- The first four sessions establish a
 * constant reference, compared with later sessions"). That figure shows one subject's earliest
 * `m` real sessions of z(t) averaged into a constant horizontal reference line, then later real
 * sessions plotted against it. This module draws the exact same two marks (a constant reference
 * line, real session points before/after it), but every point drawn by
 * generate_reference_profiles_graph.js is a real, non-fabricated GDX_HNF_FEATURE_VALUE row for one
 * real subject -- never a placeholder session -- and the baseline itself is this run's own real
 * mean/median of the first `m` such rows, computed live, never invented.
 *
 * Follows this repo's existing dataviz-skill-derived house style (see this folder's own
 * F1_GDX_SKILL_MFS_GRAPH/scripts/chart_renderer.js): same validated categorical palette and
 * chrome tokens, 2px lines, hairline solid gridlines, a legend, hover tooltips, a table-view
 * fallback, light+dark theme via CSS custom properties. Duplicated here (not require()'d from a
 * sibling skill) because each GRAPH skill in this folder is its own close-to-self-contained unit,
 * same convention every other GRAPH skill here already follows.
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
// Slot 1 (blue) = sessions that formed the baseline; slot 2 (orange) = later sessions compared
// against it -- same two-hue role split F1_GDX_SKILL_MFS_GRAPH already uses for "reference" vs.
// "observation".
const BASE_COLOR = { light: PALETTE.categorical.light[0], dark: PALETTE.categorical.dark[0] };
const LATER_COLOR = { light: PALETTE.categorical.light[1], dark: PALETTE.categorical.dark[1] };

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
  for (let t = niceMin; t <= niceMax + niceStep / 2; t += niceStep) ticks.push(Math.round(t * 1000) / 1000);
  return ticks;
}

function fmt(n, digits = 2) {
  return (n === null || n === undefined) ? '—' : Number(n).toFixed(digits);
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
  .grid-line { stroke: var(--grid); stroke-width: 1; }
  .baseline { stroke: var(--axis); stroke-width: 1; }
  .legend { display: flex; flex-wrap: wrap; gap: 14px; margin: 10px 2px 4px; font-size: 12px; color: var(--ink-secondary); }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-swatch { width: 16px; height: 0; border-top: 2px solid; flex: none; }
  .legend-swatch.dashed { border-top-style: dashed; }
  .legend-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
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
 * One feature's baseline-vs-later-sessions card: a constant dashed reference line (this
 * subject's own real mean/median of the first `m` real sessions' z-scores) spanning the full
 * session range, a thin trajectory line connecting every real session in order, and one marker
 * per real session -- colored by role (baseline-forming vs. later/compared).
 *
 * sessions: [{ sessionIndex (1-based), grainKey, obsInstant (Date|null), rawValue, zValue,
 *   isBaselineSession (bool) }], already ordered and filtered to IS_MISSING=0,
 *   NORMALIZED_VALUE IS NOT NULL by the caller. Length must be > baselineSessionCount (the
 *   caller only calls this when there is at least one real "later" session to compare).
 */
function renderBaselineSessionsCard({
  featureCode, featureName, perspectiveName, unit, sessions,
  baselineSessionCount, baselineEstimator, baselineValue, cardId, mode = 'light',
}) {
  const baseColor = BASE_COLOR[mode];
  const laterColor = LATER_COLOR[mode];
  const n = sessions.length;

  const allZ = sessions.map((s) => s.zValue).concat([baselineValue]);
  const maxAbsZ = Math.max(...allZ.map((z) => Math.abs(z)));
  const domain = Math.max(2, Math.ceil(maxAbsZ + 0.5));

  const W = 900, H = 300, marginL = 56, marginR = 24, marginT = 14, marginB = 46;
  const plotW = W - marginL - marginR, plotH = H - marginT - marginB;
  const xAt = (i) => (n <= 1) ? marginL + plotW / 2 : marginL + (i / (n - 1)) * plotW;
  const yTicks = niceTicks(-domain, domain, 5);
  const yAt = (z) => marginT + plotH - ((z + domain) / (2 * domain)) * plotH;

  const gridSvg = yTicks.map((t) => `<line class="grid-line" x1="${marginL}" x2="${W - marginR}" y1="${yAt(t).toFixed(2)}" y2="${yAt(t).toFixed(2)}"/>
    <text class="axis-label" x="${marginL - 8}" y="${(yAt(t) + 4).toFixed(2)}" text-anchor="end">${t.toFixed(2)}</text>`).join('\n');

  const xTicksSvg = sessions.map((s, i) => `<text class="axis-label" x="${xAt(i).toFixed(2)}" y="${H - marginB + 20}" text-anchor="middle">${s.sessionIndex}</text>`).join('\n');

  const baseY = yAt(baselineValue).toFixed(2);
  const baselineLineSvg = `<line class="ref-mean" x1="${marginL}" x2="${W - marginR}" y1="${baseY}" y2="${baseY}"
      stroke="var(--axis)" stroke-width="1.5" stroke-dasharray="5,4"/>`;

  const trajectoryPoints = sessions.map((s, i) => `${xAt(i).toFixed(2)},${yAt(s.zValue).toFixed(2)}`).join(' ');
  const trajectorySvg = `<polyline points="${trajectoryPoints}" fill="none" stroke="var(--ink-secondary)" stroke-width="1.5" stroke-linejoin="round" opacity="0.55"/>`;

  const pointsSvg = sessions.map((s, i) => {
    const x = xAt(i).toFixed(2);
    const y = yAt(s.zValue).toFixed(2);
    const color = s.isBaselineSession ? baseColor : laterColor;
    const whenLine = s.obsInstant ? `<br>when = ${esc(s.obsInstant)}` : '';
    const diffLine = s.isBaselineSession ? '' : `<br>&Delta; from baseline = ${s.zValue - baselineValue >= 0 ? '+' : ''}${fmt(s.zValue - baselineValue, 3)}`;
    const tip = `Session #${s.sessionIndex} (${esc(s.grainKey)})${whenLine}<br>raw = ${fmt(s.rawValue, 3)}${unit ? ' ' + esc(unit) : ''}<br>z = ${fmt(s.zValue, 3)}${diffLine}<br>role = ${s.isBaselineSession ? 'baseline-forming' : 'later (compared)'}`;
    return `<circle class="session-mark" data-tip="${tip}" cx="${x}" cy="${y}" r="5" fill="${color}" stroke="var(--surface)" stroke-width="1.5"/>
      <circle class="session-hit" data-tip="${tip}" cx="${x}" cy="${y}" r="12" fill="${color}" opacity="0"/>`;
  }).join('\n');

  const estimatorLabel = String(baselineEstimator || 'MEAN').toLowerCase();
  const legendSvg = `
    <div class="legend">
      <div class="legend-item"><span class="legend-swatch dashed" style="border-color:var(--axis)"></span>Baseline (${esc(estimatorLabel)} of first ${baselineSessionCount} session(s)) = ${fmt(baselineValue, 3)}</div>
      <div class="legend-item"><span class="legend-dot" style="background:${baseColor}"></span>Baseline-forming sessions (1&ndash;${baselineSessionCount})</div>
      <div class="legend-item"><span class="legend-dot" style="background:${laterColor}"></span>Later sessions (compared to baseline, n=${n - baselineSessionCount})</div>
    </div>`;

  const tableRows = sessions.map((s) =>
    `<tr><td>${s.sessionIndex}</td><td>${esc(s.grainKey)}</td><td>${s.obsInstant ? esc(s.obsInstant) : '—'}</td>` +
    `<td>${fmt(s.rawValue, 3)}${unit ? ' ' + esc(unit) : ''}</td><td>${fmt(s.zValue, 3)}</td>` +
    `<td>${s.isBaselineSession ? 'baseline-forming' : 'later'}</td>` +
    `<td>${s.isBaselineSession ? '—' : (s.zValue - baselineValue >= 0 ? '+' : '') + fmt(s.zValue - baselineValue, 3)}</td></tr>`).join('');

  const bodyHtml = `
    <div class="chart-card">
      <p class="card-title">${esc(featureName)} <span style="color:var(--muted);font-weight:400">(${esc(featureCode)})</span></p>
      <p class="card-subtitle">${esc(perspectiveName)} perspective &middot; ${n} real session(s), subject's own history, this run's z-scale.</p>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Baseline vs. later sessions in z-scale for ${esc(featureName)}">
        ${gridSvg}
        <line class="baseline" x1="${marginL}" x2="${W - marginR}" y1="${(marginT + plotH).toFixed(2)}" y2="${(marginT + plotH).toFixed(2)}"/>
        ${trajectorySvg}
        ${baselineLineSvg}
        ${pointsSvg}
        ${xTicksSvg}
        <text class="axis-label" x="${(marginL + plotW / 2).toFixed(2)}" y="${H - 6}" text-anchor="middle">Session #</text>
        <text class="axis-label" x="16" y="${marginT + 10}" transform="rotate(-90 16 ${marginT + 10})" text-anchor="end">Standardized value z</text>
      </svg>
      ${legendSvg}
      <table class="data-table" id="${cardId}-table"><thead><tr><th>Session #</th><th>Grain</th><th>When</th><th>Raw value</th><th>z</th><th>Role</th><th>&Delta; from baseline</th></tr></thead>
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

function hookTooltips() {
  return `
    document.querySelectorAll('.session-hit').forEach(function (el) {
      el.addEventListener('mouseenter', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mousemove', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mouseleave', hideTip);
    });`;
}

module.exports = { esc, niceTicks, fmt, pageShell, renderBaselineSessionsCard, emptyCard, hookTooltips, PALETTE };
