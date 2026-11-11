import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { feature } from 'topojson-client';
import land from 'world-atlas/land-110m.json';

// =====================================================================
// 상수 · 수학
// =====================================================================
const RE = 6378.137, MU = 398600.4418, DEG = Math.PI / 180;
const ALT = 500, R_ORB = RE + ALT, N_ORB = Math.sqrt(MU / R_ORB ** 3); // rad/s
const INC = 97.4 * DEG;
const I_SAT = 0.0022;           // kg·m² (1U, 약 1.3 kg)
const TAU_RW = 1.0e-4;          // 리액션휠 최대 토크 N·m
const H_RW = 1.5e-3;            // 리액션휠 최대 각운동량 N·m·s
const I_WHEEL = 2.5e-6;         // 휠 관성 kg·m²
const TAU_MTQ = 2.0e-7;         // 자기토커 최대 토크 (디텀블링)
const KP = 4.4e-5, KD = 4.0e-4;  // PD 제어 이득
const BAT_WH = 20;              // 배터리 용량 Wh
const FACE_W = 2.1;             // 태양전지 한 면 최대 발전 W
const GS = { name: '부산 지상국', lat: 35.18, lon: 129.08 };

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const toThree = (v, out = new THREE.Vector3()) => out.set(v.x, v.z, -v.y); // ECI → three
const Q_ECI2THREE = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1));

function gmst(t) { const jd = t / 86400000 + 2440587.5; return ((280.46061837 + 360.98564736629 * (jd - 2451545)) % 360) * DEG; }
function sunEci(t) {
  const n = t / 86400000 + 2440587.5 - 2451545;
  const L = (280.46 + 0.9856474 * n) * DEG, g = (357.528 + 0.9856003 * n) * DEG;
  const lam = L + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG, eps = 23.439 * DEG;
  return v3(Math.cos(lam), Math.cos(eps) * Math.sin(lam), Math.sin(eps) * Math.sin(lam));
}
function stationEci(t) {
  const th = gmst(t) + GS.lon * DEG, la = GS.lat * DEG;
  return v3(RE * Math.cos(la) * Math.cos(th), RE * Math.cos(la) * Math.sin(th), RE * Math.sin(la));
}
function quatFromAxes(x, y, z) { // 몸체 축(ECI로 표현) → 몸체→ECI 쿼터니언
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

// =====================================================================
// 궤도: 시작 후 약 55분에 부산 상공을 지나도록 궤도면 배치 (태양동기궤도 경사각)
// =====================================================================
const T0 = Date.now();
const PASS_T = T0 + 55 * 60000;
const latB = GS.lat * DEG;
const uPass = Math.PI - Math.asin(Math.sin(latB) / Math.sin(INC)); // 하강 통과
const raBusan = gmst(PASS_T) + GS.lon * DEG;
const RAAN = raBusan - Math.atan2(Math.cos(INC) * Math.sin(uPass), Math.cos(uPass));
const U0 = uPass - N_ORB * (PASS_T - T0) / 1000;
function orbitState(t) {
  const u = U0 + N_ORB * (t - T0) / 1000;
  const cO = Math.cos(RAAN), sO = Math.sin(RAAN), ci = Math.cos(INC), si = Math.sin(INC), cu = Math.cos(u), su = Math.sin(u);
  const r = v3(cO * cu - sO * su * ci, sO * cu + cO * su * ci, su * si).multiplyScalar(R_ORB);
  const vdir = v3(-cO * su - sO * cu * ci, -sO * su + cO * cu * ci, cu * si);
  const v = vdir.multiplyScalar(R_ORB * N_ORB);
  return { r, v };
}
function geodetic(r, t) {
  const lat = Math.asin(r.z / r.length()) / DEG;
  let lon = (Math.atan2(r.y, r.x) - gmst(t)) / DEG;
  lon = ((lon + 540) % 360) - 180;
  return { lat, lon };
}

// =====================================================================
// 렌더러 · 장면
// =====================================================================
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.autoClear = false;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02040a);
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 5000);
camera.position.set(3.2, 2.2, 4.2);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.minDistance = 1.6; controls.maxDistance = 30; controls.enablePan = false;

// 별
{
  const n = 3000, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, s = Math.sqrt(1 - u * u); pos.set([2000 * s * Math.cos(a), 2000 * u, 2000 * s * Math.sin(a)], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false })));
}
const ambient = new THREE.AmbientLight(0x8899bb, 0.28); scene.add(ambient);
const sunLight = new THREE.DirectionalLight(0xfff4e0, 2.2); scene.add(sunLight); scene.add(sunLight.target);
const earthShine = new THREE.DirectionalLight(0x4a7bd0, 0.35); scene.add(earthShine); scene.add(earthShine.target);
// 태양 원반
const sunSprite = new THREE.Mesh(new THREE.SphereGeometry(18, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff1c4 }));
scene.add(sunSprite);

// 지구 텍스처
function earthTexture() {
  const W = 2048, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#123c66'; g.fillRect(0, 0, W, H);
  const px = (lo) => (lo + 180) / 360 * W, py = (la) => (90 - la) / 180 * H;
  g.beginPath();
  feature(land, land.objects.land).features.forEach((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    polys.forEach((poly) => poly.forEach((ring) => { let prev = null; ring.forEach(([lo, la], i) => { const x = px(lo), y = py(la); if (i === 0 || Math.abs(x - prev) > W / 2) g.moveTo(x, y); else g.lineTo(x, y); prev = x; }); g.closePath(); }));
  });
  g.fillStyle = '#4b7552'; g.fill('evenodd');
  g.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let lo = -180; lo <= 180; lo += 30) { g.beginPath(); g.moveTo(px(lo), 0); g.lineTo(px(lo), H); g.stroke(); }
  for (let la = -60; la <= 60; la += 30) { g.beginPath(); g.moveTo(0, py(la)); g.lineTo(W, py(la)); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const EARTH_TEX = earthTexture();

// 근접 장면의 지구 (각크기를 실제와 같게: 반지름 400, 거리 400·r/RE)
const E_R = 400;
const earthNear = new THREE.Group(); scene.add(earthNear);
const earthMeshNear = new THREE.Mesh(new THREE.SphereGeometry(E_R, 128, 64), new THREE.MeshPhongMaterial({ map: EARTH_TEX, shininess: 8 }));
earthNear.add(earthMeshNear);
earthNear.add(new THREE.Mesh(new THREE.SphereGeometry(E_R * 1.012, 96, 48), new THREE.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: 0.12, side: THREE.BackSide })));
const gsMarkerNear = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
earthMeshNear.add(gsMarkerNear);
{
  const la = GS.lat * DEG, lo = GS.lon * DEG;
  gsMarkerNear.position.set(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)).multiplyScalar(E_R * 1.003);
}

