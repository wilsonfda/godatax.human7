/**
 * Minimal self-contained SVG chart renderers, following the dataviz skill's
 * method: fixed categorical hue order, one hue sequential ramp, thin marks,
 * a legend for >=2 series, direct labels, hover tooltips, light+dark theme
 * via CSS custom properties, a table-view fallback. No external libraries
 * (no CDN, no canvas/native deps) -- every chart is a standalone .html file
 * that opens in any browser, online or offline.
 *
 * Palette: GDX_HUMAN/8.gdx.dashboards default (dataviz skill reference
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
    // querySelectorAll (not querySelector): a multi-panel chart (e.g. dashboard_00)
    // has more than one .chart-svg sharing one .data-table -- toggling must hide/show
    // every panel together. A single-panel chart (every other chart here) still has
    // exactly one of each, so this is backward compatible.
    const svgEls = document.querySelectorAll('.chart-svg');
    const tableEls = document.querySelectorAll('.data-table');
    const showingTable = tableEls.length ? !tableEls[0].classList.contains('visible') : false;
    svgEls.forEach(function (el) { el.classList.toggle('hidden-by-table', showingTable); });
    tableEls.forEach(function (el) { el.classList.toggle('visible', showingTable); });
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

/** Splits a values array (numbers, with null/undefined for "no data") into
 * contiguous runs of "x,y" point strings for <polyline>, so a gap in the data
 * breaks the line instead of interpolating across it. A run of length 1
 * (an isolated present value) draws no line, only its point marker. */
function brokenPolylineSegments(values, xAt, yAt) {
  const segments = [];
  let current = [];
  values.forEach((v, i) => {
    if (v === null || v === undefined) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push(`${xAt(i)},${yAt(v)}`);
    }
  });
  if (current.length) segments.push(current);
  return segments;
}

/** Small-multiples line chart: N vertically stacked panels sharing the same
 * categorical x-axis, each with its OWN y-scale -- the dataviz-skill-endorsed
 * fix (anti-patterns.md, "Bad: Dual-axis charts") for metrics on genuinely
 * different scales that have no natural common baseline to index to (unlike
 * chart 1's time-phase series, these x categories are not ordinal, so
 * indexing to "=100 at category 0" would be arbitrary, not meaningful).
 * Every panel still shares one legend+table+toggle via the page shell.
 *
 * panels: [{ heading, yAxisLabel, series: [{name, values: (number|null)[]}], colorOffset }]
 * xLabels: string[] (shared category labels, one per index, same order in every panel's series)
 * tableColumns: [{ label, get: (rowIndex) => string }] -- builds the combined data-table;
 *   rowIndex runs over xLabels.
 */
