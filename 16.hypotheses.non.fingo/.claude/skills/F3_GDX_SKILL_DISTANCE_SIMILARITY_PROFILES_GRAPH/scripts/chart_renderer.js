/**
 * Self-contained SVG renderer for F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES_GRAPH.
 *
 * Two cards:
 *   1. Constant-Mahalanobis-distance ellipses over a real 2-dimension marginal of a real
 *      GDX_HNF_DISTANCE_COVARIANCE matrix, with the real complete-case scatter of the same two
 *      dimensions overlaid, so the drawn anisotropy is the study's own, never fabricated.
 *   2. A scatter between two real dimensions of the same run, annotated with their real Pearson
 *      correlation coefficient -- an association, never a causal claim.
 *
 * Equal-aspect-ratio plotting (same pixels-per-unit on both axes) is mandatory for card 1: an
 * independently-scaled x/y plot would stretch or compress the ellipse and could visually
 * fabricate anisotropy that is not really there, or hide real anisotropy that is. Card 2 uses the
 * same house style but does not need equal aspect (a correlation's sign/strength does not depend
 * on relative axis scaling).
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
// Slot 1 (blue) = real observations/scatter; slot 2 (orange) = derived geometry (ellipses) or
// the second series in the association card.
const POINT_COLOR = { light: PALETTE.categorical.light[0], dark: PALETTE.categorical.dark[0] };
const ELLIPSE_COLOR = { light: PALETTE.categorical.light[1], dark: PALETTE.categorical.dark[1] };

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmt(n, digits = 3) {
  return (n === null || n === undefined || !Number.isFinite(n)) ? '—' : Number(n).toFixed(digits);
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

/** Eigen-decomposition of a symmetric 2x2 matrix [[a,b],[b,d]]. eig1 >= eig2. angleRad is the
 * rotation of the eigenvector for eig1 (the ellipse's major axis when eig1 > eig2), via the
 * standard closed form theta = 0.5*atan2(2b, a-d). */
function eig2x2(a, b, d) {
  const trace = a + d;
  const disc = Math.sqrt(Math.max(((a - d) / 2) ** 2 + b * b, 0));
  const eig1 = trace / 2 + disc;
  const eig2 = trace / 2 - disc;
  const angleRad = 0.5 * Math.atan2(2 * b, a - d);
  return { eig1: Math.max(eig1, 0), eig2: Math.max(eig2, 0), angleRad };
}

/** Parametric contour of constant Mahalanobis distance = radius for a 2-D marginal covariance,
 * i.e. { x : (x-mu)^T Sigma2x2^-1 (x-mu) = radius^2 }. Semi-axis lengths are radius*sqrt(eig_i)
 * along the eigenvectors of Sigma2x2 -- the standard result for a quadratic-form level set. */
function ellipseContourPoints(muX, muY, eig1, eig2, angleRad, radius, steps = 90) {
  const semiA = radius * Math.sqrt(eig1);
  const semiB = radius * Math.sqrt(eig2);
  const cosT = Math.cos(angleRad), sinT = Math.sin(angleRad);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const localX = semiA * Math.cos(t);
    const localY = semiB * Math.sin(t);
    pts.push([muX + localX * cosT - localY * sinT, muY + localX * sinT + localY * cosT]);
  }
  return pts;
}

/** Pearson product-moment correlation coefficient of two equal-length real arrays. */
function pearsonR(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return 0;
  return sxy / Math.sqrt(sxx * syy);
}

/** Equal-aspect-ratio scales: ONE pixels-per-unit factor shared by x and y, centered within the
 * plot area. Required so a drawn ellipse's shape faithfully reflects the real covariance's own
 * anisotropy instead of whatever each axis's independent domain happens to be. */
