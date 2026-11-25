import * as THREE from 'three';
import { COLOR, CSSCOLOR, stageFloor, glowSprite, damp } from '../lib/kit.js';
import {
  TubeLine, LabelSet, rod, person, makeTextSprite, wavelengthRGB,
  C_LIGHT, photonEV, fmtFreq, fmtLength, fmtEnergyEV,
} from '../lib/wave-kit.js';

// 横轴：log10(波长/米)，从 10³ m（1 km）到 10⁻¹⁴ m，对数刻度铺在 x ∈ [-12, 12]
const LOG_MAX = 3, LOG_MIN = -14;
const X0 = -12, X1 = 12;
const DEC = (X1 - X0) / (LOG_MAX - LOG_MIN); // 每个数量级占的长度
const xOf = (lg) => X0 + (LOG_MAX - lg) * DEC;
const lgOf = (x) => LOG_MAX - (x - X0) / DEC;
const LG_VIS_R = Math.log10(760e-9), LG_VIS_V = Math.log10(380e-9);
const LG_ION = Math.log10(1239.84e-9 / 10); // 光子能量 10 eV 对应的波长 ≈ 124 nm

const WAVE_Y = 1.55, WAVE_A = 0.42, OBJ_Y = 2.45;
const NW = 3000;
const LAM0 = 2.6, LAM_RATIO = 32;
const S_DECAY = (X1 - X0) / Math.log(LAM_RATIO);

const BANDS = [
  {
    key: 'radio', name: '无线电波', btn: '无线电', hi: LOG_MAX, lo: 0, jump: Math.log10(3), color: '#5b4b8a',
    range: 'λ > 1 m（f < 300 MHz）',
    src: '天线中来回振荡的电流；雷电；遥远的星系和脉冲星',
    use: '广播（中波 AM、调频 FM）、电视、对讲机、导航、射电天文望远镜',
    safe: '光子能量极低，<b>非电离</b>，对人体无害。',
  },
  {
    key: 'micro', name: '微波', btn: '微波', hi: 0, lo: -3, jump: Math.log10(0.1224), color: '#3f6fa8',
    range: '1 mm ~ 1 m（300 MHz ~ 300 GHz）',
    src: '微波炉的磁控管、手机和基站、Wi-Fi 路由器、雷达；宇宙大爆炸留下的微波背景辐射',
    use: '手机通信（4G/5G）、Wi-Fi、蓝牙、卫星通信、雷达测速、微波炉加热（2.45 GHz）',
    safe: '<b>非电离</b>。强功率时只有热效应（微波炉就是让食物中的水分子来回转动摩擦生热），手机和 Wi-Fi 的功率远远不足以造成伤害。',
  },
  {
    key: 'ir', name: '红外线', btn: '红外', hi: -3, lo: LG_VIS_R, jump: -5, color: '#8c2f39',
    range: '760 nm ~ 1 mm',
    src: '一切有温度的物体都在发红外线：人体（约 10 μm）、太阳、电暖器、炭火',
    use: '电视遥控器、夜视仪与热成像、额温枪、红外加热、光纤通信（1550 nm）',
    safe: '<b>非电离</b>，主要效果是让物体变热。',
  },
  {
    key: 'vis', name: '可见光', btn: '可见光', hi: LG_VIS_R, lo: LG_VIS_V, jump: Math.log10(550e-9), color: '#ffffff',
    range: '380 ~ 760 nm',
    src: '太阳、灯泡、LED、火焰、萤火虫',
    use: '我们的视觉、照明、摄影、显示屏；植物用它进行光合作用',
    safe: '<b>非电离</b>。但太强的光（直视太阳、激光笔）会灼伤视网膜。',
  },
  {
    key: 'uv', name: '紫外线', btn: '紫外', hi: LG_VIS_V, lo: -8, jump: Math.log10(300e-9), color: '#6a3fc9',
    range: '10 ~ 380 nm',
    src: '太阳（大部分被臭氧层挡住）、紫外消毒灯、电焊弧光',
    use: '杀菌消毒、验钞、让皮肤合成维生素 D、荧光检测',
    safe: '光子能量足以<b>打断化学键</b>：会晒伤皮肤、诱发皮肤癌和白内障，要防晒；波长短于约 124 nm 的紫外线已经能电离原子。',
  },
  {
    key: 'xray', name: 'X 射线', btn: 'X 射线', hi: -8, lo: -11, jump: Math.log10(0.05e-9), color: '#2f8f9d',
    range: '0.01 ~ 10 nm',
    src: 'X 光管中高速电子撞击金属靶；太阳日冕和黑洞周围的高温气体',
    use: '医学拍片和 CT、机场安检、检测焊缝与晶体结构',
    safe: '<b>电离辐射</b>：能把电子从原子中打出来、损伤 DNA。医院拍一次胸片剂量很小，但要避免不必要的照射，医生会用铅板遮挡。',
  },
  {
    key: 'gamma', name: 'γ 射线', btn: 'γ 射线', hi: -11, lo: LOG_MIN, jump: -12, color: '#2e9e6b',
    range: '< 0.01 nm',
    src: '放射性原子核衰变、核反应堆、超新星爆发和宇宙伽马暴',
    use: '放射治疗（伽马刀）、医疗器械和食品辐照灭菌、工业探伤',
    safe: '<b>穿透力最强的电离辐射</b>，需要厚铅板或混凝土屏蔽。',
  },
];

