import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const $ = (id) => document.getElementById(id);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

// =====================================================================
// 큐브위성 크기 (m)
// =====================================================================
const CU = { '1U': [0.1, 0.1, 0.114], '3U': [0.1, 0.1, 0.34], '6U': [0.113, 0.226, 0.366], '12U': [0.226, 0.226, 0.366], '16U': [0.226, 0.226, 0.454] };

// =====================================================================
// 발사별 데이터 (공개 보도 기반, 크기·배치는 단순화)
// =====================================================================
const MISSIONS = [
  {
    id: 1, title: '누리호 1차', date: '2021년 10월 21일', orbit: '목표 700 km', result: '궤도 진입 실패', resultCls: 'bad',
    summary: '실제 위성 대신 1.5톤 알루미늄 위성모사체를 실었다. 비행·분리는 했지만 3단 엔진이 예정보다 일찍 꺼져 속도가 모자라 궤도에 오르지 못했다.',
    mains: [{ key: 'dummy', name: '위성모사체', org: '항우연', mission: '1.5톤 탑재 능력 확인용 알루미늄 덩어리 (교신 기능 없음)', size: [1.2, 1.0, 1.2], kind: 'dummy', mass: '1.5 t' }],
    cubes: [],
    seq: [
      { t: 1, type: 'fairing', label: '페어링 분리', real: '이륙 후 약 3분 50초' },
      { t: 4, type: 'burn', label: '3단 엔진 연소 (계획보다 일찍 종료)', real: '' },
      { t: 6, type: 'sep', who: 'dummy', label: '위성모사체 분리', real: '이륙 후 약 16분' },
      { t: 8.5, type: 'fail', label: '속도 부족 → 궤도 진입 실패', real: '' },
    ],
  },
  {
    id: 2, title: '누리호 2차', date: '2022년 6월 21일', orbit: '700 km', result: '성공', resultCls: 'good',
    summary: '큐브위성 4기를 품은 성능검증위성(162.5 kg)과 1.3톤 위성모사체를 실었다. 큐브위성은 누리호가 아니라 궤도에 오른 성능검증위성에서 이틀 간격으로 하나씩 사출됐다.',
    mains: [
      { key: 'dummy2', name: '위성모사체', org: '항우연', mission: '1.3톤 무게 맞춤용 모사체 (교신 없음)', size: [1.1, 0.75, 1.1], kind: 'dummy', mass: '1.3 t' },
      { key: 'pvsat', name: '성능검증위성', org: '항우연', mission: '누리호 성능 검증 + 국산 우주기술 실증, 큐브위성 4기를 품고 올라감', size: [0.75, 0.9, 0.75], kind: 'pvsat', mass: '162.5 kg', stackOn: 'dummy2' },
    ],
    inner: [ // 성능검증위성 안의 큐브위성
      { key: 'step2', name: '스텝큐브랩-2', org: '조선대', mission: '가시광·적외선으로 한반도 열 변화 관측 (백두산 천지 감시)', size: '6U' },
      { key: 'randev', name: '랑데브', org: 'KAIST', mission: '초분광 카메라 지구관측', size: '3U' },
      { key: 'snu2', name: '스누글라이트-2', org: '서울대', mission: 'GPS 전파엄폐(RO)로 지구 대기 관측', size: '3U' },
      { key: 'miman', name: '미먼', org: '연세대', mission: '미세먼지 모니터링', size: '3U' },
    ],
    cubes: [],
    seq: [
      { t: 1, type: 'fairing', label: '페어링 분리', real: '이륙 후 약 3분 50초' },
      { t: 4, type: 'sep', who: 'pvsat', label: '성능검증위성 분리', real: '이륙 후 약 15분 (6/21)' },
      { t: 6.5, type: 'sep', who: 'dummy2', label: '위성모사체 분리', real: '' },
      { t: 9, type: 'skip', label: '⏩ 8일 후 — 성능검증위성 자세 안정화', real: '6/29', focus: 'pvsat' },
      { t: 10.5, type: 'innerEject', who: 'step2', label: '스텝큐브랩-2 사출', real: '6월 29일' },
      { t: 12.5, type: 'innerEject', who: 'randev', label: '랑데브 사출', real: '7월 1일' },
      { t: 14.5, type: 'innerEject', who: 'snu2', label: '스누글라이트-2 사출', real: '7월 3일' },
      { t: 16.5, type: 'innerEject', who: 'miman', label: '미먼 사출', real: '7월 5일' },
    ],
  },
  {
    id: 3, title: '누리호 3차', date: '2023년 5월 25일', orbit: '550 km', result: '성공 (8기 중 7기 사출)', resultCls: 'good',
    summary: '첫 실용위성 발사. 주탑재 차세대소형위성 2호와 큐브위성 7기(도요샛 4기 + 기업 3기)를 실었다. 큐브위성 7기는 모두 3단의 사출관에서 스프링으로 밀려 나갔고, 도요샛 3호 ‘다솔’은 사출관 문이 열리지 않은 것으로 추정됐다.',
    mains: [{ key: 'ns2', name: '차세대소형위성 2호', org: 'KAIST 인공위성연구소', mission: '영상레이더(SAR)로 북극 빙하·산림 변화 관측', size: [0.9, 1.1, 0.9], kind: 'sat' }],
    cubes: [
      { key: 'snipe1', name: '도요샛 1호 가람', org: '한국천문연구원', mission: '4기 편대비행으로 우주날씨(플라스마) 관측', size: '6U' },
      { key: 'snipe2', name: '도요샛 2호 나래', org: '한국천문연구원', mission: '편대비행 우주날씨 관측', size: '6U' },
      { key: 'snipe3', name: '도요샛 3호 다솔', org: '한국천문연구원', mission: '편대비행 우주날씨 관측', size: '6U', fail: true },
      { key: 'snipe4', name: '도요샛 4호 라온', org: '한국천문연구원', mission: '편대비행 우주날씨 관측', size: '6U' },
      { key: 'lumir', name: 'LUMIR-T1', org: '루미르', mission: '우주방사선 측정·국산 부품 실증', size: '6U' },
      { key: 'jac', name: 'JAC', org: '져스텍', mission: '지구관측 광학 탑재체 실증', size: '6U' },
      { key: 'ksat', name: 'KSAT3U', org: '카이로스페이스', mission: '편광 지구관측 + 임무 후 자동 궤도이탈 실증', size: '3U' },
    ],
    seq: [
      { t: 1, type: 'fairing', label: '페어링 분리', real: '' },
      { t: 3.5, type: 'sep', who: 'ns2', label: '차세대소형위성 2호 분리', real: '이륙 후 약 13분' },
      { t: 6, type: 'eject', who: ['snipe1', 'snipe2'], label: '도요샛 1·2호 사출', real: '' },
      { t: 8, type: 'eject', who: ['snipe3', 'snipe4'], label: '도요샛 3호(문 미개방) · 4호 사출', real: '' },
      { t: 10, type: 'eject', who: ['lumir', 'jac'], label: 'LUMIR-T1 · JAC 사출', real: '' },
      { t: 12, type: 'eject', who: ['ksat'], label: 'KSAT3U 사출', real: '' },
    ],
  },
  {
    id: 4, title: '누리호 4차', date: '2025년 11월 27일', orbit: '600 km', result: '성공 (13기 모두 사출·교신)', resultCls: 'good',
    summary: '한화에어로스페이스가 제작을 처음 총괄한 첫 민간 주도 발사이자 첫 야간 발사. 차세대중형위성 3호(516 kg)를 먼저 분리한 뒤, 큐브위성 12기를 2기씩 약 20초 간격으로 사출했다. 총 탑재 질량 약 960 kg.',
    mains: [{ key: 'cas3', name: '차세대중형위성 3호', org: '항우연', mission: '오로라·대기광 관측, 우주 바이오·핵심기술 검증', size: [1.3, 1.6, 1.3], kind: 'sat', mass: '516 kg' }],
    cubes: [
      { key: 'spirone', name: '스파이론', org: '세종대', mission: '해양쓰레기 관측', size: '3U' },
      { key: 'perset', name: '퍼셋', org: '쿼터니언', mission: '지구관측 기술 실증', size: '3U' },
      { key: 'urotech', name: '우주로테크 위성', org: '우주로테크', mission: '위성 폐기(궤도이탈) 장치 실증', size: '3U' },
      { key: 'jack3', name: '잭-003', org: '코스모웍스', mission: '광학 지구관측', size: '6U' },
      { key: 'jack4', name: '잭-004', org: '코스모웍스', mission: '광학 지구관측', size: '6U' },
      { key: 'inharo', name: '인하로샛', org: '인하대', mission: '태양전지 모듈 우주 실험', size: '3U' },
      { key: 'khero', name: 'K-HERO', org: 'KAIST', mission: '3U, 30 W급 초소형 홀추력기 검증', size: '3U' },
      { key: 'sejong4', name: '세종 4호', org: '한컴인스페이스', mission: '지구관측', size: '6U' },
      { key: 'snu3', name: '스누글라이트', org: '서울대', mission: '지구 대기 관측', size: '3U' },
      { key: 'bee', name: 'BEE-1000 (비천)', org: '스페이스린텍', mission: '우주에서 면역항암제 단백질 결정화 실험', size: '3U' },
      { key: 'etri', name: '에트리샛', org: 'ETRI', mission: '저궤도 통신(6G) 실험', size: '6U' },
      { key: 'eee', name: 'EEE 테스터-1', org: '항우연 (나라스페이스 개발)', mission: '국산 소자·부품 우주 검증', size: '6U' },
    ],
    seq: [
      { t: 1, type: 'fairing', label: '페어링 분리', real: '' },
      { t: 3.5, type: 'sep', who: 'cas3', label: '차세대중형위성 3호 분리', real: '고도 약 601 km' },
      { t: 6, type: 'eject', who: ['spirone', 'perset'], label: '세종대 · 쿼터니언', real: '+0 s' },
      { t: 7.6, type: 'eject', who: ['urotech', 'jack3'], label: '우주로테크 · 코스모웍스', real: '+20 s' },
      { t: 9.2, type: 'eject', who: ['jack4', 'inharo'], label: '코스모웍스 · 인하대', real: '+40 s' },
      { t: 10.8, type: 'eject', who: ['khero', 'sejong4'], label: 'KAIST · 한컴인스페이스', real: '+60 s' },
      { t: 12.4, type: 'eject', who: ['snu3', 'bee'], label: '서울대 · 스페이스린텍', real: '+80 s' },
      { t: 14, type: 'eject', who: ['etri', 'eee'], label: 'ETRI · 항우연', real: '+100 s' },
    ],
  },
  {
    id: 5, title: '누리호 5차', date: '2026년 10월 7일', orbit: '570 km', result: '성공 (15기 중 14기 사출)', resultCls: 'good',
    summary: '국내 첫 군집위성 투입. 초소형군집위성(네온샛) 2~6호 5기를 차례로 분리한 뒤 큐브위성 10기를 2기씩 10초 간격으로 사출했다. 쿼터니언의 PERSAT-02는 사출관 문이 열리지 않아 분리되지 못했다. 처음으로 예정 일시 그대로 발사했다.',
    mains: [2, 3, 4, 5, 6].map((k) => ({ key: 'neon' + k, name: `초소형군집위성 ${k}호`, org: '우주항공청·KAIST·쎄트렉아이', mission: '흑백 1 m·컬러 4 m급 광학 카메라, 여러 대가 한반도를 자주 촬영', size: [0.45, 0.85, 0.45], kind: 'neon', mass: '100 kg 미만' })),
    cubes: [
      { key: 'gbsat', name: 'GBSAT (지비샛)', org: 'KAIST 학부생 연합', mission: '지구 자기장에 정렬된 고에너지 양성자 측정 · 10×10×34.05 cm, 3.27 kg', size: '3U' },
      { key: 'cpsat', name: 'CPSat', org: '조선대', mission: '레이저광 위성통신 실증', size: '6U' },
      { key: 'djsat', name: '대전샛-1호', org: '대전시 · 스텝랩 등', mission: '16U 관측 위성, 진동저감형 16U 사출관 시험', size: '16U' },
      { key: 'uel', name: 'UEL-Y-Sys (율리시스)', org: '무인탐사연구소', mission: '미세먼지 관측 + 달 로봇용 컴퓨터 검증', size: '6U' },
      { key: 'sledge', name: 'SLEDGE', org: '오앤비스페이스', mission: '전리권(지구 대기) 관측', size: '3U' },
      { key: 'sd1', name: 'SD-1 SAT', org: '스페이스앤빈', mission: '남대서양 방사선 데이터 수집', size: '3U' },
      { key: 'persat', name: 'PERSAT-02 (퍼샛)', org: '쿼터니언', mission: '제주도 해양쓰레기·해류 감시', size: '6U', fail: true },
      { key: 'jack7', name: 'JACK-007', org: '코스모웍스', mission: '지구관측 초소형 위성', size: '6U' },
      { key: 'e3', name: 'E3 Tester', org: '항우연', mission: '국산 반도체 소자·부품 검증', size: '6U' },
      { key: 'bio5', name: '우주제약 실험 위성', org: '국내 기업', mission: '우주 환경 제약 실험 (명칭 단순화)', size: '3U' },
    ],
    seq: [
      { t: 1, type: 'fairing', label: '페어링 분리', real: '' },
      { t: 3.5, type: 'sep', who: 'neon2', label: '초소형군집위성 2호 분리', real: '이륙 후 약 13분' },
      { t: 5, type: 'sep', who: 'neon3', label: '3호 분리', real: '' },
      { t: 6.5, type: 'sep', who: 'neon4', label: '4호 분리', real: '' },
      { t: 8, type: 'sep', who: 'neon5', label: '5호 분리', real: '' },
      { t: 9.5, type: 'sep', who: 'neon6', label: '6호 분리', real: '' },
      { t: 11.5, type: 'eject', who: ['gbsat', 'cpsat'], label: 'GBSAT · CPSat', real: '+0 s' },
      { t: 12.8, type: 'eject', who: ['djsat', 'uel'], label: '대전샛-1호 · 율리시스', real: '+10 s' },
      { t: 14.1, type: 'eject', who: ['sledge', 'sd1'], label: 'SLEDGE · SD-1 SAT', real: '+20 s' },
      { t: 15.4, type: 'eject', who: ['persat', 'jack7'], label: 'PERSAT-02(문 미개방) · JACK-007', real: '+30 s' },
      { t: 16.7, type: 'eject', who: ['e3', 'bio5'], label: 'E3 Tester · 우주제약 위성', real: '+40 s' },
      { t: 18.5, type: 'avoid', label: '3단 충돌 회피 기동', real: '' },
    ],
  },
];

