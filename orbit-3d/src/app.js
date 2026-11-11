import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as satellite from 'satellite.js';
import { feature, mesh } from 'topojson-client';
import land50 from 'world-atlas/land-50m.json';
import countries110 from 'world-atlas/countries-110m.json';

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------
const RE = 6378.137;            // 지구 적도 반지름 km
const MU = 398600.4418;         // 지구 중력 상수 km^3/s^2
const J2 = 1.08263e-3;
const DEG = Math.PI / 180;
const SCALE = 1 / RE;           // 3D 단위: 지구 반지름 = 1

// ---------------------------------------------------------------------------
// 기본 위성 데이터 (공개 궤도 정보 기반 근사값)
// type: 'kep' = 케플러 궤도요소, 'geo' = 정지궤도 경도
// ---------------------------------------------------------------------------
const GROUPS = {
  station: { name: '우주정거장·우주망원경', color: 0xffd166 },
  korea:   { name: '대한민국 위성', color: 0xff5d73 },
  geo:     { name: '정지궤도 위성', color: 0x7bdff2 },
  gps:     { name: 'GPS 항법위성 (24기 기준 배치)', color: 0x9b8cff },
  heo:     { name: '타원궤도 예시', color: 0xffa94d },
  starlink:{ name: '스타링크 궤도 모식 (설계 궤도면 기반)', color: 0xcfd8e3 },
  tle:     { name: '사용자 TLE (실제 실시간 위치)', color: 0x6dffa8 },
};

function sso(altKm) { // 태양동기궤도 경사각 계산
  const a = RE + altKm;
  const n = Math.sqrt(MU / a ** 3);
  const needed = 2 * Math.PI / (365.2422 * 86400); // rad/s
  const cosi = -needed / (1.5 * n * J2 * (RE / a) ** 2);
  return Math.acos(cosi) / DEG;
}

const BASE = [
  { name: '국제우주정거장 (ISS)', group: 'station', alt: 415, inc: 51.64, raan: 120, m0: 10,
    note: '사람이 사는 가장 큰 인공위성. 약 92분마다 지구를 한 바퀴 돈다.' },
  { name: '톈궁 우주정거장 (중국)', group: 'station', alt: 385, inc: 41.47, raan: 30, m0: 200,
    note: '중국의 우주정거장.' },
  { name: '허블 우주망원경', group: 'station', alt: 505, inc: 28.47, raan: 250, m0: 90,
    note: '1990년 발사된 우주망원경. 대기 끌림으로 고도가 서서히 낮아지고 있다.' },

  { name: '차세대중형위성 3호', group: 'korea', alt: 601, inc: sso(601), raan: 200, m0: 30,
    note: '누리호 4차(2025.11)로 발사. 오로라·대기광 관측으로 우주날씨 연구.' },
  { name: '초소형군집위성 1호 (네온샛)', group: 'korea', alt: 520, inc: sso(520), raan: 95, m0: 0,
    note: '초소형 지구관측 군집위성. 여러 대가 함께 같은 지역을 자주 촬영.' },
  ...[2, 3, 4, 5, 6].map((k, j) => ({
    name: `초소형군집위성 ${k}호 (네온샛)`, group: 'korea', alt: 510, inc: sso(510), raan: 95, m0: 60 + j * 14,
    note: '누리호 5차(2026.10)로 5기가 동시에 투입된 군집위성.' })),
  { name: '아리랑 3A호', group: 'korea', alt: 528, inc: sso(528), raan: 110, m0: 160,
    note: '고해상도 광학·적외선 지구관측 위성.' },
  { name: '아리랑 5호', group: 'korea', alt: 550, inc: sso(550), raan: 20, m0: 250,
    note: '영상레이더(SAR) 위성 — 구름·밤에도 관측 가능.' },
  { name: '차세대중형위성 1호', group: 'korea', alt: 497, inc: sso(497), raan: 115, m0: 300,
    note: '국토·자원 관리용 정밀 지상관측 위성.' },

  { name: '천리안 2A호', group: 'geo', geoLon: 128.2, note: '한국 정지궤도 기상위성 (동경 128.2°).', korea: true },
  { name: '천리안 2B호', group: 'geo', geoLon: 128.25, note: '한국 정지궤도 해양·환경 관측위성.', korea: true },
  { name: '무궁화 5A호', group: 'geo', geoLon: 113, note: '한국 통신·방송 위성 (동경 113°).', korea: true },
  { name: '무궁화 6A호', group: 'geo', geoLon: 116, note: '한국 통신·방송 위성 (동경 116°).', korea: true },
  { name: '히마와리 9호 (일본)', group: 'geo', geoLon: 140.7, note: '일본 정지궤도 기상위성.' },
  { name: 'GOES-East (미국)', group: 'geo', geoLon: -75.2, note: '미국 정지궤도 기상위성.' },
  { name: 'GOES-West (미국)', group: 'geo', geoLon: -137.2, note: '미국 정지궤도 기상위성.' },
  { name: 'Meteosat (유럽)', group: 'geo', geoLon: 0, note: '유럽 정지궤도 기상위성.' },
  { name: 'Insat-3D (인도)', group: 'geo', geoLon: 82, note: '인도 정지궤도 기상위성.' },

  { name: '몰니야 궤도 예시', group: 'heo', a: 26554, e: 0.72, inc: 63.4, raan: 140, argp: 270, m0: 180,
    note: '러시아 고위도 통신용 타원궤도. 북반구 상공에 오래 머문다 (주기 약 12시간).' },
  { name: '정지천이궤도(GTO) 예시', group: 'heo', a: (RE + 250 + RE + 35786) / 2, e: (35786 - 250) / (2 * RE + 250 + 35786), inc: 7, raan: 0, argp: 180, m0: 0,
    note: '정지궤도로 가기 전 거치는 타원궤도 (근지점 250 km, 원지점 35,786 km).' },
];

