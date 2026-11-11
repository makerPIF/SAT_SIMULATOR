import * as satellite from 'satellite.js';
import { feature, mesh } from 'topojson-client';
import land50 from 'world-atlas/land-50m.json';
import countries from 'world-atlas/countries-110m.json';

// =====================================================================
// 상수
// =====================================================================
const RE = 6378.137, MU = 398600.4418, J2 = 1.08263e-3, DEG = Math.PI / 180;
const EPOCH = Date.UTC(2026, 10, 1);
const $ = (id) => document.getElementById(id);
const fmt = (x, d = 0) => Number(x).toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: d });
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// =====================================================================
// 지상국 (예시 배치)
// =====================================================================
const STATIONS = [
  { id: 'dj', name: '대전 (항우연)', lat: 36.37, lon: 127.36 },
  { id: 'bs', name: '부산', lat: 35.18, lon: 129.08 },
  { id: 'sj', name: '남극 세종기지', lat: -62.22, lon: -58.79 },
  { id: 'sv', name: '스발바르 (노르웨이)', lat: 78.23, lon: 15.4 },
];
const MIN_EL = 5;

// =====================================================================
// 위성 (공개 자료 기반 근사 궤도·대표 사양)
// =====================================================================
function sso(alt) { const a = RE + alt, n = Math.sqrt(MU / a ** 3); return Math.acos(-(2 * Math.PI / (365.2422 * 86400)) / (1.5 * n * J2 * (RE / a) ** 2)) / DEG; }
const SATS = [
  { id: 'k3a', name: '아리랑 3A호', alt: 528, ltan: 13.5, m0: 160, sensor: { type: 'optical', label: '광학 + 적외선', gsd: '0.55 m (전정색)', scene: 30, reach: 45 }, rate: 320, color: '#ff6b81' },
  { id: 'k5', name: '아리랑 5호', alt: 550, ltan: 18.0, m0: 250, sensor: { type: 'sar', label: '영상레이더(SAR)', gsd: '1 m', scene: 30, reach: 45 }, rate: 320, color: '#ffa94d' },
  { id: 'cas1', name: '차세대중형위성 1호', alt: 497, ltan: 22.8, m0: 300, sensor: { type: 'optical', label: '광학', gsd: '0.5 m (전정색)', scene: 25, reach: 45 }, rate: 320, color: '#ffd43b' },
  { id: 'cas3', name: '차세대중형위성 3호', alt: 601, ltan: 22.5, m0: 30, sensor: { type: 'aurora', label: '광시야 대기광 카메라 + 우주 플라즈마', gsd: '—', scene: 0, reach: 0 }, rate: 150, color: '#63e6be' },
  ...[1, 2, 3, 4, 5, 6].map((k, j) => ({ id: 'neon' + k, name: `초소형군집위성 ${k}호`, alt: k === 1 ? 520 : 510, ltan: 22.5, m0: j * 18, sensor: { type: 'optical', label: '광학 (초소형)', gsd: '약 1 m', scene: 20, reach: 40 }, rate: 100, color: '#74c0fc' })),
  { id: 'gk2a', name: '천리안 2A호', geoLon: 128.2, sensor: { type: 'weather', label: '기상 영상기(AMI)', gsd: '0.5–2 km', scene: 0, reach: 0 }, rate: 1000, color: '#b197fc' },
  { id: 'gk2b', name: '천리안 2B호', geoLon: 128.25, sensor: { type: 'ocean', label: '해양 관측(GOCI-II)', gsd: '250 m', scene: 0, reach: 0 }, rate: 1000, color: '#e599f7' },
];
const SUN_RA_EPOCH = (() => { const n = EPOCH / 86400000 + 2440587.5 - 2451545; const L = (280.46 + 0.9856474 * n) * DEG, g = (357.528 + 0.9856003 * n) * DEG; const lam = L + (1.915 * Math.sin(g)) * DEG; return Math.atan2(Math.cos(23.439 * DEG) * Math.sin(lam), Math.cos(lam)) / DEG; })();
SATS.forEach((s) => {
  if (s.geoLon !== undefined) { s.kind = 'geo'; s.a = 42164.17; s.alt = 35786; s.inc = 0; }
  else {
    s.kind = 'kep'; s.inc = sso(s.alt); s.raan = SUN_RA_EPOCH + (s.ltan - 12) * 15; s.a = RE + s.alt; s.n = Math.sqrt(MU / s.a ** 3);
    const k = 1.5 * J2 * (RE / s.a) ** 2 * s.n; s.raanDot = -k * Math.cos(s.inc * DEG); s.period = 2 * Math.PI / s.n;
  }
  s.soc = 0.75 + Math.random() * 0.15; s.tPanel = 10; s.store = []; s.hk = []; s.lastHK = 0; s.track = null; s.trackT = 0;
});