// =====================================================================
// 렌더러
// =====================================================================
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02040c);
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 3000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.minDistance = 2; controls.maxDistance = 60;
scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x10182e, 0.8));
const sun = new THREE.DirectionalLight(0xfff2dd, 2.0); sun.position.set(8, 6, 10); scene.add(sun);
const rimL = new THREE.DirectionalLight(0x6f9cff, 0.6); rimL.position.set(-8, 2, -6); scene.add(rimL);
{ // 별
  const n = 2500, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, s = Math.sqrt(1 - u * u); p.set([900 * s * Math.cos(a), 900 * u, 900 * s * Math.sin(a)], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false })));
}
// 지구 (아래쪽 큰 곡면)
const earth = new THREE.Mesh(new THREE.SphereGeometry(400, 96, 64), new THREE.MeshPhongMaterial({ color: 0x1d4f8f, emissive: 0x061a33, shininess: 20 }));
earth.position.set(0, -420, -60); scene.add(earth);
{ const atm = new THREE.Mesh(new THREE.SphereGeometry(404, 96, 64), new THREE.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: 0.12, side: THREE.BackSide })); atm.position.copy(earth.position); scene.add(atm); }

// 텍스처
function cellTex(color = '#1b2a6b') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#b9bec6'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = color; g.fillRect(6 + i * 60, 6 + j * 60, 56, 56); g.strokeStyle = 'rgba(200,210,240,0.4)'; for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(6 + i * 60 + k * 9, 6 + j * 60); g.lineTo(6 + i * 60 + k * 9, 62 + j * 60); g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const TEX_CELL = cellTex();
const M = {
  white: new THREE.MeshStandardMaterial({ color: 0xe9ecef, metalness: 0.2, roughness: 0.5 }),
  stage: new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.3, roughness: 0.45 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x3a3f48, metalness: 0.6, roughness: 0.5 }),
  al: new THREE.MeshStandardMaterial({ color: 0xb8bec8, metalness: 0.9, roughness: 0.3 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd4a447, metalness: 0.9, roughness: 0.35 }),
  mli: new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.8, roughness: 0.4 }),
  cell: new THREE.MeshStandardMaterial({ map: TEX_CELL, metalness: 0.4, roughness: 0.35 }),
  dummy: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.95, roughness: 0.28 }),
  fairing: new THREE.MeshStandardMaterial({ color: 0xf1f3f5, metalness: 0.15, roughness: 0.5, side: THREE.DoubleSide, transparent: true }),
  deployer: new THREE.MeshStandardMaterial({ color: 0x5b6472, metalness: 0.7, roughness: 0.45 }),
  black: new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.6 }),
  flag: new THREE.MeshStandardMaterial({ color: 0x1b4fa0 }),
};
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (r1, r2, h, m, s = 48) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s), m);

