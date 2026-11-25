import * as THREE from 'three';
import { COLOR, CSSCOLOR, ParticleCloud, Arrow, particle, textSprite, textTexture } from '../lib/kit.js';
import { Trail, sci, signed } from '../lib/basics-kit.js';

// 真实参数：1 m 长、截面 1 mm² 的铜导线
const N_CU = 8.5e28; // 铜的自由电子密度（个/m³）
const QE = 1.602e-19; // 元电荷（C）
const S_AREA = 1e-6; // 截面积 1 mm²
const RHO = 1.72e-8; // 铜的电阻率（Ω·m）
const LEN = 1; // 导线长 1 m
const R_WIRE = (RHO * LEN) / S_AREA; // ≈ 0.0172 Ω
const U_MAX = 0.2;
const I_MAX = U_MAX / R_WIRE; // ≈ 11.6 A
const V_FERMI = 1.57e6; // 铜中电子的费米速度（m/s），电子“乱跑”的典型速度
const V_SIGNAL = 2e8; // 电信号（电场）沿导线传播的速度，约光速的 2/3

// 画面参数（夸张）
const HL = 6, RW = 1.6, RIN = RW - 0.14;
const NE = 260;
const VTH = 2.6; // 画面中的热运动速度
const VD_MAX = 1.5; // 画面中最大漂移速度
const COLL = 2.6; // 每秒与晶格“碰撞”的次数
const F_AC = 0.35; // 画面中交流电的频率（真实为 50 Hz）