// =====================================================================
// 궤도 계산
// =====================================================================
function stateEci(s, t) {
  if (s.kind === 'tle') {
    const pv = satellite.propagate(s.satrec, new Date(t)); if (!pv || !pv.position) return null;
    return { r: [pv.position.x, pv.position.y, pv.position.z], v: [pv.velocity.x, pv.velocity.y, pv.velocity.z] };
  }
  if (s.kind === 'geo') {
    const th = satellite.gstime(new Date(t)) + s.geoLon * DEG, w = 7.2921159e-5;
    return { r: [s.a * Math.cos(th), s.a * Math.sin(th), 0], v: [-s.a * w * Math.sin(th), s.a * w * Math.cos(th), 0] };
  }
  const dt = (t - EPOCH) / 1000, u = s.m0 * DEG + s.n * dt, O = s.raan * DEG + s.raanDot * dt, i = s.inc * DEG;
  const cu = Math.cos(u), su = Math.sin(u), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i), si = Math.sin(i);
  const r = [s.a * (cO * cu - sO * su * ci), s.a * (sO * cu + cO * su * ci), s.a * su * si];
  const vv = s.a * s.n;
  const v = [vv * (-cO * su - sO * cu * ci), vv * (-sO * su + cO * cu * ci), vv * cu * si];
  return { r, v };
}
function geo(s, t) {
  const st = stateEci(s, t); if (!st) return null;
  const g = satellite.eciToGeodetic({ x: st.r[0], y: st.r[1], z: st.r[2] }, satellite.gstime(new Date(t)));
  return { lat: g.latitude / DEG, lon: ((g.longitude / DEG + 540) % 360) - 180, alt: g.height, r: st.r, v: st.v, speed: Math.hypot(...st.v) };
}
function elevation(s, st, t) {
  const g = geo(s, t); if (!g) return -90;
  const la = st.lat * DEG, lo = st.lon * DEG, gm = satellite.gstime(new Date(t));
  const sx = RE * Math.cos(la) * Math.cos(lo + gm), sy = RE * Math.cos(la) * Math.sin(lo + gm), sz = RE * Math.sin(la);
  const dx = g.r[0] - sx, dy = g.r[1] - sy, dz = g.r[2] - sz, d = Math.hypot(dx, dy, dz);
  return Math.asin((dx * sx + dy * sy + dz * sz) / (d * RE)) / DEG;
}
function sunSub(t) { // 태양 직하점
  const n = t / 86400000 + 2440587.5 - 2451545;
  const L = (280.46 + 0.9856474 * n) * DEG, g = (357.528 + 0.9856003 * n) * DEG;
  const lam = L + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG, eps = 23.439 * DEG;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)), dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  let lon = (ra - satellite.gstime(new Date(t))) / DEG; lon = ((lon + 540) % 360) - 180;
  return { lat: dec / DEG, lon, dec, ra };
}
function sunElevAt(lat, lon, t) {
  const s = sunSub(t), la = lat * DEG, sl = s.lat * DEG, dl = (lon - s.lon) * DEG;
  return Math.asin(Math.sin(la) * Math.sin(sl) + Math.cos(la) * Math.cos(sl) * Math.cos(dl)) / DEG;
}
function inEclipse(g, t) {
  const s = sunSub(t), sv = [Math.cos(s.dec) * Math.cos(s.ra), Math.cos(s.dec) * Math.sin(s.ra), Math.sin(s.dec)];
  const rs = g.r[0] * sv[0] + g.r[1] * sv[1] + g.r[2] * sv[2];
  if (rs > 0) return false;
  const px = g.r[0] - rs * sv[0], py = g.r[1] - rs * sv[1], pz = g.r[2] - rs * sv[2];
  return Math.hypot(px, py, pz) < RE;
}
function gcDist(la1, lo1, la2, lo2) { // km
  const a = Math.sin((la2 - la1) * DEG / 2) ** 2 + Math.cos(la1 * DEG) * Math.cos(la2 * DEG) * Math.sin((lo2 - lo1) * DEG / 2) ** 2;
  return 2 * RE * Math.asin(Math.sqrt(a));
}
function contactStations(s, t) { return STATIONS.filter((st) => elevation(s, st, t) > MIN_EL); }
function predictPasses(s, st, t0, hours = 24) {
  if (s.kind === 'geo') return [{ geo: true, el: elevation(s, st, t0) }];
  const out = []; let inP = false, cur = null;
  for (let t = t0; t < t0 + hours * 3600e3; t += 20000) {
    const el = elevation(s, st, t);
    if (el > MIN_EL && !inP) { inP = true; cur = { aos: t, max: el, maxT: t }; }
    if (inP) { if (el > cur.max) { cur.max = el; cur.maxT = t; } if (el <= MIN_EL) { cur.los = t; out.push(cur); inP = false; if (out.length >= 6) break; } }
  }
  return out;
}

// =====================================================================
// 시뮬레이션 상태
// =====================================================================
const S = { t: Date.now(), speed: 30, paused: false, sel: SATS[0], station: STATIONS[0], instant: false, tasks: [], gallery: [], log: [], nextTaskId: 1 };
const KST = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const KST_S = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
function log(msg, cls = '') { S.log.unshift({ t: S.t, msg, cls }); if (S.log.length > 80) S.log.pop(); renderLog(); }

// =====================================================================
// 지도
// =====================================================================
const MAP_W = 2048, MAP_H = 1024;
const baseMap = document.createElement('canvas'); baseMap.width = MAP_W; baseMap.height = MAP_H;
const landMask = document.createElement('canvas'); landMask.width = 2048; landMask.height = 1024;
const LAND = feature(land50, land50.objects.land);
const BORDERS = mesh(countries, countries.objects.countries, (a, b) => a !== b);
function polyPath(g, project, W) {
  LAND.features.forEach((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    polys.forEach((poly) => poly.forEach((ring) => { let prev = null; ring.forEach(([lo, la], i) => { const [x, y] = project(lo, la); if (i === 0 || (W && Math.abs(x - prev) > W / 2)) g.moveTo(x, y); else g.lineTo(x, y); prev = x; }); g.closePath(); }));
  });
}
{
  const g = baseMap.getContext('2d');
  g.fillStyle = '#0d2342'; g.fillRect(0, 0, MAP_W, MAP_H);
  const pj = (lo, la) => [(lo + 180) / 360 * MAP_W, (90 - la) / 180 * MAP_H];
  g.beginPath(); polyPath(g, pj, MAP_W); g.fillStyle = '#2a4a3a'; g.fill('evenodd'); g.strokeStyle = 'rgba(160,220,180,0.45)'; g.lineWidth = 1; g.stroke();
  g.beginPath(); BORDERS.coordinates.forEach((line) => { let prev = null; line.forEach(([lo, la], i) => { const [x, y] = pj(lo, la); if (i === 0 || Math.abs(x - prev) > MAP_W / 2) g.moveTo(x, y); else g.lineTo(x, y); prev = x; }); });
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.07)';
  for (let lo = -180; lo <= 180; lo += 30) { g.beginPath(); g.moveTo(pj(lo, 0)[0], 0); g.lineTo(pj(lo, 0)[0], MAP_H); g.stroke(); }
  for (let la = -60; la <= 60; la += 30) { g.beginPath(); g.moveTo(0, pj(0, la)[1]); g.lineTo(MAP_W, pj(0, la)[1]); g.stroke(); }
  const m = landMask.getContext('2d'); m.fillStyle = '#000'; m.fillRect(0, 0, 2048, 1024); m.beginPath(); polyPath(m, pj, MAP_W); m.fillStyle = '#fff'; m.fill('evenodd');
}
const MASK = landMask.getContext('2d').getImageData(0, 0, 2048, 1024).data;
function isLandGlobal(lat, lon) { const x = Math.floor((lon + 180) / 360 * 2048) & 2047, y = clamp(Math.floor((90 - lat) / 180 * 1024), 0, 1023); return MASK[(y * 2048 + x) * 4] > 127; }

