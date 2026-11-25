import * as THREE from 'three';
import { COLOR, CSSCOLOR, wire, Flow, ArrowFlow, battery, switchPart, compass, coil, stageFloor, roundedPath, Arrow, V } from '../lib/kit.js';
import { MU0, LineFlow, pathSegments, biotSavart, traceLine, revolveLines, circlePoints, lastPanelEl, setShown } from '../lib/magnet-kit.js';

const EARTH = 35; // 我国大部分地区地磁场水平分量约 30~40 μT，这里取 35 μT
const CM = 0.01; // 画面 1 个单位 = 1 cm

/** 简化的右手：拇指沿 +y，四指绕 y 轴弯曲（从 +x 转向 −z，即沿 +y 方向电流产生的磁场方向） */
function rightHand() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xf0c6a2, roughness: 0.6, metalness: 0 });
  const R = 0.4;
  for (let i = 0; i < 4; i++) {
    const tube = 0.085 - i * 0.007;
    const arc = Math.PI * (1.5 - i * 0.04);
    const f = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 10, 36, arc), skin);
    f.rotation.x = -Math.PI / 2; // 圆环上的点 (R cosφ, 0, −R sinφ)
    const y = 0.26 - i * 0.175;
    f.position.y = y;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(tube, 12, 8), skin);
    tip.position.set(R * Math.cos(arc), y, -R * Math.sin(arc));
    g.add(f, tip);
  }
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.82, 0.62), skin);
  palm.position.set(R + 0.06, -0.01, 0.3);
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.5, 4, 10), skin);
  thumb.position.set(R * 0.72, 0.72, 0.2);
  thumb.rotation.z = 0.12;
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.7, 16), skin);
  wrist.rotation.x = Math.PI / 2;
  wrist.position.set(R + 0.1, -0.05, 0.85);
  g.add(palm, thumb, wrist);
  return g;
}

function setLbl(l, text, cls) {
  if (l.element.textContent !== text) l.element.textContent = text;
  if (cls != null) l.element.className = 'l3d ' + cls;
}