// =====================================================================
// 큐브위성 모델 (단위: 1 = 10 cm, 몸체 축 = three 로컬 축)
// =====================================================================
const sat = new THREE.Group(); scene.add(sat);
const parts = [];   // {mesh(es), info, home, explode}
const H = 1.135;    // 1U 높이 113.5 mm

function cellTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c9ccd2'; g.fillRect(0, 0, 256, 256);
  [[16, 16, 224, 106], [16, 134, 224, 106]].forEach(([x, y, w, h]) => {
    const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#1b2a6b'); gr.addColorStop(1, '#0e1640');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(190,200,230,0.55)'; g.lineWidth = 1;
    for (let i = 1; i < 14; i++) { g.beginPath(); g.moveTo(x + i * w / 14, y); g.lineTo(x + i * w / 14, y + h); g.stroke(); }
    g.lineWidth = 3; g.beginPath(); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke();
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const CELL = cellTexture();
function pcbTexture(label, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,220,120,0.6)'; g.lineWidth = 2;
  for (let i = 0; i < 18; i++) { g.beginPath(); const y = 20 + i * 12; g.moveTo(20, y); g.lineTo(80 + (i * 37) % 120, y); g.lineTo(100 + (i * 53) % 130, y + 8); g.stroke(); }
  g.fillStyle = '#111'; g.fillRect(150, 60, 60, 60); g.fillRect(40, 170, 40, 30); g.fillRect(170, 170, 50, 20);
  g.fillStyle = '#ddd'; for (let i = 0; i < 26; i++) g.fillRect(8 + i * 9, 236, 5, 12); // PC/104 핀
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = 'bold 30px sans-serif'; g.fillText(label, 24, 140);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const mat = {
  al: new THREE.MeshStandardMaterial({ color: 0xb9bec7, metalness: 0.85, roughness: 0.35 }),
  alDark: new THREE.MeshStandardMaterial({ color: 0x6b717c, metalness: 0.8, roughness: 0.45 }),
  black: new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.3, roughness: 0.6 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd4a447, metalness: 0.9, roughness: 0.3 }),
  tape: new THREE.MeshStandardMaterial({ color: 0xd8d2c4, metalness: 0.6, roughness: 0.4 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x2a3550, metalness: 0.2, roughness: 0.05, emissive: 0x0a1020 }),
  cell: new THREE.MeshStandardMaterial({ map: CELL, metalness: 0.4, roughness: 0.3, transparent: true }),
};

function addPart(key, objs, info, explode) {
  const g = new THREE.Group(); objs.forEach((o) => g.add(o)); sat.add(g);
  g.traverse((o) => { if (o.isMesh) o.userData.part = key; });
  const p = { key, group: g, info, explode: explode || v3(), home: g.position.clone() };
  parts.push(p); return p;
}
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (r, h, m, seg = 32) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);

const INFO = {
  frame: ['구조 프레임', '알루미늄(Al 6061·7075) 4개 레일. 사출관(P-POD) 안에서 미끄러지는 면이며, 발사 진동·충격을 견딘다. 규격: 100 × 100 × 113.5 mm.', '구조'],
  solar: ['몸체 태양전지판', '각 면에 고효율 GaAs 태양전지 2장. 햇빛이 수직일 때 한 면 약 2 W. 태양을 향한 면의 수와 각도로 발전량이 정해진다.', '전력(EPS)'],
  antenna: ['UHF 테이프 안테나', '줄자 같은 탄성 금속 테이프 4개(약 17 cm, 435 MHz 1/4 파장). 사출 후 30분이 지나면 열선으로 고정줄을 끊어 펼친다.', '통신(COMM)'],
  camera: ['카메라 (탑재체)', '−Z 면의 렌즈로 지구를 촬영한다. 지구 지향 모드에서 햇빛이 비치는 지역 위를 지날 때 촬영.', '탑재체'],
  sunsensor: ['태양센서 · 자력계', '태양 방향과 지구 자기장 방향을 재서 위성의 자세를 추정한다.', '자세제어(ADCS)'],
  eps: ['전력보드 (EPS)', '태양전지 전력을 최대전력점(MPPT)으로 받아 배터리를 충전하고, 각 보드에 3.3 V·5 V를 나눠 준다.', '전력(EPS)'],
  battery: ['배터리 팩', '리튬이온 18650 셀 2개, 약 20 Wh. 지구 그림자(식) 동안 위성 전체를 버티게 한다. 0 ℃ 아래에서는 히터로 데운다.', '전력(EPS)'],
  obc: ['탑재 컴퓨터 (OBC)', '비행 소프트웨어가 돌아가는 두뇌. 미션 순서, 명령 처리, 데이터 저장, 시간 관리.', '명령·데이터처리'],
  comm: ['통신보드 (UHF 송수신기)', '지상국에서 명령을 받고(업링크) 상태·영상을 내려보낸다(다운링크). 송신할 때 전력을 가장 많이 쓴다.', '통신(COMM)'],
  adcs: ['자세제어보드 (ADCS)', '3축 리액션휠과 자기토커. 자이로·자력계·태양센서 값으로 자세를 계산하고 PD 제어로 원하는 방향을 유지한다.', '자세제어(ADCS)'],
  rw: ['리액션휠 (3축)', '작은 플라이휠. 휠을 한쪽으로 빨리 돌리면 위성은 반대로 돈다(각운동량 보존). 최대 약 1.5 mN·m·s.', '자세제어(ADCS)'],
  mtq: ['자기토커', '전자석 코일. 지구 자기장을 밀어 위성 회전을 멈추고(디텀블링), 휠에 쌓인 각운동량을 덜어 낸다.', '자세제어(ADCS)'],
  payloadboard: ['탑재체 보드', '카메라 센서와 영상 처리(압축·저장)를 담당.', '탑재체'],
  kill: ['분리 스위치 · 스프링', '레일 끝의 스위치는 사출관 안에서 눌려 전원을 끊어 둔다. 사출되면 풀리면서 전원이 켜진다.', '구조'],
};

