/**
 * Self-contained SVG renderer for F2_GDX_SKILL_LATENT_REP_GRAPH.
 *
 * One card per latent-representation method (PCA, autoencoder, UMAP): a 2D scatter of each
 * person's own first two latent coordinates (GDX_HNF_LATENT_VALUE, dimension order 1 vs 2), with
 * a dashed crosshair through the origin. For PCA only -- the one method with a real, fixed
 * per-feature linear coefficient -- the plot is overlaid with loading-direction arrows from
 * GDX_HNF_LATENT_LOADING (a standard PCA biplot), limited to the features with the largest
 * combined magnitude on these two dimensions so the plot stays legible; every loading still
 * appears in the per-card table-view fallback, never just dropped. Autoencoder/UMAP cards are a
 * plain scatter -- GDX_HNF_LATENT_LOADING is never populated for either method (no fixed
 * per-feature coefficient exists to draw), so no arrow is drawn or implied for them.
 *
 * Follows this repo's existing dataviz-skill-derived house style (same validated categorical
 * palette and chrome tokens as the sibling chart skills in this folder). Duplicated here (not
 * require()'d from another folder) per this repo's "each numbered folder is close to
 * self-contained" convention.
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
// Slot 1 (blue) = person scores; slot 2 (orange) = PCA loading-direction arrows.
const SCORE_COLOR = { light: PALETTE.categorical.light[0], dark: PALETTE.categorical.dark[0] };
const ARROW_COLOR = { light: PALETTE.categorical.light[1], dark: PALETTE.categorical.dark[1] };

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmt(n, digits = 3) {
  return (n === null || n === undefined) ? '—' : Number(n).toFixed(digits);
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
/** Nice tick domain that always includes 0 (scores are mean-centered, so the origin is always a
 * meaningful reference point worth keeping on-plot, even if every real value happens to sit on
 * one side of it). */
