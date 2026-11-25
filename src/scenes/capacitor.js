import * as THREE from 'three';
import { COLOR, CSSCOLOR, battery, resistor, Flow, stageFloor, disposeTree, damp, clamp, V } from '../lib/kit.js';
import { Dots, addWire, addJoint, pathOf, setSI, fmtSI } from '../lib/circuit-kit.js';

const EPS0 = 8.854e-12; // 真空介电常数 F/m
const U0 = 6; // 电源电压 V
const BAT_X = -4.6, TOPY = 2.4, BOTY = -2.4, CX = 2.6, RES_X = -0.4;
const PIV = V(-1.9, BOTY, 0);
const LEVER = 1.0;
const ANG_CHG = Math.PI, ANG_DIS = Math.PI * 0.75;
const PA = V(PIV.x + LEVER * Math.cos(ANG_CHG), BOTY, 0); // 充电触点
const PB = V(PIV.x + LEVER * Math.cos(ANG_DIS), BOTY + LEVER * Math.sin(ANG_DIS), 0); // 放电触点
const J_X = PB.x;
const NQ = 120; // 每块极板最多显示的电荷数
const TAU_MIN = 17.7e-6;
const ROT = -0.6; // 电容器绕竖直轴转一个角度，让镜头能看到两板之间

export default {
  id: 'capacitor',
  group: 'circuit',
  title: '电容器',
  subtitle: 'C = εS / d',
  summary: '两块靠得很近的金属板就能“存”电荷：一边多出电子，一边缺少电子，中间建立起电场。',
  lead: '电源通过电阻给平行板电容器充电：电子从左极板被“抽走”、压到右极板上，两板间的黄色电场线随之增强。切换到放电，电荷经电阻流回、电场消失。调节极板面积、间距、电介质和电阻，看看电容和充电快慢如何改变。',
  formulas: [
    { expr: '<i>C</i> = <span class="frac"><span><i>ε</i><sub>r</sub><i>ε</i><sub>0</sub><i>S</i></span><span><i>d</i></span></span>', desc: '平行板电容：C（法拉 F）与极板正对面积 S（m²）成正比、与间距 d（m）成反比；ε₀ = 8.85×10⁻¹² F/m，εr 为电介质的相对介电常数。' },
    { expr: '<i>Q</i> = <i>CU</i>，<i>W</i> = <span class="frac"><span>1</span><span>2</span></span><i>CU</i><sup>2</sup>', desc: '电容器所带电荷量 Q（库仑 C）= 电容 × 两板间电压；储存的电场能 W（焦耳 J）。' },
    { expr: '<i>u</i><sub>C</sub> = <i>U</i>(1 − e<sup>−<i>t</i>/<i>τ</i></sup>)，<i>τ</i> = <i>RC</i>', desc: '充电时电容电压按指数规律上升，电流 i = (U/R)e^(−t/τ) 指数衰减。时间常数 τ（秒）= 电阻（Ω）× 电容（F）；经过 τ 充到 63%，经过 5τ 基本充满。' },
  ],
  sections: [
    {
      title: '电容器是怎样“存”电的？',
      html: `<p>最简单的电容器就是<b>两块相互靠近、彼此绝缘的金属板</b>。把它接到电源上：</p>
      <ul><li>电源正极把左极板上的自由电子“吸走”，左板因缺少电子带<b>正电 +Q</b>（红色）；</li>
      <li>电源负极把同样数量的电子“推”到右极板上，右板带<b>负电 −Q</b>（蓝色）。</li></ul>
      <p>注意：<b>没有任何电子穿过两板之间的缝隙</b>，它们是绕外电路搬过去的。两板带等量异号电荷，中间建立起<b>匀强电场</b>（黄色线），能量就储存在这个电场里。</p>
      <p>电容器所带电荷量与电压成正比：Q = CU。比例系数 <b>C</b> 叫<b>电容</b>，单位<b>法拉（F）</b>，表示“每伏电压能存多少库仑电荷”。1 F 是非常大的单位，常用 μF（10⁻⁶ F）、nF（10⁻⁹ F）、pF（10⁻¹² F）。</p>`,
    },
    {
      title: '为什么充满后电流就停了？',
      html: `<p>刚开始充电时，极板上没有电荷，电容两端电压 u = 0，电源电压全部加在电阻上，电流最大：I₀ = U/R。</p>
      <p>随着电荷堆积，极板上的电荷开始<b>排斥</b>后来的电荷，电容电压 u 越来越接近电源电压，电阻两端的电压 U − u 越来越小，电流也就越来越小。当 u = U 时，电流为零——电容器“充满”了。</p>
      <p>看右侧示波器：电压按 u = U(1 − e<sup>−t/τ</sup>) 上升，电流按指数规律衰减。时间常数 <b>τ = RC</b> 决定快慢：电阻越大（电荷“挤”得越慢）、电容越大（要装的电荷越多），充电越慢。</p>
      <div class="tip">真实的平行板电容很小（本实验约几十 pF 到几 nF），τ 只有微秒到毫秒，眨眼都来不及。画面中的时间被大幅放慢，并对不同 τ 做了压缩，方便比较——读数里显示的才是真实值。</div>
      <p>所以电容器“隔直流、通交流”：接直流电源时，充满后就不再有电流；而交流电不断换向，电容器反复充放电，电路中始终有电流。</p>`,
    },
    {
      title: '决定电容大小的因素',
      html: `<div class="eq"><i>C</i> = <i>ε</i><sub>r</sub><i>ε</i><sub>0</sub><i>S</i> / <i>d</i></div>
      <ul><li><b>正对面积 S 越大</b>，能容纳的电荷越多，C 越大。</li>
      <li><b>间距 d 越小</b>，正负电荷靠得越近、相互吸引越强，同样电压下能“拉”住更多电荷，C 越大。</li>
      <li><b>插入电介质</b>（绝缘材料，如纸、云母、陶瓷）：电介质分子在电场中被<b>极化</b>，靠近正极板的一面出现负电荷，靠近负极板的一面出现正电荷（画面中介质板两侧的淡蓝、淡红薄层），部分抵消了极板电荷的电场，于是同样电压下极板能容纳 εr 倍的电荷。</li></ul>
      <table><tr><th>电介质</th><th>相对介电常数 εr</th></tr>
      <tr><td>真空 / 空气</td><td>1</td></tr><tr><td>纸</td><td>约 3.5</td></tr><tr><td>云母</td><td>约 6</td></tr>
      <tr><td>玻璃</td><td>4 ~ 10</td></tr><tr><td>水</td><td>约 80</td></tr><tr><td>钛酸钡陶瓷</td><td>1000 以上</td></tr></table>
      <p>实际的电容器把两条长长的金属箔夹着绝缘薄膜卷成一卷，在小体积里获得很大的面积和极小的间距。</p>`,
    },
    {
      title: '电容器的储能与应用',
      html: `<p>充电后的电容器储存了电场能 W = ½CU²。它最大的特点是能<b>在极短时间内释放能量</b>：</p>
      <ul><li><b>相机闪光灯</b>：电池用几秒钟慢慢给电容充电，按下快门时在约 1 毫秒内全部放出，产生耀眼的闪光。</li>
      <li><b>心脏除颤器</b>：电容器充到约 1000~2000 V，在几毫秒内放出约 200 J 的能量，让紊乱的心脏恢复正常节律。</li>
      <li><b>电源滤波</b>：手机充电器、电脑电源里的大电容像“蓄水池”，把起伏的电压抹平。</li>
      <li><b>触摸屏</b>：手指靠近屏幕时，改变了屏幕上微小电容的大小，芯片据此算出触摸位置。</li>
      <li><b>电脑内存（DRAM）</b>：每一位数据就是一个极小的电容器有没有电荷。电荷会慢慢漏掉，所以内存每秒要刷新几十次。</li></ul>`,
    },
    {
      title: '超级电容 vs 电池',
      html: `<p><b>超级电容器</b>用多孔活性炭做电极，每克的表面积可达 1000 m² 以上，电荷层间距只有分子尺度，电容可以达到<b>数千法拉</b>——是本画面电容器的万亿倍。</p>
      <table><tr><th></th><th>电池</th><th>超级电容</th></tr>
      <tr><td>储能原理</td><td>化学反应</td><td>电荷静电吸附</td></tr>
      <tr><td>充电时间</td><td>几十分钟到几小时</td><td>几秒到几分钟</td></tr>
      <tr><td>循环寿命</td><td>几百到几千次</td><td>几十万次以上</td></tr>
      <tr><td>储能多少</td><td>多</td><td>少（约为锂电池的 1/10~1/20）</td></tr></table>
      <p>所以超级电容适合“快充快放”的场合：一些城市的<b>电容公交车</b>在每个站台停靠的几十秒内充满电，跑到下一站；汽车启停系统、电梯和起重机的能量回收也会用到它。</p>
      <div class="warn">大电容断电后仍可能储存着危险的电荷！维修电视、微波炉等电器时，即使拔了插头，内部高压电容也可能电击伤人，要先放电。</div>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.view([1.2, 2.6, 13.2], [0.1, 0.1, 0], 6.0);
    ctx.setBloom(0.7, 0.45, 0.78);
    scene.add(stageFloor({ y: -3.6 }));

    /* ---------- 固定部分：电源、电阻、单刀双掷开关 ---------- */
    const bat = battery({ height: 1.8, radius: 0.42 });
    bat.position.set(BAT_X, 0, 0);
    scene.add(bat);
    const batTop = bat.userData.top.clone().add(bat.position);
    const batBot = bat.userData.bottom.clone().add(bat.position);
    const res = resistor({ length: 1.4, radius: 0.22 });
    res.position.set(RES_X, TOPY, 0);
    scene.add(res);
    addWire(scene, [batTop, V(BAT_X, TOPY), V(RES_X - 0.7, TOPY)]);
    addWire(scene, [V(J_X, TOPY), PB]);
    addWire(scene, [PA, V(BAT_X, BOTY), batBot]);
    addJoint(scene, V(J_X, TOPY));
    const postMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d6, metalness: 0.9, roughness: 0.25 });
    for (const p of [PIV, PA, PB]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 16), postMat);
      post.rotation.x = Math.PI / 2;
      post.position.copy(p);
      scene.add(post);
    }
    const lever = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(LEVER, 0.06, 0.1), postMat);
    bar.position.x = LEVER / 2;
    lever.add(bar);
    lever.position.copy(PIV).add(V(0, 0, 0.1));
    lever.rotation.z = ANG_CHG;
    scene.add(lever);

    /* ---------- 电容器（局部坐标：极板法线沿 x，中心在原点） ---------- */
    const capG = new THREE.Group();
    capG.position.set(CX, 0, 0);
    capG.rotation.y = ROT;
    scene.add(capG);
    const COS = Math.cos(ROT), SIN = Math.sin(ROT);
    const toWorld = (x, y) => V(CX + x * COS, y, -x * SIN);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xb8bec8, metalness: 0.85, roughness: 0.3, transparent: true, opacity: 0.5, depthWrite: false });
    const plateGeo = new THREE.BoxGeometry(1, 1, 1);
    const plateL = new THREE.Mesh(plateGeo, plateMat);
    const plateR = new THREE.Mesh(plateGeo, plateMat);
    capG.add(plateL, plateR);
    const PLATE_T = 0.08;

    const posQ = new Dots(NQ, { r: 0.065, color: COLOR.proton, emissive: COLOR.proton, emissiveIntensity: 1.0, segments: 10 });
    const negQ = new Dots(NQ, { r: 0.065, color: COLOR.electron, emissive: COLOR.electron, emissiveIntensity: 1.3, segments: 10 });
    capG.add(posQ.mesh, negQ.mesh);
    const qSeeds = Array.from({ length: NQ }, () => [(Math.random() - 0.5) * 0.92, (Math.random() - 0.5) * 0.92]);

    // 电场线（4×4）+ 流动的小箭头
    const NL = 16;
    const lineGeo = new THREE.BufferGeometry();
    const linePos = new Float32Array(NL * 6);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: COLOR.efield, transparent: true, opacity: 0 });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    lines.frustumCulled = false;
    capG.add(lines);
    const coneGeo = new THREE.ConeGeometry(0.06, 0.18, 10);
    coneGeo.rotateZ(-Math.PI / 2);
    const cones = new THREE.InstancedMesh(coneGeo, new THREE.MeshBasicMaterial({ color: COLOR.efield, transparent: true, opacity: 0.9 }), NL);
    cones.frustumCulled = false;
    capG.add(cones);
    const lineYZ = [];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) lineYZ.push([(a - 1.5) / 4, (b - 1.5) / 4, Math.random()]);

    // 电介质板 + 极化电荷层
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.2, roughness: 0.2, depthWrite: false }));
    const polGeo = new THREE.BoxGeometry(1, 1, 1);
    const polNeg = new THREE.Mesh(polGeo, new THREE.MeshBasicMaterial({ color: COLOR.electron, transparent: true, opacity: 0, depthWrite: false }));
    const polPos = new THREE.Mesh(polGeo, new THREE.MeshBasicMaterial({ color: COLOR.proton, transparent: true, opacity: 0, depthWrite: false }));
    capG.add(slab, polNeg, polPos);

    // 随布局变化的导线与电子流
    const dyn = new THREE.Group();
    scene.add(dyn);
    let fChg1 = null, fChg2 = null, fDis = null;

    /* ---------- 标签 ---------- */
    const lbP = ctx.label('+Q', { cls: 'red' });
    const lbN = ctx.label('−Q', { cls: 'blue' });
    const lbE = ctx.label('电场 E', { cls: 'small yellow' });
    const lbBat = ctx.label(`电源 U = ${U0} V`, { cls: 'yellow' });
    lbBat.position.set(BAT_X - 1.35, 0, 0);
    const lbR = ctx.label('', { cls: 'small orange' });
    lbR.position.set(RES_X, TOPY + 0.55, 0);
    const lbSw = ctx.label('', { cls: 'small dim' });
    lbSw.position.set(PIV.x - 0.3, BOTY - 0.45, 0);
    const lbDi = ctx.label('', { cls: 'small cyan' });
    scene.add(lbBat, lbR, lbSw);
    capG.add(lbP, lbN, lbE, lbDi);

    /* ---------- 状态 ---------- */
    let mode = 'chg';
    let S = 200; // cm²
    let dmm = 2; // mm
    let er = 1;
    let RM = 20; // MΩ
    let u = 0; // 电容电压
    let C = cap();
    const geo = { side: 2, gap: 1, xL: 2, xR: 3 };

    function cap() { return (er * EPS0 * S * 1e-4) / (dmm * 1e-3); }

    function layout() {
      const side = 1.5 * Math.sqrt(S / 100);
      const gap = 0.5 + 0.3 * dmm;
      const xL = -gap / 2, xR = gap / 2;
      Object.assign(geo, { side, gap, xL, xR });
      plateL.scale.set(PLATE_T, side, side);
      plateL.position.set(xL, 0, 0);
      plateR.scale.set(PLATE_T, side, side);
      plateR.position.set(xR, 0, 0);
      for (let k = 0; k < NL; k++) {
        const [a, b] = lineYZ[k];
        linePos.set([xL + PLATE_T / 2, a * side, b * side, xR - PLATE_T / 2, a * side, b * side], k * 6);
      }
      lineGeo.attributes.position.needsUpdate = true;
      slab.scale.set(gap * 0.72, side * 0.94, side * 0.94);
      slab.position.set(0, 0, 0);
      polNeg.scale.set(0.02, side * 0.9, side * 0.9);
      polNeg.position.set(-gap * 0.36 - 0.012, 0, 0);
      polPos.scale.set(0.02, side * 0.9, side * 0.9);
      polPos.position.set(gap * 0.36 + 0.012, 0, 0);
      lbP.position.set(xL - 0.25, side / 2 + 0.35, 0);
      lbN.position.set(xR + 0.25, -side / 2 - 0.35, 0);
      lbE.position.set(0, side / 2 + 0.75, 0);
      lbDi.position.set(0, -side / 2 - 0.4, 0);

      // 重建导线和电子流
      disposeTree(dyn);
      dyn.clear();
      // 极板接线点（世界坐标）
      const wL = toWorld(xL, side / 2), wR = toWorld(xR, -side / 2);
      const wL2 = toWorld(xL, side / 2 - 0.08), wR2 = toWorld(xR, -side / 2 + 0.08);
      const topL = [V(wL.x, TOPY, 0), V(wL.x, TOPY, wL.z)];
      const botR = [V(wR.x, BOTY, wR.z), V(wR.x, BOTY, 0)];
      addWire(dyn, [V(RES_X + 0.7, TOPY), ...topL, wL]);
      addWire(dyn, [wR, ...botR, PIV]);
      const mk = (pts) => {
        const c = pathOf(pts, 0.25);
        const f = new Flow(c, { count: Math.max(10, Math.round(c.getLength() * 3)), color: COLOR.electron, r: 0.06, speed: 0, jitter: 0.01 });
        dyn.add(f.object);
        return f;
      };
      // 曲线均按“约定电流”方向定义，电子速度取相反号
      fChg1 = mk([batTop, V(BAT_X, TOPY), ...topL, wL2]);
      fChg2 = mk([wR2, ...botR, PIV, PA, V(BAT_X, BOTY), batBot]);
      fDis = mk([wL2, ...[...topL].reverse(), V(J_X, TOPY), PB, PIV, ...[...botR].reverse(), wR2]);
      setMode();
    }

    function setMode() {
      fChg1.object.visible = fChg2.object.visible = mode === 'chg';
      fDis.object.visible = mode === 'dis';
      lbSw.element.textContent = mode === 'chg' ? '开关拨向电源：充电' : '开关拨向旁路：放电';
    }

    /** 参数改变时：电容器上的电荷 Q 瞬间不变，电压 u = Q / C 随之改变 */
    function changeC() {
      const Cn = cap();
      u = (u * C) / Cn;
      C = Cn;
      refresh();
    }

    /* ---------- 面板 ---------- */
    ui.segmented({
      label: '开关位置',
      options: [{ value: 'chg', label: '充电' }, { value: 'dis', label: '放电' }],
      value: mode,
      onChange: (v) => { mode = v; setMode(); },
    });
    ui.slider({ label: '极板面积 S', min: 100, max: 400, step: 10, value: S, unit: 'cm²', digits: 0, onInput: (v) => { S = v; layout(); changeC(); } });
    ui.slider({ label: '极板间距 d', min: 1, max: 5, step: 0.1, value: dmm, unit: 'mm', digits: 1, onInput: (v) => { dmm = v; layout(); changeC(); } });
    ui.slider({ label: '电介质 εr（1 = 空气）', min: 1, max: 10, step: 0.1, value: er, digits: 1, onInput: (v) => { er = v; changeC(); } });
    ui.slider({ label: '电阻 R', min: 1, max: 100, step: 1, value: RM, unit: 'MΩ', digits: 0, onInput: (v) => { RM = v; refresh(); } });
    ui.button({ label: '把电容器的电荷清零', onClick: () => { u = 0; } });
    const note = ui.note('');
    const read = ui.readouts([
      { key: 'C', label: '电容 C', unit: 'F' },
      { key: 'tau', label: '时间常数 τ = RC', unit: 's' },
      { key: 'Q', label: '电荷量 Q', unit: 'C' },
      { key: 'u', label: '电容电压 u', unit: 'V', digits: 2 },
      { key: 'i', label: '电流 i', unit: 'A' },
      { key: 'W', label: '储能 ½Cu²', unit: 'J' },
    ]);
    ui.legend([
      { color: CSSCOLOR.proton, label: '正电荷（缺电子）' },
      { color: CSSCOLOR.electron, label: '电子' },
      { color: CSSCOLOR.efield, label: '电场线' },
    ]);
    const scU = ui.scope({ title: '电容电压 u（V）', height: 90, yMin: 0, yMax: U0 * 1.1, window: 250, series: [{ label: 'u', color: '#64d2ff' }, { label: '电源 U', color: 'rgba(255,255,255,.3)' }] });
    const scI = ui.scope({ title: '电流 i（以 I₀ = U/R 为 1，放电为负）', height: 90, yMin: -1.1, yMax: 1.1, window: 250, series: [{ label: 'i / I₀', color: '#ff9f0a' }] });

    let tauReal = 0, tauSim = 1;
    function refresh() {
      tauReal = RM * 1e6 * C;
      tauSim = 0.35 * Math.pow(tauReal / TAU_MIN, 0.3);
      setSI(read, 'C', C, 'F');
      setSI(read, 'tau', tauReal, 's');
      lbR.element.textContent = `电阻 R = ${RM} MΩ`;
      slab.visible = er > 1.05;
      lbDi.element.textContent = er > 1.05 ? `电介质 εr = ${er.toFixed(1)}` : '';
      lbDi.visible = er > 1.05;
    }

    layout();
    refresh();

    let acc = 0, noteKey = '';
    const m4 = new THREE.Matrix4();
    return {
      update(dt, t) {
        // RC 电路（时间经过放慢 + 压缩）
        if (dt > 0) {
          const k = 1 - Math.exp(-dt / tauSim);
          if (mode === 'chg') u += (U0 - u) * k;
          else u -= u * k;
        }
        const R = RM * 1e6;
        const i = mode === 'chg' ? (U0 - u) / R : -u / R;
        const I0 = U0 / R;
        const Q = C * u;
        const fr = clamp(i / I0, -1.5, 1.5);
        if (mode === 'chg') { fChg1.speed = fChg2.speed = -2.6 * fr; fChg1.update(dt); fChg2.update(dt); }
        else { fDis.speed = 2.6 * fr; fDis.update(dt); }
        lever.rotation.z = damp(lever.rotation.z, mode === 'chg' ? ANG_CHG : ANG_DIS, 10, dt);

        // 极板电荷
        const { side, xL, xR, gap } = geo;
        const n = Math.min(NQ, Math.round(40 * Math.sqrt(Math.max(Q, 0) / 0.5e-9)));
        for (let k = 0; k < NQ; k++) {
          if (k >= n) { posQ.hide(k); negQ.hide(k); continue; }
          const [a, b] = qSeeds[k];
          posQ.setAt(k, xL + PLATE_T / 2 + 0.06, a * side, b * side);
          negQ.setAt(k, xR - PLATE_T / 2 - 0.06, b * side, a * side);
        }
        posQ.commit(); negQ.commit();

        // 电场：E = u/d（与有无电介质无关——电压固定时）
        const E = u / (dmm * 1e-3);
        const f = Math.sqrt(clamp(E / 6000, 0, 1.6));
        lineMat.opacity = Math.min(0.9, 0.85 * f);
        for (let k = 0; k < NL; k++) {
          const [a, b, ph] = lineYZ[k];
          const s = (ph + t * 0.35) % 1;
          m4.makeScale(f, f, f);
          m4.setPosition(xL + PLATE_T / 2 + 0.1 + s * (gap - PLATE_T - 0.2), a * side, b * side);
          cones.setMatrixAt(k, m4);
        }
        cones.instanceMatrix.needsUpdate = true;
        const pol = er > 1.05 ? 0.6 * (1 - 1 / er) * clamp(u / U0, 0, 1.5) : 0;
        polNeg.material.opacity = pol;
        polPos.material.opacity = pol;

        // 读数与示波器
        setSI(read, 'Q', Q, 'C');
        read.set('u', u);
        setSI(read, 'i', i, 'A');
        setSI(read, 'W', 0.5 * C * u * u, 'J');
        acc += dt;
        if (acc >= 0.04) { acc = 0; scU.push([u, U0]); scI.push([fr]); }

        const stage = mode === 'chg' ? (u > U0 * 1.01 ? 'over' : u > U0 * 0.99 ? 'full' : 'chg') : (u < 0.02 ? 'empty' : 'dis');
        const key = stage + '|' + fmtSI(tauReal, 's', 2);
        if (key !== noteKey) {
          noteKey = key;
          const tt = `（真实 τ = ${fmtSI(tauReal, 's')}，画面中约 ${tauSim.toFixed(1)} s）`;
          note.set({
            chg: `<b>充电中</b>：电子从左极板经电阻被“抽”向电源正极，同时电源负极把电子压到右极板。电荷越多，电流越小。${tt}`,
            full: `<b>已充满</b>：电容电压 = 电源电压 ${U0} V，电阻两端没有电压，<b>电流为零</b>。电荷和电场能就这样“存”在电容器里。`,
            over: '<b>电容电压高于电源</b>：刚才减小了电容（拉开极板、减小面积或抽出电介质），电荷来不及改变，电压 u = Q/C 升高了，于是电荷反过来流回电源。',
            dis: `<b>放电中</b>：电源被断开，右极板多余的电子经旁路和电阻流回左极板，电流方向与充电时相反，电压和电流都按指数规律衰减。${tt}`,
            empty: '<b>放电完毕</b>：两板电荷中和，电场消失，储存的电能已在电阻上变成了热。',
          }[stage]);
        }
      },
    };
  },
};