const mapC = $('map'), mg = mapC.getContext('2d');
let MW = 0, MH = 0, MX = 0, MY = 0;
function sizeMap() {
  const wrap = $('mapwrap'), w = wrap.clientWidth, h = wrap.clientHeight, dpr = Math.min(devicePixelRatio, 2);
  mapC.width = w * dpr; mapC.height = h * dpr; mapC.style.width = w + 'px'; mapC.style.height = h + 'px';
  MW = Math.min(w, h * 2); MH = MW / 2; MX = (w - MW) / 2; MY = (h - MH) / 2;
  mg.setTransform(dpr, 0, 0, dpr, 0, 0);
}
const px = (lon) => MX + (lon + 180) / 360 * MW, py = (lat) => MY + (90 - lat) / 180 * MH;
function drawLine(pts, color, width = 1.5, dash = []) {
  mg.strokeStyle = color; mg.lineWidth = width; mg.setLineDash(dash); mg.beginPath();
  let prev = null; pts.forEach(([la, lo], i) => { const x = px(lo), y = py(la); if (i === 0 || Math.abs(x - prev) > MW / 2) mg.moveTo(x, y); else mg.lineTo(x, y); prev = x; });
  mg.stroke(); mg.setLineDash([]);
}
function circlePts(lat, lon, km, n = 90) {
  const d = km / RE, la = lat * DEG, lo = lon * DEG, out = [];
  for (let i = 0; i <= n; i++) { const b = i / n * 2 * Math.PI; const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b)); const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2)); out.push([la2 / DEG, ((lo2 / DEG + 540) % 360) - 180]); }
  return out;
}
function visRadiusKm(alt) { const e = MIN_EL * DEG; return RE * (Math.acos(RE / (RE + alt) * Math.cos(e)) - e); }

function drawMap() {
  mg.clearRect(0, 0, mapC.width, mapC.height);
  mg.drawImage(baseMap, MX, MY, MW, MH);
  // 밤 영역
  const sun = sunSub(S.t), tanD = Math.tan(sun.dec);
  mg.fillStyle = 'rgba(0,4,16,0.5)'; mg.beginPath();
  const pts = [];
  for (let i = 0; i <= 180; i++) { const lon = -180 + i * 2; const lat = Math.atan(-Math.cos((lon - sun.lon) * DEG) / tanD) / DEG; pts.push([px(lon), py(lat)]); }
  mg.moveTo(pts[0][0], pts[0][1]); pts.forEach(([x, y]) => mg.lineTo(x, y));
  if (sun.dec > 0) { mg.lineTo(MX + MW, MY + MH); mg.lineTo(MX, MY + MH); } else { mg.lineTo(MX + MW, MY); mg.lineTo(MX, MY); }
  mg.closePath(); mg.fill();
  mg.fillStyle = '#ffd43b'; mg.beginPath(); mg.arc(px(sun.lon), py(sun.lat), 6, 0, 7); mg.fill();
  // 선택 위성 지상국 가시 원
  const sel = S.sel, gs = geo(sel, S.t);
  STATIONS.forEach((st) => {
    if (gs && sel.kind !== 'geo') drawLine(circlePts(st.lat, st.lon, visRadiusKm(gs.alt)), st === S.station ? 'rgba(255,212,59,0.55)' : 'rgba(255,212,59,0.18)', 1, [4, 4]);
  });
  // 촬영 목표
  S.tasks.forEach((tk) => { if (!tk.target || ['수신 완료', '기회 없음'].includes(tk.status)) return; mg.strokeStyle = '#ff8787'; mg.lineWidth = 2; const x = px(tk.target.lon), y = py(tk.target.lat); mg.beginPath(); mg.moveTo(x - 7, y); mg.lineTo(x + 7, y); mg.moveTo(x, y - 7); mg.lineTo(x, y + 7); mg.stroke(); });
  if (pendingTarget) { const x = px(pendingTarget.lon), y = py(pendingTarget.lat); mg.strokeStyle = '#fff'; mg.lineWidth = 2; mg.beginPath(); mg.arc(x, y, 9, 0, 7); mg.stroke(); }
  // 위성
  SATS.forEach((s) => {
    if (!s.visible) return;
    const g = geo(s, S.t); if (!g) return;
    if (s.kind !== 'geo') {
      if (!s.track || Math.abs(S.t - s.trackT) > 60000) {
        const per = s.kind === 'tle' ? 2 * Math.PI / s.satrec.no * 60 : s.period; const tr = [];
        for (let k = -40; k <= 80; k++) { const gg = geo(s, S.t + k / 80 * per * 1000); if (gg) tr.push([gg.lat, gg.lon]); }
        s.track = tr; s.trackT = S.t;
      }
      if (s === sel) drawLine(s.track, s.color, 2); else if (S.showTracks) drawLine(s.track, s.color + '55', 1);
    }
    if (s === sel && s.kind !== 'geo' && s.sensor.reach) drawLine(circlePts(g.lat, g.lon, g.alt * Math.tan(30 * DEG)), s.color + '99', 1, [2, 3]);
    const x = px(g.lon), y = py(g.lat);
    const inC = contactStations(s, S.t).length > 0;
    mg.fillStyle = s.color; mg.beginPath(); mg.arc(x, y, s === sel ? 7 : 4.5, 0, 7); mg.fill();
    if (inC) { mg.strokeStyle = '#69db7c'; mg.lineWidth = 2; mg.beginPath(); mg.arc(x, y, s === sel ? 12 : 8, 0, 7); mg.stroke(); }
    if (s === sel || S.showNames) { mg.fillStyle = '#e6edf7'; mg.font = (s === sel ? '600 13px' : '11px') + ' "Noto Sans KR", sans-serif'; mg.fillText(s.name.replace(/ \(.*\)/, ''), x + 10, y - 8); }
  });
  // 지상국
  STATIONS.forEach((st) => {
    const x = px(st.lon), y = py(st.lat);
    mg.fillStyle = st === S.station ? '#ffd43b' : '#c9a227'; mg.beginPath(); mg.moveTo(x, y - 7); mg.lineTo(x + 6, y + 5); mg.lineTo(x - 6, y + 5); mg.closePath(); mg.fill();
    mg.fillStyle = '#ffe58f'; mg.font = '11px "Noto Sans KR", sans-serif'; mg.fillText(st.name, x + 8, y + 12);
    const g = geo(sel, S.t);
    if (g && elevation(sel, st, S.t) > MIN_EL) { mg.strokeStyle = '#69db7c'; mg.lineWidth = 1.5; mg.setLineDash([5, 4]); mg.beginPath(); mg.moveTo(x, y); mg.lineTo(px(g.lon), py(g.lat)); mg.stroke(); mg.setLineDash([]); }
  });
}
mapC.addEventListener('click', (e) => {
  const r = mapC.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
  if (x < MX || x > MX + MW || y < MY || y > MY + MH) return;
  const lon = (x - MX) / MW * 360 - 180, lat = 90 - (y - MY) / MH * 180;
  // 위성 클릭?
  let best = null, bd = 14;
  SATS.forEach((s) => { if (!s.visible) return; const g = geo(s, S.t); if (!g) return; const d = Math.hypot(px(g.lon) - x, py(g.lat) - y); if (d < bd) { bd = d; best = s; } });
  if (best) { selectSat(best); return; }
  pendingTarget = { name: `지도 지점 (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`, lat, lon };
  $('target').value = 'map'; renderTargetInfo();
});

// =====================================================================
// 모의 영상 생성
// =====================================================================
function hash(x, y, s) { let h = x * 374761393 + y * 668265263 + s * 982451653; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y, s, o = 5) { let f = 0, a = 0.5; for (let i = 0; i < o; i++) { f += a * vnoise(x, y, s + i * 17); x *= 2.03; y *= 2.03; a *= 0.5; } return f; }

