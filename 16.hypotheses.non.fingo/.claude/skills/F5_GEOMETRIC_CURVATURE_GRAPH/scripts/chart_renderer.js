/**
 * Self-contained SVG renderer for F5_GEOMETRIC_CURVATURE_GRAPH.
 *
 * Templates: this folder's own mathematical foundation for geometric curvature, section 9.1
 * ("Figura -- Tres profundidades graficas parametrizadas por CDI; relacao escolhida por design")
 * and section 9.3 ("Como produzir a curva utilizando os dados reais?"). Two cards:
 *
 *   renderThreeDepthsCard  (9.1) -- the same CDI(t) mapped to three different visual depths
 *     under three different graphic gains `a` -- the point being that `a` only changes the
 *     drawing, never which profile is actually farther from its own reference.
 *   renderDepthCurveCard   (9.3) -- the same CDI(t), per representative person, drawn as a
 *     Gaussian dip y(s) = -CDI(t)*exp(-s^2/(2*sigma^2)) -- the point being that only the curve's
 *     value at s=0 is determined by a real number; sigma only changes how wide the dip looks.
 *
 * Every mark on the shared CDI axis (either card) is a real, non-fabricated
 * GDX_HNF_CDI_VALUE/GDX_HNF_CDIH_VALUE row -- never an illustrative placeholder -- and the same
 * three real, named representative persons (this run's own lowest/median-closest/highest CDI)
 * are highlighted on both cards, for one coherent narrative.
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
  .legend-swatch.rug { width: 2px; height: 14px; border-top: none; }
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
 * The "three graphic depths" card: one straight reference line per gain `a` (profundidade_visual
 * = a * CDI, drawn across the real observed CDI range), a rug of every real CDI(t) value along
 * the x-axis, and the run's own three representative real persons (lowest/median-closest/highest
 * CDI) marked on every line with a tooltip giving their exact numbers under every gain.
 *
 * cdiValues: [number] -- every real, non-missing CDI(t)/CDIh(t) in the chosen source run.
 * gains: [number] -- the graphic gains to compare (e.g. [1, 2, 5]), a > 0, caller-validated.
 * representatives: [{ personId, cdiValue, roleLabel }] -- this run's own three representative
 *   persons (see pickRepresentativePersons in the compute script).
 */