// =====================================================================
// 모델 빌더
// =====================================================================
const R3 = 1.3; // 3단 반지름 (지름 2.6 m)
function buildStage() {
  const g = new THREE.Group();
  const body = cyl(R3, R3, 3.2, M.stage); body.position.y = -1.6; g.add(body);
  const band = cyl(R3 + 0.01, R3 + 0.01, 0.12, M.dark); band.position.y = -0.06; g.add(band);
  const deck = cyl(R3 - 0.02, R3 - 0.02, 0.06, M.dark); deck.position.y = 0.03; g.add(deck);
  const nozzle = cyl(0.25, 0.55, 0.9, M.dark); nozzle.position.y = -3.65; g.add(nozzle);
  // 태극 마크 대용 띠 + 글자 판
  const lab = box(0.02, 0.9, 0.5, M.flag); lab.position.set(R3 + 0.005, -1.4, 0); g.add(lab);
  return g;
}
function buildFairing() {
  const pts = [];
  for (let i = 0; i <= 30; i++) { const y = i / 30 * 2.6; pts.push(new THREE.Vector2(R3 + 0.03, y)); }
  for (let i = 1; i <= 30; i++) { const s = i / 30; const y = 2.6 + s * 2.9; const r = (R3 + 0.03) * Math.sqrt(1 - s * s * 0.985); pts.push(new THREE.Vector2(Math.max(r, 0.08), y)); }
  const halves = [];
  [0, Math.PI].forEach((start, i) => {
    const geo = new THREE.LatheGeometry(pts, 48, start, Math.PI);
    const m = new THREE.Mesh(geo, M.fairing);
    const piv = new THREE.Group(); piv.add(m); piv.userData.side = i === 0 ? 1 : -1; halves.push(piv);
  });
  return halves;
}
function satBody(size, kind) {
  const [w, h, d] = size, g = new THREE.Group();
  if (kind === 'dummy') {
    const b = cyl(w / 2, w / 2 * 0.95, h, M.dummy, 40); b.position.y = h / 2; g.add(b);
    const ring = cyl(w / 2 * 0.6, w / 2 * 0.6, 0.06, M.dark); ring.position.y = 0.03; g.add(ring);
    return g;
  }
  const mats = [M.cell, M.cell, M.mli, M.white, M.cell, M.cell];
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), kind === 'pvsat' ? [M.mli, M.mli, M.white, M.mli, M.mli, M.mli] : mats); b.position.y = h / 2 + 0.08; g.add(b);
  const ring = cyl(Math.min(w, d) * 0.38, Math.min(w, d) * 0.42, 0.08, M.al); ring.position.y = 0.04; g.add(ring);
  if (kind === 'sat' || kind === 'neon') {
    const ant = cyl(0.03, 0.03, 0.25, M.gold, 12); ant.position.set(w * 0.3, h + 0.2, d * 0.3); g.add(ant);
    const lens = cyl(Math.min(w, d) * 0.22, Math.min(w, d) * 0.22, 0.12, M.black); lens.position.set(0, h + 0.14, 0); g.add(lens);
    // 접힌 태양전지 날개
    const wing = box(0.03, h * 0.85, d * 0.9, M.cell); wing.position.set(w / 2 + 0.03, h / 2 + 0.08, 0); g.add(wing);
    if (kind === 'sat') { const wing2 = wing.clone(); wing2.position.x = -w / 2 - 0.03; g.add(wing2); }
  }
  return g;
}
function cubeMesh(size) {
  const [w, d, h] = CU[size];
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [M.cell, M.cell, M.al, M.al, M.cell, M.cell]); g.add(b);
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => { const r = box(0.012, h + 0.01, 0.012, M.al); r.position.set(sx * w / 2, 0, sz * d / 2); g.add(r); });
  return g;
}
// 사출관: 위성이 들어가는 사각 통 + 앞문(경첩) + 스프링판
function deployer(size) {
  const [w, d, h] = CU[size];
  const W = w + 0.05, D = d + 0.05, L = h + 0.12;
  const g = new THREE.Group();
  const wallM = M.deployer;
  const t = 0.012;
  const walls = [[t, L, D, -W / 2, 0], [t, L, D, W / 2, 0]];
  walls.forEach(([a, b, c, x]) => { const m = box(a, b, c, wallM); m.position.set(x, L / 2, 0); g.add(m); });
  const bk = box(W, L, t, wallM); bk.position.set(0, L / 2, -D / 2); g.add(bk);
  const fr = box(W, L, t, wallM); fr.position.set(0, L / 2, D / 2); g.add(fr);
  const base = box(W, 0.02, D, M.dark); base.position.y = 0.01; g.add(base);
  const door = new THREE.Group(); door.position.set(0, L, -D / 2); // 경첩
  const dp = box(W, 0.012, D, M.gold); dp.position.set(0, 0.006, D / 2); door.add(dp); g.add(door);
  const spring = box(w * 0.9, 0.012, d * 0.9, M.al); spring.position.y = 0.05; g.add(spring);
  g.userData = { door, spring, L, h };
  return g;
}

