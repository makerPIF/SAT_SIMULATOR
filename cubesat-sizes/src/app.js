import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// 단위: 1 = 10 cm
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------
// 서브시스템
// ---------------------------------------------------------------------
const SYS = {
  payload: { name: '탑재체', color: 0x8b6cf0, desc: '위성이 존재하는 이유. 카메라·망원경·센서·실험 장비.' },
  eps: { name: '전력(EPS)', color: 0x3fae6b, desc: '태양전지 전력을 받아 충전·분배하는 보드.' },
  battery: { name: '배터리', color: 0x3c86e0, desc: '리튬이온 배터리 팩. 지구 그림자 동안 전력을 공급.' },
  obc: { name: '탑재컴퓨터(OBC)', color: 0x2d3f8f, desc: '비행 소프트웨어가 도는 두뇌. 명령·데이터 처리.' },
  comm: { name: '통신(COMM)', color: 0xd9534f, desc: '지상국과 교신. 작은 위성은 UHF, 큰 위성은 S·X밴드로 빠르게 내려받는다.' },
  adcs: { name: '자세제어(ADCS)', color: 0x2aa3a3, desc: '리액션휠·자기토커·자이로·별센서로 방향을 잡는다.' },
  prop: { name: '추진', color: 0xf08c2e, desc: '궤도 유지·변경·충돌 회피용 추력기와 연료(냉가스·전기추진).' },
  gnss: { name: 'GPS 수신기', color: 0x8a94a6, desc: '위성의 위치와 시각을 정밀하게 안다.' },
};