// 프레임 레일 + 상하 테두리
{
  const objs = [];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
    const r = box(0.085, 0.085, H, mat.al); r.position.set(sx * 0.4575, sy * 0.4575, 0); objs.push(r);
  });
  [-1, 1].forEach((sz) => {
    [[1, 0.08, 0, 0.46], [0.08, 1, 0.46, 0]].forEach(([w, h, x, y]) => {
      [-1, 1].forEach((s) => { const b = box(w, h, 0.05, mat.al); b.position.set(x * s, y * s, sz * (H / 2 - 0.025)); objs.push(b); });
    });
  });
  addPart('frame', objs, INFO.frame);
}
// 분리 스위치
{
  const objs = [];
  [[-1, -1], [1, 1]].forEach(([sx, sy]) => { const k = cyl(0.025, 0.06, mat.gold, 12); k.rotation.x = Math.PI / 2; k.position.set(sx * 0.4575, sy * 0.4575, -H / 2 - 0.03); objs.push(k); });
  addPart('kill', objs, INFO.kill, v3(0, 0, -0.4));
}
// 측면 태양전지판 ±X ±Y (+Z 상판 포함)
const panelParts = [];
function sidePanel(normal) {
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.83, 0.98, 0.016), [mat.alDark, mat.alDark, mat.alDark, mat.alDark, mat.cell, mat.alDark]);
  const g = new THREE.Group(); g.add(p);
  if (normal.x) { g.rotation.y = normal.x > 0 ? Math.PI / 2 : -Math.PI / 2; g.position.x = normal.x * 0.508; }
  if (normal.y) { g.rotation.x = normal.y > 0 ? -Math.PI / 2 : Math.PI / 2; g.position.y = normal.y * 0.508; }
  return g;
}
[v3(1, 0, 0), v3(-1, 0, 0), v3(0, 1, 0), v3(0, -1, 0)].forEach((n) => {
  const pp = addPart('solar', [sidePanel(n)], INFO.solar, n.clone().multiplyScalar(0.9)); panelParts.push(pp);
});
// +Z 상판: 태양전지 + 안테나 전개 장치
const deployer = new THREE.Group();
{
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.83, 0.83, 0.02), [mat.alDark, mat.alDark, mat.alDark, mat.alDark, mat.cell, mat.alDark]);
  top.position.z = H / 2 + 0.012; deployer.add(top);
  const ring = box(0.2, 0.2, 0.03, mat.black); ring.position.z = H / 2 + 0.03; deployer.add(ring);
  const pp = addPart('solar', [deployer], INFO.solar, v3(0, 0, 0.7)); panelParts.push(pp);
}
// 안테나 4개 (접힘 → 펼침)
const antennas = [];
{
  const objs = [];
  for (let k = 0; k < 4; k++) {
    const pivot = new THREE.Group();
    const a = k * Math.PI / 2;
    pivot.position.set(Math.cos(a) * 0.12, Math.sin(a) * 0.12, H / 2 + 0.045);
    pivot.rotation.z = a;
    const tape = box(1.7, 0.03, 0.004, mat.tape); tape.position.x = 0.85;
    const hinge = new THREE.Group(); hinge.add(tape);
    pivot.add(hinge); objs.push(pivot); antennas.push(hinge);
  }
  addPart('antenna', objs, INFO.antenna, v3(0, 0, 0.7));
}
function setAntennaDeploy(f) { // 0 = 접힘(상판에 감김), 1 = 펼침
  antennas.forEach((h) => { h.scale.x = 0.2 + 0.8 * f; h.rotation.z = (1 - f) * 1.2; h.rotation.y = -0.12 * f; });
}
setAntennaDeploy(0);
// −Z 바닥: 카메라 렌즈 + 태양센서
{
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.83, 0.83, 0.02), mat.alDark); bottom.position.z = -H / 2 - 0.012;
  const lensBarrel = cyl(0.16, 0.12, mat.black); lensBarrel.rotation.x = Math.PI / 2; lensBarrel.position.z = -H / 2 - 0.07;
  const lens = cyl(0.12, 0.02, mat.glass); lens.rotation.x = Math.PI / 2; lens.position.z = -H / 2 - 0.135;
  addPart('camera', [bottom, lensBarrel, lens], INFO.camera, v3(0, 0, -0.7));
  const ss = box(0.12, 0.12, 0.03, mat.gold); ss.position.set(0.28, 0.28, -H / 2 - 0.03);
  const ss2 = box(0.06, 0.06, 0.02, mat.glass); ss2.position.set(0.28, 0.28, -H / 2 - 0.05);
  addPart('sunsensor', [ss, ss2], INFO.sunsensor, v3(0, 0, -0.7));
}
// 내부 PC/104 보드 스택
function board(key, label, color, z, extra = [], explodeZ) {
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.86, 0.016), [mat.black, mat.black, mat.black, mat.black, new THREE.MeshStandardMaterial({ map: pcbTexture(label, color), roughness: 0.6 }), mat.black]);
  pcb.position.z = z;
  extra.forEach((e) => { e.position.z += z; });
  return addPart(key, [pcb, ...extra], INFO[key], v3(0, 0, explodeZ));
}
const pbBoard = board('payloadboard', 'PAYLOAD', '#3b2a6b', -0.38, [], -1.2);
{ const cam = box(0.3, 0.3, 0.14, mat.black); cam.position.z = -0.08; pbBoard.group.add(cam); cam.userData.part = 'payloadboard'; }
board('eps', 'EPS', '#1f5a3a', -0.2, [], -0.8);
{ // 배터리 2셀
  const objs = [];
  [-0.11, 0.11].forEach((y) => { const c = cyl(0.09, 0.65, new THREE.MeshStandardMaterial({ color: 0x2f6fd0, roughness: 0.4 })); c.rotation.z = Math.PI / 2; c.position.set(0, y, -0.08); objs.push(c);
    const cap = cyl(0.091, 0.04, mat.al); cap.rotation.z = Math.PI / 2; cap.position.set(0.31, y, -0.08); objs.push(cap); });
  addPart('battery', objs, INFO.battery, v3(0, 0, -0.4));
}
board('obc', 'OBC', '#1d3f7a', 0.04, [], 0.0);
board('comm', 'COMM', '#6b2a2a', 0.18, [], 0.4);
const adcs = board('adcs', 'ADCS', '#2a5f6b', 0.32, [], 0.8);
// 리액션휠 3축 (ADCS 보드 위)
const wheels = [];
{
  const objs = [];
  const mk = (axis, pos) => {
    const g = new THREE.Group(); g.position.copy(pos);
    const housing = cyl(0.11, 0.07, mat.alDark); const rotor = new THREE.Group();
    const disk = cyl(0.095, 0.05, mat.gold); const mark = box(0.18, 0.02, 0.055, mat.black);
    rotor.add(disk, mark); g.add(housing, rotor);
    if (axis === 'x') g.rotation.z = Math.PI / 2; if (axis === 'z') g.rotation.x = Math.PI / 2;
    objs.push(g); wheels.push(rotor); return g;
  };
  mk('x', v3(-0.2, 0.22, 0.43)); mk('y', v3(0.22, 0.2, 0.43)); mk('z', v3(0.05, -0.2, 0.40));
  addPart('rw', objs, INFO.rw, v3(0, 0, 1.15));
}
// 자기토커: 코일 2개 + 막대
{
  const objs = [];
  const coilM = new THREE.MeshStandardMaterial({ color: 0xb5651d, metalness: 0.7, roughness: 0.4 });
  const t1 = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.015, 8, 48), coilM); t1.position.z = 0.5; objs.push(t1);
  const rod = cyl(0.025, 0.5, coilM, 16); rod.rotation.z = Math.PI / 2; rod.position.set(0, -0.36, 0.42); objs.push(rod);
  addPart('mtq', objs, INFO.mtq, v3(0, 0, 1.45));
}
// 스페이서 스탠드오프 (구조 일부)
{
  const objs = [];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { const s = cyl(0.018, 0.9, mat.gold, 8); s.rotation.x = Math.PI / 2; s.position.set(sx * 0.37, sy * 0.37, 0); objs.push(s); });
  addPart('frame', objs, INFO.frame);
}