function bandOf(lg) {
  for (const b of BANDS) if (lg <= b.hi + 1e-9 && lg >= b.lo - 1e-9) return b;
  return lg > LOG_MAX ? BANDS[0] : BANDS[BANDS.length - 1];
}
function visColorName(nm) {
  if (nm < 450) return '紫光';
  if (nm < 495) return '蓝光';
  if (nm < 570) return '绿光';
  if (nm < 590) return '黄光';
  if (nm < 620) return '橙光';
  return '红光';
}
/** 波段的颜色（可见光内为真实色） */
function colorAt(lg, out) {
  if (lg <= LG_VIS_R && lg >= LG_VIS_V) return wavelengthRGB(Math.pow(10, lg) * 1e9, out);
  return out.set(bandOf(lg).color);
}
const SUPS = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
function decadeLength(n) {
  const names = { 3: '1 km', 2: '100 m', 1: '10 m', 0: '1 m', '-1': '10 cm', '-2': '1 cm', '-3': '1 mm', '-4': '100 μm', '-5': '10 μm', '-6': '1 μm', '-7': '100 nm', '-8': '10 nm', '-9': '1 nm', '-10': '100 pm', '-11': '10 pm', '-12': '1 pm', '-13': '100 fm', '-14': '10 fm' };
  return names[n];
}
function decadeFreq(n) {
  const f = 3e8 / Math.pow(10, n);
  if (f < 1e15) { const [v, u] = fmtFreq(f); return `${+v} ${u}`; }
  const e = Math.round(Math.log10(f / 3));
  return `3×10${String(e).split('').map((c) => SUPS[c]).join('')} Hz`;
}

/* ---------- 频谱带贴图 ---------- */
function makeBandTexture() {
  const W = 4096, H = 320, HB = 200;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const uOf = (lg) => ((xOf(lg) - X0) / (X1 - X0)) * W;
  // 各波段底色
  for (const b of BANDS) {
    const u0 = uOf(b.hi), u1 = uOf(b.lo);
    if (b.key === 'vis') {
      const c = new THREE.Color();
      for (let u = Math.floor(u0); u <= Math.ceil(u1); u++) {
        const lg = lgOf(X0 + (u / W) * (X1 - X0));
        wavelengthRGB(Math.pow(10, lg) * 1e9, c);
        g.fillStyle = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
        g.fillRect(u, 0, 1.5, HB);
      }
      continue;
    }
    const grd = g.createLinearGradient(0, 0, 0, HB);
    grd.addColorStop(0, b.color);
    grd.addColorStop(1, 'rgba(20,20,28,1)');
    g.fillStyle = grd;
    g.fillRect(u0, 0, u1 - u0, HB);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(u0, 0, u1 - u0, 10);
    // 名称
    g.font = '700 64px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.92)';
    const w = u1 - u0;
    if (w > 180) g.fillText(b.name, (u0 + u1) / 2, HB * 0.48);
  }
  // 分界线
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (const b of BANDS) g.fillRect(uOf(b.lo) - 1, 0, 2, HB);
  // 刻度尺
  g.fillStyle = '#16161c';
  g.fillRect(0, HB, W, H - HB);
  g.textBaseline = 'alphabetic';
  for (let n = LOG_MAX; n >= LOG_MIN; n--) {
    const u = uOf(n);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillRect(u - 1.5, HB, 3, 26);
    for (let k = 2; k < 10 && n > LOG_MIN; k++) {
      const um = uOf(n - 1 + Math.log10(k));
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(um - 1, HB, 2, 12);
    }
    g.textAlign = n === LOG_MAX ? 'left' : n === LOG_MIN ? 'right' : 'center';
    const ux = n === LOG_MAX ? u + 6 : n === LOG_MIN ? u - 6 : u;
    g.font = '600 40px system-ui, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.88)';
    g.fillText(decadeLength(n), ux, HB + 66);
    g.font = '500 30px system-ui, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillText(decadeFreq(n), ux, HB + 106);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ---------- 尺寸对比物（都做成约 1 格高的小模型，底部在 y=0） ---------- */
function mat(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1, ...extra }); }

