/**
 * Self-contained SVG renderer for F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION_GRAPH.
 *
 * Template: this folder's own mathematical foundation for temporal dynamics, section 10 ("F6 --
 * Dinamica temporal e evolucao de uma pessoa"), the figure right above its own 10.1 ("Figura --
 * Sequencia Antes-Durante-Depois-Seguimento com valores ficticios de CDI" / "Figure -- Before-
 * During-After-Follow-up sequence with fictitious CDI values"). That figure plots CDI across a
 * handful of named phases to show a trajectory can move non-monotonically. This module draws the
 * same shape -- a line connecting ordered points, each a real CDIx(t_s) -- but every point drawn
 * by generate_temporal_dynamics_graph.js against a real study is a real, non-fabricated
 * GDX_HNF_TRAJECTORY_POINT row labeled by its own real session grain, never a fictitious phase
 * name; "before/during/after/follow-up" is used only for --sample's own clearly-labeled synthetic
 * data, exactly where the document's own figure is itself fictitious.
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
const LINE_COLOR = { light: PALETTE.categorical.light[0], dark: PALETTE.categorical.dark[0] };
const UP_COLOR = { light: PALETTE.categorical.light[1], dark: PALETTE.categorical.dark[1] };
const DOWN_COLOR = { light: PALETTE.categorical.light[2], dark: PALETTE.categorical.dark[2] };

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

function fmt(n, digits = 3) {
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
 * The trajectory card: a line connecting every real, ordered session point (CDIx(t_s)), markers
 * per point with a tooltip (grain/label, real instant when present, CDIx), and each segment
 * between two consecutive points tinted by the sign of its own real DELTA_CDI (never implying
 * "better/worse" -- the legend states this explicitly) with a tooltip giving DELTA_CDI, the real
 * elapsed time and the resulting discrete velocity (or "n/a" when no real elapsed time exists).
 *
 * points: [{ sessionOrder, label, obsInstant (string|null), cdiValue }]
 * steps: [{ fromSessionOrder, toSessionOrder, deltaCdi, deltaTSeconds, velocity }]
 */