// 몸체 축
const axes = new THREE.Group(); sat.add(axes);
[[v3(1, 0, 0), 0xff6b6b, '+X'], [v3(0, 1, 0), 0x6bdc8b, '+Y'], [v3(0, 0, 1), 0x6cb8ff, '+Z']].forEach(([d, c]) => {
  axes.add(new THREE.ArrowHelper(d, v3(), 1.25, c, 0.14, 0.08));
});
// 방향 벡터 (관성 방향, 위성을 따라 회전하지 않음)
const vecGroup = new THREE.Group(); scene.add(vecGroup);
const arrSun = new THREE.ArrowHelper(v3(1, 0, 0), v3(), 2.2, 0xffd166, 0.2, 0.1);
const arrNadir = new THREE.ArrowHelper(v3(0, -1, 0), v3(), 2.2, 0x4aa3ff, 0.2, 0.1);
const arrVel = new THREE.ArrowHelper(v3(0, 0, 1), v3(), 2.2, 0x6bdc8b, 0.2, 0.1);
const arrGS = new THREE.ArrowHelper(v3(0, 0, 1), v3(), 2.2, 0xff9f43, 0.2, 0.1);
vecGroup.add(arrSun, arrNadir, arrVel, arrGS);
// 카메라 시야 원뿔
const fov = new THREE.Mesh(new THREE.ConeGeometry(1.4, 4, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x9ad1ff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
fov.rotation.x = Math.PI / 2; fov.position.z = -H / 2 - 2.14; sat.add(fov);

// =====================================================================
// 궤도 미니맵 (오른쪽 아래 작은 창)
// =====================================================================
const mini = new THREE.Scene();
const miniCam = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
const miniEarth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.MeshPhongMaterial({ map: EARTH_TEX }));
mini.add(miniEarth);
mini.add(new THREE.AmbientLight(0xffffff, 0.25));
const miniSun = new THREE.DirectionalLight(0xffffff, 1.8); mini.add(miniSun);
const miniSat = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff5d73 })); mini.add(miniSat);
const miniOrbit = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xff5d73, transparent: true, opacity: 0.6 })); mini.add(miniOrbit);
const miniGS = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffd166 })); miniEarth.add(miniGS);
miniGS.position.copy(gsMarkerNear.position).divideScalar(E_R);
const miniLink = new THREE.Line(new THREE.BufferGeometry().setFromPoints([v3(), v3()]), new THREE.LineBasicMaterial({ color: 0xffd166 })); mini.add(miniLink);
function buildMiniOrbit(t) {
  const pts = []; const P = 2 * Math.PI / N_ORB * 1000;
  for (let k = 0; k <= 180; k++) pts.push(toThree(orbitState(t + P * k / 180).r.clone().divideScalar(RE)));
  miniOrbit.geometry.dispose(); miniOrbit.geometry = new THREE.BufferGeometry().setFromPoints(pts);
}

