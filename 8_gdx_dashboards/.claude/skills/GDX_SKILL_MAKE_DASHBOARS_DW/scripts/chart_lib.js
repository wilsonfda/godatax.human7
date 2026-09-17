/**
 * Minimal self-contained SVG chart renderers, following the dataviz skill's
 * method: fixed categorical hue order, one hue sequential ramp, thin marks,
 * a legend for >=2 series, direct labels, hover tooltips, light+dark theme
 * via CSS custom properties, a table-view fallback. No external libraries
 * (no CDN, no canvas/native deps) -- every chart is a standalone .html file
 * that opens in any browser, online or offline.
 *
 * Palette: GDX_HUMAN/8_gdx_dashboards default (dataviz skill reference
 * palette, references/palette.md) -- swap the hex values below to retheme.
 */

const PALETTE = {
  categorical: {
    light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
    dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  },
  sequential: {
    light: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'],
    dark: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'],
  },
  chrome: {
    light: { surface: '#fcfcfb', page: '#f9f9f7', ink: '#0b0b0b', inkSecondary: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7' },
    dark: { surface: '#1a1a19', page: '#0d0d0d', ink: '#ffffff', inkSecondary: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', axis: '#383835' },
  },
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pageShell({ title, description, favicon, bodyHtml, extraStyle = '', script = '' }) {
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
    width: 100%; max-width: 980px;
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
  .subtitle { font-size: 13px; color: var(--ink-secondary); margin: 0 0 20px; max-width: 720px; line-height: 1.5; }
  .chart-card {
    background: var(--surface); border-radius: 12px; padding: 20px 20px 12px;
    border: 1px solid var(--grid); overflow-x: auto;
  }
  svg { display: block; max-width: 100%; height: auto; font-family: inherit; }
  .axis-label { fill: var(--muted); font-size: 11px; }
  .grid-line { stroke: var(--grid); stroke-width: 1; }
  .baseline { stroke: var(--axis); stroke-width: 1; }
  .legend { display: flex; flex-wrap: wrap; gap: 14px; margin: 12px 2px 8px; font-size: 12px; color: var(--ink-secondary); }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-swatch { width: 10px; height: 10px; border-radius: 2px; flex: none; }
  .tooltip {
    position: fixed; pointer-events: none; background: var(--ink); color: var(--surface);
    font-size: 12px; padding: 6px 9px; border-radius: 6px; line-height: 1.45;
    opacity: 0; transform: translate(-50%, -100%); transition: opacity 0.08s;
    z-index: 10; white-space: nowrap;
  }
  .toggle-row { display: flex; justify-content: flex-end; margin: 4px 2px 10px; }
  .toggle-btn {
    font: inherit; font-size: 12px; color: var(--ink-secondary); background: transparent;
    border: 1px solid var(--grid); border-radius: 6px; padding: 5px 10px; cursor: pointer;
  }
  .toggle-btn:hover { border-color: var(--axis); color: var(--ink); }
  table.data-table { border-collapse: collapse; font-size: 12px; width: 100%; margin-top: 8px; display: none; }
  table.data-table.visible { display: table; }
  table.data-table th, table.data-table td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--grid); }
  table.data-table th { color: var(--muted); font-weight: 600; }
  table.data-table td { color: var(--ink-secondary); }
  .chart-svg.hidden-by-table { display: none; }
  ${extraStyle}
</style>
</head>
<body>
<div class="viz-root">
  <h1>${esc(title)}</h1>
  <p class="subtitle">${description}</p>
  <div class="chart-card">
    <div class="toggle-row"><button class="toggle-btn" id="toggle-view">Show table</button></div>
    ${bodyHtml}
  </div>
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
    const svgEl = document.querySelector('.chart-svg');
    const tableEl = document.querySelector('.data-table');
    const showingTable = tableEl.classList.toggle('visible');
    svgEl.classList.toggle('hidden-by-table', showingTable);
    this.textContent = showingTable ? 'Show chart' : 'Show table';
  });
  ${script}
