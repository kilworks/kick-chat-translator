// Realistic infographics for partner-kit.html and email/panels.html: the Earth at night (NASA Black Marble
// 2016, public domain, kit/earth-night.jpg), countries lit in Volt by installs, cities glowing by listing
// visitors, and the two charts in the same light. Needs d3, topojson-client, C (countries.js), CITIES (cities.js).
const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent && parent.appendChild(e); return e; };
const VOLT = '#53fc18';

function glowFilter(defs, id, sd) {
  const f = mk('filter', { id, x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
  mk('feGaussianBlur', { stdDeviation: sd, result: 'b' }, f);
  const m = mk('feMerge', {}, f); mk('feMergeNode', { in: 'b' }, m); mk('feMergeNode', { in: 'SourceGraphic' }, m);
}

// Equirectangular, so the NASA plate carree image lines up exactly. Cropped to 78N..56S.
async function realMap(svg, { w, base = '', labels = 12 }) {
  const H = w / 2, top = (90 - 78) / 180 * H, bottom = (90 + 56) / 180 * H;
  svg.setAttribute('viewBox', `0 ${top} ${w} ${bottom - top}`);
  const defs = mk('defs', {}, svg);
  const dim = mk('filter', { id: 'night' }, defs); // keep the real city lights, quieter, slightly cool
  mk('feColorMatrix', { type: 'matrix', values: '0.55 0 0 0 0  0 0.58 0 0 0  0 0 0.65 0 0  0 0 0 1 0' }, dim);
  glowFilter(defs, 'lit', 2.2); glowFilter(defs, 'halo', 2.6);
  mk('image', { href: base + 'kit/earth-night.jpg', x: 0, y: 0, width: w, height: H, preserveAspectRatio: 'none', filter: 'url(#night)' }, svg);

  const world = await (await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json')).json();
  const land = topojson.feature(world, world.objects.countries).features.filter(f => f.id !== '010');
  const proj = d3.geoEquirectangular().scale(w / (2 * Math.PI)).translate([w / 2, H / 2]);
  const path = d3.geoPath(proj);
  const byId = new Map(C.map(c => [String(c[2]).padStart(3, '0'), c]));
  const max = Math.log10(Math.max(...C.map(c => c[4])) + 1);
  const light = c => 0.08 + 0.72 * Math.pow(Math.log10(c[4] + 2) / max, 1.6); // more installs, brighter country
  const g = mk('g', {}, svg);
  for (const f of land) {
    const c = byId.get(f.id);
    mk('path', { d: path(f), fill: c ? VOLT : 'none', 'fill-opacity': c ? light(c) : 0,
      stroke: c ? 'rgba(83,252,24,0.85)' : 'rgba(255,255,255,0.14)', 'stroke-width': c ? 0.5 : 0.3, filter: c ? 'url(#lit)' : '' }, g);
  }
  // Cities: a hot core and a Volt halo, area proportional to listing visitors.
  const pts = mk('g', {}, svg);
  for (const [name, , lat, lon, n] of [...CITIES].reverse()) {
    const [x, y] = proj([lon, lat]); const r = 0.9 + Math.sqrt(n) * 0.75;
    mk('circle', { cx: x, cy: y, r: r * 2.4, fill: VOLT, 'fill-opacity': 0.35, filter: 'url(#halo)' }, pts);
    mk('circle', { cx: x, cy: y, r, fill: '#f2ffe9' }, pts);
  }
  const placed = []; // skip a label that would collide with one already set
  for (const [name, , lat, lon] of CITIES.slice(0, labels)) {
    const [x, y] = proj([lon, lat]); const fs = w / 70, bw = name.length * fs * 0.56, box = [x + 5, y - 4 - fs, x + 5 + bw, y - 2];
    if (placed.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue; placed.push(box);
    const t = mk('text', { x: x + 5, y: y - 4, fill: '#ffffff', 'font-family': 'Inter, sans-serif', 'font-size': w / 70, 'font-weight': 600,
      stroke: '#000', 'stroke-width': w / 400, 'paint-order': 'stroke', 'stroke-opacity': 0.7 }, svg);
    t.textContent = name;
  }
  return { citiesShown: CITIES.length, cityUsers: CITIES.reduce((s, c) => s + c[4], 0), countriesLit: land.filter(f => byId.has(f.id)).length };
}

// Monthly installs as lit columns: Volt light rising from a baseline, value and month set directly on them.
function glowBars(svg, months, { w = 600, h = 230, gap = 34 } = {}) {
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const defs = mk('defs', {}, svg); glowFilter(defs, 'barglow', 3);
  const grad = mk('linearGradient', { id: 'beam', x1: 0, y1: 1, x2: 0, y2: 0 }, defs);
  mk('stop', { offset: '0', 'stop-color': VOLT, 'stop-opacity': 1 }, grad);
  mk('stop', { offset: '1', 'stop-color': VOLT, 'stop-opacity': 0.55 }, grad);
  const top = 26, base = h - 28, max = Math.max(...months.map(m => m[1]));
  const bw = (w - gap * (months.length - 1)) / months.length;
  mk('line', { x1: 0, y1: base + 0.5, x2: w, y2: base + 0.5, stroke: 'rgba(255,255,255,0.35)' }, svg);
  months.forEach(([label, n], i) => {
    const x = i * (bw + gap), bh = (base - top) * n / max;
    mk('rect', { x, y: base - bh, width: bw, height: bh, fill: 'url(#beam)', filter: 'url(#barglow)' }, svg);
    const v = mk('text', { x, y: base - bh - 8, fill: '#fff', 'font-family': 'Inter, sans-serif', 'font-size': 14, 'font-weight': 700 }, svg); v.textContent = n;
    const m = mk('text', { x, y: base + 19, fill: '#fff', 'font-family': 'Inter, sans-serif', 'font-size': 12 }, svg); m.textContent = label;
  });
  return months.reduce((s, m) => s + m[1], 0);
}

// Latency on one shared time axis (0 to 2,000 ms): a point of light at 22 ms, a long beam to 1,618 ms.
function latencyBeams(svg, rows, { w = 600, labelW = 150 } = {}) {
  const span = 2000, plotW = w - labelW - 10, x = ms => labelW + plotW * ms / span;
  const h = rows.length * 46 + 26;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const defs = mk('defs', {}, svg); glowFilter(defs, 'beamglow', 3);
  rows.forEach(([label, ms, colour], i) => {
    const y = 14 + i * 46;
    const a = mk('text', { x: 0, y: y + 8, fill: '#fff', 'font-family': 'boosterPolygonalCompact, sans-serif', 'font-size': 24, 'font-weight': 700 }, svg);
    a.textContent = ms.toLocaleString('en-US');
    const u = mk('tspan', { 'font-family': 'Inter, sans-serif', 'font-size': 13, dx: 4 }, a); u.textContent = 'ms';
    const l = mk('text', { x: 0, y: y + 24, fill: '#fff', 'font-family': 'Inter, sans-serif', 'font-size': 11 }, svg); l.textContent = label;
    mk('rect', { x: labelW, y: y - 1, width: Math.max(4, x(ms) - labelW), height: 8, rx: 4, fill: colour, filter: 'url(#beamglow)' }, svg);
  });
  const ay = h - 12;
  mk('line', { x1: labelW, y1: ay - 8, x2: labelW + plotW, y2: ay - 8, stroke: 'rgba(255,255,255,0.3)' }, svg);
  for (const t of [0, 500, 1000, 1500, 2000]) {
    const tx = mk('text', { x: x(t), y: ay + 4, fill: 'rgba(255,255,255,0.75)', 'font-family': 'Inter, sans-serif', 'font-size': 10, 'text-anchor': t === 0 ? 'start' : t === 2000 ? 'end' : 'middle' }, svg);
    tx.textContent = t === 2000 ? '2,000 ms' : t.toLocaleString('en-US');
  }
  return rows.map(r => r[1]);
}