// =====================================================================
// 시뮬레이션 상태
// =====================================================================
const S = {
  t: T0, speed: 10, paused: false,
  q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, -0.7, 1.1)),
  w: v3(5 * DEG, -3 * DEG, 4 * DEG),    // 사출 직후 회전 (몸체 좌표)
  h: v3(),                               // 리액션휠 각운동량
  wheelAng: v3(),
  soc: 0.7, tPanel: 10, tBat: 15,
  mode: 'off',            // off | detumble | sun | nadir | manual
  auto: true, phase: 0,
  antenna: 0, deployStart: null,
  imaging: false, images: 0, downlinkKB: 0, beacon: false,
  pGen: 0, pUse: 0, err: 0, eclipse: false, elev: -90, inPass: false,
  manual: { roll: 0, pitch: 0, yaw: 0 },
  events: [],
};
const PHASES = [
  ['사출', '사출관에서 밀려나며 분리 스위치가 풀려 전원이 켜진다'],
  ['30분 대기', '다른 위성과 충돌을 피하려 전개·송신 금지'],
  ['안테나 전개', '열선으로 고정줄을 끊어 테이프 안테나를 펼친다'],
  ['디텀블링', '자기토커로 사출 때 생긴 회전을 멈춘다'],
  ['태양 지향 · 충전', '+Z 태양전지판을 태양 쪽으로 돌린다'],
  ['지구 지향 · 촬영', '카메라(−Z)를 지구로 향해 촬영한다'],
  ['지상국 교신', '부산 지상국 위를 지날 때 데이터를 내려보낸다'],
];
function log(msg) {
  const el = (S.t - T0) / 1000;
  const hh = String(Math.floor(el / 3600)).padStart(2, '0'), mm = String(Math.floor(el / 60) % 60).padStart(2, '0'), ss = String(Math.floor(el) % 60).padStart(2, '0');
  S.events.unshift(`T+${hh}:${mm}:${ss}  ${msg}`); if (S.events.length > 40) S.events.pop();
  renderLog();
}
function setPhase(p) { if (p > S.phase) { S.phase = p; renderPhases(); } }

// 목표 자세
function targetFrame(r, v, sun) {
  const zen = r.clone().normalize(), along = v.clone().normalize();
  const nrm = zen.clone().cross(along).normalize(); // 궤도 법선
  if (S.mode === 'sun') {
    const z = sun.clone(); let x = nrm.clone().cross(z); if (x.lengthSq() < 1e-6) x = v3(1, 0, 0); x.normalize();
    return { q: quatFromAxes(x, z.clone().cross(x), z), w: v3() };
  }
  // LVLH 기준 (지구 지향): 몸체 +Z = 천정(그래서 −Z 카메라가 지구), +X = 진행 방향
  const x = along.clone().sub(zen.clone().multiplyScalar(along.dot(zen))).normalize();
  const y = zen.clone().cross(x);
  let q = quatFromAxes(x, y, zen);
  if (S.mode === 'manual') {
    const e = new THREE.Euler(S.manual.roll * DEG, S.manual.pitch * DEG, S.manual.yaw * DEG, 'XYZ');
    q = q.multiply(new THREE.Quaternion().setFromEuler(e));
  }
  return { q, w: zen.clone().cross(along).normalize().multiplyScalar(N_ORB) };
}