// =====================================================================
// 장면 구성 (발사별)
// =====================================================================
const world = new THREE.Group(); scene.add(world);
let cur = null; // 현재 장면 상태
function clearWorld() { while (world.children.length) world.remove(world.children[0]); }
const labelsEl = $('labels');

function setupMission(idx) {
  clearWorld(); labelsEl.innerHTML = '';
  const ms = MISSIONS[idx];
  const st = { ms, objects: {}, stage: buildStage(), fairing: buildFairing(), items: [] };
  world.add(st.stage);
  st.stage.userData.home = st.stage.position.clone();
  st.fairing.forEach((f) => world.add(f));

  // 주탑재 배치
  if (ms.id === 5) { // 다중위성 어댑터 + 네온샛 5기 원형 배치
    const col = cyl(0.28, 0.35, 1.0, M.al); col.position.y = 0.55; st.stage.add(col);
    const top = cyl(0.42, 0.42, 0.05, M.dark); top.position.y = 1.08; st.stage.add(top);
    ms.mains.forEach((m, i) => {
      const a = i / 5 * Math.PI * 2 + 0.3, r = 0.68;
      const obj = satBody(m.size, m.kind); const holder = new THREE.Group(); holder.add(obj);
      obj.rotation.z = 0; holder.position.set(Math.cos(a) * r, 0.12, Math.sin(a) * r);
      holder.lookAt(0, 0.12, 0); holder.rotateY(Math.PI);
      world.add(holder); st.objects[m.key] = { obj: holder, data: m, home: holder.position.clone(), q0: holder.quaternion.clone(), dir: v3(Math.cos(a), 0.35, Math.sin(a)).normalize(), main: true };
    });
  } else {
    let y = 0.06;
    const adapter = cyl(0.42, 0.62, 0.6, M.al); adapter.position.y = y + 0.3; st.stage.add(adapter); y += 0.6;
    ms.mains.forEach((m) => {
      const obj = satBody(m.size, m.kind); const holder = new THREE.Group(); holder.add(obj);
      holder.position.y = y; world.add(holder);
      st.objects[m.key] = { obj: holder, data: m, home: holder.position.clone(), q0: holder.quaternion.clone(), dir: v3(0, 1, 0), main: true };
      y += m.size[1] + 0.12;
      if (m.kind === 'pvsat' && ms.inner) { // 성능검증위성 측면에 내장 사출관
        ms.inner.forEach((c, i) => {
          const dp = deployer(c.size); const a = i / 4 * Math.PI * 2 + Math.PI / 4;
          const hw = m.size[0] / 2;
          dp.rotation.z = -Math.PI / 2; // 옆으로 눕힘: 축(y) → 바깥(x)
          const wrap = new THREE.Group(); wrap.add(dp); wrap.rotation.y = -a;
          wrap.position.set(Math.cos(a) * (hw - dp.userData.L + 0.02), 0.08 + 0.2 + (i % 2) * 0.32, Math.sin(a) * (hw - dp.userData.L + 0.02));
          obj.add(wrap);
          const cube = cubeMesh(c.size); cube.position.y = dp.userData.L - dp.userData.h / 2 - 0.06; dp.add(cube);
          st.objects[c.key] = { obj: cube, data: c, dep: dp, home: cube.position.clone(), inner: true };
        });
        const dmy = deployer('3U'); dmy.rotation.z = -Math.PI / 2; const wr = new THREE.Group(); wr.add(dmy); wr.position.set(0, 0.7, 0); obj.add(wr);
      }
    });
  }
  // 큐브위성 사출관 (3단 상단 원형 배치, 바깥·위쪽을 향함)
  const n = ms.cubes.length;
  ms.cubes.forEach((c, i) => {
    const a = (i + 0.5) / n * Math.PI * 2;
    const dp = deployer(c.size);
    const holder = new THREE.Group(); holder.add(dp);
    holder.position.set(Math.cos(a) * (R3 - 0.22), 0.07, Math.sin(a) * (R3 - 0.22));
    holder.rotation.y = -a; dp.rotation.z = -0.55; // 바깥쪽으로 기울임
    st.stage.add(holder);
    const cube = cubeMesh(c.size); cube.position.y = dp.userData.L - dp.userData.h / 2 - 0.06; dp.add(cube);
    st.objects[c.key] = { obj: cube, data: c, dep: dp, home: cube.position.clone() };
  });
  // 라벨
  Object.entries(st.objects).forEach(([k, o]) => {
    const d = document.createElement('div'); d.className = 'lbl' + (o.main ? ' main' : '') + (o.data.fail ? ' fail' : ''); d.textContent = o.data.name; labelsEl.appendChild(d); o.label = d;
  });
  cur = st; S.t = 0; S.playing = false; S.follow = false; focusKey = null; $('t-follow').checked = false; $('play').textContent = '▶ 발사 시퀀스 재생';
  const end = ms.seq[ms.seq.length - 1].t + 4; S.end = end; $('scrub').max = end; $('scrub').value = 0;
  camera.position.set(6.5, 4.5, 8); controls.target.set(0, 1.4, 0);
  renderInfo(); renderSeq(); renderPayloads();
}