// ---------------------------------------------------------------------
// 크기별 구성 (U 격자 좌표: x0,y0,z0, sx,sy,sz)  — 대표 예시 구성
// ---------------------------------------------------------------------
const CONFIGS = [
  { id: '1U', nx: 1, ny: 1, nz: 1, dim: [100, 100, 113.5], mass: 2, power: '약 1–2 W', powerN: 1.5,
    wings: null, adcs: '자기토커 (+소형 휠) · 지향 약 5–10°', comm: 'UHF · 수 kbps', prop: '없음', pointN: 10,
    ex: 'LignoSat(나무 위성), 교육용 위성', role: '교육·단일 실험',
    modules: [['payload', 0, 0, 0, 1, 1, 0.24, '카메라'], ['battery', 0, 0, 0.24, 1, 1, 0.2], ['eps', 0, 0, 0.44, 1, 1, 0.1], ['obc', 0, 0, 0.54, 1, 1, 0.1], ['comm', 0, 0, 0.64, 1, 1, 0.14], ['adcs', 0, 0, 0.78, 1, 1, 0.2]],
    extras: { uhf: true } },
  { id: '2U', nx: 1, ny: 1, nz: 2, dim: [100, 100, 227], mass: 4, power: '약 2–4 W', powerN: 3,
    wings: null, adcs: '자기토커 + 3축 소형 휠 · 지향 약 2–5°', comm: 'UHF · 수~수십 kbps', prop: '없음', pointN: 4,
    ex: '큐브위성 경연대회 초급 부문(2U 이상)', role: '단일 임무',
    modules: [['payload', 0, 0, 0, 1, 1, 0.78, '실험 장비'], ['battery', 0, 0, 0.78, 1, 1, 0.26], ['eps', 0, 0, 1.04, 1, 1, 0.12], ['obc', 0, 0, 1.16, 1, 1, 0.12], ['comm', 0, 0, 1.28, 1, 1, 0.18], ['adcs', 0, 0, 1.46, 1, 1, 0.34], ['gnss', 0, 0, 1.8, 1, 1, 0.12]],
    extras: { uhf: true } },
  { id: '3U', nx: 1, ny: 1, nz: 3, dim: [100, 100, 340.5], mass: 6, power: '몸체 약 5 W / 날개 펼치면 약 20 W', powerN: 20,
    wings: { faces: ['+x', '-x', '+y', '-y'], panels: 1 }, adcs: '3축 리액션휠 · 지향 약 0.5–1°', comm: 'UHF + S밴드 · 수백 kbps~1 Mbps', prop: '선택 (예: K-HERO 홀추력기)', pointN: 1,
    ex: 'K-HERO(KAIST), 미국 Planet Dove', role: '지구관측·추력기 실증',
    modules: [['payload', 0, 0, 0, 1, 1, 1.35, '광학 망원경'], ['adcs', 0, 0, 1.35, 1, 1, 0.5], ['battery', 0, 0, 1.85, 1, 1, 0.32], ['eps', 0, 0, 2.17, 1, 1, 0.13], ['obc', 0, 0, 2.3, 1, 1, 0.12], ['comm', 0, 0, 2.42, 1, 1, 0.26], ['prop', 0, 0, 2.68, 1, 1, 0.3, '홀추력기']],
    extras: { uhf: true, patch: true, thruster: true } },
  { id: '6U', nx: 2, ny: 1, nz: 3, dim: [226.3, 100, 366], mass: 12, power: '날개 약 40–60 W', powerN: 50,
    wings: { faces: ['+y', '-y'], panels: 2 }, adcs: '3축 휠 + 별센서 · 지향 약 0.01–0.1°', comm: 'S·X밴드 · 수 Mbps', prop: '냉가스·전기추진', pointN: 0.05,
    ex: '심우주 큐브위성 MarCO(화성)', role: '고성능 관측·심우주',
    modules: [['payload', 0, 0, 0, 1, 1, 2.3, '대형 망원경'], ['adcs', 1, 0, 0, 1, 1, 0.9], ['battery', 1, 0, 0.9, 1, 1, 0.6], ['eps', 1, 0, 1.5, 1, 1, 0.22], ['obc', 1, 0, 1.72, 1, 1, 0.2], ['comm', 1, 0, 1.92, 1, 1, 0.38, 'X밴드 송신기'], ['prop', 0, 0, 2.3, 2, 1, 0.7, '추진 모듈']],
    extras: { uhf: true, patch: true, thruster: true, star: true } },
  { id: '12U', nx: 2, ny: 2, nz: 3, dim: [226.3, 226.3, 366], mass: 24, power: '날개 약 80–100 W', powerN: 90,
    wings: { faces: ['+y', '-y'], panels: 3 }, adcs: '3축 대형 휠 + 별센서 · 지향 약 0.01°', comm: 'S·X밴드 · 수십 Mbps', prop: '전기추진·화학추진', pointN: 0.01,
    ex: '마크 로버의 SatGus, 정밀 관측 위성', role: '대형 탑재체',
    modules: [['payload', 0, 0, 0, 2, 1, 2.2, '대형 탑재체'], ['adcs', 0, 1, 0, 1, 1, 1.0], ['battery', 1, 1, 0, 1, 1, 1.2], ['obc', 0, 1, 1.0, 1, 1, 0.3], ['comm', 0, 1, 1.3, 1, 1, 0.9, 'X밴드 송신기'], ['eps', 1, 1, 1.2, 1, 1, 0.4], ['gnss', 1, 1, 1.6, 1, 1, 0.6], ['prop', 0, 0, 2.2, 2, 2, 0.8, '추진 모듈']],
    extras: { uhf: true, patch: true, thruster: true, star: true } },
  { id: '16U', nx: 2, ny: 2, nz: 4, dim: [226.3, 226.3, 454], mass: 32, power: '날개 약 100 W 이상', powerN: 110,
    wings: { faces: ['+y', '-y'], panels: 3 }, adcs: '3축 대형 휠 + 별센서 · 지향 약 0.01°', comm: 'S·X밴드 · 수십 Mbps', prop: '전기추진·화학추진', pointN: 0.01,
    ex: '대전샛-1호(누리호 5차, 탑재체 4종)', role: '복합 임무',
    modules: [['payload', 0, 0, 0, 1, 1, 2.4, '탑재체 A'], ['payload', 1, 0, 0, 1, 1, 2.4, '탑재체 B'], ['adcs', 0, 1, 0, 1, 1, 1.2], ['battery', 1, 1, 0, 1, 1, 1.4], ['obc', 0, 1, 1.2, 1, 1, 0.3], ['comm', 0, 1, 1.5, 1, 1, 0.9, 'X밴드 송신기'], ['eps', 1, 1, 1.4, 1, 1, 0.4], ['gnss', 1, 1, 1.8, 1, 1, 0.6], ['prop', 0, 0, 2.4, 2, 2, 0.8, '추진 모듈'], ['payload', 0, 0, 3.2, 2, 2, 0.8, '탑재체 C·D']],
    extras: { uhf: true, patch: true, thruster: true, star: true } },
];
CONFIGS.forEach((c) => {
  c.size = v3(c.dim[0] / 100, c.dim[1] / 100, c.dim[2] / 100);
  const tot = c.nx * c.ny * c.nz;
  c.u = tot;
  c.payloadU = c.modules.filter((m) => m[0] === 'payload').reduce((s, m) => s + m[4] * m[5] * m[6], 0);
  c.payloadFrac = c.payloadU / tot;
});

