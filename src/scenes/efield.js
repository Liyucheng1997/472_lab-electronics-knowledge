import * as THREE from 'three';
import { COLOR, CSSCOLOR, Arrow, fieldAt, traceFieldLines, fieldLinesObject, particle, textSprite, disposeTree, clamp, V } from '../lib/kit.js';
import { chargeBall, Dragger, Trail, sci, signed, viewFit } from '../lib/basics-kit.js';

// 画面单位：1 格 = 1 cm，电荷单位 nC。E(N/C) = KE × Σ q / r²（q 以 nC、r 以 cm 计）
const KE = 8.99e4;
const EPS0 = 8.854e-12;
const PX = 2.5; // 平行板位于 x = ±2.5 cm（板间距 5 cm）
const PH = 3; // 平行板边长 6 cm
const NP = 13; // 每块板离散成 13×13 个点电荷来计算电场

export default {
  id: 'efield',
  group: 'basics',
  title: '电场与电场线',
  subtitle: 'E = F / q',
  summary: '电荷在周围空间产生电场，用电场线就能“看见”它：线密处场强大，箭头指向正电荷受力方向。',
  lead: '电荷不用接触就能推拉别的电荷，靠的是它在周围空间建立的电场。黄色的电场线画出了电场的方向和强弱；红色的小“试探电荷”会被电场推着走，它身上的黄箭头就是该处的场强 E。可以用鼠标拖动试探电荷去“探测”各处的电场。',
  formulas: [
    { expr: '<i>E</i> = <span class="frac"><span><i>F</i></span><span><i>q</i></span></span>', desc: '电场强度 E（N/C，也写作 V/m）= 试探电荷受到的电场力 F（N）÷ 试探电荷的电量 q（C）。方向与正电荷受力方向相同。' },
    { expr: '<i>E</i> = <i>k</i><span class="frac"><span><i>Q</i></span><span><i>r</i><sup>2</sup></span></span>', desc: '点电荷 Q 在距离 r 处产生的场强，k = 8.99×10<sup>9</sup> N·m²/C²。多个电荷的电场按矢量相加（叠加原理）。' },
    { expr: '<i>E</i> = <span class="frac"><span><i>U</i></span><span><i>d</i></span></span> = <span class="frac"><span><i>σ</i></span><span><i>ε</i><sub>0</sub></span></span>', desc: '平行板之间的匀强电场：U 为两板电压（V），d 为板间距（m）；σ 为极板上每平方米的电量，ε₀ = 8.85×10<sup>−12</sup> C²/(N·m²)。' },
  ],
  sections: [
    {
      title: '什么是电场？',
      html: `<p>两个电荷隔着空气、甚至隔着真空也能相互推拉。物理学家法拉第提出：每个电荷都会改变它周围的空间，在空间中建立一种看不见的东西——<b>电场</b>。别的电荷进入电场，就会受到力。</p>
      <p>电场是真实存在的物质形态，它携带能量，变化的电场还能以光速传播（这就是电磁波）。</p>
      <p>怎样描述某一点电场的强弱？放一个很小的正电荷 q（叫<b>试探电荷</b>）到那里，测它受到的力 F，比值 <b>E = F / q</b> 就是<b>电场强度</b>。E 与试探电荷本身无关，只取决于产生电场的电荷和位置。画面里红色小球就是试探电荷（q₀ = +1 nC），黄箭头是该处的 E。</p>`,
    },
    {
      title: '电场线的规则',
      html: `<p>电场线是法拉第发明的“画图法”，它们不是真实存在的线，但能一眼看出电场的样子：</p>
      <ol><li>线上每一点的<b>切线方向</b>就是该点的场强方向</li>
      <li>电场线从<b>正电荷出发</b>，终止于<b>负电荷</b>（或延伸到无穷远）</li>
      <li>电场线越<b>密</b>，场强越<b>大</b>——拖动「电荷量」滑块，线的条数随电量增减</li>
      <li>任意两条电场线<b>不会相交</b>：每一点的电场只有一个方向</li>
      <li>静电场的电场线<b>不闭合</b></li></ol>
      <p>切换四种电荷分布对比：等量异号电荷的线从正电荷“流”向负电荷；等量同号电荷的线互相“躲开”，中点处场强为零。</p>`,
    },
    {
      title: '点电荷的场强：E = kQ / r²',
      html: `<p>由库仑定律，点电荷 Q 对距离 r 处的试探电荷 q 的力是 F = kQq/r²，所以</p>
      <div class="eq"><i>E</i> = <i>F</i>/<i>q</i> = <i>kQ</i>/<i>r</i><sup>2</sup></div>
      <p>例如 Q = 2 nC，在 r = 3 cm 处：E = 8.99×10<sup>9</sup> × 2×10<sup>−9</sup> ÷ 0.03² ≈ 2.0×10<sup>4</sup> N/C。拖动试探电荷，看读数随距离的变化：距离加倍，场强变为 1/4。</p>
      <p>多个电荷同时存在时，某点的总场强等于每个电荷单独产生的场强的<b>矢量和</b>——这叫<b>叠加原理</b>。偶极子周围复杂的弯曲电场线，就是两个简单电场叠加的结果。</p>`,
    },
    {
      title: '匀强电场：平行板之间',
      html: `<p>两块平行的金属板分别带等量的正、负电荷，板间的电场线几乎是<b>等距的平行直线</b>：各处场强大小、方向都相同，叫<b>匀强电场</b>。切换到「平行板」，把试探电荷拖到板间各处，场强读数几乎不变；只有在板的边缘，电场线向外弯曲（<b>边缘效应</b>）。</p>
      <div class="eq"><i>E</i> = <i>U</i> / <i>d</i></div>
      <p>两板电压 U 越大、距离 d 越小，场强越大。这也是场强单位 <b>V/m</b> 的来历：1 N/C = 1 V/m。</p>
      <p>匀强电场的应用：示波管和老式电视显像管用它偏转电子束；电容器靠它储存能量；喷墨打印机用它控制带电墨滴的落点。</p>`,
    },
    {
      title: '身边的电场有多强？',
      html: `<table><tr><th>场景</th><th>场强 E（N/C）</th></tr>
      <tr><td>晴天地面附近的大气电场</td><td>约 100~150</td></tr>
      <tr><td>雷雨云下方</td><td>约 10<sup>4</sup>~10<sup>5</sup></td></tr>
      <tr><td>空气被击穿、产生电火花</td><td>约 3×10<sup>6</sup></td></tr>
      <tr><td>细胞膜内（约 70 mV / 7 nm）</td><td>约 10<sup>7</sup></td></tr>
      <tr><td>氢原子中电子所在处</td><td>约 5×10<sup>11</sup></td></tr></table>
      <div class="warn">常见误区：“试探电荷会沿着电场线运动”。电场线表示的是<b>受力</b>方向，不是运动轨迹。真实的电荷会加速，有了速度后轨迹往往偏离电场线（就像抛出的石头不沿重力方向走）。画面里为了看清电场方向，让试探电荷像在很黏的液体里那样慢慢“漂”，所以恰好沿着电场线走。</div>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.setBloom(0.55, 0.4, 0.82);

    let preset = 'point', Q = 2, dimMode = '2d', auto = true, showGrid = false;
    let charges = [];

    // 2D 模式的背景网格（xy 平面）
    const backGrid = new THREE.GridHelper(18, 18, 0x2c2c36, 0x202028);
    backGrid.rotation.x = Math.PI / 2;
    backGrid.position.z = -0.05;
    backGrid.material.transparent = true;
    backGrid.material.opacity = 0.6;
    scene.add(backGrid);

    const chargeGroup = new THREE.Group();
    const linesGroup = new THREE.Group();
    scene.add(chargeGroup, linesGroup);

    // 场强矢量网格（InstancedMesh，切换分布时重新计算）
    const GX = 15, GY = 9;
    const coneGeo = new THREE.ConeGeometry(0.075, 1, 8);
    coneGeo.translate(0, 0.5, 0);
    const gridMesh = new THREE.InstancedMesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }), GX * GY);
    gridMesh.frustumCulled = false;
    gridMesh.visible = false;
    scene.add(gridMesh);

    // 试探电荷
    const tc = particle('proton', { r: 0.17, sign: true });
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    tc.add(hit);
    tc.position.set(0, 2, 0);
    scene.add(tc);
    const eArrow = new Arrow(COLOR.efield, { radius: 0.04, headLength: 0.24, headRadius: 0.1, emissive: 0.4 });
    scene.add(eArrow);
    const trail = new Trail(140, { color: COLOR.proton, opacity: 0.45 });
    scene.add(trail.object);
    const lbTC = ctx.label('试探电荷 +q₀', { cls: 'small red' });
    const lbE = ctx.label('E', { cls: 'small yellow' });
    scene.add(lbTC, lbE);

    let chargeLabels = [];
    let ESCALE = 1; // 平行板：把离散模型的场强校准到理想公式 σ/ε₀

    function buildCharges() {
      disposeTree(chargeGroup);
      chargeGroup.clear();
      chargeLabels = [];
      charges = [];
      ESCALE = 1;
      if (preset === 'point') charges = [{ pos: V(0, 0, 0), q: Q }];
      else if (preset === 'dipole') charges = [{ pos: V(-PX, 0, 0), q: Q }, { pos: V(PX, 0, 0), q: -Q }];
      else if (preset === 'same') charges = [{ pos: V(-PX, 0, 0), q: Q }, { pos: V(PX, 0, 0), q: Q }];
      else {
        const dq = Q / (NP * NP);
        for (let i = 0; i < NP; i++) for (let j = 0; j < NP; j++) {
          const y = -PH + ((i + 0.5) * 2 * PH) / NP, z = -PH + ((j + 0.5) * 2 * PH) / NP;
          charges.push({ pos: V(-PX, y, z), q: dq }, { pos: V(PX, y, z), q: -dq });
        }
        if (Q !== 0) {
          const center = fieldAt(charges, V(0, 0, 0)).length();
          const ideal = (Math.abs(Q) * 1e-9) / (2 * PH * 0.01) ** 2 / EPS0;
          ESCALE = ideal / (KE * center);
        }
      }
      if (preset !== 'plates') {
        for (const c of charges) {
          const b = chargeBall({ r: 0.38 });
          b.userData.setQ(c.q, 4);
          b.position.copy(c.pos);
          chargeGroup.add(b);
          const l = ctx.label(`${signed(c.q, 1)} nC`, { cls: 'small ' + (c.q > 0 ? 'red' : c.q < 0 ? 'blue' : 'dim') });
          l.position.copy(c.pos).add(V(0, -0.75, 0));
          chargeGroup.add(l);
          chargeLabels.push(l);
        }
      } else {
        [-1, 1].forEach((side) => {
          const q = side < 0 ? Q : -Q;
          const col = q > 0 ? COLOR.proton : q < 0 ? COLOR.electron : 0x8a8a96;
          const plate = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, PH * 2, PH * 2),
            new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.25, roughness: 0.4, metalness: 0.4, transparent: true, opacity: 0.45, depthWrite: false })
          );
          plate.position.set(side * PX, 0, 0);
          chargeGroup.add(plate);
          if (q !== 0) {
            for (let k = 0; k < 7; k++) {
              const s = textSprite(q > 0 ? '+' : '−', { size: 0.42, color: q > 0 ? '#ff8a80' : '#8fc3ff', depthTest: false });
              s.position.set(side * PX, -PH + 0.45 + (k * (2 * PH - 0.9)) / 6, 0);
              s.renderOrder = 5;
              chargeGroup.add(s);
            }
          }
          const l = ctx.label(`${q > 0 ? '正' : q < 0 ? '负' : ''}极板 ${signed(q, 1)} nC`, { cls: 'small ' + (q > 0 ? 'red' : q < 0 ? 'blue' : 'dim') });
          l.position.set(side * PX, PH + 0.45, 0);
          chargeGroup.add(l);
        });
      }
    }

    function tracePlates() {
      const sg = Q > 0 ? 1 : -1;
      const xs = -sg * PX + sg * 0.35, xEnd = sg * PX;
      const starts = [];
      if (dimMode === '2d') {
        const n = Math.max(3, Math.round(3 * Math.abs(Q)) + 1);
        for (let i = 0; i < n; i++) starts.push(V(xs, -PH * 0.94 + (2 * PH * 0.94 * i) / (n - 1), 0));
      } else {
        const n = Math.max(3, Math.round(2 + Math.abs(Q)));
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          starts.push(V(xs, -PH * 0.9 + (2 * PH * 0.9 * i) / (n - 1), -PH * 0.9 + (2 * PH * 0.9 * j) / (n - 1)));
        }
      }
      const E = V(), mid = V(), lines = [];
      for (const s of starts) {
        const p = s.clone(), line = [p.clone()];
        for (let k = 0; k < 400; k++) {
          fieldAt(charges, p, E);
          const L = E.length();
          if (L < 1e-7) break;
          mid.copy(p).addScaledVector(E, 0.04 / L);
          fieldAt(charges, mid, E);
          const L2 = E.length();
          if (L2 < 1e-7) break;
          p.addScaledVector(E, 0.08 / L2);
          line.push(p.clone());
          if (sg * (p.x - xEnd) > -0.12 && Math.abs(p.y) < PH + 0.1 && Math.abs(p.z) < PH + 0.1) break;
          if (p.length() > 11) break;
        }
        if (line.length > 2) lines.push(line);
      }
      return lines;
    }

    function buildLines() {
      disposeTree(linesGroup);
      linesGroup.clear();
      if (Q === 0) return;
      let lines, reverse = false;
      if (preset === 'plates') lines = tracePlates();
      else {
        lines = traceFieldLines(charges, { perCharge: dimMode === '2d' ? 6 : 10, plane: dimMode === '2d' ? 'xy' : null, bound: 12, startR: 0.42, step: 0.05 });
        reverse = !charges.some((c) => c.q > 0);
      }
      linesGroup.add(fieldLinesObject(lines, { color: COLOR.efield, opacity: dimMode === '2d' ? 0.9 : 0.65, arrows: dimMode === '2d' ? 2 : 1, arrowSize: 0.22, reverse }));
    }

    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color(), UP = V(0, 1, 0);
    const _E = V(), _p = V(), _d = V();
    function buildGrid() {
      let k = 0;
      for (let i = 0; i < GX; i++) for (let j = 0; j < GY; j++) {
        _p.set(-7 + i, -4 + j, 0);
        fieldAt(charges, _p, _E);
        const mag = _E.length();
        let hide = Q === 0 || mag < 1e-6;
        if (preset === 'plates') { if (Math.abs(Math.abs(_p.x) - PX) < 0.3 && Math.abs(_p.y) <= PH + 0.1) hide = true; }
        else for (const c of charges) if (_p.distanceTo(c.pos) < 0.6) hide = true;
        if (hide) { _m.makeScale(0, 0, 0); gridMesh.setMatrixAt(k, _m); gridMesh.setColorAt(k, _c.setHex(0)); k++; continue; }
        const lg = Math.log10(mag * ESCALE);
        const L = clamp(0.28 + 0.2 * (lg + 2), 0.14, 0.85);
        _d.copy(_E).divideScalar(mag);
        _q.setFromUnitVectors(UP, _d);
        _s.set(1, L, 1);
        _p.addScaledVector(_d, -L / 2);
        _m.compose(_p, _q, _s);
        gridMesh.setMatrixAt(k, _m);
        const t = clamp((lg + 2) / 3, 0, 1);
        gridMesh.setColorAt(k, _c.setHSL(0.13, 1, 0.22 + 0.42 * t));
        k++;
      }
      gridMesh.instanceMatrix.needsUpdate = true;
      if (gridMesh.instanceColor) gridMesh.instanceColor.needsUpdate = true;
    }

    function rebuild() {
      buildCharges();
      buildLines();
      buildGrid();
      spawn();
    }

    /* ---------- 试探电荷 ---------- */
    let age = 0, trailT = 0, dragging = false;
    function spawn() {
      age = 0;
      trail.reset();
      const pos = charges.filter((c) => c.q > 0);
      if (Q === 0) tc.position.set(1.5, 2, 0);
      else if (preset === 'plates') {
        const sg = Q > 0 ? 1 : -1;
        tc.position.set(-sg * (PX - 0.45), (Math.random() * 2 - 1) * (PH - 0.6), 0);
      } else if (pos.length) {
        const c = pos[Math.floor(Math.random() * pos.length)];
        const a = Math.random() * Math.PI * 2;
        tc.position.set(c.pos.x + Math.cos(a) * 0.6, c.pos.y + Math.sin(a) * 0.6, 0);
      } else {
        const a = Math.random() * Math.PI * 2;
        tc.position.set(Math.cos(a) * 6.8, Math.sin(a) * 4.3, 0);
      }
    }
    const dragPlane = new THREE.Plane(V(0, 0, 1), 0), _hit = V();
    const dragger = new Dragger(ctx, {
      targets: [tc],
      pick: (ray) => (ray.ray.intersectPlane(dragPlane, _hit) ? _hit : null),
      onStart: () => { dragging = true; trail.reset(); },
      onDrag: (o, p) => { tc.position.set(clamp(p.x, -8, 8), clamp(p.y, -5, 5), 0); },
      onEnd: () => { dragging = false; age = 0; },
    });

    /* ---------- 面板 ---------- */
    ui.segmented({
      label: '电荷分布',
      options: [{ value: 'point', label: '点电荷' }, { value: 'dipole', label: '异号对' }, { value: 'same', label: '同号对' }, { value: 'plates', label: '平行板' }],
      value: preset,
      onChange: (v) => { preset = v; rebuild(); lastNote = ''; },
    });
    ui.slider({
      label: '电荷量 Q（负值 = 负电荷）', min: -4, max: 4, step: 0.5, value: Q, format: (v) => `${signed(v, 1)} nC`,
      onInput: (v) => { Q = v; rebuild(); },
    });
    ui.segmented({
      label: '电场线',
      options: [{ value: '2d', label: '平面截面' }, { value: '3d', label: '立体' }],
      value: dimMode,
      onChange: (v) => { dimMode = v; buildLines(); setView(); },
    });
    ui.toggle({ label: '试探电荷顺着电场“漂”', value: auto, onChange: (v) => { auto = v; age = 0; } });
    ui.toggle({ label: '显示场强矢量网格', value: showGrid, onChange: (v) => { showGrid = v; gridMesh.visible = v; } });
    ui.button({ label: '重新放置试探电荷', onClick: () => spawn() });
    const note = ui.note('');
    const read = ui.readouts([
      { key: 'E', label: '试探电荷处场强 E', unit: 'N/C' },
      { key: 'F', label: '它受的力 F = q₀E', unit: 'N' },
      { key: 'r', label: '离最近的点电荷', unit: 'cm' },
    ]);
    ui.legend([
      { color: CSSCOLOR.proton, label: '正电荷 / 试探电荷 q₀ = +1 nC' },
      { color: CSSCOLOR.electron, label: '负电荷' },
      { color: CSSCOLOR.efield, label: '电场线、场强 E' },
    ]);

    function setView() {
      if (dimMode === '2d') viewFit(ctx, [0, 0, 15.5], [0, 0, 0], 8);
      else viewFit(ctx, [7.5, 5.5, 11.5], [0, 0, 0], 7.5);
      backGrid.visible = dimMode === '2d';
    }

    let lastNote = '', infoT = 0;
    function updateInfo() {
      fieldAt(charges, tc.position, _E);
      const Erel = _E.length() * ESCALE;
      const E = KE * Erel;
      read.set('E', E, sci(E, 2));
      read.set('F', E * 1e-9, sci(E * 1e-9, 2));
      let h;
      if (preset === 'plates') {
        read.set('r', 0, '—');
        const ideal = Q ? (Math.abs(Q) * 1e-9) / (2 * PH * 0.01) ** 2 / EPS0 : 0;
        const U = ideal * 2 * PX * 0.01;
        h = Q === 0 ? '极板不带电，板间没有电场。' : `两板之间是<b>匀强电场</b>：电场线是等距的平行直线，场强处处约为 <b>${sci(ideal, 2)} N/C</b>（拖动试探电荷到板间各处，读数几乎不变）。板间距 d = 5 cm，所以两板电压 U = Ed ≈ <b>${sci(U, 2)} V</b>。板的边缘电场线向外弯曲。`;
      } else {
        let best = null, bd = Infinity;
        for (const c of charges) { const d = c.pos.distanceTo(tc.position); if (d < bd) { bd = d; best = c; } }
        read.set('r', bd, bd.toFixed(1));
        if (Q === 0) h = '电荷量为 0：没有电场，试探电荷不受力。';
        else if (preset === 'point') {
          const Ep = (8.99e9 * Math.abs(Q) * 1e-9) / (bd * 0.01) ** 2;
          h = `试探电荷离点电荷 r = ${bd.toFixed(1)} cm：<br>E = kQ/r² = 8.99×10⁹ × ${Math.abs(Q)}×10⁻⁹ ÷ (${(bd * 0.01).toFixed(3)} m)² ≈ <b>${sci(Ep, 2)} N/C</b>。<br>${Q > 0 ? '正电荷的电场线向外发散，试探电荷被推开。' : '负电荷的电场线向内汇聚，试探电荷被吸过去。'}距离加倍，场强变为 1/4。`;
        } else if (preset === 'dipole') h = '等量异号电荷（<b>电偶极子</b>）：电场线从正电荷出发、弯曲着落到负电荷上。每一点的场强都是两个电荷各自电场的<b>矢量和</b>。';
        else h = `等量同号电荷：两束电场线互相“排斥”、向两侧弯开，<b>中点处场强为零</b>（两个电荷的电场在那里大小相等、方向相反）。试着把试探电荷拖到正中间。`;
      }
      if (h !== lastNote) { lastNote = h; note.set(h); }
    }

    rebuild();
    setView();
    updateInfo();

    const E = V(), tip = V();
    return {
      update(dt) {
        fieldAt(charges, tc.position, E);
        const mag = E.length();
        if (!dragging && auto && Q !== 0) {
          age += dt;
          if (mag > 1e-7) {
            const sp = clamp(1.3 * Math.sqrt(mag * ESCALE), 0.35, 3.2);
            tc.position.addScaledVector(E, (sp * dt) / mag);
          }
          trailT += dt;
          if (trailT > 0.04) { trailT = 0; trail.push(tc.position); }
          const p = tc.position;
          let dead = age > 14 || Math.abs(p.x) > 8.8 || Math.abs(p.y) > 5.6 || (mag * ESCALE < 0.004 && age > 2);
          if (preset === 'plates') {
            const sg = Q > 0 ? 1 : -1;
            if (sg * (p.x - sg * PX) > -0.3 && Math.abs(p.y) < PH) dead = true;
          } else for (const c of charges) if (c.q < 0 && p.distanceTo(c.pos) < 0.45) dead = true;
          if (dead) spawn();
        }
        // 场强箭头：长度按对数比例
        if (mag > 1e-7 && Q !== 0) {
          const L = clamp(0.45 + 0.5 * (Math.log10(mag * ESCALE) + 2), 0.3, 2.3);
          E.multiplyScalar(L / mag);
          eArrow.set(tc.position, E);
          tip.copy(tc.position).add(E).addScaledVector(E, 0.25 / L);
          lbE.position.copy(tip);
          lbE.visible = true;
        } else {
          eArrow.set(tc.position, E.set(0, 0, 0));
          lbE.visible = false;
        }
        lbTC.position.copy(tc.position);
        lbTC.position.y -= 0.5;
        infoT += dt;
        if (infoT > 0.12 || dragging) { infoT = 0; updateInfo(); }
      },
      dispose() {
        dragger.dispose();
      },
    };
  },
};