function sceneMask(lat0, lon0, kmPerPx, N) {
  const c = document.createElement('canvas'); c.width = N; c.height = N; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
  const kx = 111.32 * Math.cos(lat0 * DEG), ky = 110.57;
  const pj = (lo, la) => { let dl = lo - lon0; if (dl > 180) dl -= 360; if (dl < -180) dl += 360; return [N / 2 + dl * kx / kmPerPx, N / 2 - (la - lat0) * ky / kmPerPx]; };
  g.beginPath(); polyPath(g, pj, 0); g.fillStyle = '#fff'; g.fill('evenodd');
  return g.getImageData(0, 0, N, N).data;
}
function makeImage(sat, ctx) {
  const N = 384, c = document.createElement('canvas'); c.width = N; c.height = N; const g = c.getContext('2d'); const img = g.createImageData(N, N); const d = img.data;
  const seed = Math.floor(ctx.t / 60000) % 100000;
  const type = sat.sensor.type;
  const put = (i, r, gg, b) => { d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255; };
  if (type === 'optical' || type === 'sar') {
    const sceneKm = ctx.sceneKm, kpp = sceneKm / N, m = sceneMask(ctx.lat, ctx.lon, kpp, N);
    const sunF = clamp((ctx.sunEl + 5) / 50, 0.15, 1.1);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4, land = m[i] > 127;
      const wx = (ctx.lon * 111 * Math.cos(ctx.lat * DEG) + (x - N / 2) * kpp) / 4, wy = (ctx.lat * 111 - (y - N / 2) * kpp) / 4;
      const n1 = fbm(wx, wy, 3), n2 = fbm(wx * 6, wy * 6, 7, 3), field = vnoise(wx * 14, wy * 14, 11);
      if (type === 'sar') {
        const speck = 0.55 + Math.random() * 0.9;
        let v = land ? (60 + n1 * 110 + (field > 0.72 ? 70 : 0) + n2 * 40) * speck : (10 + n2 * 18) * speck;
        v = clamp(v, 0, 255); put(i, v, v, v);
      } else {
        let r, gg, b;
        if (land) {
          const dc = Math.hypot(x - N / 2, y - N / 2) * kpp;
          const uIdx = fbm(wx * 1.2 + 9, wy * 1.2, 13, 4) + (ctx.city ? clamp(1 - dc / (ctx.sceneKm * 0.45), 0, 1) * 0.45 : 0);
          const mount = n1 > 0.6 && uIdx < 0.7;
          if (uIdx > 0.68) {
            const street = ((x + Math.floor(n2 * 6)) % 9 === 0) || ((y + Math.floor(n1 * 6)) % 9 === 0);
            const q = street ? 95 : 150 + vnoise(x / 2, y / 2, 5) * 70; r = q; gg = q * 0.98; b = q * 0.95;
          } else if (mount) { const sh = fbm(wx * 3, wy * 3, 31, 4); r = 45 + sh * 60; gg = 70 + sh * 60; b = 40 + sh * 35; }
          else { const crop = vnoise(wx * 2.5, wy * 2.5, 11); r = 85 + crop * 80 + n2 * 20; gg = 115 + crop * 55 + n2 * 20; b = 55 + crop * 25; }
        } else { r = 15 + n2 * 20; gg = 45 + n2 * 30; b = 80 + n1 * 50; }
        const cl = clamp((fbm(wx * 0.6 + 50, wy * 0.6, ctx.cloudSeed) - 0.52) * 3.2, 0, 1);
        r = r * (1 - cl) + 245 * cl; gg = gg * (1 - cl) + 248 * cl; b = b * (1 - cl) + 252 * cl;
        put(i, clamp(r * sunF, 0, 255), clamp(gg * sunF, 0, 255), clamp(b * sunF, 0, 255));
      }
    }
  } else if (type === 'weather' || type === 'ocean') {
    // 정지궤도에서 본 지구 (천리안 2A: 전구 적외선 / 2B: 한반도 주변 해색)
    const lon0 = sat.geoLon;
    const sun = sunSub(ctx.t);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      let lat, lon;
      if (type === 'weather') {
        const X = (x - N / 2) / (N / 2 - 4), Y = -(y - N / 2) / (N / 2 - 4), rr = X * X + Y * Y;
        if (rr > 1) { put(i, 2, 4, 10); continue; }
        const Z = Math.sqrt(1 - rr); lat = Math.asin(Y) / DEG; lon = lon0 + Math.atan2(X, Z) / DEG;
      } else { lat = 45 - y / N * 25; lon = 117 + x / N * 25; }
      lon = ((lon + 540) % 360) - 180;
      const land = isLandGlobal(lat, lon);
      const cx = Math.cos(lat * DEG) * Math.cos(lon * DEG) * 6, cy = Math.cos(lat * DEG) * Math.sin(lon * DEG) * 6, cz = Math.sin(lat * DEG) * 6;
      const cloud = clamp((fbm(cx + cz * 0.7 + 30, cy - cz * 0.4, ctx.cloudSeed) - 0.5) * 3, 0, 1);
      if (type === 'weather') { // 적외선 10.5 μm: 차가운 구름 = 밝게, 따뜻한 지표 = 어둡게
        const tb = (land ? 300 - Math.abs(lat) * 0.8 : 295 - Math.abs(lat) * 0.9) - cloud * 70;
        const v = clamp((310 - tb) * 2.2, 0, 255); put(i, v, v, v);
      } else {
        const sunEl = sunElevAt(lat, lon, ctx.t); const f = clamp((sunEl + 3) / 40, 0.05, 1);
        if (cloud > 0.35) { const v = 230 * f; put(i, v, v, v); continue; }
        if (land) { put(i, 120 * f, 112 * f, 100 * f); continue; }
        const chl = fbm(lon * 0.9, lat * 0.9, 21) + (Math.abs(lat - 35) < 3 ? 0.15 : 0);
        const q = clamp((chl - 0.35) * 2.2, 0, 1);
        put(i, (20 + q * 60) * f, (60 + q * 150) * f, (130 - q * 60) * f);
      }
    }
  } else if (type === 'aurora') {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4, hz = N * 0.68;
      if (y > hz) { const v = 6 + fbm(x / 40, y / 40, 5) * 10; put(i, v * 0.6, v * 0.7, v); continue; }
      const curtain = Math.sin(x / N * 9 + fbm(x / 60, 0, seed) * 6) * 0.5 + 0.5;
      const rise = clamp(1 - (hz - y) / (N * 0.45), 0, 1);
      const a = curtain * rise * (0.6 + fbm(x / 20, y / 80, seed + 3) * 0.6) * ctx.intensity;
      const star = hash(x, y, 99) > 0.996 ? 160 : 0;
      put(i, clamp(10 + a * 60 + star, 0, 255), clamp(14 + a * 230 + star, 0, 255), clamp(30 + a * 110 + star, 0, 255));
    }
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/jpeg', 0.85);
}