// ---------------------------------------------------------------------
// 렌더러
// ---------------------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1022);
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 500);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.minDistance = 1.5; controls.maxDistance = 60;
scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x1a2238, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(6, 10, 8); scene.add(key);
const rim = new THREE.DirectionalLight(0x88aaff, 0.6); rim.position.set(-8, 4, -6); scene.add(rim);
const grid = new THREE.GridHelper(40, 40, 0x2a3a6b, 0x1a2548); scene.add(grid);

// 텍스처
function cellTex(cols, rows) {
  const c = document.createElement('canvas'); c.width = 128 * cols; c.height = 128 * rows; const g = c.getContext('2d');
  g.fillStyle = '#c3c7cf'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = i * 128 + 8, y = j * 128 + 8, w = 112, h = 112;
    const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#203077'); gr.addColorStop(1, '#0e1640');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(190,200,235,0.5)'; g.lineWidth = 1;
    for (let k = 1; k < 8; k++) { g.beginPath(); g.moveTo(x + k * w / 8, y); g.lineTo(x + k * w / 8, y + h); g.stroke(); }
    g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function moduleTex(label, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#' + new THREE.Color(color).getHexString(); g.fillRect(0, 0, 256, 128);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 100, 256, 28);
  g.fillStyle = '#fff'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.fillText(label, 128, 62);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const M = {
  al: new THREE.MeshStandardMaterial({ color: 0xbcc1ca, metalness: 0.85, roughness: 0.35 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x5d6470, metalness: 0.7, roughness: 0.5 }),
  black: new THREE.MeshStandardMaterial({ color: 0x14161b, metalness: 0.3, roughness: 0.6 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd4a447, metalness: 0.9, roughness: 0.3 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x1e2a48, metalness: 0.2, roughness: 0.05 }),
  tape: new THREE.MeshStandardMaterial({ color: 0xd8d2c4, metalness: 0.6, roughness: 0.4 }),
};
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (r, h, m, s = 32) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, s), m);