// =====================================================================
// 시간에 따른 상태 (스크럽 가능한 결정적 애니메이션)
// =====================================================================
const S = { t: 0, playing: false, speed: 1, end: 10, showFairing: true, xray: false, labels: true };
function apply(t) {
  const ms = cur.ms;
  // 페어링
  const ev = (type) => ms.seq.find((e) => e.type === type);
  const fe = ev('fairing'); const fp = fe ? clamp((t - fe.t) / 2.5, 0, 1) : 0;
  cur.fairing.forEach((f) => {
    const s = f.userData.side;
    f.position.set(s * fp * 6, fp * 1.5, 0);
    f.rotation.z = -s * ease(fp) * 0.9;
    f.visible = S.showFairing && fp < 1;
  });
  M.fairing.opacity = S.xray ? 0.22 : 1; M.fairing.depthWrite = !S.xray;
  // 3단
  const av = ev('avoid');
  const burn = ev('burn');
  cur.stage.position.copy(cur.stage.userData.home);
  if (av) cur.stage.position.y -= Math.max(0, t - av.t) * 0.6;
  // 분리
  ms.seq.forEach((e) => {
    if (e.type === 'sep') {
      const o = cur.objects[e.who]; const dt = Math.max(0, t - e.t);
      const dist = dt > 0 ? 3.2 * (1 - Math.exp(-dt * 0.55 / 3.2)) + 0.02 : 0; // 멀어지다 화면 안에서 천천히
      o.obj.position.copy(o.home).addScaledVector(o.dir, dist);
      o.obj.quaternion.copy(o.q0); if (dt > 0) o.obj.rotateOnAxis(v3(0.3, 1, 0.2).normalize(), dt * 0.06);
      o.sepT = e.t;
      if (ms.id === 1 && dt > 0) { // 1차: 궤도 진입 실패 → 지구 쪽으로 떨어지는 연출
        const fail = ms.seq.find((x) => x.type === 'fail');
        const f = Math.max(0, t - fail.t); o.obj.position.y -= f * f * 0.35; cur.stage.position.y -= f * f * 0.32;
      }
    }
    if (e.type === 'eject' || e.type === 'innerEject') {
      const list = Array.isArray(e.who) ? e.who : [e.who];
      list.forEach((k, j) => {
        const o = cur.objects[k]; const t0 = e.t + j * 0.35; const dt = t - t0;
        const door = o.dep.userData.door;
        if (o.data.fail) { door.rotation.x = 0; o.obj.position.copy(o.home); o.failed = dt > 0; return; }
        door.rotation.x = -ease(dt / 0.4) * 2.0;
        const push = dt > 0.3 ? (dt - 0.3) : 0;
        o.dep.userData.spring.position.y = 0.05 + Math.min(push * 1.2, o.dep.userData.L - 0.2);
        o.obj.position.copy(o.home); o.obj.position.y += push * 1.1;
        o.obj.rotation.set(push * 0.15, push * 0.2, 0);
      });
    }
  });
  // 2차: 성능검증위성은 8일 후 장면에서 계속 떠 있음 (별도 처리 불필요)
  // 1차 연소 플래시 / 엔진 불꽃
  flame.visible = !!burn && t > burn.t && t < burn.t + 1.8;
  if (flame.visible) { flame.position.copy(cur.stage.position).add(v3(0, -4.4, 0)); flame.scale.y = 0.8 + Math.random() * 0.3; }
  // 현재 이벤트 강조
  let curE = -1; ms.seq.forEach((e, i) => { if (t >= e.t) curE = i; });
  if (curE !== S.lastE) { S.lastE = curE; const ce = ms.seq[curE]; if (ce && ce.focus && S.playing) { focusObj(ce.focus); S.follow = true; $('t-follow').checked = true; } document.querySelectorAll('#seq li').forEach((li, i) => { li.classList.toggle('done', i < curE); li.classList.toggle('now', i === curE); }); if (curE >= 0) $('banner').innerHTML = `<b>${ms.seq[curE].label}</b>${ms.seq[curE].real ? `<span>${ms.seq[curE].real}</span>` : ''}`; else $('banner').innerHTML = '<b>발사 대기</b><span>▶ 재생을 누르세요</span>'; $('banner').className = ms.seq[curE] && (ms.seq[curE].type === 'fail') ? 'bad' : ''; }
  $('tlabel').textContent = `${t.toFixed(1)} / ${S.end.toFixed(0)}`;
}
const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.2, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.75 }));
flame.rotation.x = Math.PI; scene.add(flame); flame.visible = false;

