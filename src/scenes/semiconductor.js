import * as THREE from 'three';
import { COLOR, CSSCOLOR, Arrow, battery, bulb, Flow, textSprite, clamp, damp, V } from '../lib/kit.js';
import { Dots, SparkPool, addWire, bulbPath, pathOf, rng, setSI, sup } from '../lib/circuit-kit.js';

// 晶格：13 × 5 个硅原子，间距 1
const NX = 13, NY = 5, X0 = -6, Y0 = -2;
const NHB = (NX - 1) * NY, NBOND = NHB + NX * (NY - 1);
const X2MAX = (NX - 1) * 2, Y2MAX = (NY - 1) * 2;
// 二极管参数（硅）
const VT = 0.02585, IS = 1e-14, RS = 4, VBI = 0.7;
const W0_VIS = 2.2, W0_REAL = 0.4; // 零偏时耗尽区宽度：画面单位 / 真实 μm
// 1 mm × 1 mm × 1 mm 硅块的电阻率（Ω·m）
const RHO = { i: 2.3e3, n: 4.6e-3, p: 1.3e-2 };
const C_SI = 0xa3abbd, C_P = 0xff9f5a, C_B = 0x6be3ac;
const WY = 4.2, CONT_X = 6.75;

/** 带串联电阻的肖克利方程：外加电压 U → 电流 I（A） */
function diodeI(U) {
  if (U <= 0) return IS * (Math.exp(U / VT) - 1);
  let lo = 0, hi = U / RS;
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2;
    if (IS * (Math.exp((U - m * RS) / VT) - 1) > m) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

export default {
  id: 'semiconductor',
  group: 'circuit',
  title: '半导体与二极管',
  subtitle: 'PN 结单向导电',
  summary: '掺一点杂质，硅就变成 N 型或 P 型；两者相接成 PN 结，电流只能单向通过。',
  lead: '画面是硅晶体的平面示意：灰色硅原子之间每条“键”上有两个共用电子。切换本征硅、N 型、P 型，看自由电子和粉色空穴从哪里来；再切到 PN 结，拖动外加电压，看耗尽区如何变宽变窄、电流为何只能单向通过。',
  formulas: [
    { expr: '<i>I</i> = <i>I</i><sub>S</sub>(e<sup><i>U</i>/<i>U</i><sub>T</sub></sup> − 1)', desc: '肖克利二极管方程：I_S 为反向饱和电流（硅约 10⁻¹⁴ A），U_T = kT/q ≈ 26 mV（室温）。正向电压每增加约 60 mV，电流增大 10 倍；反向时电流约为 −I_S，几乎为零。' },
    { expr: '<i>E</i><sub>光子</sub> = <i>hν</i> ≈ <i>E</i><sub>g</sub>，<i>λ</i> ≈ <span class="frac"><span>1240</span><span><i>E</i><sub>g</sub>(eV)</span></span> nm', desc: 'LED 发出光子的能量约等于材料的禁带宽度 E_g：禁带越宽，光的波长越短（越偏蓝紫）。' },
  ],
  sections: [
    {
      title: '半导体：介于导体与绝缘体之间',
      html: `<p>硅原子最外层有 <b>4 个电子</b>。在硅晶体里，每个硅原子和周围 4 个邻居各共用一对电子，形成牢固的<b>共价键</b>（画面中原子之间的连线和每条线上的两个小蓝点）。</p>
      <p>这些电子被束缚在键上，不能自由移动，所以纯净的硅导电性很差。但束缚并不算太紧：室温下热运动偶尔会把一个电子“震”出键外，它就成了<b>自由电子</b>；它原来的位置留下一个空位，叫<b>空穴</b>（粉色 +）。选「本征硅」可以看到这种成对产生、又成对复合的过程。</p>
      <p>用<b>能带</b>的语言说：电子在键上时处于“价带”，挣脱后进入“导带”，两者之间隔着一段能量禁区，叫<b>禁带</b>。硅的禁带宽度约 1.12 eV——比绝缘体（如金刚石 5.5 eV）窄得多，所以少量电子能跳过去；金属则根本没有禁带。</p>
      <div class="tip">纯硅中每立方厘米只有约 10¹⁰ 个自由电子，而铜里是 10²³ 个——相差 10 万亿倍。</div>`,
    },
    {
      title: '掺杂：N 型和 P 型',
      html: `<p>往硅里掺入极少量（百万分之一量级）的杂质，导电性就能提高上百万倍：</p>
      <ul><li><b>N 型</b>（Negative）：掺入 5 价的<b>磷</b>（橙色）。磷用 4 个电子与硅成键后还<b>多出 1 个电子</b>，它几乎不受束缚，成为自由电子；磷原子则变成固定不动的正离子 P⁺。N 型半导体中电子是“多数载流子”。</li>
      <li><b>P 型</b>（Positive）：掺入 3 价的<b>硼</b>（绿色）。硼只有 3 个电子，成键时<b>缺 1 个电子</b>，留下一个空穴。相邻键上的电子很容易跳过来填补，于是空穴“搬”到了别处——空穴就这样在晶体里移动，表现得像一个带正电的粒子。硼得到电子后成为固定的负离子 B⁻。</li></ul>
      <p>注意：N 型、P 型半导体整体都是<b>电中性</b>的——多出的电子（或空穴）与固定的杂质离子电荷正好抵消。</p>
      <p>在 N、P 模式下拖动电压：电子逆着电场漂移，空穴顺着电场漂移，两者都形成电流。</p>`,
    },
    {
      title: 'PN 结：耗尽区与内建电场',
      html: `<p>把 P 型和 N 型硅做在同一块晶体上，交界处就是 <b>PN 结</b>：</p>
      <ol><li>N 区电子多、P 区空穴多，它们会向对方<b>扩散</b>，在交界附近相遇<b>复合</b>（电子填进空穴，双双消失）。</li>
      <li>交界两侧于是只剩下不能移动的杂质离子：P 侧是 B⁻，N 侧是 P⁺。这片没有自由载流子的区域叫<b>耗尽区</b>（画面中央黄色带）。</li>
      <li>这些离子产生了从 N 指向 P 的<b>内建电场</b>（黄色箭头），把想继续扩散过来的电子和空穴推回去。扩散和电场达到平衡，形成约 0.7 V 的“势垒”。</li></ol>
      <p>耗尽区很薄，真实宽度通常不到 1 微米。</p>`,
    },
    {
      title: '单向导电：正向导通，反向截止',
      html: `<ul><li><b>正向偏置</b>（P 接正极、N 接负极）：外加电场与内建电场方向相反，耗尽区<b>变窄</b>、势垒降低。电压超过约 0.6~0.7 V 后，电子和空穴大量越过结区复合，电流迅速增大，指示灯亮起。</li>
      <li><b>反向偏置</b>（P 接负极、N 接正极）：外加电场与内建电场同向，电子和空穴被拉离结区，耗尽区<b>变宽</b>，几乎没有电流（只有约 10⁻¹⁴ A 的微小漏电流）。</li></ul>
      <p>看右侧的伏安特性曲线：它不是欧姆定律那样的直线，而是一条指数曲线——这就是<b>非线性元件</b>。</p>
      <p><b>整流</b>：交流电的方向不停反转，二极管只让其中一个方向的电流通过，就把交流变成了单方向的脉动电流。手机充电器、电脑电源里都有由 4 个二极管组成的“整流桥”。</p>
      <div class="warn">反向电压太高时 PN 结会被<b>击穿</b>，电流突然剧增。普通二极管因此会损坏；但专门设计的“稳压二极管”正是利用击穿时电压几乎不变的特点来稳压。</div>`,
    },
    {
      title: 'LED 与太阳能电池',
      html: `<p><b>LED（发光二极管）</b>：正向导通时，电子越过 PN 结与空穴复合，从导带“掉”回价带，多余的能量以<b>光子</b>的形式放出（画面中结区的闪光）。光的颜色由禁带宽度决定：</p>
      <table><tr><th>材料</th><th>禁带宽度</th><th>颜色</th></tr>
      <tr><td>砷化镓（GaAs）</td><td>1.4 eV</td><td>红外（遥控器）</td></tr>
      <tr><td>磷砷化镓（GaAsP）</td><td>约 1.9 eV</td><td>红</td></tr>
      <tr><td>磷化镓（GaP）</td><td>约 2.2 eV</td><td>绿 / 黄绿</td></tr>
      <tr><td>氮化镓铟（InGaN）</td><td>约 2.7 eV</td><td>蓝</td></tr></table>
      <p>硅的禁带属于“间接带隙”，复合时能量大多变成晶格振动（热），几乎不发光，所以 LED 不用硅做。白光 LED 是蓝光 LED 加黄色荧光粉。高效蓝光 LED 的发明获得了 2014 年诺贝尔物理学奖。</p>
      <p><b>太阳能电池</b>正好反过来：光子被 PN 结吸收，产生一对电子和空穴，内建电场把电子推向 N 区、空穴推向 P 区，两端就出现了电压——光能直接变成电能。</p>`,
    },
    {
      title: '从晶体管到芯片',
      html: `<p>把两个 PN 结背靠背做在一起（NPN 或 PNP），就得到<b>晶体管</b>：用很小的电流或电压去控制很大的电流，既能<b>放大</b>信号，又能当作极快的<b>开关</b>。</p>
      <p>现代芯片里用的是 <b>MOS 场效应晶体管</b>：栅极上的电压在硅表面“感应”出一条导电沟道，沟道开 = 1，关 = 0。数十亿个这样的开关组合起来，就能完成计算、存储。</p>
      <p>1947 年贝尔实验室造出第一个晶体管，有指甲盖大小；今天一颗手机芯片在指甲大小的面积上集成了<b>上百亿</b>个晶体管，每个只有几十个原子宽。这一切的起点，就是本章看到的：往硅里掺一点点杂质，控制电子和空穴的运动。</p>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.view([0, 1.3, 15.8], [0, 1.0, 0], 7.7);
    ctx.setBloom(0.8, 0.5, 0.72);

    /* ---------- 晶格 ---------- */
    const sitePos = (i, j) => [X0 + i, Y0 + j];
    const atoms = new Dots(NX * NY, { r: 0.2, color: 0xffffff, roughness: 0.4, metalness: 0.3, segments: 18 });
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      const [x, y] = sitePos(i, j);
      atoms.setAt(i * NY + j, x, y, 0);
      atoms.setColor(i * NY + j, C_SI);
    }
    atoms.commit();
    scene.add(atoms.mesh);
    // 键（线）和键上的共用电子
    const bondPos = [];
    const bondMid = []; // [x, y, horizontal?]
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX - 1; i++) {
      const [x, y] = sitePos(i, j);
      bondPos.push(x, y, -0.02, x + 1, y, -0.02);
      bondMid.push([x + 0.5, y, true]);
    }
    for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX; i++) {
      const [x, y] = sitePos(i, j);
      bondPos.push(x, y, -0.02, x, y + 1, -0.02);
      bondMid.push([x, y + 0.5, false]);
    }
    const bondGeo = new THREE.BufferGeometry();
    bondGeo.setAttribute('position', new THREE.Float32BufferAttribute(bondPos, 3));
    scene.add(new THREE.LineSegments(bondGeo, new THREE.LineBasicMaterial({ color: 0x5c6884, transparent: true, opacity: 0.8 })));
    const bondE = new Dots(NBOND * 2, { r: 0.05, color: COLOR.electron, emissive: COLOR.electron, emissiveIntensity: 0.45, segments: 8 });
    const bondEPos = (b, k) => {
      const [mx, my, h] = bondMid[b];
      const o = k ? 0.13 : -0.13;
      return h ? [mx + o, my, 0.04] : [mx, my + o, 0.04];
    };
    for (let b = 0; b < NBOND; b++) for (let k = 0; k < 2; k++) { const p = bondEPos(b, k); bondE.setAt(b * 2 + k, p[0], p[1], p[2]); }
    bondE.commit();
    scene.add(bondE.mesh);
    const bondIndex = (X2, Y2) => (X2 % 2 ? (Y2 / 2) * (NX - 1) + (X2 - 1) / 2 : NHB + ((Y2 - 1) / 2) * NX + X2 / 2);

    /* ---------- 区域着色、耗尽区、内建电场 ---------- */
    const tint = (color, x) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 5.2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, depthWrite: false }));
      m.position.set(x, 0, -0.3);
      scene.add(m);
      return m;
    };
    const tintP = tint(COLOR.hole, -3.2), tintN = tint(COLOR.electron, 3.2);
    const depl = new THREE.Mesh(new THREE.PlaneGeometry(1, 5.2), new THREE.MeshBasicMaterial({ color: COLOR.efield, transparent: true, opacity: 0.12, depthWrite: false }));
    depl.position.z = -0.25;
    scene.add(depl);
    const fieldArrows = [-1.5, 0, 1.5].map(() => { const a = new Arrow(COLOR.efield, { radius: 0.03, headLength: 0.2, headRadius: 0.08 }); scene.add(a); return a; });

    /* ---------- 电极与外电路 ---------- */
    const contMat = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.85, roughness: 0.3 });
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.0, 1.0), contMat);
      c.position.set(s * CONT_X, 0, 0);
      scene.add(c);
    }
    const bat = battery({ height: 1.4, radius: 0.3 });
    bat.position.set(0, WY, 0);
    bat.rotation.z = Math.PI / 2;
    scene.add(bat);
    const BULB_S = 0.8;
    const bp = V(3.6, WY + 0.24 * BULB_S, 0);
    const lamp = bulb({ scale: BULB_S });
    lamp.position.copy(bp);
    scene.add(lamp);
    addWire(scene, [V(-CONT_X, 2.5), V(-CONT_X, WY), V(-0.85, WY)], { radius: 0.05 });
    addWire(scene, [V(0.85, WY), V(bp.x - 0.12 * BULB_S, WY)], { radius: 0.05 });
    addWire(scene, [V(bp.x + 0.12 * BULB_S, WY), V(CONT_X, WY), V(CONT_X, 2.5)], { radius: 0.05 });
    const flowCurve = pathOf([V(-CONT_X, 0.6), V(-CONT_X, WY), V(-0.85, WY), V(0.85, WY), ...bulbPath(bp, BULB_S), V(CONT_X, WY), V(CONT_X, 0.6)], 0.25);
    const extFlow = new Flow(flowCurve, { count: Math.round(flowCurve.getLength() * 3), color: COLOR.electron, r: 0.06, speed: 0 });
    scene.add(extFlow.object);

    /* ---------- 载流子 ---------- */
    const MAXC = 24;
    const holeDots = new Dots(MAXC, { r: 0.12, color: COLOR.hole, emissive: COLOR.hole, emissiveIntensity: 0.9, segments: 14 });
    const freeE = new Dots(MAXC, { r: 0.1, color: COLOR.electron, emissive: COLOR.electron, emissiveIntensity: 1.7, segments: 12 });
    scene.add(holeDots.mesh, freeE.mesh);
    const holeSigns = Array.from({ length: MAXC }, () => {
      const s = textSprite('+', { size: 0.2, color: '#ffffff', depthTest: false });
      s.renderOrder = 10;
      s.visible = false;
      scene.add(s);
      return s;
    });
    const ionSigns = Array.from({ length: 20 }, () => {
      const s = textSprite('+', { size: 0.34, color: '#ff8a80', depthTest: false });
      s.renderOrder = 10;
      s.visible = false;
      scene.add(s);
      return s;
    });
    const ionSignsNeg = Array.from({ length: 20 }, () => {
      const s = textSprite('−', { size: 0.34, color: '#7fb8ff', depthTest: false });
      s.renderOrder = 10;
      s.visible = false;
      scene.add(s);
      return s;
    });
    const sparks = new SparkPool(30, { color: 0xfff0b0, size: 0.6 });
    scene.add(sparks.group);

    /* ---------- 标签 ---------- */
    const lbMain = ctx.label('', { cls: 'small' });
    lbMain.position.set(0, -2.95, 0);
    const lbP = ctx.label('P 区：掺硼，空穴多', { cls: 'small red' });
    lbP.position.set(-3.4, 2.85, 0);
    const lbN = ctx.label('N 区：掺磷，自由电子多', { cls: 'small blue' });
    lbN.position.set(3.4, 2.85, 0);
    const lbD = ctx.label('耗尽区 + 内建电场（N → P）', { cls: 'small yellow' });
    lbD.position.set(0, -2.95, 0);
    const lbBat = ctx.label('', { cls: 'yellow' });
    lbBat.position.set(0, WY + 0.65, 0);
    const lbLamp = ctx.label('指示灯', { cls: 'small dim' });
    lbLamp.position.set(bp.x + 1.1, WY + 0.5, 0);
    const lbCont = ctx.label('金属电极', { cls: 'small dim' });
    lbCont.position.set(-CONT_X, -2.85, 0);
    scene.add(lbMain, lbP, lbN, lbD, lbBat, lbLamp, lbCont);

    /* ---------- 状态 ---------- */
    let mode = 'pn';
    let U = 0;
    let Wv = W0_VIS; // 画面中的耗尽区宽度（平滑）
    let I = 0;
    let dopants = []; // { i, j, kind: 'P'|'B' }
    let holes = []; // { X2, Y2, fX, fY, u, life, pair }
    let elecs = []; // { x, y, a, life, pair }
    let genT = 0;
    const hidden = [];

    function pickSites(seed, cols, perCol) {
      const R = rng(seed);
      const out = [];
      for (const i of cols) {
        const js = [0, 1, 2, 3, 4].sort(() => R() - 0.5).slice(0, perCol);
        for (const j of js) out.push([i, j]);
      }
      return out;
    }

    function newHole(X2, Y2, life = Infinity) {
      if (holes.length >= MAXC) return null;
      const h = { X2, Y2, fX: X2, fY: Y2, u: 1, life, pair: null };
      holes.push(h);
      return h;
    }
    function newElec(x, y, life = Infinity) {
      if (elecs.length >= MAXC) return null;
      const e = { x, y, a: Math.random() * Math.PI * 2, life, pair: null };
      elecs.push(e);
      return e;
    }

    function build() {
      dopants = []; holes = []; elecs = [];
      for (let k = 0; k < NX * NY; k++) atoms.setColor(k, C_SI);
      if (mode === 'n') pickSites(3, [1, 2, 3, 4, 5, 7, 8, 9, 10, 11], 1).forEach(([i, j]) => dopants.push({ i, j, kind: 'P' }));
      if (mode === 'p') pickSites(5, [1, 2, 3, 4, 5, 7, 8, 9, 10, 11], 1).forEach(([i, j]) => dopants.push({ i, j, kind: 'B' }));
      if (mode === 'pn') {
        pickSites(9, [1, 2, 3, 4, 5], 2).forEach(([i, j]) => dopants.push({ i, j, kind: 'B' }));
        pickSites(13, [7, 8, 9, 10, 11], 2).forEach(([i, j]) => dopants.push({ i, j, kind: 'P' }));
      }
      for (const d of dopants) {
        atoms.setColor(d.i * NY + d.j, d.kind === 'P' ? C_P : C_B);
        const [x, y] = sitePos(d.i, d.j);
        if (d.kind === 'P') newElec(x + 0.35, y + 0.35);
        else newHole(2 * d.i + 1, 2 * d.j);
      }
      atoms.commit();
      Wv = mode === 'pn' ? targetW() : 0;
      const isPN = mode === 'pn';
      tintP.visible = tintN.visible = depl.visible = isPN;
      fieldArrows.forEach((a) => (a.visible = isPN));
      lbP.visible = lbN.visible = lbD.visible = isPN;
      lbMain.visible = !isPN;
      lbMain.element.textContent = {
        i: '本征硅：每个硅原子与 4 个邻居共用电子对（共价键）',
        n: 'N 型硅：磷（橙）多出 1 个电子 → 自由电子 + 固定的 P⁺',
        p: 'P 型硅：硼（绿）少 1 个电子 → 空穴 + 固定的 B⁻',
        pn: '',
      }[mode];
      refresh();
    }

    function targetW() {
      return W0_VIS * Math.sqrt(Math.max(VBI - U, 0.02) / VBI);
    }

    /* ---------- 面板 ---------- */
    ui.segmented({
      label: '材料',
      options: [{ value: 'i', label: '本征硅' }, { value: 'n', label: 'N型' }, { value: 'p', label: 'P型' }, { value: 'pn', label: 'PN结' }],
      value: mode,
      onChange: (v) => { mode = v; build(); },
    });
    const uSlider = ui.slider({ label: '外加电压 U（左端为正）', min: -2, max: 1, step: 0.02, value: U, unit: 'V', digits: 2, onInput: (v) => { U = v; refresh(); } });
    ui.button({ label: '电压归零', onClick: () => { U = 0; uSlider.set(0); refresh(); } });
    const note = ui.note('');
    const read = ui.readouts([
      { key: 'U', label: '外加电压 U', unit: 'V', digits: 2 },
      { key: 'I', label: '电流 I', unit: 'A' },
      { key: 'W', label: '耗尽区宽度', unit: 'μm' },
      { key: 'n', label: '自由电子浓度', unit: 'cm⁻³' },
      { key: 'p', label: '空穴浓度', unit: 'cm⁻³' },
    ]);
    ui.legend([
      { color: CSSCOLOR.electron, label: '自由电子 / 键上电子' },
      { color: CSSCOLOR.hole, label: '空穴（+）' },
      { color: '#a3abbd', label: '硅 Si' },
      { color: '#ff9f5a', label: '磷 P' },
      { color: '#6be3ac', label: '硼 B' },
    ]);
    const pnCurve = [];
    for (let k = 0; k <= 300; k++) { const u = -2 + (3 * k) / 300; pnCurve.push([u, diodeI(u) * 1e3]); }
    const plot = ui.plot({
      title: '伏安特性曲线',
      height: 170, xMin: -2, xMax: 1, yMin: -5, yMax: 65,
      xLabel: '外加电压 U (V)', yLabel: '电流 I',
      series: [{ label: '当前材料', color: '#ff9f0a' }],
      draw(p) {
        p.vline(0, 'rgba(255,255,255,.25)');
        if (mode === 'pn') {
          p.line(pnCurve, '#ff9f0a', 2.5);
          p.dot(U, clamp(diodeI(U) * 1e3, -5, 65), '#ffffff', 5);
          p.text(-1.95, 58, '单位：mA', 'rgba(255,255,255,.55)');
          p.text(0.62, 40, '导通 ≈ 0.7 V →', 'rgba(255,255,255,.7)', 'right');
          p.text(-1.0, 4, '反向截止：几乎没有电流', 'rgba(255,255,255,.7)', 'center');
        } else {
          const { k, unit } = linScale();
          const R = RHO[mode] / 1e-3;
          p.line([[-2, (-2 / R) * k], [1, (1 / R) * k]], '#64d2ff', 2.5);
          p.dot(U, (U / R) * k, '#ffffff', 5);
          p.text(-1.95, plot.opts.yMax * 0.85, `单位：${unit}（直线：普通电阻，双向导电）`, 'rgba(255,255,255,.6)');
        }
      },
    });
    function linScale() {
      return mode === 'i' ? { k: 1e6, unit: 'μA' } : { k: 1e3, unit: 'mA' };
    }

    function refresh() {
      if (mode === 'pn') {
        I = diodeI(U);
        plot.opts.yMin = -5; plot.opts.yMax = 65;
      } else {
        const R = RHO[mode] / 1e-3; // 1 mm 立方体
        I = U / R;
        const { k } = linScale();
        const m = (2.3 / R) * k;
        plot.opts.yMin = -m; plot.opts.yMax = m;
      }
      plot.redraw();
      read.set('U', U);
      setSI(read, 'I', I, 'A');
      if (mode === 'pn') {
        read.set('W', 0, (W0_REAL * Math.sqrt(Math.max(VBI - U, 0.02) / VBI)).toFixed(2));
        read.set('n', 0, '10' + sup(16)); read.unit('n', 'cm⁻³（N 区）');
        read.set('p', 0, '10' + sup(16)); read.unit('p', 'cm⁻³（P 区）');
      } else {
        read.set('W', 0, '—');
        const n = mode === 'i' ? '1.0×10' + sup(10) : mode === 'n' ? '10' + sup(16) : '10' + sup(4);
        const p = mode === 'i' ? '1.0×10' + sup(10) : mode === 'p' ? '10' + sup(16) : '10' + sup(4);
        read.set('n', 0, n); read.unit('n', 'cm⁻³');
        read.set('p', 0, p); read.unit('p', 'cm⁻³');
      }
      // 电源
      bat.rotation.z = U >= 0 ? Math.PI / 2 : -Math.PI / 2;
      bat.visible = Math.abs(U) > 0.005;
      lbBat.element.textContent = Math.abs(U) < 0.005 ? '电源：0 V（未加电压）' : `电源 ${U > 0 ? '+' : '−'}${Math.abs(U).toFixed(2)} V：${U > 0 ? '左端（P 区）接正极' : '左端（P 区）接负极'}`;
      // 说明
      let msg;
      if (mode === 'i') msg = '<b>本征硅</b>：热运动偶尔把电子从共价键中“震”出来，同时留下一个空穴——电子和空穴<b>成对产生</b>，过一会儿又<b>成对复合</b>（闪光）。数量极少，所以纯硅导电性很差（电阻率约 2300 Ω·m）。';
      else if (mode === 'n') msg = '<b>N 型硅</b>：每个磷原子贡献 1 个自由电子，自由电子浓度比本征硅高约一百万倍，电阻率降到约 0.005 Ω·m。加上电压，电子逆着电场方向漂移形成电流；两个方向都能导电。';
      else if (mode === 'p') msg = '<b>P 型硅</b>：每个硼原子留下 1 个空穴。邻近键上的电子跳过来填补，空穴就“挪”到了别处——看粉色 + 号一格一格地跳动。加上电压，空穴顺着电场方向移动。';
      else if (U > 0.45) msg = `<b>正向偏置 ${U.toFixed(2)} V</b>：外电场抵消了内建电场，耗尽区变窄，电子和空穴大量越过 PN 结复合（闪光），电流 ${I >= 1e-3 ? (I * 1e3).toFixed(1) + ' mA' : (I * 1e6).toFixed(1) + ' μA'}，指示灯${I > 3e-3 ? '亮起' : '微亮'}。`;
      else if (U > 0.02) msg = `<b>正向电压 ${U.toFixed(2)} V</b>：还不够大，势垒仍然挡住了大部分载流子，电流很小。硅二极管要到约 0.6~0.7 V 才明显导通。`;
      else if (U < -0.02) msg = `<b>反向偏置 ${U.toFixed(2)} V</b>：外电场与内建电场同向，电子和空穴被拉离结区，耗尽区<b>变宽</b>，几乎没有电流（约 ${(Math.abs(I) * 1e15).toFixed(0)} fA）。这就是二极管的“单向”导电。`;
      else msg = '<b>未加电压</b>：交界处的电子和空穴已经互相复合掉，留下只有固定离子的耗尽区。离子产生的内建电场（N→P）阻止了进一步扩散，达到平衡。';
      note.set(msg);
    }

    build();

    /* ---------- 动画 ---------- */
    const HOP = 0.3;
    const tmpO = V(), tmpV = V();
    let lastW = -1;
    function chooseHop(h, fieldDir, drift, xmaxHole, pn) {
      const pPlus = clamp(0.5 + 0.42 * fieldDir * drift, 0.05, 0.95);
      let dx = Math.random() < pPlus ? 1 : -1;
      let dy = Math.random() < 0.5 ? 1 : -1;
      if (h.Y2 + dy < 0 || h.Y2 + dy > Y2MAX) dy = -dy;
      let nx = h.X2 + dx;
      const xOf = (X2) => X0 + X2 * 0.5;
      if (pn) {
        if (xOf(nx) > xmaxHole) dx = -1;
        if (h.X2 + dx < 0) dx = 1;
        nx = h.X2 + dx;
        h.fX = h.X2; h.fY = h.Y2;
        h.X2 = nx; h.Y2 += dy;
      } else if (nx > X2MAX || nx < 0) {
        // 从一端电极流出，另一端电极补进来
        h.X2 = nx > X2MAX ? nx - X2MAX : nx + X2MAX;
        h.Y2 += dy;
        h.fX = h.X2; h.fY = h.Y2;
      } else {
        h.fX = h.X2; h.fY = h.Y2;
        h.X2 = nx; h.Y2 += dy;
      }
      h.u = 0;
    }

    return {
      update(dt, t) {
        const isPN = mode === 'pn';
        // 耗尽区宽度
        if (isPN) {
          Wv = damp(Wv, targetW(), 3, dt);
          depl.scale.x = Wv;
          if (Math.abs(Wv - lastW) > 0.003) {
            lastW = Wv;
            const len = Math.max(0.25, Wv * 0.8);
            fieldArrows.forEach((a, k) => { a.set(tmpO.set(len / 2, -1.5 + k * 1.5, 0.45), tmpV.set(-len, 0, 0)); });
          }
        }
        // 漂移
        let fieldDir = 0, drift = 0, allowCross = false;
        if (isPN) {
          if (U > 0) {
            drift = clamp(Math.log10(Math.max(I, 1e-12) / 1e-6) / 4.5, 0, 1);
            fieldDir = 1;
            allowCross = I > 2e-5;
          } else { fieldDir = -1; drift = 0.5 * clamp(-U / 2, 0, 1); }
        } else { fieldDir = Math.sign(U); drift = Math.min(1, Math.abs(U) / 1.5); }
        const xmaxHole = allowCross ? 0.6 : -Wv / 2;
        const xminElec = allowCross ? -0.6 : Wv / 2;

        // 本征：热激发产生电子-空穴对
        if (mode === 'i' && dt > 0) {
          genT -= dt;
          if (genT <= 0 && holes.length < 3) {
            genT = 0.7 + Math.random() * 0.9;
            const X2 = 2 + ((Math.random() * (X2MAX - 4)) | 0);
            let Y2 = (Math.random() * (Y2MAX + 1)) | 0;
            if ((X2 + Y2) % 2 === 0) Y2 = Y2 === Y2MAX ? Y2 - 1 : Y2 + 1;
            const life = 3.5 + Math.random() * 2;
            const h = newHole(X2, Y2, life);
            const x = X0 + X2 * 0.5, y = Y0 + Y2 * 0.5;
            const e = newElec(x, y, life);
            if (h && e) { h.pair = e; e.pair = h; }
            sparks.spawn(x, y, 0.2, { size: 0.5, peak: 0.9, life: 0.35, color: 0x9fd0ff });
          }
        }

        // 空穴：在键之间跳动
        for (const h of holes) {
          if (dt <= 0) break;
          h.u += dt / HOP;
          h.life -= dt;
          if (h.u >= 1) {
            h.u = 1;
            const x = X0 + h.X2 * 0.5;
            if (isPN && allowCross && x >= -0.1) {
              // 越过结区与电子复合（释放能量），电源从左端电极补充新空穴
              sparks.spawn(x, Y0 + h.Y2 * 0.5, 0.25, { size: 0.7, peak: 1.0, life: 0.4, color: 0xfff0b0 });
              h.X2 = 1; h.Y2 = 2 * ((Math.random() * NY) | 0); h.fX = h.X2; h.fY = h.Y2;
              continue;
            }
            chooseHop(h, fieldDir, drift, xmaxHole, isPN);
          }
        }
        // 自由电子：连续随机运动 + 漂移
        for (const e of elecs) {
          if (dt <= 0) break;
          e.life -= dt;
          e.a += (Math.random() - 0.5) * dt * 9;
          const sp = 1.0;
          e.x += (Math.cos(e.a) * sp - fieldDir * drift * 1.3) * dt;
          e.y += Math.sin(e.a) * sp * dt;
          if (e.y > 2.2) { e.y = 2.2; e.a = -e.a; }
          if (e.y < -2.2) { e.y = -2.2; e.a = -e.a; }
          if (isPN) {
            if (allowCross && e.x <= 0.1) {
              sparks.spawn(e.x, e.y, 0.25, { size: 0.7, peak: 1.0, life: 0.4, color: 0xfff0b0 });
              e.x = 6.2; e.y = (Math.random() * 2 - 1) * 2;
            }
            if (e.x < xminElec) { e.x = Math.min(xminElec, 6.3); e.a = Math.PI - e.a; }
            if (e.x > 6.3) { e.x = 6.3; e.a = Math.PI - e.a; }
          } else {
            if (e.x > 6.3) e.x -= 12.6;
            if (e.x < -6.3) e.x += 12.6;
          }
        }
        // 本征：寿命到了就复合
        if (mode === 'i') {
          for (const h of holes) if (h.life <= 0) {
            sparks.spawn(X0 + h.X2 * 0.5, Y0 + h.Y2 * 0.5, 0.2, { size: 0.55, peak: 0.9, life: 0.4, color: 0xfff0b0 });
            if (h.pair) h.pair.life = -1;
          }
          holes = holes.filter((h) => h.life > 0);
          elecs = elecs.filter((e) => e.life > 0);
        }

        // 写入实例
        for (const b of hidden) { const p = bondEPos(b, 0); bondE.setAt(b * 2, p[0], p[1], p[2]); }
        hidden.length = 0;
        for (let k = 0; k < MAXC; k++) {
          const h = holes[k];
          if (!h) { holeDots.hide(k); holeSigns[k].visible = false; continue; }
          const e = h.u * h.u * (3 - 2 * h.u);
          const x = X0 + (h.fX + (h.X2 - h.fX) * e) * 0.5;
          const y = Y0 + (h.fY + (h.Y2 - h.fY) * e) * 0.5;
          holeDots.setAt(k, x, y, 0.12, 1);
          holeSigns[k].visible = true;
          holeSigns[k].position.set(x, y, 0.3);
          // 空穴 = 键上缺一个电子：把该键的一个电子藏起来
          const b = h.u < 0.5 ? bondIndex(h.fX, h.fY) : bondIndex(h.X2, h.Y2);
          if (b >= 0 && b < NBOND) { bondE.hide(b * 2); hidden.push(b); }
        }
        holeDots.commit();
        bondE.commit();
        for (let k = 0; k < MAXC; k++) {
          const e = elecs[k];
          if (!e) { freeE.hide(k); continue; }
          freeE.setAt(k, e.x, e.y, 0.28 + Math.sin(t * 5 + k) * 0.05, 1);
        }
        freeE.commit();

        // 杂质离子符号
        let ip = 0, ineg = 0;
        for (const d of dopants) {
          const [x, y] = sitePos(d.i, d.j);
          const show = !isPN || Math.abs(x) < Wv / 2;
          if (d.kind === 'P' && ip < ionSigns.length) { const s = ionSigns[ip++]; s.visible = show; s.position.set(x + 0.26, y + 0.26, 0.35); }
          if (d.kind === 'B' && ineg < ionSignsNeg.length) { const s = ionSignsNeg[ineg++]; s.visible = show; s.position.set(x + 0.26, y + 0.26, 0.35); }
        }
        for (; ip < ionSigns.length; ip++) ionSigns[ip].visible = false;
        for (; ineg < ionSignsNeg.length; ineg++) ionSignsNeg[ineg].visible = false;

        // 外电路
        const mag = clamp(Math.log10(Math.max(Math.abs(I), 1e-12) / 1e-7) / 6, 0, 1);
        extFlow.speed = Math.sign(I) * 2.2 * mag;
        extFlow.update(dt);
        lamp.userData.setLevel(Math.pow(clamp(Math.abs(I) / 0.03, 0, 1.2), 0.5));
        sparks.update(dt);
      },
    };
  },
};