// ---------------------------------------------------------------------
// 위성 생성 (위성 로컬: x,y = 단면, z = 길이 방향 → 화면에서는 z를 위로)
// ---------------------------------------------------------------------
function buildSat(cfg) {
  const root = new THREE.Group();   // three 좌표 (y 위)
  const body = new THREE.Group(); body.rotation.x = -Math.PI / 2; root.add(body); // 위성 z → 화면 y
  const S = cfg.size, hx = S.x / 2, hy = S.y / 2, hz = S.z / 2;
  const ux = S.x / cfg.nx, uy = S.y / cfg.ny, uz = S.z / cfg.nz;
  const sat = { cfg, root, body, panels: [], modules: [], wings: [], grid: null, extrasExt: [] };

  // 레일 프레임
  const rail = 0.085;
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { const r = box(rail, rail, S.z, M.al); r.position.set(sx * (hx - rail / 2), sy * (hy - rail / 2), 0); r.userData.part = ['frame']; body.add(r); });
  // U 경계 링
  for (let k = 0; k <= cfg.nz; k++) {
    const z = -hz + k * uz;
    [[S.x, 0.06, 0, hy - 0.03], [S.x, 0.06, 0, -hy + 0.03], [0.06, S.y, hx - 0.03, 0], [0.06, S.y, -hx + 0.03, 0]].forEach(([w, h, x, y]) => {
      const b = box(w, h, 0.04, M.al); b.position.set(x, y, z); b.userData.part = ['frame']; body.add(b);
    });
  }
  // 몸체 태양전지판 (측면 4개)
  const sides = [
    { n: v3(1, 0, 0), w: S.y, cols: cfg.ny }, { n: v3(-1, 0, 0), w: S.y, cols: cfg.ny },
    { n: v3(0, 1, 0), w: S.x, cols: cfg.nx }, { n: v3(0, -1, 0), w: S.x, cols: cfg.nx },
  ];
  sides.forEach((sd) => {
    const tex = cellTex(sd.cols, cfg.nz);
    const m = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.4, roughness: 0.35, transparent: true });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(sd.w - 0.16, S.z - 0.08), m);
    const g = new THREE.Group(); g.add(p);
    // 평면을 면 바깥으로 향하게
    if (sd.n.x) { g.rotation.set(0, sd.n.x > 0 ? Math.PI / 2 : -Math.PI / 2, 0); g.rotateZ(Math.PI / 2); g.position.x = sd.n.x * (hx + 0.005); }
    if (sd.n.y) { g.rotation.set(sd.n.y > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0); g.position.y = sd.n.y * (hy + 0.005); }
    p.userData.part = ['solar'];
    body.add(g); sat.panels.push({ g, n: sd.n, home: g.position.clone(), mat: m });
  });
  // 상판·바닥판
  const top = box(S.x - 0.1, S.y - 0.1, 0.02, M.dark); top.position.z = hz + 0.01; body.add(top);
  const bot = box(S.x - 0.1, S.y - 0.1, 0.02, M.dark); bot.position.z = -hz - 0.01; body.add(bot);
  sat.panels.push({ g: top, n: v3(0, 0, 1), home: top.position.clone(), mat: M.dark });
  sat.panels.push({ g: bot, n: v3(0, 0, -1), home: bot.position.clone(), mat: M.dark });

  // 내부 모듈
  cfg.modules.forEach(([sys, x0, y0, z0, sx, sy, sz, label]) => {
    const w = sx * ux - 0.06, d = sy * uy - 0.06, h = sz * uz * (cfg.nz / cfg.nz) - 0.03;
    const hh = sz * (S.z / cfg.nz) - 0.03;
    const color = SYS[sys].color;
    const mats = [0, 1, 2, 3, 4, 5].map((i) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, map: i < 4 ? moduleTex(label || SYS[sys].name, color) : null }));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, d, hh), mats);
    // BoxGeometry 면 순서: +x,-x,+y,-y,+z,-z → 측면 4개에 이름 표시
    const cx = -hx + (x0 + sx / 2) * ux, cy = -hy + (y0 + sy / 2) * uy, cz = -hz + (z0 + sz / 2) * (S.z / cfg.nz);
    mesh.position.set(cx, cy, cz);
    mesh.userData.part = ['module', sys, label];
    body.add(mesh);
    // 세부 형상
    if (sys === 'adcs') {
      const n = Math.min(3, Math.max(1, Math.round(sx * sy * 3)));
      for (let i = 0; i < 3; i++) { const wh = cyl(Math.min(w, d) * 0.18, 0.06, M.gold); wh.rotation.x = Math.PI / 2; wh.position.set(cx + (i - 1) * w * 0.28, cy, cz + hh / 2 + 0.03); wh.userData.part = mesh.userData.part; body.add(wh); sat.modules.push({ mesh: wh, home: wh.position.clone(), c: v3(cx, cy, cz) }); }
    }
    sat.modules.push({ mesh, home: mesh.position.clone(), c: v3(cx, cy, cz), sys });
  });

  // 외부 장비
  const ex = cfg.extras;
  if (ex.uhf) { // 상판 UHF 테이프 안테나
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; const t = box(1.7, 0.03, 0.004, M.tape); t.position.set(Math.cos(a) * (0.12 + 0.85), Math.sin(a) * (0.12 + 0.85), hz + 0.03); t.rotation.z = a; t.userData.part = ['uhf']; body.add(t); }
  }
  // 카메라/망원경 개구부 (바닥)
  const pay = cfg.modules.find((m) => m[0] === 'payload');
  {
    const r = Math.min(pay[4] * ux, pay[5] * uy) * 0.36;
    const cx = -hx + (pay[1] + pay[4] / 2) * ux, cy = -hy + (pay[2] + pay[5] / 2) * uy;
    const barrel = cyl(r, 0.12, M.black); barrel.rotation.x = Math.PI / 2; barrel.position.set(cx, cy, -hz - 0.07); body.add(barrel);
    const lens = cyl(r * 0.75, 0.02, M.glass); lens.rotation.x = Math.PI / 2; lens.position.set(cx, cy, -hz - 0.135); body.add(lens);
    barrel.userData.part = lens.userData.part = ['lens'];
  }
  if (ex.patch) { const p = box(0.4, 0.4, 0.02, M.gold); p.position.set(hx - 0.3, -hy + 0.3, -hz - 0.025); p.userData.part = ['patch']; body.add(p); }
  if (ex.thruster) { const n = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 24, 1, true), M.dark); n.rotation.x = -Math.PI / 2; n.position.set(0, 0, hz + 0.12); n.userData.part = ['thruster']; body.add(n); }
  if (ex.star) { const st = cyl(0.13, 0.32, M.black); st.position.set(hx + 0.13, 0, hz - 0.6); st.rotation.z = 0.0; st.rotation.x = Math.PI / 2; const b = cyl(0.16, 0.04, M.al); b.rotation.x = Math.PI / 2; b.position.set(hx + 0.13, 0, hz - 0.42); st.userData.part = b.userData.part = ['star']; body.add(st, b); }

  // 전개형 태양전지 날개
  if (cfg.wings) {
    const nP = cfg.wings.panels;
    cfg.wings.faces.forEach((f) => {
      const axis = f[1], sgn = f[0] === '+' ? 1 : -1;
      const width = axis === 'x' ? S.y - 0.12 : S.x - 0.12;
      const len = S.z - 0.1;
      const hinge = new THREE.Group(); // 상단 모서리 경첩
      if (axis === 'x') { hinge.position.set(sgn * (hx + 0.02), 0, hz); } else { hinge.position.set(0, sgn * (hy + 0.02), hz); }
      body.add(hinge);
      const tex = cellTex(axis === 'x' ? cfg.ny : cfg.nx, cfg.nz);
      const panels = [];
      for (let i = 0; i < nP; i++) {
        const m = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.4, roughness: 0.35 });
        const back = new THREE.MeshStandardMaterial({ color: 0x8b919c, metalness: 0.6, roughness: 0.4 });
        const geo = new THREE.BoxGeometry(axis === 'x' ? 0.02 : width, axis === 'x' ? width : 0.02, len);
        const mats = axis === 'x' ? [m, m, back, back, back, back] : [back, back, m, m, back, back];
        const p = new THREE.Mesh(geo, mats); p.userData.part = ['wing'];
        hinge.add(p); panels.push(p);
      }
      sat.wings.push({ hinge, panels, axis, sgn, len });
    });
  }
  // U 격자 와이어
  const gpts = [];
  for (let i = 0; i <= cfg.nx; i++) for (let j = 0; j <= cfg.ny; j++) { const x = -hx + i * ux, y = -hy + j * uy; gpts.push(v3(x, y, -hz), v3(x, y, hz)); }
  for (let k = 0; k <= cfg.nz; k++) { const z = -hz + k * uz; for (let i = 0; i <= cfg.nx; i++) gpts.push(v3(-hx + i * ux, -hy, z), v3(-hx + i * ux, hy, z)); for (let j = 0; j <= cfg.ny; j++) gpts.push(v3(-hx, -hy + j * uy, z), v3(hx, -hy + j * uy, z)); }
  sat.grid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gpts), new THREE.LineBasicMaterial({ color: 0xffd166 }));
  sat.grid.visible = false; body.add(sat.grid);

  root.position.y = hz + 0.25; // 바닥 위에 세우기
  return sat;
}