</script>
</body>
</html>`;
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

/** Multi-series line chart. series: [{ name, values: number[] }], xLabels: string[] */
function renderLineChart({ title, description, series, xLabels, yAxisLabel, favicon, mode = 'light' }) {
  const W = 900, H = 460, marginL = 56, marginR = 24, marginT = 20, marginB = 46;
  const plotW = W - marginL - marginR, plotH = H - marginT - marginB;
  const colors = PALETTE.categorical[mode];
  const allValues = series.flatMap((s) => s.values);
  const ticks = niceTicks(Math.min(...allValues), Math.max(...allValues), 5);
  const yMin = ticks[0], yMax = ticks[ticks.length - 1];
  const xStep = xLabels.length > 1 ? plotW / (xLabels.length - 1) : plotW;
  const xAt = (i) => marginL + i * xStep;
  const yAt = (v) => marginT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const gridSvg = ticks.map((t) => `<line class="grid-line" x1="${marginL}" x2="${W - marginR}" y1="${yAt(t)}" y2="${yAt(t)}"/>
    <text class="axis-label" x="${marginL - 8}" y="${yAt(t) + 4}" text-anchor="end">${t}</text>`).join('\n');

  const xLabelsSvg = xLabels.map((l, i) => `<text class="axis-label" x="${xAt(i)}" y="${H - marginB + 20}" text-anchor="middle">${esc(l)}</text>`).join('\n');

  const seriesSvg = series.map((s, si) => {
    const color = colors[si % colors.length];
    const points = s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');
    const dots = s.values.map((v, i) =>
      `<circle class="pt" cx="${xAt(i)}" cy="${yAt(v)}" r="4" fill="${color}" stroke="var(--surface)" stroke-width="1.5"
         data-tip="<strong>${esc(s.name)}</strong><br>${esc(xLabels[i])}: ${v}"></circle>`).join('\n');
    return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>\n${dots}`;
  }).join('\n');

  const legendSvg = series.map((s, si) =>
    `<div class="legend-item"><span class="legend-swatch" style="background:${colors[si % colors.length]}"></span>${esc(s.name)}</div>`).join('');

  const tableRows = xLabels.map((l, i) =>
    `<tr><td>${esc(l)}</td>${series.map((s) => `<td>${s.values[i]}</td>`).join('')}</tr>`).join('');

  const bodyHtml = `
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
      ${gridSvg}
      <line class="baseline" x1="${marginL}" x2="${W - marginR}" y1="${marginT + plotH}" y2="${marginT + plotH}"/>
      ${seriesSvg}
      ${xLabelsSvg}
      <text class="axis-label" x="16" y="${marginT + 10}" transform="rotate(-90 16 ${marginT + 10})" text-anchor="end">${esc(yAxisLabel)}</text>
    </svg>
    <div class="legend">${legendSvg}</div>
    <table class="data-table"><thead><tr><th>Phase</th>${series.map((s) => `<th>${esc(s.name)}</th>`).join('')}</tr></thead>
      <tbody>${tableRows}</tbody></table>`;

  const script = `
    document.querySelectorAll('.pt').forEach(function (el) {
      el.addEventListener('mouseenter', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mousemove', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mouseleave', hideTip);
    });`;

  return pageShell({ title, description, favicon, bodyHtml, script });
}

/** Single-series bar chart. bars: [{ label, value, n }] */
function renderBarChart({ title, description, bars, yAxisLabel, favicon, mode = 'light' }) {
  const W = 900, H = 460, marginL = 56, marginR = 24, marginT = 20, marginB = 60;
  const plotW = W - marginL - marginR, plotH = H - marginT - marginB;
  const color = PALETTE.categorical[mode][0];
  const values = bars.map((b) => b.value);
  const ticks = niceTicks(Math.min(0, ...values), Math.max(...values), 5);
  const yMin = ticks[0], yMax = ticks[ticks.length - 1];
  const yAt = (v) => marginT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const gap = 0.32;
  const bandW = plotW / bars.length;
  const barW = bandW * (1 - gap);

  const gridSvg = ticks.map((t) => `<line class="grid-line" x1="${marginL}" x2="${W - marginR}" y1="${yAt(t)}" y2="${yAt(t)}"/>
    <text class="axis-label" x="${marginL - 8}" y="${yAt(t) + 4}" text-anchor="end">${t}</text>`).join('\n');

  const barsSvg = bars.map((b, i) => {
    const x = marginL + i * bandW + (bandW - barW) / 2;
    const y = yAt(Math.max(0, b.value));
    const h = Math.abs(yAt(0) - yAt(b.value));
    const labelX = x + barW / 2;
    return `<rect class="bar" x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 1)}" rx="3" fill="${color}"
        data-tip="<strong>${esc(b.label)}</strong><br>avg ${b.value} (n=${b.n})"></rect>
      <text class="axis-label" x="${labelX}" y="${y - 8}" text-anchor="middle" fill="var(--ink-secondary)" font-size="11">${b.value}</text>
      <text class="axis-label" x="${labelX}" y="${H - marginB + 20}" text-anchor="middle">${esc(b.label)}</text>`;
  }).join('\n');

  const tableRows = bars.map((b) => `<tr><td>${esc(b.label)}</td><td>${b.value}</td><td>${b.n}</td></tr>`).join('');

  const bodyHtml = `
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
      ${gridSvg}
      <line class="baseline" x1="${marginL}" x2="${W - marginR}" y1="${yAt(0)}" y2="${yAt(0)}"/>
      ${barsSvg}
      <text class="axis-label" x="16" y="${marginT + 10}" transform="rotate(-90 16 ${marginT + 10})" text-anchor="end">${esc(yAxisLabel)}</text>
    </svg>
    <table class="data-table"><thead><tr><th>Level</th><th>Average score</th><th>N (person x variable)</th></tr></thead>
      <tbody>${tableRows}</tbody></table>`;

  const script = `
    document.querySelectorAll('.bar').forEach(function (el) {
      el.addEventListener('mouseenter', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mousemove', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mouseleave', hideTip);
    });`;

  return pageShell({ title, description, favicon, bodyHtml, script });
}