// =====================================================================
// UI
// =====================================================================
function renderTabs() {
  $('tabs').innerHTML = MISSIONS.map((m, i) => `<button data-i="${i}" class="${cur && cur.ms === m ? 'on' : ''}">${m.id}차<small>${m.date.replace(/년 |월 /g, '.').replace('일', '')}</small></button>`).join('');
  $('tabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { setupMission(+b.dataset.i); renderTabs(); }));
}
function renderInfo() {
  const ms = cur.ms;
  const total = ms.mains.length + ms.cubes.length + (ms.inner ? ms.inner.length : 0);
  $('info').innerHTML = `<div class="mt">${ms.title}</div><div class="md">${ms.date} · 궤도 ${ms.orbit}</div>
    <div class="res ${ms.resultCls}">${ms.result}</div><p>${ms.summary}</p>
    <div class="cnt">탑재 ${total}기 · 주탑재 ${ms.mains.length} · 큐브위성 ${ms.cubes.length + (ms.inner ? ms.inner.length : 0)}</div>`;
}
function renderSeq() {
  $('seq').innerHTML = cur.ms.seq.map((e, i) => `<li data-t="${e.t}"><span class="n">${i + 1}</span><span class="l">${e.label}</span>${e.real ? `<span class="r">${e.real}</span>` : ''}</li>`).join('');
  $('seq').querySelectorAll('li').forEach((li) => li.addEventListener('click', () => { S.t = +li.dataset.t + 0.01; S.playing = false; $('play').textContent = '▶ 이어서 재생'; S.lastE = null; }));
  S.lastE = null;
}
function renderPayloads() {
  const ms = cur.ms;
  const row = (c, tag) => `<li data-k="${c.key}" class="${c.fail ? 'fail' : ''}"><div><b>${c.name}</b> <span class="tag">${tag}</span>${c.fail ? ' <span class="tag bad">미사출</span>' : ''}</div><div class="sub">${c.org} · ${c.mission}${c.mass ? ' · ' + c.mass : ''}</div></li>`;
  $('payloads').innerHTML = ms.mains.map((m) => row(m, '주탑재')).join('') + (ms.inner || []).map((c) => row(c, c.size + ' · 성능검증위성 내장')).join('') + ms.cubes.map((c) => row(c, c.size + ' 큐브위성')).join('');
  $('payloads').querySelectorAll('li').forEach((li) => li.addEventListener('click', () => focusObj(li.dataset.k)));
}
let focusKey = null;
function focusObj(k) {
  focusKey = k; const o = cur.objects[k]; if (!o) return;
  const p = o.obj.getWorldPosition(v3());
  controls.target.copy(p); camera.position.copy(p).add(v3(1.6, 1.0, 2.0).multiplyScalar(o.main ? 1.6 : 0.7));
  document.querySelectorAll('#payloads li').forEach((li) => li.classList.toggle('on', li.dataset.k === k));
}
$('play').addEventListener('click', () => {
  if (S.t >= S.end) S.t = 0;
  S.playing = !S.playing; $('play').textContent = S.playing ? '⏸ 일시정지' : '▶ 이어서 재생';
});
$('restart').addEventListener('click', () => { S.t = 0; S.playing = true; $('play').textContent = '⏸ 일시정지'; S.lastE = null; camera.position.set(6.5, 4.5, 8); controls.target.set(0, 1.4, 0); });
$('scrub').addEventListener('input', (e) => { S.t = +e.target.value; S.playing = false; $('play').textContent = '▶ 이어서 재생'; });
document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => { S.speed = +b.dataset.speed; document.querySelectorAll('[data-speed]').forEach((x) => x.classList.toggle('on', x === b)); }));
$('t-fairing').addEventListener('change', (e) => { S.showFairing = e.target.checked; });
$('t-xray').addEventListener('change', (e) => { S.xray = e.target.checked; });
$('t-labels').addEventListener('change', (e) => { S.labels = e.target.checked; });
$('t-follow').addEventListener('change', (e) => { S.follow = e.target.checked; });
$('panel-toggle').addEventListener('click', () => $('left').classList.toggle('collapsed'));