function setWing(sat, f) { // f: 0 접힘 → 1 펼침
  sat.wings.forEach(({ hinge, panels, axis, sgn, len }) => {
    panels.forEach((p, i) => {
      // 접힘: 몸체 옆에 겹쳐 쌓임 / 펼침: 상판 높이에서 바깥으로 일렬
      const stowOff = 0.025 * (i + 1);
      const stowPos = axis === 'x' ? v3(sgn * stowOff, 0, -len / 2) : v3(0, sgn * stowOff, -len / 2);
      const depPos = axis === 'x' ? v3(sgn * (len / 2 + i * len + 0.02), 0, 0) : v3(0, sgn * (len / 2 + i * len + 0.02), 0);
      p.position.lerpVectors(stowPos, depPos, f);
      const qS = new THREE.Quaternion();
      const qD = new THREE.Quaternion().setFromAxisAngle(axis === 'x' ? v3(0, 1, 0) : v3(1, 0, 0), axis === 'x' ? sgn * Math.PI / 2 : -sgn * Math.PI / 2);
      p.quaternion.slerpQuaternions(qS, qD, f);
    });
  });
}

// ---------------------------------------------------------------------
// 상태 · 모드
// ---------------------------------------------------------------------
const state = { mode: 'single', current: 2, wing: 0, wingT: 0, explode: 0, explodeT: 0, xray: false, gridOn: false, spin: true };
let singleSat = null;
const compareGroup = new THREE.Group(); scene.add(compareGroup);
const compareSats = [];
const labels = document.getElementById('labels');