function makeBuilding() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.05, 0.45), mat(0x5a6578, { metalness: 0.4 }));
  body.position.y = 0.525;
  g.add(body);
  const win = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.09, 0.08), new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd27a, emissiveIntensity: 0.8 }), 18);
  const m = new THREE.Matrix4();
  let k = 0;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) { m.makeTranslation(-0.15 + c * 0.15, 0.17 + r * 0.15, 0.226); win.setMatrixAt(k++, m); }
  g.add(win);
  g.add(rod([0, 1.05, 0], [0, 1.35, 0], 0.015, mat(0xcccccc, { metalness: 0.8 })));
  return g;
}
function makeHuman() {
  const p = person({ scale: 0.62, color: 0x6f86b5 });
  p.rotation.y = -Math.PI / 2;
  return p;
}
function makeButterfly() {
  const g = new THREE.Group();
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xff9f0a, emissive: 0xff7a00, emissiveIntensity: 0.35, side: THREE.DoubleSide, roughness: 0.6 });
  const spotMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.42, 4, 8), mat(0x2a2016));
  body.position.y = 0.5;
  g.add(body);
  const wings = [];
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.5, 0);
    const up = new THREE.Mesh(new THREE.CircleGeometry(0.26, 24), wingMat);
    up.scale.set(1, 0.78, 1);
    up.position.set(s * 0.25, 0.1, 0);
    const lo = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), wingMat);
    lo.position.set(s * 0.17, -0.14, 0);
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), spotMat);
    spot.position.set(s * 0.3, 0.13, 0.003);
    hinge.add(up, lo, spot);
    g.add(hinge);
    wings.push([hinge, s]);
  }
  g.userData.update = (t) => { for (const [h, s] of wings) h.rotation.y = s * (0.15 + 0.75 * (0.5 + 0.5 * Math.sin(t * 8))); };
  return g;
}
function makeNeedle() {
  const g = new THREE.Group();
  const steel = mat(0xd6dae2, { metalness: 0.95, roughness: 0.18 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.05, 1.05, 20), steel);
  cone.rotation.x = Math.PI;
  cone.position.y = 0.55;
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 8, 16), steel);
  eye.position.y = 1.12;
  g.add(cone, eye);
  g.rotation.z = 0.25;
  return g;
}
function makeCell() {
  const g = new THREE.Group();
  const mem = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 20), new THREE.MeshStandardMaterial({ color: 0xff9fb0, transparent: true, opacity: 0.32, roughness: 0.3, depthWrite: false }));
  mem.position.y = 0.45;
  const nuc = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), mat(0x8e5bd6, { emissive: 0x5a2aa0, emissiveIntensity: 0.4 }));
  nuc.position.set(0.05, 0.47, 0);
  g.add(mem, nuc);
  const orgMat = mat(0x6fd08c);
  for (let i = 0; i < 5; i++) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), orgMat);
    const a = i * 1.3;
    o.scale.set(1.6, 1, 1);
    o.position.set(Math.cos(a) * 0.27, 0.45 + Math.sin(a * 1.7) * 0.2, Math.sin(a) * 0.2);
    g.add(o);
  }
  return g;
}
function makeVirus() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), mat(0xd9534f, { emissive: 0x5a1010, emissiveIntensity: 0.3 }));
  core.position.y = 0.45;
  g.add(core);
  const spikeMat = mat(0xffb3a7);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 26; i++) {
    const y = 1 - (i / 25) * 2, r = Math.sqrt(1 - y * y);
    const d = new THREE.Vector3(Math.cos(ga * i) * r, y, Math.sin(ga * i) * r);
    const a = d.clone().multiplyScalar(0.27).add(core.position);
    const b = d.clone().multiplyScalar(0.4).add(core.position);
    g.add(rod(a, b, 0.012, spikeMat, 5));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), spikeMat);
    ball.position.copy(b);
    g.add(ball);
  }
  return g;
}
function makeMolecule() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), mat(0x50555f));
  c.position.y = 0.48;
  g.add(c);
  const hMat = mat(0xf2f2f2), bond = mat(0xaab0bb);
  const dirs = [[0, 1, 0], [0.943, -0.333, 0], [-0.471, -0.333, 0.816], [-0.471, -0.333, -0.816]];
  for (const d of dirs) {
    const v = new THREE.Vector3(...d);
    const p = v.clone().multiplyScalar(0.36).add(c.position);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), hMat);
    h.position.copy(p);
    g.add(h, rod(c.position, p, 0.025, bond, 8));
  }
  return g;
}
function makeAtom() {
  const g = new THREE.Group();
  const center = new THREE.Vector3(0, 0.5, 0);
  const nuc = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), mat(COLOR.proton, { emissive: COLOR.proton, emissiveIntensity: 0.8 }));
  nuc.position.copy(center);
  g.add(nuc);
  const ringMat = new THREE.MeshBasicMaterial({ color: COLOR.electron, transparent: true, opacity: 0.4 });
  const eMat = mat(COLOR.electron, { emissive: COLOR.electron, emissiveIntensity: 1.2 });
  const es = [];
  for (let i = 0; i < 3; i++) {
    const piv = new THREE.Group();
    piv.position.copy(center);
    piv.rotation.set(i * 1.05 + 0.3, i * 0.9, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.006, 4, 64), ringMat);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), eMat);
    piv.add(ring, e);
    g.add(piv);
    es.push([e, i * 2.1]);
  }
  g.userData.update = (t) => { for (const [e, p] of es) { const a = t * 3 + p; e.position.set(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0); } };
  return g;
}
function makeNucleus() {
  const g = new THREE.Group();
  const pm = mat(COLOR.proton, { emissive: COLOR.proton, emissiveIntensity: 0.35 });
  const nm = mat(COLOR.neutron);
  const geo = new THREE.SphereGeometry(0.11, 16, 12);
  const ga = Math.PI * (3 - Math.sqrt(5));
  const N = 16;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), y = 1 - 2 * t, r = Math.sqrt(1 - y * y), rr = 0.22 * Math.cbrt(1 - t * 0.9);
    const m = new THREE.Mesh(geo, i % 2 ? pm : nm);
    m.position.set(Math.cos(ga * i) * r * rr, 0.48 + y * rr, Math.sin(ga * i) * r * rr);
    g.add(m);
  }
  const glow = glowSprite(COLOR.proton, 1.1, 0.35);
  glow.position.y = 0.48;
  g.add(glow);
  return g;
}

