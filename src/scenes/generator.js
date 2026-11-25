import * as THREE from 'three';
import { COLOR, CSSCOLOR, wire, bulb, meter, ArrowFlow, Arrow, stageFloor, roundedPath, textSprite, V, clamp } from '../lib/kit.js';
import { LineFlow, polePair, uniformFieldLines, rotorCoilPoints, splitRing, brush, clearGroup } from '../lib/magnet-kit.js';

const W = 1.4, H = 1.5; // 画面中线圈半宽、半长（1 单位 = 2 cm）
const S = (2 * W * 0.02) * (2 * H * 0.02); // 线圈面积 ≈ 33.6 cm²
const ZC = 2.55, Z1 = 2.33, Z2 = 2.85; // 换向器 / 两个滑环的位置
const R_BULB = 8, U_BULB = 2.5; // 小灯泡电阻（Ω）与额定电压（V）
const GAP_SIN = Math.sin(0.08);

export default {
  id: 'generator',
  group: 'magnet',
  title: '发电机与交流电',
  subtitle: '<i>e</i> = <i>E</i><sub>m</sub> sin <i>ωt</i>',
  summary: '线圈在磁场中转动，磁通量周期性变化，就产生了方向不断反转的交流电。',
  lead: '把电动机“反过来用”：用外力带动线圈在磁场中转动，穿过线圈的磁通量周期性地变大变小，线圈中就产生<b>感应电动势</b>。线圈每转一圈，电流方向变化两次——这就是<b>交流电</b>。拖动转速滑块，看灯泡明暗、电流计指针和示波器波形。',
  formulas: [
    { expr: '<i>Φ</i> = <i>BS</i> cos <i>ωt</i>', desc: '穿过线圈的磁通量（Wb），<i>θ</i> = <i>ωt</i> 为线圈法线 <i>n</i> 与磁场 <i>B</i> 的夹角，<i>ω</i> 为角速度（rad/s）。' },
    { expr: '<i>e</i> = <i>NBSω</i> sin <i>ωt</i> = <i>E</i><sub>m</sub> sin <i>ωt</i>', desc: '感应电动势的瞬时值（V），峰值 <i>E</i><sub>m</sub> = <i>NBSω</i>：匝数、磁场、面积、转速越大，电压越高。' },
    { expr: '<i>E</i> = <span class="frac"><span><i>E</i><sub>m</sub></span><span>√2</span></span> ≈ 0.707<i>E</i><sub>m</sub>', desc: '正弦交流电的有效值。家用 220 V 指的就是有效值，峰值约 311 V。' },
    { expr: '<i>f</i> = <span class="frac"><span>1</span><span><i>T</i></span></span> = <span class="frac"><span><i>pn</i></span><span>60</span></span>', desc: '频率（Hz）：<i>n</i> 为每分钟转数，<i>p</i> 为磁极对数。我国电网 <i>f</i> = 50 Hz。' },
  ],
  sections: [
    {
      title: '发电机怎样发电？',
      html: `<p>发电机的核心是一个能在磁场中转动的线圈（<b>转子</b>）。当外力带动线圈转动时，穿过线圈的磁通量不断变化，根据法拉第电磁感应定律，线圈中就产生感应电动势。</p>
      <p>也可以从“切割磁感线”来理解：线圈的两条长边 ab、cd 在磁场中运动时切割磁感线，导线中的自由电子受到磁场力被推向一端，产生电动势。</p>
      <p>发电机并不“创造”能量，它只是把<b>机械能转化为电能</b>：灯泡越亮，带动线圈所需的力就越大（楞次定律的阻碍作用）。</p>`,
    },
    {
      title: '为什么是“交流”？',
      html: `<p>线圈转过半圈后，ab 边和 cd 边交换了位置：原来向上运动切割磁感线的边变成向下运动，电动势的方向随之反转。所以线圈每转一圈，电流方向改变两次。</p>
      <p>仔细看示波器：</p>
      <ul><li>线圈平面与磁感线<b>垂直</b>时（法线 n 与 B 平行），磁通量 <i>Φ</i> 最大，但此刻两条边沿着磁感线方向运动、不切割磁感线，电动势 <i>e</i> = 0；</li>
      <li>线圈平面与磁感线<b>平行</b>时，<i>Φ</i> = 0，但磁通量变化最快，<i>e</i> 达到峰值。</li></ul>
      <p><i>Φ</i> 是余弦曲线，<i>e</i> 是正弦曲线，两者相差四分之一个周期。注意：改变转速时 <i>Φ</i> 的幅度不变，<i>e</i> 的幅度却跟着变——电动势取决于磁通量变化的<b>快慢</b>。</p>`,
    },
    {
      title: '峰值与有效值：220 V 是什么意思？',
      html: `<p>交流电的电压时刻在变，用哪个数来表示它的“大小”？物理学用<b>有效值</b>：让交流电和直流电分别通过同一个电阻，如果在相同时间内产生的热量相同，这个直流电的数值就叫交流电的有效值。</p>
      <p>对正弦交流电，有效值 = 峰值 ÷ √2。我们常说的“家用电 220 V”就是有效值，它的峰值约为 220 × 1.414 ≈ <b>311 V</b>，每秒钟正负交替 50 次。</p>
      <p>电器铭牌上的额定电压、电流，交流电表的读数，指的都是有效值。</p>
      <div class="tip">50 Hz 的交流电让白炽灯每秒钟变暗 100 次，但灯丝来不及冷却，人眼也分辨不出，所以看起来是稳定发光的。画面中转得很慢，你能清楚地看到灯泡随电动势一明一暗。</div>`,
    },
    {
      title: '发电厂：都在“转圈圈”',
      html: `<p>几乎所有发电厂的最后一步都一样：<b>让发电机转起来</b>，区别只在于用什么推动它。</p>
      <table><tr><th>类型</th><th>推动发电机的力量</th></tr>
      <tr><td>水力发电</td><td>高处落下的水冲击水轮机</td></tr>
      <tr><td>火力发电</td><td>烧煤、天然气产生高温高压蒸汽，推动汽轮机</td></tr>
      <tr><td>核电</td><td>核裂变放热产生蒸汽，推动汽轮机</td></tr>
      <tr><td>风力发电</td><td>风吹动巨大的叶片</td></tr></table>
      <p>只有太阳能电池板是个例外：它利用光电效应直接把光变成电，没有任何转动部件。</p>
      <p>我国电网频率是 <b>50 Hz</b>。火电厂的汽轮发电机只有一对磁极，必须每分钟转 3000 圈；三峡水电站的发电机转得慢（约 75 转/分），就用 40 对磁极来凑够 50 Hz。</p>`,
    },
    {
      title: '直流发电机与三相交流电',
      html: `<p>切换到「直流发电机」：把滑环换成<b>换向器</b>，每当线圈中的电动势反向时，换向器同时把输出端对调，外电路得到的就是<b>方向不变、大小起伏的脉动直流电</b>（示波器上是一串“小山包”）。</p>
      <p>实际发电厂的发电机内有<b>三组线圈</b>，彼此相隔 120°，同时输出三个相位错开的交流电，这叫<b>三相交流电</b>。三相电输送功率更平稳、更省导线，也能直接驱动三相电动机。看看路边的高压线，导线通常是 3 根或 3 的倍数。</p>
      <p>大型发电机一般是“旋转磁极式”：线圈固定在外面（定子），转动的是电磁铁（转子），这样大电流不必经过滑环和电刷。</p>`,
    },
    {
      title: '常见误区',
      html: `<div class="warn"><b>误区：发电机产生了电荷。</b>导线中本来就有大量自由电子，发电机只是提供“推力”（电动势）让它们来回运动。交流电路中电子只是在原地附近来回振动，并不会从发电厂“流”到你家。传过来的是<b>能量</b>。</div>
      <p>另一个误区是“交流电方向不停改变，所以不能做功”。实际上，无论电流朝哪个方向，电阻都会发热、电动机都会转——能量的传递与电流方向无关。</p>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.view([6.2, 4.3, 11.2], [0, -0.7, 1.0], 5.4);
    ctx.setBloom(0.65, 0.45, 0.8);
    scene.add(stageFloor({ y: -3.6 }));

    const st = { mode: 'ac', rpm: 90, N: 100, B: 0.6 };
    const addLabel = (parent, text, cls, x, y, z) => {
      const l = ctx.label(text, { cls });
      l.position.set(x, y, z);
      parent.add(l);
      return l;
    };

    scene.add(polePair({ gap: 4.4, width: 1.5, height: 3.4, depth: 3.6 }));
    const field = new LineFlow(uniformFieldLines({ x0: -2.2, x1: 2.2, ys: [-1.25, -0.42, 0.42, 1.25], zs: [-1.45, -0.48, 0.48, 1.45] }), { opacity: 0.38, spacing: 0.75, arrowSize: 0.18 });
    scene.add(field.object);

    /* ---------- 转子 ---------- */
    const rotor = new THREE.Group();
    scene.add(rotor);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6.4, 16), new THREE.MeshStandardMaterial({ color: 0xc8c8d0, metalness: 0.9, roughness: 0.25 }));
    axle.rotation.x = Math.PI / 2;
    axle.position.z = 0.1;
    rotor.add(axle);
    // 后端的“水轮”：表示外力带动
    {
      const wheel = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x6f86a8, metalness: 0.5, roughness: 0.45 });
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 24), mat);
      hub.rotation.x = Math.PI / 2;
      wheel.add(hub);
      for (let i = 0; i < 8; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.06), mat);
        const a = (i / 8) * Math.PI * 2;
        blade.position.set(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0);
        blade.rotation.z = a;
        blade.rotation.x = 0.5;
        wheel.add(blade);
      }
      wheel.position.z = -2.75;
      rotor.add(wheel);
    }
    for (const [ch, p] of [['a', V(W + 0.3, 0, H + 0.1)], ['b', V(W + 0.3, 0, -H - 0.1)], ['c', V(-W - 0.3, 0, -H - 0.1)], ['d', V(-W - 0.3, 0, H + 0.1)]]) {
      const sp = textSprite(ch, { size: 0.36, color: '#ffd9b0' });
      sp.position.copy(p);
      rotor.add(sp);
    }
    let coilMat = null;
    const partsG = new THREE.Group(); // 线圈 + 滑环/换向器（随转子转）
    rotor.add(partsG);
    const extG = new THREE.Group(); // 电刷 + 外电路（固定）
    scene.add(extG);

    // 法线 n 与磁场 B
    const nArrow = new Arrow(0xf2f2f7, { radius: 0.04, headLength: 0.26, headRadius: 0.1, emissive: 0.5 });
    const bArrow = new Arrow(COLOR.bfield, { radius: 0.045, headLength: 0.28, headRadius: 0.11 });
    bArrow.set(V(0, 0, 0), V(1.9, 0, 0));
    scene.add(nArrow, bArrow);
    const lbN = addLabel(scene, '法线 n', 'small', 0, 0, 0);
    addLabel(scene, 'B', 'green', 2.15, 0.25, 0);
    // 两条长边上的电流方向箭头
    const sideA = new Arrow(COLOR.current, { radius: 0.05, headLength: 0.3, headRadius: 0.13, emissive: 1 });
    const sideB = new Arrow(COLOR.current, { radius: 0.05, headLength: 0.3, headRadius: 0.13, emissive: 1 });
    scene.add(sideA, sideB);

    // 外电路元件
    const G = meter({ symbol: 'G', max: 0.3, zeroCenter: true, size: 1.0, unit: 'A' });
    G.position.set(-1.6, -3.1, 4.0);
    scene.add(G);
    const gL = G.userData.left.clone().add(G.position);
    const gR = G.userData.right.clone().add(G.position);
    const lamp = bulb({ scale: 1.1 });
    lamp.position.set(1.6, -2.85, 4.0);
    scene.add(lamp);
    const socket = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.7), new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6 }));
    socket.position.set(1.6, -3.35, 4.0);
    scene.add(socket);
    const sA = V(1.1, -3.3, 4.0), sB = V(2.1, -3.3, 4.0);

    addLabel(scene, '线圈 abcd（转子）', 'small', -1.6, 2.35, 1.2);
    addLabel(scene, '外力带动旋转', 'small dim', 0, 1.55, -2.9);
    const lbRing = addLabel(scene, '滑环', 'orange small', 0, 0.95, 2.85);
    addLabel(scene, '灯泡', 'small', 2.55, -2.2, 4.0);
    addLabel(scene, '电流计', 'small', -2.75, -2.6, 4.0);

    let coilFlow = null, extFlow = null, ring = null;

    function buildParts() {
      clearGroup(partsG);
      clearGroup(extG);
      const ac = st.mode === 'ac';
      const leadA = [V(0.42, 0, ac ? Z1 : ZC), V(0.42, 0, 2.05)];
      const leadB = ac
        ? [V(-0.42, 0, 2.05), V(-0.15, 0, 2.25), V(-0.15, 0, Z2 - 0.1), V(-0.42, 0, Z2)]
        : [V(-0.42, 0, 2.05), V(-0.42, 0, ZC)];
      const cw = wire(roundedPath(rotorCoilPoints({ w: W, h: H, leadA, leadB }), 0.12), { radius: 0.075 });
      coilMat = cw.mesh.material;
      coilMat.emissive.setHex(COLOR.current);
      coilMat.emissiveIntensity = 0;
      partsG.add(cw.mesh);
      for (const dy of [-0.13, 0.13]) {
        const m = wire([V(W, dy, H), V(W, dy, -H), V(-W, dy, -H), V(-W, dy, H)], { radius: 0.05, corner: 0.12 }).mesh;
        partsG.add(m);
      }
      coilFlow = new ArrowFlow(cw.curve, { count: 16, size: 0.26, speed: 0 });
      partsG.add(coilFlow.object);

      let t1, t2; // 外电路两端：电流从 t1 经电流计、灯泡流到 t2 为正
      if (ac) {
        ring = null;
        for (const z of [Z1, Z2]) {
          const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 32), new THREE.MeshStandardMaterial({ color: 0xc8874a, metalness: 0.85, roughness: 0.28 }));
          m.rotation.x = Math.PI / 2;
          m.position.z = z;
          partsG.add(m);
        }
        const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.65, 24), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.7 }));
        ins.rotation.x = Math.PI / 2;
        ins.position.z = (Z1 + Z2) / 2;
        partsG.add(ins);
        for (const z of [Z1, Z2]) {
          const b = brush({ side: 1, r: 0.42 });
          b.rotation.z = -Math.PI / 2; // 从下方压在滑环上
          b.position.z = z;
          extG.add(b);
        }
        t1 = V(0, -0.82, Z1);
        t2 = V(0, -0.82, Z2);
        extG.add(wire([t1, V(0, -1.7, Z1), V(gL.x, -1.7, 4.0), gL], { radius: 0.045, corner: 0.25 }).mesh);
        extG.add(wire([sB, V(2.6, -3.3, 4.0), V(2.6, -1.5, 4.0), V(0, -1.5, Z2), t2], { radius: 0.045, corner: 0.25 }).mesh);
        lbRing.element.textContent = '两个滑环（各接线圈一端）';
      } else {
        ring = splitRing({ r: 0.42, len: 0.5 });
        ring.position.z = ZC;
        partsG.add(ring);
        const bL = brush({ side: -1, r: 0.42 });
        bL.position.z = ZC;
        const bR = brush({ side: 1, r: 0.42 });
        bR.position.z = ZC;
        extG.add(bL, bR);
        t1 = V(-0.82, 0, ZC);
        t2 = V(0.82, 0, ZC);
        extG.add(wire([t1, V(-1.6, 0, ZC), V(gL.x, -1.7, 4.0), gL], { radius: 0.045, corner: 0.25 }).mesh);
        extG.add(wire([sB, V(2.6, -3.3, 4.0), V(2.6, -1.5, 4.0), V(1.6, 0, ZC), t2], { radius: 0.045, corner: 0.25 }).mesh);
        lbRing.element.textContent = '换向器（两个半环）';
      }
      // 电流计 → 灯泡
      extG.add(wire([gR, V(gR.x, -2.0, 4.0), V(0.6, -2.0, 4.0), V(0.6, -3.3, 4.0), sA], { radius: 0.045, corner: 0.2 }).mesh);
      const extCurve = roundedPath(ac
        ? [t1, V(0, -1.7, Z1), V(gL.x, -1.7, 4.0), gL, V(gR.x, -2.0, 4.0), V(0.6, -2.0, 4.0), V(0.6, -3.3, 4.0), V(2.6, -3.3, 4.0), V(2.6, -1.5, 4.0), V(0, -1.5, Z2), t2]
        : [t1, V(-1.6, 0, ZC), V(gL.x, -1.7, 4.0), gL, V(gR.x, -2.0, 4.0), V(0.6, -2.0, 4.0), V(0.6, -3.3, 4.0), V(2.6, -3.3, 4.0), V(2.6, -1.5, 4.0), V(1.6, 0, ZC), t2], 0.25);
      extFlow = new ArrowFlow(extCurve, { count: 22, size: 0.2, speed: 0 });
      extG.add(extFlow.object);
    }

    /* ---------- 面板 ---------- */
    ui.segmented({
      label: '类型',
      options: [{ value: 'ac', label: '交流发电机' }, { value: 'dc', label: '直流发电机' }],
      value: st.mode,
      onChange: (v) => { st.mode = v; buildParts(); scope.clear(); },
    });
    ui.slider({ label: '转速 n', min: 0, max: 180, step: 5, value: st.rpm, unit: 'r/min', digits: 0, onInput: (v) => { st.rpm = v; } });
    ui.slider({ label: '线圈匝数 N', min: 10, max: 200, step: 10, value: st.N, unit: '匝', digits: 0, onInput: (v) => { st.N = v; } });
    ui.slider({ label: '磁感应强度 B', min: 0.1, max: 1.0, step: 0.05, value: st.B, unit: 'T', digits: 2, onInput: (v) => { st.B = v; field.setStrength(v); } });
    const note = ui.note('');
    const ro = ui.readouts([
      { key: 'f', label: '频率 f', unit: 'Hz', digits: 2 },
      { key: 'em', label: '峰值 Em', unit: 'V', digits: 2 },
      { key: 'e', label: '有效值 E', unit: 'V', digits: 2 },
      { key: 'u', label: '瞬时值 e', unit: 'V', digits: 2 },
      { key: 'phi', label: '磁通量 Φ', unit: 'mWb', digits: 2 },
    ]);
    const scope = ui.scope({
      title: '磁通量 Φ 与输出电动势 e',
      height: 130, yMin: -1.2, yMax: 1.2, window: 300,
      series: [{ label: 'Φ', color: CSSCOLOR.bfield }, { label: 'e', color: CSSCOLOR.current }],
    });
    ui.legend([
      { color: CSSCOLOR.bfield, label: '磁感线 B' },
      { color: CSSCOLOR.current, label: '感应电流方向' },
      { color: '#f2f2f7', label: '线圈法线 n' },
    ]);
    field.setStrength(st.B);
    buildParts();

    /* ---------- 动画 ---------- */
    let ang = 0; // ωt
    let lastNote = '';
    const setNote = (h) => { if (h !== lastNote) { lastNote = h; note.set(h); } };
    const pA = V(), pB = V(), vec = V(), tmp = V();

    return {
      update(dt) {
        const omega = (st.rpm / 60) * 2 * Math.PI; // rad/s（画面按真实转速转动）
        ang += omega * dt;
        if (ang > Math.PI * 2) ang -= Math.PI * 2;
        rotor.rotation.z = ang + Math.PI / 2; // ang = 0 时线圈平面竖直，法线沿 +x（∥B）

        const Em = st.N * st.B * S * omega;
        const sn = Math.sin(ang), cs = Math.cos(ang);
        const e = Em * sn; // 以法线 n 为正方向的电动势
        const phi = st.B * S * cs; // 每匝磁通
        const Rtot = R_BULB + 0.02 * st.N;
        const iPath = -e / Rtot; // 沿线圈路径（a→b→c→d）方向的电流
        let eOut;
        if (st.mode === 'ac') eOut = e;
        else eOut = Math.abs(sn) < GAP_SIN ? 0 : Math.abs(e); // 换向器缺口处短暂断开
        const iExt = eOut / Rtot;

        // 线圈 / 外电路中的电流箭头
        const ref = Math.max(0.05, st.N * 1.0 * S * 2 * Math.PI * 3 / Rtot);
        const kC = Math.min(1, Math.abs(iPath) / (Em / Rtot + 1e-9));
        coilFlow.speed = Math.abs(iPath) < 1e-4 ? 0 : Math.sign(iPath) * (0.3 + 1.8 * kC);
        coilFlow.object.visible = Math.abs(iPath) > 1e-4 && Math.abs(sn) > 0.05;
        coilFlow.update(dt);
        extFlow.speed = Math.abs(iExt) < 1e-4 ? 0 : Math.sign(iExt) * (0.3 + 1.8 * Math.min(1, Math.abs(iExt) / (Em / Rtot + 1e-9)));
        extFlow.object.visible = Math.abs(iExt) > 1e-4 && Math.abs(eOut) > 0.04 * Em;
        extFlow.update(dt);
        coilMat.emissiveIntensity = Math.min(0.9, (Math.abs(iPath) / ref) * 0.9);
        if (ring) {
          ring.userData.matA.emissiveIntensity = eOut ? 0.5 * Math.abs(sn) : 0;
          ring.userData.matB.emissiveIntensity = eOut ? 0.5 * Math.abs(sn) : 0;
        }

        // 长边电流方向：A 边（a→b）沿 −z，B 边（c→d）沿 +z（iPath>0 时）
        const th = ang + Math.PI / 2;
        const ct = Math.cos(th), stn = Math.sin(th);
        const len = 2.2 * Math.abs(sn);
        if (len > 0.15 && Math.abs(iPath) > 1e-4) {
          const sg = Math.sign(iPath);
          const r = W + 0.28;
          pA.set(r * ct, r * stn, sg * len / 2);
          vec.set(0, 0, -sg * len);
          sideA.set(pA, vec);
          pB.set(-r * ct, -r * stn, -sg * len / 2);
          vec.set(0, 0, sg * len);
          sideB.set(pB, vec);
        } else { sideA.visible = false; sideB.visible = false; }

        // 法线 n
        vec.set(1.7 * cs, 1.7 * sn, 0);
        nArrow.set(tmp.set(0, 0, 0), vec);
        lbN.position.set(2.0 * cs, 2.0 * sn + 0.2, 0);

        // 仪表与灯泡
        G.userData.setValue(iExt);
        G.userData.update(dt);
        lamp.userData.setLevel(Math.abs(iExt) * R_BULB / U_BULB);
        field.update(dt);

        // 读数
        ro.set('f', st.rpm / 60);
        ro.set('em', Em);
        ro.set('e', Em / Math.SQRT2);
        ro.set('u', eOut);
        ro.set('phi', phi * 1000);
        if (dt > 0) scope.push([clamp(phi / (1.0 * S), -1.2, 1.2), clamp(eOut / 4, -1.2, 1.2)]);

        setNote(st.rpm === 0
          ? '线圈不转，磁通量不变，没有感应电动势，灯泡不亮。'
          : st.mode === 'ac'
            ? `交流发电机：两个滑环各自固定接线圈的一端，线圈里的电流方向怎么变，外电路就怎么变——电流计指针<b>左右摆动</b>，灯泡每转半圈亮暗一次。现在频率 f = ${(st.rpm / 60).toFixed(2)} Hz（电网是 50 Hz）。`
            : '直流发电机：线圈中的电流仍在不断反向，但换向器每半圈对调一次输出端，外电路的电流方向始终不变，只是大小起伏——<b>脉动直流电</b>，电流计指针只朝一边摆。');
      },
    };
  },
};