function clearSingle() { if (singleSat) { scene.remove(singleSat.root); singleSat = null; } }
function showSingle(i) {
  state.mode = 'single'; state.current = i; clearSingle(); compareGroup.visible = false;
  singleSat = buildSat(CONFIGS[i]); scene.add(singleSat.root);
  const s = CONFIGS[i].size; const r = Math.max(s.x, s.y, s.z);
  controls.target.set(0, singleSat.root.position.y, 0);
  camera.position.set(r * 1.9 + 2, singleSat.root.position.y + r * 0.7 + 0.8, r * 2.1 + 2.5);
  state.wing = state.wingT; setWing(singleSat, state.wing);
  renderSpec(); renderButtons(); selectPart(null);
  labels.innerHTML = '';
}
// 비교: 6종을 실제 크기로 나란히
const phone = new THREE.Group();
{
  const b = box(0.72, 1.5, 0.08, new THREE.MeshStandardMaterial({ color: 0x2b2b30, metalness: 0.5, roughness: 0.3 }));
  const s = box(0.66, 1.4, 0.01, new THREE.MeshStandardMaterial({ color: 0x3a6fd8, emissive: 0x10224a })); s.position.z = 0.045; b.add(s);
  b.position.y = 0.75 + 0.25; phone.add(b); phone.userData.label = '폰 15cm';
}
function buildCompare() {
  let x = -1.4;
  CONFIGS.forEach((c, i) => {
    const s = buildSat(c); setWing(s, 0);
    const w = Math.max(c.size.x, c.size.y);
    x += w / 2 + 0.9; s.root.position.x = x; x += w / 2 + 0.3;
    compareGroup.add(s.root); compareSats.push(s);
  });
  phone.position.x = x + 0.7; compareGroup.add(phone);
  compareGroup.position.x = -((-0.5) + (x + 1.1)) / 2;
  compareGroup.visible = false;
}
buildCompare();
function showCompare() {
  state.mode = 'compare'; clearSingle(); compareGroup.visible = true;
  compareSats.forEach((s) => setWing(s, state.wingT));
  controls.target.set(0, 1.8, 0); camera.position.set(0, 7, 31);
  renderButtons(); renderCompareSpec(); selectPart(null);
}