/** Sequential heatmap. rows: string[], cols: string[], cells: {value:number|null, n:number}[row][col] */
function renderHeatmap({ title, description, rows, cols, cells, favicon, mode = 'light' }) {
  const marginL = 190, marginR = 24, marginT = 20, marginB = 90;
  const cellW = 92, cellH = 34;
  const plotW = cols.length * cellW, plotH = rows.length * cellH;
  const W = marginL + plotW + marginR, H = marginT + plotH + marginB + 40;
  const ramp = PALETTE.sequential[mode];

  const flatVals = cells.flat().map((c) => c.value).filter((v) => v !== null);
  const vMin = Math.min(...flatVals), vMax = Math.max(...flatVals);
  const colorFor = (v) => {
    if (v === null) return 'var(--grid)';
    const t = vMax === vMin ? 0.5 : (v - vMin) / (vMax - vMin);
    const idx = Math.min(ramp.length - 1, Math.floor(t * ramp.length));
    return ramp[idx];
  };
  const textFor = (v, idx) => (v === null ? 'var(--muted)' : (idx >= ramp.length - 3 ? '#ffffff' : 'var(--ink)'));

  let cellsSvg = '';
  rows.forEach((rowLabel, ri) => {
    cols.forEach((colLabel, ci) => {
      const cell = cells[ri][ci];
      const x = marginL + ci * cellW, y = marginT + ri * cellH;
      const t = cell.value === null || vMax === vMin ? 0.5 : (cell.value - vMin) / (vMax - vMin);
      const idx = Math.min(ramp.length - 1, Math.floor(t * ramp.length));
      cellsSvg += `<rect class="cell" x="${x + 1}" y="${y + 1}" width="${cellW - 2}" height="${cellH - 2}" rx="4"
          fill="${colorFor(cell.value)}"
          data-tip="<strong>${esc(rowLabel)}</strong> x <strong>${esc(colLabel)}</strong><br>${cell.value === null ? 'no data' : 'avg ' + cell.value + ' (n=' + cell.n + ')'}"></rect>
        ${cell.value !== null ? `<text x="${x + cellW / 2}" y="${y + cellH / 2 + 4}" text-anchor="middle" font-size="11" fill="${textFor(cell.value, idx)}">${cell.value}</text>` : ''}`;
    });
  });

  const rowLabelsSvg = rows.map((r, ri) =>
    `<text class="axis-label" x="${marginL - 10}" y="${marginT + ri * cellH + cellH / 2 + 4}" text-anchor="end">${esc(r)}</text>`).join('\n');
  const colLabelsSvg = cols.map((c, ci) =>
    `<text class="axis-label" x="${marginL + ci * cellW + cellW / 2}" y="${marginT + plotH + 18}" text-anchor="middle"
        transform="rotate(-28 ${marginL + ci * cellW + cellW / 2} ${marginT + plotH + 18})">${esc(c)}</text>`).join('\n');

  const legendSteps = ramp.map((c, i) => `<span class="legend-swatch" style="background:${c}"></span>`).join('');
  const bodyHtml = `
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
      ${cellsSvg}
      ${rowLabelsSvg}
      ${colLabelsSvg}
    </svg>
    <div class="legend"><span>Low</span><div style="display:flex;gap:2px">${legendSteps}</div><span>High</span>
      <span style="margin-left:8px;color:var(--muted)">gray = no linked variable</span></div>
    <table class="data-table"><thead><tr><th>Instrument</th>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r, ri) => `<tr><td>${esc(r)}</td>${cols.map((c, ci) => `<td>${cells[ri][ci].value === null ? '—' : cells[ri][ci].value}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;

  const script = `
    document.querySelectorAll('.cell').forEach(function (el) {
      el.addEventListener('mouseenter', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mousemove', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mouseleave', hideTip);
    });`;

  return pageShell({ title, description, favicon, bodyHtml, script });
}

module.exports = { renderLineChart, renderBarChart, renderHeatmap, PALETTE };