function renderTrajectoryCard({ subtitle, cdiLabel, points, steps, cardId, mode = 'light' }) {
  const lineColor = LINE_COLOR[mode];
  const upColor = UP_COLOR[mode];
  const downColor = DOWN_COLOR[mode];
  const n = points.length;

  const maxCdi = Math.max(...points.map((p) => p.cdiValue));
  const yTicks = niceTicks(0, maxCdi * 1.12, 5);
  const yMax = Math.max(1e-6, yTicks[yTicks.length - 1]);

  const W = 900, H = 320, marginL = 64, marginR = 24, marginT = 14, marginB = 52;
  const plotW = W - marginL - marginR, plotH = H - marginT - marginB;
  const xAt = (i) => (n <= 1) ? marginL + plotW / 2 : marginL + (i / (n - 1)) * plotW;
  const yAt = (v) => marginT + plotH - (v / yMax) * plotH;

  const gridSvg = yTicks.map((t) => `<line class="grid-line" x1="${marginL}" x2="${W - marginR}" y1="${yAt(t).toFixed(2)}" y2="${yAt(t).toFixed(2)}"/>
    <text class="axis-label" x="${marginL - 8}" y="${(yAt(t) + 4).toFixed(2)}" text-anchor="end">${fmt(t, 2)}</text>`).join('\n');

  const xTicksSvg = points.map((p, i) => `<text class="axis-label" x="${xAt(i).toFixed(2)}" y="${H - marginB + 20}" text-anchor="middle">${esc(p.label)}</text>`).join('\n');

  const stepByFrom = new Map(steps.map((s) => [s.fromSessionOrder, s]));
  const segmentsSvg = points.slice(0, -1).map((p, i) => {
    const next = points[i + 1];
    const step = stepByFrom.get(p.sessionOrder);
    const color = !step ? lineColor : (step.deltaCdi < 0 ? downColor : step.deltaCdi > 0 ? upColor : lineColor);
    const x1 = xAt(i).toFixed(2), y1 = yAt(p.cdiValue).toFixed(2);
    const x2 = xAt(i + 1).toFixed(2), y2 = yAt(next.cdiValue).toFixed(2);
    const velLabel = step && step.velocity !== null && step.velocity !== undefined ? `${fmt(step.velocity, 6)} /s` : 'n/a (no real elapsed time)';
    const dtLabel = step && step.deltaTSeconds !== null && step.deltaTSeconds !== undefined ? `${fmt(step.deltaTSeconds, 1)} s` : 'n/a';
    const tip = step
      ? `${esc(p.label)} &rarr; ${esc(next.label)}<br>&Delta;${esc(cdiLabel)} = ${step.deltaCdi >= 0 ? '+' : ''}${fmt(step.deltaCdi)}<br>&Delta;t = ${dtLabel}<br>v = ${velLabel}`
      : `${esc(p.label)} &rarr; ${esc(next.label)}`;
    return `<line data-tip="${tip}" class="seg-mark" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
      <line data-tip="${tip}" class="seg-hit" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="14" opacity="0"/>`;
  }).join('\n');

  const pointsSvg = points.map((p, i) => {
    const x = xAt(i).toFixed(2), y = yAt(p.cdiValue).toFixed(2);
    const whenLine = p.obsInstant ? `<br>when = ${esc(p.obsInstant)}` : '';
    const tip = `${esc(p.label)}${whenLine}<br>${esc(cdiLabel)} = ${fmt(p.cdiValue)}`;
    return `<circle data-tip="${tip}" class="dep-mark" cx="${x}" cy="${y}" r="5.5" fill="${lineColor}" stroke="var(--surface)" stroke-width="1.5"/>
      <circle data-tip="${tip}" class="dep-hit" cx="${x}" cy="${y}" r="13" fill="${lineColor}" opacity="0"/>`;
  }).join('\n');

  const legendSvg = `
    <div class="legend">
      <div class="legend-item"><span class="legend-dot" style="background:${lineColor}"></span>Real session point (${esc(cdiLabel)})</div>
      <div class="legend-item"><span class="legend-swatch" style="border-color:${upColor}"></span>&Delta;${esc(cdiLabel)} &gt; 0 (moved AWAY from the reference)</div>
      <div class="legend-item"><span class="legend-swatch" style="border-color:${downColor}"></span>&Delta;${esc(cdiLabel)} &lt; 0 (moved TOWARD the reference)</div>
    </div>
    <p class="empty-note" style="padding-top:2px">Neither color is "better" or "worse" -- see this run's own causal caveat below the table.</p>`;

  const tableRows = points.map((p, i) => {
    const step = i > 0 ? stepByFrom.get(points[i - 1].sessionOrder) : null;
    const deltaCell = step ? `${step.deltaCdi >= 0 ? '+' : ''}${fmt(step.deltaCdi)}` : '—';
    const velCell = step && step.velocity !== null && step.velocity !== undefined ? fmt(step.velocity, 6) : (i === 0 ? '—' : 'n/a');
    return `<tr><td>${esc(p.label)}</td><td>${p.obsInstant ? esc(p.obsInstant) : '—'}</td><td>${fmt(p.cdiValue)}</td><td>${deltaCell}</td><td>${velCell}</td></tr>`;
  }).join('');

  const bodyHtml = `
    <div class="chart-card">
      <p class="card-title">${esc(cdiLabel)}(t) across real sessions</p>
      <p class="card-subtitle">${esc(subtitle)}</p>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cdiLabel)} trajectory across real sessions">
        ${gridSvg}
        <line class="baseline" x1="${marginL}" x2="${W - marginR}" y1="${(marginT + plotH).toFixed(2)}" y2="${(marginT + plotH).toFixed(2)}"/>
        ${segmentsSvg}
        ${pointsSvg}
        ${xTicksSvg}
        <text class="axis-label" x="${(marginL + plotW / 2).toFixed(2)}" y="${H - 4}" text-anchor="middle">Session (real order)</text>
        <text class="axis-label" x="18" y="${marginT + 10}" transform="rotate(-90 18 ${marginT + 10})" text-anchor="end">${esc(cdiLabel)}(t)</text>
      </svg>
      ${legendSvg}
      <table class="data-table" id="${cardId}-table"><thead><tr><th>Session</th><th>When</th><th>${esc(cdiLabel)}</th><th>&Delta;${esc(cdiLabel)} (vs. prior)</th><th>v (/s)</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
    </div>`;

  return bodyHtml;
}

function hookTooltips() {
  return `
    document.querySelectorAll('.dep-hit, .seg-hit').forEach(function (el) {
      el.addEventListener('mouseenter', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mousemove', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mouseleave', hideTip);
    });`;
}

module.exports = { esc, niceTicks, fmt, pageShell, renderTrajectoryCard, hookTooltips, PALETTE };