// ---------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
function renderButtons() {
  $('sizes').innerHTML = CONFIGS.map((c, i) => `<button data-i="${i}" class="${state.mode === 'single' && state.current === i ? 'on' : ''}">${c.id}</button>`).join('') +
    `<button data-i="cmp" class="${state.mode === 'compare' ? 'on' : ''}">전체 비교</button>`;
  $('sizes').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => (b.dataset.i === 'cmp' ? showCompare() : showSingle(+b.dataset.i))));
}
function renderSpec() {
  const c = CONFIGS[state.current];
  $('spec').innerHTML = `
    <div class="big">${c.id} <span>${c.role}</span></div>
    <dl>
      <dt>크기</dt><dd>${c.dim.map((d) => d % 1 ? d.toFixed(1) : d).join(' × ')} mm</dd>
      <dt>1U 개수</dt><dd>${c.u}개 (${c.nx}×${c.ny}×${c.nz})</dd>
      <dt>최대 질량</dt><dd>약 ${c.mass} kg</dd>
      <dt>발전</dt><dd>${c.power}</dd>
      <dt>자세제어</dt><dd>${c.adcs}</dd>
      <dt>통신</dt><dd>${c.comm}</dd>
      <dt>추진</dt><dd>${c.prop}</dd>
      <dt>태양전지 날개</dt><dd>${c.wings ? `${c.wings.faces.length}개 × ${c.wings.panels}장` : '없음 (몸체 부착형)'}</dd>
      <dt>탑재체 공간</dt><dd>약 ${c.payloadU.toFixed(1)}U (${Math.round(c.payloadFrac * 100)}%)</dd>
      <dt>예</dt><dd>${c.ex}</dd>
    </dl>
    <div class="vol">${volBar(c)}</div>`;
}
function volBar(c) {
  const by = {};
  c.modules.forEach((m) => { by[m[0]] = (by[m[0]] || 0) + m[4] * m[5] * m[6]; });
  const tot = Object.values(by).reduce((a, b) => a + b, 0);
  return `<div class="vbar">${Object.entries(by).map(([k, v]) => `<i style="width:${(v / tot * 100).toFixed(1)}%;background:#${new THREE.Color(SYS[k].color).getHexString()}" title="${SYS[k].name} ${(v / tot * 100).toFixed(0)}%"></i>`).join('')}</div><div class="vcap">내부 부피 배분 (색 = 서브시스템)</div>`;
}
function renderCompareSpec() {
  const maxP = Math.max(...CONFIGS.map((c) => c.powerN));
  const row = (label, fn, unit, max, color) => `<div class="crow"><b>${label}</b>${CONFIGS.map((c) => { const v = fn(c); return `<div class="cbar"><span>${c.id}</span><i style="width:${Math.max(3, v / max * 100)}%;background:${color}"></i><em>${unit(v)}</em></div>`; }).join('')}</div>`;
  $('spec').innerHTML = `<div class="big">크기별 비교 <span>실제 크기 비율</span></div>
    ${row('부피 (1U 개수)', (c) => c.u, (v) => v + 'U', 16, '#ffd166')}
    ${row('최대 질량', (c) => c.mass, (v) => v + ' kg', 32, '#6cc3f0')}
    ${row('대표 발전량', (c) => c.powerN, (v) => '≈' + v + ' W', maxP, '#6dffa8')}
    ${row('탑재체 공간', (c) => c.payloadU, (v) => v.toFixed(1) + 'U', Math.max(...CONFIGS.map((c) => c.payloadU)), '#b49cff')}
    <p class="note">크기가 커질수록 생기는 것: 전개형 날개(3U~) → 별센서·정밀 지향, S·X밴드 고속 통신, 추진 모듈(6U~). 발전량은 대표 예시값이며 위성마다 다릅니다.</p>`;
}
function renderLegend() {
  $('legend').innerHTML = Object.values(SYS).map((s) => `<span><i style="background:#${new THREE.Color(s.color).getHexString()}"></i>${s.name}</span>`).join('');
}
$('t-wing').addEventListener('change', (e) => { state.wingT = e.target.checked ? 1 : 0; });
$('t-explode').addEventListener('change', (e) => { state.explodeT = e.target.checked ? 1 : 0; });
$('t-xray').addEventListener('change', (e) => { state.xray = e.target.checked; });
$('t-grid').addEventListener('change', (e) => { state.gridOn = e.target.checked; });
$('t-spin').addEventListener('change', (e) => { state.spin = e.target.checked; });
$('panel-toggle').addEventListener('click', () => $('left').classList.toggle('collapsed'));