const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion();
function step(dt) {
  S.t += dt * 1000;
  const elapsed = (S.t - T0) / 1000;
  const { r, v } = orbitState(S.t);
  const sun = sunEci(S.t);
  // 식(지구 그림자): 원통 모델
  const rs = r.dot(sun);
  S.eclipse = rs < 0 && r.clone().sub(sun.clone().multiplyScalar(rs)).length() < RE;
  // 지상국 고도각
  const gs = stationEci(S.t), d = r.clone().sub(gs);
  S.elev = Math.asin(d.dot(gs.clone().normalize()) / d.length()) / DEG;

  // ---------- 미션 자동 진행 ----------
  if (S.phase === 0 && elapsed > 1) { setPhase(1); log('사출 · 분리 스위치 해제, 전원 ON. 30분 대기 시작'); }
  if (S.phase === 1 && elapsed >= 1800) { setPhase(2); S.deployStart = S.t; log('30분 경과 · 안테나 전개 명령'); }
  if (S.deployStart && S.antenna < 1) {
    S.antenna = Math.min(1, (S.t - S.deployStart) / 1000 / 20);
    if (S.antenna >= 1) { log('안테나 전개 완료 · 비컨 송신 시작'); S.beacon = true; if (S.auto) { S.mode = 'detumble'; setPhase(3); log('디텀블링 시작 (자기토커)'); } }
  }
  const rate = S.w.length() / DEG;
  if (S.auto) {
    if (S.mode === 'detumble' && rate < 0.3) { S.mode = 'sun'; S.detumbled = true; setPhase(4); log(`디텀블링 완료 (${rate.toFixed(2)}°/s) · 태양 지향 시작`); }
    if (S.detumbled) {
      if (S.mode === 'sun' && S.soc > 0.6 && !S.eclipse) { S.mode = 'nadir'; setPhase(5); log('배터리 충분 · 지구 지향 촬영 모드'); }
      else if (S.mode === 'nadir' && S.soc < 0.4) { S.mode = 'sun'; log('배터리 40% 미만 · 태양 지향으로 전환'); }
    }
  }
  // ---------- 자세 동역학 ----------
  const Iw = S.w.clone().multiplyScalar(I_SAT);
  const gyro = S.w.clone().cross(Iw.clone().add(S.h));
  let tau = v3(), tauW = v3();
  if (S.mode === 'detumble') {
    tau = S.w.clone().multiplyScalar(-1e-3);
    if (tau.length() > TAU_MTQ) tau.setLength(TAU_MTQ);
  } else if (S.mode !== 'off') {
    const tgt = targetFrame(r, v, sun);
    const qInv = S.q.clone().invert();
    const qe = tmpQ.copy(tgt.q).invert().multiply(S.q); // 목표 기준 오차
    const sgn = qe.w < 0 ? -1 : 1;
    const ev = v3(qe.x, qe.y, qe.z).multiplyScalar(sgn);
    S.err = 2 * Math.acos(Math.min(1, Math.abs(qe.w))) / DEG;
    const wt = tgt.w.clone().applyQuaternion(qInv);
    const tc = ev.multiplyScalar(-KP).sub(S.w.clone().sub(wt).multiplyScalar(KD)).add(gyro);
    ['x', 'y', 'z'].forEach((k) => {
      let c = THREE.MathUtils.clamp(tc[k], -TAU_RW, TAU_RW);
      if ((S.h[k] >= H_RW && c < 0) || (S.h[k] <= -H_RW && c > 0)) c = 0; // 휠 포화
      tauW[k] = c;
    });
    tau = tauW.clone();
    S.h.sub(tauW.clone().multiplyScalar(dt));
    S.h.multiplyScalar(1 - dt / 4000); // 자기토커로 휠 각운동량 덜어내기
  }
  if (S.mode === 'off' || S.mode === 'detumble') S.err = NaN;
  const dist = v3((Math.random() - 0.5) * 2e-8, (Math.random() - 0.5) * 2e-8, (Math.random() - 0.5) * 2e-8);
  const dw = tau.add(dist).sub(gyro).multiplyScalar(dt / I_SAT);
  S.w.add(dw);
  const ang = S.w.length() * dt;
  if (ang > 0) { tmpQ2.setFromAxisAngle(S.w.clone().normalize(), ang); S.q.multiply(tmpQ2).normalize(); }
  S.wheelAng.add(S.h.clone().multiplyScalar(dt / I_WHEEL));

  // ---------- 전력 ----------
  let gen = 0;
  if (!S.eclipse) {
    const sb = sun.clone().applyQuaternion(S.q.clone().invert()); // 몸체 좌표의 태양 방향
    gen += Math.max(0, sb.x) * FACE_W + Math.max(0, -sb.x) * FACE_W + Math.max(0, sb.y) * FACE_W + Math.max(0, -sb.y) * FACE_W + Math.max(0, sb.z) * FACE_W * 0.8;
  }
  const camB = v3(0, 0, -1).applyQuaternion(S.q);
  const lookingDown = camB.dot(r.clone().normalize().negate()) > 0.9;
  const groundLit = r.clone().normalize().dot(sun) > 0.1;
  const wasImaging = S.imaging;
  S.imaging = S.mode === 'nadir' && lookingDown && groundLit && S.err < 5;
  if (S.imaging && !wasImaging) log('촬영 시작 (햇빛 비치는 지역 위)');
  if (S.imaging) S.images += dt / 10; // 10초마다 1장
  const wasPass = S.inPass;
  S.inPass = S.elev > 5 && S.antenna >= 1;
  if (S.inPass && !wasPass) { setPhase(6); log(`${GS.name} 교신 시작 (고도각 ${S.elev.toFixed(0)}°)`); }
  if (!S.inPass && wasPass) log(`${GS.name} 교신 종료 · 누적 다운링크 ${(S.downlinkKB / 1024).toFixed(1)} MB`);
  if (S.inPass) S.downlinkKB += 9.6 / 8 * dt * 4; // 38.4 kbps 근사
  const heater = S.tBat < 0 ? 0.6 : 0;
  let use = 0.45 /*OBC*/ + 0.15 /*EPS*/ + 0.2 /*수신*/;
  if (S.mode !== 'off') use += 0.35 + (Math.abs(tauW.x) + Math.abs(tauW.y) + Math.abs(tauW.z)) * 3000;
  if (S.imaging) use += 1.5;
  if (S.inPass) use += 2.5; else if (S.beacon) use += 0.1;
  use += heater;
  S.pGen = gen; S.pUse = use;
  S.soc = THREE.MathUtils.clamp(S.soc + (gen * 0.92 - use) * dt / 3600 / BAT_WH, 0, 1);
  // ---------- 온도 (간이 1차 모델) ----------
  const tPanelEq = S.eclipse ? -25 : 15 + gen * 6;
  S.tPanel += (tPanelEq - S.tPanel) * dt / 900;
  const tBatEq = S.tPanel * 0.45 + 8 + heater * 20 + use * 2;
  S.tBat += (tBatEq - S.tBat) * dt / 2400;
  return { r, v, sun };
}

// =====================================================================
// 텔레메트리 기록 · 그래프
// =====================================================================
const hist = []; let lastHist = 0;
function record() {
  if (S.t - lastHist < 30000) return; lastHist = S.t;
  hist.push({ t: S.t, soc: S.soc * 100, gen: S.pGen, use: S.pUse, rate: S.w.length() / DEG, ecl: S.eclipse });
  if (hist.length > 600) hist.shift();
}
function drawChart() {
  const c = document.getElementById('chart'), g = c.getContext('2d');
  const W = c.width, Hh = c.height; g.clearRect(0, 0, W, Hh);
  if (hist.length < 2) return;
  const t0 = hist[0].t, t1 = hist[hist.length - 1].t, X = (t) => 40 + (t - t0) / Math.max(1, t1 - t0) * (W - 50);
  // 식 구간 음영
  g.fillStyle = 'rgba(80,90,140,0.35)';
  hist.forEach((h, i) => { if (h.ecl && i) g.fillRect(X(hist[i - 1].t), 16, X(h.t) - X(hist[i - 1].t) + 0.5, Hh - 36); });
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1;
  [0, 50, 100].forEach((p) => { const y = 16 + (1 - p / 100) * (Hh - 36); g.beginPath(); g.moveTo(40, y); g.lineTo(W - 10, y); g.stroke(); g.fillStyle = '#8ea0bb'; g.font = '20px JetBrains Mono, monospace'; g.fillText(p + '%', 0, y + 6); });
  const line = (key, max, color) => { g.strokeStyle = color; g.lineWidth = 2.5; g.beginPath(); hist.forEach((h, i) => { const y = 16 + (1 - Math.min(h[key], max) / max) * (Hh - 36); i ? g.lineTo(X(h.t), y) : g.moveTo(X(h.t), y); }); g.stroke(); };
  line('gen', 8, '#ffd166'); line('use', 8, '#ff7b7b'); line('soc', 100, '#6dffa8');
  g.fillStyle = '#8ea0bb'; g.font = '18px Noto Sans KR, sans-serif';
  g.fillText(`최근 ${((t1 - t0) / 3600000).toFixed(1)}시간 · 회색 = 지구 그림자`, 44, Hh - 2);
}