function renderThreeDepthsCard({ sourceLabel, cdiLabel, cdiValues, gains, representatives, cardId, mode = 'light' }) {
  const colors = PALETTE.categorical[mode];
  const n = cdiValues.length;
  const maxCdi = Math.max(...cdiValues, ...representatives.map((r) => r.cdiValue));
  const maxGain = Math.max(...gains);

  // xMax/yMax must come FROM their own tick sets (not the other way around): niceTicks() can
  // round its top tick above whatever raw max is passed in, and a scale built from the smaller
  // raw max would then place that top tick's gridline/label outside the plot area (off the
  // right/top edge of the viewBox) -- same reasoning F1_GDX_SKILL_MFS_GRAPH's own renderer
  // already documents for its own y-axis.
  const xTicks = niceTicks(0, maxCdi * 1.08, 5);
  const xDomain = Math.max(1e-6, xTicks[xTicks.length - 1]);
  const yTicks = niceTicks(0, maxGain * xDomain, 5);
  const yMax = Math.max(1e-6, yTicks[yTicks.length - 1]);

  const W = 900, H = 340, marginL = 64, marginR = 24, marginT = 14, marginB = 56;
  const plotW = W - marginL - marginR, plotH = H - marginT - marginB;
  const xAt = (cdi) => marginL + (cdi / xDomain) * plotW;
  const yAt = (depth) => marginT + plotH - (depth / yMax) * plotH;

  const gridSvg = yTicks.map((t) => `<line class="grid-line" x1="${marginL}" x2="${W - marginR}" y1="${yAt(t).toFixed(2)}" y2="${yAt(t).toFixed(2)}"/>
    <text class="axis-label" x="${marginL - 8}" y="${(yAt(t) + 4).toFixed(2)}" text-anchor="end">${fmt(t, 2)}</text>`).join('\n');
  const xTicksSvg = xTicks.map((t) => `<text class="axis-label" x="${xAt(t).toFixed(2)}" y="${H - marginB + 36}" text-anchor="middle">${fmt(t, 2)}</text>`).join('\n');

  // Rug of every real CDI value, on the x-axis baseline -- opacity backs off as n grows so the
  // stack of ticks reads as density rather than one solid wash (same convention F1's own
  // reference-curve card already uses for many overlapping observations).
  const rugOpacity = Math.max(0.12, Math.min(0.75, 6 / Math.max(n, 1)));
  const rugY1 = marginT + plotH, rugY2 = marginT + plotH + 10;
  const rugSvg = cdiValues.map((v) => {
    const x = xAt(v).toFixed(2);
    return `<line x1="${x}" x2="${x}" y1="${rugY1}" y2="${rugY2}" stroke="var(--ink-secondary)" stroke-width="1" opacity="${rugOpacity.toFixed(2)}"/>`;
  }).join('\n');

  // yMax is derived from maxGain * xDomain (rounded UP to its own nice tick, never down), so
  // every line y = a*x (a <= maxGain) stays within [0, yMax] across the whole x range -- no
  // clipping needed.
  const linesSvg = gains.map((a, i) => {
    const color = colors[i % colors.length];
    return `<line x1="${xAt(0).toFixed(2)}" y1="${yAt(0).toFixed(2)}" x2="${xAt(xDomain).toFixed(2)}" y2="${yAt(a * xDomain).toFixed(2)}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`;
  }).join('\n');

  const repDotsSvg = representatives.map((rep) => gains.map((a, i) => {
    const color = colors[i % colors.length];
    const depth = a * rep.cdiValue;
    const x = xAt(rep.cdiValue).toFixed(2);
    const y = yAt(depth).toFixed(2);
    const tip = `Person #${esc(rep.personId)} (${esc(rep.roleLabel)})<br>${esc(cdiLabel)} = ${fmt(rep.cdiValue)}<br>a = ${fmt(a, 2)} &rarr; depth = ${fmt(depth)}`;
    return `<circle data-tip="${tip}" class="dep-mark" cx="${x}" cy="${y}" r="5.5" fill="${color}" stroke="var(--surface)" stroke-width="1.5"/>
      <circle data-tip="${tip}" class="dep-hit" cx="${x}" cy="${y}" r="13" fill="${color}" opacity="0"/>`;
  }).join('\n')).join('\n');

  const repLabelsSvg = representatives.map((rep) => {
    const x = xAt(rep.cdiValue).toFixed(2);
    return `<text class="axis-label" x="${x}" y="${(marginT + plotH + 24)}" text-anchor="middle">#${esc(rep.personId)}</text>`;
  }).join('\n');

  const legendSvg = `
    <div class="legend">
      ${gains.map((a, i) => `<div class="legend-item"><span class="legend-swatch" style="border-color:${colors[i % colors.length]}"></span>a = ${fmt(a, 2)} (profundidade_visual = a &times; ${esc(cdiLabel)})</div>`).join('')}
      <div class="legend-item"><span class="legend-swatch rug" style="border-color:var(--ink-secondary)"></span>Real ${esc(cdiLabel)} value observed (rug, n=${n})</div>
    </div>`;

  const tableRows = representatives.map((rep) =>
    `<tr><td>#${esc(rep.personId)}</td><td>${esc(rep.roleLabel)}</td><td>${fmt(rep.cdiValue)}</td>` +
    gains.map((a) => `<td>${fmt(a * rep.cdiValue)}</td>`).join('') + `</tr>`).join('');

  const bodyHtml = `
    <div class="chart-card">
      <p class="card-title">Three graphic depths parametrized by ${esc(cdiLabel)}</p>
      <p class="card-subtitle">${esc(sourceLabel)} &middot; ${n} real complete-case person(s). Same ${esc(cdiLabel)}, three design-chosen gains -- the lines never change which person is farther from the reference, only how deep the drawing looks.</p>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Three graphic depths parametrized by ${esc(cdiLabel)}">
        ${gridSvg}
        <line class="baseline" x1="${marginL}" x2="${W - marginR}" y1="${(marginT + plotH).toFixed(2)}" y2="${(marginT + plotH).toFixed(2)}"/>
        ${rugSvg}
        ${linesSvg}
        ${repDotsSvg}
        ${xTicksSvg}
        ${repLabelsSvg}
        <text class="axis-label" x="${(marginL + plotW / 2).toFixed(2)}" y="${H - 4}" text-anchor="middle">${esc(cdiLabel)}</text>
        <text class="axis-label" x="18" y="${marginT + 10}" transform="rotate(-90 18 ${marginT + 10})" text-anchor="end">Visual depth (a &times; ${esc(cdiLabel)})</text>
      </svg>
      ${legendSvg}
      <table class="data-table" id="${cardId}-table"><thead><tr><th>Person</th><th>Role</th><th>${esc(cdiLabel)}</th>${gains.map((a) => `<th>depth (a=${fmt(a, 2)})</th>`).join('')}</tr></thead>
        <tbody>${tableRows}</tbody></table>
    </div>`;

  return bodyHtml;
}