// =====================================================================
// 텔레메트리 (하우스키핑 + 탑재체 센서)
// =====================================================================
function hkPacket(s, t) {
  const g = geo(s, t), ecl = s.kind === 'geo' ? false : inEclipse(g, t);
  const bmag = 30000 * (RE / (RE + g.alt)) ** 3 * Math.sqrt(1 + 3 * Math.sin(g.lat * DEG) ** 2);
  const p = {
    t, lat: g.lat, lon: g.lon, alt: g.alt, speed: g.speed, eclipse: ecl,
    vbat: 6.6 + s.soc * 1.6 + (Math.random() - 0.5) * 0.02, soc: s.soc * 100,
    isolar: ecl ? 0 : (s.kind === 'geo' ? 18 : 3.2) * (0.92 + Math.random() * 0.06),
    tpanel: s.tPanel + (Math.random() - 0.5), tobc: 18 + s.tPanel * 0.15 + (Math.random() - 0.5) * 0.4,
    mode: s.busy ? '촬영 자세' : (ecl ? '절전 · 지구 지향' : '태양 지향'),
    rw: [Math.round(1200 + Math.sin(t / 7e5) * 600), Math.round(-800 + Math.cos(t / 5e5) * 400), Math.round(300 + Math.sin(t / 9e5) * 900)],
    bmag, storeMB: s.store.reduce((a, x) => a + x.remain, 0),
  };
  if (s.sensor.type === 'aurora') {
    const auroral = clamp((Math.abs(g.lat) - 55) / 15, 0, 1) * (ecl ? 1 : 0.2);
    p.airglow = Math.round(120 + auroral * 2400 + Math.random() * 60); // Rayleigh (모의)
    p.ne = (2 + Math.cos(g.lat * DEG) * 8 * (ecl ? 0.4 : 1) + Math.random()).toFixed(2); // 10^4 /cm^3 (모의)
  }
  return p;
}

// =====================================================================
// 촬영 명령 처리
// =====================================================================
const TARGETS = [
  ['서울', 37.57, 126.98], ['부산', 35.1, 129.04], ['대전', 36.35, 127.38], ['제주도', 33.38, 126.55], ['독도', 37.24, 131.87],
  ['백두산', 42.0, 128.06], ['도쿄', 35.68, 139.69], ['베이징', 39.9, 116.4], ['그린란드 일룰리사트 빙하', 69.2, -51.0], ['아마존 열대우림', -3.4, -62.2], ['사하라 사막', 23.4, 12.5], ['남극 세종기지', -62.22, -58.79],
];
let pendingTarget = null;
function findOpportunity(s, tg, from) {
  if (s.sensor.type === 'weather' || s.sensor.type === 'ocean') { const step = s.sensor.type === 'weather' ? 600e3 : 3600e3; let t = Math.ceil(from / step) * step; if (s.sensor.type === 'ocean') { for (let k = 0; k < 48; k++, t += step) if (sunElevAt(35, 128, t) > 15) return { t, offNadir: 0 }; return null; } return { t, offNadir: 0 }; }
  if (s.sensor.type === 'aurora') { for (let t = from; t < from + 48 * 3600e3; t += 30e3) { const g = geo(s, t); if (Math.abs(g.lat) > 62 && inEclipse(g, t)) return { t, offNadir: 0, lat: g.lat, lon: g.lon }; } return null; }
  let best = null;
  for (let t = from; t < from + 120 * 3600e3; t += 15e3) {
    const g = geo(s, t); if (!g) continue;
    const d = gcDist(g.lat, g.lon, tg.lat, tg.lon); const reach = g.alt * Math.tan(s.sensor.reach * DEG);
    if (d < reach) {
      if (s.sensor.type === 'optical' && sunElevAt(tg.lat, tg.lon, t) < 10) continue;
      // 이 통과에서 가장 가까운 순간 찾기
      let tb = t, db = d;
      for (let t2 = t; t2 < t + 300e3; t2 += 5e3) { const g2 = geo(s, t2); const d2 = gcDist(g2.lat, g2.lon, tg.lat, tg.lon); if (d2 < db) { db = d2; tb = t2; } }
      best = { t: tb, offNadir: Math.atan(db / g.alt) / DEG }; break;
    }
  }
  return best;
}
function addTask() {
  const s = S.sel; let tg = null;
  if (s.sensor.type === 'optical' || s.sensor.type === 'sar') {
    const v = $('target').value;
    if (v === 'map') { if (!pendingTarget) { log('지도에서 촬영 지점을 클릭하세요', 'warn'); return; } tg = pendingTarget; }
    else { const [n, la, lo] = TARGETS[+v]; tg = { name: n, lat: la, lon: lo }; }
  }
  const kind = { optical: '광학 촬영', sar: 'SAR 촬영', weather: '전구(全球) 기상 관측', ocean: '한반도 주변 해양 관측', aurora: '오로라·대기광 관측' }[s.sensor.type];
  const tk = { id: S.nextTaskId++, sat: s, target: tg, kind, status: '업링크 대기', created: S.t };
  S.tasks.unshift(tk);
  log(`명령 #${tk.id} 생성 · ${s.name} · ${kind}${tg ? ' · ' + tg.name : ''} → 다음 교신 때 업링크`);
  renderTasks();
}