const OBJECTS = [
  { name: '建筑', size: '~100 m', lg: 2, make: makeBuilding },
  { name: '人', size: '~1.7 m', lg: 0.23, make: makeHuman },
  { name: '蝴蝶', size: '~5 cm', lg: -1.3, make: makeButterfly },
  { name: '针尖', size: '~0.1 mm', lg: -4, make: makeNeedle },
  { name: '细胞', size: '~10 μm', lg: -5, make: makeCell },
  { name: '病毒', size: '~100 nm', lg: -7, make: makeVirus },
  { name: '分子', size: '~1 nm', lg: -9, make: makeMolecule },
  { name: '原子', size: '~0.1 nm', lg: -10, make: makeAtom },
  { name: '原子核', size: '~10⁻¹⁴ m', lg: -13.8, make: makeNucleus },
];

export default {
  id: 'spectrum',
  group: 'wave',
  title: '电磁波谱',
  subtitle: '从无线电到 γ 射线',
  summary: '无线电、微波、红外、可见光、紫外、X 射线、γ 射线——本质相同，只是频率不同。',
  lead: '把所有电磁波按波长排成一条长带，就是电磁波谱。它们都以光速传播，唯一的区别是频率（波长）。拖动光标在谱带上移动，看每个波段的波长和什么东西一样大、光子有多少能量、能用来做什么。',
  formulas: [
    { expr: '<i>c</i> = <i>λ</i><i>f</i>', desc: '所有电磁波在真空中速度相同（c ≈ 3×10⁸ m/s），所以波长 λ（m）和频率 f（Hz）成反比。' },
    { expr: '<i>E</i> = <i>h</i><i>f</i> = <span class="frac"><span><i>hc</i></span><span><i>λ</i></span></span>', desc: '一个光子的能量 E（J 或 eV）。h = 6.63×10⁻³⁴ J·s。波长越短，光子能量越大。' },
    { expr: '<i>E</i>(eV) ≈ <span class="frac"><span>1240</span><span><i>λ</i>(nm)</span></span>', desc: '速算公式：波长以纳米为单位时，光子能量（电子伏 eV）约等于 1240 除以波长。绿光 550 nm → 约 2.3 eV。' },
  ],
  sections: [
    {
      title: '同一个家族：电磁波谱',
      html: `<p>无线电、微波、红外线、可见光、紫外线、X 射线、γ 射线，名字听起来毫不相干，其实<b>全都是电磁波</b>：都是电场和磁场的振动，都以光速传播，都不需要介质。</p>
      <p>它们唯一的区别是<b>频率</b>（等价地说，<b>波长</b>）。从左到右，波长从上千米缩短到比原子核还小，跨越了约 17 个数量级——画面用的是<b>对数刻度</b>，每一大格波长缩小到 1/10。</p>
      <p>各波段的名字主要来自历史上它们被发现的方式和用途，波段之间的边界并不严格。例如 X 射线和 γ 射线有重叠，习惯上按来源区分：原子核发出的叫 γ 射线，电子撞击产生的叫 X 射线。</p>`,
    },
    {
      title: '为什么性质差别这么大？',
      html: `<p>同样是电磁波，有的能穿墙传信号，有的能晒黑皮肤，有的能透视骨骼。原因有两个：</p>
      <ol><li><b>波长与物体大小的比较。</b>电磁波最容易与尺寸和它的波长差不多的东西发生作用。画面上方的小模型显示了每个波长“和什么一样大”：无线电波和楼房、人一样大，所以天线有米级长度；微波和蝴蝶一样大；可见光比细胞还小，所以显微镜看不清比光波长更小的病毒。</li>
      <li><b>每个光子的能量 E = hf。</b>光子能量决定了它能“撬动”物质里的什么：微波让分子转动（发热），红外线让分子振动，可见光让分子里的外层电子跃迁（视觉、光合作用），紫外线能打断化学键，X 射线能打出内层电子，γ 射线来自原子核内部。</li></ol>`,
    },
    {
      title: '窄窄的可见光窗口',
      html: `<p>点「可见光」看看：在整条谱带上，我们眼睛能看到的只是 380~760 nm 这窄窄的一条（下方是放大图），波长相差还不到 2 倍。</p>
      <p>为什么偏偏是这一段？太阳辐射最强的正是这附近，而且这一段光能很好地穿过大气和水——生命在海洋里演化，眼睛自然适应了“透得过水”的光。别的动物看到的范围不同：蜜蜂能看到紫外线，蛇能感受红外线。</p>
      <div class="tip"><b>天空为什么是蓝的？</b>空气分子比光的波长小得多，它们散射光的本领与波长的四次方成反比（瑞利散射）：蓝光（约 450 nm）被散射的程度大约是红光（约 700 nm）的 5~6 倍。于是满天都是被散射的蓝光。日落时阳光斜穿厚厚的大气，蓝光在路上被散射光了，剩下红橙色。</div>`,
    },
    {
      title: '电离辐射与非电离辐射',
      html: `<p>要把电子从原子或分子中打出来（<b>电离</b>），大约需要 10 eV 的能量。画面中的红色虚线就是这条分界线（λ ≈ 124 nm）：</p>
      <ul><li><b>左边（非电离）</b>：无线电、微波、红外、可见光以及大部分紫外线。手机信号的光子能量只有约 10⁻⁵ eV，比电离所需的能量小一百万倍。</li>
      <li><b>右边（电离）</b>：极紫外、X 射线、γ 射线，每个光子都足以破坏 DNA 分子。</li></ul>
      <div class="warn">常见误区：“手机、Wi-Fi、基站有辐射，会致癌。”关键是<b>每个光子</b>的能量：能量不够，再多的光子也打不断化学键，就像用一万个乒乓球也砸不碎一块砖。手机和 Wi-Fi 唯一能确认的效应是轻微发热，它们的功率远低于安全标准。</div>
      <p><b>X 射线为什么能穿过皮肉？</b>它的光子能量很高，而皮肉主要由氢、碳、氧这类轻原子组成，很少吸收它；骨骼含钙，钙原子更大、电子更多，吸收得多。于是在底片上留下骨骼的“影子”。铅原子更重，所以用铅板来挡。</p>`,
    },
    {
      title: '数一数：几个典型例子',
      html: `<table><tr><th>例子</th><th>波长</th><th>频率</th><th>光子能量</th></tr>
      <tr><td>FM 广播</td><td>3 m</td><td>100 MHz</td><td>4×10⁻⁷ eV</td></tr>
      <tr><td>微波炉 / Wi-Fi</td><td>12 cm</td><td>2.45 GHz</td><td>1×10⁻⁵ eV</td></tr>
      <tr><td>人体红外辐射</td><td>10 μm</td><td>30 THz</td><td>0.12 eV</td></tr>
      <tr><td>绿光</td><td>550 nm</td><td>5.5×10¹⁴ Hz</td><td>2.3 eV</td></tr>
      <tr><td>晒伤的紫外线（UVB）</td><td>300 nm</td><td>10¹⁵ Hz</td><td>4.1 eV</td></tr>
      <tr><td>医用 X 射线</td><td>0.05 nm</td><td>6×10¹⁸ Hz</td><td>25 keV</td></tr>
      <tr><td>钴-60 的 γ 射线</td><td>1 pm</td><td>3×10²⁰ Hz</td><td>1.2 MeV</td></tr></table>
      <p>拖动光标或点击下方按钮，读数会用 c = λf 和 E = hf 实时计算。</p>`,
    },
    {
      title: '一点历史',
      html: `<ul><li>1800 年，赫歇尔用温度计测量棱镜分出的各色光的温度，发现红光外侧“看不见的地方”温度最高——<b>红外线</b>被发现了。第二年，里特在紫光外侧发现了能让氯化银变黑的<b>紫外线</b>。</li>
      <li>1888 年，赫兹产生并接收了<b>无线电波</b>。</li>
      <li>1895 年，伦琴发现了能穿透人体的 <b>X 射线</b>，第一张 X 光照片是他夫人的手骨（还戴着戒指）。他因此获得了第一届诺贝尔物理学奖。</li>
      <li>1900 年，维拉德在镭的辐射中发现了 <b>γ 射线</b>。</li>
      <li>1965 年，两位工程师在调试天线时意外收到了来自四面八方的微波噪声——那是宇宙大爆炸留下的余晖：<b>宇宙微波背景辐射</b>。</li></ul>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.view([0, 2.6, 19.5], [0, 0.9, 0], 12.6);
    ctx.setBloom(0.6, 0.45, 0.8);
    scene.add(stageFloor({ y: -3.2, radius: 18 }));
    const labels = new LabelSet(ctx, scene);

    /* ---------- 频谱带 ---------- */
    const tex = makeBandTexture();
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.7 });
    const front = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.6 });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0, 1.4, 0.25), [dark, dark, dark, dark, front, dark]);
    scene.add(strip);

    /* ---------- 波长逐渐变短的波 ---------- */
    const wave = new TubeLine(NW, { radius: 0.024, radial: 5, vertexColors: true });
    scene.add(wave.object);
    const phase0 = new Float32Array(NW);
    const xs = new Float32Array(NW);
    {
      const c = new THREE.Color(), w = new THREE.Color(0xffffff);
      for (let i = 0; i < NW; i++) {
        const x = X0 + ((X1 - X0) * i) / (NW - 1);
        xs[i] = x;
        phase0[i] = ((2 * Math.PI * S_DECAY) / LAM0) * (Math.exp((x - X0) / S_DECAY) - 1);
        const lg = lgOf(x);
        colorAt(lg, c);
        const inVis = lg <= LG_VIS_R && lg >= LG_VIS_V;
        if (!inVis) c.lerp(w, 0.35);
        wave.setColor(i, c.r * 1.2, c.g * 1.2, c.b * 1.2);
      }
      wave.commitColors();
    }

    /* ---------- 电离分界线 ---------- */
    const xIon = xOf(LG_ION);
    {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(xIon, -0.85, 0.2), new THREE.Vector3(xIon, 4.0, 0.2)]);
      const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: COLOR.proton, dashSize: 0.16, gapSize: 0.1, transparent: true, opacity: 0.9 }));
      line.computeLineDistances();
      scene.add(line);
      labels.add('电离辐射分界（光子能量 ≈ 10 eV）→', [xIon + 2.4, -1.15, 0.3], 'red small');
    }
    labels.add('← 波长更长 · 频率更低 · 光子能量更小', [-8.6, -1.15, 0.3], 'small dim');

    /* ---------- 可见光放大图 ---------- */
    const visG = new THREE.Group();
    scene.add(visG);
    {
      const xa = xOf(LG_VIS_R), xb = xOf(LG_VIS_V);
      const barW = 4.4, cx = -2.6, cy = -2.05;
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = 32;
      const g = cv.getContext('2d');
      const c = new THREE.Color();
      for (let u = 0; u < 512; u++) {
        const nm = 760 - (u / 511) * 380;
        wavelengthRGB(nm, c);
        g.fillStyle = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
        g.fillRect(u, 0, 1, 32);
      }
      const vt = new THREE.CanvasTexture(cv);
      vt.colorSpace = THREE.SRGBColorSpace;
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(barW, 0.42), new THREE.MeshBasicMaterial({ map: vt }));
      bar.position.set(cx, cy, 0.15);
      visG.add(bar);
      const lg = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(xa, -0.72, 0.14), new THREE.Vector3(cx - barW / 2, cy + 0.21, 0.15),
        new THREE.Vector3(xb, -0.72, 0.14), new THREE.Vector3(cx + barW / 2, cy + 0.21, 0.15),
      ]);
      visG.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })));
      const t1 = makeTextSprite('760 nm 红', { size: 0.22, color: '#ff9a8a' });
      t1.position.set(cx - barW / 2 + 0.5, cy - 0.38, 0.15);
      const t2 = makeTextSprite('紫 380 nm', { size: 0.22, color: '#c9a2ff' });
      t2.position.set(cx + barW / 2 - 0.5, cy - 0.38, 0.15);
      visG.add(t1, t2);
      labels.add('可见光（放大）：只占窄窄一条', [cx, cy - 0.75, 0.15], 'small', visG);
    }

    /* ---------- 尺寸对比物 ---------- */
    const objG = new THREE.Group();
    scene.add(objG);
    const objs = OBJECTS.map((o) => {
      const m = o.make();
      const holder = new THREE.Group();
      holder.position.set(xOf(o.lg), OBJ_Y, 0);
      holder.add(m);
      objG.add(holder);
      const sp = makeTextSprite(`${o.name} ${o.size}`, { size: 0.24, color: '#d8dce6' });
      sp.position.set(xOf(o.lg), OBJ_Y + 1.55, 0);
      objG.add(sp);
      return { ...o, holder, model: m, k: 1 };
    });
    {
      const pos = [];
      for (const o of OBJECTS) { const x = xOf(o.lg); pos.push(x, 0.7, 0.05, x, OBJ_Y - 0.05, 0.05); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      objG.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16 })));
    }

    /* ---------- 光标 ---------- */
    const cursor = new THREE.Group();
    scene.add(cursor);
    const curMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const curBar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 5.0, 0.045), curMat);
    curBar.position.y = 1.65;
    const curPlaneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false });
    const curPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5.0), curPlaneMat);
    curPlane.position.set(0, 1.65, 0.14);
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.22, 1.6, 0.5)), new THREE.LineBasicMaterial({ color: 0xffffff }));
    const curGlow = glowSprite(0xffffff, 1.6, 0.85);
    curGlow.position.y = WAVE_Y;
    cursor.add(curBar, curPlane, frame, curGlow);
    const lbCur = labels.add('', [0, 5.0, 0], 'big', cursor);

    /* ---------- 面板 ---------- */
    let lgTarget = BANDS[0].jump;
    let curX = xOf(lgTarget);
    const toSlider = (lg) => ((LOG_MAX - lg) / (LOG_MAX - LOG_MIN)) * 1000;
    const fromSlider = (v) => LOG_MAX - (v / 1000) * (LOG_MAX - LOG_MIN);
    const sPos = ui.slider({
      label: '选择波长（对数刻度）', min: 0, max: 1000, step: 1, value: toSlider(lgTarget),
      format: (v) => fmtLength(Math.pow(10, fromSlider(v))).join(' '),
      onInput: (v) => { lgTarget = fromSlider(v); refresh(); },
    });
    ui.buttons(BANDS.map((b) => ({ label: b.btn, onClick: () => sPos.set(toSlider(b.jump), true) })));
    ui.toggle({ label: '显示尺寸对比物', value: true, onChange: (v) => (objG.visible = v) });
    ui.toggle({ label: '放大显示可见光', value: true, onChange: (v) => (visG.visible = v) });
    const read = ui.readouts([
      { key: 'l', label: '波长 λ', unit: 'm' },
      { key: 'f', label: '频率 f = c/λ', unit: 'Hz' },
      { key: 'E', label: '光子能量 hf', unit: 'eV' },
      { key: 'ion', label: '能否电离', unit: '' },
    ]);
    const note = ui.note('');
    ui.legend([
      { color: CSSCOLOR.proton, label: '电离分界（≈10 eV）' },
      { color: '#ffffff', label: '当前光标' },
    ]);

    const tmpC = new THREE.Color(), WHITE = new THREE.Color(0xffffff);
    function refresh() {
      const lg = lgTarget;
      const lam = Math.pow(10, lg);
      const f = C_LIGHT / lam;
      const E = photonEV(f);
      const b = bandOf(lg);
      let [v, u] = fmtLength(lam); read.set('l', 0, v); read.unit('l', u);
      [v, u] = fmtFreq(f); read.set('f', 0, v); read.unit('f', u);
      [v, u] = fmtEnergyEV(E); read.set('E', 0, v); read.unit('E', u);
      read.set('ion', 0, E >= 10 ? '能' : E >= 3.1 ? '不能*' : '不能');
      const nm = lam * 1e9;
      const colorTxt = b.key === 'vis' ? `（${visColorName(nm)}）` : '';
      lbCur.element.textContent = `${b.name}${colorTxt} · ${fmtLength(lam).join(' ')}`;
      note.set(`<b>${b.name}</b>　${b.range}<br><b>来源：</b>${b.src}<br><b>用途：</b>${b.use}<br><b>安全：</b>${b.safe}${E >= 3.1 && E < 10 ? '<br>*此处光子能量 ' + fmtEnergyEV(E).join(' ') + '，还不能电离，但已能打断化学键。' : ''}`);
      colorAt(lg, tmpC);
      if (b.key !== 'vis') tmpC.lerp(WHITE, 0.45);
      curGlow.material.color.copy(tmpC);
      curPlaneMat.color.copy(tmpC);
    }
    refresh();

    let t0 = 0;
    return {
      update(dt, t) {
        t0 += dt;
        // 波：y = A sin(φ(x) − Ωt)，φ(x) 使局部波长从左到右按指数缩短
        const W = 2 * Math.PI * 0.6 * t0;
        for (let i = 0; i < NW; i++) wave.setPoint(i, xs[i], WAVE_Y + WAVE_A * Math.sin(phase0[i] - W), 0);
        wave.commit(NW);
        // 光标平滑移动
        curX = damp(curX, xOf(lgTarget), 8, dt);
        cursor.position.x = curX;
        // 光标附近的物体放大
        const lgNow = lgOf(curX);
        for (const o of objs) {
          const near = Math.abs(o.lg - lgNow) < 0.75 ? 1 : 0;
          o.k = damp(o.k, 1 + near * 0.35, 6, dt);
          o.holder.scale.setScalar(o.k);
          o.holder.rotation.y = near ? Math.sin(t * 1.5) * 0.5 : damp(o.holder.rotation.y, 0, 4, dt);
          o.model.userData.update?.(t);
        }
        curGlow.scale.setScalar(1.4 + 0.25 * Math.sin(t * 4));
      },
    };
  },
};