// 클릭으로 위성 선택
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let down = null;
canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
  const r = canvas.getBoundingClientRect(); mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hits = ray.intersectObjects(Object.values(cur.objects).map((o) => o.obj), true);
  if (!hits.length) return;
  let ob = hits[0].object; const entry = Object.entries(cur.objects).find(([, o]) => { let x = ob; while (x) { if (x === o.obj) return true; x = x.parent; } return false; });
  if (entry) { focusObj(entry[0]); const li = document.querySelector(`#payloads li[data-k="${entry[0]}"]`); if (li) li.scrollIntoView({ block: 'nearest' }); }
});

function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

// =====================================================================
// 루프
// =====================================================================
let last = performance.now(); const tmp = v3();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (S.playing) { S.t += dt * S.speed; if (S.t >= S.end) { S.t = S.end; S.playing = false; $('play').textContent = '↺ 다시 재생'; } $('scrub').value = S.t; }
  apply(S.t);
  if (S.follow && focusKey && cur.objects[focusKey]) { const p = cur.objects[focusKey].obj.getWorldPosition(v3()); const off = camera.position.clone().sub(controls.target); controls.target.lerp(p, 0.15); camera.position.copy(controls.target).add(off); }
  controls.update();
  renderer.render(scene, camera);
  // 라벨
  const r = canvas.getBoundingClientRect();
  Object.values(cur.objects).forEach((o) => {
    if (!S.labels) { o.label.style.display = 'none'; return; }
    o.obj.getWorldPosition(tmp); tmp.y += o.main ? 0.2 : 0.12; tmp.project(camera);
    // 페어링이 닫혀 있고 투명 보기가 아니면 숨김
    const hidden = S.showFairing && !S.xray && cur.fairing[0].visible && Math.abs(cur.fairing[0].position.x) < 0.5;
    if (tmp.z > 1 || hidden) { o.label.style.display = 'none'; return; }
    o.label.style.display = 'block';
    o.label.style.transform = `translate(${(tmp.x + 1) / 2 * r.width}px, ${(1 - tmp.y) / 2 * r.height}px) translate(-50%, -100%)`;
    o.label.classList.toggle('sel', focusKey && cur.objects[focusKey] === o);
    o.label.classList.toggle('failnow', !!o.failed);
  });
  requestAnimationFrame(frame);
}
resize(); setupMission(4); renderTabs();
requestAnimationFrame(frame);