// =====================================================================
// UI
// =====================================================================
const $ = (id) => document.getElementById(id);
function renderPhases() {
  $('phases').innerHTML = PHASES.map(([t, d], i) => `<li class="${i < S.phase ? 'done' : i === S.phase ? 'now' : ''}"><b>${i + 1}. ${t}</b><span>${d}</span></li>`).join('');
}
function renderLog() { $('log').innerHTML = S.events.map((e) => `<div>${e}</div>`).join(''); }
const MODE_NAME = { off: '제어 없음 (자유 회전)', detumble: '디텀블링 (자기토커)', sun: '태양 지향', nadir: '지구 지향 (촬영)', manual: '수동 자세 (LVLH 기준)' };
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
  S.auto = false; $('auto').checked = false; S.mode = b.dataset.mode; log(`수동 명령 · ${MODE_NAME[S.mode]}`);
  $('manual-box').classList.toggle('hidden', S.mode !== 'manual');
}));
$('auto').addEventListener('change', (e) => { S.auto = e.target.checked; if (S.auto) log('자동 미션 모드 ON'); });
['roll', 'pitch', 'yaw'].forEach((k) => $('m-' + k).addEventListener('input', (e) => { S.manual[k] = +e.target.value; $('v-' + k).textContent = e.target.value + '°'; }));
document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => { S.speed = +b.dataset.speed; S.paused = false; $('play').textContent = '⏸'; updSpeed(); }));
function updSpeed() { document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', +b.dataset.speed === S.speed)); }
$('play').addEventListener('click', () => { S.paused = !S.paused; $('play').textContent = S.paused ? '▶' : '⏸'; });
$('skip').addEventListener('click', () => { // 다음 단계까지 빨리 감기
  const target = S.phase < 2 ? T0 + 1800 * 1000 : S.t + 600 * 1000;
  while (S.t < target) { step(1); record(); }
});
$('tumble').addEventListener('click', () => { S.w.set((Math.random() - 0.5) * 16 * DEG, (Math.random() - 0.5) * 16 * DEG, (Math.random() - 0.5) * 16 * DEG); log('외란: 위성이 다시 회전하기 시작'); if (S.auto && S.phase >= 3) { S.mode = 'detumble'; log('디텀블링 시작'); } });
$('reset').addEventListener('click', () => location.reload());
const toggles = { explode: false, xray: false, axes: true, vectors: true, fov: true };
['explode', 'xray', 'axes', 'vectors', 'fov'].forEach((k) => $('t-' + k).addEventListener('change', (e) => { toggles[k] = e.target.checked; }));
$('panel-toggle').addEventListener('click', () => $('left').classList.toggle('collapsed'));

// 부품 선택
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let down = null; let selected = null;
canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
  const rc = canvas.getBoundingClientRect();
  mouse.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hits = ray.intersectObject(sat, true).filter((h) => h.object.userData.part && h.object.visible && !(h.object.material && h.object.material.opacity === 0));
  selectPart(hits.length ? hits[0].object.userData.part : null);
});
const highlight = new THREE.BoxHelper(undefined, 0xffd166); highlight.visible = false; scene.add(highlight);
function selectPart(key) {
  selected = key;
  const card = $('partcard');
  if (!key) { card.classList.add('hidden'); highlight.visible = false; return; }
  const [t, d, sys] = INFO[key];
  $('p-name').textContent = t; $('p-sys').textContent = sys; $('p-desc').textContent = d;
  card.classList.remove('hidden');
}
document.querySelectorAll('[data-part]').forEach((b) => b.addEventListener('click', () => { toggles.explode = true; $('t-explode').checked = true; selectPart(b.dataset.part); }));
$('p-close').addEventListener('click', () => selectPart(null));