// GPS 24기 기준 배치: 6개 궤도면 (A~F), 경사 55°, 고도 20,180 km
'ABCDEF'.split('').forEach((p, pi) => {
  for (let s = 0; s < 4; s++) {
    BASE.push({ name: `GPS ${p}${s + 1}`, group: 'gps', alt: 20180, inc: 55, raan: pi * 60, m0: s * 90 + pi * 15,
      note: 'GPS 위성. 지구 어디서나 최소 4기가 보이도록 6개 궤도면에 배치.' });
  }
});

// ---------------------------------------------------------------------------
// 시간·천문 계산
// ---------------------------------------------------------------------------
function gmst(date) { return satellite.gstime(date); }
function sunEci(date) { // 저정밀 태양 위치 (단위벡터, ECI)
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) * DEG;
  const g = (357.528 + 0.9856003 * n) * DEG;
  const lam = L + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;
  const eps = (23.439 - 0.0000004 * n) * DEG;
  return new THREE.Vector3(Math.cos(lam), Math.cos(eps) * Math.sin(lam), Math.sin(eps) * Math.sin(lam));
}
// ECI/ECEF (x,y,z, z=북극) → three.js 좌표 (x, z, -y)
function toThree(x, y, z, out = new THREE.Vector3()) { return out.set(x * SCALE, z * SCALE, -y * SCALE); }

// ---------------------------------------------------------------------------
// 케플러 전파 (J2 섭동에 의한 RAAN·근지점 회전 포함)
// ---------------------------------------------------------------------------
const EPOCH = Date.UTC(2026, 10, 1, 0, 0, 0); // 위상 기준 시각
function initKep(s) {
  if (s.geoLon !== undefined) { s.kind = 'geo'; s.a = 42164.17; s.e = 0; s.inc = 0; return; }
  s.kind = 'kep';
  if (!s.a) s.a = RE + s.alt;
  s.e = s.e || 0; s.argp = s.argp || 0;
  s.n = Math.sqrt(MU / s.a ** 3);
  const p = s.a * (1 - s.e * s.e);
  const k = 1.5 * J2 * (RE / p) ** 2 * s.n;
  s.raanDot = -k * Math.cos(s.inc * DEG);
  s.argpDot = k * (2 - 2.5 * Math.sin(s.inc * DEG) ** 2);
  s.period = 2 * Math.PI / s.n;
}
function solveKepler(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 12; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}
function kepState(s, tMs) { // ECI 위치/속도 km, km/s
  if (s.kind === 'geo') {
    const date = new Date(tMs);
    const th = gmst(date) + s.geoLon * DEG;
    const r = s.a, w = 7.2921159e-5;
    return { r: [r * Math.cos(th), r * Math.sin(th), 0], v: [-r * w * Math.sin(th), r * w * Math.cos(th), 0] };
  }
  const dt = (tMs - EPOCH) / 1000;
  const M = (s.m0 * DEG + s.n * dt) % (2 * Math.PI);
  const E = solveKepler(M, s.e);
  const cosE = Math.cos(E), sinE = Math.sin(E);
  const xp = s.a * (cosE - s.e), yp = s.a * Math.sqrt(1 - s.e * s.e) * sinE;
  const rr = s.a * (1 - s.e * cosE);
  const vfac = Math.sqrt(MU * s.a) / rr;
  const vxp = -vfac * sinE, vyp = vfac * Math.sqrt(1 - s.e * s.e) * cosE;
  const O = s.raan * DEG + s.raanDot * dt, w = s.argp * DEG + s.argpDot * dt, i = s.inc * DEG;
  const cO = Math.cos(O), sO = Math.sin(O), cw = Math.cos(w), sw = Math.sin(w), ci = Math.cos(i), si = Math.sin(i);
  const R11 = cO * cw - sO * sw * ci, R12 = -cO * sw - sO * cw * ci;
  const R21 = sO * cw + cO * sw * ci, R22 = -sO * sw + cO * cw * ci;
  const R31 = sw * si, R32 = cw * si;
  return { r: [R11 * xp + R12 * yp, R21 * xp + R22 * yp, R31 * xp + R32 * yp],
           v: [R11 * vxp + R12 * vyp, R21 * vxp + R22 * vyp, R31 * vxp + R32 * vyp] };
}
function tleState(s, tMs) {
  const pv = satellite.propagate(s.satrec, new Date(tMs));
  if (!pv || !pv.position) return null;
  const p = pv.position, v = pv.velocity;
  return { r: [p.x, p.y, p.z], v: [v.x, v.y, v.z] };
}
function stateOf(s, tMs) { return s.kind === 'tle' ? tleState(s, tMs) : kepState(s, tMs); }
function eciToGeodetic(r, tMs) {
  const g = satellite.eciToGeodetic({ x: r[0], y: r[1], z: r[2] }, gmst(new Date(tMs)));
  return { lat: g.latitude / DEG, lon: ((g.longitude / DEG + 540) % 360) - 180, alt: g.height };
}

