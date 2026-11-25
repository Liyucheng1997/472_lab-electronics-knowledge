import * as THREE from 'three';
import { COLOR, CSSCOLOR, ParticleCloud, Arrow, meter, wire, stageFloor, glowSprite, textSprite, V } from '../lib/kit.js';
import { LineBatch, RingPool, LabelSet, rod, C_LIGHT, fmtLength, fmtTime, num3 } from '../lib/wave-kit.js';

const S = 2; // 画面比例：1 米 = 2 格
const ANT_L = 1.5; // 两根天线的总长（米）：FM 波段的半波偶极子
const HALF = (ANT_L * S) / 2; // 每根半臂长 1.5 格
const GAP = 0.14;
const TXX = -6; // 发射天线的位置
const CV = 3.0; // 画面里的“光速”（格/秒），真实传播被慢放
const F0 = C_LIGHT / (2 * ANT_L) / 1e6; // 谐振频率（MHz）≈ 99.9
const Q = 3; // 偶极子天线的品质因数（很低：谐振峰较宽）
const NE = 26; // 每根臂上的电子数
// 场线（等值线）计算网格
const GX0 = -13.2, GX1 = 10.8, GY0 = -4.8, GY1 = 4.8, CELL = 0.15;
const NXG = Math.round((GX1 - GX0) / CELL) + 1;
const NYG = Math.round((GY1 - GY0) / CELL) + 1;
const LEVELS = [0.12, 0.42, 0.72, 1.02, 1.4, 1.9, 2.6];
// marching squares：每种情况连接哪两条边（0 下 1 右 2 上 3 左）
const SEGS = [[], [3, 0], [0, 1], [3, 1], [1, 2], [3, 2, 0, 1], [0, 2], [3, 2], [2, 3], [0, 2], [0, 3, 1, 2], [1, 2], [1, 3], [0, 1], [0, 3], []];

const resonance = (fMHz) => 1 / Math.sqrt(1 + Q * Q * Math.pow(fMHz / F0 - F0 / fMHz, 2));

/** 偶极子：两根金属杆 + 中间馈电点，返回 { group, electrons, ends } */
function dipole({ feedColor = 0x2a2a30 } = {}) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9ccd4, metalness: 0.85, roughness: 0.25, transparent: true, opacity: 0.55, depthWrite: false });
  g.add(rod([0, GAP / 2, 0], [0, HALF, 0], 0.075, metal, 16));
  g.add(rod([0, -GAP / 2, 0], [0, -HALF, 0], 0.075, metal, 16));
  const capMat = new THREE.MeshStandardMaterial({ color: 0xd8dbe2, metalness: 0.9, roughness: 0.2 });
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), capMat);
    cap.position.y = s * HALF;
    g.add(cap);
  }
  const feed = new THREE.Mesh(new THREE.BoxGeometry(0.26, GAP + 0.08, 0.26), new THREE.MeshStandardMaterial({ color: feedColor, roughness: 0.5 }));
  g.add(feed);
  const electrons = new ParticleCloud(NE * 2, { color: COLOR.electron, r: 0.045, emissive: 1.6 });
  g.add(electrons.mesh);
  const base = [];
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < NE; i++) {
      const y = s * (GAP / 2 + 0.05 + ((HALF - GAP / 2 - 0.1) * (i + 0.5)) / NE);
      base.push([Math.sin(i * 2.4) * 0.03, y, Math.cos(i * 2.4) * 0.03]);
    }
  }
  // 两端的电荷积累：红（+）/ 蓝（−）光晕 + 符号
  const ends = [];
  for (const s of [1, -1]) {
    const red = glowSprite(COLOR.proton, 0.9, 0);
    const blue = glowSprite(COLOR.electron, 0.9, 0);
    const plus = textSprite('+', { size: 0.34, color: '#ffffff', depthTest: false });
    const minus = textSprite('−', { size: 0.34, color: '#ffffff', depthTest: false });
    for (const o of [red, blue, plus, minus]) { o.position.set(0.32, s * (HALF - 0.1), 0); g.add(o); }
    red.position.x = blue.position.x = 0;
    ends.push({ s, red, blue, plus, minus });
  }
  return { group: g, electrons, base, ends };
}

