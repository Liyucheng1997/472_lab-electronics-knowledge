import * as THREE from 'three';
import { COLOR, CSSCOLOR, wire, battery, ArrowFlow, Arrow, stageFloor, roundedPath, V, damp } from '../lib/kit.js';
import { LineFlow, polePair, uniformFieldLines, rotorCoilPoints, splitRing, brush, clearGroup, lastPanelEl, setShown } from '../lib/magnet-kit.js';

// 物理参数（SI）：50 匝、长边 5 cm、宽 4 cm 的线圈，线圈电阻 3 Ω
const P = { N: 50, L: 0.05, W: 0.04, R: 3, J: 2e-5, b: 8e-5, tc: 4e-4 };
const S = P.L * P.W; // 线圈面积 m²
const SLOW = 40; // 画面放慢倍数
const GAP_SIN = Math.sin(0.1); // 换向器缺口（约 ±6°）内两电刷都接触不到
const FORCE = 0xe86bff; // 力的颜色
const W = 1.4, H = 1.5; // 画面中线圈半宽、半长
const ZC = 2.55; // 换向器位置
const ZB = 2.6; // 电池位置

export default {
  id: 'motor',
  group: 'magnet',
  title: '电动机',
  subtitle: '<i>F</i> = <i>BIL</i>',
  summary: '通电线圈在磁场中受力转动，把电能变成机械能——风扇、电动车、无人机都靠它。',
  lead: '磁场会对电流施加力（安培力）。把导线绕成线圈放在磁极之间，两条长边电流方向相反、受力方向也相反，线圈就转了起来；<b>换向器</b>每转半圈把线圈里的电流反向一次，让它一直朝同一个方向转。画面放慢了 40 倍。',
  formulas: [
    { expr: '<i>F</i> = <i>BIL</i>', desc: '安培力（N）= 磁感应强度 <i>B</i>（T）× 电流 <i>I</i>（A）× 导线在磁场中的长度 <i>L</i>（m）。导线与磁场垂直时最大，平行时为零。<i>N</i> 匝线圈每条边受力 <i>NBIL</i>。' },
    { expr: '<i>M</i> = <i>NBIS</i> cos <i>θ</i>', desc: '线圈受到的力矩（N·m）。<i>S</i> 为线圈面积（m²），<i>θ</i> 为线圈平面与磁场的夹角：线圈平面与磁感线平行时力矩最大，垂直时为零。' },
    { expr: '<i>I</i> = <span class="frac"><span><i>U</i> − <i>E</i><sub>反</sub></span><span><i>R</i></span></span>', desc: '转动的线圈也会产生感应电动势 <i>E</i><sub>反</sub>（反电动势），它与转速成正比、方向与电源电压相反，所以转得越快电流越小。' },
  ],
  sections: [
    {
      title: '磁场对电流的作用力',
      html: `<p>通电导线放在磁场中会受到力，这个力叫<b>安培力</b>。它的大小 <i>F</i> = <i>BIL</i>：磁场越强、电流越大、处在磁场中的导线越长，力就越大。</p>
      <p>力的方向既垂直于电流，也垂直于磁场，用<b>左手定则</b>判断：伸开左手，让磁感线垂直穿入掌心，四指指向电流方向，那么拇指所指的就是导线受力的方向。</p>
      <p>切换到「通电导线」：导线吊在磁极之间，一通电就被“推”出去；点「电流反向」，它就朝另一边摆。</p>
      <div class="tip">安培力的本质是磁场对<b>运动电荷</b>的作用力（洛伦兹力 <i>F</i> = <i>qvB</i>）。导线里定向移动的无数电子都被磁场推向一侧，再通过晶格把力传给整根导线。</div>`,
    },
    {
      title: '线圈为什么会转？',
      html: `<p>把导线绕成矩形线圈，放在 N、S 两个磁极之间。线圈两条长边里的电流方向<b>相反</b>，所以受到的安培力也<b>一上一下</b>（画面中紫色箭头），这一对力让线圈绕轴转动。</p>
      <p>转动效果用<b>力矩</b> <i>M</i> = <i>NBIS</i> cos <i>θ</i> 衡量：</p>
      <ul><li>线圈平面与磁感线<b>平行</b>（水平）时，两个力的“力臂”最长，力矩最大；</li>
      <li>线圈平面与磁感线<b>垂直</b>（竖直）时，两个力在同一直线上、方向相反，力矩为零——这个位置叫<b>平衡位置</b>。</li></ul>
      <p>两条短边的电流也在磁场中，但它们受的力沿着转轴方向，不产生转动效果。</p>`,
    },
    {
      title: '换向器：让线圈一直转下去',
      html: `<p>如果线圈直接接在电池上，转过平衡位置后，两条边的受力方向不变，力矩却变成了“往回拉”。线圈只会在竖直位置附近来回摆动，最后停下。关掉「换向器」试试看。</p>
      <p><b>换向器</b>是套在转轴上的两个半圆铜环，彼此绝缘，分别接线圈的两端；两个固定的<b>电刷</b>压在铜环上把电流送进去。线圈每转过平衡位置，两个半环正好交换所接触的电刷，线圈中的电流方向就<b>反过来</b>，力矩方向也随之保持不变。</p>
      <p>看示波器：<b>电源输出的电流</b>方向始终不变，而<b>线圈中的电流</b>每半圈翻转一次——这正是换向器的作用。</p>
      <div class="tip">换向器的缺口处两个电刷都接触不到铜环，线圈恰好停在这里就无法自己启动，这叫“死点”。实际电动机有很多组线圈和很多片换向片，任何位置都能启动，转起来也更平稳。</div>`,
    },
    {
      title: '反电动势：电动机也在“发电”',
      html: `<p>线圈在磁场中转动时，它的边在切割磁感线，线圈里会产生感应电动势（见「电磁感应」一章）。这个电动势的方向和电源电压<b>相反</b>，叫做<b>反电动势</b>，转速越高它越大。</p>
      <p>所以线圈中的实际电流 <i>I</i> = (<i>U</i> − <i>E</i><sub>反</sub>)/<i>R</i>：刚启动时转速为零，电流最大（画面中力的箭头最长）；转得越快，电流越小，直到电磁力矩刚好平衡摩擦，转速稳定下来。</p>
      <div class="warn">如果电动机被卡住转不动，反电动势消失，电流会非常大，线圈很快过热烧毁。这也是大功率电器启动瞬间灯光会暗一下的原因。</div>`,
    },
    {
      title: '电动机无处不在',
      html: `<p>电动机把<b>电能转化为机械能</b>，效率可达 80%~97%，远高于燃油发动机的 30%~40%。</p>
      <ul><li>家里：风扇、空调压缩机、洗衣机、吸尘器、冰箱</li>
      <li>交通：电动汽车、高铁、地铁、电动自行车</li>
      <li>小设备：手机振动马达、硬盘、无人机、电动牙刷</li>
      <li>工业：机床、水泵、电梯、机器人关节</li></ul>
      <p>据估计，全世界大约一半的电能是被各种电动机消耗掉的。</p>`,
    },
    {
      title: '有刷电机与无刷电机',
      html: `<p>画面中这种靠电刷和换向器“机械换向”的叫<b>有刷直流电机</b>，结构简单、便宜，但电刷与铜环一直在摩擦，会磨损、产生火花和噪声。</p>
      <p><b>无刷电机</b>反过来：永磁体装在转子上，线圈固定在外壳上，用霍尔传感器测出转子的位置，再由电子电路按顺序切换各组线圈的电流——相当于用芯片代替了换向器。它寿命长、效率高、可以转得很快，电脑风扇、无人机、电动汽车用的几乎都是它。</p>
      <p>有趣的是，电动机和发电机的结构几乎一样：用外力转动电动机的转轴，它就会发电。电动汽车刹车时让电机“反过来”发电给电池充电，这叫<b>能量回收</b>。</p>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.setBloom(0.6, 0.45, 0.8);
    scene.add(stageFloor({ y: -3.6 }));

    const st = { mode: 'motor', U: 6, B: 0.3, comm: true, p: 1 };
    const addLabel = (parent, text, cls, x, y, z) => {
      const l = ctx.label(text, { cls });
      l.position.set(x, y, z);
      parent.add(l);
      return l;
    };

    /* ======================= 电动机模型 ======================= */
    const motorG = new THREE.Group();
    scene.add(motorG);
    motorG.add(polePair({ gap: 4.4, width: 1.5, height: 3.4, depth: 3.6 }));
    const fieldM = new LineFlow(uniformFieldLines({ x0: -2.2, x1: 2.2, ys: [-1.25, -0.42, 0.42, 1.25], zs: [-1.45, -0.48, 0.48, 1.45] }), { opacity: 0.4, spacing: 0.75, arrowSize: 0.18 });
    motorG.add(fieldM.object);

    // 转子：转轴 + 线圈 + 换向器（或滑环），绕 z 轴转动
    const rotor = new THREE.Group();
    motorG.add(rotor);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6.2, 16), new THREE.MeshStandardMaterial({ color: 0xc8c8d0, metalness: 0.9, roughness: 0.25 }));
    axle.rotation.x = Math.PI / 2;
    axle.position.z = 0.35;
    rotor.add(axle);
    const coilG = new THREE.Group();
    rotor.add(coilG);
    const extG = new THREE.Group();
    motorG.add(extG);

    // 电池（横放，+ 极默认朝 +x，接右侧电刷）
    const bat = battery({ height: 1.6, radius: 0.36 });
    bat.position.set(0, -3.0, ZB);
    motorG.add(bat);

    // 力的箭头
    const arrA = new Arrow(FORCE, { radius: 0.05, headLength: 0.3, headRadius: 0.13, emissive: 0.8 });
    const arrB = new Arrow(FORCE, { radius: 0.05, headLength: 0.3, headRadius: 0.13, emissive: 0.8 });
    motorG.add(arrA, arrB);
    const lbFA = addLabel(motorG, 'F', 'purple', 0, 0, 0);
    const lbFB = addLabel(motorG, 'F', 'purple', 0, 0, 0);

    addLabel(motorG, '换向器', 'orange small', 0, 0.95, ZC + 0.25);
    addLabel(motorG, '电刷', 'small', 1.55, 0.5, ZC);
    addLabel(motorG, '线圈（绕轴转动）', 'small', -1.0, 2.3, 1.4);
    addLabel(motorG, '磁场 B：N → S', 'green small', 1.2, 2.05, -1.7);
    addLabel(motorG, '电源', 'small dim', 0, -3.65, ZB + 0.5);

    let coilFlow = null, extFlow = null, ring = null;

    /** 根据是否有换向器，重建线圈引线、换向器/滑环、电刷和外电路 */
    function buildRotorParts() {
      clearGroup(coilG);
      clearGroup(extG);
      const z1 = ZC - 0.22, z2 = ZC + 0.3;
      const zR = st.comm ? ZC : z1, zL = st.comm ? ZC : z2;
      const leadA = [V(0.42, 0, zR), V(0.42, 0, 2.05)];
      const leadB = st.comm
        ? [V(-0.42, 0, 2.05), V(-0.42, 0, zL)]
        : [V(-0.42, 0, 2.05), V(-0.15, 0, 2.25), V(-0.15, 0, z2 - 0.1), V(-0.42, 0, z2)];
      const pts = rotorCoilPoints({ w: W, h: H, leadA, leadB });
      const cw = wire(roundedPath(pts, 0.12), { radius: 0.075 });
      coilG.add(cw.mesh);
      // 多匝的示意：再画两圈细的
      for (const dy of [-0.13, 0.13]) {
        coilG.add(wire([V(W, dy, H), V(W, dy, -H), V(-W, dy, -H), V(-W, dy, H)], { radius: 0.05, corner: 0.12 }).mesh);
      }
      coilFlow = new ArrowFlow(cw.curve, { count: 16, size: 0.26, speed: 1 });
      coilG.add(coilFlow.object);
      if (st.comm) {
        ring = splitRing({ r: 0.42, len: 0.5 });
        ring.position.z = ZC;
        coilG.add(ring);
      } else {
        ring = null;
        for (const z of [z1, z2]) {
          const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 32), new THREE.MeshStandardMaterial({ color: 0xc8874a, metalness: 0.85, roughness: 0.28 }));
          m.rotation.x = Math.PI / 2;
          m.position.z = z;
          coilG.add(m);
        }
        const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.65, 24), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.7 }));
        ins.rotation.x = Math.PI / 2;
        ins.position.z = (z1 + z2) / 2;
        coilG.add(ins);
      }
      // 电刷（固定，不随转子转）
      const bR = brush({ side: 1, r: 0.42 });
      bR.position.z = zR;
      const bL = brush({ side: -1, r: 0.42 });
      bL.position.z = zL;
      extG.add(bR, bL);
      // 外电路
      extG.add(wire([V(0.82, 0, zR), V(1.7, 0, zR), V(1.7, -3, ZB), V(0.9, -3, ZB)], { radius: 0.05, corner: 0.25 }).mesh);
      extG.add(wire([V(-0.82, 0, zL), V(-1.7, 0, zL), V(-1.7, -3, ZB), V(-0.9, -3, ZB)], { radius: 0.05, corner: 0.25 }).mesh);
      const extCurve = roundedPath([V(0.82, 0, zR), V(1.7, 0, zR), V(1.7, -3, ZB), V(-1.7, -3, ZB), V(-1.7, 0, zL), V(-0.82, 0, zL)], 0.25, true);
      extFlow = new ArrowFlow(extCurve, { count: 14, size: 0.2, speed: 0 });
      extG.add(extFlow.object);
    }
    buildRotorParts();

    /* ======================= 通电导线（左手定则） ======================= */
    const wireG = new THREE.Group();
    scene.add(wireG);
    {
      const grey = new THREE.MeshStandardMaterial({ color: 0x55565e, roughness: 0.5, metalness: 0.6 });
      const red = new THREE.MeshStandardMaterial({ color: COLOR.magnetN, roughness: 0.45, metalness: 0.15 });
      const blue = new THREE.MeshStandardMaterial({ color: COLOR.magnetS, roughness: 0.45, metalness: 0.15 });
      const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); wireG.add(m); };
      box(2.4, 0.8, 2.0, grey, -2.4, 1.5, 0);
      box(2.4, 0.8, 2.0, red, 0, 1.5, 0);
      box(2.4, 0.8, 2.0, grey, -2.4, -1.5, 0);
      box(2.4, 0.8, 2.0, blue, 0, -1.5, 0);
      box(0.8, 3.8, 2.0, grey, -4.0, 0, 0);
      // 支架
      const metal = new THREE.MeshStandardMaterial({ color: 0xb8b8c0, metalness: 0.85, roughness: 0.3 });
      for (const z of [-2.3, 2.3]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 7.3, 12), metal);
        post.position.set(0, 0.05, z);
        wireG.add(post);
      }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.8, 12), metal);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(0, 3.65, 0);
      wireG.add(bar);
    }
    addLabel(wireG, 'N', 'red big', 0, 2.25, 1.1);
    addLabel(wireG, 'S', 'blue big', 0, -2.25, 1.1);
    const wLines = [];
    for (const x of [-0.8, 0, 0.8]) for (const z of [-0.6, 0, 0.6]) {
      const l = [];
      for (let i = 0; i <= 8; i++) l.push(V(x, 1.1 - (2.2 * i) / 8, z));
      wLines.push(l);
    }
    const fieldW = new LineFlow(wLines, { opacity: 0.45, spacing: 0.7, arrowSize: 0.18 });
    wireG.add(fieldW.object);
    const swing = new THREE.Group();
    swing.position.set(0, 3.6, 0);
    wireG.add(swing);
    const swingPts = [V(0, 0, -1.7), V(0, -3.6, -1.7), V(0, -3.6, 1.7), V(0, 0, 1.7)];
    const sw = wire(swingPts, { radius: 0.06, corner: 0.15 });
    swing.add(sw.mesh);
    const swingFlow = new ArrowFlow(sw.curve, { count: 10, size: 0.24, speed: 1 });
    swing.add(swingFlow.object);
    // 电池横放在地面：+ 极（st.p>0 时朝 +x）经后方立柱接到导线后端，− 极接前方立柱
    const wBat = battery({ height: 1.6, radius: 0.36 });
    wBat.position.set(2.6, -3.2, 2.3);
    wireG.add(wBat);
    wireG.add(wire([V(1.7, -3.2, 2.3), V(0.09, -3.2, 2.3)], { radius: 0.035 }).mesh);
    wireG.add(wire([V(3.5, -3.2, 2.3), V(4.0, -3.2, 2.3), V(4.0, -3.2, -2.3), V(0.09, -3.2, -2.3)], { radius: 0.035, corner: 0.2 }).mesh);
    // 左手定则三箭头
    const TO = V(4.4, 0.2, 0.6);
    const aB = new Arrow(COLOR.bfield, { radius: 0.04, headLength: 0.25, headRadius: 0.1 });
    const aI = new Arrow(COLOR.current, { radius: 0.04, headLength: 0.25, headRadius: 0.1 });
    const aF = new Arrow(FORCE, { radius: 0.05, headLength: 0.28, headRadius: 0.12, emissive: 0.8 });
    wireG.add(aB, aI, aF);
    const lbB = addLabel(wireG, 'B', 'green', 0, 0, 0);
    const lbI = addLabel(wireG, 'I', 'orange', 0, 0, 0);
    const lbF = addLabel(wireG, 'F', 'purple', 0, 0, 0);
    addLabel(wireG, '左手定则：磁感线穿掌心，四指指电流，拇指指受力', 'yellow small', TO.x - 0.4, TO.y + 1.85, TO.z);
    addLabel(wireG, '通电导线（可摆动）', 'orange small', -1.3, -0.45, 1.9);
    const lbFw = addLabel(wireG, 'F', 'purple', 0, 0, 0);
    const arrW = new Arrow(FORCE, { radius: 0.05, headLength: 0.28, headRadius: 0.12, emissive: 0.8 });
    wireG.add(arrW);

    /* ======================= 面板 ======================= */
    const views = {
      motor: [[5.8, 4.4, 10.8], [0, -0.5, 0.6], 5.2],
      wire: [[4.2, 2.6, 11.5], [0.4, -0.2, 0], 6],
    };
    ui.segmented({
      label: '演示',
      options: [{ value: 'motor', label: '电动机' }, { value: 'wire', label: '通电导线' }],
      value: st.mode,
      onChange: (v) => setMode(v),
    });
    ui.slider({ label: '电源电压 U', min: 0, max: 12, step: 0.5, value: st.U, unit: 'V', digits: 1, onInput: (v) => { st.U = v; } });
    ui.slider({ label: '磁感应强度 B', min: 0.05, max: 0.6, step: 0.05, value: st.B, unit: 'T', digits: 2, onInput: (v) => { st.B = v; refreshStatic(); } });
    const tComm = ui.toggle({ label: '换向器', value: st.comm, onChange: (v) => { st.comm = v; buildRotorParts(); if (v && Math.abs(omega) < 0.5) omega -= st.p * 30; } });
    const btns = ui.buttons([
      { label: '电流反向', onClick: () => { st.p = -st.p; refreshStatic(); } },
      { label: '推一下', onClick: () => { omega += (omega === 0 ? -st.p : Math.sign(omega)) * 60; } },
    ]);
    const kickRow = btns[1];
    const note = ui.note('');
    const roM = ui.readouts([
      { key: 'I', label: '线圈电流 I', unit: 'A', digits: 2 },
      { key: 'F', label: '每边受力 F', unit: 'N', digits: 2 },
      { key: 'M', label: '力矩 M', unit: 'mN·m', digits: 1 },
      { key: 'n', label: '转速（真实）', unit: 'r/min', digits: 0 },
    ]);
    const roMEl = lastPanelEl(ui);
    const roW = ui.readouts([
      { key: 'I', label: '电流 I', unit: 'A', digits: 2 },
      { key: 'F', label: '安培力 F', unit: 'N', digits: 3 },
      { key: 'a', label: '摆角', unit: '°', digits: 0 },
    ]);
    const roWEl = lastPanelEl(ui);
    const scope = ui.scope({
      title: '电流（以启动电流为 1）',
      height: 120, yMin: -1.2, yMax: 1.2, window: 300,
      series: [{ label: '线圈中的电流', color: CSSCOLOR.current }, { label: '电源输出的电流', color: CSSCOLOR.signal }],
    });
    const scopeEl = lastPanelEl(ui);
    ui.legend([
      { color: CSSCOLOR.bfield, label: '磁感线 B' },
      { color: CSSCOLOR.current, label: '电流方向' },
      { color: '#e86bff', label: '安培力 F' },
    ]);

    function refreshStatic() {
      fieldM.setStrength(st.B / 0.6);
      fieldM.speed = 0.25 + st.B;
      fieldW.setStrength(st.B / 0.6);
      fieldW.speed = 0.25 + st.B;
      // 电池 + 极朝 +x（右）时 st.p = +1
      bat.rotation.z = st.p > 0 ? -Math.PI / 2 : Math.PI / 2;
      wBat.rotation.z = st.p > 0 ? -Math.PI / 2 : Math.PI / 2;
    }

    function setMode(m) {
      st.mode = m;
      motorG.visible = m === 'motor';
      wireG.visible = m === 'wire';
      const v = views[m];
      ctx.view(v[0], v[1], v[2]);
      setShown(tComm.el, m === 'motor');
      setShown(kickRow, m === 'motor');
      setShown(roMEl, m === 'motor');
      setShown(scopeEl, m === 'motor');
      setShown(roWEl, m === 'wire');
      lastNote = '';
    }

    /* ======================= 物理 ======================= */
    let theta = 0.35, omega = 0, Ipath = 0, sc = 1, tau = 0, rpm = 0;
    let alpha = 0, alphaV = 0; // 导线摆角
    let lastNote = '';
    const setNote = (h) => { if (h !== lastNote) { lastNote = h; note.set(h); } };

    function physStep(h) {
      const c = Math.cos(theta);
      sc = st.comm ? (c > GAP_SIN ? 1 : c < -GAP_SIN ? -1 : 0) : 1;
      const e = P.N * st.B * S * omega * c; // 沿线圈路径方向的感应电动势（反电动势）
      Ipath = sc === 0 ? 0 : (sc * st.p * st.U + e) / P.R;
      tau = -P.N * Ipath * S * st.B * c;
      let acc;
      if (omega === 0 && Math.abs(tau) <= P.tc) acc = 0;
      else acc = (tau - P.b * omega - P.tc * Math.sign(omega || tau)) / P.J;
      const prev = omega;
      omega += acc * h;
      if (prev !== 0 && Math.sign(omega) !== Math.sign(prev) && Math.abs(tau) <= P.tc) omega = 0;
      theta += omega * h;
    }

    const pA = V(), pB = V(), vA = V(), vB = V(), tmp = V();
    refreshStatic();
    setMode('motor');

    return {
      update(dt) {
        if (st.mode === 'motor') {
          if (dt > 0) {
            const hp = dt / SLOW;
            const n = Math.max(1, Math.ceil(hp / 1e-4));
            for (let i = 0; i < n; i++) physStep(hp / n);
            theta = Math.atan2(Math.sin(theta), Math.cos(theta));
          }
          rotor.rotation.z = theta;
          const c = Math.cos(theta), s = Math.sin(theta);
          const Ist = Math.max(0.2, st.U / P.R);
          // 线圈电流（沿线圈路径方向为正）、电源电流（从电池 + 极流出为正）
          coilFlow.speed = Ipath === 0 ? 0 : Math.sign(Ipath) * (0.6 + 1.6 * Math.min(1, Math.abs(Ipath) / Ist));
          coilFlow.object.visible = Math.abs(Ipath) > 1e-3;
          const Iin = sc * Ipath; // 从右侧电刷流入线圈的电流
          extFlow.speed = Iin === 0 ? 0 : -Math.sign(Iin) * (0.6 + 1.6 * Math.min(1, Math.abs(Iin) / Ist));
          extFlow.object.visible = Math.abs(Iin) > 1e-3;
          coilFlow.update(dt);
          extFlow.update(dt);
          if (ring) {
            const k = Math.min(1, Math.abs(Ipath) / Ist);
            ring.userData.matA.emissiveIntensity = sc !== 0 ? 0.25 + 0.6 * k : 0;
            ring.userData.matB.emissiveIntensity = sc !== 0 ? 0.25 + 0.6 * k : 0;
          }
          // 两条长边受力：A 边（局部 +x）电流沿 −z，F_A = −N·I·L·B ŷ；B 边相反
          const F = P.N * Ipath * P.L * st.B;
          const Fst = Math.max(1e-6, P.N * Ist * P.L * st.B);
          const len = Math.abs(F) < 1e-5 ? 0 : 0.35 + 1.7 * Math.sqrt(Math.min(1.2, Math.abs(F) / Fst));
          pA.set(W * c, W * s, 0);
          pB.set(-W * c, -W * s, 0);
          vA.set(0, -Math.sign(F) * len, 0);
          vB.set(0, Math.sign(F) * len, 0);
          arrA.set(pA, vA);
          arrB.set(pB, vB);
          lbFA.position.copy(pA).addScaledVector(vA, 1.12).add(tmp.set(0.3, 0, 0.2));
          lbFB.position.copy(pB).addScaledVector(vB, 1.12).add(tmp.set(-0.3, 0, 0.2));
          lbFA.visible = lbFB.visible = len > 0;
          fieldM.update(dt);
          const rpmNow = (Math.abs(omega) * 60) / (2 * Math.PI);
          rpm = damp(rpm, rpmNow, 4, dt);
          roM.set('I', Math.abs(Ipath));
          roM.set('F', Math.abs(F));
          roM.set('M', Math.abs(tau) * 1000);
          roM.set('n', rpm);
          if (dt > 0) scope.push([Math.max(-1.2, Math.min(1.2, Ipath / Ist)), Math.max(-1.2, Math.min(1.2, Iin / Ist))]);
          setNote(!st.comm
            ? '<b>没有换向器</b>：线圈直接接在电源上，电流方向始终不变。线圈转过竖直位置后力矩反向，把它往回拉，于是线圈只能在<b>竖直位置</b>（线圈平面与磁感线垂直）附近来回摆动，最后停下。'
            : st.U === 0
              ? '电压为 0，线圈中没有电流，不受力，电动机靠惯性慢慢停下。'
              : sc === 0
                ? '电刷正处在换向器的<b>缺口</b>上：线圈中暂时没有电流，靠惯性转过去。'
                : `线圈每转过竖直位置，换向器就把线圈中的电流<b>反向</b>，两条长边的受力始终推着线圈朝同一方向转（${omega < 0 ? '顺' : '逆'}时针，从前方看）。启动时电流最大，转起来后反电动势使电流变小。`);
        } else {
          // 通电导线：I = U/R，F = BIL，单摆在重力与安培力作用下摆动
          const I = (st.p * st.U) / P.R;
          const x = 3.6 * Math.sin(alpha); // 导线偏离中心的距离（画面单位）
          const fx = Math.abs(x) < 1.1 ? 1 : Math.max(0, (1.9 - Math.abs(x)) / 0.8); // 离开磁极就几乎不受力
          const F = st.B * I * P.L; // 沿 +x 为正
          const m = 0.005, ell = 0.1, g = 9.8;
          const h = dt * 0.7;
          if (h > 0) {
            const n = Math.max(1, Math.ceil(h / 0.002));
            for (let i = 0; i < n; i++) {
              const xx = 3.6 * Math.sin(alpha);
              const f = Math.abs(xx) < 1.1 ? 1 : Math.max(0, (1.9 - Math.abs(xx)) / 0.8);
              const acc = (-g * Math.sin(alpha) + ((F * f) / m) * Math.cos(alpha)) / ell - 3 * alphaV;
              alphaV += acc * (h / n);
              alpha += alphaV * (h / n);
            }
          }
          swing.rotation.z = alpha;
          swingFlow.speed = I === 0 ? 0 : Math.sign(I) * (0.6 + Math.abs(I) * 0.35);
          swingFlow.object.visible = I !== 0;
          swingFlow.update(dt);
          fieldW.update(dt);
          // 导线上的力箭头
          const wx = 3.6 * Math.sin(alpha), wy = 3.6 - 3.6 * Math.cos(alpha);
          const fl = Math.abs(F * fx) < 1e-5 ? 0 : 0.4 + 1.4 * Math.min(1, Math.abs(F * fx) / 0.12);
          tmp.set(Math.sign(F) * fl, 0, 0);
          arrW.set(pA.set(wx, wy, 0.0), tmp);
          lbFw.position.set(wx + Math.sign(F) * (fl + 0.3), wy + 0.25, 0);
          lbFw.visible = fl > 0;
          // 左手定则示意
          const sI = st.p;
          aB.set(TO, vA.set(0, -1.3, 0));
          aI.set(TO, vB.set(0, 0, 1.3 * sI));
          aF.set(TO, tmp.set(1.3 * sI, 0, 0));
          lbB.position.set(TO.x, TO.y - 1.5, TO.z);
          lbI.position.set(TO.x, TO.y, TO.z + 1.55 * sI);
          lbF.position.set(TO.x + 1.55 * sI, TO.y, TO.z);
          roW.set('I', Math.abs(I));
          roW.set('F', Math.abs(F * fx));
          roW.set('a', Math.abs((alpha * 180) / Math.PI));
          setNote(I === 0
            ? '没有电流时导线不受力，自然下垂。'
            : `导线中电流${sI > 0 ? '朝向你（+z）' : '背离你（−z）'}，磁场从上方 N 极指向下方 S 极，安培力 F = BIL 把导线推向<b>${sI > 0 ? '右' : '左'}</b>边。导线摆出磁极之间后几乎不再受力，所以停在磁极边缘附近。`);
        }
      },
    };
  },
};