/**
 * The "Gaussian dip curve" card (section 9.3): one sampled curve per representative person,
 * y(s) = -CDI(t) * exp(-s^2/(2*sigma^2)), drawn across a fixed +/-3*sigma window -- `s` is the
 * curve's own drawing coordinate, never a real measured dimension of any person. Each curve's
 * only real-determined point, s=0 (y(0) = -CDI(t) exactly), is marked with a tooltip; the rest of
 * the curve is sampled live from that one real number and the run's own sigma, never persisted
 * (same posture GDX_HNF_DEPTHCURVE_VALUE itself takes -- see F5_GEOMETRIC_CURVATURE/SKILL.md).
 *
 * representatives: [{ personId, cdiValue, roleLabel }] -- same three real persons as
 * renderThreeDepthsCard, shared across both cards for one coherent narrative.
 * sigma: number > 0, caller-validated.
 */
function renderDepthCurveCard({ sourceLabel, cdiLabel, sigma, representatives, cardId, mode = 'light' }) {
  const colors = PALETTE.categorical[mode];
  const sMax = 3 * sigma;
  const maxCdi = Math.max(...representatives.map((r) => r.cdiValue));
  const yMin = Math.min(-1e-6, -maxCdi * 1.08);

  // Only the TOP of this plot (y=0, the undisturbed reference sheet) is fixed; niceTicks()'s own
  // floor() on a negative minimum always rounds further negative (never less negative than
  // yMin), so -- unlike the x-axis case in renderThreeDepthsCard -- no further reconciliation is
  // needed here: every tick this call returns is guaranteed to stay within [niceTicks' own min, 0].
  const yTicks = niceTicks(yMin, 0, 5);
  const yDomainMin = yTicks[0];

  const W = 900, H = 340, marginL = 64, marginR = 24, marginT = 14, marginB = 56;
  const plotW = W - marginL - marginR, plotH = H - marginT - marginB;
  const xAt = (s) => marginL + ((s + sMax) / (2 * sMax)) * plotW;
  const yAt = (y) => marginT + plotH - ((y - yDomainMin) / (0 - yDomainMin)) * plotH;

  const gridSvg = yTicks.map((t) => `<line class="grid-line" x1="${marginL}" x2="${W - marginR}" y1="${yAt(t).toFixed(2)}" y2="${yAt(t).toFixed(2)}"/>
    <text class="axis-label" x="${marginL - 8}" y="${(yAt(t) + 4).toFixed(2)}" text-anchor="end">${fmt(t, 2)}</text>`).join('\n');

  // x ticks at integer multiples of sigma -- fixed by construction (the domain IS +/-3*sigma),
  // so no tick-vs-domain reconciliation is needed on this axis either.
  const xTickValues = [-3, -2, -1, 0, 1, 2, 3];
  const xGridSvg = xTickValues.map((k) => {
    const x = xAt(k * sigma).toFixed(2);
    return `<line class="grid-line" x1="${x}" x2="${x}" y1="${marginT}" y2="${(marginT + plotH).toFixed(2)}"/>`;
  }).join('\n');
  const xTicksSvg = xTickValues.map((k) => {
    const label = k === 0 ? '0' : `${k > 0 ? '+' : ''}${k}&sigma;`;
    return `<text class="axis-label" x="${xAt(k * sigma).toFixed(2)}" y="${H - marginB + 20}" text-anchor="middle">${label}</text>`;
  }).join('\n');

  const STEPS = 160;
  const curvesSvg = representatives.map((rep, i) => {
    const color = colors[i % colors.length];
    const points = [];
    for (let j = 0; j <= STEPS; j++) {
      const s = -sMax + (2 * sMax) * (j / STEPS);
      const y = -rep.cdiValue * Math.exp(-(s * s) / (2 * sigma * sigma));
      points.push(`${xAt(s).toFixed(2)},${yAt(y).toFixed(2)}`);
    }
    const minX = xAt(0).toFixed(2);
    const minY = yAt(-rep.cdiValue).toFixed(2);
    const tip = `Person #${esc(rep.personId)} (${esc(rep.roleLabel)})<br>${esc(cdiLabel)} = ${fmt(rep.cdiValue)}<br>y(0) = -${esc(cdiLabel)} = ${fmt(-rep.cdiValue)}<br>sigma = ${fmt(sigma, 2)}`;
    return `<polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle data-tip="${tip}" class="dep-mark" cx="${minX}" cy="${minY}" r="5.5" fill="${color}" stroke="var(--surface)" stroke-width="1.5"/>
      <circle data-tip="${tip}" class="dep-hit" cx="${minX}" cy="${minY}" r="13" fill="${color}" opacity="0"/>`;
  }).join('\n');

  const legendSvg = `
    <div class="legend">
      ${representatives.map((rep, i) => `<div class="legend-item"><span class="legend-swatch" style="border-color:${colors[i % colors.length]}"></span>#${esc(rep.personId)} (${esc(rep.roleLabel)}, ${esc(cdiLabel)}=${fmt(rep.cdiValue)})</div>`).join('')}
      <div class="legend-item"><span class="legend-swatch" style="border-color:var(--axis)"></span>y = 0 (undisturbed sheet)</div>
    </div>`;

  const tableRows = representatives.map((rep) =>
    `<tr><td>#${esc(rep.personId)}</td><td>${esc(rep.roleLabel)}</td><td>${fmt(rep.cdiValue)}</td><td>${fmt(sigma, 2)}</td><td>${fmt(-rep.cdiValue)}</td></tr>`).join('');

  const bodyHtml = `
    <div class="chart-card">
      <p class="card-title">Gaussian dip curve, y(s) = -${esc(cdiLabel)} &times; exp(-s&sup2;/(2&sigma;&sup2;))</p>
      <p class="card-subtitle">${esc(sourceLabel)} &middot; sigma = ${fmt(sigma, 2)} (a width design choice, not a real quantity). Only each curve's point at s=0 is determined by a real number -- the rest is a sampled illustration.</p>
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gaussian dip curve parametrized by ${esc(cdiLabel)}">
        ${xGridSvg}
        ${gridSvg}
        ${curvesSvg}
        ${xTicksSvg}
        <text class="axis-label" x="${(marginL + plotW / 2).toFixed(2)}" y="${H - 4}" text-anchor="middle">s (drawing coordinate, in units of &sigma;)</text>
        <text class="axis-label" x="18" y="${marginT + 10}" transform="rotate(-90 18 ${marginT + 10})" text-anchor="end">y(s)</text>
      </svg>
      ${legendSvg}
      <table class="data-table" id="${cardId}-table"><thead><tr><th>Person</th><th>Role</th><th>${esc(cdiLabel)}</th><th>sigma</th><th>y(0) = -${esc(cdiLabel)}</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
    </div>`;

  return bodyHtml;
}

function hookTooltips() {
  return `
    document.querySelectorAll('.dep-hit').forEach(function (el) {
      el.addEventListener('mouseenter', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mousemove', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mouseleave', hideTip);
    });`;
}

module.exports = { esc, niceTicks, fmt, pageShell, renderThreeDepthsCard, renderDepthCurveCard, hookTooltips, PALETTE };
