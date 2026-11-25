import * as THREE from 'three';
import { COLOR, CSSCOLOR, traceFieldLines, fieldLinesObject, textSprite, disposeTree, clamp, V } from '../lib/kit.js';
import { chargeBall, Dragger, Trail, sci, signed, showEl } from '../lib/basics-kit.js';

// 画面单位：1 格 = 1 cm，电荷以 nC 计。点电荷电势 φ = kQ/r = 899 × Q(nC) / r(cm)  [V]
const KV = 899;
const W = 14, D = 10, NX = 140, NZ = 100; // 地形网格：x ∈ [−7, 7]，z ∈ [−5, 5]
const HMAX = 3, PHI0 = 2000; // 点电荷：高度 = 3·tanh(φ / 2000 V)
const BASE = -3.7; // 底面（俯视图）高度
const XP = -4, XN = 4; // 「电池两极」：正极板 x = −4，负极板 x = +4（相距 8 cm）
const SOFT = 0.35; // 画地形时的软化半径（避免无穷大）
const MAXSEG = 40000;

const C_STOPS = [
  [-1, new THREE.Color(0x1b2a8f)],
  [-0.45, new THREE.Color(0x2f7bf0)],
  [0, new THREE.Color(0x4a4a58)],
  [0.45, new THREE.Color(0xe0452b)],
  [1, new THREE.Color(0xf09a2e)],
];
function divColor(t, out) {
  t = clamp(t, -1, 1);
  for (let i = 1; i < C_STOPS.length; i++) {
    if (t <= C_STOPS[i][0]) {
      const [t0, c0] = C_STOPS[i - 1], [t1, c1] = C_STOPS[i];
      return out.copy(c0).lerp(c1, (t - t0) / (t1 - t0));
    }
  }
  return out.copy(C_STOPS[C_STOPS.length - 1][1]);
}
// 等值线（marching squares）的查表：每种情况对应的交叉边（0=下 1=右 2=上 3=左）
const MS = [[], [3, 0], [0, 1], [3, 1], [1, 2], [3, 0, 1, 2], [0, 2], [3, 2], [2, 3], [0, 2], [0, 1, 2, 3], [1, 2], [1, 3], [0, 1], [0, 3], []];