// 부품 클릭
const PART = {
  frame: ['구조 프레임', '네 모서리의 알루미늄 레일과 1U마다 있는 테두리. 사출관 안에서 레일이 미끄러져 나간다.'],
  solar: ['몸체 태양전지판', '몸체 측면에 붙은 태양전지. 1U 한 면이 약 2 W — 위성이 작을수록 이 면적이 발전량의 한계가 된다.'],
  wing: ['전개형 태양전지 날개', '발사 때는 몸체에 접혀 있다가 궤도에서 펼친다. 3U부터 쓰며, 날개 덕분에 발전량이 몸체만 쓸 때보다 몇 배로 커진다.'],
  uhf: ['UHF 테이프 안테나', '약 17 cm 탄성 테이프 4개. 거의 모든 큐브위성이 기본 명령·비컨용으로 단다.'],
  lens: ['카메라·망원경 개구부', '탑재체가 지구(또는 우주)를 보는 창. 위성이 길어질수록 초점거리가 긴 망원경을 넣어 더 세밀하게 찍는다.'],
  patch: ['S·X밴드 패치 안테나', '납작한 금빛 안테나. UHF보다 수십~수백 배 빠르게 영상 데이터를 내려보낸다.'],
  thruster: ['추력기 노즐', '궤도를 바꾸거나 유지하는 추진 장치의 출구. 3U에서는 선택, 6U 이상에서 흔하다.'],
  star: ['별센서', '별 사진으로 위성의 방향을 0.01° 수준까지 알아낸다. 정밀 촬영·심우주 통신에 필요.'],
};
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let down = null; let hl = null;
canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
  const rc = canvas.getBoundingClientRect();
  mouse.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const target = state.mode === 'single' && singleSat ? singleSat.root : compareGroup;
  const hits = ray.intersectObject(target, true).filter((h) => h.object.userData.part && h.object.visible);
  if (state.mode === 'compare' && hits.length) {
    const idx = compareSats.findIndex((s) => { let o = hits[0].object; while (o) { if (o === s.root) return true; o = o.parent; } return false; });
    if (idx >= 0) { showSingle(idx); return; }
  }
  selectPart(hits.length ? hits[0].object : null);
});
function selectPart(obj) {
  if (hl) { hl.material.emissive && hl.material.emissive.setHex(0); hl = null; }
  if (!obj) { $('partcard').classList.add('hidden'); return; }
  const p = obj.userData.part;
  let title, desc, sys;
  if (p[0] === 'module') { const s = SYS[p[1]]; title = p[2] ? `${s.name} · ${p[2]}` : s.name; desc = s.desc; sys = s.name; }
  else { [title, desc] = PART[p[0]]; sys = '외부 장비'; }
  $('pc-sys').textContent = sys; $('pc-name').textContent = title; $('pc-desc').textContent = desc;
  $('partcard').classList.remove('hidden');
}
$('pc-close').addEventListener('click', () => selectPart(null));

function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

// ---------------------------------------------------------------------
// 루프
// ---------------------------------------------------------------------
const tmp = new THREE.Vector3();
function apply(sat, explode, xray, gridOn) {
  sat.panels.forEach((p) => { p.g.position.copy(p.home).addScaledVector(p.n, explode * 1.1); if (p.mat.transparent !== undefined) { p.mat.transparent = true; p.mat.opacity = xray ? 0.15 : 1; p.mat.depthWrite = !xray; } });
  const S = sat.cfg.size;
  sat.modules.forEach((m) => {
    const dir = v3(m.c.x / Math.max(0.01, S.x / 2), m.c.y / Math.max(0.01, S.y / 2), m.c.z / (S.z / 2));
    m.mesh.position.copy(m.home).add(v3(dir.x * 0.5, dir.y * 0.5, dir.z * 0.9).multiplyScalar(explode));
  });
  sat.wings.forEach((w) => w.hinge.children.forEach((p) => p.material.forEach && p.material.forEach((mm) => { mm.transparent = xray; mm.opacity = xray ? 0.25 : 1; })));
  sat.grid.visible = gridOn;
}
function frame() {
  state.wing += (state.wingT - state.wing) * 0.06;
  state.explode += (state.explodeT - state.explode) * 0.1;
  if (state.mode === 'single' && singleSat) {
    setWing(singleSat, state.wing); apply(singleSat, state.explode, state.xray, state.gridOn);
    if (state.spin) singleSat.root.rotation.y += 0.003;
  } else {
    compareSats.forEach((s) => { setWing(s, 0); apply(s, state.explode * 0.6, state.xray, state.gridOn); if (state.spin) s.root.rotation.y += 0.003; });
    // 이름표
    const rc = canvas.getBoundingClientRect();
    labels.innerHTML = '';
    [...compareSats.map((s) => ({ obj: s.root, text: s.cfg.id, y: s.cfg.size.z + 0.9 })), { obj: phone, text: phone.userData.label, y: 2.0 }].forEach(({ obj, text, y }) => {
      obj.getWorldPosition(tmp); tmp.y = y; tmp.project(camera);
      if (tmp.z > 1) return;
      const d = document.createElement('div'); d.className = 'lbl'; d.textContent = text;
      d.style.transform = `translate(${(tmp.x + 1) / 2 * rc.width}px, ${(1 - tmp.y) / 2 * rc.height}px) translate(-50%, -100%)`;
      labels.appendChild(d);
    });
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

renderLegend(); resize(); showSingle(2);
requestAnimationFrame(frame);