// ---------------------------------------------------------------------------
// 장면 구성
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02040a);
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 2000);
camera.position.set(2.2, 1.4, 3.2);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.minDistance = 1.15; controls.maxDistance = 40;

// 별 배경
{
  const n = 4000, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, r = 600;
    const s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0.7 })));
}

// 지구 텍스처 (world-atlas 지도 데이터를 캔버스에 그려 만듦)
function makeEarthTexture() {
  const W = 4096, H = 2048;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0d2a4a'); grad.addColorStop(0.5, '#123c66'); grad.addColorStop(1, '#0d2a4a');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const px = (lon) => (lon + 180) / 360 * W, py = (lat) => (90 - lat) / 180 * H;
  const drawRing = (ring) => {
    let prev = null;
    ring.forEach(([lon, lat], i) => {
      const x = px(lon), y = py(lat);
      if (i === 0 || (prev && Math.abs(x - prev) > W / 2)) g.moveTo(x, y); else g.lineTo(x, y);
      prev = x;
    });
    g.closePath();
  };
  const land = feature(land50, land50.objects.land);
  g.beginPath();
  land.features.forEach((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    polys.forEach((poly) => poly.forEach(drawRing));
  });
  g.fillStyle = '#3f6b4a'; g.fill('evenodd');
  g.strokeStyle = 'rgba(200,230,200,0.55)'; g.lineWidth = 1.2; g.stroke();
  // 국경선
  const borders = mesh(countries110, countries110.objects.countries, (a, b) => a !== b);
  g.beginPath(); borders.coordinates.forEach((line) => {
    let prev = null; line.forEach(([lon, lat], i) => { const x = px(lon), y = py(lat);
      if (i === 0 || (prev && Math.abs(x - prev) > W / 2)) g.moveTo(x, y); else g.lineTo(x, y); prev = x; });
  });
  g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1; g.stroke();
  // 경위선
  g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 30) { g.beginPath(); g.moveTo(px(lon), 0); g.lineTo(px(lon), H); g.stroke(); }
  for (let lat = -60; lat <= 60; lat += 30) { g.beginPath(); g.moveTo(0, py(lat)); g.lineTo(W, py(lat)); g.stroke(); }
  g.strokeStyle = 'rgba(255,220,120,0.35)'; g.beginPath(); g.moveTo(0, py(0)); g.lineTo(W, py(0)); g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}
const earthGroup = new THREE.Group(); // 지구 자전 (ECEF 좌표계)
scene.add(earthGroup);
const earth = new THREE.Mesh(
  new THREE.SphereGeometry(1, 128, 64),
  new THREE.MeshPhongMaterial({ map: makeEarthTexture(), shininess: 12, specular: 0x222222 })
);
earthGroup.add(earth);
// 대기 테두리
earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1.015, 96, 48),
  new THREE.MeshBasicMaterial({ color: 0x4aa3ff, transparent: true, opacity: 0.08, side: THREE.BackSide })));