/** 驱动偶极子动画：q 为“顶端电荷”（+1 顶端正、−1 顶端负），amp 为电子位移幅度 */
function driveDipole(d, q, amp) {
  for (let i = 0; i < d.base.length; i++) {
    const [x, y, z] = d.base[i];
    // 电流在中间最大、两端为零（半波驻波）：位移 ∝ cos(πy/2H)
    const s = -amp * Math.cos((Math.PI * y) / (2 * HALF)) * q;
    d.electrons.setAt(i, x, y + s, z);
  }
  d.electrons.commit();
  for (const e of d.ends) {
    const v = q * e.s * Math.min(1, amp / 0.28); // 顶端 s=1；底端相反
    e.red.material.opacity = Math.max(0, v) * 0.85;
    e.blue.material.opacity = Math.max(0, -v) * 0.85;
    e.plus.material.opacity = Math.max(0, v);
    e.minus.material.opacity = Math.max(0, -v);
  }
}

export default {
  id: 'antenna',
  group: 'wave',
  title: '天线：发射与接收',
  subtitle: '加速的电荷会辐射',
  summary: '交流电让天线里的电子来回奔跑，甩出电磁波；远处天线里的电子又被它推着动起来。',
  lead: '发射天线（左）中的电子被交流信号源推着上下奔跑，两端交替积累正负电荷，电场线一圈圈闭合、脱离天线向外飞去。电磁波到达右边的接收天线，推动里面的电子，电流计就有了读数。试着改变频率、距离和接收天线的角度。',
  formulas: [
    { expr: '<i>L</i> = <span class="frac"><span><i>λ</i></span><span>2</span></span> = <span class="frac"><span><i>c</i></span><span>2<i>f</i></span></span>', desc: '半波偶极子天线的总长 L（m）约等于波长的一半。实际做得再短约 5%。' },
    { expr: '<i>E</i> ≈ <span class="frac"><span>√(30 <i>P G</i>)</span><span><i>d</i></span></span>', desc: '距天线 d（m）处的电场强度有效值（V/m）。P 为发射功率（W），G 为天线增益（半波偶极子 G ≈ 1.64）。场强与距离成反比，功率与距离平方成反比。' },
    { expr: '<i>U</i> ≈ <i>E</i> · <span class="frac"><span><i>λ</i></span><span>π</span></span> · cos <i>α</i>', desc: '半波偶极子接收到的感应电压（V）。λ/π 是它的“有效长度”，α 是接收天线与电场方向的夹角：平行时最大，垂直时为零。' },
    { expr: '<i>t</i> = <span class="frac"><span><i>d</i></span><span><i>c</i></span></span>', desc: '信号从发射到接收的延迟（s），c ≈ 3×10⁸ m/s。' },
  ],
  sections: [
    {
      title: '加速运动的电荷会辐射电磁波',
      html: `<p>静止的电荷周围只有静电场；匀速运动的电荷带着它的电场一起平移。只有当电荷<b>加速</b>（速度大小或方向改变）时，周围的场线才会被“甩”出扭结，这些扭结以光速向外传播，就是电磁波。</p>
      <p>天线就是一根让电荷不停加速的导线：交流电源让导线里的自由电子每秒上下来回振动几亿次（画面中的蓝色小球），电子来回加速、减速，就源源不断地向外辐射电磁波。</p>
      <p>画面中：电子挤到天线一端，那一端就带负电（蓝光），另一端缺电子带正电（红光），半个周期后正负对调。黄色的电场线从正端连到负端；当电荷对调时，原来的场线来不及收回，就<b>闭合成一个个环</b>脱离天线向外跑——这就是被发射出去的电磁波。绿色的水平圆环是磁场 B，它绕着天线一圈圈向外扩散。</p>`,
    },
    {
      title: '为什么天线要做成特定长度？',
      html: `<p>天线里的电子像秋千：推的节奏和它的“固有节奏”一致时，最省力、振得最猛，这叫<b>谐振</b>。一根导线的固有节奏由它的长度决定：电信号从一端跑到另一端再反射回来，正好用掉半个周期时，就会谐振。</p>
      <div class="eq">天线长度 ≈ λ/2 = c / (2f)</div>
      <p>画面中左边的天线长 1.5 m，谐振频率 f = c/(2L) ≈ 100 MHz。拖动「频率」滑块，看紫色的 λ/2 标尺：它和天线一样长时，“谐振程度”达到 100%，电子振得最猛，辐射最强；频率偏离越多，辐射越弱。</p>
      <ul><li>FM 广播（约 100 MHz）：λ ≈ 3 m，半波天线约 1.5 m，所以老式收音机的拉杆天线有一米多长；</li>
      <li>手机（约 2 GHz）：λ ≈ 15 cm，天线只要几厘米，藏在手机外壳里；</li>
      <li>中波广播（约 1 MHz）：λ ≈ 300 m，发射天线是上百米高的铁塔。</li></ul>`,
    },
    {
      title: '辐射方向图：像个甜甜圈',
      html: `<p>打开「辐射方向图」：偶极子天线向四周发射的强度并不均匀，图形像一个套在天线上的<b>甜甜圈</b>：</p>
      <ul><li>垂直于天线的方向（水平四周）辐射最强；</li>
      <li>沿着天线本身的方向（正上方、正下方）完全不辐射——因为从那里看过去，电子只是在“前后”运动，没有横向的加速度。</li></ul>
      <p>所以广播电视的发射天线都是竖直的：信号向水平四周的城市发射，而不是浪费在天空和地下。如果把很多天线排成阵列并控制它们的相位，还能把电磁波集中成一束指向某个方向——5G 基站的“波束赋形”就是这样做的。</p>`,
    },
    {
      title: '接收：电场推动天线里的电子',
      html: `<p>电磁波到达接收天线时，它的电场（黄色箭头）推动天线中的自由电子上下振动，于是天线里产生了与发射端同频率的微弱交变电流，电流计的指针来回摆动。发射与接收其实是<b>同一个过程的逆过程</b>，所以同一根天线既能发射也能接收。</p>
      <p>点「重新发射」，注意：发射天线一开始振动，接收天线要<b>等一会儿</b>才开始动——电磁波跑过这段距离需要时间 t = d/c。真实距离 5 m 只要约 17 ns（画面慢放了约 2 亿倍）；地球到月球约 1.3 秒。</p>
      <p>把接收天线拉远，信号变弱：场强按 1/d 减小，功率按 1/d² 减小。</p>`,
    },
    {
      title: '偏振：天线要“摆对方向”',
      html: `<p>拖动「接收天线角度」：天线与电场方向平行（竖直）时，电场正好沿着天线推电子，接收最强；转到水平（垂直于电场）时，电场只能把电子往天线的“侧面”推，电子跑不起来，接收几乎为零。感应电压 ∝ cos α。</p>
      <p>这就是电磁波的<b>偏振</b>。电视天线有的横着装、有的竖着装，要和发射塔的偏振一致。手机的天线方向随你怎么拿都在变，所以基站常用两种偏振同时收发。</p>
      <div class="tip">有趣的事实：赫兹在 1888 年就发现了这一点——把接收环转一个角度，火花就消失了。这也是证明“电磁波是横波”的关键证据。</div>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.view([-1.2, 3.0, 22.5], [-1.2, -0.6, 0], 12.3);
    ctx.setBloom(0.7, 0.45, 0.72);
    scene.add(stageFloor({ y: -4.95, radius: 19 }));
    const labels = new LabelSet(ctx, scene);

    let fMHz = 100, P = 2, dM = 5, alphaDeg = 0;
    let txOn = true, tOn = 0, tOff = -1, tNow = 0;
    let ph = 0, lastCycle = 0;

    /* ---------- 发射天线 ---------- */
    const tx = dipole();
    tx.group.position.set(TXX, 0, 0);
    scene.add(tx.group);
    const sym = textSprite('~', { size: 0.34, color: '#ffd65c', depthTest: false });
    sym.position.set(TXX, 0, 0.16);
    scene.add(sym);
    // 馈线（同轴电缆）往后引到发射机
    scene.add(wire([V(TXX, 0, -0.14), V(TXX, 0, -1.6), V(TXX, -4.05, -1.6)], { radius: 0.05, color: 0x2a2a30, metalness: 0.2, roughness: 0.6 }).mesh);
    const txBox = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.9), new THREE.MeshStandardMaterial({ color: 0x2c2f38, roughness: 0.45, metalness: 0.3 }));
    txBox.position.set(TXX, -4.5, -1.6);
    scene.add(txBox);
    const txLamp = glowSprite(0xff9f0a, 0.6, 0.8);
    txLamp.position.set(TXX + 0.45, -4.3, -1.12);
    scene.add(txLamp);

    // λ/2 标尺
    const halfBarMat = new THREE.MeshBasicMaterial({ color: COLOR.wave, transparent: true, opacity: 0.65 });
    const halfBar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1, 0.07), halfBarMat);
    halfBar.position.set(TXX - 0.75, 0, 0);
    scene.add(halfBar);
    const halfCaps = [];
    for (const s of [1, -1]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), halfBarMat);
      c.position.set(TXX - 0.75, 0, 0);
      scene.add(c);
      halfCaps.push([c, s]);
    }

    /* ---------- 电场线（等值线）与磁场环 ---------- */
    const fieldLines = new LineBatch(26000, { color: COLOR.efield, opacity: 0.95, additive: true });
    scene.add(fieldLines.object);
    const grid = new Float32Array(NXG * NYG);
    const okMask = new Uint8Array(NXG * NYG);
    const bRings = new RingPool(18, { color: COLOR.bfield, plane: 'xz', speed: CV, maxR: 18, opacity: 0.7 });
    bRings.object.position.set(TXX, 0, 0);
    scene.add(bRings.object);

    /* ---------- 辐射方向图（甜甜圈） ---------- */
    const patG = new THREE.Group();
    patG.position.set(TXX, 0, 0);
    patG.visible = false;
    scene.add(patG);
    {
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const th = 0.001 + ((Math.PI - 0.002) * i) / 64;
        const F = Math.pow(Math.cos((Math.PI / 2) * Math.cos(th)) / Math.sin(th), 2);
        const r = 3.4 * F;
        pts.push(new THREE.Vector2(r * Math.sin(th), r * Math.cos(th)));
      }
      const geo = new THREE.LatheGeometry(pts, 48);
      patG.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLOR.current, emissive: COLOR.current, emissiveIntensity: 0.25, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })));
      patG.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: COLOR.current, wireframe: true, transparent: true, opacity: 0.18 })));
    }

    /* ---------- 接收天线 ---------- */
    const rxHolder = new THREE.Group();
    scene.add(rxHolder);
    const rx = dipole({ feedColor: 0x33363f });
    rxHolder.add(rx.group);
    const meterG = meter({ symbol: 'G', max: 1, zeroCenter: true, size: 0.85 });
    meterG.position.set(1.7, -2.45, 0);
    rxHolder.add(meterG);
    {
      const stand = new THREE.MeshStandardMaterial({ color: 0x3a3d46, metalness: 0.5, roughness: 0.4 });
      rxHolder.add(rod([1.7, -2.85, -0.05], [1.7, -4.95, -0.05], 0.05, stand));
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.06, 24), stand);
      foot.position.set(1.7, -4.92, -0.05);
      rxHolder.add(foot);
    }
    {
      const ml = meterG.userData.left.clone().add(meterG.position);
      const mr = meterG.userData.right.clone().add(meterG.position);
      rxHolder.add(wire([V(0.12, 0.03, 0), V(1.0, 0.03, 0), V(1.0, ml.y + 0.25, 0), V(ml.x, ml.y + 0.25, 0), ml], { radius: 0.025, corner: 0.15 }).mesh);
      rxHolder.add(wire([V(0.12, -0.03, 0.05), V(2.45, -0.03, 0.05), V(2.45, mr.y + 0.25, 0.05), V(mr.x, mr.y + 0.25, 0.05), mr], { radius: 0.025, corner: 0.15 }).mesh);
    }
    const eArrow = new Arrow(COLOR.efield, { radius: 0.04, headLength: 0.24, headRadius: 0.1, emissive: 0.9 });
    scene.add(eArrow);
    // 接收天线的方向指示（虚线圆弧）
    const arcMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    {
      const pts = [];
      for (let i = 0; i <= 24; i++) { const a = (i / 24) * (Math.PI / 2); pts.push(new THREE.Vector3(0.02, Math.cos(a) * (HALF + 0.35), Math.sin(a) * (HALF + 0.35))); }
      rxHolder.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), arcMat));
    }

    /* ---------- 标签 ---------- */
    labels.add('发射天线（半波偶极子 1.5 m）', [TXX, HALF + 0.75, 0], 'small');
    labels.add('交流信号源', [TXX + 1.05, -0.35, 0], 'small yellow');
    labels.add('发射机', [TXX, -3.7, -1.6], 'small dim');
    const lbHalf = labels.add('', [TXX - 1.6, 0, 0], 'small purple');
    labels.add('接收天线', [0, HALF + 0.75, 0], 'small', rxHolder);
    labels.add('电流计', [1.7, -3.25, 0.4], 'small dim', rxHolder);
    labels.add('电场线闭合成环、脱离天线', [TXX + 6.2, 4.2, 0], 'yellow small');
    labels.add('磁场 B：水平圆环向外扩散', [TXX - 4.2, -1.0, 4.2], 'green small');

    /* ---------- 面板 ---------- */
    ui.slider({ label: '发射频率 f', min: 50, max: 200, step: 1, value: fMHz, unit: 'MHz', digits: 0, onInput: (v) => { fMHz = v; refresh(); } });
    ui.slider({ label: '发射功率 P', min: 0.1, max: 5, step: 0.1, value: P, unit: 'W', digits: 1, onInput: (v) => { P = v; refresh(); } });
    ui.slider({ label: '接收距离 d', min: 3, max: 8, step: 0.1, value: dM, unit: 'm', digits: 1, onInput: (v) => { dM = v; refresh(); } });
    ui.slider({ label: '接收天线角度 α（0° = 竖直）', min: 0, max: 90, step: 1, value: alphaDeg, unit: '°', digits: 0, onInput: (v) => { alphaDeg = v; refresh(); } });
    ui.toggle({ label: '发射机开启', value: true, onChange: (v) => { txOn = v; if (v) tOn = tNow; else tOff = tNow; } });
    ui.button({ label: '重新发射（观察延迟）', primary: true, onClick: () => { txOn = true; tOn = tNow; tOff = -1; bRings.clear(); scope.clear(); } });
    ui.toggle({ label: '显示辐射方向图（甜甜圈）', value: false, onChange: (v) => (patG.visible = v) });
    ui.toggle({ label: '显示磁场 B 圆环', value: true, onChange: (v) => (bRings.object.visible = v) });
    const note = ui.note('');
    const read = ui.readouts([
      { key: 'l', label: '波长 λ = c/f', unit: 'm' },
      { key: 'h', label: '最佳天线长 λ/2', unit: 'm' },
      { key: 'r', label: '谐振程度', unit: '%' },
      { key: 'E', label: '接收处场强 E', unit: 'V/m' },
      { key: 'U', label: '感应电压 U', unit: 'V' },
      { key: 't', label: '传播延迟 d/c', unit: 'ns' },
    ]);
    const scope = ui.scope({
      title: '天线电流（慢放）', height: 110, yMin: -1.2, yMax: 1.2, window: 300,
      series: [{ label: '发射天线', color: CSSCOLOR.current }, { label: '接收天线', color: CSSCOLOR.signal }],
    });
    ui.legend([
      { color: CSSCOLOR.electron, label: '自由电子' },
      { color: CSSCOLOR.efield, label: '电场线 E' },
      { color: CSSCOLOR.bfield, label: '磁场 B' },
      { color: CSSCOLOR.wave, label: 'λ/2 标尺' },
    ]);

    const lamM = () => C_LIGHT / (fMHz * 1e6);
    const txAmp = () => resonance(fMHz) * Math.sqrt(P / 5);
    function refresh() {
      const lam = lamM();
      const R = resonance(fMHz);
      const alpha = (alphaDeg * Math.PI) / 180;
      rxHolder.position.set(TXX + dM * S, 0, 0);
      rx.group.rotation.x = alpha;
      // λ/2 标尺
      const hv = (lam / 2) * S;
      halfBar.scale.y = hv;
      for (const [c, s] of halfCaps) c.position.y = (s * hv) / 2;
      lbHalf.position.set(TXX - 1.75, Math.min(hv / 2, 3.6) - 0.1, 0);
      lbHalf.element.textContent = `λ/2 = ${num3(lam / 2)} m`;
      // 物理量
      const E = Math.sqrt(30 * P * 1.64) / dM; // V/m（有效值）
      const U = E * (lam / Math.PI) * Math.abs(Math.cos(alpha)) * R * R;
      let [v, u] = fmtLength(lam); read.set('l', 0, v); read.unit('l', u);
      [v, u] = fmtLength(lam / 2); read.set('h', 0, v); read.unit('h', u);
      read.set('r', R * 100, (R * 100).toFixed(0));
      read.set('E', 0, num3(E));
      if (U >= 1) { read.set('U', 0, num3(U)); read.unit('U', 'V'); } else { read.set('U', 0, num3(U * 1000)); read.unit('U', 'mV'); }
      [v, u] = fmtTime(dM / C_LIGHT); read.set('t', 0, v); read.unit('t', u);
      const resTxt = R > 0.97 ? '天线长度正好等于半个波长，<b>谐振</b>！电子振得最猛，辐射最强。'
        : fMHz < F0 ? `频率偏低：半波长 ${num3(lam / 2)} m 比天线（1.5 m）长，天线“太短”，失谐，辐射变弱。`
          : `频率偏高：半波长 ${num3(lam / 2)} m 比天线（1.5 m）短，天线“太长”，失谐，辐射变弱。`;
      const polTxt = alphaDeg < 5 ? '接收天线与电场方向平行，接收最强。'
        : alphaDeg > 85 ? '接收天线与电场垂直：电场无法沿天线推动电子，几乎收不到（偏振）。'
          : `接收天线倾斜 ${alphaDeg}°，只有沿天线方向的电场分量起作用：信号 × cos ${alphaDeg}° = ${Math.cos(alpha).toFixed(2)}。`;
      note.set(`${resTxt}<br>${polTxt}`);
    }
    refresh();

    const _o = new THREE.Vector3(), _v = new THREE.Vector3();
    const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    // 前沿/尾沿的“开关”：只有 r 处于 [CV·(t−tOff), CV·(t−tOn)] 之间才有波
    const gateAt = (r) => {
      const front = txOn || tOff > tOn ? CV * (tNow - tOn) : -1;
      let g = smooth((front - r) / 0.8);
      if (!txOn && tOff > tOn) g *= smooth((r - CV * (tNow - tOff)) / 0.8);
      return g;
    };

    return {
      update(dt) {
        tNow += dt;
        const lamV = lamM() * S; // 画面中的波长（格）
        const k = (2 * Math.PI) / lamV;
        const R = resonance(fMHz);
        const a = txAmp();
        const alpha = (alphaDeg * Math.PI) / 180;
        ph += CV * k * dt;

        // 发射天线：源处的振动
        const srcG = gateAt(0);
        const q = Math.cos(ph) * srcG;
        driveDipole(tx, q, 0.28 * a);
        txLamp.material.opacity = txOn ? 0.85 : 0.1;

        // 磁场环：每个周期发出一圈
        const cyc = Math.floor(ph / (2 * Math.PI));
        if (cyc !== lastCycle) { lastCycle = cyc; if (srcG > 0.5) bRings.emit(0.3 + 0.7 * a); }
        bRings.update(dt);

        // 电场线：F = a·sin²θ·[cos(kr−ωt)/(kr) + sin(kr−ωt)] 的等值线
        for (let j = 0; j < NYG; j++) {
          const y = GY0 + j * CELL;
          for (let i = 0; i < NXG; i++) {
            const x = GX0 + i * CELL;
            const dx = x - TXX;
            const r = Math.sqrt(dx * dx + y * y);
            const id = j * NXG + i;
            if (r < 0.32) { okMask[id] = 0; continue; }
            okMask[id] = 1;
            const kr = k * r;
            const psi = kr - ph;
            const s2 = (dx * dx) / (r * r);
            grid[id] = a * s2 * (Math.cos(psi) / kr + Math.sin(psi)) * gateAt(r);
          }
        }
        fieldLines.begin();
        const NLV = LEVELS.length;
        for (let j = 0; j < NYG - 1; j++) {
          const y0 = GY0 + j * CELL, y1 = y0 + CELL;
          for (let i = 0; i < NXG - 1; i++) {
            const id = j * NXG + i;
            if (!(okMask[id] && okMask[id + 1] && okMask[id + NXG] && okMask[id + NXG + 1])) continue;
            const v0 = grid[id], v1 = grid[id + 1], v2 = grid[id + NXG + 1], v3 = grid[id + NXG];
            const lo = Math.min(v0, v1, v2, v3), hi = Math.max(v0, v1, v2, v3);
            if (hi - lo < 1e-9 || (hi < LEVELS[0] && lo > -LEVELS[0])) continue;
            const x0 = GX0 + i * CELL, x1 = x0 + CELL;
            for (let li = 0; li < NLV * 2; li++) {
              const Lv = li < NLV ? LEVELS[li] : -LEVELS[li - NLV];
              if (Lv <= lo || Lv >= hi) continue;
              const c = (v0 > Lv ? 1 : 0) | (v1 > Lv ? 2 : 0) | (v2 > Lv ? 4 : 0) | (v3 > Lv ? 8 : 0);
              const segs = SEGS[c];
              for (let s = 0; s < segs.length; s += 2) {
                let ax = 0, ay = 0, bx = 0, by = 0;
                for (let e = 0; e < 2; e++) {
                  const edge = segs[s + e];
                  let px, py;
                  if (edge === 0) { px = x0 + ((Lv - v0) / (v1 - v0)) * CELL; py = y0; }
                  else if (edge === 1) { px = x1; py = y0 + ((Lv - v1) / (v2 - v1)) * CELL; }
                  else if (edge === 2) { px = x1 - ((Lv - v2) / (v3 - v2)) * CELL; py = y1; }
                  else { px = x0; py = y1 - ((Lv - v3) / (v0 - v3)) * CELL; }
                  if (e === 0) { ax = px; ay = py; } else { bx = px; by = py; }
                }
                fieldLines.seg(ax, ay, 0, bx, by, 0, 1, 1);
              }
            }
          }
        }
        fieldLines.end();

        // 接收天线：同频振动，但晚了 d/c
        const rr = dM * S;
        const g = gateAt(rr);
        const eNorm = a * (3 / dM) * g; // 到达处的电场（相对值，∝ 1/d）
        const eNow = eNorm * Math.cos(ph - k * rr);
        const rxQ = R * Math.cos(alpha) * eNow; // 接收天线也要谐振；只有沿天线的分量起作用
        driveDipole(rx, Math.cos(ph - k * rr) * g, 0.28 * Math.min(1, R * a * (3 / dM)) * Math.cos(alpha));
        eArrow.set(_o.set(TXX + rr, 0, 0.75), _v.set(0, 1.6 * eNow, 0));
        meterG.userData.setValue(rxQ);
        meterG.userData.update(dt);
        scope.push([a * Math.sin(ph) * srcG, R * Math.cos(alpha) * eNorm * Math.sin(ph - k * rr)]);
      },
    };
  },
};