// =====================================================================
// 시뮬레이션 스텝
// =====================================================================
const prevContact = new Map();
function step(dt) {
  S.t += dt * 1000;
  const t = S.t;
  SATS.forEach((s) => {
    if (!s.visible && s.kind !== 'tle' && !S.tasks.some((tk) => tk.sat === s)) { /* 숨긴 위성도 계산은 계속 */ }
    const g = geo(s, t); if (!g) return;
    const ecl = s.kind === 'geo' ? false : inEclipse(g, t);
    s.soc = clamp(s.soc + ((ecl ? -0.9 : 1.1) * (s.busy ? 0.6 : 0.25)) * dt / 3600 * (ecl ? 1 : 1) * 0.25, 0.2, 1);
    s.tPanel += ((ecl ? -20 : 28) - s.tPanel) * dt / 1500;
    const cs = contactStations(s, t), inC = cs.length > 0;
    const was = prevContact.get(s.id) || false;
    if (inC && !was && s.kind !== 'geo') log(`AOS · ${s.name} ↔ ${cs[0].name} 교신 시작`, 'good');
    if (!inC && was && s.kind !== 'geo') log(`LOS · ${s.name} 교신 종료`);
    prevContact.set(s.id, inC);
    // 텔레메트리 수신 (교신 중 10초마다)
    if (inC && t - s.lastHK >= 10000) { s.hk.push(hkPacket(s, t)); if (s.hk.length > 200) s.hk.shift(); s.lastHK = t; }
    // 다운링크
    if (inC && s.store.length) {
      let budget = s.rate / 8 * dt; // MB
      while (budget > 0 && s.store.length) {
        const it = s.store[0]; const take = Math.min(budget, it.remain); it.remain -= take; budget -= take;
        it.task.status = '다운링크 중'; it.task.progress = 1 - it.remain / it.size;
        if (it.remain <= 1e-6) { s.store.shift(); it.task.status = '수신 완료'; S.gallery.unshift(it.task); log(`수신 완료 · #${it.task.id} ${s.name} ${it.task.kind} (${fmt(it.size)} MB) → 영상 처리`, 'good'); renderGallery(); }
      }
      renderTasks();
    }
  });
  // 명령 처리
  S.tasks.forEach((tk) => {
    const s = tk.sat;
    if (tk.status === '업링크 대기' && (S.instant || contactStations(s, t).length)) {
      const op = findOpportunity(s, tk.target, t + 60e3);
      if (!op) { tk.status = '기회 없음'; log(`#${tk.id} 5일 안에 촬영 기회 없음 (햇빛·통과 경로 확인)`, 'warn'); }
      else { tk.status = '촬영 예약'; tk.exec = op.t; tk.offNadir = op.offNadir; tk.opp = op; log(`업링크 완료 · #${tk.id} 촬영 예정 ${KST_S.format(new Date(op.t))} (기울임 ${op.offNadir.toFixed(1)}°)`); }
      renderTasks();
    }
    if (tk.status === '촬영 예약' && t >= tk.exec) {
      const g = geo(s, tk.exec);
      const c = { t: tk.exec, cloudSeed: 40 + Math.floor(tk.exec / 3600e3) % 50 };
      if (tk.target) { c.lat = tk.target.lat; c.lon = tk.target.lon; c.sunEl = sunElevAt(c.lat, c.lon, tk.exec); c.sceneKm = s.sensor.scene; c.city = ['서울', '부산', '대전', '도쿄', '베이징'].includes(tk.target.name); }
      if (s.sensor.type === 'aurora') c.intensity = 0.6 + Math.random() * 0.6;
      tk.img = makeImage(s, c);
      tk.meta = { satLat: g.lat, satLon: g.lon, alt: g.alt, sunEl: c.sunEl, sceneKm: c.sceneKm, auroraLat: tk.opp && tk.opp.lat };
      tk.status = '촬영 완료 · 위성 저장'; s.busy = false;
      const size = { optical: 900, sar: 1200, weather: 400, ocean: 600, aurora: 150 }[s.sensor.type];
      s.store.push({ task: tk, size, remain: size });
      log(`촬영 완료 · #${tk.id} ${s.name} → 다음 교신 때 다운링크 (${fmt(size)} MB)`, 'good');
      renderTasks();
    }
    if (tk.status === '촬영 예약' && tk.exec - t < 120e3) s.busy = true;
  });
}

