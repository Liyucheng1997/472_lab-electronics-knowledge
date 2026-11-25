import * as THREE from 'three';
import { COLOR, CSSCOLOR, Arrow, Polyline, heatColor, clamp, V } from '../lib/kit.js';
import { Dots, LatticeSim, setSI, sup } from '../lib/circuit-kit.js';

// 20 ℃ 时的电阻率 ρ（Ω·m）与电阻温度系数 α（1/℃）
const MATS = {
  cu: {
    name: '铜', rho: 1.72e-8, alpha: 0.00393, wire: 0xc87533, plot: '#ff9f5a',
    lattice: { colors: [0xd98a5c], mix: 0, disorder: 0, scales: [1] },
    note: '<b>铜</b>：离子排列非常整齐，电子很少被撞偏，电阻率只有 1.72×10⁻⁸ Ω·m，仅次于银。所以电线、电缆、电机线圈几乎都用铜。',
  },
  al: {
    name: '铝', rho: 2.82e-8, alpha: 0.0039, wire: 0xc4cad3, plot: '#d0d6df',
    lattice: { colors: [0xc9d0da], mix: 0, disorder: 0, scales: [1.05] },
    note: '<b>铝</b>：电阻率约为铜的 1.6 倍，但密度只有铜的 1/3、价格也便宜。高压输电线大多是“钢芯铝绞线”——又轻又便宜。',
  },
  fe: {
    name: '铁', rho: 9.71e-8, alpha: 0.005, wire: 0x7b7e86, plot: '#8fa6c8',
    lattice: { colors: [0x8e939c], mix: 0, disorder: 0.35, scales: [1] },
    note: '<b>铁</b>：电阻率约为铜的 6 倍，内部电子与离子的相互作用更强。铁便宜结实，但一般不用来做导线。',
  },
  nicr: {
    name: '镍铬合金', rho: 1.1e-6, alpha: 0.0004, wire: 0x9ca39a, plot: '#6be3ac',
    lattice: { colors: [0xb9c4b0, 0x7d9bd6], mix: 0.22, disorder: 1, scales: [1, 1.18] },
    note: '<b>镍铬合金</b>（约 80% 镍 + 20% 铬）：两种大小不同的原子混在一起，晶格乱糟糟，电子频繁被撞偏，电阻率是铜的 64 倍；而且几乎不随温度变化、高温下不易氧化——电炉丝、电吹风、电烤箱的发热丝就用它。',
  },
};
const RHO_CU = MATS.cu.rho;