// 화면 맞춤
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// =====================================================================
// 루프
// =====================================================================
let last = performance.now(), explodeF = 0, lastMiniOrbit = 0;
const KST = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
let geo = orbitState(S.t);
function frame(now) {
  const dtReal = Math.min(0.1, (now - last) / 1000); last = now;
  if (!S.paused) {
    let simDt = dtReal * S.speed; const h = 0.2;
    while (simDt > 0) { const d = Math.min(h, simDt); geo = step(d); simDt -= d; record(); }
  } else if (!geo.sun) geo = { ...orbitState(S.t), sun: sunEci(S.t) };
  const { r, v, sun } = geo.sun ? geo : { ...orbitState(S.t), sun: sunEci(S.t) };

  // 위성 자세
  sat.quaternion.copy(Q_ECI2THREE).multiply(S.q);
  setAntennaDeploy(S.antenna);
  wheels.forEach((w, i) => { w.rotation.y = ['x', 'y', 'z'].map((k) => S.wheelAng[k])[i] * 0.002; });
  // 분해·투명
  explodeF += ((toggles.explode ? 1 : 0) - explodeF) * 0.12;
  parts.forEach((p) => {
    p.group.position.copy(p.home).addScaledVector(p.explode, explodeF);
  });
  mat.cell.opacity = toggles.xray ? 0.18 : 1; mat.alDark.transparent = toggles.xray; mat.alDark.opacity = toggles.xray ? 0.18 : 1;
  mat.cell.depthWrite = !toggles.xray; mat.alDark.depthWrite = !toggles.xray;
  axes.visible = toggles.axes; vecGroup.visible = toggles.vectors; fov.visible = toggles.fov && S.imaging;
  // 선택 강조
  if (selected) { const p = parts.find((x) => x.key === selected); if (p) { highlight.setFromObject(p.group); highlight.visible = true; } }

  // 지구 (근접 장면): 위성 바로 아래에 실제 각크기로
  const zen = r.clone().normalize();
  toThree(zen.clone().multiplyScalar(-E_R * R_ORB / RE), earthNear.position);
  earthNear.rotation.y = gmst(S.t);
  // 태양
  const sunT = toThree(sun.clone());
  sunLight.position.copy(sunT).multiplyScalar(50); sunLight.intensity = S.eclipse ? 0 : 2.2;
  sunSprite.position.copy(sunT).multiplyScalar(1500); sunSprite.visible = !S.eclipse || true;
  earthShine.position.copy(toThree(zen.clone().negate())).multiplyScalar(50); earthShine.intensity = S.eclipse ? 0.12 : 0.35;
  ambient.intensity = S.eclipse ? 0.12 : 0.28;
  // 벡터
  arrSun.setDirection(sunT.clone().normalize());
  arrNadir.setDirection(toThree(zen.clone().negate()));
  arrVel.setDirection(toThree(v.clone().normalize()));
  const gs = stationEci(S.t); arrGS.setDirection(toThree(gs.clone().sub(r).normalize())); arrGS.visible = S.elev > 0;

  // 미니맵
  miniEarth.rotation.y = gmst(S.t);
  toThree(r.clone().divideScalar(RE), miniSat.position);
  miniSun.position.copy(sunT).multiplyScalar(10);
  if (Math.abs(S.t - lastMiniOrbit) > 600000) { buildMiniOrbit(S.t); lastMiniOrbit = S.t; }
  miniCam.position.copy(miniSat.position).normalize().multiplyScalar(4.2).add(v3(0, 1.2, 0)); miniCam.lookAt(0, 0, 0);
  miniLink.visible = S.inPass;
  if (S.inPass) { const gsW = miniGS.getWorldPosition(v3()); miniLink.geometry.setFromPoints([miniSat.position.clone(), gsW]); }

  // 렌더: 메인 + 미니맵(시저)
  controls.update();
  const W = canvas.clientWidth, Hh = canvas.clientHeight;
  renderer.setViewport(0, 0, W, Hh); renderer.setScissorTest(false); renderer.clear(); renderer.render(scene, camera);
  const mw = Math.min(300, W * 0.28), mx = W - mw - 16, my = 16;
  renderer.setScissorTest(true); renderer.setScissor(mx, my, mw, mw); renderer.setViewport(mx, my, mw, mw);
  renderer.setClearColor(0x050a18, 1); renderer.clear(); miniCam.aspect = 1; miniCam.updateProjectionMatrix(); renderer.render(mini, miniCam);
  renderer.setScissorTest(false); renderer.setClearColor(0x02040a, 1);

  updateHud(r);
  requestAnimationFrame(frame);
}

let hudTick = 0;
function updateHud(r) {
  if (++hudTick % 4) return;
  const g = geodetic(r, S.t);
  const el = (S.t - T0) / 1000;
  $('clock').textContent = KST.format(new Date(S.t)) + ' KST';
  $('met').textContent = `T+${String(Math.floor(el / 3600)).padStart(2, '0')}:${String(Math.floor(el / 60) % 60).padStart(2, '0')}:${String(Math.floor(el) % 60).padStart(2, '0')}`;
  $('h-mode').textContent = MODE_NAME[S.mode] + (S.auto ? ' · 자동' : '');
  $('h-pos').textContent = `${Math.abs(g.lat).toFixed(1)}°${g.lat >= 0 ? 'N' : 'S'} ${Math.abs(g.lon).toFixed(1)}°${g.lon >= 0 ? 'E' : 'W'} · 고도 ${ALT} km`;
  $('h-sun').textContent = S.eclipse ? '🌑 지구 그림자 (식)' : '☀️ 햇빛';
  $('h-sun').className = S.eclipse ? 'bad' : 'good';
  $('h-soc').textContent = (S.soc * 100).toFixed(1) + ' %';
  $('bar-soc').style.width = (S.soc * 100).toFixed(1) + '%';
  $('bar-soc').style.background = S.soc < 0.3 ? '#ff7b7b' : S.soc < 0.5 ? '#ffd166' : '#6dffa8';
  $('h-gen').textContent = S.pGen.toFixed(2) + ' W';
  $('h-use').textContent = S.pUse.toFixed(2) + ' W';
  $('h-rate').textContent = (S.w.length() / DEG).toFixed(2) + ' °/s';
  $('h-err').textContent = isNaN(S.err) ? '—' : S.err.toFixed(1) + '°';
  const rpm = (k) => Math.round(S.h[k] / I_WHEEL * 60 / (2 * Math.PI));
  $('h-rw').textContent = `${rpm('x')} / ${rpm('y')} / ${rpm('z')}`;
  $('h-temp').textContent = `${S.tPanel.toFixed(0)} ℃ / ${S.tBat.toFixed(0)} ℃`;
  $('h-ant').textContent = S.antenna >= 1 ? '전개됨' : S.antenna > 0 ? `전개 중 ${(S.antenna * 100).toFixed(0)}%` : '접힘';
  $('h-gs').textContent = S.inPass ? `교신 중 · 고도각 ${S.elev.toFixed(0)}°` : `대기 · 고도각 ${S.elev.toFixed(0)}°`;
  $('h-gs').className = S.inPass ? 'good' : '';
  $('h-img').textContent = `${Math.floor(S.images)} 장${S.imaging ? ' · 촬영 중' : ''}`;
  $('h-dl').textContent = `${(S.downlinkKB / 1024).toFixed(2)} MB`;
  if (hudTick % 16 === 0) drawChart();
}

renderPhases(); updSpeed(); resize(); buildMiniOrbit(S.t);
log('시뮬레이션 시작 · 고도 500 km 태양동기궤도');
requestAnimationFrame(frame);