// 자전축
{
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1.35, 0), new THREE.Vector3(0, 1.35, 0)]);
  scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x8899aa, transparent: true, opacity: 0.4 })));
}

function geoToEcefThree(latDeg, lonDeg, rEarth = 1.003) {
  const la = latDeg * DEG, lo = lonDeg * DEG;
  return toThree(Math.cos(la) * Math.cos(lo) * RE * rEarth, Math.cos(la) * Math.sin(lo) * RE * rEarth, Math.sin(la) * RE * rEarth);
}
// 지상 지점 표시
const PLACES = [
  { name: '부산', lat: 35.18, lon: 129.08 },
  { name: '나로우주센터', lat: 34.43, lon: 127.53 },
  { name: '서울', lat: 37.57, lon: 126.98 },
];
PLACES.forEach((p) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
  m.position.copy(geoToEcefThree(p.lat, p.lon)); earthGroup.add(m); p.mesh = m;
});

const ambient = new THREE.AmbientLight(0xffffff, 0.35); scene.add(ambient);
const sunLight = new THREE.DirectionalLight(0xffffff, 1.6); scene.add(sunLight);

// 궤도 영역 껍질
const shells = new THREE.Group(); scene.add(shells);
[{ alt: 2000, c: 0x66ccff, label: 'LEO 상한 2,000 km' }, { alt: 20180, c: 0x9b8cff, label: 'MEO (GPS) 20,180 km' }, { alt: 35786, c: 0x7bdff2, label: 'GEO 35,786 km' }]
  .forEach((s) => {
    const r = (RE + s.alt) * SCALE;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.004 * r, r + 0.004 * r, 256),
      new THREE.MeshBasicMaterial({ color: s.c, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    ring.rotation.x = Math.PI / 2; shells.add(ring);
    const sph = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 32),
      new THREE.MeshBasicMaterial({ color: s.c, transparent: true, opacity: 0.035, depthWrite: false }));
    shells.add(sph);
  });
shells.visible = false;

// ---------------------------------------------------------------------------
// 위성 객체
// ---------------------------------------------------------------------------
const sats = [];
const satGroup = new THREE.Group(); scene.add(satGroup);
const orbitGroup = new THREE.Group(); scene.add(orbitGroup);
const labelLayer = document.getElementById('labels');
const sphereGeo = new THREE.SphereGeometry(1, 12, 12);

function addSat(s) {
  if (s.kind !== 'tle') initKep(s);
  const col = new THREE.Color(s.korea ? GROUPS.korea.color : GROUPS[s.group].color);
  s.color = col;
  s.mesh = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: col }));
  s.mesh.userData.sat = s;
  satGroup.add(s.mesh);
  s.label = document.createElement('div');
  s.label.className = 'label'; s.label.textContent = s.name.replace(/ \(.*\)$/, '');
  s.label.style.color = '#' + col.getHexString();
  labelLayer.appendChild(s.label);
  s.orbit = null;
  sats.push(s);
  return s;
}
BASE.forEach(addSat);

function buildOrbitLine(s, tMs) {
  if (s.orbit) { orbitGroup.remove(s.orbit); s.orbit.geometry.dispose(); }
  const pts = [];
  if (s.kind === 'geo') {
    for (let k = 0; k <= 256; k++) { const th = k / 256 * Math.PI * 2; pts.push(toThree(s.a * Math.cos(th), s.a * Math.sin(th), 0)); }
  } else {
    const per = s.kind === 'tle' ? (2 * Math.PI / s.satrec.no) * 60 : s.period; // TLE no: rad/min
    const N = 300;
    for (let k = 0; k <= N; k++) {
      const st = stateOf(s, tMs + per * 1000 * k / N);
      if (st) pts.push(toThree(...st.r));
    }
  }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  s.orbit = new THREE.Line(g, new THREE.LineBasicMaterial({ color: s.color, transparent: true, opacity: 0.45 }));
  s.orbit.userData.builtAt = tMs;
  orbitGroup.add(s.orbit);
}