export default {
  id: 'resistance',
  group: 'circuit',
  title: '电阻',
  subtitle: 'R = ρL / S',
  summary: '电子在导体里前进时会不断撞上振动的离子——这就是电阻的来源。',
  lead: '电阻描述导体对电流的阻碍作用。上方是导线内部的放大示意：金属离子排成晶格并不停振动，蓝色的自由电子在电场推动下漂移，每撞上一次离子就闪一下光。换材料、拉长导线、加粗导线、加热导线，看电阻和碰撞如何变化。',
  formulas: [
    { expr: '<i>R</i> = <i>ρ</i><span class="frac"><span><i>L</i></span><span><i>S</i></span></span>', desc: '电阻 R（欧姆 Ω）= 电阻率 ρ（Ω·m）× 长度 L（m）÷ 横截面积 S（m²）。注意 1 mm² = 10⁻⁶ m²。' },
    { expr: '<i>ρ</i> = <i>ρ</i><sub>0</sub>[1 + <i>α</i>(<i>t</i> − <i>t</i><sub>0</sub>)]', desc: '金属电阻率随温度近似线性增大。ρ₀ 为 t₀ = 20 ℃ 时的电阻率，α 为电阻温度系数（1/℃），铜约 0.0039 /℃。' },
  ],
  sections: [
    {
      title: '电阻从哪里来？',
      html: `<p>金属里有大量<b>自由电子</b>，它们本来就在高速乱窜。加上电压后，电场推着它们整体朝一个方向缓慢<b>漂移</b>，形成电流。</p>
      <p>但电子走不了多远就会被“撞偏”：画面里每一次闪光就是一次碰撞。碰撞把电子在电场中刚刚攒下的定向速度打乱，还把这部分能量交给离子，让离子振动得更厉害——这就是导线<b>发热</b>的原因。</p>
      <p>碰撞越频繁，电子越难前进，同样电压下电流越小——我们就说这段导体的<b>电阻</b>大。电阻的单位是<b>欧姆（Ω）</b>：导体两端加 1 V 电压、通过 1 A 电流时，电阻就是 1 Ω。</p>
      <div class="tip">量子力学的精确说法：电子在<b>完美、静止</b>的晶格里其实可以畅通无阻！真正让电子“撞车”的，是晶格的<b>不完美</b>——离子的热振动、杂质原子、晶格缺陷。所以温度越高、杂质越多，电阻越大。</div>`,
    },
    {
      title: '电阻定律 R = ρL/S',
      html: `<p>一段导线的电阻由三件事决定：</p>
      <ul><li><b>长度 L</b>：越长，电子一路上要经历的碰撞越多，电阻与长度<b>成正比</b>。拖动「长度」滑块，长度加倍，电阻也加倍。</li>
      <li><b>横截面积 S</b>：越粗，可以同时并排通过的电子越多（画面中导线里的电子变多），就像多车道公路。电阻与面积<b>成反比</b>。</li>
      <li><b>材料 ρ</b>：电阻率 ρ 是材料本身的“阻碍本领”，与形状无关，单位是 Ω·m。</li></ul>
      <div class="eq"><i>R</i> = <i>ρ</i> · <i>L</i> / <i>S</i></div>
      <p>例：1 m 长、横截面积 1 mm² 的铜线，R = 1.72×10⁻⁸ × 1 ÷ 10⁻⁶ ≈ 0.017 Ω，非常小；同样尺寸的镍铬合金线约 1.1 Ω，是铜的 64 倍。</p>
      <p>这也是为什么大功率电器（空调、电热水器）要用更粗的电线：电线电阻越小，线上白白发热浪费的能量越少，也越安全。</p>`,
    },
    {
      title: '常见材料的电阻率',
      html: `<table><tr><th>材料</th><th>ρ（20 ℃，Ω·m）</th><th>类别</th></tr>
      <tr><td>银</td><td>1.59×10⁻⁸</td><td rowspan="1">导体</td></tr>
      <tr><td>铜</td><td>1.72×10⁻⁸</td><td>导体</td></tr>
      <tr><td>金</td><td>2.44×10⁻⁸</td><td>导体</td></tr>
      <tr><td>铝</td><td>2.82×10⁻⁸</td><td>导体</td></tr>
      <tr><td>钨（灯丝）</td><td>5.6×10⁻⁸</td><td>导体</td></tr>
      <tr><td>铁</td><td>9.7×10⁻⁸</td><td>导体</td></tr>
      <tr><td>镍铬合金</td><td>约 1.1×10⁻⁶</td><td>导体（电阻大）</td></tr>
      <tr><td>海水</td><td>约 0.2</td><td>电解质溶液</td></tr>
      <tr><td>纯硅</td><td>约 2.3×10³</td><td>半导体</td></tr>
      <tr><td>玻璃</td><td>10¹⁰ ~ 10¹⁴</td><td>绝缘体</td></tr>
      <tr><td>橡胶</td><td>约 10¹³</td><td>绝缘体</td></tr></table>
      <p>从银到橡胶，电阻率相差超过 <b>20 个数量级</b>（10²⁰ 倍）——这是自然界跨度最大的物理量之一。</p>`,
    },
    {
      title: '导体、绝缘体、半导体',
      html: `<ul><li><b>导体</b>（金属、石墨、电解质溶液）：有大量可自由移动的电荷。金属中几乎每个原子都贡献 1~2 个自由电子，每立方厘米约 10²³ 个。</li>
      <li><b>绝缘体</b>（塑料、橡胶、陶瓷、玻璃、干木头）：电子被牢牢束缚在原子或化学键里，几乎没有自由电荷。电线外面那层塑料皮就是绝缘体。</li>
      <li><b>半导体</b>（硅、锗）：介于两者之间，只有少量电子能挣脱束缚。它的神奇之处是：<b>温度升高、光照、掺入少量杂质</b>都能让它的导电能力暴增成千上万倍——这正是芯片、太阳能电池的基础（见「半导体与二极管」一章）。</li></ul>
      <div class="warn">“绝缘”是相对的：电压足够高时，空气、玻璃也会被<b>击穿</b>而导电（闪电就是空气被击穿）。湿木头、人体、自来水都含有离子，能够导电，千万不要用湿手碰电器。</div>`,
    },
    {
      title: '温度与电阻、超导',
      html: `<p>拖动「温度」滑块：离子振动幅度变大，电子被撞的次数明显增多，电阻上升。对铜来说，温度每升高 1 ℃，电阻约增大 0.39%；从 20 ℃ 加热到 270 ℃，电阻几乎翻倍。</p>
      <p>这有很多实际后果：</p>
      <ul><li><b>白炽灯丝</b>（钨）点亮后温度约 2500 ℃，热态电阻是冷态的 10 多倍，所以灯泡往往在<b>开灯瞬间</b>电流最大时烧断。</li>
      <li>利用电阻随温度变化可以做<b>电阻温度计</b>（如铂电阻温度计）。</li>
      <li><b>镍铬合金、锰铜合金</b>的温度系数极小，适合做电热丝和精密电阻。</li></ul>
      <p><b>超导</b>：把某些材料冷却到极低温度（如汞在 −269 ℃ 以下），电阻会<b>突然完全消失</b>，电流可以无损耗地永远流动。超导体用于医院的核磁共振（MRI）磁体、粒子加速器和磁悬浮列车研究。超导背后是电子两两“结对”集体运动的量子效应，不能用画面里简单的碰撞模型解释。</p>`,
    },
    {
      title: '为什么电线用铜、电炉丝用镍铬？',
      html: `<p>两者的目标正好相反：</p>
      <ul><li><b>电线</b>要把电能<b>送到</b>用电器，路上发热越少越好 → 选电阻率最小、又不太贵的<b>铜</b>（银更好但太贵；长距离架空线用轻便的<b>铝</b>）。</li>
      <li><b>电热丝</b>要把电能<b>变成热</b>，需要电阻较大、能在 1000 ℃ 左右长期工作而不氧化、不熔化 → 选<b>镍铬合金</b>。</li></ul>
      <p>如果用铜丝做电炉丝：电阻太小，要绕非常长才能达到需要的电阻；而且铜在高温下很快氧化变脆。反过来，如果用镍铬合金做电线，线上会白白发热，既浪费又危险。</p>
      <div class="tip">一个常见误解：“电阻大的材料不好”。其实没有好坏之分，只有用途不同——收音机、手机里成千上万个电阻器，就是专门用来“制造”电阻、控制电流大小的。</div>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.view([0, 0.7, 13.5], [0, 0.35, 0], 5.9);
    ctx.setBloom(0.75, 0.45, 0.72);

    /* ---------- 放大的晶格 ---------- */
    const LAT_Y = 1.4;
    const lat = new LatticeSim({ nx: 11, ny: 4, nz: 3, d: 0.9, electrons: 64, ionR: 0.17, sparkColor: 0xffc070, sparks: 48 });
    lat.group.position.set(0, LAT_Y, 0);
    scene.add(lat.group);
    const H = lat.half;
    // 背板：让放大区域像一块“显微镜视野”
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(H.x * 2 + 0.3, H.y * 2 + 0.3),
      new THREE.MeshBasicMaterial({ color: 0x1a1d26, transparent: true, opacity: 0.6, depthWrite: false })
    );
    panel.position.set(0, LAT_Y, -H.z - 0.05);
    scene.add(panel);

    // 电子漂移方向箭头
    const drift = new Arrow(COLOR.electron, { radius: 0.035, headLength: 0.26, headRadius: 0.1 });
    drift.set(V(1.6, LAT_Y + H.y + 0.45, 0), V(2.4, 0, 0));
    scene.add(drift);

    /* ---------- 导线本体 ---------- */
    const WIRE_Y = -2.7;
    const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 48, 1);
    cylGeo.rotateZ(Math.PI / 2);
    const wireMat = new THREE.MeshStandardMaterial({ color: MATS.cu.wire, metalness: 0.85, roughness: 0.3, transparent: true, opacity: 0.55, depthWrite: false });
    const wireMesh = new THREE.Mesh(cylGeo, wireMat);
    wireMesh.position.y = WIRE_Y;
    scene.add(wireMesh);
    const termMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d6, metalness: 0.9, roughness: 0.25 });
    const terms = [-1, 1].map(() => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.22, 32), termMat);
      m.rotation.z = Math.PI / 2;
      scene.add(m);
      return m;
    });
    // 导线里流动的电子
    const WE = 140;
    const wElec = new Dots(WE, { r: 0.045, color: COLOR.electron, emissive: COLOR.electron, emissiveIntensity: 1.8, segments: 8 });
    scene.add(wElec.mesh);
    const wSeeds = Array.from({ length: WE }, (_, i) => ({ u: Math.random(), rr: Math.sqrt(Math.random()) * 0.78, th: Math.random() * Math.PI * 2, k: i }));
    // 放大镜：环 + 视野连线
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 48), new THREE.MeshBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0.8 }));
    ring.rotation.y = Math.PI / 2;
    ring.position.set(0, WIRE_Y, 0);
    scene.add(ring);
    const zoomLine = new Polyline(3, { color: 0x9fb4d8, opacity: 0.4 });
    scene.add(zoomLine.object);

    /* ---------- 标签 ---------- */
    const lbLat = ctx.label('导线内部（放大约 1 亿倍的示意）', { cls: 'small dim' });
    lbLat.position.set(-2.6, LAT_Y + H.y + 0.45, 0);
    const lbDrift = ctx.label('电子定向漂移', { cls: 'small blue' });
    lbDrift.position.set(2.8, LAT_Y + H.y + 0.85, 0);
    const lbIon = ctx.label('金属离子：温度越高振动越剧烈', { cls: 'small' });
    lbIon.position.set(-3.3, LAT_Y - H.y - 0.35, 0);
    const lbHit = ctx.label('闪光 = 碰撞：电子被撞偏，能量变成热', { cls: 'small orange' });
    lbHit.position.set(3.2, LAT_Y - H.y - 0.35, 0);
    const lbWire = ctx.label('', { cls: 'small yellow' });
    lbWire.position.set(0, WIRE_Y - 0.85, 0);
    const lbMat = ctx.label('', { cls: '' });
    scene.add(lbLat, lbDrift, lbIon, lbHit, lbWire, lbMat);

    /* ---------- 面板 ---------- */
    let mat = 'cu', L = 1, A = 1, T = 20;
    ui.segmented({
      label: '导线材料',
      options: [{ value: 'cu', label: '铜' }, { value: 'al', label: '铝' }, { value: 'fe', label: '铁' }, { value: 'nicr', label: '镍铬合金' }],
      value: mat,
      onChange: (v) => { mat = v; lat.setMaterial(MATS[mat].lattice); refresh(); },
    });
    ui.slider({ label: '长度 L', min: 0.5, max: 5, step: 0.1, value: L, unit: 'm', digits: 1, onInput: (v) => { L = v; refresh(); } });
    ui.slider({ label: '横截面积 S', min: 0.5, max: 4, step: 0.1, value: A, unit: 'mm²', digits: 1, onInput: (v) => { A = v; refresh(); } });
    ui.slider({ label: '温度 t', min: -50, max: 500, step: 5, value: T, unit: '℃', digits: 0, onInput: (v) => { T = v; refresh(); } });
    const note = ui.note('');
    const read = ui.readouts([
      { key: 'rho', label: '电阻率 ρ', unit: '×10⁻⁸ Ω·m' },
      { key: 'R', label: '电阻 R', unit: 'Ω' },
      { key: 'k', label: '与 20 ℃ 时相比', unit: '倍', digits: 2 },
      { key: 'P', label: '通 1 A 电流时发热', unit: 'W' },
    ]);
    ui.legend([
      { color: CSSCOLOR.electron, label: '自由电子' },
      { color: '#d98a5c', label: '金属离子' },
      { color: '#ffc070', label: '碰撞闪光' },
    ]);
    const plot = ui.plot({
      title: '电阻率随温度的变化（以 20 ℃ 为 1）',
      height: 160, xMin: -50, xMax: 500, yMin: 0.6, yMax: 3.6,
      xLabel: '温度 t (℃)', yLabel: 'ρ / ρ₂₀',
      series: Object.values(MATS).map((m) => ({ label: m.name, color: m.plot })),
      draw(p) {
        p.vline(20, 'rgba(255,255,255,.18)');
        for (const [k, m] of Object.entries(MATS)) {
          p.fn((x) => 1 + m.alpha * (x - 20), m.plot, k === mat ? 3 : 1.2, 2, k === mat ? null : [4, 4]);
        }
        const m = MATS[mat];
        p.dot(T, 1 + m.alpha * (T - 20), '#ffffff', 5);
      },
    });

    const glowCol = new THREE.Color();
    function refresh() {
      const m = MATS[mat];
      const rho = m.rho * (1 + m.alpha * (T - 20));
      const R = (rho * L) / (A * 1e-6);
      read.set('rho', rho / 1e-8, rho / 1e-8 >= 100 ? (rho / 1e-8).toFixed(0) : (rho / 1e-8).toFixed(2));
      setSI(read, 'R', R, 'Ω');
      read.set('k', 1 + m.alpha * (T - 20));
      setSI(read, 'P', R, 'W');

      // 晶格：振动幅度 ∝ 绝对温度（夸张），碰撞概率随电阻率增大
      const TK = T + 273.15;
      lat.amp = 0.16 * Math.pow(TK / 773, 1.2);
      lat.rate = 0.9 * Math.sqrt(rho / RHO_CU);
      lat.accel = 0.65;
      lat.sparkPeak = 0.85;

      // 导线外形：长度、粗细
      const len = 1.6 * L;
      const r = 0.14 * Math.sqrt(A / 0.5);
      wireMesh.scale.set(len, r, r);
      wireMat.color.setHex(m.wire);
      const glow = clamp((T - 280) / 450, 0, 1);
      heatColor(glow * 0.75, glowCol);
      wireMat.emissive.copy(glowCol);
      wireMat.emissiveIntensity = glow * 1.4;
      terms.forEach((tm, i) => { tm.scale.set(r + 0.06, 1, r + 0.06); tm.position.set((i ? 1 : -1) * (len / 2 + 0.11), WIRE_Y, 0); });
      ring.scale.setScalar(r + 0.12);
      zoomLine.setPoints([V(-H.x, LAT_Y - H.y, 0), V(0, WIRE_Y + r + 0.12, 0), V(H.x, LAT_Y - H.y, 0)]);
      state.len = len; state.r = r;
      state.n = Math.round(30 + (110 * (A - 0.5)) / 3.5);
      // 同样电压下，电子漂移速度 ∝ 1/(ρL)（与粗细无关）。这里做了开方压缩方便观察
      state.v = clamp(1.0 * Math.sqrt((RHO_CU * 1) / (rho * L)), 0.05, 2.2);

      lbWire.element.textContent = `${m.name}导线：L = ${L.toFixed(1)} m，S = ${A.toFixed(1)} mm²，R = ${fmtR(R)}`;
      lbMat.element.textContent = m.name;
      lbMat.element.className = 'l3d big ' + (mat === 'cu' ? 'orange' : mat === 'nicr' ? 'green' : '');
      lbMat.position.set(-len / 2 - 0.9 - (mat === 'nicr' ? 0.6 : 0), WIRE_Y, 0);
      note.set(m.note + `<br>当前温度 ${T} ℃：ρ = ${(rho / 1e-8).toPrecision(3)}×10${sup(-8)} Ω·m。`);
      plot.redraw();
    }
    const fmtR = (R) => (R >= 1 ? R.toFixed(R >= 100 ? 0 : 2) + ' Ω' : (R * 1000).toFixed(R * 1000 >= 100 ? 0 : 1) + ' mΩ');
    const state = { len: 1.6, r: 0.2, n: 60, v: 1 };
    lat.setMaterial(MATS[mat].lattice);
    refresh();

    return {
      update(dt, t) {
        lat.update(dt, t);
        // 导线中的电子：沿 +x 漂移（数量 ∝ 横截面积）
        const { len, r, n, v } = state;
        for (let i = 0; i < WE; i++) {
          const s = wSeeds[i];
          if (i >= n) { wElec.hide(i); continue; }
          s.u = (s.u + (v * dt) / len) % 1;
          const x = -len / 2 + s.u * len;
          const jig = Math.sin(t * 9 + i) * 0.015;
          wElec.setAt(i, x, WIRE_Y + Math.sin(s.th) * s.rr * r + jig, Math.cos(s.th) * s.rr * r);
        }
        wElec.commit();
      },
    };
  },
};