export default {
  id: 'potential',
  group: 'basics',
  title: '电势与电压',
  subtitle: 'U = φA − φB',
  summary: '把电势画成地形：正电荷是山峰、负电荷是深坑，电压就是两点的“高度差”。',
  lead: '电势就像电的“海拔高度”：画面把每一点的电势画成地形的高低（红高蓝低），白色细线是等势线，就像地图上的等高线。正电荷小球会从高处“滚”向低处；拖动地形上的 A、B 两个标记，就能读出它们之间的电压。',
  formulas: [
    { expr: '<i>U</i><sub>AB</sub> = <i>φ</i><sub>A</sub> − <i>φ</i><sub>B</sub>', desc: '电压（电势差，单位伏特 V）= 两点电势之差。φ 读作“phi”，表示电势。' },
    { expr: '<i>W</i><sub>AB</sub> = <i>q</i><i>U</i><sub>AB</sub>', desc: '电荷 q（C）从 A 移到 B，电场力做的功 W（焦耳 J）。1 V = 1 J/C：1 库仑电荷“下降”1 伏特，释放 1 焦耳能量。' },
    { expr: '<i>φ</i> = <i>k</i><span class="frac"><span><i>Q</i></span><span><i>r</i></span></span>', desc: '点电荷 Q 在距离 r 处的电势（取无穷远处为 0）。正电荷周围电势为正，负电荷周围为负。' },
  ],
  sections: [
    {
      title: '电势：电的“海拔高度”',
      html: `<p>把一个物体举高，它就有了<b>重力势能</b>；松手，它会往低处落，势能变成动能。电场里也是这样：把正电荷放到电场中不同位置，它具有不同的<b>电势能</b>。</p>
      <p>某点的电势能与电荷量的比值，叫这一点的<b>电势 φ</b>（单位伏特 V）。它只取决于电场本身，与放进去的电荷无关——就像海拔高度只取决于地形，不取决于你站上去的是人还是石头。</p>
      <p>画面中地形的高低就是电势的高低：<b>正电荷</b>周围是一座“电势山”（红），<b>负电荷</b>周围是一个“电势坑”（蓝）。切换「电池两极」，两块极板之间是一条均匀的斜坡。</p>
      <div class="tip">为了画得下，点电荷附近的山顶做了“削平”处理：真实电势在点电荷处会趋于无穷大。</div>`,
    },
    {
      title: '电压就是“高度差”',
      html: `<p>两点电势之差叫<b>电势差</b>，也就是<b>电压</b>：U<sub>AB</sub> = φ<sub>A</sub> − φ<sub>B</sub>。拖动 A、B 两个标记，橙色竖线的长短就是两点的“高度差”。</p>
      <p>同一个水塔，水从塔顶流到地面能做多少功，取决于高度差，而不是“海拔多少米”——海拔零点选在哪儿都无所谓。电也一样：电势的零点可以随便选（点电荷通常选无穷远处，电路里通常选电池负极或大地），但<b>电压与零点的选择无关</b>。</p>
      <table><tr><th>水路</th><th>电路</th></tr>
      <tr><td>水位高度</td><td>电势 φ</td></tr>
      <tr><td>高度差（落差）</td><td>电压 U</td></tr>
      <tr><td>水泵把水抬高</td><td>电池把正电荷“抬”到高电势</td></tr>
      <tr><td>水从高处流下推动水车</td><td>电荷从高电势流向低电势推动用电器</td></tr></table>`,
    },
    {
      title: '1 伏特是多少？做功与能量',
      html: `<p>电荷 q 从 A 移到 B，电场力做功 <b>W = qU<sub>AB</sub></b>。所以：</p>
      <div class="eq">1 V = 1 J / C</div>
      <p>意思是：1 库仑的电荷在电场中“下降”1 伏特，电场力对它做 1 焦耳的功（释放 1 焦耳的能量）。</p>
      <ul><li>一节 1.5 V 干电池：每推动 1 C 电荷通过外电路，提供 1.5 J 能量</li>
      <li>手机电池 3.7 V、家庭电路 220 V、高压输电线 50 万伏</li>
      <li>一个电子“下降”1 V 获得的能量叫 1 电子伏特（eV）= 1.6×10<sup>−19</sup> J，原子物理里常用</li></ul>
      <p>注意正负号：正电荷顺着电场“滚下坡”（从高电势到低电势）时 W &gt; 0，电势能减少；<b>电子带负电</b>，对它来说地形是倒过来的——它会自发地从低电势“爬”向高电势。把「小球」切换成「电子」试试。这也是为什么电路中电子从电池负极流向正极。</p>`,
    },
    {
      title: '等势线与电场线互相垂直',
      html: `<p>电势相等的点连成的线（立体中是面）叫<b>等势线（等势面）</b>，就像地图上的等高线。画面中白线是相邻电势相差相同的等势线，底面俯视图里黄色的是电场线。</p>
      <ul><li>等势线与电场线处处<b>垂直</b>——就像山坡上最陡的下坡方向总是垂直于等高线</li>
      <li>电场线总是从高电势指向低电势：电场方向就是电势“下降最快”的方向</li>
      <li>等势线越<b>密</b>，电势变化越快，电场越<b>强</b>：E = U/d</li>
      <li>沿着等势线移动电荷，电场力不做功</li></ul>
      <p>平行板（电池两极）之间等势线是等距的平行直线，说明电场是均匀的；点电荷附近等势线挤在一起，说明那里电场很强。</p>`,
    },
    {
      title: '为什么站在高压线上的小鸟不会触电？',
      html: `<p>电流要流过身体，需要身体两端存在<b>电压</b>。小鸟两只脚站在同一根导线上，两脚之间只隔几厘米导线，导线电阻极小，两脚间的电压几乎为零（不到千分之一伏），所以几乎没有电流流过它——尽管导线对地的电势可能高达几十万伏。</p>
      <p>可如果一只大鸟张开翅膀，同时碰到两根导线，或者一根导线和接地的铁塔，两点之间就有巨大的电压，会被电死。</p>
      <div class="warn">常见误区：“电压高就一定危险，电势高就一定危险。”真正决定危险的是加在<b>人体两点之间</b>的电压，以及由此产生的电流。检修人员穿上金属屏蔽服带电作业，也是让全身处于同一电势。但普通人千万不要靠近高压线——高压电能隔着空气放电，人体不需要碰到导线就可能被击中。</div>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.view([0, 8.2, 12.5], [0, -0.9, 0], 7.6);
    ctx.setBloom(0.4, 0.4, 0.9);

    let preset = 'pos', Q = 2, U = 9, ballKind = 'pos', showLines = true;
    let charges = []; // { x, z, q }

    /* ---------- 电势与高度 ---------- */
    function phiAt(x, z, soft) {
      if (preset === 'battery') {
        const t = clamp((x - XP) / (XN - XP), 0, 1);
        return U * (1 - t); // 负极为 0 V
      }
      let v = 0;
      for (const c of charges) {
        const dx = x - c.x, dz = z - c.z;
        v += (KV * c.q) / Math.sqrt(dx * dx + dz * dz + soft * soft);
      }
      return v;
    }
    const hOf = (phi) => (preset === 'battery' ? 0.3 * (phi - U / 2) : HMAX * Math.tanh(phi / PHI0));
    const H = (x, z) => hOf(phiAt(x, z, SOFT));

    /* ---------- 地形网格 ---------- */
    const geo = new THREE.PlaneGeometry(W, D, NX, NZ);
    geo.rotateX(-Math.PI / 2);
    const posAttr = geo.attributes.position;
    const NV = posAttr.count, NXv = NX + 1, NZv = NZ + 1;
    const colors = new Float32Array(NV * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const xs = new Float32Array(NXv), zs = new Float32Array(NZv);
    for (let i = 0; i < NXv; i++) xs[i] = posAttr.getX(i);
    for (let j = 0; j < NZv; j++) zs[j] = posAttr.getZ(j * NXv);
    const phiGrid = new Float32Array(NV);
    const surface = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.05, side: THREE.DoubleSide }));
    const wireOverlay = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.035, depthWrite: false }));
    scene.add(surface, wireOverlay);

    // 底面（俯视图）
    const basePlane = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: 0x17171d, roughness: 0.95 }));
    basePlane.rotation.x = -Math.PI / 2;
    basePlane.position.y = BASE;
    scene.add(basePlane);

    // 等势线：地形上一份（白），底面投影一份（淡）
    function makeSegs(color, opacity) {
      const g = new THREE.BufferGeometry();
      const arr = new Float32Array(MAXSEG * 6);
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      g.setDrawRange(0, 0);
      const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
      ls.frustumCulled = false;
      return { ls, arr, g };
    }
    const contTop = makeSegs(0xffffff, 0.75);
    const contBase = makeSegs(0xffffff, 0.4);
    scene.add(contTop.ls, contBase.ls);

    const decor = new THREE.Group(); // 电荷小球、极板等，随预设重建
    const baseLines = new THREE.Group();
    scene.add(decor, baseLines);

    const tmpC = new THREE.Color();
    function rebuildSurface() {
      let hMaxAbs = 0;
      for (let k = 0; k < NV; k++) {
        const x = posAttr.getX(k), z = posAttr.getZ(k);
        const phi = phiAt(x, z, SOFT);
        phiGrid[k] = phi;
        const h = hOf(phi);
        posAttr.setY(k, h);
        hMaxAbs = Math.max(hMaxAbs, Math.abs(h));
        divColor(h / HMAX, tmpC);
        colors[k * 3] = tmpC.r; colors[k * 3 + 1] = tmpC.g; colors[k * 3 + 2] = tmpC.b;
      }
      posAttr.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      geo.computeBoundingBox();

      // 等势线的取值
      const levels = [];
      if (preset === 'battery') { for (let v = 1; v < U - 1e-6; v += 1) levels.push(v); }
      else {
        for (let k = 1; k <= 15; k++) for (const s of [1, -1]) levels.push(s * k * 250);
      }
      let n = 0;
      const A = contTop.arr, Bv = contBase.arr;
      const ex = [0, 0, 0, 0], ez = [0, 0, 0, 0];
      for (const L of levels) {
        const y = hOf(L) + 0.035;
        for (let j = 0; j < NZ; j++) {
          for (let i = 0; i < NX; i++) {
            const a = phiGrid[j * NXv + i], b = phiGrid[j * NXv + i + 1], c = phiGrid[(j + 1) * NXv + i + 1], d = phiGrid[(j + 1) * NXv + i];
            const idx = (a > L ? 1 : 0) | (b > L ? 2 : 0) | (c > L ? 4 : 0) | (d > L ? 8 : 0);
            if (idx === 0 || idx === 15) continue;
            // 四条边上的交点
            ex[0] = xs[i] + ((L - a) / (b - a || 1e-9)) * (xs[i + 1] - xs[i]); ez[0] = zs[j];
            ex[1] = xs[i + 1]; ez[1] = zs[j] + ((L - b) / (c - b || 1e-9)) * (zs[j + 1] - zs[j]);
            ex[2] = xs[i] + ((L - d) / (c - d || 1e-9)) * (xs[i + 1] - xs[i]); ez[2] = zs[j + 1];
            ex[3] = xs[i]; ez[3] = zs[j] + ((L - a) / (d - a || 1e-9)) * (zs[j + 1] - zs[j]);
            const segs = MS[idx];
            for (let s = 0; s < segs.length; s += 2) {
              if (n >= MAXSEG) break;
              const e0 = segs[s], e1 = segs[s + 1], o = n * 6;
              A[o] = ex[e0]; A[o + 1] = y; A[o + 2] = ez[e0]; A[o + 3] = ex[e1]; A[o + 4] = y; A[o + 5] = ez[e1];
              Bv[o] = ex[e0]; Bv[o + 1] = BASE + 0.012; Bv[o + 2] = ez[e0]; Bv[o + 3] = ex[e1]; Bv[o + 4] = BASE + 0.012; Bv[o + 5] = ez[e1];
              n++;
            }
          }
        }
      }
      for (const cs of [contTop, contBase]) {
        cs.g.setDrawRange(0, n * 2);
        cs.g.attributes.position.needsUpdate = true;
        cs.g.computeBoundingSphere();
      }
    }

    function rebuildDecor() {
      disposeTree(decor);
      decor.clear();
      disposeTree(baseLines);
      baseLines.clear();
      if (preset === 'battery') {
        [[XP, U, '正极板（接电池 +）', 'red', COLOR.proton], [XN, 0, '负极板（接电池 −，0 V）', 'blue', COLOR.electron]].forEach(([x, phi, text, cls, col]) => {
          const top = hOf(phi) + 1.2;
          const plate = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, top - BASE, D * 0.92),
            new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.2, transparent: true, opacity: 0.32, depthWrite: false, roughness: 0.4 })
          );
          plate.position.set(x, (top + BASE) / 2, 0);
          decor.add(plate);
          const s = textSprite(phi > 0 ? '+' : '−', { size: 0.6, color: phi > 0 ? '#ff8a80' : '#8fc3ff' });
          s.position.set(x, top + 0.35, 0);
          decor.add(s);
          const l = ctx.label(text, { cls: 'small ' + cls });
          l.position.set(x, top + 0.95, 0);
          decor.add(l);
        });
        const lines = [];
        for (let z = -4; z <= 4; z += 1) {
          const line = [];
          for (let k = 0; k <= 24; k++) line.push(V(XP + ((XN - XP) * k) / 24, 0, z));
          lines.push(line);
        }
        const fl = fieldLinesObject(lines, { color: COLOR.efield, opacity: 0.8, arrows: 2, arrowSize: 0.26 });
        fl.position.y = BASE + 0.025;
        baseLines.add(fl);
      } else {
        for (const c of charges) {
          const b = chargeBall({ r: 0.3 });
          b.userData.setQ(c.q, 5);
          b.position.set(c.x, H(c.x, c.z) + (c.q > 0 ? 0.25 : 0.1), c.z);
          decor.add(b);
          const l = ctx.label(`${signed(c.q, 1)} nC`, { cls: 'small ' + (c.q > 0 ? 'red' : 'blue') });
          l.position.set(c.x, b.position.y + (c.q > 0 ? 0.75 : 0.6), c.z);
          decor.add(l);
          const dot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), new THREE.MeshBasicMaterial({ color: c.q > 0 ? COLOR.proton : COLOR.electron }));
          dot.rotation.x = -Math.PI / 2;
          dot.position.set(c.x, BASE + 0.03, c.z);
          decor.add(dot);
        }
        // 底面电场线（xz 平面），裁剪到底面矩形内
        const rel = charges.map((c) => ({ pos: V(c.x, 0, c.z), q: Math.sign(c.q) }));
        const raw = traceFieldLines(rel, { perCharge: 10, plane: 'xz', bound: 10, startR: 0.25, step: 0.05 });
        const lines = [];
        for (const l of raw) {
          let k = 0;
          while (k < l.length && Math.abs(l[k].x) <= W / 2 && Math.abs(l[k].z) <= D / 2) k++;
          if (k > 8) lines.push(l.slice(0, k));
        }
        const fl = fieldLinesObject(lines, { color: COLOR.efield, opacity: 0.8, arrows: 1, arrowSize: 0.26, reverse: !charges.some((c) => c.q > 0) });
        fl.position.y = BASE + 0.025;
        baseLines.add(fl);
      }
      baseLines.visible = showLines;
      const lb = ctx.label('底面俯视图：白线 = 等势线，黄线 = 电场线', { cls: 'small dim' });
      lb.position.set(0, BASE, D / 2 + 0.6);
      decor.add(lb);
    }

    function setupCharges() {
      if (preset === 'pos') charges = [{ x: 0, z: 0, q: Q }];
      else if (preset === 'neg') charges = [{ x: 0, z: 0, q: -Q }];
      else if (preset === 'dipole') charges = [{ x: -2.5, z: 0, q: Q }, { x: 2.5, z: 0, q: -Q }];
      else charges = [];
    }

    function rebuild() {
      setupCharges();
      rebuildSurface();
      rebuildDecor();
      placeMarkers();
      spawn();
      refresh();
    }

    /* ---------- A、B 标记 ---------- */
    function makeMarker(color, name) {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.3 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), mat);
      head.position.y = 0.75;
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.75, 8), mat);
      pin.position.y = 0.375;
      const foot = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 24), mat);
      foot.rotation.x = Math.PI / 2;
      const hitM = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 8), new THREE.MeshBasicMaterial({ visible: false }));
      hitM.position.y = 0.5;
      g.add(head, pin, foot, hitM);
      const l = ctx.label(name, { cls: 'small' });
      l.position.y = 1.2;
      g.add(l);
      g.userData.label = l;
      g.userData.x = 0;
      g.userData.z = 0;
      scene.add(g);
      return g;
    }
    const mA = makeMarker(0x6be3ac, 'A');
    const mB = makeMarker(0xd4adff, 'B');
    function placeMarkers() {
      for (const m of [mA, mB]) m.position.set(m.userData.x, H(m.userData.x, m.userData.z), m.userData.z);
    }
    function defaultMarkers() {
      if (preset === 'battery') { mA.userData.x = -2; mA.userData.z = 2; mB.userData.x = 2; mB.userData.z = 2; }
      else if (preset === 'dipole') { mA.userData.x = -1.2; mA.userData.z = 2.2; mB.userData.x = 3.6; mB.userData.z = 2.2; }
      else { mA.userData.x = -1.6; mA.userData.z = 1.6; mB.userData.x = 4; mB.userData.z = 2.4; }
    }
    const levelLine = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
    const dropLine = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: COLOR.current }));
    levelLine.frustumCulled = dropLine.frustumCulled = false;
    scene.add(levelLine, dropLine);
    const lbU = ctx.label('', { cls: 'small orange' });
    scene.add(lbU);

    const dragger = new Dragger(ctx, {
      targets: [mA, mB],
      pick: (ray) => {
        const hits = ray.intersectObject(surface, false);
        return hits.length ? hits[0].point : null;
      },
      onDrag: (m, p) => {
        m.userData.x = clamp(p.x, -W / 2 + 0.2, W / 2 - 0.2);
        m.userData.z = clamp(p.z, -D / 2 + 0.2, D / 2 - 0.2);
        placeMarkers();
        refresh();
      },
    });

    /* ---------- 滚动的小球（试探电荷） ---------- */
    const ballMatPos = new THREE.MeshStandardMaterial({ color: COLOR.proton, emissive: COLOR.proton, emissiveIntensity: 0.7, roughness: 0.3 });
    const ballMatNeg = new THREE.MeshStandardMaterial({ color: COLOR.electron, emissive: COLOR.electron, emissiveIntensity: 0.8, roughness: 0.3 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), ballMatPos);
    scene.add(ball);
    const trail = new Trail(160, { color: 0xffffff, opacity: 0.5 });
    scene.add(trail.object);
    const bp = { x: 0, z: 0, vx: 0, vz: 0, age: 0, rest: 0 };
    let trailT = 0;

    function spawn() {
      bp.vx = bp.vz = 0;
      bp.age = 0;
      bp.rest = 0;
      trail.reset();
      const s = ballKind === 'pos' ? 1 : -1;
      const a = Math.random() * Math.PI * 2;
      const edge = () => { bp.x = Math.cos(a) * 6.2; bp.z = Math.sin(a) * 4.2; };
      if (preset === 'battery') {
        bp.x = s > 0 ? XP + 0.4 : XN - 0.4;
        bp.z = (Math.random() * 2 - 1) * 3.8;
      } else {
        // 从“山顶”出发：正电荷从正电荷旁、电子从负电荷旁出发；否则从边缘出发
        const start = charges.find((c) => Math.sign(c.q) === s);
        if (start) { bp.x = start.x + Math.cos(a) * 0.5; bp.z = start.z + Math.sin(a) * 0.5; }
        else edge();
      }
    }

    /* ---------- 面板 ---------- */
    ui.segmented({
      label: '电荷分布',
      options: [{ value: 'pos', label: '正点电荷' }, { value: 'neg', label: '负点电荷' }, { value: 'dipole', label: '偶极子' }, { value: 'battery', label: '电池两极' }],
      value: preset,
      onChange: (v) => { preset = v; showEl(sQ.el, v !== 'battery'); showEl(sU.el, v === 'battery'); defaultMarkers(); rebuild(); },
    });
    const sQ = ui.slider({ label: '电荷量 |Q|', min: 0.5, max: 5, step: 0.5, value: Q, unit: 'nC', digits: 1, onInput: (v) => { Q = v; rebuild(); } });
    const sU = ui.slider({ label: '电池电压 U', min: 1.5, max: 12, step: 0.5, value: U, unit: 'V', digits: 1, onInput: (v) => { U = v; rebuild(); } });
    showEl(sU.el, false);
    ui.segmented({
      label: '滚动的小球是',
      options: [{ value: 'pos', label: '正电荷' }, { value: 'neg', label: '电子' }],
      value: ballKind,
      onChange: (v) => { ballKind = v; ball.material = v === 'pos' ? ballMatPos : ballMatNeg; spawn(); refresh(); },
    });
    ui.toggle({ label: '底面显示电场线', value: showLines, onChange: (v) => { showLines = v; baseLines.visible = v; } });
    ui.button({ label: '再放一个小球', onClick: () => spawn() });
    const note = ui.note('');
    const read = ui.readouts([
      { key: 'a', label: 'A 点电势 φA', unit: 'V' },
      { key: 'b', label: 'B 点电势 φB', unit: 'V' },
      { key: 'u', label: '电压 UAB', unit: 'V' },
      { key: 'w', label: '+1 nC 从 A 到 B，电场做功', unit: 'J' },
    ]);
    ui.legend([
      { color: '#f09a2e', label: '高电势' },
      { color: '#2f7bf0', label: '低电势' },
      { color: '#ffffff', label: '等势线' },
      { color: CSSCOLOR.efield, label: '电场线（底面）' },
      { color: CSSCOLOR.current, label: 'A、B 的电势差' },
    ]);

    let lastNote = '';
    function refresh() {
      const fA = phiAt(mA.userData.x, mA.userData.z, 0.15);
      const fB = phiAt(mB.userData.x, mB.userData.z, 0.15);
      const Uab = fA - fB;
      const fmtV = (v) => sci(v, 2, { plainMin: 0.01, plainMax: 1e5 });
      read.set('a', fA, fmtV(fA));
      read.set('b', fB, fmtV(fB));
      read.set('u', Uab, fmtV(Uab));
      read.set('w', Uab * 1e-9, sci(Uab * 1e-9, 2));
      mA.userData.label.element.textContent = `A：${fmtV(fA)} V`;
      mB.userData.label.element.textContent = `B：${fmtV(fB)} V`;
      const hA = H(mA.userData.x, mA.userData.z), hB = H(mB.userData.x, mB.userData.z);
      const la = levelLine.geometry.attributes.position.array;
      la.set([mA.userData.x, hA, mA.userData.z, mB.userData.x, hA, mB.userData.z]);
      levelLine.geometry.attributes.position.needsUpdate = true;
      const da = dropLine.geometry.attributes.position.array;
      da.set([mB.userData.x, hA, mB.userData.z, mB.userData.x, hB, mB.userData.z]);
      dropLine.geometry.attributes.position.needsUpdate = true;
      lbU.position.set(mB.userData.x + 0.25, (hA + hB) / 2, mB.userData.z);
      lbU.center.set(0, 0.5);
      lbU.element.textContent = `UAB = ${fmtV(Uab)} V`;

      const pos = ballKind === 'pos';
      let h;
      if (preset === 'battery') h = `两块极板接在 ${U} V 电池两端，负极板取作 0 V，正极板电势 ${U} V。板间电势<b>均匀下降</b>，像一条斜坡，等势线是等距的平行线（每条相差 1 V）。`;
      else if (preset === 'pos') h = '正点电荷周围的电势都是正的，越靠近越高，像一座山峰。等势线是一圈圈同心圆，越靠近电荷越密——那里电场越强。';
      else if (preset === 'neg') h = '负点电荷周围的电势都是负的，越靠近越低，像一个深坑。';
      else h = '偶极子：正电荷是山、负电荷是坑。电场线（底面黄线）从山顶出发、落进坑里，处处与等势线垂直。';
      h += pos
        ? ' 红色小球（<b>正电荷</b>）总是从高电势“滚”向低电势，电势能转化为动能。'
        : ' 蓝色小球是<b>电子</b>（负电荷），它的电势能是 −eφ，所以对它来说地形是倒过来的：它会从低电势“爬”向高电势。';
      h += `<br>把 +1 nC 的电荷从 A 移到 B，电场力做功 W = qU<sub>AB</sub> = ${sci(Uab * 1e-9, 2)} J${Math.abs(Uab) < 1e-9 ? '' : Uab > 0 ? '（正功：A 比 B 高）' : '（负功：要靠外力把它推“上坡”）'}。`;
      if (h !== lastNote) { lastNote = h; note.set(h); }
    }

    defaultMarkers();
    rebuild();

    return {
      update(dt) {
        const s = ballKind === 'pos' ? 1 : -1;
        const e = 0.05;
        const gx = (H(bp.x + e, bp.z) - H(bp.x - e, bp.z)) / (2 * e);
        const gz = (H(bp.x, bp.z + e) - H(bp.x, bp.z - e)) / (2 * e);
        const G = 7;
        bp.vx += -s * G * gx * dt;
        bp.vz += -s * G * gz * dt;
        const damp = Math.exp(-0.7 * dt);
        bp.vx *= damp;
        bp.vz *= damp;
        const sp = Math.hypot(bp.vx, bp.vz);
        if (sp > 7) { bp.vx *= 7 / sp; bp.vz *= 7 / sp; }
        bp.x += bp.vx * dt;
        bp.z += bp.vz * dt;
        bp.age += dt;
        const y = H(bp.x, bp.z);
        ball.position.set(bp.x, y + 0.2, bp.z);
        trailT += dt;
        if (trailT > 0.04 && dt > 0) { trailT = 0; trail.push(ball.position); }
        // 重新出发的条件：出界、停住、掉进“坑”里
        let dead = Math.abs(bp.x) > W / 2 - 0.1 || Math.abs(bp.z) > D / 2 - 0.1 || bp.age > 14;
        if (sp < 0.12 && bp.age > 1.5) bp.rest += dt; else bp.rest = 0;
        if (bp.rest > 0.8) dead = true;
        for (const c of charges) if (Math.sign(c.q) === -s && Math.hypot(bp.x - c.x, bp.z - c.z) < 0.3 && bp.age > 0.5) bp.rest += dt * 2;
        if (dead) spawn();
      },
      dispose() {
        dragger.dispose();
        ballMatPos.dispose();
        ballMatNeg.dispose();
      },
    };
  },
};