// 스타링크 모식 (공개된 설계 궤도 껍질 기반, 개별 위성의 실제 위치 아님)
const STARLINK_SHELLS = [
  { alt: 550, inc: 53.0, planes: 72, per: 22 },
  { alt: 540, inc: 53.2, planes: 72, per: 22 },
  { alt: 570, inc: 70.0, planes: 36, per: 20 },
  { alt: 560, inc: 97.6, planes: 6, per: 58 },
  { alt: 530, inc: 43.0, planes: 28, per: 54 },
];
const starlink = [];
STARLINK_SHELLS.forEach((sh, si) => {
  const a = RE + sh.alt, n = Math.sqrt(MU / a ** 3);
  for (let p = 0; p < sh.planes; p++) for (let k = 0; k < sh.per; k++) {
    starlink.push({ a, n, inc: sh.inc * DEG, raan: (p / sh.planes) * 2 * Math.PI + si * 0.3,
      m0: (k / sh.per) * 2 * Math.PI + p * (2 * Math.PI / sh.per) * 0.37 });
  }
});
const starPos = new Float32Array(starlink.length * 3);
const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starPoints = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: GROUPS.starlink.color, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.8 }));
starPoints.visible = false; scene.add(starPoints);
const tmpV = new THREE.Vector3();
function updateStarlink(tMs) {
  const dt = (tMs - EPOCH) / 1000;
  for (let i = 0; i < starlink.length; i++) {
    const s = starlink[i], u = s.m0 + s.n * dt;
    const cu = Math.cos(u), su = Math.sin(u), cO = Math.cos(s.raan), sO = Math.sin(s.raan), ci = Math.cos(s.inc), si = Math.sin(s.inc);
    toThree(s.a * (cO * cu - sO * su * ci), s.a * (sO * cu + cO * su * ci), s.a * su * si, tmpV);
    starPos[i * 3] = tmpV.x; starPos[i * 3 + 1] = tmpV.y; starPos[i * 3 + 2] = tmpV.z;
  }
  starGeo.attributes.position.needsUpdate = true;
}

// 지상궤적 (선택 위성)
let groundTrack = null;
function buildGroundTrack(s, tMs) {
  if (groundTrack) { earthGroup.remove(groundTrack); groundTrack.geometry.dispose(); groundTrack = null; }
  if (!s || s.kind === 'geo') return;
  const per = s.kind === 'tle' ? (2 * Math.PI / s.satrec.no) * 60 : s.period;
  const span = Math.min(per * 2, 86400) * 1000;
  const pts = [];
  for (let k = 0; k <= 600; k++) {
    const t = tMs - span * 0.25 + span * k / 600;
    const st = stateOf(s, t); if (!st) continue;
    const g = eciToGeodetic(st.r, t);
    pts.push(geoToEcefThree(g.lat, g.lon, 1.004));
  }
  groundTrack = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  groundTrack.userData.builtAt = tMs;
  earthGroup.add(groundTrack);
}
// 선택 위성 → 지면 연결선
const nadirLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.02, gapSize: 0.015, transparent: true, opacity: 0.7 }));
nadirLine.visible = false; scene.add(nadirLine);
const selRing = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
selRing.visible = false; scene.add(selRing);

// ---------------------------------------------------------------------------
// 상태 & UI
// ---------------------------------------------------------------------------
const state = {
  speed: 60, paused: false, simTime: Date.now(), lastReal: performance.now(),
  layers: { station: true, korea: true, geo: true, gps: true, heo: false, starlink: false, tle: true },
  showOrbits: true, showLabels: true, showShells: false, follow: false, selected: null,
};
const $ = (id) => document.getElementById(id);

function groupVisible(s) {
  if (s.korea && s.group === 'geo') return state.layers.korea || state.layers.geo;
  return state.layers[s.group];
}