function renderMultiPanelLineChart({ title, description, xLabels, panels, tableColumns, favicon, mode = 'light' }) {
  const W = 940, marginL = 64, marginR = 24, marginT = 20, marginB = 92;
  const plotW = W - marginL - marginR, plotH = 220;
  const panelGap = 30;
  const colors = PALETTE.categorical[mode];
  const xStep = xLabels.length > 1 ? plotW / (xLabels.length - 1) : plotW;
  const xAt = (i) => marginL + i * xStep;

  let colorCursor = 0;
  let panelsSvg = '';
  let legendsHtml = '';
  const panelH = marginT + plotH + marginB;

  panels.forEach((panel, pi) => {
    const yOffset = pi * (panelH + panelGap);
    const allValues = panel.series.flatMap((s) => s.values).filter((v) => v !== null && v !== undefined);
    const ticks = allValues.length ? niceTicks(Math.min(...allValues), Math.max(...allValues), 4) : [0, 1];
    const yMin = ticks[0], yMax = ticks[ticks.length - 1];
    const yAt = (v) => yOffset + marginT + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

    const gridSvg = ticks.map((t) => `<line class="grid-line" x1="${marginL}" x2="${W - marginR}" y1="${yAt(t)}" y2="${yAt(t)}"/>
      <text class="axis-label" x="${marginL - 8}" y="${yAt(t) + 4}" text-anchor="end">${t}</text>`).join('\n');

    const xLabelsSvg = xLabels.map((l, i) => `<text class="axis-label" x="${xAt(i)}" y="${yOffset + marginT + plotH + 20}"
        text-anchor="end" transform="rotate(-32 ${xAt(i)} ${yOffset + marginT + plotH + 20})">${esc(l)}</text>`).join('\n');

    const panelColorStart = colorCursor;
    const seriesSvg = panel.series.map((s, si) => {
      const color = colors[(panelColorStart + si) % colors.length];
      const segments = brokenPolylineSegments(s.values, xAt, yAt);
      const lines = segments.filter((seg) => seg.length >= 2)
        .map((seg) => `<polyline points="${seg.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`)
        .join('\n');
      const dots = s.values.map((v, i) => (v === null || v === undefined) ? '' : `<circle class="pt" cx="${xAt(i)}" cy="${yAt(v)}" r="4" fill="${color}" stroke="var(--surface)" stroke-width="1.5"
           data-tip="<strong>${esc(s.name)}</strong><br>${esc(xLabels[i])}: ${v}"></circle>`).join('\n');
      return `${lines}\n${dots}`;
    }).join('\n');
    colorCursor += panel.series.length;

    panelsSvg += `
      <text class="panel-heading" x="${marginL}" y="${yOffset + 4}">${esc(panel.heading)}</text>
      ${gridSvg}
      <line class="baseline" x1="${marginL}" x2="${W - marginR}" y1="${yOffset + marginT + plotH}" y2="${yOffset + marginT + plotH}"/>
      ${seriesSvg}
      ${xLabelsSvg}
      <text class="axis-label" x="18" y="${yOffset + marginT + 10}" transform="rotate(-90 18 ${yOffset + marginT + 10})" text-anchor="end">${esc(panel.yAxisLabel)}</text>`;

    if (panel.series.length >= 2) {
      const items = panel.series.map((s, si) =>
        `<div class="legend-item"><span class="legend-swatch" style="background:${colors[(panelColorStart + si) % colors.length]}"></span>${esc(s.name)}</div>`).join('');
      legendsHtml += `<div class="legend">${items}</div>`;
    }
  });

  const totalH = marginT + panels.length * panelH + (panels.length - 1) * panelGap;

  const tableRows = xLabels.map((label, i) =>
    `<tr><td>${esc(label)}</td>${tableColumns.map((c) => `<td>${esc(c.get(i))}</td>`).join('')}</tr>`).join('');

  const bodyHtml = `
    <svg class="chart-svg" viewBox="0 0 ${W} ${totalH}" role="img" aria-label="${esc(title)}">
      ${panelsSvg}
    </svg>
    ${legendsHtml}
    <table class="data-table"><thead><tr><th>Instrument</th>${tableColumns.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
      <tbody>${tableRows}</tbody></table>`;

  const script = `
    document.querySelectorAll('.pt').forEach(function (el) {
      el.addEventListener('mouseenter', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mousemove', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mouseleave', hideTip);
    });`;

  const extraStyle = `.panel-heading { fill: var(--ink-secondary); font-size: 12px; font-weight: 600; }`;

  return pageShell({ title, description, favicon, bodyHtml, script, extraStyle });
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

/** Interpolates continuously between the steps of a sequential ramp (t in
 * [0,1]) instead of the discrete floor()-into-buckets renderHeatmap uses --
 * with only 7 marks on the portrait, flooring collapsed several chakras onto
 * the same ramp step. */
function hexToRgb(hex) {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}
function rgbToHex(r, g, b) {
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function rampColorContinuous(t, ramp) {
  const p = t * (ramp.length - 1);
  const lo = Math.max(0, Math.min(ramp.length - 2, Math.floor(p)));
  const frac = p - lo;
  const c0 = hexToRgb(ramp[lo]), c1 = hexToRgb(ramp[lo + 1]);
  return rgbToHex(c0.r + (c1.r - c0.r) * frac, c0.g + (c1.g - c0.g) * frac, c0.b + (c1.b - c0.b) * frac);
}

// Fixed layout for the 7 chakras down the meditating silhouette's centerline,
// order 7 (crown, top of head) down to order 1 (root, near the pelvis) --
// same visual convention as the traditional 7-chakra illustration this
// reworks (GDX_HUMAN/4.kundalini.chakras), just with computed color instead
// of the fixed rainbow.
const CHAKRA_PORTRAIT_CX = 170;
const CHAKRA_PORTRAIT_Y = { 7: 70, 6: 126, 5: 176, 4: 226, 3: 272, 2: 314, 1: 354 };
const CHAKRA_PORTRAIT_SILHOUETTE = `
  <circle cx="170" cy="72" r="38"/>
  <path d="M148,104 L192,104 L198,118 L142,118 Z"/>
  <path d="M170,116 C122,116 96,148 90,196 C86,228 92,258 104,282 C88,300 78,326 74,356
           C124,372 216,372 266,356 C262,326 252,300 236,282 C248,258 254,228 250,196 C244,148 218,116 170,116 Z"/>
  <path d="M74,356 C40,392 26,432 34,470 C70,462 96,440 110,412 Z"/>
  <path d="M266,356 C300,392 314,432 306,470 C270,462 244,440 230,412 Z"/>
  <path d="M34,470 C60,486 90,492 116,486 C104,504 78,514 50,512 C38,500 33,486 34,470 Z"/>
  <path d="M306,470 C280,486 250,492 224,486 C236,504 262,514 290,512 C302,500 307,486 306,470 Z"/>
  <path d="M96,486 C112,522 140,542 170,544 C200,542 228,522 244,486 C216,502 188,510 170,510 C152,510 124,502 96,486 Z"/>`;

/** Chakra gradient portrait. rows: [{ORDER_NUM, SANSKRIT_NAME, COMMON_NAME,
 * LEVEL_NAME, AVG_SCORE, N}], one row per chakra that has at least one mapped
 * variable (1-7, missing ORDER_NUM values render as "no data" -- same
 * convention renderHeatmap uses for an empty cell, not zero). */
function renderChakraPortrait({ title, description, rows, favicon, mode = 'light' }) {
  const ramp = PALETTE.sequential[mode];
  const byOrder = new Map(rows.map((r) => [r.ORDER_NUM, r]));
  const present = rows.filter((r) => r.AVG_SCORE !== null && r.AVG_SCORE !== undefined);
  const vMin = present.length ? Math.min(...present.map((r) => r.AVG_SCORE)) : null;
  const vMax = present.length ? Math.max(...present.map((r) => r.AVG_SCORE)) : null;
  const colorFor = (v) => (vMin === null || vMax === vMin ? ramp[Math.floor(ramp.length / 2)]
    : rampColorContinuous((v - vMin) / (vMax - vMin), ramp));

  let circlesSvg = '', labelsSvg = '';
  for (let n = 7; n >= 1; n--) {
    const r = byOrder.get(n);
    const cy = CHAKRA_PORTRAIT_Y[n];
    const hasScore = r && r.AVG_SCORE !== null && r.AVG_SCORE !== undefined;
    const scoreLabel = hasScore ? String(r.AVG_SCORE) : 'no data';
    const name = r ? r.SANSKRIT_NAME : '';
    const tip = r ? `<strong>${esc(r.SANSKRIT_NAME)}</strong> (${esc(r.COMMON_NAME)})<br>${hasScore ? 'avg ' + r.AVG_SCORE + ' (n=' + r.N + ')' : 'no linked variable'}` : '';
    if (hasScore) {
      const color = colorFor(r.AVG_SCORE);
      const rOut = n === 7 ? 30 : 27, rIn = n === 7 ? 17 : 15;
      circlesSvg += `<circle cx="${CHAKRA_PORTRAIT_CX}" cy="${cy}" r="${rOut}" fill="${color}" opacity="0.30"/>
        <circle class="chakra-mark" cx="${CHAKRA_PORTRAIT_CX}" cy="${cy}" r="${rIn}" fill="${color}"
          stroke="var(--surface)" stroke-width="1.5" data-tip="${esc(tip)}"></circle>`;
    } else {
      circlesSvg += `<circle cx="${CHAKRA_PORTRAIT_CX}" cy="${cy}" r="24" fill="none" stroke="var(--axis)" stroke-width="1.5" stroke-dasharray="3,3"/>
        <circle class="chakra-mark" cx="${CHAKRA_PORTRAIT_CX}" cy="${cy}" r="13" fill="var(--grid)"
          stroke="var(--axis)" stroke-width="1.5" data-tip="${esc(tip)}"></circle>`;
    }
    labelsSvg += `<text x="60" y="${cy + 4}" text-anchor="end" font-size="12" font-weight="600" fill="var(--muted)">No. ${n}</text>
      <text x="200" y="${cy - 3}" font-size="13" font-weight="700" fill="var(--ink)">${esc(name)}</text>
      <text x="200" y="${cy + 10}" font-size="11" fill="var(--muted)">${esc(scoreLabel)}</text>`;
  }

  const legendSteps = ramp.map((c) => `<span class="legend-swatch" style="background:${c}"></span>`).join('');
  const bodyHtml = `
    <svg class="chart-svg" viewBox="0 0 340 560" role="img" aria-label="${esc(title)}" style="max-width:340px;margin:0 auto;">
      <g fill="var(--grid)">${CHAKRA_PORTRAIT_SILHOUETTE}</g>
      ${circlesSvg}
      ${labelsSvg}
    </svg>
    <div class="legend">
      <span>${vMin !== null ? vMin.toFixed(2) : '--'} (lowest)</span>
      <div style="display:flex;gap:2px">${legendSteps}</div>
      <span>${vMax !== null ? vMax.toFixed(2) : '--'} (highest)</span>
      <span style="margin-left:8px;color:var(--muted)">gray dashed = no linked variable</span>
    </div>
    <table class="data-table"><thead><tr><th>No.</th><th>Chakra</th><th>Septenary level</th><th>Average score</th><th>N (person x variable)</th></tr></thead>
      <tbody>${[7, 6, 5, 4, 3, 2, 1].map((n) => {
        const r = byOrder.get(n);
        return `<tr><td>${n}</td><td>${r ? esc(r.SANSKRIT_NAME) + ' (' + esc(r.COMMON_NAME) + ')' : ''}</td>` +
          `<td>${r ? esc(r.LEVEL_NAME || '') : ''}</td>` +
          `<td>${r && r.AVG_SCORE !== null && r.AVG_SCORE !== undefined ? r.AVG_SCORE : '—'}</td>` +
          `<td>${r && r.N !== null && r.N !== undefined ? r.N : '—'}</td></tr>`;
      }).join('')}</tbody>
    </table>`;

  const script = `
    document.querySelectorAll('.chakra-mark').forEach(function (el) {
      el.addEventListener('mouseenter', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mousemove', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mouseleave', hideTip);
    });`;

  return pageShell({ title, description, favicon, bodyHtml, script });
}

// Fixed layout for the Septenary Constitution diagram (3.septenary.constitution/
// septenaria.webp): a 3-band triangle (Individuality: Atma/Buddhi/Manas, order
// 7-6-5, apex at top) sitting on a 4-band rectangle (Personality: Kama-manas/
// Kama Rupa/Vital-Etheric/Physical, order 4-3-2-1, top to bottom) -- same
// computed-gradient rework as the chakra portrait, applied to this figure.
const SEPT_CX = 220, SEPT_Y_APEX = 30, SEPT_Y_TRI_BASE = 240, SEPT_BASE_HALF_W = 190, SEPT_RECT_BAND_H = 65;
function septHalfWidthAt(y) {
  return (y - SEPT_Y_APEX) / (SEPT_Y_TRI_BASE - SEPT_Y_APEX) * SEPT_BASE_HALF_W;
}
// Band geometry per ORDER_NUM, top to bottom: 7, 6, 5 are triangle bands
// (trapezoids, the topmost a true triangle at the apex); 4, 3, 2, 1 are equal
// rectangle bands.
const SEPT_TRI_Y = [SEPT_Y_APEX, SEPT_Y_APEX + (SEPT_Y_TRI_BASE - SEPT_Y_APEX) / 3, SEPT_Y_APEX + 2 * (SEPT_Y_TRI_BASE - SEPT_Y_APEX) / 3, SEPT_Y_TRI_BASE];
const SEPT_RECT_Y = [0, 1, 2, 3, 4].map((i) => SEPT_Y_TRI_BASE + i * SEPT_RECT_BAND_H);
function septBandGeometry(orderNum) {
  if (orderNum >= 5) {
    const i = 7 - orderNum; // 7->0 (apex band), 6->1, 5->2
    const yTop = SEPT_TRI_Y[i], yBot = SEPT_TRI_Y[i + 1];
    const hwTop = septHalfWidthAt(yTop), hwBot = septHalfWidthAt(yBot);
    const points = i === 0
      ? `${SEPT_CX},${yTop} ${SEPT_CX + hwBot},${yBot} ${SEPT_CX - hwBot},${yBot}`
      : `${SEPT_CX - hwTop},${yTop} ${SEPT_CX + hwTop},${yTop} ${SEPT_CX + hwBot},${yBot} ${SEPT_CX - hwBot},${yBot}`;
    return { points, cy: (yTop + yBot) / 2, group: 'Individuality' };
  }
  const i = 4 - orderNum; // 4->0 (top rect band) .. 1->3 (bottom)
  const yTop = SEPT_RECT_Y[i], yBot = SEPT_RECT_Y[i + 1];
  const hw = SEPT_BASE_HALF_W;
  const points = `${SEPT_CX - hw},${yTop} ${SEPT_CX + hw},${yTop} ${SEPT_CX + hw},${yBot} ${SEPT_CX - hw},${yBot}`;
  return { points, cy: (yTop + yBot) / 2, group: 'Personality' };
}
/** Relative luminance (0-255 scale) to pick readable text color over a fill. */
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Septenary Constitution gradient portrait. rows: [{ORDER_NUM, LEVEL_NAME,
 * TECHNICAL_NAME, AVG_SCORE, N}] -- same shape loadScoreByLevel() already
 * returns for chart 2 (plus TECHNICAL_NAME), just replotted as this figure. A
 * missing ORDER_NUM renders as "no data", same convention chart 7/the
 * heatmaps use for an empty cell. */
function renderSeptenaryConstitutionPortrait({ title, description, rows, favicon, mode = 'light' }) {
  const ramp = PALETTE.sequential[mode];
  const byOrder = new Map(rows.map((r) => [r.ORDER_NUM, r]));
  const present = rows.filter((r) => r.AVG_SCORE !== null && r.AVG_SCORE !== undefined);
  const vMin = present.length ? Math.min(...present.map((r) => r.AVG_SCORE)) : null;
  const vMax = present.length ? Math.max(...present.map((r) => r.AVG_SCORE)) : null;
  const colorFor = (v) => (vMin === null || vMax === vMin ? ramp[Math.floor(ramp.length / 2)]
    : rampColorContinuous((v - vMin) / (vMax - vMin), ramp));

  let bandsSvg = '', groupLabelsSvg = '';
  for (let n = 7; n >= 1; n--) {
    const r = byOrder.get(n);
    const geo = septBandGeometry(n);
    const hasScore = r && r.AVG_SCORE !== null && r.AVG_SCORE !== undefined;
    const name = r ? r.LEVEL_NAME : '';
    const technical = r && r.TECHNICAL_NAME ? `(${r.TECHNICAL_NAME})` : '';
    const scoreLabel = hasScore ? `avg ${r.AVG_SCORE}` : 'no data';
    const tip = r ? `<strong>${esc(r.LEVEL_NAME)}</strong> ${esc(technical)}<br>${hasScore ? scoreLabel + ' (n=' + r.N + ')' : 'no linked variable'}` : '';
    if (hasScore) {
      const color = colorFor(r.AVG_SCORE);
      const textColor = luminance(color) < 140 ? '#ffffff' : 'var(--ink)';
      bandsSvg += `<polygon class="chakra-mark" points="${geo.points}" fill="${color}" stroke="var(--surface)" stroke-width="1.5" data-tip="${esc(tip)}"></polygon>
        <text x="${SEPT_CX}" y="${geo.cy - 5}" text-anchor="middle" font-size="13" font-weight="700" fill="${textColor}">${esc(name)}</text>
        <text x="${SEPT_CX}" y="${geo.cy + 11}" text-anchor="middle" font-size="10.5" fill="${textColor}">${esc(technical)} &middot; ${esc(scoreLabel)}</text>`;
    } else {
      bandsSvg += `<polygon points="${geo.points}" fill="var(--grid)" stroke="var(--axis)" stroke-width="1.5" stroke-dasharray="4,3"></polygon>
        <polygon class="chakra-mark" points="${geo.points}" fill="transparent" data-tip="${esc(tip)}"></polygon>
        <text x="${SEPT_CX}" y="${geo.cy - 5}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--muted)">${esc(name)}</text>
        <text x="${SEPT_CX}" y="${geo.cy + 11}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${esc(technical)} &middot; no data</text>`;
    }
  }
  // Small connector notch where the triangle meets the rectangle, matching
  // the source illustration's own seam.
  const connector = `<rect x="${SEPT_CX - 11}" y="${SEPT_Y_TRI_BASE - 11}" width="22" height="22" fill="var(--surface)" stroke="var(--axis)" stroke-width="1.5"/>`;

  const groupLabelY1 = (SEPT_Y_APEX + SEPT_Y_TRI_BASE) / 2;
  const groupLabelY2 = SEPT_Y_TRI_BASE + 2 * SEPT_RECT_BAND_H;
  groupLabelsSvg = `
    <text x="18" y="${groupLabelY1}" text-anchor="middle" font-size="12" font-weight="700" letter-spacing="1"
      fill="var(--muted)" transform="rotate(-90 18 ${groupLabelY1})">INDIVIDUALITY</text>
    <text x="18" y="${groupLabelY2}" text-anchor="middle" font-size="12" font-weight="700" letter-spacing="1"
      fill="var(--muted)" transform="rotate(-90 18 ${groupLabelY2})">PERSONALITY</text>`;

  const legendSteps = ramp.map((c) => `<span class="legend-swatch" style="background:${c}"></span>`).join('');
  const H = SEPT_RECT_Y[SEPT_RECT_Y.length - 1] + 20;
  const bodyHtml = `
    <svg class="chart-svg" viewBox="0 0 440 ${H}" role="img" aria-label="${esc(title)}" style="max-width:400px;margin:0 auto;">
      ${bandsSvg}
      ${connector}
      ${groupLabelsSvg}
    </svg>
    <div class="legend">
      <span>${vMin !== null ? vMin.toFixed(2) : '--'} (lowest)</span>
      <div style="display:flex;gap:2px">${legendSteps}</div>
      <span>${vMax !== null ? vMax.toFixed(2) : '--'} (highest)</span>
      <span style="margin-left:8px;color:var(--muted)">gray dashed = no linked variable</span>
    </div>
    <table class="data-table"><thead><tr><th>No.</th><th>Level</th><th>Technical name</th><th>Average score</th><th>N (person x variable)</th></tr></thead>
      <tbody>${[7, 6, 5, 4, 3, 2, 1].map((n) => {
        const r = byOrder.get(n);
        return `<tr><td>${n}</td><td>${r ? esc(r.LEVEL_NAME) : ''}</td>` +
          `<td>${r && r.TECHNICAL_NAME ? esc(r.TECHNICAL_NAME) : ''}</td>` +
          `<td>${r && r.AVG_SCORE !== null && r.AVG_SCORE !== undefined ? r.AVG_SCORE : '—'}</td>` +
          `<td>${r && r.N !== null && r.N !== undefined ? r.N : '—'}</td></tr>`;
      }).join('')}</tbody>
    </table>`;

  const script = `
    document.querySelectorAll('.chakra-mark').forEach(function (el) {
      el.addEventListener('mouseenter', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mousemove', function (e) { showTip(e, el.getAttribute('data-tip')); });
      el.addEventListener('mouseleave', hideTip);
    });`;

  return pageShell({ title, description, favicon, bodyHtml, script });
}

module.exports = {
  renderLineChart, renderMultiPanelLineChart, renderBarChart, renderHeatmap, renderChakraPortrait,
  renderSeptenaryConstitutionPortrait, PALETTE,
};
