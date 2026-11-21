/**
 * Builds the hero route map geometry: src/data/route-map.json.
 * Run by hand after changing routes or the extent: `node scripts/build-map.mjs`.
 *
 * Land: Natural Earth 1:110m (public domain), via the world-atlas package (TopoJSON).
 * Projection: Mercator, like a nautical chart. The map spans more than 360° of longitude
 * so every route from Sabine Pass is drawn unbroken: the Pacific route ends at a copy of
 * Tokyo on the left edge, the Suez and Cape routes at Tokyo on the right edge.
 * Routes are simplified waypoint lines, smoothed. They are illustrations, not tracks.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';

const here = dirname(fileURLToPath(import.meta.url));
const require = (p) => JSON.parse(readFileSync(resolve(here, '..', 'node_modules', p), 'utf8'));

const LON0 = -232; // west edge (128°E, shown as -232 so the Pacific route stays continuous)
const LON1 = 157; // east edge
const LAT0 = -44;
const LAT1 = 62;
const S = 2; // SVG units per degree of longitude

const rad = Math.PI / 180;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * rad) / 2)) / rad;
const Y0 = mercY(LAT1);
const Y1 = mercY(LAT0);
const W = (LON1 - LON0) * S;
const H = (Y0 - Y1) * S;
const px = (lon) => (lon - LON0) * S;
const py = (lat) => (Y0 - mercY(lat)) * S;
const r1 = (v) => Math.round(v * 10) / 10;

// ---- land
const topo = require('world-atlas/land-110m.json');
const land = feature(topo, topo.objects.land);
const polys = land.features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates));
const pieces = [];
for (const poly of polys) {
  for (const ring of poly) {
    const lats = ring.map((p) => p[1]);
    if (Math.min(...lats) < -60) continue; // Antarctica: outside the view, infinite in Mercator
    for (const shift of [0, -360]) {
      const lons = ring.map((p) => p[0] + shift);
      if (Math.max(...lons) < LON0 || Math.min(...lons) > LON1) continue;
      if (Math.max(...lats) < LAT0 - 5 || Math.min(...lats) > LAT1 + 25) continue;
      let d = '';
      let last = '';
      ring.forEach(([lon, lat], k) => {
        const pt = `${Math.round(px(lon + shift))} ${Math.round(py(Math.min(lat, 84)))}`;
        if (pt === last) return;
        d += (k === 0 ? 'M' : 'L') + pt;
        last = pt;
      });
      pieces.push(`${d}Z`);
    }
  }
}

// ---- graticule every 30°
const grat = [];
for (let lon = -210; lon <= 150; lon += 30) grat.push(`M${r1(px(lon))} 0V${r1(H)}`);
for (const lat of [-30, 0, 30, 60]) grat.push(`M0 ${r1(py(lat))}H${r1(W)}`);

// ---- routes: [lat, lon] waypoints
const SABINE = [29.73, -93.87];
const GULF_EXIT = [[26.0, -88.5], [24.2, -83.0], [24.6, -80.4], [27.5, -79.6]]; // Gulf of Mexico to the Florida Straits
const TOKYO = [35.45, 139.8];
const ROUTES = [
  {
    id: 'nwe',
    label: 'Northwest Europe, direct',
    market: 'ttf',
    pts: [SABINE, ...GULF_EXIT, [34, -66], [42, -42], [48, -16], [49.6, -5.5], [50.4, 0.5], [51.95, 4.1]],
  },
  {
    id: 'asia-panama',
    label: 'North Asia via Panama',
    market: 'jkm',
    pts: [SABINE, [27.2, -90.5], [24.2, -86.6], [21.7, -85.4], [18, -82.6], [13, -80.6], [9.4, -79.9], [8.6, -79.6], [6.5, -82], [10, -97], [17, -118], [25, -145], [31, -170], [34, -198], [34.6, -216], [35.45, -220.2]],
  },
  {
    id: 'asia-suez',
    label: 'North Asia via Suez',
    market: 'jkm',
    pts: [SABINE, ...GULF_EXIT, [32, -62], [36, -28], [36, -10], [35.95, -5.6], [37.3, 2], [37.2, 11], [34.5, 22], [31.6, 32.3], [29.9, 32.55], [27.5, 34.2], [20, 38.6], [12.6, 43.4], [12.2, 51], [8.5, 66], [5.8, 80.5], [5.8, 95], [2.8, 101.2], [1.2, 104], [9, 110], [18, 116], [22.2, 121.5], [28.5, 128], [33.4, 136.5], TOKYO],
  },
  {
    id: 'asia-cape',
    label: 'North Asia via the Cape of Good Hope',
    market: 'jkm',
    pts: [SABINE, ...GULF_EXIT, [22, -62], [4, -30], [-15, -10], [-30, 10], [-35.6, 18.5], [-36.5, 28], [-31, 55], [-20, 85], [-11, 110], [-8.8, 115.8], [-3, 118], [3, 119.5], [12, 126.5], [22, 130], [30, 135], TOKYO],
  },
];

/** Catmull-Rom through the points, as cubic Béziers. */
function smooth(pts) {
  const p = pts.map(([lat, lon]) => [px(lon), py(lat)]);
  let d = `M${r1(p[0][0])} ${r1(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i];
    const b = p[i];
    const c = p[i + 1];
    const e = p[i + 2] ?? c;
    const c1 = [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6];
    const c2 = [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6];
    d += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(c[0])} ${r1(c[1])}`;
  }
  return d;
}