// =====================================================================
// UI 렌더
// =====================================================================
function selectSat(s) {
  S.sel = s; renderSatList(); renderSelInfo(); renderPasses(); renderTargetUI(); renderTelemetry(true);
}
function renderSatList() { // 목록 구조는 위성 추가·선택 때만 다시 만든다
  $('satlist').innerHTML = SATS.map((s, i) => `<li data-i="${i}" class="${s === S.sel ? 'on' : ''}"><input type="checkbox" data-v="${i}" ${s.visible ? 'checked' : ''}><span class="dot" style="background:${s.color}"></span><span class="nm">${s.name}</span><span class="st"></span></li>`).join('');
  $('satlist').querySelectorAll('li').forEach((li) => li.addEventListener('click', (e) => { if (e.target.tagName === 'INPUT') return; selectSat(SATS[+li.dataset.i]); }));
  $('satlist').querySelectorAll('input').forEach((cb) => {
    cb.addEventListener('click', (e) => e.stopPropagation());
    cb.addEventListener('change', (e) => { SATS[+cb.dataset.v].visible = e.target.checked; });
  });
  updateSatBadges();
}
function updateSatBadges() { // 교신·저장 표시만 갱신 (체크박스는 건드리지 않음)
  $('satlist').querySelectorAll('li').forEach((li) => {
    const s = SATS[+li.dataset.i]; if (!s) return;
    const inC = contactStations(s, S.t).length > 0;
    const html = (inC ? '<span class="badge">교신</span>' : '') + (s.store.length ? `<span class="badge2">${s.store.length}</span>` : '');
    const st = li.querySelector('.st'); if (st.innerHTML !== html) st.innerHTML = html;
  });
}
function renderSelInfo() {
  const s = S.sel, g = geo(s, S.t); if (!g) return;
  const cs = contactStations(s, S.t);
  const el = elevation(s, S.station, S.t);
  $('selinfo').innerHTML = `
    <div class="selname" style="color:${s.color}">${s.name}</div>
    <div class="sub">${s.sensor.label} · 해상도 ${s.sensor.gsd}</div>
    <dl>
      <dt>위치</dt><dd>${Math.abs(g.lat).toFixed(2)}°${g.lat >= 0 ? 'N' : 'S'} ${Math.abs(g.lon).toFixed(2)}°${g.lon >= 0 ? 'E' : 'W'}</dd>
      <dt>고도</dt><dd>${fmt(g.alt)} km</dd>
      <dt>속도</dt><dd>${g.speed.toFixed(2)} km/s</dd>
      <dt>궤도</dt><dd>${s.kind === 'geo' ? '정지궤도' : s.kind === 'tle' ? 'TLE (실제)' : `태양동기 · 경사 ${s.inc.toFixed(1)}°`}</dd>
      <dt>일조</dt><dd>${s.kind !== 'geo' && inEclipse(g, S.t) ? '지구 그림자' : '햇빛'}</dd>
      <dt>${S.station.name}</dt><dd class="${el > MIN_EL ? 'good' : ''}">고도각 ${el.toFixed(1)}°</dd>
      <dt>교신</dt><dd class="${cs.length ? 'good' : ''}">${cs.length ? cs.map((c) => c.name).join(', ') : '없음'}</dd>
      <dt>저장 데이터</dt><dd>${fmt(s.store.reduce((a, x) => a + x.remain, 0))} MB</dd>
    </dl>
    <div class="src">${s.kind === 'tle' ? '위치: TLE + SGP4 계산' : '위치: 근사 궤도요소 (실제 위치는 TLE 불러오기)'}</div>`;
}
function renderPasses() {
  const s = S.sel, st = S.station;
  const ps = predictPasses(s, st, S.t, 24);
  if (ps[0] && ps[0].geo) { $('passes').innerHTML = `<tr><td colspan="4">정지궤도 위성 — ${st.name}에서 고도각 ${ps[0].el.toFixed(1)}°로 ${ps[0].el > MIN_EL ? '<b class="good">항상 교신 가능</b>' : '보이지 않음'}</td></tr>`; return; }
  $('passes').innerHTML = ps.length ? ps.map((p) => `<tr><td>${KST_S.format(new Date(p.aos))}</td><td>${KST_S.format(new Date(p.los)).slice(-5)}</td><td>${Math.round((p.los - p.aos) / 60000)}분</td><td>${p.max.toFixed(0)}°</td></tr>`).join('') : '<tr><td colspan="4">24시간 안에 통과 없음</td></tr>';
}
function renderTargetUI() {
  const t = S.sel.sensor.type;
  const needT = t === 'optical' || t === 'sar';
  $('targetrow').classList.toggle('hidden', !needT);
  $('cmdlabel').textContent = { optical: '광학 촬영 예약', sar: 'SAR 촬영 예약 (밤·구름에도 가능)', weather: '전구 기상 관측 (10분 간격)', ocean: '한반도 주변 해양 관측 (낮 시간)', aurora: '오로라·대기광 관측 (고위도 밤)' }[t];
  renderTargetInfo();
}
function renderTargetInfo() {
  const v = $('target').value;
  $('targetinfo').textContent = v === 'map' ? (pendingTarget ? pendingTarget.name : '지도를 클릭해 지점을 고르세요') : '';
}
function renderTasks() {
  $('tasks').innerHTML = S.tasks.slice(0, 30).map((tk) => {
    const cls = tk.status === '수신 완료' ? 'good' : tk.status === '기회 없음' ? 'warn' : tk.status.startsWith('다운링크') ? 'acc' : '';
    const extra = tk.status === '촬영 예약' ? `<div class="sub">예정 ${KST_S.format(new Date(tk.exec))} · 남은 ${fmtDur(tk.exec - S.t)}</div>` : tk.status === '다운링크 중' ? `<div class="pbar"><i style="width:${(tk.progress * 100).toFixed(0)}%"></i></div>` : '';
    return `<li><div><b>#${tk.id}</b> ${tk.sat.name} · ${tk.kind}${tk.target ? ' · ' + tk.target.name : ''}</div><div class="${cls}">${tk.status}</div>${extra}</li>`;
  }).join('') || '<li class="sub">아직 명령이 없습니다.</li>';
}
function fmtDur(ms) { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; }
function renderGallery() {
  $('gallery').innerHTML = S.gallery.map((tk, i) => `<figure data-i="${i}"><img src="${tk.img}" alt="${tk.kind}"><figcaption>#${tk.id} ${tk.sat.name.replace(/ \(.*\)/, '')}<br>${tk.target ? tk.target.name : tk.kind}</figcaption></figure>`).join('') || '<p class="sub">수신된 영상이 없습니다. 명령 탭에서 촬영을 예약하세요.</p>';
  $('gallery').querySelectorAll('figure').forEach((f) => f.addEventListener('click', () => openViewer(S.gallery[+f.dataset.i])));
  $('tab-data-count').textContent = S.gallery.length ? ` (${S.gallery.length})` : '';
}
function openViewer(tk) {
  const s = tk.sat, m = tk.meta;
  $('v-img').src = tk.img;
  $('v-title').textContent = `#${tk.id} ${s.name} · ${tk.kind}`;
  const rows = [
    ['촬영 시각', KST.format(new Date(tk.exec)) + ' KST'],
    ['센서', `${s.sensor.label} · ${s.sensor.gsd}`],
    tk.target ? ['목표', `${tk.target.name} (${tk.target.lat.toFixed(2)}°, ${tk.target.lon.toFixed(2)}°)`] : null,
    ['위성 위치', `${m.satLat.toFixed(2)}°, ${m.satLon.toFixed(2)}° · 고도 ${fmt(m.alt)} km`],
    tk.offNadir !== undefined && tk.target ? ['기울임 각(Off-nadir)', tk.offNadir.toFixed(1) + '°'] : null,
    m.sunEl !== undefined ? ['태양 고도각', m.sunEl.toFixed(1) + '°'] : null,
    m.sceneKm ? ['장면 폭', `약 ${m.sceneKm} km`] : null,
    m.auroraLat ? ['관측 위도', m.auroraLat.toFixed(1) + '°'] : null,
    ['처리 단계', 'Level 1 (방사·기하 보정 전 모의 영상)'],
  ].filter(Boolean);
  $('v-meta').innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  $('viewer').classList.remove('hidden');
}
$('v-close').addEventListener('click', () => $('viewer').classList.add('hidden'));
$('viewer').addEventListener('click', (e) => { if (e.target.id === 'viewer') $('viewer').classList.add('hidden'); });

// 텔레메트리 탭
function renderTelemetry(force) {
  const s = S.sel, hk = s.hk, last = hk[hk.length - 1];
  const inC = contactStations(s, S.t).length > 0;
  $('tm-status').innerHTML = inC ? '<span class="good">● 실시간 수신 중</span>' : last ? `<span class="warn">○ 교신 없음 · 마지막 수신 ${KST_S.format(new Date(last.t))}</span>` : '<span class="warn">○ 아직 수신한 텔레메트리 없음 — 교신(AOS)을 기다리세요</span>';
  if (!last) { $('tm-table').innerHTML = ''; drawTM(); return; }
  const rows = [
    ['배터리 전압', last.vbat.toFixed(2) + ' V'], ['배터리 잔량', last.soc.toFixed(1) + ' %'], ['태양전지 전류', last.isolar.toFixed(2) + ' A'],
    ['외판 온도', last.tpanel.toFixed(1) + ' ℃'], ['컴퓨터 온도', last.tobc.toFixed(1) + ' ℃'], ['자세 모드', last.mode],
    ['휠 X/Y/Z', last.rw.join(' / ') + ' rpm'], ['자기장 세기', fmt(last.bmag) + ' nT'], ['저장 데이터', fmt(last.storeMB) + ' MB'],
    ['일조', last.eclipse ? '지구 그림자' : '햇빛'],
  ];
  if (last.airglow !== undefined) rows.push(['대기광 밝기', fmt(last.airglow) + ' R (모의)'], ['전자 밀도', last.ne + ' ×10⁴/cm³ (모의)']);
  $('tm-table').innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  drawTM();
}
function drawTM() {
  const c = $('tm-chart'), g = c.getContext('2d'), W = c.width, H = c.height; g.clearRect(0, 0, W, H);
  const hk = S.sel.hk; if (hk.length < 2) { g.fillStyle = '#8ea0bb'; g.font = '20px "Noto Sans KR"'; g.fillText('교신 중 수신한 데이터가 여기에 그려집니다', 20, H / 2); return; }
  const t0 = hk[0].t, t1 = hk[hk.length - 1].t, X = (t) => 10 + (t - t0) / Math.max(1, t1 - t0) * (W - 20);
  const series = [['vbat', 6.5, 8.4, '#69db7c', '전압'], ['tpanel', -30, 40, '#ffa94d', '외판 온도'], ['isolar', 0, S.sel.kind === 'geo' ? 20 : 4, '#ffd43b', '태양전지 전류']];
  if (hk[0].airglow !== undefined) series.push(['airglow', 0, 2800, '#63e6be', '대기광']);
  series.forEach(([k, lo, hi, col]) => {
    g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath();
    let prevT = null;
    hk.forEach((p, i) => { const y = H - 26 - (clamp(p[k], lo, hi) - lo) / (hi - lo) * (H - 40); if (i === 0 || p.t - prevT > 60000) g.moveTo(X(p.t), y); else g.lineTo(X(p.t), y); prevT = p.t; });
    g.stroke();
  });
  g.font = '18px "Noto Sans KR"'; let lx = 10; series.forEach(([, , , col, name]) => { g.fillStyle = col; g.fillRect(lx, H - 16, 14, 4); g.fillStyle = '#c5d1e3'; g.fillText(name, lx + 18, H - 8); lx += g.measureText(name).width + 40; });
}