function renderLayerUI() {
  const box = $('layers'); box.innerHTML = '';
  Object.entries(GROUPS).forEach(([key, g]) => {
    const count = key === 'starlink' ? starlink.length : sats.filter((s) => s.group === key || (key === 'korea' && s.korea)).length;
    if (key === 'tle' && count === 0) return;
    const row = document.createElement('label'); row.className = 'layer';
    row.innerHTML = `<input type="checkbox" ${state.layers[key] ? 'checked' : ''}><span class="dot" style="background:#${new THREE.Color(g.color).getHexString()}"></span><span>${g.name}</span><span class="cnt">${count}</span>`;
    row.querySelector('input').addEventListener('change', (e) => { state.layers[key] = e.target.checked; refreshVisibility(); renderList(); });
    box.appendChild(row);
  });
}
function renderList() {
  const q = $('search').value.trim().toLowerCase();
  const ul = $('satlist'); ul.innerHTML = '';
  sats.filter((s) => groupVisible(s) && (!q || s.name.toLowerCase().includes(q))).forEach((s) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="dot" style="background:#${s.color.getHexString()}"></span>${s.name}`;
    if (state.selected === s) li.classList.add('on');
    li.addEventListener('click', () => select(s));
    ul.appendChild(li);
  });
}
function refreshVisibility() {
  sats.forEach((s) => {
    const v = groupVisible(s);
    s.mesh.visible = v;
    if (v && state.showOrbits && !s.orbit) buildOrbitLine(s, state.simTime);
    if (s.orbit) s.orbit.visible = v && state.showOrbits;
  });
  starPoints.visible = state.layers.starlink;
  shells.visible = state.showShells;
  if (state.selected && !groupVisible(state.selected)) select(null);
}

function select(s) {
  state.selected = s;
  buildGroundTrack(s, state.simTime);
  selRing.visible = !!s; nadirLine.visible = !!s;
  $('info').classList.toggle('hidden', !s);
  if (s) {
    $('i-name').textContent = s.name;
    $('i-note').textContent = s.note || '';
    $('i-src').textContent = s.kind === 'tle' ? '데이터: 붙여넣은 TLE + SGP4 (실제 위치)' :
      s.kind === 'geo' ? '데이터: 정지궤도 경도 기준 (근사)' : '데이터: 공개 궤도 정보 기반 근사 궤도요소 (위치는 예시)';
  }
  renderList();
}

function orbitClass(altKm, e) {
  if (e > 0.25) return '고타원궤도 (HEO)';
  if (altKm < 2000) return '저궤도 (LEO)';
  if (Math.abs(altKm - 35786) < 300) return '정지궤도 (GEO)';
  if (altKm < 35000) return '중궤도 (MEO)';
  return '고궤도';
}
const fmt = (x, d = 0) => x.toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: d });

function updateInfo(s, st, tMs) {
  const r = Math.hypot(...st.r), v = Math.hypot(...st.v);
  const g = eciToGeodetic(st.r, tMs);
  let inc, e, per;
  if (s.kind === 'tle') { inc = s.satrec.inclo / DEG; e = s.satrec.ecco; per = 2 * Math.PI / s.satrec.no; }
  else { inc = s.inc; e = s.e; per = s.kind === 'geo' ? 1436.07 : s.period / 60; }
  $('i-alt').textContent = fmt(g.alt) + ' km';
  $('i-speed').textContent = fmt(v, 2) + ' km/s';
  $('i-kmh').textContent = fmt(v * 3600) + ' km/h';
  $('i-period').textContent = per >= 120 ? `${fmt(per / 60, 2)} 시간` : `${fmt(per, 1)} 분`;
  $('i-revs').textContent = fmt(1440 / per, 1) + ' 바퀴/일';
  $('i-inc').textContent = fmt(inc, 2) + '°';
  $('i-pos').textContent = `${fmt(Math.abs(g.lat), 2)}°${g.lat >= 0 ? 'N' : 'S'}, ${fmt(Math.abs(g.lon), 2)}°${g.lon >= 0 ? 'E' : 'W'}`;
  $('i-class').textContent = orbitClass(g.alt, e);
  // 원궤도 공식 비교
  $('i-formula').textContent = `√(GM/r) = √(398,600 / ${fmt(r)}) = ${fmt(Math.sqrt(MU / r), 2)} km/s`;
}

function setSpeed(v) { state.speed = v; document.querySelectorAll('.speed button').forEach((b) => b.classList.toggle('on', +b.dataset.v === v)); }
document.querySelectorAll('.speed button').forEach((b) => b.addEventListener('click', () => { setSpeed(+b.dataset.v); state.paused = false; $('play').textContent = '⏸'; }));
$('play').addEventListener('click', () => { state.paused = !state.paused; $('play').textContent = state.paused ? '▶' : '⏸'; });
$('now').addEventListener('click', () => { state.simTime = Date.now(); setSpeed(1); rebuildTimeDependent(); });
$('search').addEventListener('input', renderList);
$('t-orbits').addEventListener('change', (e) => { state.showOrbits = e.target.checked; refreshVisibility(); });
$('t-labels').addEventListener('change', (e) => { state.showLabels = e.target.checked; });
$('t-shells').addEventListener('change', (e) => { state.showShells = e.target.checked; refreshVisibility(); });
$('t-follow').addEventListener('change', (e) => { state.follow = e.target.checked; });
$('i-close').addEventListener('click', () => select(null));
$('panel-toggle').addEventListener('click', () => $('panel').classList.toggle('collapsed'));

// 시점 버튼
const VIEWS = {
  korea: () => { const p = geoToEcefThree(36, 128).applyMatrix4(earthGroup.matrixWorld).normalize().multiplyScalar(2.6); camera.position.copy(p); controls.target.set(0, 0, 0); },
  leo: () => { camera.position.set(1.6, 1.2, 2.2); controls.target.set(0, 0, 0); },
  geo: () => { camera.position.set(9, 6, 13); controls.target.set(0, 0, 0); },
  north: () => { camera.position.set(0, 12, 0.01); controls.target.set(0, 0, 0); },
};
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
  state.follow = false; $('t-follow').checked = false; VIEWS[b.dataset.view]();
}));

// 클릭 선택
const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2();
let downAt = null;
canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  const rect = canvas.getBoundingClientRect();
  mouse.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  // 화면상 가장 가까운 위성 선택 (작은 점도 쉽게 클릭)
  let best = null, bestD = 18;
  const v = new THREE.Vector3();
  sats.forEach((s) => {
    if (!s.mesh.visible) return;
    v.copy(s.mesh.position).project(camera);
    if (v.z > 1) return;
    const sx = (v.x + 1) / 2 * rect.width, sy = (1 - v.y) / 2 * rect.height;
    const d = Math.hypot(sx - (e.clientX - rect.left), sy - (e.clientY - rect.top));
    if (d < bestD && !occluded(s.mesh.position)) { bestD = d; best = s; }
  });
  if (best) select(best);
});
function occluded(p) { // 지구 뒤에 가려졌는지
  const dir = p.clone().sub(camera.position); const len = dir.length(); dir.normalize();
  ray.set(camera.position, dir); ray.far = len;
  return ray.intersectObject(earth).length > 0;
}

// TLE 붙여넣기
$('tle-open').addEventListener('click', () => $('tle-dlg').classList.remove('hidden'));
$('tle-cancel').addEventListener('click', () => $('tle-dlg').classList.add('hidden'));
$('tle-file').addEventListener('change', async (e) => { const f = e.target.files[0]; if (f) $('tle-text').value = await f.text(); });
function parseTLE(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim());
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('1 ') && lines[i + 1] && lines[i + 1].startsWith('2 ')) {
      const prev = i > 0 && !lines[i - 1].startsWith('1 ') && !lines[i - 1].startsWith('2 ') ? lines[i - 1].trim().replace(/^0 /, '') : null;
      out.push({ name: prev || `NORAD ${lines[i].slice(2, 7).trim()}`, l1: lines[i], l2: lines[i + 1] });
      i++;
    }
  }
  return out;
}
function addTLEs(text, quiet) {
  const list = parseTLE(text);
  let ok = 0;
  const limit = 3000;
  list.slice(0, limit).forEach((t) => {
    try {
      const satrec = satellite.twoline2satrec(t.l1, t.l2);
      if (satrec.error) return;
      if (sats.some((s) => s.kind === 'tle' && s.satrec.satnum === satrec.satnum)) return;
      addSat({ name: t.name, group: 'tle', kind: 'tle', satrec,
        note: `NORAD ${satrec.satnum} · TLE 기준일 ${tleEpoch(t.l1)} — 기준일에서 멀어질수록 오차가 커집니다.` });
      ok++;
    } catch (_) { /* 잘못된 줄 무시 */ }
  });
  state.layers.tle = true;
  renderLayerUI(); refreshVisibility(); renderList();
  if (!quiet) $('tle-msg').textContent = ok ? `${ok}기 추가했습니다.${list.length > limit ? ` (최대 ${limit}기까지만)` : ''}` : '읽을 수 있는 TLE가 없습니다. 3줄(이름+1행+2행) 형식인지 확인해 주세요.';
  return ok;
}
function tleEpoch(l1) {
  const yy = +l1.slice(18, 20), day = +l1.slice(20, 32);
  const d = new Date(Date.UTC(yy < 57 ? 2000 + yy : 1900 + yy, 0, 1) + (day - 1) * 86400000);
  return d.toISOString().slice(0, 10);
}
$('tle-add').addEventListener('click', () => {
  const n = addTLEs($('tle-text').value);
  if (n) { try { localStorage.setItem('sat3d-tle', (localStorage.getItem('sat3d-tle') || '') + '\n' + $('tle-text').value); } catch (_) {} }
});
$('tle-clear').addEventListener('click', () => {
  for (let i = sats.length - 1; i >= 0; i--) if (sats[i].kind === 'tle') {
    const s = sats[i]; satGroup.remove(s.mesh); if (s.orbit) orbitGroup.remove(s.orbit); s.label.remove(); sats.splice(i, 1);
    if (state.selected === s) select(null);
  }
  try { localStorage.removeItem('sat3d-tle'); } catch (_) {}
  renderLayerUI(); renderList(); $('tle-msg').textContent = '사용자 TLE를 모두 지웠습니다.';
});
try { const saved = localStorage.getItem('sat3d-tle'); if (saved) addTLEs(saved, true); } catch (_) {}

function rebuildTimeDependent() {
  sats.forEach((s) => { if (s.orbit) buildOrbitLine(s, state.simTime); });
  if (state.selected) buildGroundTrack(state.selected, state.simTime);
}

// ---------------------------------------------------------------------------
// 루프
// ---------------------------------------------------------------------------
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

const KST = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const pTmp = new THREE.Vector3();
let lastOrbitRefresh = 0;

function frame(now) {
  const dtReal = now - state.lastReal; state.lastReal = now;
  if (!state.paused) state.simTime += dtReal * state.speed;
  const t = state.simTime, date = new Date(t);

  earthGroup.rotation.y = gmst(date);
  earthGroup.updateMatrixWorld();
  const sun = sunEci(date);
  toThree(sun.x * 10 * RE, sun.y * 10 * RE, sun.z * 10 * RE, sunLight.position);

  const camDist = camera.position.length();
  const dotSize = THREE.MathUtils.clamp(camDist * 0.0065, 0.006, 0.12);
  const rect = canvas.getBoundingClientRect();

  sats.forEach((s) => {
    if (!s.mesh.visible) { s.label.style.display = 'none'; return; }
    const st = stateOf(s, t);
    if (!st) { s.mesh.visible = false; return; }
    toThree(...st.r, s.mesh.position);
    s.mesh.scale.setScalar(state.selected === s ? dotSize * 1.6 : dotSize);
    s._st = st;
    // 라벨
    const showLbl = state.showLabels && (s.group !== 'gps' && s.group !== 'tle' || state.selected === s || sats.filter((x) => x.group === 'tle').length < 40 && s.group === 'tle');
    if (showLbl) {
      pTmp.copy(s.mesh.position).project(camera);
      if (pTmp.z < 1 && !occludedFast(s.mesh.position)) {
        s.label.style.display = 'block';
        s.label.style.transform = `translate(${(pTmp.x + 1) / 2 * rect.width + 8}px, ${(1 - pTmp.y) / 2 * rect.height - 8}px)`;
        s.label.classList.toggle('sel', state.selected === s);
      } else s.label.style.display = 'none';
    } else s.label.style.display = 'none';
  });
  if (state.layers.starlink) updateStarlink(t);

  // 궤도선·지상궤적 주기적 갱신 (시간이 많이 흘렀을 때)
  if (Math.abs(t - lastOrbitRefresh) > 3 * 3600 * 1000) {
    lastOrbitRefresh = t;
    sats.forEach((s) => { if (s.orbit && s.kind !== 'geo') buildOrbitLine(s, t); });
  }
  const sel = state.selected;
  if (sel && sel._st) {
    if (groundTrack && Math.abs(t - groundTrack.userData.builtAt) > (sel.kind === 'tle' ? (2 * Math.PI / sel.satrec.no) * 60 : sel.period) * 400) buildGroundTrack(sel, t);
    selRing.position.copy(sel.mesh.position); selRing.lookAt(camera.position);
    selRing.scale.setScalar(dotSize);
    const pos = sel.mesh.position.clone();
    nadirLine.geometry.setFromPoints([pos, pos.clone().normalize()]);
    nadirLine.computeLineDistances();
    updateInfo(sel, sel._st, t);
    if (state.follow) {
      const target = pos.clone();
      const offset = camera.position.clone().sub(controls.target);
      controls.target.copy(target);
      camera.position.copy(target).add(offset);
    }
  } else if (!state.follow && controls.target.lengthSq() > 0 && !sel) controls.target.lerp(new THREE.Vector3(), 0.1);

  $('clock').textContent = KST.format(date) + ' KST';
  $('clock-utc').textContent = date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const off = (t - Date.now()) / 3600000;
  $('offset').textContent = Math.abs(off) < 0.01 ? '현재 시각' : `현재보다 ${off > 0 ? '+' : ''}${fmt(off, 1)}시간`;

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
function occludedFast(p) { // 구 교차 판정 (라벨용, 빠름)
  const o = camera.position, d = p.clone().sub(o); const L = d.length(); d.divideScalar(L);
  const b = o.dot(d), c = o.lengthSq() - 1; const disc = b * b - c;
  if (disc < 0) return false; const tHit = -b - Math.sqrt(disc);
  return tHit > 0 && tHit < L;
}

renderLayerUI(); refreshVisibility(); renderList(); setSpeed(60); resize();
requestAnimationFrame(frame);