const at = ([lat, lon]) => ({ x: r1(px(lon)), y: r1(py(lat)) });
const out = {
  source: 'Land: Natural Earth 1:110m (public domain), via world-atlas 2.0.2. Routes simplified. Built by scripts/build-map.mjs.',
  width: r1(W),
  height: r1(H),
  land: pieces.join(''),
  graticule: grat.join(''),
  routes: ROUTES.map((r) => ({ id: r.id, label: r.label, market: r.market, d: smooth(r.pts) })),
  ports: [
    { id: 'sabine', label: 'Sabine Pass', ...at(SABINE), anchor: 'end', dx: -6, dy: -6 },
    { id: 'rotterdam', label: 'Rotterdam', ...at([51.95, 4.1]), anchor: 'start', dx: 6, dy: -6 },
    { id: 'tokyo', label: 'Tokyo', ...at(TOKYO), anchor: 'end', dx: -6, dy: -7 },
    { id: 'tokyo-w', label: 'Tokyo', ...at([35.45, -220.2]), anchor: 'start', dx: 6, dy: -7 },
  ],
  via: [
    { label: 'Panama', ...at([8.6, -79.6]), anchor: 'start', dx: 6, dy: 14 },
    { label: 'Suez', ...at([29.9, 32.55]), anchor: 'start', dx: 8, dy: -4 },
    { label: 'Cape of Good Hope', ...at([-35.6, 18.5]), anchor: 'middle', dx: 0, dy: 16 },
  ],
};
// Land goes to a static, cacheable SVG; the page inlines only the routes and labels.
const landSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${out.width} ${out.height}"><path fill="#1A4470" d="${out.land}"/></svg>\n`;
const landFile = resolve(here, '..', 'public', 'map', 'land.svg');
mkdirSync(dirname(landFile), { recursive: true });
writeFileSync(landFile, landSvg);
console.log(`Wrote ${landFile}: ${(landSvg.length / 1024).toFixed(1)} KB`);
delete out.land;

const file = resolve(here, '..', 'src', 'data', 'route-map.json');
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, `${JSON.stringify(out)}\n`);
console.log(`Wrote ${file}: ${(JSON.stringify(out).length / 1024).toFixed(1)} KB, viewBox ${out.width} x ${out.height}`);
