import * as THREE from 'three';
import { COLOR, CSSCOLOR, particle, stageFloor, glowSprite, clamp } from '../lib/kit.js';
import {
  ArrowField, TubeLine, LineBatch, RingPool, LabelSet, rod,
  C_LIGHT, photonEV, fmtFreq, fmtLength, fmtTime, fmtEnergyEV, sci, num3,
} from '../lib/wave-kit.js';

const L = 7; // 平面波从 x = -L 画到 x = +L（画面 1 格 = 1 米）
const CV = 1.6; // 画面里的“光速”（格/秒）：真实光速被慢放了约 1.9 亿倍
const NA = 64; // 每种场的箭头数
const NC = 280; // 曲线点数
const NL = 28; // 产生原理：场线条数
const NP = 120; // 每条场线的点数
const RMAX = 9.4; // 场线最远画到的半径

export default {
  id: 'emwave',
  group: 'wave',
  title: '电磁波',
  subtitle: 'c = λf',
  summary: '变化的电场产生磁场，变化的磁场又产生电场——它们手拉手，以光速奔向远方。',
  lead: '电磁波是互相垂直的电场（黄）和磁场（绿）一起振动、以光速向前传播的波。它不需要任何介质，在真空里也能传播。切换到「产生原理」，看看一个上下振动的电荷是怎样“甩”出电磁波的。',
  formulas: [
    { expr: '<i>c</i> = <i>λ</i><i>f</i> ≈ 3.00 × 10<sup>8</sup> m/s', desc: '光速 c（米/秒）= 波长 λ（米）× 频率 f（赫兹 Hz，每秒振动次数）。所有电磁波在真空中的速度都相同。' },
    { expr: '<i>c</i> = <span class="frac"><span>1</span><span>√<i>μ</i><sub>0</sub><i>ε</i><sub>0</sub></span></span>', desc: '麦克斯韦由电学常数 ε₀（真空介电常数）和磁学常数 μ₀（真空磁导率）算出的电磁波速度，恰好等于光速。' },
    { expr: '<i>E</i> = <i>c</i><i>B</i>', desc: '电场强度 E（V/m）与磁感应强度 B（特斯拉 T）的比值等于光速，所以电磁波中的磁场数值非常小。' },
    { expr: '<i>E</i><sub>光子</sub> = <i>h</i><i>f</i>', desc: '每个光子的能量（焦耳 J 或电子伏 eV），h = 6.63 × 10⁻³⁴ J·s 为普朗克常数。频率越高，光子能量越大。' },
  ],
  sections: [
    {
      title: '电磁波是什么？',
      html: `<p>把石子扔进水里，水面会荡起一圈圈波纹：水面上下起伏，起伏的“形状”向外传播。<b>电磁波</b>也是一种波，不过起伏的不是水面，而是<b>电场</b>和<b>磁场</b>的强弱和方向。</p>
      <p>画面中，黄色箭头表示每一点的<b>电场 E</b>，它在竖直平面里上下振动；绿色箭头表示<b>磁场 B</b>，它在水平平面里振动。两者：</p>
      <ul><li>互相<b>垂直</b>，并且都垂直于传播方向——所以电磁波是<b>横波</b>；</li>
      <li><b>同步</b>变大变小（同相位），一起到达最大、一起经过零；</li>
      <li>整体以<b>光速 c</b> 向前推进。</li></ul>
      <div class="tip">箭头只代表“这一点的场有多强、朝哪边”，并不是有什么东西在上下跑。电磁波经过时，空间里任何东西都不需要移动。</div>`,
    },
    {
      title: '麦克斯韦的预言：电场和磁场“接力”',
      html: `<p>1820 年奥斯特发现电流（运动的电荷）能产生磁场；1831 年法拉第发现<b>变化的磁场能产生电场</b>（电磁感应）。</p>
      <p>1865 年，英国物理学家<b>麦克斯韦</b>把电和磁的规律写成了一组方程，并大胆补充了一条：<b>变化的电场也能产生磁场</b>。于是：</p>
      <div class="eq">变化的电场 → 产生变化的磁场 → 又产生变化的电场 → ……</div>
      <p>电场和磁场像接力一样互相激发，一旦产生就能脱离源头，自己向远处传播。麦克斯韦用电学和磁学的两个常数算出这种波的速度 <i>c</i> = 1/√(<i>μ</i>₀<i>ε</i>₀) ≈ 3×10⁸ m/s，和当时测得的光速几乎一样！他由此断言：<b>光就是一种电磁波</b>。</p>
      <p>切换到「产生原理」：电荷上下振动时，它周围的电场线被“甩”出一个个扭结，这些扭结以光速向外扩散，就是电磁波。注意电荷正上方和正下方的场线几乎不弯——沿振动方向不辐射。</p>`,
    },
    {
      title: '赫兹的实验：第一次“抓住”电磁波',
      html: `<p>麦克斯韦去世后 8 年，德国物理学家<b>赫兹</b>在 1887~1888 年用实验证实了电磁波。</p>
      <ol><li>发射端：给两根金属杆之间的小间隙加上高压，间隙不断打出电火花，杆中的电荷高速来回振荡；</li>
      <li>接收端：几米外放一个带小缺口的金属环，没有任何导线相连，缺口处竟然也冒出了微弱的火花！</li></ol>
      <p>赫兹还测出了这种波的波长，并证明它和光一样会反射、折射、偏振，速度也等于光速。为了纪念他，频率的单位就叫<b>赫兹（Hz）</b>。仅仅几年后，马可尼等人就用它实现了无线电通信。</p>`,
    },
    {
      title: '波长、频率与光速：c = λf',
      html: `<p><b>频率 f</b>：每秒振动多少次，单位 Hz。<b>波长 λ</b>：相邻两个波峰之间的距离，单位 m。波每振动一次就前进一个波长，所以速度 = 波长 × 频率。</p>
      <p>真空中所有电磁波的速度都是 <i>c</i> ≈ 3×10⁸ m/s（每秒约绕地球 7.5 圈），因此<b>频率越高，波长越短</b>：</p>
      <table><tr><th>例子</th><th>频率 f</th><th>波长 λ = c/f</th></tr>
      <tr><td>中波广播（AM）</td><td>1 MHz</td><td>300 m</td></tr>
      <tr><td>调频广播（FM）</td><td>100 MHz</td><td>3 m</td></tr>
      <tr><td>Wi-Fi / 微波炉</td><td>2.4 GHz</td><td>12.5 cm</td></tr>
      <tr><td>绿光</td><td>5.6×10¹⁴ Hz</td><td>约 535 nm</td></tr></table>
      <p>拖动「频率」滑块：画面里 1 格 = 1 米（时间则慢放了约 2 亿倍），频率升高时波长马上变短，但向前推进的速度不变。读数里的 c = λf 始终等于 3.00×10⁸ m/s。</p>
      <p>根据 <i>E</i> = <i>cB</i>，1 V/m 的电场只对应约 3.3 nT 的磁场（还不到地磁场的万分之一），画面里绿色箭头被放大了 c 倍才和黄色一样长。</p>`,
    },
    {
      title: '不需要介质：真空里照样跑',
      html: `<p>声波是空气分子的振动，没有空气（比如太空中）就传不了声音。电磁波不同：电场和磁场本身就能存在于真空中，所以<b>电磁波不需要任何介质</b>。</p>
      <p>阳光穿过 1.5 亿千米几乎真空的太空，用约 8 分 20 秒到达地球；地面控制中心发出的无线电指令，大约要 3~22 分钟才能到达火星车。</p>
      <div class="warn">常见误区：“电磁波需要以太（一种看不见的介质）来传播。”19 世纪的科学家确实这么认为，但 1887 年迈克耳孙—莫雷实验没有找到以太存在的任何证据，后来爱因斯坦的相对论彻底抛弃了以太。</div>
      <p>在水、玻璃等物质中，电磁波会变慢（光在水中约为 0.75 <i>c</i>），这正是光会折射的原因。</p>`,
    },
    {
      title: '偏振：电场朝哪个方向振动',
      html: `<p>电场始终在一个固定平面里振动的，叫<b>线偏振</b>（画面默认，电场竖直振动）；电场方向像螺旋一样旋转前进的，叫<b>圆偏振</b>（切换看看：黄色曲线变成了螺旋线）。</p>
      <ul><li>竖着放的天线发出竖直偏振的波，接收天线也要竖着放才收得最好；</li>
      <li>偏光太阳镜只让竖直偏振的光通过，能挡掉水面、路面反射的耀眼横向偏振光；</li>
      <li>3D 电影眼镜的左右镜片分别只让一种圆偏振光通过；GPS 和许多卫星信号用圆偏振，接收天线怎么转都能收到。</li></ul>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.setBloom(0.75, 0.5, 0.72);
    const floor = stageFloor({ y: -3.2, radius: 17 });
    scene.add(floor);

    const labels = new LabelSet(ctx, scene);
    let mode = 'wave';
    let pol = 'linear';
    let fMHz = 100;
    let E0 = 1.0; // V/m
    let showE = true, showB = true;
    let ph = 0; // 累积相位 ωt（画面时间）
    let lastCrest = 0;

    const lambda = () => C_LIGHT / (fMHz * 1e6); // 真实波长（m），画面 1 格 = 1 m
    const amp = () => 0.35 + 0.9 * E0; // 箭头最大长度（格）

    /* ================= 平面波 ================= */
    const waveG = new THREE.Group();
    scene.add(waveG);
    const eArrows = new ArrowField(NA, COLOR.efield, { radius: 0.026, headLength: 0.15, headRadius: 0.065, emissive: 0.9 });
    const bArrows = new ArrowField(NA, COLOR.bfield, { radius: 0.026, headLength: 0.15, headRadius: 0.065, emissive: 0.9 });
    const eCurve = new TubeLine(NC, { radius: 0.03, color: COLOR.efield, radial: 6 });
    const bCurve = new TubeLine(NC, { radius: 0.03, color: COLOR.bfield, radial: 6 });
    waveG.add(eArrows.object, bArrows.object, eCurve.object, bCurve.object);

    // 传播轴
    const axisMat = new THREE.MeshStandardMaterial({ color: 0xe8e8f0, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.4 });
    waveG.add(rod([-L - 0.5, 0, 0], [L + 0.7, 0, 0], 0.018, axisMat));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 16), axisMat);
    tip.rotation.z = -Math.PI / 2;
    tip.position.set(L + 0.86, 0, 0);
    waveG.add(tip);

    // 两个振动平面（淡色）
    const planeGeo = new THREE.PlaneGeometry(2 * L, 1);
    const ePlane = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ color: COLOR.efield, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }));
    const bPlane = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ color: COLOR.bfield, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }));
    bPlane.rotation.x = -Math.PI / 2;
    waveG.add(ePlane, bPlane);

    // 发射天线：竖直偶极子；圆偏振时再加一根水平的（“绕杆天线”）
    const antMat = new THREE.MeshStandardMaterial({ color: 0xd0d4dc, metalness: 0.85, roughness: 0.25, emissive: COLOR.efield, emissiveIntensity: 0 });
    const antV = rod([-L - 0.35, -1.3, 0], [-L - 0.35, 1.3, 0], 0.045, antMat);
    const antH = rod([-L - 0.35, 0, -1.3], [-L - 0.35, 0, 1.3], 0.045, antMat);
    const srcGlow = glowSprite(COLOR.efield, 1.4, 0.5);
    srcGlow.position.set(-L - 0.35, 0, 0);
    waveG.add(antV, antH, srcGlow);

    // 波长标尺
    const ruler = new LineBatch(8, { color: 0xffffff, opacity: 0.85 });
    waveG.add(ruler.object);

    /* ================= 产生原理：振动电荷 ================= */
    const genG = new THREE.Group();
    scene.add(genG);
    const charge = particle('proton', { r: 0.2, sign: true, emissive: 1.1 });
    genG.add(charge);
    const track = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8),
      new THREE.MeshBasicMaterial({ color: 0xff8a80, transparent: true, opacity: 0.25 })
    );
    genG.add(track);
    const fieldLines = new LineBatch(NL * NP, { color: COLOR.efield, opacity: 0.95, additive: true });
    genG.add(fieldLines.object);
    const fronts = new RingPool(14, { color: COLOR.efield, plane: 'xy', speed: CV, maxR: RMAX + 0.4, opacity: 0.32 });
    genG.add(fronts.object);
    const NG = 16;
    const gE = new ArrowField(NG, COLOR.efield, { radius: 0.03, headLength: 0.16, headRadius: 0.07 });
    const gB = new ArrowField(NG, COLOR.bfield, { radius: 0.03, headLength: 0.16, headRadius: 0.07 });
    gB.object.position.z = 0.001;
    genG.add(gE.object, gB.object);

    /* ================= 面板 ================= */
    ui.segmented({
      label: '演示内容',
      options: [{ value: 'wave', label: '电磁波传播' }, { value: 'gen', label: '产生原理' }],
      value: mode,
      onChange: (v) => { mode = v; applyMode(); },
    });
    const sF = ui.slider({
      label: '频率 f', min: 50, max: 300, step: 1, value: fMHz, unit: 'MHz', digits: 0,
      onInput: (v) => { fMHz = v; refresh(); },
    });
    ui.slider({
      label: '振幅（电场强度 E₀）', min: 0.3, max: 1.6, step: 0.05, value: E0, unit: 'V/m', digits: 2,
      onInput: (v) => { E0 = v; refresh(); },
    });
    const segPol = ui.segmented({
      label: '偏振方式',
      options: [{ value: 'linear', label: '线偏振' }, { value: 'circular', label: '圆偏振' }],
      value: pol,
      onChange: (v) => { pol = v; refresh(); },
    });
    const tE = ui.toggle({ label: '显示电场 E（黄）', value: true, onChange: (v) => { showE = v; refresh(); } });
    const tB = ui.toggle({ label: '显示磁场 B（绿）', value: true, onChange: (v) => { showB = v; refresh(); } });
    const note = ui.note('');
    const read = ui.readouts([
      { key: 'f', label: '频率 f', unit: 'MHz' },
      { key: 'l', label: '波长 λ = c/f', unit: 'm' },
      { key: 'T', label: '周期 T = 1/f', unit: 'ns' },
      { key: 'c', label: '波速 c = λf', unit: 'm/s' },
      { key: 'B', label: '磁场 B₀ = E₀/c', unit: 'nT' },
      { key: 'E', label: '光子能量 hf', unit: 'eV' },
    ]);
    ui.legend([
      { color: CSSCOLOR.efield, label: '电场 E' },
      { color: CSSCOLOR.bfield, label: '磁场 B' },
      { color: CSSCOLOR.proton, label: '振动的电荷' },
    ]);

    // 标签（随模式重建）
    let lbE = null, lbB = null, lbL = null;
    function buildLabels() {
      labels.clear();
      lbE = lbB = lbL = null;
      if (mode === 'wave') {
        lbE = labels.add('电场 E：竖直振动', [L - 3, 2.2, 0], 'yellow');
        lbB = labels.add('磁场 B：水平振动', [L - 2.4, -0.3, 2.3], 'green');
        labels.add('传播方向 · 光速 c', [L + 0.6, -0.5, 0], 'small');
        lbL = labels.add('', [0, 0, 0], 'small');
        labels.add('发射天线', [-L - 0.35, -1.75, 0], 'small dim');
      } else {
        labels.add('上下振动的电荷', [1.4, -1.1, 0], 'red small');
        labels.add('电场线上的“扭结”以光速向外扩散 = 电磁波', [3.2, 5.6, 0], 'yellow small');
        labels.add('沿振动方向：场线几乎不弯，不辐射', [0, -6.4, 0], 'small dim');
        labels.add('远处：E ⊥ B ⊥ 传播方向', [6.4, -2.0, 0.5], 'small');
      }
    }

    function applyMode() {
      waveG.visible = mode === 'wave';
      genG.visible = mode === 'gen';
      floor.visible = mode === 'wave'; // 产生原理的场线向下延伸，不画地台
      segPol.el.style.display = mode === 'wave' ? '' : 'none';
      fronts.clear();
      if (mode === 'wave') ctx.view([-5.6, 4.3, 10.8], [0.3, 0, 0], 8.4);
      else ctx.view([0, 0.6, 18], [0, 0, 0], 9.8);
      buildLabels();
      refresh();
    }

    function refresh() {
      const lam = lambda();
      const f = fMHz * 1e6;
      const A = amp();
      const circ = pol === 'circular';
      // 读数
      let [v, u] = fmtFreq(f); read.set('f', 0, v); read.unit('f', u);
      [v, u] = fmtLength(lam); read.set('l', 0, v); read.unit('l', u);
      [v, u] = fmtTime(1 / f); read.set('T', 0, v); read.unit('T', u);
      read.set('c', 0, sci(lam * f, 2));
      read.set('B', 0, num3((E0 / C_LIGHT) * 1e9));
      [v, u] = fmtEnergyEV(photonEV(f)); read.set('E', 0, v); read.unit('E', u);

      // 平面波的可见性
      eArrows.object.visible = eCurve.object.visible = showE;
      bArrows.object.visible = bCurve.object.visible = showB;
      ePlane.visible = showE && !circ;
      bPlane.visible = showB && !circ;
      ePlane.scale.y = bPlane.scale.y = 2 * A;
      antH.visible = circ;
      // 产生原理里的远场箭头
      gE.object.visible = showE;
      gB.object.visible = showB;
      fieldLines.object.visible = showE;

      // 波长标尺：从 x0 起量一个 λ
      const x0 = -L + 0.6, x1 = Math.min(x0 + lam, L);
      const yR = A + 0.55;
      ruler.begin();
      ruler.seg(x0, yR, 0, x1, yR, 0);
      ruler.seg(x0, yR - 0.18, 0, x0, yR + 0.18, 0);
      ruler.seg(x1, yR - 0.18, 0, x1, yR + 0.18, 0);
      ruler.seg(x0, yR, 0, x0, 0, 0, 0.25, 0.25);
      ruler.seg(x1, yR, 0, x1, 0, 0, 0.25, 0.25);
      ruler.end();
      if (lbL) { lbL.position.set((x0 + x1) / 2, yR + 0.35, 0); lbL.element.textContent = `波长 λ = ${num3(lam)} m`; }
      if (lbE) lbE.position.set(L - 3, A + 0.6, 0);
      if (lbB) lbB.position.set(L - 2.4, -0.35, A + 0.65);

      // 说明
      if (mode === 'wave') {
        let band = '';
        if (fMHz < 88) band = '这一段属于甚高频（VHF），对讲机、业余无线电和早期的电视频道用的就是它。';
        else if (fMHz <= 108) band = '<b>88~108 MHz 正是调频（FM）广播的波段</b>——你的收音机此刻就浸在这样的电磁波里。';
        else if (fMHz < 137) band = '108~137 MHz 是航空无线电的波段，飞机和塔台用它通话。';
        else band = '这一段被对讲机、电视和各种专用无线电使用。';
        note.set(`频率 <b>${num3(fMHz)} MHz</b>：电场每秒来回振动 ${sci(f, 2)} 次，波长 λ = c/f = <b>${num3(lam)} m</b>。${band}<br>${circ ? '圆偏振：两根互相垂直的天线（相位差 90°）一起发射，电场方向一边前进一边旋转。' : '线偏振：竖直的天线发出电场竖直振动的波。'}`);
      } else {
        note.set(`电荷每秒上下振动 ${sci(f, 2)} 次。它<b>加速</b>时，附近的电场线被拉弯，这个“弯折”无法瞬间传到远处，只能以光速向外跑，于是一圈圈扭结向外扩散——这就是电磁波。相邻两个同向扭结的距离就是波长 λ = ${num3(lam)} m。<br>变化的电场产生磁场（绿），变化的磁场又产生电场，它们互相“接力”，脱离电荷独立传播。`);
      }
    }

    applyMode();

    /* ================= 动画 ================= */
    return {
      update(dt) {
        const lam = lambda();
        const k = (2 * Math.PI) / lam;
        ph += CV * k * dt;
        const A = amp();
        if (mode === 'wave') {
          const circ = pol === 'circular';
          for (let i = 0; i < NA; i++) {
            const x = -L + (2 * L * i) / (NA - 1);
            const p = k * (x + L) - ph;
            const s = Math.sin(p), c = Math.cos(p);
            if (circ) {
              eArrows.set(i, x, 0, 0, 0, A * s, A * c);
              bArrows.set(i, x, 0, 0, 0, -A * c, A * s);
            } else {
              eArrows.set(i, x, 0, 0, 0, A * s, 0);
              bArrows.set(i, x, 0, 0, 0, 0, A * s);
            }
          }
          eArrows.commit();
          bArrows.commit();
          for (let i = 0; i < NC; i++) {
            const x = -L + (2 * L * i) / (NC - 1);
            const p = k * (x + L) - ph;
            const s = Math.sin(p), c = Math.cos(p);
            if (circ) {
              eCurve.setPoint(i, x, A * s, A * c);
              bCurve.setPoint(i, x, -A * c, A * s);
            } else {
              eCurve.setPoint(i, x, A * s, 0);
              bCurve.setPoint(i, x, 0, A * s);
            }
          }
          eCurve.commit(NC);
          bCurve.commit(NC);
          // 天线随源头电场发光
          antMat.emissiveIntensity = 0.15 + 0.6 * Math.abs(Math.sin(-ph));
          srcGlow.material.opacity = 0.2 + 0.4 * Math.abs(Math.sin(-ph));
        } else {
          // 振动电荷：y = a sin(ωt)
          const a = 0.22 + 0.32 * E0;
          charge.position.y = a * Math.sin(ph);
          track.scale.y = (2 * a + 0.3) / 1.6;
          // 扭结大小 ∝ v/c = a·k（加上限，避免画面过乱）
          const G = clamp(0.2 * a * k, 0.04, 0.34);
          const dr = (RMAX - 0.24) / (NP - 1);
          const cph = Math.cos(ph);
          fieldLines.begin();
          for (let l = 0; l < NL; l++) {
            const th0 = ((l + 0.5) / NL) * Math.PI * 2;
            const s0 = Math.sin(th0);
            let px = 0, py = 0, pb = 1;
            for (let j = 0; j < NP; j++) {
              const r = 0.24 + j * dr;
              const tr = ph - k * r; // 推迟时间对应的相位 ω(t − r/c)
              const th = th0 + G * s0 * (cph - Math.cos(tr));
              const x = r * Math.sin(th);
              const y = a * Math.sin(tr) + r * Math.cos(th);
              const b = 0.12 + 0.88 * Math.pow(1 - r / RMAX, 0.7);
              if (j > 0) fieldLines.seg(px, py, 0, x, y, 0, pb, b);
              px = x; py = y; pb = b;
            }
          }
          fieldLines.end();
          // 每当加速度达到极值（扭结最强）时发出一圈波前
          const crest = Math.floor((ph - Math.PI / 2) / Math.PI);
          if (crest !== lastCrest) { lastCrest = crest; if (showE) fronts.emit(0.9); }
          fronts.update(dt);
          // 远场（沿 +x，θ = 90°）：E 竖直、B 指向 z，按 1/r 衰减
          for (let i = 0; i < NG; i++) {
            const r = 1.5 + i * 0.5;
            const tr = ph - k * r;
            const e = (0.55 + 0.9 * E0) * Math.sin(tr) * Math.min(1, 2.2 / r);
            gE.set(i, r, 0, 0, 0, e, 0);
            gB.set(i, r, 0, 0, 0, 0, e);
          }
          gE.commit();
          gB.commit();
        }
      },
    };
  },
};
