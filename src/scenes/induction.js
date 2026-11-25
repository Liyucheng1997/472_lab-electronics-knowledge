import * as THREE from 'three';
import { COLOR, CSSCOLOR, barMagnet, coil, meter, Flow, ArrowFlow, Arrow, stageFloor, V, clamp } from '../lib/kit.js';
import { LineFlow, barMagnetField, magnetLoopFlux, magnetLoopFluxDeriv, clearGroup } from '../lib/magnet-kit.js';

const U = 0.02; // 画面 1 个单位 = 2 cm
const MAG_LEN = 3, MAG_SIZE = 0.6; // 磁铁 6 cm 长、1.2 cm 见方
const COIL_R = 1.2, COIL_L = 2.4; // 线圈半径 2.4 cm，长 4.8 cm
const AMP = 2.1, D0 = -2.1; // 相对位置 d = 磁铁中心 − 线圈中心，在 [−4.2, 0] 之间往返
const K = 24; // 计算磁通时线圈沿轴的采样数
const IMAX = 3; // 电流计满偏（mA）

/** 一根可以每帧变形的“软导线”：用一串实例化的小圆柱拼成，不重建几何体 */
class Rope {
  constructor(n, { radius = 0.035, color = COLOR.copper } = {}) {
    this.n = n;
    this.mesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(radius, radius, 1, 8),
      new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.35 }),
      n
    );
    this.mesh.frustumCulled = false;
    this.pts = Array.from({ length: n + 1 }, () => new THREE.Vector3());
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._c = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
  }
  /** 从 a 到 b 的下垂曲线：sag 向下垂、bulge 向 +z 鼓出 */
  set(a, b, sag = 0.4, bulge = 0.3) {
    const { n, pts } = this;
    for (let i = 0; i <= n; i++) {
      const t = i / n, k = 4 * t * (1 - t);
      pts[i].lerpVectors(a, b, t);
      pts[i].y -= sag * k;
      pts[i].z += bulge * k;
    }
    for (let i = 0; i < n; i++) {
      this._d.subVectors(pts[i + 1], pts[i]);
      const len = this._d.length();
      if (len < 1e-6) this._d.set(0, 1, 0); else this._d.divideScalar(len);
      this._c.addVectors(pts[i], pts[i + 1]).multiplyScalar(0.5);
      this._q.setFromUnitVectors(this._up, this._d);
      this._s.set(1, len * 1.04 + 0.01, 1);
      this._m.compose(this._c, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export default {
  id: 'induction',
  group: 'magnet',
  title: '电磁感应',
  subtitle: '磁生电',
  summary: '穿过线圈的磁通量一发生变化，线圈里就产生电流——发电机、无线充电都靠它。',
  lead: '1831 年法拉第发现：只要穿过闭合线圈的<b>磁通量发生变化</b>，线圈中就会产生感应电流。画面中磁铁在线圈里进进出出，电流计的指针左右摆动；切到「磁铁静止」，哪怕磁铁插在线圈里，只要不动，电流就是零。',
  formulas: [
    { expr: '<i>Φ</i> = <i>BS</i>', desc: '磁通量（韦伯 Wb = T·m²）：磁感应强度 <i>B</i> 与垂直穿过的面积 <i>S</i> 的乘积，可以理解为穿过线圈的磁感线“条数”。' },
    { expr: '<i>ε</i> = −<i>N</i> <span class="frac"><span>Δ<i>Φ</i></span><span>Δ<i>t</i></span></span>', desc: '法拉第电磁感应定律：感应电动势（V）等于线圈匝数 <i>N</i> 乘以磁通量的变化率（Wb/s）。负号表示感应电流的磁场总是阻碍磁通量的变化（楞次定律）。' },
    { expr: '<i>I</i> = <span class="frac"><span><i>ε</i></span><span><i>R</i></span></span>', desc: '闭合回路中的感应电流（A），<i>R</i> 为线圈与电流计的总电阻（Ω）。' },
  ],
  sections: [
    {
      title: '法拉第的发现',
      html: `<p>奥斯特发现“电能生磁”之后，很多科学家反过来想：<b>磁能不能生电？</b>他们把磁铁放在线圈旁边、放进线圈里，却怎么也测不到电流。</p>
      <p>英国科学家<b>法拉第</b>坚持实验了将近十年，终于在 1831 年发现了关键：<b>磁铁静止时没有电流，只有在磁铁插入或拔出的那一刻，电流计的指针才会动</b>。产生电流的不是磁场本身，而是磁场的<b>变化</b>。</p>
      <p>这种现象叫<b>电磁感应</b>，产生的电流叫<b>感应电流</b>。它直接催生了发电机和变压器，让人类进入了电气时代。</p>`,
    },
    {
      title: '磁通量：穿过线圈的磁感线“条数”',
      html: `<p>为了描述“有多少磁场穿过线圈”，物理学家定义了<b>磁通量</b> <i>Φ</i> = <i>BS</i>：磁场越强、线圈面积越大，磁通量越大。单位是<b>韦伯（Wb）</b>，1 Wb = 1 T·m²。</p>
      <p>画面中绿色的线是磁铁的磁感线：磁铁离线圈越近，穿过线圈的磁感线越多；磁铁在线圈正中间时最多。看示波器里的绿色曲线 <i>Φ</i>，它随着磁铁的进出一起一伏。</p>
      <p>磁通量变化的方式有很多：磁铁靠近或远离、线圈移动或转动、线圈面积改变、电磁铁的电流变化……只要穿过线圈的磁通量变了，就会产生感应电动势。</p>`,
    },
    {
      title: '法拉第电磁感应定律',
      html: `<p>感应电动势的大小与<b>磁通量变化的快慢</b>成正比，还与线圈匝数 <i>N</i> 成正比：</p>
      <div class="eq"><i>ε</i> = −<i>N</i> Δ<i>Φ</i> / Δ<i>t</i></div>
      <p>动手验证：</p>
      <ul><li>加快「往返快慢」：同样的磁通量变化在更短时间内完成，电动势更大</li>
      <li>增加「线圈匝数」：每一匝都产生电动势，串联起来就更大</li>
      <li>增强「磁铁强弱」：磁通量变化的幅度更大</li></ul>
      <p>对比示波器的两条曲线：橙色的 <i>ε</i> 正比于绿色 <i>Φ</i> 曲线的<b>斜率</b>（再取负号）。<i>Φ</i> 达到最大或最小的瞬间（曲线顶部、底部是平的），<i>ε</i> 恰好为零——这时磁铁正在掉头，速度为零。</p>`,
    },
    {
      title: '楞次定律：感应电流总在“唱反调”',
      html: `<p>感应电流的方向由<b>楞次定律</b>决定：<b>感应电流的磁场总是阻碍引起它的磁通量的变化</b>。</p>
      <ul><li>磁铁 N 极<b>插入</b>线圈：向右的磁通量增加，感应电流在线圈左端形成 <b>N 极</b>，“推开”靠近的磁铁；</li>
      <li>磁铁 N 极<b>拔出</b>：磁通量减少，线圈左端变成 <b>S 极</b>，“拉住”离开的磁铁。</li></ul>
      <p>画面中线圈两端会显示感应出的 N、S 极，线圈里浅绿色的箭头是感应电流产生的磁场方向，电流计指针也随之左右摆动。</p>
      <div class="tip">楞次定律其实是<b>能量守恒</b>的体现：你推磁铁时总要克服一个阻力，你做的功变成了电能。假如感应电流反过来帮磁铁加速，就能凭空产生能量——这是不可能的。一个有趣的演示：强磁铁在铜管里下落会变得非常缓慢，就是因为铜管中的感应电流在“拖”住它。</div>`,
    },
    {
      title: '身边的电磁感应',
      html: `<ul><li><b>发电机</b>：让线圈在磁场中不停转动，磁通量周期性变化，源源不断地发电（下一章）</li>
      <li><b>电磁炉</b>：线圈中通入每秒几万次变化的电流，交变磁场在铁锅底部感应出涡流，锅底自己发热</li>
      <li><b>无线充电</b>：充电板里的线圈产生变化的磁场，手机里的线圈感应出电流给电池充电</li>
      <li><b>公交卡、门禁卡</b>：卡里没有电池，只有一圈天线线圈和芯片；靠近读卡器时，读卡器的交变磁场在线圈里感应出电流，芯片瞬间“被唤醒”完成通信</li>
      <li><b>变压器、电吉他拾音器、金属探测器、动圈话筒</b>……都是电磁感应的应用</li></ul>`,
    },
    {
      title: '常见误区',
      html: `<div class="warn"><b>误区：有磁场就会有感应电流。</b>切换到「磁铁静止」：磁铁插在线圈正中间，穿过线圈的磁通量很大，但电流计读数为零。只有磁通量<b>变化</b>时才有感应电流。</div>
      <p><b>运动是相对的</b>：「磁铁运动」和「线圈运动」两种情况，只要两者的相对运动相同，感应电流就完全一样。爱因斯坦 1905 年发表狭义相对论的论文，开头讨论的正是这个现象。</p>
      <p>另外，画面中的电流计是“零点在中央”的灵敏电流计，可以显示电流的方向；感应电流通常只有毫安级，所以需要很灵敏的电表才看得到。</p>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.view([0, 2.4, 12], [0, -0.7, 0], 6.8);
    ctx.setBloom(0.6, 0.45, 0.8);
    scene.add(stageFloor({ y: -4.2 }));

    const st = { mode: 'magnet', N: 20, f: 0.6, Br: 1.2 };
    const addLabel = (parent, text, cls, x, y, z) => {
      const l = ctx.label(text, { cls });
      l.position.set(x, y, z);
      parent.add(l);
      return l;
    };

    /* ---------- 磁铁（含磁感线，随磁铁移动） ---------- */
    const magG = new THREE.Group();
    scene.add(magG);
    magG.add(barMagnet({ length: MAG_LEN, size: MAG_SIZE }));
    const bm = barMagnetField({ length: MAG_LEN, size: MAG_SIZE, bound: 7.5 });
    const mLines = new LineFlow(bm.lines, { opacity: 0.42, spacing: 0.9, arrowSize: 0.17, speed: 0 });
    magG.add(mLines.object);
    addLabel(magG, '条形磁铁', 'small', 0, 0.75, 0);
    const LP = (bm.xN - bm.xS) * U; // 等效磁极间距（m）

    /* ---------- 线圈 ---------- */
    const coilG = new THREE.Group();
    scene.add(coilG);
    const former = new THREE.Mesh(
      new THREE.CylinderGeometry(COIL_R - 0.06, COIL_R - 0.06, COIL_L + 0.3, 40, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xcfd6e6, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })
    );
    former.rotation.z = Math.PI / 2;
    coilG.add(former);
    const windG = new THREE.Group();
    coilG.add(windG);
    let cArrows = null, cElectrons = null;
    function buildCoil() {
      clearGroup(windG);
      const pitch = COIL_L / st.N;
      const c = coil({ radius: COIL_R, turns: st.N, length: COIL_L, wire: Math.min(0.055, pitch * 0.38), leads: 0.9 });
      windG.add(c.mesh);
      // kit 线圈：电流顺着曲线方向时，管内磁场沿 −x。约定 I>0 表示感应磁场沿 +x，所以箭头速度取 −I
      cArrows = new ArrowFlow(c.curve, { count: Math.min(80, 10 + st.N * 2), size: 0.2, speed: 0 });
      cElectrons = new Flow(c.curve, { count: Math.min(160, 20 + st.N * 4), r: 0.05, speed: 0 });
      windG.add(cArrows.object, cElectrons.object);
      lbCoil.element.textContent = `线圈（${st.N} 匝）`;
    }
    const lbCoil = addLabel(coilG, '线圈', 'orange small', 0, -1.75, 1.4);
    const lbIN = addLabel(coilG, 'N', 'red big', 0, 0, 0);
    const lbIS = addLabel(coilG, 'S', 'blue big', 0, 0, 0);
    const indArrow = new Arrow(0xa8ffd8, { radius: 0.035, headLength: 0.24, headRadius: 0.09, emissive: 0.7 });
    coilG.add(indArrow);
    const lbInd = addLabel(coilG, '感应电流的磁场', 'green small', 0, 1.05, 0);
    buildCoil();

    /* ---------- 电流计与软导线 ---------- */
    const G = meter({ symbol: 'G', max: IMAX, zeroCenter: true, size: 1.2, unit: 'mA' });
    G.position.set(0, -3.3, 1.0);
    scene.add(G);
    addLabel(scene, '灵敏电流计 G（零点在中央）', 'small dim', 0, -4.05, 1.6);
    const postL = G.userData.left.clone().add(G.position);
    const postR = G.userData.right.clone().add(G.position);
    const ropeL = new Rope(18), ropeR = new Rope(18);
    scene.add(ropeL.mesh, ropeR.mesh);

    /* ---------- 速度箭头 ---------- */
    const velArrow = new Arrow(0xf2f2f7, { radius: 0.03, headLength: 0.22, headRadius: 0.08, emissive: 0.3 });
    scene.add(velArrow);
    const lbV = addLabel(scene, '运动方向', 'small dim', 0, 0, 0);

    /* ---------- 面板 ---------- */
    ui.segmented({
      label: '谁在动',
      options: [{ value: 'magnet', label: '磁铁运动' }, { value: 'coil', label: '线圈运动' }, { value: 'static', label: '磁铁静止' }],
      value: st.mode,
      onChange: (v) => setMode(v),
    });
    ui.slider({ label: '往返快慢', min: 0.1, max: 1.5, step: 0.05, value: st.f, unit: '次/秒', digits: 2, onInput: (v) => { st.f = v; } });
    ui.slider({ label: '线圈匝数 N', min: 5, max: 40, step: 5, value: st.N, unit: '匝', digits: 0, onInput: (v) => { if (v !== st.N) { st.N = v; buildCoil(); } } });
    ui.slider({ label: '磁铁强弱（剩磁 Br）', min: 0.2, max: 1.4, step: 0.1, value: st.Br, unit: 'T', digits: 1, onInput: (v) => { st.Br = v; mLines.setStrength(v / 1.4); } });
    const pushBtns = ui.buttons([
      { label: '插入磁铁', primary: true, onClick: () => { target = 0; } },
      { label: '拔出磁铁', onClick: () => { target = D0 - AMP; } },
    ]);
    const pushRow = pushBtns[0].parentElement;
    const note = ui.note('');
    const ro = ui.readouts([
      { key: 'phi', label: '磁通量 Φ（每匝）', unit: 'μWb', digits: 1 },
      { key: 'emf', label: '感应电动势 ε', unit: 'mV', digits: 2 },
      { key: 'i', label: '感应电流 I', unit: 'mA', digits: 2 },
      { key: 'v', label: '相对速度 v', unit: 'cm/s', digits: 1 },
    ]);
    const scope = ui.scope({
      title: '磁通量 Φ 与感应电动势 ε',
      height: 130, yMin: -1.2, yMax: 1.2, window: 300,
      series: [{ label: 'Φ', color: CSSCOLOR.bfield }, { label: 'ε', color: CSSCOLOR.current }],
    });
    ui.legend([
      { color: CSSCOLOR.bfield, label: '磁铁的磁感线' },
      { color: CSSCOLOR.current, label: '感应电流方向' },
      { color: CSSCOLOR.electron, label: '电子' },
      { color: '#a8ffd8', label: '感应电流的磁场' },
    ]);
    mLines.setStrength(st.Br / 1.4);

    /* ---------- 运动与物理 ---------- */
    let phase = 0; // 往返运动的相位
    let d = D0 - AMP; // 磁铁中心 − 线圈中心（画面单位）
    let target = 0; // 静止模式下按钮设定的目标位置
    let vRel = 0; // d 的变化率（单位/秒），= 磁铁速度 − 线圈速度
    let lastSign = 0;
    let lastNote = '';
    const setNote = (h) => { if (h !== lastNote) { lastNote = h; note.set(h); } };

    function setMode(m) {
      st.mode = m;
      setShownEl(pushRow, m === 'static');
      if (m === 'static') {
        target = Math.abs(d) < 1 ? 0 : D0 - AMP;
      } else {
        // 从当前位置平滑接上往返运动
        const s = clamp((d - D0) / AMP, -1, 1);
        phase = Math.asin(s);
      }
      lastNote = '';
    }
    function setShownEl(el, on) { if (el) el.style.display = on ? '' : 'none'; }

    /** 计算每匝平均磁通 Φ（Wb）与 dΦ/dd（Wb/m）。d 以米为单位 */
    function fluxAt(dm, phi0) {
      let phi = 0, dphi = 0;
      for (let k = 0; k < K; k++) {
        const xk = (-COIL_L / 2 + (COIL_L * (k + 0.5)) / K) * U; // 线圈内第 k 个采样位置（相对线圈中心）
        const u = xk - dm; // 相对磁铁中心
        phi += magnetLoopFlux(u, COIL_R * U, LP, phi0);
        dphi += magnetLoopFluxDeriv(u, COIL_R * U, LP, phi0);
      }
      return [phi / K, dphi / K];
    }

    const tmpA = V(), tmpB = V(), tmpV = V();
    setMode('magnet');

    return {
      update(dt) {
        const vmax = AMP * 2 * Math.PI * st.f; // 单位/秒
        if (st.mode === 'static') {
          const want = clamp((target - d) * 4, -vmax, vmax);
          vRel = Math.abs(target - d) < 1e-4 ? 0 : want;
          d += vRel * dt;
          if (dt === 0) vRel = 0;
        } else {
          phase += 2 * Math.PI * st.f * dt;
          d = D0 + AMP * Math.sin(phase);
          vRel = dt === 0 ? 0 : AMP * 2 * Math.PI * st.f * Math.cos(phase);
        }
        // 位置：磁铁运动 → 线圈固定在 0；线圈运动 → 磁铁固定在 −2.1
        let xm, xc;
        if (st.mode === 'coil') { xm = D0; xc = D0 - d; } else { xc = 0; xm = d; }
        magG.position.x = xm;
        coilG.position.x = xc;

        // 物理量
        const phi0 = st.Br * (MAG_SIZE * U) ** 2; // Wb（磁铁截面 × 剩磁）
        const [phi, dphiDd] = fluxAt(d * U, phi0);
        // Φ 随 d 变化：d 增大 = 磁铁相对线圈右移，u = x_k − d 减小，所以 dΦ/dt = −dphi/du · dd/dt
        const dPhiDt = -dphiDd * (vRel * U);
        const emf = -st.N * dPhiDt; // V
        const Rtot = 2 + 0.1 * st.N; // Ω
        const I = (emf / Rtot) * 1000; // mA
        G.userData.setValue(I);
        G.userData.update(dt);

        // 线圈中的电流与电子（I>0：感应磁场沿 +x）
        const k = Math.min(1, Math.abs(I) / IMAX);
        const sp = Math.abs(I) < 0.02 ? 0 : Math.sign(I) * (0.4 + 2.2 * k);
        cArrows.speed = -sp;
        cElectrons.speed = sp;
        cArrows.object.visible = sp !== 0;
        cArrows.update(dt);
        cElectrons.update(dt);

        // 楞次定律：线圈两端感应出的磁极
        const s = Math.abs(I) < 0.05 ? 0 : Math.sign(I);
        if (s !== lastSign) {
          lastSign = s;
          lbIN.position.set(s >= 0 ? COIL_L / 2 + 0.55 : -COIL_L / 2 - 0.55, 1.55, 0);
          lbIS.position.set(s >= 0 ? -COIL_L / 2 - 0.55 : COIL_L / 2 + 0.55, 1.55, 0);
        }
        lbIN.visible = lbIS.visible = s !== 0;
        const op = (0.35 + 0.65 * k).toFixed(2);
        if (lbIN.element.style.opacity !== op) { lbIN.element.style.opacity = op; lbIS.element.style.opacity = op; }
        if (s !== 0) {
          tmpA.set(-s * 1.1 * Math.max(0.25, k), 0.72, 0);
          tmpB.set(s * 2.2 * Math.max(0.25, k), 0, 0);
          indArrow.set(tmpA, tmpB);
        } else indArrow.visible = false;
        lbInd.visible = s !== 0;

        // 运动方向箭头（画在运动的物体上方）
        const vObj = st.mode === 'coil' ? -vRel : vRel;
        const ox = st.mode === 'coil' ? xc : xm;
        const vy = st.mode === 'coil' ? COIL_R + 0.75 : 0.95 + 0.4;
        if (Math.abs(vObj) > 0.02) {
          tmpV.set(Math.sign(vObj) * (0.4 + 1.0 * Math.min(1, Math.abs(vObj) / 6)), 0, 0);
          velArrow.set(tmpA.set(ox - tmpV.x / 2, vy, 0), tmpV);
          lbV.position.set(ox, vy + 0.4, 0);
          lbV.visible = true;
        } else { velArrow.visible = false; lbV.visible = false; }

        // 软导线：线圈两根引线末端 → 电流计接线柱
        tmpA.set(xc - COIL_L / 2, -COIL_R - 0.9, 0);
        ropeL.set(tmpA, postL, 0.35, 0.35);
        tmpB.set(xc + COIL_L / 2, -COIL_R - 0.9, 0);
        ropeR.set(tmpB, postR, 0.35, 0.35);

        // 读数与示波器
        ro.set('phi', phi * 1e6);
        ro.set('emf', emf * 1000);
        ro.set('i', I);
        ro.set('v', Math.abs(vRel) * U * 100);
        if (dt > 0) scope.push([clamp(phi / 1.5e-4, -1.2, 1.2), clamp(emf / 0.012, -1.2, 1.2)]);

        const moving = Math.abs(vRel) > 0.05;
        const inside = Math.abs(d) < 1.2;
        setNote(st.mode === 'static' && !moving
          ? (inside
            ? '<b>磁铁插在线圈里静止不动</b>：穿过线圈的磁通量很大，但<b>没有变化</b>，所以没有感应电流，电流计指零。点「插入/拔出磁铁」再看看。'
            : '磁铁静止在线圈外，磁通量不变，没有感应电流。点「插入磁铁」。')
          : !moving
            ? '磁铁正在掉头：这一瞬间相对速度为零，磁通量不变化，感应电流为零。'
            : (dPhiDt > 0
              ? '向右的<b>磁通量在增加</b>，感应电流产生<b>向左</b>的磁场来阻碍它：线圈左端成为 <b>N 极</b>，排斥靠近的磁铁。'
              : '向右的<b>磁通量在减少</b>，感应电流产生<b>向右</b>的磁场来“补充”它：线圈左端成为 <b>S 极</b>，吸引离开的磁铁。'));
      },
    };
  },
};
