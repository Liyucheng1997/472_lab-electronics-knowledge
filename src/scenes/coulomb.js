import * as THREE from 'three';
import { Arrow, stageFloor, Polyline, glowSprite, clamp, damp } from '../lib/kit.js';
import { chargeBall, sci, signed, setLabel } from '../lib/basics-kit.js';

const K = 8.99e9; // 静电力常量 N·m²/C²
const G = 6.674e-11; // 万有引力常量
const S = 10; // 1 m = 画面中 10 格
const R_BALL = 0.032; // 小球半径（m）
const MASS = 0.1; // 自由运动时每个小球（连同小车）的质量（kg）
const FORCE_COLOR = 0xff7ad9;
const FMAX = (K * 25e-12) / 0.01; // q1 = q2 = 5 μC、r = 0.1 m 时的力 ≈ 22.5 N
const SLOW = 0.35; // 自由运动时的慢放倍数
const XW = 0.6 - R_BALL; // 轨道两端挡板

export default {
  id: 'coulomb',
  group: 'basics',
  title: '库仑定律',
  subtitle: 'F = kq₁q₂ / r²',
  summary: '两个电荷之间的力与电量乘积成正比、与距离平方成反比——距离加倍，力只剩四分之一。',
  lead: '两个带电小球放在轨道上：同种电荷相互排斥，异种电荷相互吸引。拖动滑块改变电量和距离，看力的箭头和读数怎样变化；打开「自由运动」，让小球在电力作用下自己跑起来。',
  formulas: [
    {
      expr: '<i>F</i> = <i>k</i><span class="frac"><span>|<i>q</i><sub>1</sub><i>q</i><sub>2</sub>|</span><span><i>r</i><sup>2</sup></span></span>',
      desc: 'F：两电荷间的静电力（牛顿 N）；q₁、q₂：两个电荷的电量（库仑 C）；r：两电荷之间的距离（米 m）；k ≈ 8.99×10<sup>9</sup> N·m²/C²，叫静电力常量。',
    },
    {
      expr: '<i>F</i><sub>12</sub> = −<i>F</i><sub>21</sub>',
      desc: '牛顿第三定律：q₁ 对 q₂ 的力和 q₂ 对 q₁ 的力大小相等、方向相反，不管两个电量是否相同。',
    },
  ],
  sections: [
    {
      title: '库仑定律说了什么？',
      html: `<p>1785 年，法国物理学家<b>库仑</b>用一台极其灵敏的“扭秤”测量了两个带电小球之间的力，总结出：</p>
      <ul><li>力的大小与两个电量的<b>乘积</b>成正比：一个电量加倍，力加倍；两个都加倍，力变 4 倍</li>
      <li>力的大小与距离的<b>平方</b>成反比：距离加倍，力变成 1/4；距离变成 1/10，力变成 100 倍</li>
      <li>力沿两个电荷的<b>连线</b>方向：同种电荷相互排斥，异种电荷相互吸引</li></ul>
      <p>拖动「距离 r」，看右侧 F–r 曲线：曲线上的白点是当前状态，虚线标出“距离加倍、力变 1/4”的位置。</p>`,
    },
    {
      title: '为什么是“平方”反比？',
      html: `<p>可以把电荷的影响想象成从电荷向四面八方均匀发出的“电场线”。距离为 r 的地方，这些线均匀分布在一个半径为 r 的球面上，球面面积是 4πr²。</p>
      <p>距离加倍，球面面积变成 4 倍，同样多的线被摊得更稀，每一小块面积上分到的只剩 1/4——所以力按 <b>1/r²</b> 减弱。光的亮度、声音的强度、万有引力也都遵守同样的平方反比规律，原因相同。</p>
      <div class="eq"><i>k</i> = <span class="frac"><span>1</span><span>4π<i>ε</i><sub>0</sub></span></span> ≈ 8.99×10<sup>9</sup> N·m²/C²</div>
      <p>其中 ε₀ = 8.85×10<sup>−12</sup> C²/(N·m²) 叫<b>真空介电常数</b>，公式里的 4π 正是来自球面面积。</p>`,
    },
    {
      title: '箭头为什么一样长？——牛顿第三定律',
      html: `<p>把 q₁ 调到 +5 μC、q₂ 调到 +0.5 μC：电量相差 10 倍，但两个箭头<b>依然一样长</b>。</p>
      <p>这不是巧合：q₁ 推 q₂ 的力和 q₂ 推 q₁ 的力是一对<b>作用力与反作用力</b>，大小永远相等、方向相反。公式里 q₁q₂ 是乘在一起的，交换两者，结果不变。</p>
      <p>那为什么生活中常说“大电荷把小电荷推开”？因为在自由运动时，<b>质量</b>小的那个加速度大、跑得快——力一样大，效果不一样。</p>
      <div class="tip">箭头长度默认按<b>对数比例</b>画（每长 0.75 格，力大 10 倍），否则力一变小箭头就短得看不见。切到「线性」比例，就能直观看到力随距离衰减得有多快。</div>`,
    },
    {
      title: '电力有多强？和万有引力比一比',
      html: `<p>1 库仑的电量其实非常大。两个各带 1 C 的点电荷相距 1 米，相互作用力约 <b>9×10<sup>9</sup> N</b>，相当于 90 万吨物体的重量！所以日常的静电现象中，电量通常只有微库（μC，10<sup>−6</sup> C）甚至纳库（nC，10<sup>−9</sup> C）。</p>
      <p>再比较氢原子里电子和质子之间的两种力：</p>
      <table><tr><th></th><th>公式</th><th>大小（r = 5.3×10<sup>−11</sup> m）</th></tr>
      <tr><td>静电引力</td><td>k e² / r²</td><td>≈ 8.2×10<sup>−8</sup> N</td></tr>
      <tr><td>万有引力</td><td>G m<sub>e</sub> m<sub>p</sub> / r²</td><td>≈ 3.6×10<sup>−47</sup> N</td></tr></table>
      <p>电力是引力的约 <b>2.3×10<sup>39</sup> 倍</b>！原子、分子、固体、化学反应、摩擦力、弹力……身边几乎一切“接触力”本质上都是电力。之所以宇宙尺度由引力主宰，是因为天体里正负电荷几乎完全抵消，而引力只有吸引、没有抵消。</p>`,
    },
    {
      title: '生活中的库仑力',
      html: `<ul><li><b>你不会掉穿地板</b>：脚底原子的电子云和地板原子的电子云相互排斥，这就是“支持力”的来源</li>
      <li><b>激光打印机 / 复印机</b>：硒鼓表面按图像带上静电，带异种电荷的墨粉被吸附上去，再转印到纸上</li>
      <li><b>静电除尘</b>：烟囱里让烟尘带电，再用带异种电荷的极板吸走，除尘效率可达 99%</li>
      <li><b>喷漆</b>：让漆雾带电、工件接地，漆滴被吸向工件，连背面都能喷到</li></ul>
      <div class="warn">常见误区：“电量大的一方受力更大”。不对！两个电荷受到的力永远一样大。另外，库仑定律只严格适用于<b>点电荷</b>（或均匀带电的球）；两个导体球离得很近时，电荷会在球面上重新分布，实际的力会偏离公式。</div>
      <p>有趣的事实：画面中半径 3.2 cm 的小球如果真带上几微库的电，表面电场会超过空气的击穿强度（约 3×10<sup>6</sup> V/m），立刻打出电火花——真实实验里能放的电量要小得多。</p>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.view([0, 2.4, 11.5], [0, 0.1, 0], 6.6);
    ctx.setBloom(0.6, 0.45, 0.8);
    scene.add(stageFloor({ y: -2.4 }));

    const Y0 = 0, RAIL_TOP = -1.25;
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2a31, roughness: 0.55, metalness: 0.5 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.35, metalness: 0.8 });
    const acrylic = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });

    // 轨道 + 刻度（每格 5 cm）
    const rail = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.1, 0.55), railMat);
    rail.position.y = RAIL_TOP - 0.05;
    scene.add(rail);
    for (const x of [-6.3, 6.3]) {
      const stop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.6), darkMat);
      stop.position.set(x, RAIL_TOP + 0.15, 0);
      scene.add(stop);
    }
    {
      const pos = [];
      for (let i = -12; i <= 12; i++) {
        const x = i * 0.5, h = i % 2 === 0 ? 0.2 : 0.1;
        pos.push(x, RAIL_TOP - 0.01, 0.28, x, RAIL_TOP - 0.01 - h, 0.28);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xd8d8e0, transparent: true, opacity: 0.6 })));
    }

    // 两个带电小球（装在绝缘支柱和小车上）
    function makeCart() {
      const g = new THREE.Group();
      const ball = chargeBall({ r: R_BALL * S });
      ball.position.y = Y0;
      const cartY = RAIL_TOP + 0.07;
      const postBot = cartY + 0.07, postTop = Y0 - R_BALL * S;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, postTop - postBot, 16), acrylic);
      post.position.y = (postTop + postBot) / 2;
      const cart = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.62), darkMat);
      cart.position.y = cartY;
      g.add(ball, post, cart);
      g.userData.ball = ball;
      return g;
    }
    const c1 = makeCart(), c2 = makeCart();
    scene.add(c1, c2);
    const arrowOpts = { radius: 0.045, headLength: 0.3, headRadius: 0.13, emissive: 0.35 };
    const a1 = new Arrow(FORCE_COLOR, arrowOpts), a2 = new Arrow(FORCE_COLOR, arrowOpts);
    scene.add(a1, a2);
    const spark = glowSprite(0xfff1c2, 1.5, 0);
    scene.add(spark);
    let sparkLife = 0;

    // 距离标注线
    const dim = new Polyline(6, { color: 0xd8d8e0, opacity: 0.8 });
    scene.add(dim.object);
    const DIM_Y = -0.62, DIM_Z = 0.4;
    function setDim(X1, X2) {
      const p = dim.pos;
      let k = 0;
      const put = (x, y) => { p[k++] = x; p[k++] = y; p[k++] = DIM_Z; };
      put(X1, DIM_Y + 0.1); put(X1, DIM_Y - 0.1); put(X1, DIM_Y);
      put(X2, DIM_Y); put(X2, DIM_Y + 0.1); put(X2, DIM_Y - 0.1);
      dim.geo.setDrawRange(0, 6);
      dim.geo.attributes.position.needsUpdate = true;
    }

    const lbQ1 = ctx.label('', { cls: 'small' });
    const lbQ2 = ctx.label('', { cls: 'small' });
    const lbF = ctx.label('', { cls: 'small' });
    const lbR = ctx.label('', { cls: 'small dim' });
    const lbRail = ctx.label('绝缘支柱 + 小车（可沿轨道滑动）', { cls: 'small dim' });
    lbRail.position.set(0, RAIL_TOP - 0.55, 0.4);
    lbQ1.center.set(1, 0.5); // q₁ 的标签向左展开、q₂ 的向右展开，两球很近时也不重叠
    lbQ2.center.set(0, 0.5);
    scene.add(lbQ1, lbQ2, lbF, lbR, lbRail);

    /* ---------- 状态 ---------- */
    let q1 = 3, q2 = -2, rSet = 0.4, rHome = 0.4, free = false, scaleMode = 'log';
    let x1 = -rSet / 2, x2 = rSet / 2, v1 = 0, v2 = 0;

    const fmtQ = (v) => `${signed(v, 1)} μC`;
    const sQ1 = ui.slider({ label: '小球 1 的电量 q₁', min: -5, max: 5, step: 0.1, value: q1, format: fmtQ, onInput: (v) => { q1 = v; refresh(); } });
    const sQ2 = ui.slider({ label: '小球 2 的电量 q₂', min: -5, max: 5, step: 0.1, value: q2, format: fmtQ, onInput: (v) => { q2 = v; refresh(); } });
    const sR = ui.slider({
      label: '两球心距离 r', min: 0.1, max: 1.0, step: 0.01, value: rSet, unit: 'm', digits: 2,
      onInput: (v) => { rSet = rHome = v; if (free) { x1 = -v / 2; x2 = v / 2; v1 = v2 = 0; } refresh(); },
    });
    ui.segmented({
      label: '箭头长度比例',
      options: [{ value: 'log', label: '对数' }, { value: 'lin', label: '线性' }],
      value: scaleMode,
      onChange: (v) => { scaleMode = v; refresh(); },
    });
    ui.toggle({
      label: '自由运动（松开小球）', value: false,
      onChange: (v) => { free = v; v1 = v2 = 0; if (v) rHome = rSet; refresh(); },
    });
    ui.buttons([
      { label: '放回原位', onClick: () => { rSet = rHome; sR.set(rHome); x1 = -rHome / 2; x2 = rHome / 2; v1 = v2 = 0; refresh(); } },
      { label: '交换电量', onClick: () => { const t = q1; q1 = q2; q2 = t; sQ1.set(q1); sQ2.set(q2); refresh(); } },
    ]);
    const note = ui.note('');
    const read = ui.readouts([
      { key: 'F', label: '库仑力 F', unit: 'N' },
      { key: 'kind', label: '相互作用', unit: '' },
      { key: 'w', label: '相当于物体重量', unit: 'g' },
      { key: 'ratio', label: '是两球万有引力的', unit: '倍' },
    ]);
    const plot = ui.plot({
      title: 'F – r 曲线（平方反比）',
      height: 160, xMin: 0.1, xMax: 1.0, yMin: 0, yMax: 1,
      xLabel: '距离 r (m)', yLabel: '力 F (N)',
      series: [{ label: 'F = k|q₁q₂|/r²', color: '#ff7ad9' }],
      draw(p) {
        const qq = Math.abs(q1 * q2) * 1e-12;
        const r = Math.max(0.1, x2 - x1);
        if (qq === 0) { p.text(0.55, 0.5, '有一个电量为 0，没有库仑力', 'rgba(255,255,255,.6)', 'center'); return; }
        p.fn((x) => (K * qq) / (x * x), '#ff7ad9', 2.2, 160);
        const F = (K * qq) / (r * r);
        p.vline(r);
        p.dot(r, F, '#ffffff', 5);
        if (2 * r <= 1.0) {
          p.dot(2 * r, F / 4, 'rgba(255,255,255,.6)', 4);
          p.line([[r, F], [2 * r, F], [2 * r, F / 4]], 'rgba(255,255,255,.35)', 1, [4, 4]);
          p.text(2 * r + 0.02, F / 4 + plot.opts.yMax * 0.06, '2r → F/4', 'rgba(255,255,255,.75)');
        }
      },
    });
    let plotR = -1, plotKey = '';

    function arrowLen(F) {
      if (F <= 0) return 0;
      if (scaleMode === 'log') return clamp(0.35 + 0.75 * (Math.log10(F) + 3), 0.3, 3.8);
      return (3.8 * F) / FMAX;
    }

    let lastNote = '';
    function refresh() {
      const r = Math.max(x2 - x1, 1e-3);
      const qq = q1 * q2 * 1e-12;
      const F = (K * Math.abs(qq)) / (r * r);
      c1.userData.ball.userData.setQ(q1, 5);
      c2.userData.ball.userData.setQ(q2, 5);
      read.set('F', F, sci(F, 2));
      read.set('kind', 0, qq > 0 ? '排斥' : qq < 0 ? '吸引' : '无');
      const m = F / 9.8;
      if (m >= 1) { read.unit('w', 'kg'); read.set('w', m, sci(m, 2)); } else { read.unit('w', 'g'); read.set('w', m, sci(m * 1000, 2)); }
      const ratio = (K * Math.abs(qq)) / (G * MASS * MASS);
      read.set('ratio', ratio, qq ? sci(ratio, 1) : '—');
      setLabel(lbQ1, `q₁ = ${fmtQ(q1)}`, 'small ' + (q1 > 0 ? 'red' : q1 < 0 ? 'blue' : 'dim'));
      setLabel(lbQ2, `q₂ = ${fmtQ(q2)}`, 'small ' + (q2 > 0 ? 'red' : q2 < 0 ? 'blue' : 'dim'));
      setLabel(lbF, qq ? `F = ${sci(F, 2)} N（${qq > 0 ? '同种电荷 · 排斥' : '异种电荷 · 吸引'}）` : 'F = 0（有一个小球不带电）');
      setLabel(lbR, `r = ${r.toFixed(2)} m`);
      const pk = `${q1}|${q2}`;
      if (pk !== plotKey || Math.abs(r - plotR) > 0.004) {
        plotKey = pk;
        plotR = r;
        plot.opts.yMax = qq ? ((K * Math.abs(qq)) / 0.04) * 1.05 : 1; // 纵轴上限取 r = 0.2 m 处的力，更近时曲线冲出图框
        plot.redraw();
      }
      let h;
      if (free) h = `小球可以自由滑动（每个 ${MASS * 1000} g，画面慢放 ${Math.round(1 / SLOW)} 倍）。${qq < 0 ? '异种电荷相互吸引，越靠近力越大，会越跑越快直到相撞——相撞时两个导体球<b>平分</b>总电荷。' : qq > 0 ? '同种电荷相互排斥，被推开后距离变大、力迅速变小。' : '没有电力，小球不会动。'}`;
      else if (!qq) h = '有一个小球电量为 0，两球之间<b>没有</b>静电力。';
      else h = `两个箭头<b>一样长</b>：q₁ 对 q₂ 的力与 q₂ 对 q₁ 的力大小相等、方向相反（牛顿第三定律）。${scaleMode === 'log' ? '箭头按<b>对数</b>比例画：每长 0.75 格，力大 10 倍。' : '箭头按<b>线性</b>比例画：距离一拉开，箭头就短得几乎看不见。'}`;
      if (h !== lastNote) { lastNote = h; note.set(h); }
    }

    function touch() {
      // 两个导体小球相碰：总电荷守恒，平分（取 0.1 μC 精度）
      if (Math.abs(q1 - q2) > 0.05) {
        const total = Math.round((q1 + q2) * 10) / 10;
        q1 = Math.round((total / 2) * 10) / 10;
        q2 = Math.round((total - q1) * 10) / 10;
        sQ1.set(q1);
        sQ2.set(q2);
        spark.position.set(((x1 + x2) / 2) * S, Y0, 0.2);
        sparkLife = 1;
      }
    }

    refresh();

    const o1 = new THREE.Vector3(), o2 = new THREE.Vector3(), vec = new THREE.Vector3();
    return {
      update(dt) {
        if (free) {
          const SUB = 12;
          const h = (dt * SLOW) / SUB;
          for (let s = 0; s < SUB; s++) {
            const r = Math.max(x2 - x1, 1e-3);
            const F = (K * q1 * q2 * 1e-12) / (r * r); // > 0 排斥：推 2 向 +x、推 1 向 −x
            v1 += (-F / MASS - 1.5 * v1) * h;
            v2 += (F / MASS - 1.5 * v2) * h;
            v1 = clamp(v1, -2.5, 2.5);
            v2 = clamp(v2, -2.5, 2.5);
            x1 += v1 * h;
            x2 += v2 * h;
            if (x1 < -XW) { x1 = -XW; v1 = Math.abs(v1) * 0.4; }
            if (x2 > XW) { x2 = XW; v2 = -Math.abs(v2) * 0.4; }
            if (x2 - x1 < 2 * R_BALL) {
              const over = 2 * R_BALL - (x2 - x1);
              x1 -= over / 2;
              x2 += over / 2;
              if (v1 > v2) {
                const vm = (v1 + v2) / 2, dv = (v1 - v2) / 2;
                v1 = vm - 0.5 * dv;
                v2 = vm + 0.5 * dv;
              }
              touch();
            }
          }
          const r = x2 - x1;
          rSet = clamp(r, 0.1, 1.0);
          if (Math.abs(rSet - sR.value) > 0.005) sR.set(Math.round(rSet * 100) / 100);
          refresh();
        } else if (Math.abs(x1 + rSet / 2) > 1e-4 || Math.abs(x2 - rSet / 2) > 1e-4) {
          x1 = damp(x1, -rSet / 2, 8, dt);
          x2 = damp(x2, rSet / 2, 8, dt);
          refresh();
        }
        c1.position.x = x1 * S;
        c2.position.x = x2 * S;

        const r = Math.max(x2 - x1, 1e-3);
        const qq = q1 * q2;
        const F = (K * Math.abs(qq) * 1e-12) / (r * r);
        const L = arrowLen(F);
        const dir1 = qq > 0 ? -1 : 1; // 小球 1 受力方向
        // 两支箭头上下错开一点，吸引时（箭头相向）也能分清各自的箭头
        o1.set(x1 * S, Y0 + 0.62, 0);
        o2.set(x2 * S, Y0 + 0.86, 0);
        a1.set(o1, vec.set(dir1 * L, 0, 0));
        a2.set(o2, vec.set(-dir1 * L, 0, 0));
        lbQ1.position.set(x1 * S + 0.3, Y0 + 1.3, 0);
        lbQ2.position.set(x2 * S - 0.3, Y0 + 1.3, 0);
        lbF.position.set(((x1 + x2) / 2) * S, Y0 + 1.9, 0);
        lbR.position.set(((x1 + x2) / 2) * S, DIM_Y - 0.28, DIM_Z);
        setDim(x1 * S, x2 * S);
        if (sparkLife > 0) {
          sparkLife = Math.max(0, sparkLife - dt * 2.5);
          spark.material.opacity = sparkLife;
          spark.scale.setScalar(0.8 + (1 - sparkLife) * 2);
        }
      },
    };
  },
};