function renderLog() { $('log').innerHTML = S.log.slice(0, 40).map((l) => `<div class="${l.cls}"><span>${KST_S.format(new Date(l.t))}</span> ${l.msg}</div>`).join(''); }

// 탭
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('hidden', x.id !== b.dataset.tab));
}));
// 컨트롤
document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => { S.speed = +b.dataset.speed; S.paused = false; $('play').textContent = '⏸'; updSpeed(); }));
function updSpeed() { document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', +b.dataset.speed === S.speed)); }
$('play').addEventListener('click', () => { S.paused = !S.paused; $('play').textContent = S.paused ? '▶' : '⏸'; });
$('now').addEventListener('click', () => { S.t = Date.now(); S.speed = 1; updSpeed(); SATS.forEach((s) => { s.track = null; }); renderPasses(); });
$('skip').addEventListener('click', () => {
  const s = S.sel; if (s.kind === 'geo') { log('정지궤도 위성은 항상 교신 중입니다'); return; }
  const ps = predictPasses(s, S.station, S.t + 1000, 30); if (!ps.length) return;
  const target = ps[0].aos - 30000;
  while (S.t < target) step(Math.min(20, (target - S.t) / 1000));
  log(`다음 교신 직전으로 이동 · ${S.sel.name} ↔ ${S.station.name}`);
  renderPasses();
});
$('station').innerHTML = STATIONS.map((st, i) => `<option value="${i}">${st.name}</option>`).join('');
$('station').addEventListener('change', (e) => { S.station = STATIONS[+e.target.value]; renderPasses(); renderSelInfo(); });
$('target').innerHTML = TARGETS.map((t, i) => `<option value="${i}">${t[0]}</option>`).join('') + '<option value="map">지도에서 클릭한 지점</option>';
$('target').addEventListener('change', renderTargetInfo);
$('cmd-add').addEventListener('click', addTask);
$('instant').addEventListener('change', (e) => { S.instant = e.target.checked; log(S.instant ? '실습 모드: 교신 없이 즉시 업링크' : '실제 운용 모드: 교신 때만 업링크'); });
$('t-tracks').addEventListener('change', (e) => { S.showTracks = e.target.checked; });
$('t-names').addEventListener('change', (e) => { S.showNames = e.target.checked; });
// TLE
$('tle-open').addEventListener('click', () => $('tle-dlg').classList.remove('hidden'));
$('tle-cancel').addEventListener('click', () => $('tle-dlg').classList.add('hidden'));
$('tle-add').addEventListener('click', () => {
  const lines = $('tle-text').value.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim());
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('1 ') && lines[i + 1] && lines[i + 1].startsWith('2 ')) {
      const name = i > 0 && !/^[12] /.test(lines[i - 1]) ? lines[i - 1].trim() : 'NORAD ' + lines[i].slice(2, 7);
      const satrec = satellite.twoline2satrec(lines[i], lines[i + 1]); i++;
      if (satrec.error) continue;
      // 이름이 같은 기본 위성이 있으면 TLE로 바꾼다
      const kn = Object.entries({ 'KOMPSAT-3A': 'k3a', 'KOMPSAT-5': 'k5', 'CAS500-1': 'cas1', 'CAS500-3': 'cas3', 'GEO-KOMPSAT-2A': 'gk2a', 'GEO-KOMPSAT-2B': 'gk2b' }).find(([k]) => name.toUpperCase().includes(k));
      let s = kn ? SATS.find((x) => x.id === kn[1]) : null;
      if (!s) { s = { id: 'tle' + satrec.satnum, name, sensor: { type: 'optical', label: '광학 (가정)', gsd: '—', scene: 25, reach: 30 }, rate: 100, color: '#69db7c', soc: 0.8, tPanel: 10, store: [], hk: [], lastHK: 0, visible: true }; SATS.push(s); }
      s.kind = 'tle'; s.satrec = satrec; s.track = null; s.alt = (MU / (satrec.no / 60) ** 2) ** (1 / 3) - RE; s.inc = satrec.inclo / DEG; n++;
    }
  }
  $('tle-msg').textContent = n ? `${n}기를 실제 궤도(TLE)로 바꾸거나 추가했습니다.` : '읽을 수 있는 TLE가 없습니다.';
  renderSatList(); renderSelInfo(); renderPasses();
});

// =====================================================================
// 루프
// =====================================================================
SATS.forEach((s) => { s.visible = true; });
let last = performance.now(), ui = 0;
function frame(now) {
  const dt = Math.min(0.2, (now - last) / 1000); last = now;
  if (!S.paused) { let sim = dt * S.speed; while (sim > 0) { const d = Math.min(10, sim); step(d); sim -= d; } }
  drawMap();
  if (++ui % 10 === 0) {
    $('clock').textContent = KST.format(new Date(S.t)) + ' KST';
    $('utc').textContent = new Date(S.t).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const off = (S.t - Date.now()) / 3600e3; $('offset').textContent = Math.abs(off) < 0.02 ? '현재 시각' : `현재 ${off > 0 ? '+' : ''}${off.toFixed(1)}시간`;
    renderSelInfo(); renderTelemetry(); updateSatBadges();
    if (ui % 60 === 0) { renderPasses(); renderTasks(); }
  }
  requestAnimationFrame(frame);
}
addEventListener('resize', sizeMap);
sizeMap(); selectSat(SATS[0]); renderTasks(); renderGallery(); updSpeed();
log('GCS 시작 · 대한민국 위성 13기 추적 (근사 궤도) · 지상국 4곳');
requestAnimationFrame(frame);