function niceDomainThroughZero(values) {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const ticks = niceTicks(lo, hi, 5);
  return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
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
  .legend { display: flex; flex-wrap: wrap; gap: 14px; margin: 10px 2px 4px; font-size: 12px; color: var(--ink-secondary); }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .legend-line { width: 16px; height: 0; border-top: 2px solid; flex: none; }
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
  table.data-table caption { text-align: left; font-size: 11.5px; color: var(--muted); padding: 10px 2px 2px; caption-side: top; }
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
 * One method's 2D latent-projection card.
 *
 * dim1/dim2: { label, explainedVarianceRatio: number|null } -- the axis titles; EVR is shown only
 * when non-null (PCA).
 * points: [{ personId, x, y }] -- one per person, dimension-order-1 vs dimension-order-2 coordinate.
 * loadings: null, or [{ featureCode, featureName, x, y, rawX, rawY }] -- x/y already pre-scaled by
 * the caller into plot units for the arrow endpoint; rawX/rawY are the true LOADING_VALUE entries,
 * shown in the tooltip/table so the visual scaling is never mistaken for the real coefficient.
 */
function renderLatentScatterCard({ method, runLabel, personCount, dim1, dim2, points, loadings, cardId, mode = 'light' }) {
  const scoreColor = SCORE_COLOR[mode];
  const arrowColor = ARROW_COLOR[mode];

  const W = 760, H = 640, marginL = 64, marginR = 24, marginT = 16, marginB = 46;
  const plotW = W - marginL - marginR, plotH = H - marginT - marginB;

  const allX = points.map((p) => p.x).concat(loadings ? loadings.map((l) => l.x) : []);
  const allY = points.map((p) => p.y).concat(loadings ? loadings.map((l) => l.y) : []);
  const xDomain = niceDomainThroughZero(allX.length ? allX : [0]);
  const yDomain = niceDomainThroughZero(allY.length ? allY : [0]);
  const xAt = (v) => marginL + ((v - xDomain.min) / (xDomain.max - xDomain.min)) * plotW;
  const yAt = (v) => marginT + plotH - ((v - yDomain.min) / (yDomain.max - yDomain.min)) * plotH;

  const xGridSvg = xDomain.ticks.map((t) => `<line class="grid-line" x1="${xAt(t).toFixed(2)}" x2="${xAt(t).toFixed(2)}" y1="${marginT}" y2="${(marginT + plotH).toFixed(2)}"/>
    <text class="axis-label" x="${xAt(t).toFixed(2)}" y="${marginT + plotH + 18}" text-anchor="middle">${t}</text>`).join('\n');
  const yGridSvg = yDomain.ticks.map((t) => `<line class="grid-line" x1="${marginL}" x2="${(marginL + plotW).toFixed(2)}" y1="${yAt(t).toFixed(2)}" y2="${yAt(t).toFixed(2)}"/>
    <text class="axis-label" x="${marginL - 8}" y="${(yAt(t) + 4).toFixed(2)}" text-anchor="end">${t}</text>`).join('\n');

  const crosshairSvg = `
    <line x1="${xAt(0).toFixed(2)}" x2="${xAt(0).toFixed(2)}" y1="${marginT}" y2="${(marginT + plotH).toFixed(2)}" stroke="var(--axis)" stroke-width="1.5" stroke-dasharray="4,4"/>
    <line x1="${marginL}" x2="${(marginL + plotW).toFixed(2)}" y1="${yAt(0).toFixed(2)}" y2="${yAt(0).toFixed(2)}" stroke="var(--axis)" stroke-width="1.5" stroke-dasharray="4,4"/>`;

  const pointsSvg = points.map((p) => {
    const tip = `Person #${esc(p.personId)}<br>${esc(dim1.label)} = ${fmt(p.x)}<br>${esc(dim2.label)} = ${fmt(p.y)}`;
    return `<circle class="score-pt" data-tip="${tip}" cx="${xAt(p.x).toFixed(2)}" cy="${yAt(p.y).toFixed(2)}" r="4" fill="${scoreColor}" fill-opacity="0.55" stroke="var(--surface)" stroke-width="1"></circle>`;
  }).join('\n');

  let arrowsSvg = '';
  let markerDef = '';
  if (loadings && loadings.length) {
    markerDef = `<defs><marker id="arrow-${cardId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${arrowColor}"></path></marker></defs>`;
    arrowsSvg = loadings.map((l) => {
      const x2 = xAt(l.x), y2 = yAt(l.y);
      const labelDx = x2 >= xAt(0) ? 4 : -4;
      const tip = `${esc(l.featureName)} (${esc(l.featureCode)})<br>loading on ${esc(dim1.label)} = ${fmt(l.rawX, 4)}<br>loading on ${esc(dim2.label)} = ${fmt(l.rawY, 4)}<br><em>arrow length is rescaled for visibility, not the raw loading units</em>`;
      return `
        <line class="loading-arrow" data-tip="${tip}" x1="${xAt(0).toFixed(2)}" y1="${yAt(0).toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"
          stroke="${arrowColor}" stroke-width="2" marker-end="url(#arrow-${cardId})"></line>
        <text class="axis-label" x="${x2.toFixed(2)}" y="${y2.toFixed(2)}" dx="${labelDx}" dy="-4"
          text-anchor="${x2 >= xAt(0) ? 'start' : 'end'}" font-size="10" fill="var(--ink-secondary)">${esc(l.featureCode)}</text>`;
    }).join('\n');
  }

  const dim1Label = dim1.explainedVarianceRatio !== null && dim1.explainedVarianceRatio !== undefined
    ? `${dim1.label} (${(dim1.explainedVarianceRatio * 100).toFixed(1)}% explained variance)` : dim1.label;
  const dim2Label = dim2.explainedVarianceRatio !== null && dim2.explainedVarianceRatio !== undefined
    ? `${dim2.label} (${(dim2.explainedVarianceRatio * 100).toFixed(1)}% explained variance)` : dim2.label;

  const legendSvg = loadings ? `
    <div class="legend">
      <div class="legend-item"><span class="legend-dot" style="background:${scoreColor}"></span>Person score (n=${personCount})</div>
      <div class="legend-item"><span class="legend-line" style="border-color:${arrowColor}"></span>Feature loading direction (top ${loadings.length} by magnitude on these 2 dimensions)</div>
    </div>` : '';

  const pointRows = points.map((p) => `<tr><td>Person #${esc(p.personId)}</td><td>${fmt(p.x)}</td><td>${fmt(p.y)}</td></tr>`).join('');
  const loadingRows = loadings ? loadings.map((l) => `<tr><td>${esc(l.featureCode)}</td><td>${esc(l.featureName)}</td><td>${fmt(l.rawX, 4)}</td><td>${fmt(l.rawY, 4)}</td></tr>`).join('') : '';

  const bodyHtml = `
    <div class="chart-card">
      <p class="card-title">${esc(method)}</p>
      <p class="card-subtitle">Run: ${esc(runLabel)} &middot; ${personCount} person(s) plotted</p>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(method)} latent projection, ${esc(dim1.label)} vs ${esc(dim2.label)}">
        ${markerDef}
        ${xGridSvg}
        ${yGridSvg}
        ${crosshairSvg}
        ${pointsSvg}
        ${arrowsSvg}
        <text class="axis-label" x="${(marginL + plotW / 2).toFixed(2)}" y="${H - 4}" text-anchor="middle">${esc(dim1Label)}</text>
        <text class="axis-label" x="16" y="${marginT + 10}" transform="rotate(-90 16 ${marginT + 10})" text-anchor="end">${esc(dim2Label)}</text>
      </svg>
      ${legendSvg}
      <table class="data-table" id="${cardId}-points"><caption>Plotted person scores</caption>
        <thead><tr><th>Person</th><th>${esc(dim1.label)}</th><th>${esc(dim2.label)}</th></tr></thead>
        <tbody>${pointRows}</tbody></table>
      ${loadings ? `<table class="data-table" id="${cardId}-loadings"><caption>Feature loadings plotted as arrows (raw units, not the rescaled arrow length)</caption>
        <thead><tr><th>Feature code</th><th>Name</th><th>Loading on ${esc(dim1.label)}</th><th>Loading on ${esc(dim2.label)}</th></tr></thead>
        <tbody>${loadingRows}</tbody></table>` : ''}
    </div>`;

  return bodyHtml;
}

function renderNotAvailableCard({ method, reason }) {
  return `
    <div class="chart-card">
      <p class="card-title">${esc(method)}</p>
      <p class="empty-note">Not available: ${esc(reason)}</p>
    </div>`;
}

function hookTooltips() {
  return `
    document.querySelectorAll('.score-pt, .loading-arrow').forEach(function (el) {
      el.addEventListener('mouseenter', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mousemove', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mouseleave', hideTip);
    });`;
}

module.exports = { esc, fmt, niceTicks, niceDomainThroughZero, pageShell, renderLatentScatterCard, renderNotAvailableCard, hookTooltips, PALETTE };