export default {
  id: 'magnetism',
  group: 'magnet',
  title: '电流的磁场',
  subtitle: '电生磁',
  summary: '1820 年奥斯特发现：通电导线周围存在磁场。电和磁从此被联系在一起。',
  lead: '电流会在自己周围产生磁场——这是电与磁关系的第一块拼图。画面中<b>绿色的线</b>是磁感线，小箭头指磁场方向；小磁针红色的 N 极总是顺着磁场方向。切换直导线、环形电流、螺线管和奥斯特实验，拖动电流滑块（负值表示反向）看磁场怎样变化。',
  formulas: [
    { expr: '<i>B</i> = <span class="frac"><span><i>μ</i><sub>0</sub><i>I</i></span><span>2π<i>r</i></span></span>', desc: '长直导线周围的磁感应强度。<i>B</i>：特斯拉 T；<i>I</i>：电流 A；<i>r</i>：到导线的距离 m；<i>μ</i><sub>0</sub> = 4π × 10<sup>−7</sup> T·m/A（真空磁导率）。' },
    { expr: '<i>B</i> = <span class="frac"><span><i>μ</i><sub>0</sub><i>I</i></span><span>2<i>R</i></span></span>', desc: '单匝圆形线圈（环形电流）圆心处的磁场，<i>R</i> 为线圈半径（m）。' },
    { expr: '<i>B</i> = <i>μ</i><sub>0</sub><i>nI</i>', desc: '长螺线管内部的匀强磁场，<i>n</i> 为每米长度上的匝数（匝/m）。插入铁芯后还要再乘上铁芯的相对磁导率，可增强成百上千倍。' },
  ],
  sections: [
    {
      title: '奥斯特的发现：电能生磁',
      html: `<p>1820 年，丹麦物理学家<b>奥斯特</b>在一次讲课时注意到：导线一通电，旁边的小磁针就转了一个角度；断电后，磁针又转回南北方向。这是人类第一次发现<b>电流能产生磁场</b>。</p>
      <p>切换到「奥斯特实验」，打开「接通电流」闭合开关，看导线下方的小磁针怎样偏转；再把电流调成负值（反向），磁针会朝另一边偏。</p>
      <div class="tip">实验时导线要<b>沿南北方向</b>放在磁针正上方：这样导线的磁场是东西方向的，和地磁场垂直，偏转最明显。如果导线沿东西方向放，磁针可能根本不动。</div>
      <p>消息传开后仅几个月，安培、毕奥、萨伐尔等人就弄清了电流磁场的方向和大小规律，电磁学从此飞速发展。</p>`,
    },
    {
      title: '直导线的磁场与右手螺旋定则',
      html: `<p>通电直导线周围的磁感线是一圈圈<b>以导线为圆心的同心圆</b>，它们所在的平面与导线垂直。</p>
      <p><b>右手螺旋定则（安培定则）</b>：用右手握住导线，让伸直的<b>拇指指向电流方向</b>，那么弯曲的<b>四指所指的方向就是磁感线的环绕方向</b>。画面里那只手就是这样握着导线的，电流反向时它会翻转过来。</p>
      <p>磁场的大小 <i>B</i> = <i>μ</i><sub>0</sub><i>I</i>/(2π<i>r</i>)：电流越大越强，离导线越远越弱（与距离成反比）。例如 10 A 的电流，在 1 cm 处产生约 200 μT 的磁场，大约是地磁场的 5 倍。</p>
      <p>看木板上的两圈小磁针：内圈离导线近，磁场强，几乎完全沿圆周排列；外圈离得远，导线的磁场弱，更容易被地磁场“拉”向北方。关掉「考虑地磁场」再对比一下。</p>`,
    },
    {
      title: '从线圈到螺线管：电磁铁',
      html: `<p>把导线弯成一个圆环，环内各段导线产生的磁场方向相同、互相加强，环形电流的磁场就像一块<b>又短又扁的磁铁</b>：一面是 N 极，另一面是 S 极。</p>
      <p>把许多圆环紧密地排在一起就是<b>螺线管</b>。每一匝的磁场叠加起来，管内的磁场又强又均匀（<i>B</i> = <i>μ</i><sub>0</sub><i>nI</i>），管外的磁场分布和<b>条形磁铁</b>几乎一模一样。</p>
      <p>判断螺线管的极性同样用右手：<b>四指弯向电流方向，拇指所指的一端就是 N 极</b>。</p>
      <p>在螺线管里插入铁芯，铁芯被磁化后磁场会增强几百到上千倍，这就是<b>电磁铁</b>。它的优点是：磁性有无可以用通断电控制，强弱可以用电流大小调节，极性可以用电流方向改变。</p>
      <ul><li><b>电磁起重机</b>：通电吸起几吨重的废钢，断电就放下</li>
      <li><b>电磁继电器</b>：用小电流控制大电流的开关，电铃、门禁电磁锁也是同样原理</li>
      <li><b>扬声器、电动机</b>：都离不开通电线圈的磁场</li>
      <li><b>核磁共振（MRI）</b>：用超导螺线管产生 1.5~3 T 的强磁场，是地磁场的数万倍</li></ul>`,
    },
    {
      title: '磁场有多强？',
      html: `<p>磁感应强度 <i>B</i> 的单位是<b>特斯拉（T）</b>。1 T 是很强的磁场，日常常用微特斯拉（μT，百万分之一特斯拉）和毫特斯拉（mT）。</p>
      <table><tr><th>磁场来源</th><th>大约强度</th></tr>
      <tr><td>地磁场</td><td>25~65 μT</td></tr>
      <tr><td>10 A 电流在 1 cm 处</td><td>200 μT</td></tr>
      <tr><td>冰箱贴</td><td>约 5 mT</td></tr>
      <tr><td>钕铁硼强磁铁表面</td><td>0.5~1.2 T</td></tr>
      <tr><td>医院核磁共振</td><td>1.5~3 T</td></tr></table>
      <p>画面中螺线管长 5.6 cm、14 匝，相当于每米 250 匝；10 A 电流时管内约 3 mT。插入铁芯后（这里按等效相对磁导率 300 计算），可以达到接近 1 T。</p>`,
    },
    {
      title: '地球本身就是一块大磁铁',
      html: `<p>指南针之所以能指南北，是因为地球有磁场。科学家认为，地磁场来自地核：液态的铁镍在地球内部翻滚流动，形成巨大的环形<b>电流</b>——又是“电生磁”。这个机制叫“地球发电机”。</p>
      <p>有趣的是，指南针的 N 极指向地理北方，说明地理北极附近其实是地磁场的 <b>S 极</b>。而且地磁的两极和地理南北极并不重合，所以磁针所指的方向与正北之间有一个小夹角——<b>磁偏角</b>。北宋沈括在《梦溪笔谈》中就记载了“常微偏东，不全南也”，比西方早了约 400 年。</p>
      <p>地磁场还像一把保护伞，把来自太阳的高能带电粒子（太阳风）挡在外面；部分粒子沿磁感线落到两极附近的高空，就形成了绚丽的<b>极光</b>。</p>`,
    },
    {
      title: '常见误区',
      html: `<div class="warn"><b>误区一：磁感线是真实存在的线。</b>磁感线只是帮助我们描述磁场的“画法”：线上每一点的切线方向就是该点的磁场方向，线越密的地方磁场越强。磁场本身是连续分布在空间中的。</div>
      <div class="warn"><b>误区二：只有磁铁才有磁场。</b>任何运动的电荷都会产生磁场。永磁铁的磁性其实来自原子内部电子的运动和自旋——相当于无数微小的环形电流整齐排列（安培的“分子电流”假说）。所以说，<b>一切磁现象的根源都是电荷的运动</b>。</div>
      <p>另外，磁感线总是<b>闭合曲线</b>，没有起点也没有终点：螺线管外部从 N 极出发回到 S 极，内部再从 S 极回到 N 极。这一点和电场线（从正电荷出发、到负电荷终止）不同。</p>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.setBloom(0.6, 0.45, 0.8);
    scene.add(stageFloor({ y: -4 }));

    const st = { mode: 'wire', I: 6, on: true, earth: true, hand: true, core: false };
    const Ieff = () => (st.on ? st.I : 0);
    const copperMat = () => new THREE.MeshStandardMaterial({ color: COLOR.copper, metalness: 0.85, roughness: 0.3 });
    const addLabel = (parent, text, cls, x, y, z) => {
      const l = ctx.label(text, { cls });
      l.position.set(x, y, z);
      parent.add(l);
      return l;
    };
    const tmp = new THREE.Vector3();

    /* ================= 直导线 ================= */
    function buildWire() {
      const g = new THREE.Group();
      const boardGeo = new THREE.BoxGeometry(9.5, 0.06, 9.5);
      const board = new THREE.Mesh(boardGeo, new THREE.MeshStandardMaterial({ color: 0xdfe6f0, roughness: 0.7, transparent: true, opacity: 0.12, depthWrite: false }));
      board.position.y = -0.05;
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(boardGeo), new THREE.LineBasicMaterial({ color: 0x8a93a6, transparent: true, opacity: 0.5 }));
      edge.position.y = -0.05;
      g.add(board, edge);

      // 电路：竖直导线（x=0,z=0）向上，经顶部向后，后方竖直段装电池，再沿底部回来
      const Y1 = -3.0, Y2 = 4.2, ZB = -5.5;
      const loopPts = [V(0, Y1, 0), V(0, Y2, 0), V(0, Y2, ZB), V(0, Y1, ZB)];
      g.add(wire(loopPts, { radius: 0.065, closed: true, corner: 0.45 }).mesh);
      const curve = roundedPath(loopPts, 0.45, true);
      const electrons = new Flow(curve, { count: 80, r: 0.075, speed: -1 });
      const arrows = new ArrowFlow(curve, { count: 16, size: 0.26, speed: 1 });
      g.add(electrons.object, arrows.object);
      const bat = battery({ height: 1.6, radius: 0.4 });
      bat.position.set(0, 0.6, ZB);
      g.add(bat);

      // 两圈小磁针
      const comps = [];
      for (const [r, n, off] of [[1.8, 8, 0], [3.3, 12, Math.PI / 12]]) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + off;
          const c = compass({ r: 0.3 });
          c.position.set(r * Math.cos(a), 0, r * Math.sin(a));
          g.add(c);
          comps.push({ c, x: c.position.x, z: c.position.z, r });
        }
      }

      // 同心圆磁感线：点列方向 (r cosφ, y, −r sinφ) 正是向上电流的磁场方向
      const lines = [];
      for (const y of [-1.8, 0.08, 1.7]) for (const r of [1.05, 2.5, 4.1]) lines.push(circlePoints(V(0, y, 0), r, V(1, 0, 0), V(0, 0, -1), 96));
      const field = new LineFlow(lines, { opacity: 0.55, spacing: 0.85, arrowSize: 0.22, speedScale: (i, l) => 1.6 / Math.hypot(l[0].x, l[0].z) });
      g.add(field.object);

      const hand = rightHand();
      hand.position.set(0, 2.75, 0);
      g.add(hand);

      const lbI = addLabel(g, '电流 I ↑', 'orange', 0.8, 3.75, 0);
      addLabel(g, '磁感线：以导线为圆心的同心圆', 'green small', -2.2, 2.15, 1.8);
      addLabel(g, '小磁针：红色 N 极指向磁场方向', 'small', 2.7, 0.65, 2.7);
      const lbHand = addLabel(g, '右手：拇指指电流，四指弯向磁场', 'small yellow', -1.6, 3.75, 0.3);
      addLabel(g, '电源', 'small dim', 0.8, 0.6, ZB);

      return {
        group: g,
        refresh() {
          const I = Ieff();
          arrows.speed = I * 0.3;
          arrows.object.visible = I !== 0;
          electrons.speed = -I * 0.3;
          field.speed = I * 0.16;
          field.setStrength(Math.abs(I) / 10);
          bat.rotation.z = st.I >= 0 ? Math.PI : 0; // 电流向上流过中间导线时，电池 + 极朝下
          setLbl(lbI, I === 0 ? '电流 I = 0' : I > 0 ? '电流 I ↑' : '电流 I ↓');
          hand.rotation.z = st.I >= 0 ? 0 : Math.PI;
          hand.visible = st.hand && I !== 0;
          lbHand.visible = hand.visible;
          for (const k of comps) {
            const Bw = (2e-7 * I) / (k.r * CM) * 1e6; // μT
            tmp.set((k.z / k.r) * Bw, 0, (-k.x / k.r) * Bw);
            if (st.earth) tmp.z -= EARTH;
            k.c.userData.point(tmp);
          }
          const b1 = (2e-7 * Math.abs(I)) / (1.8 * CM) * 1e6;
          const b2 = (2e-7 * Math.abs(I)) / (3.3 * CM) * 1e6;
          RO.wire.api.set('I', I);
          RO.wire.api.set('b1', b1);
          RO.wire.api.set('b2', b2);
          note.set(I === 0
            ? '没有电流时，导线周围<b>没有磁场</b>，所有小磁针只受地磁场作用，都指向<b>北方</b>（画面里的 −z 方向，即远离你的方向）。'
            : `内圈磁针处导线磁场约 <b>${b1.toFixed(0)} μT</b>，是地磁场（约 ${EARTH} μT）的 ${(b1 / EARTH).toFixed(1)} 倍；外圈约 <b>${b2.toFixed(0)} μT</b>。磁针指向是两者叠加的结果：离导线越近、电流越大，磁针越整齐地沿圆周排列。`);
          plot.redraw();
        },
        update(dt) {
          electrons.update(dt);
          arrows.update(dt);
          field.update(dt);
          for (const k of comps) k.c.userData.update(dt);
        },
      };
    }

    /* ================= 环形电流 ================= */
    function buildLoop() {
      const g = new THREE.Group();
      const R = 2.2;
      const pts = [];
      const NS = 120;
      // 点列 (0, R cosφ, R sinφ)：沿 φ 增加方向的电流在圆心产生 +x 方向的磁场
      for (let i = 0; i < NS; i++) {
        const a = (i / NS) * Math.PI * 2;
        pts.push(V(0, R * Math.cos(a), R * Math.sin(a)));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.085, 12, true), copperMat()));
      for (const z of [-0.14, 0.14]) g.add(wire([V(0, -R - 0.02, z), V(0, -R - 1.4, z)], { radius: 0.05 }).mesh);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.9), new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6 }));
      base.position.set(0, -R - 1.55, 0);
      g.add(base);
      const arrows = new ArrowFlow(curve, { count: 18, size: 0.28, speed: 1 });
      const electrons = new Flow(curve, { count: 60, r: 0.085, speed: -1 });
      g.add(arrows.object, electrons.object);

      const segs = pathSegments(pts, true);
      const fieldFn = (p, out) => biotSavart(segs, p, out);
      const seeds = [0, 0.3, -0.3, 0.55, -0.55, 0.75, -0.75, 0.88, -0.88].map((f) => V(0, f * R, 0));
      const lines = seeds.map((s) => traceLine(fieldFn, s, { step: 0.05, bound: 8.5, plane: 'xy', maxSteps: 2400 }));
      const main = new LineFlow(lines, { opacity: 0.7, spacing: 0.9, arrowSize: 0.22 });
      const side = new LineFlow(revolveLines(lines, [Math.PI / 3, (2 * Math.PI) / 3], 'x'), { opacity: 0.18, spacing: 1.3, arrowSize: 0.15 });
      g.add(main.object, side.object);

      const hand = rightHand();
      hand.scale.setScalar(0.85);
      hand.position.set(0, R + 1.75, 0);
      g.add(hand);

      const lbN = addLabel(g, 'N', 'red big', 1.3, R + 0.5, 0);
      const lbS = addLabel(g, 'S', 'blue big', -1.3, R + 0.5, 0);
      addLabel(g, '环形电流', 'orange small', 0.9, -R - 1.0, 0.8);
      addLabel(g, '磁感线：和一块短磁铁很像', 'green small', -5.2, 2.6, 0);
      const lbHand = addLabel(g, '右手：四指顺电流，拇指指 N 极', 'small yellow', 0, R + 2.75, 0);
      addLabel(g, '接电源', 'small dim', 0, -R - 2.0, 0.7);

      return {
        group: g,
        refresh() {
          const I = Ieff();
          arrows.speed = I * 0.3;
          arrows.object.visible = I !== 0;
          electrons.speed = -I * 0.3;
          main.speed = side.speed = I * 0.15;
          main.setStrength(Math.abs(I) / 10);
          side.setStrength(Math.abs(I) / 10);
          const pos = st.I >= 0;
          setLbl(lbN, pos ? 'N' : 'S', pos ? 'red big' : 'blue big');
          setLbl(lbS, pos ? 'S' : 'N', pos ? 'blue big' : 'red big');
          lbN.visible = lbS.visible = I !== 0;
          hand.rotation.z = pos ? -Math.PI / 2 : Math.PI / 2; // 拇指指向 N 极（±x）
          hand.visible = lbHand.visible = st.hand && I !== 0;
          const b = (MU0 * Math.abs(I)) / (2 * R * CM) * 1e6;
          RO.loop.api.set('I', I);
          RO.loop.api.set('b', b);
          RO.loop.api.set('r', R);
          note.set(I === 0
            ? '断电后线圈的磁场消失。'
            : `圆心处 B = μ<sub>0</sub>I/(2R) ≈ <b>${b.toFixed(0)} μT</b>。线圈内部的磁感线都朝同一方向穿过，磁感线从<b>${pos ? '右' : '左'}侧</b>穿出——那一面相当于 N 极。`);
        },
        update(dt) {
          arrows.update(dt);
          electrons.update(dt);
          main.update(dt);
          side.update(dt);
        },
      };
    }

    /* ================= 螺线管 ================= */
    function buildSolenoid() {
      const g = new THREE.Group();
      const R = 1.1, Lc = 5.6, T = 14;
      const c = coil({ radius: R, turns: T, length: Lc, wire: 0.075, leads: 1.4 });
      g.add(c.mesh);
      // kit 的线圈：电流顺着曲线方向时管内磁场沿 −x。这里约定 I>0 时电流逆着曲线方向，管内磁场沿 +x（N 极在右）
      const arrows = new ArrowFlow(c.curve, { count: 70, size: 0.22, speed: -1 });
      const electrons = new Flow(c.curve, { count: 160, r: 0.07, speed: 1 });
      g.add(arrows.object, electrons.object);
      const base = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.3, 1.2), new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6 }));
      base.position.set(0, -R - 1.55, 0);
      g.add(base);

      const pts = c.curve.getSpacedPoints(T * 30);
      const segs = pathSegments(pts, false);
      const fieldFn = (p, out) => biotSavart(segs, p, out).negate();
      const seeds = [0, 0.3, -0.3, 0.55, -0.55, 0.78, -0.78].map((f) => V(0, f * R, 0));
      const lines = seeds.map((s) => traceLine(fieldFn, s, { step: 0.06, bound: 9.5, plane: 'xy', maxSteps: 2500 }));
      const main = new LineFlow(lines, { opacity: 0.7, spacing: 0.9, arrowSize: 0.22 });
      const side = new LineFlow(revolveLines(lines, [Math.PI / 3, (2 * Math.PI) / 3], 'x'), { opacity: 0.16, spacing: 1.3, arrowSize: 0.15 });
      g.add(main.object, side.object);

      const coreG = new THREE.Group();
      const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 6.6, 32), new THREE.MeshStandardMaterial({ color: 0x8c8f98, metalness: 0.75, roughness: 0.38 }));
      coreMesh.rotation.z = Math.PI / 2;
      coreG.add(coreMesh);
      addLabel(coreG, '软铁芯', 'small', -4.1, -0.55, 0);
      g.add(coreG);

      const hand = rightHand();
      hand.scale.setScalar(0.85);
      hand.position.set(0, R + 1.75, 0);
      g.add(hand);

      const lbN = addLabel(g, 'N', 'red big', 3.9, 1.0, 0);
      const lbS = addLabel(g, 'S', 'blue big', -3.9, 1.0, 0);
      addLabel(g, '螺线管：管内磁场均匀', 'orange small', 1.6, -R - 0.6, 1.4);
      addLabel(g, '管外：和条形磁铁一样', 'green small', -5.6, 2.9, 0);
      const lbHand = addLabel(g, '右手：四指顺电流，拇指指 N 极', 'small yellow', 0, R + 2.75, 0);

      const nPerM = T / (Lc * CM);
      return {
        group: g,
        refresh() {
          const I = Ieff();
          arrows.speed = -I * 0.3;
          arrows.object.visible = I !== 0;
          electrons.speed = I * 0.3;
          const boost = st.core ? 1.6 : 1;
          main.speed = side.speed = I * 0.15 * boost;
          main.setStrength(Math.min(1, (Math.abs(I) / 10) * boost));
          side.setStrength(Math.min(1, (Math.abs(I) / 10) * boost));
          main.setArrowScale(st.core ? 1.35 : 1);
          coreG.visible = st.core;
          const pos = st.I >= 0;
          setLbl(lbN, pos ? 'N' : 'S', pos ? 'red big' : 'blue big');
          setLbl(lbS, pos ? 'S' : 'N', pos ? 'blue big' : 'red big');
          lbN.visible = lbS.visible = I !== 0;
          hand.rotation.z = pos ? -Math.PI / 2 : Math.PI / 2;
          hand.visible = lbHand.visible = st.hand && I !== 0;
          let B = MU0 * nPerM * Math.abs(I); // T
          if (st.core) B = Math.min(1.8, B * 300);
          RO.solenoid.api.set('I', I);
          RO.solenoid.api.set('n', nPerM);
          if (B >= 0.1) { RO.solenoid.api.unit('b', 'T'); RO.solenoid.api.set('b', B, B.toFixed(2)); }
          else { RO.solenoid.api.unit('b', 'mT'); RO.solenoid.api.set('b', B * 1e3, (B * 1e3).toFixed(2)); }
          note.set(I === 0
            ? '断电后螺线管的磁性立即消失——电磁铁的磁性可以用开关控制。'
            : st.core
              ? `插入软铁芯后，铁芯被磁化，磁场增强了几百倍，管内约 <b>${B.toFixed(2)} T</b>。这就是<b>电磁铁</b>：电磁起重机、继电器都靠它。`
              : `管内 B = μ<sub>0</sub>nI ≈ <b>${(B * 1e3).toFixed(2)} mT</b>。管外磁感线从 <b>${pos ? '右' : '左'}端</b>出发绕回另一端，和条形磁铁一模一样。试试反转电流，N、S 极会对调。`);
        },
        update(dt) {
          arrows.update(dt);
          electrons.update(dt);
          main.update(dt);
          side.update(dt);
        },
      };
    }

    /* ================= 奥斯特实验 ================= */
    function buildOersted() {
      const g = new THREE.Group();
      const ty = -1.6; // 桌面
      const wy = ty + 1.55; // 导线高度（磁针在其正下方约 1.5 cm）
      const yw = ty + 0.3; // 桌面上的导线高度
      const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.75 });
      const table = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.3, 8.8), wood);
      table.position.set(1.6, ty - 0.15, 0);
      g.add(table);
      for (const [x, z] of [[-3.3, -4], [6.5, -4], [-3.3, 4], [6.5, 4]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, ty - 0.3 + 4, 0.3), wood);
        leg.position.set(x, (ty - 0.3 - 4) / 2, z);
        g.add(leg);
      }
      for (const z of [-3.35, 3.35]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, wy - ty + 0.25, 16), wood);
        post.position.set(0, (wy + ty + 0.25) / 2, z);
        g.add(post);
      }
      // 电路（I>0 时导线上的电流从南向北，即沿 −z）
      const X2 = 4.2;
      g.add(wire([V(X2, yw, 2.05), V(X2, yw, 3.2), V(0, yw, 3.2), V(0, wy, 3.2), V(0, wy, -3.2), V(0, yw, -3.2), V(X2, yw, -3.2), V(X2, yw, -1.7)], { radius: 0.05, corner: 0.25 }).mesh);
      g.add(wire([V(X2, yw, -0.7), V(X2, yw, 0.4)], { radius: 0.05 }).mesh);
      const loopPts = [V(0, wy, 3.2), V(0, wy, -3.2), V(0, yw, -3.2), V(X2, yw, -3.2), V(X2, yw, 3.2), V(0, yw, 3.2)];
      const curve = roundedPath(loopPts, 0.25, true);
      const electrons = new Flow(curve, { count: 70, r: 0.065, speed: -1 });
      const arrows = new ArrowFlow(curve, { count: 16, size: 0.22, speed: 1 });
      g.add(electrons.object, arrows.object);
      const bat = battery({ height: 1.6, radius: 0.3 });
      bat.position.set(X2, yw, 1.2);
      g.add(bat);
      const sw = switchPart({ length: 1 });
      sw.rotation.y = Math.PI / 2; // 沿 z 方向
      sw.position.set(X2, yw - 0.08, -1.2);
      g.add(sw);

      const cp = compass({ r: 0.75 });
      cp.position.set(0, ty + 0.03, 0);
      g.add(cp);

      // 指北箭头
      const north = new Arrow(0xd8d8de, { radius: 0.03, headLength: 0.3, headRadius: 0.1, emissive: 0.2 });
      north.set(V(-2.6, ty + 0.05, 2.2), V(0, 0, -2.2));
      g.add(north);

      // 导线周围的磁感线（I>0 时电流沿 −z，导线下方磁场指向 −x）
      const lines = [];
      for (const z of [-2.2, 0, 2.2]) for (const r of [0.55, 1.05, 1.5]) lines.push(circlePoints(V(0, wy, z), r, V(1, 0, 0), V(0, -1, 0), 72));
      const field = new LineFlow(lines, { opacity: 0.55, spacing: 0.7, arrowSize: 0.18, speedScale: (i, l) => 0.8 / Math.hypot(l[0].x, l[0].y - wy) });
      g.add(field.object);

      addLabel(g, '1820 年 · 奥斯特实验', 'big', -2.4, 1.6, -3.2);
      addLabel(g, '导线：沿南北方向，架在磁针正上方', 'orange small', 0, wy + 0.55, -2.0);
      addLabel(g, '小磁针', 'small', -1.4, ty + 0.55, 0.9);
      addLabel(g, '北', 'small dim', -2.6, ty + 0.35, -0.3);
      addLabel(g, '开关', 'small dim', X2 + 0.8, yw + 0.3, -1.2);
      addLabel(g, '电池', 'small dim', X2 + 0.8, yw + 0.3, 1.2);

      return {
        group: g,
        refresh() {
          const I = Ieff();
          sw.userData.set(st.on);
          arrows.speed = I * 0.3;
          arrows.object.visible = I !== 0;
          electrons.speed = -I * 0.3;
          field.speed = I * 0.12;
          field.setStrength(Math.abs(I) / 10);
          bat.rotation.x = st.I >= 0 ? Math.PI / 2 : -Math.PI / 2; // + 极朝向电流流出的方向
          const r = wy - (ty + 0.09);
          const Bw = (2e-7 * Math.abs(I)) / (r * CM) * 1e6; // μT
          const s = Math.sign(I);
          tmp.set(-Bw * s, 0, st.earth ? -EARTH : 0);
          cp.userData.point(tmp);
          const ang = st.earth ? (Math.atan2(Bw, EARTH) * 180) / Math.PI : I !== 0 ? 90 : 0;
          RO.oersted.api.set('I', I);
          RO.oersted.api.set('b', Bw);
          RO.oersted.api.set('ang', ang);
          note.set(!st.on
            ? '开关断开：导线中没有电流，小磁针在地磁场作用下指向<b>南北方向</b>，与导线平行。打开「接通电流」闭合开关试试！'
            : I === 0
              ? '开关闭合了，但电流为 0，磁针不动。'
              : `通电了！导线在磁针处产生约 <b>${Bw.toFixed(0)} μT</b> 的磁场，方向朝<b>${s > 0 ? '西' : '东'}</b>，与地磁场叠加后磁针向${s > 0 ? '西' : '东'}偏转约 <b>${ang.toFixed(0)}°</b>。把电流反向，磁针就朝另一边偏。`);
        },
        update(dt) {
          electrons.update(dt);
          arrows.update(dt);
          field.update(dt);
          cp.userData.update(dt);
          sw.userData.update(dt);
        },
      };
    }

    const BUILD = { wire: buildWire, loop: buildLoop, solenoid: buildSolenoid, oersted: buildOersted };
    const VIEWS = {
      wire: [[7.5, 6.8, 11.5], [0, 0.4, -0.6], 6],
      loop: [[6.5, 3.6, 12], [0, 0.4, 0], 7],
      solenoid: [[5.5, 4, 13], [0, 0.2, 0], 8],
      oersted: [[7.5, 5.2, 9.5], [1.4, -1.2, 0], 5.6],
    };
    const modes = {};

    /* ================= 面板 ================= */
    ui.segmented({
      label: '演示',
      options: [{ value: 'wire', label: '直导线' }, { value: 'loop', label: '环形电流' }, { value: 'solenoid', label: '螺线管' }, { value: 'oersted', label: '奥斯特实验' }],
      value: st.mode,
      onChange: (v) => setMode(v),
    });
    ui.slider({ label: '电流 I（负值表示反向）', min: -10, max: 10, step: 0.5, value: st.I, unit: 'A', digits: 1, onInput: (v) => { st.I = v; refresh(); } });
    const tOn = ui.toggle({ label: '接通电流', value: st.on, onChange: (v) => { st.on = v; refresh(); } });
    const tEarth = ui.toggle({ label: '考虑地磁场（指向北方）', value: st.earth, onChange: (v) => { st.earth = v; refresh(); } });
    const tHand = ui.toggle({ label: '显示右手螺旋定则', value: st.hand, onChange: (v) => { st.hand = v; refresh(); } });
    const tCore = ui.toggle({ label: '插入软铁芯（电磁铁）', value: st.core, onChange: (v) => { st.core = v; refresh(); } });
    const note = ui.note('');

    const RO = {};
    const mkRO = (key, list) => { const api = ui.readouts(list); RO[key] = { api, el: lastPanelEl(ui) }; };
    mkRO('wire', [{ key: 'I', label: '电流 I', unit: 'A', digits: 1 }, { key: 'b1', label: '内圈 B（1.8 cm）', unit: 'μT', digits: 0 }, { key: 'b2', label: '外圈 B（3.3 cm）', unit: 'μT', digits: 0 }]);
    mkRO('loop', [{ key: 'I', label: '电流 I', unit: 'A', digits: 1 }, { key: 'b', label: '圆心处 B', unit: 'μT', digits: 0 }, { key: 'r', label: '线圈半径 R', unit: 'cm', digits: 1 }]);
    mkRO('solenoid', [{ key: 'I', label: '电流 I', unit: 'A', digits: 1 }, { key: 'n', label: '每米匝数 n', unit: '匝/m', digits: 0 }, { key: 'b', label: '管内 B', unit: 'mT', digits: 2 }]);
    mkRO('oersted', [{ key: 'I', label: '电流 I', unit: 'A', digits: 1 }, { key: 'b', label: '磁针处导线磁场', unit: 'μT', digits: 0 }, { key: 'ang', label: '磁针偏转角', unit: '°', digits: 0 }]);
    ui.legend([
      { color: CSSCOLOR.bfield, label: '磁感线（磁场方向）' },
      { color: CSSCOLOR.current, label: '电流方向' },
      { color: CSSCOLOR.electron, label: '电子' },
      { color: CSSCOLOR.magnetN, label: '磁针 N 极' },
    ]);
    const plot = ui.plot({
      title: '直导线：B 随距离 r 的变化',
      height: 150, xMin: 0, xMax: 6, yMin: 0, yMax: 400,
      xLabel: '到导线的距离 r (cm)', yLabel: '磁感应强度 B (μT)',
      series: [{ label: '导线磁场', color: CSSCOLOR.bfield }, { label: '地磁场', color: 'rgba(255,255,255,.5)' }],
      draw(p) {
        const I = Math.abs(Ieff());
        p.hline(EARTH, 'rgba(255,255,255,.45)');
        p.text(5.9, EARTH + 12, '地磁场 ≈ 35 μT', 'rgba(255,255,255,.6)', 'right');
        if (I > 0) {
          p.fn((r) => Math.min(420, (2e-7 * I) / Math.max(r * CM, 1e-4) * 1e6), CSSCOLOR.bfield, 2.2, 160);
          for (const r of [1.8, 3.3]) p.dot(r, (2e-7 * I) / (r * CM) * 1e6, '#ffffff', 4);
        }
      },
    });
    const plotEl = lastPanelEl(ui);

    function refresh() {
      modes[st.mode]?.refresh();
    }

    function setMode(m) {
      st.mode = m;
      if (!modes[m]) {
        modes[m] = BUILD[m]();
        scene.add(modes[m].group);
      }
      for (const k in modes) modes[k].group.visible = k === m;
      const v = VIEWS[m];
      ctx.view(v[0], v[1], v[2]);
      if (m === 'oersted') { st.on = false; tOn.set(false); }
      else if (!st.on) { st.on = true; tOn.set(true); }
      setShown(tEarth.el, m === 'wire' || m === 'oersted');
      setShown(tHand.el, m !== 'oersted');
      setShown(tCore.el, m === 'solenoid');
      for (const k in RO) setShown(RO[k].el, k === m);
      setShown(plotEl, m === 'wire');
      refresh();
    }
    setMode('wire');

    return {
      update(dt) {
        modes[st.mode]?.update(dt);
      },
    };
  },
};