function buildEqualAspectScales(xValues, yValues, plotW, plotH, paddingFrac = 0.14) {
  let xMin = Math.min(...xValues), xMax = Math.max(...xValues);
  let yMin = Math.min(...yValues), yMax = Math.max(...yValues);
  if (xMin === xMax) { xMin -= 1; xMax += 1; }
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const padX = (xMax - xMin) * paddingFrac, padY = (yMax - yMin) * paddingFrac;
  xMin -= padX; xMax += padX; yMin -= padY; yMax += padY;
  const spanX = xMax - xMin, spanY = yMax - yMin;
  const scale = Math.min(plotW / spanX, plotH / spanY);
  const usedW = spanX * scale, usedH = spanY * scale;
  const offsetX = (plotW - usedW) / 2, offsetY = (plotH - usedH) / 2;
  return {
    xMin, xMax, yMin, yMax, scale,
    xAt: (marginL, v) => marginL + offsetX + (v - xMin) * scale,
    yAt: (marginT, v) => marginT + offsetY + (yMax - v) * scale,
  };
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
  .card-note { font-size: 11.5px; color: var(--muted); margin: 8px 2px 0; line-height: 1.5; font-style: italic; }
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
 * Card 1: constant-Mahalanobis-distance ellipses over a real 2-dimension marginal, with the real
 * complete-case scatter of the same two dimensions overlaid.
 *
 * cov2x2: { a, b, d } -- the real, already-stored GDX_HNF_DISTANCE_COVARIANCE entries for
 * (dimA,dimA), (dimA,dimB), (dimB,dimB), i.e. Sigma restricted to these two dimensions.
 * mean: { x, y } -- real sample mean of the two dimensions over the run's own complete-case
 * persons (the same persons the run's stored Sigma was estimated from).
 * points: [{ personId, x, y }] -- the same complete-case persons' real coordinates.
 * radii: number[] -- which constant-distance contours to draw (e.g. [1,2,3]).
 */
function renderMahalanobisEllipseCard({ runLabel, personCount, dimA, dimB, cov2x2, mean, points, radii, cardId, regularizationNote }) {
  const pointColor = POINT_COLOR.light;
  const ellipseColors = [ELLIPSE_COLOR.light, '#9c6b1f', '#6b4a14'];

  const { eig1, eig2, angleRad } = eig2x2(cov2x2.a, cov2x2.b, cov2x2.d);
  const maxRadius = Math.max(...radii, 1);
  const outline = ellipseContourPoints(mean.x, mean.y, eig1, eig2, angleRad, maxRadius, 120);

  const W = 760, H = 640, marginL = 64, marginR = 24, marginT = 16, marginB = 46;
  const plotW = W - marginL - marginR, plotH = H - marginT - marginB;

  const allX = points.map((p) => p.x).concat(outline.map((p) => p[0]));
  const allY = points.map((p) => p.y).concat(outline.map((p) => p[1]));
  const sc = buildEqualAspectScales(allX, allY, plotW, plotH);
  const xAt = (v) => sc.xAt(marginL, v);
  const yAt = (v) => sc.yAt(marginT, v);

  const xTicks = niceTicks(sc.xMin, sc.xMax, 5).filter((t) => t >= sc.xMin && t <= sc.xMax);
  const yTicks = niceTicks(sc.yMin, sc.yMax, 5).filter((t) => t >= sc.yMin && t <= sc.yMax);
  const xGridSvg = xTicks.map((t) => `<line class="grid-line" x1="${xAt(t).toFixed(2)}" x2="${xAt(t).toFixed(2)}" y1="${marginT}" y2="${(marginT + plotH).toFixed(2)}"/>
    <text class="axis-label" x="${xAt(t).toFixed(2)}" y="${marginT + plotH + 18}" text-anchor="middle">${t}</text>`).join('\n');
  const yGridSvg = yTicks.map((t) => `<line class="grid-line" x1="${marginL}" x2="${(marginL + plotW).toFixed(2)}" y1="${yAt(t).toFixed(2)}" y2="${yAt(t).toFixed(2)}"/>
    <text class="axis-label" x="${marginL - 8}" y="${(yAt(t) + 4).toFixed(2)}" text-anchor="end">${t}</text>`).join('\n');

  const meanCrossSvg = `
    <line x1="${(xAt(mean.x) - 7).toFixed(2)}" x2="${(xAt(mean.x) + 7).toFixed(2)}" y1="${yAt(mean.y).toFixed(2)}" y2="${yAt(mean.y).toFixed(2)}" stroke="var(--axis)" stroke-width="1.5"/>
    <line x1="${xAt(mean.x).toFixed(2)}" x2="${xAt(mean.x).toFixed(2)}" y1="${(yAt(mean.y) - 7).toFixed(2)}" y2="${(yAt(mean.y) + 7).toFixed(2)}" stroke="var(--axis)" stroke-width="1.5"/>`;

  const ellipsesSvg = radii.map((r, i) => {
    const pts = ellipseContourPoints(mean.x, mean.y, eig1, eig2, angleRad, r, 120);
    const path = pts.map((p) => `${xAt(p[0]).toFixed(2)},${yAt(p[1]).toFixed(2)}`).join(' ');
    const color = ellipseColors[i % ellipseColors.length];
    return `<polyline class="ellipse-r" data-tip="Constant Mahalanobis distance (2-D marginal) r=${r}" points="${path}" fill="none" stroke="${color}" stroke-width="2"/>`;
  }).join('\n');

  const pointsSvg = points.map((p) => {
    const tip = `Person #${esc(p.personId)}<br>${esc(dimA.label)} = ${fmt(p.x)}<br>${esc(dimB.label)} = ${fmt(p.y)}`;
    return `<circle class="ellipse-pt" data-tip="${tip}" cx="${xAt(p.x).toFixed(2)}" cy="${yAt(p.y).toFixed(2)}" r="4" fill="${pointColor}" fill-opacity="0.5" stroke="var(--surface)" stroke-width="1"></circle>`;
  }).join('\n');

  const legendSvg = `
    <div class="legend">
      <div class="legend-item"><span class="legend-dot" style="background:${pointColor}"></span>Complete-case persons (n=${personCount})</div>
      ${radii.map((r, i) => `<div class="legend-item"><span class="legend-line" style="border-color:${ellipseColors[i % ellipseColors.length]}"></span>Constant distance r=${r}</div>`).join('')}
      <div class="legend-item"><span class="legend-dot" style="background:var(--axis)"></span>Sample mean</div>
    </div>`;

  const pointRows = points.map((p) => `<tr><td>Person #${esc(p.personId)}</td><td>${fmt(p.x)}</td><td>${fmt(p.y)}</td></tr>`).join('');

  const bodyHtml = `
    <div class="chart-card">
      <p class="card-title">Constant-Mahalanobis-distance curves (2-D marginal)</p>
      <p class="card-subtitle">Run: ${esc(runLabel)} &middot; dimensions: ${esc(dimA.label)} (order ${dimA.order}) vs ${esc(dimB.label)} (order ${dimB.order}) &middot; ${personCount} complete-case person(s) plotted</p>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Constant Mahalanobis distance ellipses for ${esc(dimA.label)} vs ${esc(dimB.label)}">
        ${xGridSvg}
        ${yGridSvg}
        ${pointsSvg}
        ${ellipsesSvg}
        ${meanCrossSvg}
        <text class="axis-label" x="${(marginL + plotW / 2).toFixed(2)}" y="${H - 4}" text-anchor="middle">${esc(dimA.label)}</text>
        <text class="axis-label" x="16" y="${marginT + 10}" transform="rotate(-90 16 ${marginT + 10})" text-anchor="end">${esc(dimB.label)}</text>
      </svg>
      ${legendSvg}
      <p class="card-note">Equal pixel scale on both axes (required: an independently-scaled plot would distort this shape). Sigma for this 2-D marginal is read directly from this run's own stored GDX_HNF_DISTANCE_COVARIANCE entries, not recomputed. Ellipse eccentricity reflects the real correlation/variance ratio between these two dimensions only -- it is not the run's own full-dimension Mahalanobis metric, which this run's GDX_HNF_DISTANCE_VALUE rows already carry in full. A point lying outside the r=1 curve is not, by itself, an outlier or anomaly claim.${regularizationNote ? ' ' + esc(regularizationNote) : ''}</p>
      <table class="data-table" id="${cardId}-points"><caption>Plotted person coordinates</caption>
        <thead><tr><th>Person</th><th>${esc(dimA.label)}</th><th>${esc(dimB.label)}</th></tr></thead>
        <tbody>${pointRows}</tbody></table>
    </div>`;

  return bodyHtml;
}

/**
 * Card 2: scatter between two real dimensions of the same run, annotated with their real Pearson
 * correlation coefficient.
 */
function renderAssociationScatterCard({ runLabel, personCount, dimA, dimB, points, r, crossPerspective, cardId }) {
  const pointColor = POINT_COLOR.light;

  const W = 760, H = 640, marginL = 64, marginR = 24, marginT = 16, marginB = 46;
  const plotW = W - marginL - marginR, plotH = H - marginT - marginB;

  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  let xMin = Math.min(...xs), xMax = Math.max(...xs), yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xTicks = niceTicks(xMin, xMax, 5);
  const yTicks = niceTicks(yMin, yMax, 5);
  xMin = xTicks[0]; xMax = xTicks[xTicks.length - 1];
  yMin = yTicks[0]; yMax = yTicks[yTicks.length - 1];
  const xAt = (v) => marginL + ((v - xMin) / (xMax - xMin)) * plotW;
  const yAt = (v) => marginT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const xGridSvg = xTicks.map((t) => `<line class="grid-line" x1="${xAt(t).toFixed(2)}" x2="${xAt(t).toFixed(2)}" y1="${marginT}" y2="${(marginT + plotH).toFixed(2)}"/>
    <text class="axis-label" x="${xAt(t).toFixed(2)}" y="${marginT + plotH + 18}" text-anchor="middle">${t}</text>`).join('\n');
  const yGridSvg = yTicks.map((t) => `<line class="grid-line" x1="${marginL}" x2="${(marginL + plotW).toFixed(2)}" y1="${yAt(t).toFixed(2)}" y2="${yAt(t).toFixed(2)}"/>
    <text class="axis-label" x="${marginL - 8}" y="${(yAt(t) + 4).toFixed(2)}" text-anchor="end">${t}</text>`).join('\n');

  const pointsSvg = points.map((p) => {
    const tip = `Person #${esc(p.personId)}<br>${esc(dimA.label)} = ${fmt(p.x)}<br>${esc(dimB.label)} = ${fmt(p.y)}`;
    return `<circle class="assoc-pt" data-tip="${tip}" cx="${xAt(p.x).toFixed(2)}" cy="${yAt(p.y).toFixed(2)}" r="4" fill="${pointColor}" fill-opacity="0.5" stroke="var(--surface)" stroke-width="1"></circle>`;
  }).join('\n');

  const pointRows = points.map((p) => `<tr><td>Person #${esc(p.personId)}</td><td>${fmt(p.x)}</td><td>${fmt(p.y)}</td></tr>`).join('');

  const perspectiveNote = crossPerspective === null
    ? ''
    : crossPerspective
      ? 'These two dimensions belong to different perspectives.'
      : 'These two dimensions belong to the same perspective -- no cross-perspective pair with real data exists in this run yet, so this is the strongest real same-perspective association instead.';

  const bodyHtml = `
    <div class="chart-card">
      <p class="card-title">Association between two dimensions (r = ${fmt(r, 3)})</p>
      <p class="card-subtitle">Run: ${esc(runLabel)} &middot; ${esc(dimA.label)} (order ${dimA.order}) vs ${esc(dimB.label)} (order ${dimB.order}) &middot; ${personCount} complete-case person(s) plotted</p>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Scatter of ${esc(dimA.label)} vs ${esc(dimB.label)}, Pearson r = ${fmt(r, 3)}">
        ${xGridSvg}
        ${yGridSvg}
        ${pointsSvg}
        <text class="axis-label" x="${(marginL + plotW / 2).toFixed(2)}" y="${H - 4}" text-anchor="middle">${esc(dimA.label)}</text>
        <text class="axis-label" x="16" y="${marginT + 10}" transform="rotate(-90 16 ${marginT + 10})" text-anchor="end">${esc(dimB.label)}</text>
      </svg>
      <p class="card-note">Pearson r is a real, computed descriptive statistic from this run's own complete-case sample -- a statistical association, never evidence of a causal mechanism, a shared condition, or a validated metaphysical correspondence. ${esc(perspectiveNote)}</p>
      <table class="data-table" id="${cardId}-points"><caption>Plotted person coordinates</caption>
        <thead><tr><th>Person</th><th>${esc(dimA.label)}</th><th>${esc(dimB.label)}</th></tr></thead>
        <tbody>${pointRows}</tbody></table>
    </div>`;

  return bodyHtml;
}

function renderNotAvailableCard({ title, reason }) {
  return `
    <div class="chart-card">
      <p class="card-title">${esc(title)}</p>
      <p class="empty-note">Not available: ${esc(reason)}</p>
    </div>`;
}

function hookTooltips() {
  return `
    document.querySelectorAll('.ellipse-pt, .ellipse-r, .assoc-pt').forEach(function (el) {
      el.addEventListener('mouseenter', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mousemove', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mouseleave', hideTip);
    });`;
}

module.exports = {
  esc, fmt, niceTicks, eig2x2, ellipseContourPoints, pearsonR, buildEqualAspectScales,
  pageShell, renderMahalanobisEllipseCard, renderAssociationScatterCard, renderNotAvailableCard,
  hookTooltips, PALETTE,
};