export default {
  id: 'current',
  group: 'circuit',
  title: '电流',
  subtitle: 'I = Q / t',
  summary: '电流就是电荷的定向移动。导线里的电子一边疯狂乱跑，一边像蜗牛一样慢慢“漂”。',
  lead: '把一段铜导线放大到原子尺度：灰色的铜离子排成晶格，蓝色的自由电子在其中高速乱窜。给导线加上电压，电子在乱跑的同时整体向一个方向缓慢漂移，通过截面的电荷就形成了电流。',
  formulas: [
    { expr: '<i>I</i> = <span class="frac"><span><i>Q</i></span><span><i>t</i></span></span>', desc: '电流 I（安培 A）= 时间 t（秒 s）内通过导体某一截面的电荷量 Q（库仑 C）。1 A = 1 C/s ≈ 每秒 6.24×10<sup>18</sup> 个电子。' },
    { expr: '<i>I</i> = <i>n q v S</i>', desc: 'n：每立方米中的自由电子数（铜约 8.5×10<sup>28</sup>）；q：每个电子的电量 1.6×10<sup>−19</sup> C；v：电子的平均漂移速度（m/s）；S：导线横截面积（m²）。' },
  ],
  sections: [
    {
      title: '电流是什么？',
      html: `<p><b>电荷的定向移动形成电流</b>。在金属导线里移动的是自由电子；在电池的电解液、人体里移动的是正负离子。</p>
      <p>电流的大小用<b>单位时间内通过某一横截面的电荷量</b>来衡量：I = Q / t。画面中间青色的圆盘就是一个横截面，它统计每秒净穿过多少个电子。</p>
      <p>电流的单位是<b>安培（A）</b>，纪念法国物理学家安培。1 A 表示每秒有 1 库仑电荷通过截面，相当于每秒约 <b>6.24×10<sup>18</sup> 个</b>电子——比全世界人口多十亿倍。2019 年起，国际单位制直接用元电荷 e = 1.602176634×10<sup>−19</sup> C 的精确值来定义安培。</p>
      <p>常用的小单位：1 mA（毫安）= 10<sup>−3</sup> A，1 μA（微安）= 10<sup>−6</sup> A。</p>`,
    },
    {
      title: '电子在导线里怎么运动？',
      html: `<p>即使不通电，金属里的自由电子也在以约 <b>10<sup>6</sup> m/s</b>（每秒一千多公里！）的速度杂乱无章地运动，不断撞上振动的铜离子、改变方向。因为方向完全随机，平均下来没有净移动，所以没有电流。</p>
      <p>加上电压后，导线中出现电场，电场力让每个电子在乱跑的同时，整体逆着电场方向有一个微小的“<b>漂移</b>”。看那个带轨迹的电子：它走的是<b>之字形</b>，但总体在慢慢往一边挪。</p>
      <div class="eq"><i>I</i> = <i>nqvS</i></div>
      <p>推导：长 vt 的一段导线体积为 vtS，含 n·vtS 个电子，它们在时间 t 内都穿过截面，Q = nqvtS，于是 I = Q/t = nqvS。</p>
      <p>代入数字：截面 1 mm² 的铜线通过 5 A 电流，漂移速度只有约 <b>0.4 mm/s</b>——比蜗牛还慢！关掉「热运动」开关，只看漂移；画面中的速度都被大大夸张了。</p>`,
    },
    {
      title: '电子这么慢，为什么一开灯就亮？',
      html: `<p>因为导线里<b>本来就挤满了</b>自由电子。合上开关的瞬间，电场以接近光速（在导线中约 2×10<sup>8</sup> m/s）沿整条导线建立起来，全线所有电子几乎<b>同时</b>开始漂移，灯丝里的电子也立刻动起来——并不需要等开关附近的电子“跑”到灯泡。</p>
      <p>这就像一根装满弹珠的管子：从一端塞进一颗，另一端几乎同时掉出一颗；又像体育场里的人浪，每个人只是站起又坐下，“浪”却飞快地传遍全场。</p>
      <p>右侧的速度对比图用对数刻度画出了三种速度：电子漂移（约 10<sup>−4</sup> m/s）、电子热运动（约 10<sup>6</sup> m/s）、电信号传播（约 10<sup>8</sup> m/s），相差十几个数量级。</p>`,
    },
    {
      title: '电流方向：一个历史“误会”',
      html: `<p>18 世纪，富兰克林还不知道电子的存在，他<b>约定</b>电流从电源正极流出、经过外电路流回负极，也就是<b>正电荷</b>移动的方向。画面上方的橙色箭头就是这个<b>约定电流方向</b>。</p>
      <p>1897 年发现电子后人们才知道：金属里真正移动的是带负电的电子，它们的方向与约定电流方向<b>相反</b>（画面下方的蓝色箭头）。不过“负电荷向左移”与“正电荷向右移”在电学效果上完全等价，所以这个约定一直沿用至今。</p>`,
    },
    {
      title: '直流电与交流电',
      html: `<ul><li><b>直流电（DC）</b>：方向不变，如电池、手机充电器输出。电子始终朝一个方向漂移。</li>
      <li><b>交流电（AC）</b>：方向周期性来回变化。我国家庭用电是 <b>50 Hz</b>，每秒改变方向 100 次。切换到「交流」，电子只是在原地来回晃动（真实振幅不到 1 微米），下方示波器画出电流随时间按正弦规律变化。</li></ul>
      <p>既然交流电里电子根本不“往前走”，能量是怎么送到用电器的？靠的是<b>电场</b>（以及磁场）——电子只是传递能量的媒介，能量本身沿着导线周围的电磁场以接近光速传输。</p>`,
    },
    {
      title: '常见的电流有多大？安全须知',
      html: `<table><tr><th>场景</th><th>电流</th></tr>
      <tr><td>电子手表</td><td>约 1 μA</td></tr>
      <tr><td>一只 LED 指示灯</td><td>约 10~20 mA</td></tr>
      <tr><td>手机快充</td><td>2~5 A</td></tr>
      <tr><td>电水壶（220 V，2000 W）</td><td>约 9 A</td></tr>
      <tr><td>汽车启动电机</td><td>100~300 A</td></tr>
      <tr><td>一次闪电</td><td>约 3 万 A（峰值可达 20 万 A）</td></tr></table>
      <p>人体对电流非常敏感（工频交流电流过人体）：</p>
      <ul><li><b>约 1 mA</b>：能感觉到“麻”</li><li><b>约 10 mA</b>：肌肉痉挛，手握住电线可能<b>无法松开</b></li><li><b>30 mA 以上</b>：呼吸困难，有生命危险</li><li><b>约 100 mA</b>流过心脏：可引起心室颤动，致命</li></ul>
      <div class="warn">家里的漏电保护器（剩余电流动作保护器）就是在检测到约 30 mA 的漏电流时，0.1 秒内自动断电。千万不要用湿手触碰电器开关，不要用铜丝代替保险丝。真正伤人的是电流，而电流的大小取决于电压和人体电阻——皮肤潮湿时人体电阻会降到几百欧，36 V 以上的电压就可能有危险。</div>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.view([0, 2.6, 12.5], [0, 0, 0], 7.2);
    ctx.setBloom(0.55, 0.45, 0.82);

    let mode = 'dc', U = 0.1, thermal = true;

    /* ---------- 导线外壳 ---------- */
    const shellMat = new THREE.MeshStandardMaterial({ color: COLOR.copper, metalness: 0.6, roughness: 0.35, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false });
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(RW, RW, HL * 2, 64, 1, true), shellMat);
    shell.rotation.z = Math.PI / 2;
    scene.add(shell);
    const rimMat = new THREE.MeshStandardMaterial({ color: COLOR.copper, metalness: 0.85, roughness: 0.3 });
    for (const x of [-HL, HL]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(RW, 0.05, 10, 64), rimMat);
      rim.rotation.y = Math.PI / 2;
      rim.position.x = x;
      scene.add(rim);
    }
    // 两端的“电势高低”符号（交流时随电流方向翻转）
    const termL = textSprite('+', { size: 1.0, color: '#ff8a80' });
    const termR = textSprite('−', { size: 1.0, color: '#8fc3ff' });
    termL.position.set(-HL - 0.9, 0, 0);
    termR.position.set(HL + 0.9, 0, 0);
    scene.add(termL, termR);

    /* ---------- 铜离子晶格 ---------- */
    const ionPos = [];
    for (let i = 0; i < 15; i++) {
      const x = -5.6 + i * 0.8;
      for (const y of [-1.2, -0.4, 0.4, 1.2]) for (const z of [-1.2, -0.4, 0.4, 1.2]) {
        if (y * y + z * z <= 1.45 * 1.45) ionPos.push([x, y, z, Math.random() * 6.28]);
      }
    }
    const ions = new ParticleCloud(ionPos.length, { color: 0x8c6450, r: 0.14, emissive: 0.04, segments: 14 });
    scene.add(ions.mesh);

    /* ---------- 自由电子 ---------- */
    const P = new Float32Array(NE * 3), Vt = new Float32Array(NE * 3);
    const tmp = new THREE.Vector3();
    const randVel = (i) => {
      tmp.randomDirection().multiplyScalar(VTH * (0.6 + 0.8 * Math.random()));
      Vt[i * 3] = tmp.x; Vt[i * 3 + 1] = tmp.y; Vt[i * 3 + 2] = tmp.z;
    };
    for (let i = 0; i < NE; i++) {
      const r = RIN * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
      P[i * 3] = (Math.random() * 2 - 1) * HL;
      P[i * 3 + 1] = Math.cos(a) * r;
      P[i * 3 + 2] = Math.sin(a) * r;
      randVel(i);
    }
    // 第 0 号电子：单独高亮并画出轨迹
    P[0] = -3; P[1] = 0.2; P[2] = 0.6;
    const eCloud = new ParticleCloud(NE, { color: COLOR.electron, r: 0.075, emissive: 1.5 });
    scene.add(eCloud.mesh);
    const tracked = particle(0x9fe0ff, { r: 0.15 });
    scene.add(tracked);
    const trail = new Trail(220, { color: 0x9fd0ff, opacity: 0.7 });
    scene.add(trail.object);

    /* ---------- 截面计数盘 ---------- */
    const diskMat = new THREE.MeshBasicMaterial({ color: COLOR.signal, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
    const disk = new THREE.Mesh(new THREE.CircleGeometry(RW - 0.02, 48), diskMat);
    disk.rotation.y = Math.PI / 2;
    scene.add(disk);
    const ringMat = new THREE.MeshStandardMaterial({ color: COLOR.signal, emissive: COLOR.signal, emissiveIntensity: 0.6 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(RW + 0.02, 0.035, 8, 64), ringMat);
    ring.rotation.y = Math.PI / 2;
    scene.add(ring);

    /* ---------- 方向箭头 ---------- */
    const aCur = new Arrow(COLOR.current, { radius: 0.07, headLength: 0.4, headRadius: 0.18, emissive: 0.3 });
    const aEle = new Arrow(COLOR.electron, { radius: 0.07, headLength: 0.4, headRadius: 0.18, emissive: 0.3 });
    scene.add(aCur, aEle);
    const lbCur = ctx.label('约定电流方向 I', { cls: 'small orange' });
    lbCur.position.set(0, RW + 1.35, 0);
    const lbEle = ctx.label('电子漂移方向（与电流相反）', { cls: 'small blue' });
    lbEle.position.set(0, -RW - 1.35, 0);
    const lbDisk = ctx.label('', { cls: 'small cyan' });
    lbDisk.position.set(0, -0.35, RW + 0.5);
    const lbIon = ctx.label('铜离子 Cu⁺（只在原位振动）', { cls: 'small dim' });
    lbIon.position.set(-4.6, RW + 0.35, 0);
    const lbTrack = ctx.label('追踪一个电子', { cls: 'small blue' });
    scene.add(lbCur, lbEle, lbDisk, lbIon, lbTrack);

    /* ---------- 面板 ---------- */
    ui.segmented({
      label: '电源',
      options: [{ value: 'dc', label: '直流 DC' }, { value: 'ac', label: '交流 AC' }],
      value: mode,
      onChange: (v) => { mode = v; phase = 0; lastNote = ''; redrawSpeeds(); },
    });
    ui.slider({
      label: '导线两端电压 U（交流为峰值）', min: 0, max: U_MAX, step: 0.005, value: U, format: (v) => `${v.toFixed(3)} V`,
      onInput: (v) => { U = v; redrawSpeeds(); },
    });
    ui.toggle({ label: '显示电子的热运动（乱跑）', value: thermal, onChange: (v) => { thermal = v; trail.reset(); } });
    const note = ui.note('');
    const read = ui.readouts([
      { key: 'I', label: '电流 I', unit: 'A' },
      { key: 'vd', label: '电子漂移速度', unit: 'mm/s' },
      { key: 'n', label: '每秒通过截面的电子', unit: '个' },
      { key: 'vis', label: '画面中截面计数', unit: '个/秒' },
    ]);
    ui.legend([
      { color: CSSCOLOR.electron, label: '自由电子（−）' },
      { color: '#8c6450', label: '铜离子（+）' },
      { color: CSSCOLOR.current, label: '约定电流方向' },
      { color: CSSCOLOR.signal, label: '计数截面' },
    ]);
    const scope = ui.scope({ title: '电流 I 随时间变化（示波器）', height: 110, yMin: -12.5, yMax: 12.5, window: 300, series: [{ label: 'I (A)', color: CSSCOLOR.current }] });

    const speedPlot = ui.plot({
      title: '三种速度对比（对数刻度）',
      height: 180, xMin: -5, xMax: 9.3, yMin: 0, yMax: 5.4,
      xLabel: 'lg 速度 (m/s)：每格 10 倍', yLabel: '',
      draw(p) {
        const vd = U / R_WIRE / (N_CU * QE * S_AREA);
        const rows = [
          [vd, mode === 'ac' ? '电子漂移（峰值）' : '电子漂移', CSSCOLOR.electron],
          [1e-3, '蜗牛爬行 1 mm/s', 'rgba(255,255,255,.35)'],
          [1.4, '人步行 1.4 m/s', 'rgba(255,255,255,.35)'],
          [V_FERMI, '电子热运动 ~10⁶ m/s', '#bf8cff'],
          [V_SIGNAL, '电信号传播 ~2×10⁸ m/s', CSSCOLOR.current],
        ];
        rows.forEach(([v, name, col], i) => {
          const y = 4.75 - i * 1.05;
          if (v > 0) p.line([[-5, y], [Math.log10(v), y]], col, 5);
          p.text(-4.9, y + 0.36, v > 0 ? `${name}${i === 0 ? '：' + sci(v * 1000, 2) + ' mm/s' : ''}` : `${name}：0（没有电压）`, 'rgba(255,255,255,.85)');
        });
      },
    });
    function redrawSpeeds() { speedPlot.redraw(); }

    /* ---------- 状态说明 ---------- */
    let lastNote = '';
    function setNote(I) {
      const vd = Math.abs(I) / (N_CU * QE * S_AREA);
      let h;
      if (U === 0) h = '导线两端<b>没有电压</b>：电子仍在高速乱跑，但方向完全随机，向左和向右穿过截面的电子一样多，<b>净电流为零</b>。拖动电压滑块试试。';
      else if (mode === 'dc') h = `1 m 长、1 mm² 粗的铜线（电阻 ${(R_WIRE * 1000).toFixed(1)} mΩ）两端加 ${U.toFixed(3)} V，导线内电场 E = U/L = ${U.toFixed(3)} V/m，电流 I = U/R ≈ <b>${(U / R_WIRE).toFixed(2)} A</b>。电子逆着电场慢慢漂移，真实漂移速度只有 ${sci(vd * 1000, 2)} mm/s，而它们乱跑的速度约 10⁶ m/s，快了 ${sci(V_FERMI / vd, 1)} 倍——画面中把漂移大大夸张了。`;
      else h = `交流电：电流方向周期性反转（真实 50 Hz，这里放慢到 ${F_AC} Hz）。电子没有整体“前进”，只是在原地<b>来回晃动</b>；两端的 + / − 也随之交替。下方示波器画出了正弦形的电流。`;
      if (h !== lastNote) { lastNote = h; note.set(h); }
    }

    let phase = 0, count = 0, rate = 0, flash = 0, trailT = 0, uiT = 0, lastSign = 1;
    const o = new THREE.Vector3(), vec = new THREE.Vector3();
    redrawSpeeds();

    return {
      update(dt, t) {
        phase += dt;
        const I = mode === 'dc' ? U / R_WIRE : (U / R_WIRE) * Math.sin(2 * Math.PI * F_AC * phase);
        const vdx = -(I / I_MAX) * VD_MAX; // 电子漂移方向与电流相反
        const th = thermal ? 1 : 0;
        let wrapped0 = false;
        for (let i = 0; i < NE; i++) {
          const k = i * 3;
          if (Math.random() < dt * COLL) randVel(i);
          const x0 = P[k];
          let x = x0 + (Vt[k] * th + vdx) * dt;
          let y = P[k + 1] + Vt[k + 1] * th * dt;
          let z = P[k + 2] + Vt[k + 2] * th * dt;
          const r2 = y * y + z * z;
          if (r2 > RIN * RIN) {
            const r = Math.sqrt(r2), ny = y / r, nz = z / r;
            const vn = Vt[k + 1] * ny + Vt[k + 2] * nz;
            if (vn > 0) { Vt[k + 1] -= 2 * vn * ny; Vt[k + 2] -= 2 * vn * nz; }
            y = ny * RIN * 0.999;
            z = nz * RIN * 0.999;
          }
          let wrapped = false;
          if (x > HL) { x -= 2 * HL; wrapped = true; } else if (x < -HL) { x += 2 * HL; wrapped = true; }
          if (!wrapped) {
            if (x0 >= 0 && x < 0) { count++; flash = 1; } // 电子向左穿过 = 向右的电流
            else if (x0 < 0 && x >= 0) { count--; flash = 1; }
          }
          if (i === 0 && wrapped) wrapped0 = true;
          P[k] = x; P[k + 1] = y; P[k + 2] = z;
          eCloud.setAt(i, x, y, z, i === 0 ? 0 : 1);
        }
        eCloud.commit();
        tracked.position.set(P[0], P[1], P[2]);
        lbTrack.position.set(P[0], P[1] + 0.4, P[2]);
        if (wrapped0) trail.reset();
        trailT += dt;
        if (trailT > 0.03 && dt > 0) { trailT = 0; trail.push(tracked.position); }

        // 离子热振动
        ionPos.forEach(([x, y, z, ph], i) => {
          const a = 0.035;
          ions.setAt(i, x + Math.sin(t * 9 + ph) * a, y + Math.sin(t * 11 + ph * 2) * a, z + Math.cos(t * 10 + ph) * a);
        });
        ions.commit();

        // 截面计数：指数滑动平均，得到“每秒净通过多少个”
        if (dt > 0) {
          const tau = mode === 'ac' ? 0.6 : 2.0;
          rate = rate * Math.exp(-dt / tau) + count / tau;
          count = 0;
        }
        flash = Math.max(0, flash - dt * 4);
        diskMat.opacity = 0.08 + flash * 0.12;
        ringMat.emissiveIntensity = 0.5 + flash * 0.8;

        // 方向箭头
        const L = Math.abs(I) > 1e-6 ? 0.6 + (3.4 * Math.abs(I)) / I_MAX : 0;
        const sg = I >= 0 ? 1 : -1;
        aCur.set(o.set(-sg * L / 2, RW + 0.75, 0), vec.set(sg * L, 0, 0));
        aEle.set(o.set(sg * L / 2, -RW - 0.75, 0), vec.set(-sg * L, 0, 0));
        lbCur.visible = lbEle.visible = L > 0;
        if (sg !== lastSign && Math.abs(I) > 1e-6) {
          lastSign = sg;
          termL.material.map = textTexture(sg > 0 ? '+' : '−', { color: sg > 0 ? '#ff8a80' : '#8fc3ff' });
          termR.material.map = textTexture(sg > 0 ? '−' : '+', { color: sg > 0 ? '#8fc3ff' : '#ff8a80' });
          termL.material.needsUpdate = termR.material.needsUpdate = true;
        }

        if (dt > 0) scope.push([I]);
        uiT += dt;
        if (uiT > 0.12) {
          uiT = 0;
          const vd = Math.abs(I) / (N_CU * QE * S_AREA);
          read.set('I', I, mode === 'ac' ? signed(I, 2) : I.toFixed(2));
          read.set('vd', vd * 1000, sci(vd * 1000, 2));
          read.set('n', Math.abs(I) / QE, sci(Math.abs(I) / QE, 2));
          read.set('vis', rate, (rate >= 0 ? '' : '−') + Math.abs(rate).toFixed(0));
          lbDisk.element.textContent = `截面 S：每秒净通过 ≈ ${Math.abs(rate).toFixed(0)} 个电子（画面）`;
          setNote(I);
        }
      },
    };
  },
};
