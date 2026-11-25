import * as THREE from 'three';
import { COLOR, CSSCOLOR, battery, meter, Flow, Polyline, glowSprite, heatColor, stageFloor, clamp, V } from '../lib/kit.js';
import { Dots, LatticeSim, addWire, pathOf, setSI } from '../lib/circuit-kit.js';

const T_AMB = 20; // 室温 ℃
// 电热丝的简化热模型：dT/dt = (P − k(T−T₀) − εσA(T⁴−T₀⁴)) / C
const K_CONV = 0.06; // W/K  对流散热
const K_RAD = 5.1e-11; // W/K⁴ 辐射散热（εσA）
const HEAT_C = 0.8; // J/K  热容
const PRICE = 0.56; // 元/度

const APPS = {
  led: { name: 'LED 灯', P: 9, hours: 5, color: '#6be3ac', text: '亮度与 60 W 白炽灯相当（约 800 流明），但只耗电 9 W：约 30%~40% 的电能变成光。LED 靠半导体中电子与空穴复合直接发光，几乎不需要“烧热”。' },
  inc: { name: '白炽灯', P: 60, hours: 5, color: '#ffb347', text: '靠电流把钨丝加热到约 2500 ℃ 发光，只有约 2%~5% 的电能变成可见光，其余全部变成热——摸一下亮着的白炽灯会烫手。所以白炽灯已基本被 LED 取代。' },
  kettle: { name: '电水壶', P: 1800, hours: 0.3, color: '#ff6b5e', text: '大功率纯电阻发热：把 1.5 L 水从 20 ℃ 烧开需要 Q = cmΔt = 4200×1.5×80 ≈ 5.0×10⁵ J，理想情况下约 280 s（4.7 分钟），耗电约 0.14 度。' },
  ac: { name: '空调', P: 1200, hours: 8, color: '#64d2ff', text: '1.5 匹空调制冷时输入功率约 1200 W。它不是电阻发热，而是用压缩机“搬运”热量：消耗 1 份电能，能把约 3 份热量从室内搬到室外（能效比约 3）。' },
};

export default {
  id: 'power',
  group: 'circuit',
  title: '电功率与焦耳热',
  subtitle: 'P = UI = I²R',
  summary: '电流做功的快慢叫电功率；电流通过电阻时，电能变成热——焦耳定律。',
  lead: '电源驱动电流通过一段镍铬电热丝。上方放大图里，被电场加速的电子不断撞上离子，把能量交给晶格，离子振动加剧——宏观上就是电热丝变热、发红。调节电压和电阻，观察功率、温度和累计耗电如何变化。',
  formulas: [
    { expr: '<i>P</i> = <i>UI</i> = <i>I</i><sup>2</sup><i>R</i> = <span class="frac"><span><i>U</i><sup>2</sup></span><span><i>R</i></span></span>', desc: '电功率 P（瓦特 W）= 电压 U（V）× 电流 I（A）。1 W = 1 J/s，即每秒消耗 1 焦耳电能。后两种写法只适用于纯电阻。' },
    { expr: '<i>Q</i> = <i>I</i><sup>2</sup><i>Rt</i>', desc: '焦耳定律：电流通过导体产生的热量 Q（J）与电流的平方、电阻、通电时间 t（s）成正比。' },
    { expr: '<i>W</i> = <i>Pt</i>，1 kW·h = 3.6×10<sup>6</sup> J', desc: '电能（电功）W = 功率 × 时间。电表计量的“1 度电”就是 1 千瓦时：1000 W 的电器工作 1 小时消耗的电能。' },
  ],
  sections: [
    {
      title: '电功率：做功有多快',
      html: `<p>电源推动电荷穿过用电器时，电荷从高电势“落”到低电势，把电能交给用电器。每 1 库仑电荷“落下” U 伏，就释放 U 焦耳能量；每秒有 I 库仑电荷通过，所以每秒释放的能量是：</p>
      <div class="eq"><i>P</i> = <i>U</i> × <i>I</i></div>
      <p>这就是<b>电功率</b>，单位<b>瓦特（W）</b>。1 W = 1 V × 1 A = 1 J/s。</p>
      <p>对电阻来说，再用欧姆定律 U = IR 代入，得到 <b>P = I²R = U²/R</b>。试一试：</p>
      <ul><li>电阻不变，电压加倍 → 电流也加倍 → 功率变成 <b>4 倍</b>，温度飙升。</li>
      <li>电压不变，电阻减半 → 功率加倍（P = U²/R）。所以同一电压下，<b>电阻越小的电热器功率越大</b>，电水壶的电热丝电阻只有约 27 Ω。</li></ul>`,
    },
    {
      title: '焦耳热：电为什么会变热？',
      html: `<p>看上方放大图：电场不断给电子“加速”，电子获得定向动能；可它走不远就撞上离子，这部分动能就交给了离子，让离子振动得更剧烈。离子的无规则振动，在宏观上就是<b>温度</b>。</p>
      <p>英国物理学家<b>焦耳</b>在 1841 年通过实验发现，电流产生的热量：</p>
      <div class="eq"><i>Q</i> = <i>I</i><sup>2</sup><i>R t</i></div>
      <p>与电流的<b>平方</b>成正比——电流加倍，发热变成 4 倍。电烙铁、电暖器、电饭煲、电吹风都利用了电流的热效应。</p>
      <p>画面中电热丝的温度由一个简化的热平衡模型计算：吸收的电功率使它升温，向周围空气散热和热辐射使它降温。两者相等时温度不再上升——所以温度曲线先快后慢，最后趋于平稳。温度超过约 500 ℃ 时，金属开始发出暗红色的光。</p>`,
    },
    {
      title: '“度”与电费',
      html: `<p>电能 <b>W = P·t</b>。焦耳这个单位对家用电器来说太小了，所以电力公司用<b>千瓦时（kW·h）</b>，俗称“<b>度</b>”：</p>
      <div class="eq">1 度 = 1 kW × 1 h = 1000 W × 3600 s = 3.6×10<sup>6</sup> J</div>
      <p>计算电费只需要：<b>功率（kW）× 使用时间（h）× 电价</b>。例如 1.8 kW 的电水壶每天用 20 分钟，一个月约 1.8 × (1/3) × 30 = 18 度，按 0.56 元/度约 10 元。</p>
      <p>在下方「家用电器对比」里切换不同电器，比较它们的功率和每月电费。电器铭牌上的“额定功率”就是它在额定电压（我国家庭为 220 V）下正常工作时的功率。</p>
      <div class="tip">待机也耗电！电视、机顶盒、充电器待机时通常有 0.5~5 W 的功率，一年下来可能有十几度电。</div>`,
    },
    {
      title: '效率：LED 为什么省电？',
      html: `<p>用电器把电能转换成我们想要的形式（光、机械能），其余部分大多以热的形式“浪费”掉：</p>
      <div class="eq">效率 η = 有用的能量 / 消耗的电能</div>
      <ul><li><b>白炽灯</b>：先把灯丝加热到 2500 ℃ 左右，再靠高温发光，绝大部分能量变成了红外线和热，可见光只占 2%~5%。</li>
      <li><b>LED 灯</b>：半导体中电子和空穴复合时直接放出光子，不需要“烧热”，效率高得多。同样亮度只需白炽灯约 1/7 的功率。</li>
      <li><b>电热器</b>（电水壶、电暖器）：目的就是发热，电能几乎 100% 变成热。</li></ul>
      <p>注意：能量是守恒的，“浪费”掉的能量并没有消失，只是变成了我们不需要的热。</p>`,
    },
    {
      title: '为什么远距离输电要用高压？',
      html: `<p>输电线本身有电阻 R线，电流流过时会发热损失 P损 = I²R线。发电厂要输送的功率 P = UI 是一定的：</p>
      <ul><li>如果把电压提高 10 倍，电流就降为 1/10；</li>
      <li>线路发热损失 I²R线 则降为 <b>1/100</b>！</li></ul>
      <p>所以电网用 220 kV、500 kV 甚至 1000 kV 的特高压远距离输电，到了城市再一级级降压到 220 V 进入家庭。升压、降压靠的是<b>变压器</b>，后面「变压器」一章会详细讲。</p>
      <div class="warn">常见误区：“电压越高越耗电”。其实恰恰相反——输电时电压高、电流小，线路上的损耗才小。</div>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.view([0, 2.0, 14.2], [0, 1.3, 0], 6.0);
    ctx.setBloom(0.85, 0.5, 0.7);
    scene.add(stageFloor({ y: -3.6 }));

    const LX = -4.5, RX = 4.5, T = 1.4, B = -2.0;
    /* ---------- 电源 ---------- */
    const bat = battery({ height: 1.8, radius: 0.42 });
    bat.position.set(LX, -0.3, 0);
    scene.add(bat);
    const batTop = bat.userData.top.clone().add(bat.position);
    const batBot = bat.userData.bottom.clone().add(bat.position);

    /* ---------- 电热丝（螺旋）---------- */
    const COIL_R = 0.3, TURNS = 12, COIL_L = 2.8, CY = T + COIL_R;
    const hp = [];
    const NH = TURNS * 40;
    for (let i = 0; i <= NH; i++) {
      const s = i / NH;
      const a = s * TURNS * Math.PI * 2 - Math.PI / 2;
      hp.push(V(-COIL_L / 2 + s * COIL_L, CY + Math.sin(a) * COIL_R, Math.cos(a) * COIL_R));
    }
    const helix = new THREE.CatmullRomCurve3(hp);
    helix.arcLengthDivisions = 3000;
    const coilMat = new THREE.MeshStandardMaterial({ color: 0x8c8f96, metalness: 0.6, roughness: 0.4, emissive: 0x000000 });
    const coilMesh = new THREE.Mesh(new THREE.TubeGeometry(helix, NH * 2, 0.05, 8, false), coilMat);
    scene.add(coilMesh);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, COIL_L + 0.5, 32), new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.8 }));
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, CY, 0);
    scene.add(rod);
    const halos = [-0.9, 0, 0.9].map((x) => {
      const h = glowSprite(0xff7a30, 1.8, 0);
      h.position.set(x, CY, 0.1);
      scene.add(h);
      return h;
    });
    const heatLight = new THREE.PointLight(0xff7a30, 0, 7, 1.6);
    heatLight.position.set(0, CY + 0.3, 0.6);
    scene.add(heatLight);

    /* ---------- 电流表 ---------- */
    const amm = meter({ symbol: 'A', max: 6, size: 1.0 });
    amm.position.set(0, B - amm.userData.left.y, 0);
    scene.add(amm);
    const aL = amm.userData.left.clone().add(amm.position);
    const aR = amm.userData.right.clone().add(amm.position);

    /* ---------- 导线 + 电子流 ---------- */
    addWire(scene, [batTop, V(LX, T), V(-COIL_L / 2, T)], { radius: 0.06, corner: 0.3 });
    addWire(scene, [V(COIL_L / 2, T), V(RX, T), V(RX, B), aR], { radius: 0.06, corner: 0.3 });
    addWire(scene, [aL, V(LX, B), batBot], { radius: 0.06, corner: 0.3 });
    const loop = new THREE.CurvePath();
    pathOf([batTop, V(LX, T), V(-COIL_L / 2, T)], 0.3).curves.forEach((c) => loop.add(c));
    loop.add(helix);
    pathOf([V(COIL_L / 2, T), V(RX, T), V(RX, B), V(LX, B), batBot], 0.3).curves.forEach((c) => loop.add(c));
    const electrons = new Flow(loop, { count: 170, color: COLOR.electron, r: 0.05, speed: 0 });
    scene.add(electrons.object);

    /* ---------- 温度计 ---------- */
    const TX = 3.6, TY0 = T + 0.25, TH = 2.3;
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, TH, 20, 1, false), glassMat);
    tube.position.set(TX, TY0 + TH / 2, 0);
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 0.6 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), redMat);
    ball.position.set(TX, TY0, 0);
    const colGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 12);
    colGeo.translate(0, 0.5, 0);
    const column = new THREE.Mesh(colGeo, redMat);
    column.position.set(TX, TY0, 0);
    scene.add(tube, ball, column);

    /* ---------- 热气粒子 ---------- */
    const NHEAT = 50;
    const heatDots = new Dots(NHEAT, { r: 0.045, color: 0xff7a3a, emissive: 0xff5a1a, emissiveIntensity: 1.4, segments: 8 });
    scene.add(heatDots.mesh);
    const heatSeeds = Array.from({ length: NHEAT }, () => ({ x: (Math.random() * 2 - 1) * 1.3, z: (Math.random() * 2 - 1) * 0.3, age: Math.random() * 1.5, life: 1.2 + Math.random() * 0.6 }));

    /* ---------- 放大的晶格 ---------- */
    const LAT_Y = T + 3.05;
    const lat = new LatticeSim({ nx: 9, ny: 3, nz: 2, d: 0.72, electrons: 40, ionR: 0.15, sparkColor: 0xffa040, sparks: 40, seed: 11 });
    lat.setMaterial({ colors: [0xb9c4b0, 0x7d9bd6], mix: 0.22, disorder: 1, scales: [1, 1.18] });
    lat.group.position.set(0, LAT_Y, 0);
    scene.add(lat.group);
    const zoom = new Polyline(3, { color: 0x9fb4d8, opacity: 0.35 });
    zoom.setPoints([V(-lat.half.x, LAT_Y - lat.half.y, 0), V(0, CY + COIL_R + 0.05, 0), V(lat.half.x, LAT_Y - lat.half.y, 0)]);
    scene.add(zoom.object);

    /* ---------- 标签 ---------- */
    const lbBat = ctx.label('', { cls: 'yellow' });
    lbBat.position.set(LX - 1.35, -0.3, 0);
    const lbCoil = ctx.label('', { cls: 'orange' });
    lbCoil.position.set(0, T - 0.45, 0);
    const lbTemp = ctx.label('', { cls: 'red small' });
    lbTemp.position.set(TX, TY0 + TH + 0.35, 0);
    const lbLat = ctx.label('放大：电子撞击离子，把电能交给晶格 → 发热', { cls: 'small dim' });
    lbLat.position.set(0, LAT_Y + lat.half.y + 0.35, 0);
    const lbA = ctx.label('电流表', { cls: 'small dim' });
    lbA.position.set(0, B - 1.6, 0);
    scene.add(lbBat, lbCoil, lbTemp, lbLat, lbA);

    /* ---------- 面板 ---------- */
    let U = 12, R = 3;
    let temp = T_AMB, energy = 0, time = 0;
    ui.slider({ label: '电源电压 U', min: 0, max: 12, step: 0.5, value: U, unit: 'V', digits: 1, onInput: (v) => { U = v; refresh(); } });
    ui.slider({ label: '电热丝电阻 R', min: 1, max: 30, step: 0.5, value: R, unit: 'Ω', digits: 1, onInput: (v) => { R = v; refresh(); } });
    ui.buttons([
      { label: '重新计时', onClick: () => { energy = 0; time = 0; } },
      { label: '冷却到室温', onClick: () => { temp = T_AMB; scope.clear(); } },
    ]);
    const state = ui.note('');
    const read = ui.readouts([
      { key: 'I', label: '电流 I', unit: 'A', digits: 2 },
      { key: 'P', label: '功率 P = UI', unit: 'W', digits: 1 },
      { key: 'T', label: '电热丝温度', unit: '℃', digits: 0 },
      { key: 't', label: '通电时间 t', unit: 's', digits: 1 },
      { key: 'W', label: '电能 W = Pt', unit: 'J' },
      { key: 'kwh', label: '折合', unit: '度' },
    ]);
    ui.legend([
      { color: CSSCOLOR.electron, label: '电子' },
      { color: '#ffa040', label: '碰撞放热' },
      { color: '#b9c4b0', label: '镍、铬离子' },
    ]);
    const scope = ui.scope({ title: '电热丝温度随时间变化（近 30 s）', height: 110, yMin: 0, yMax: 1000, window: 300, series: [{ label: '温度 ℃', color: '#ff6b5e' }] });

    let app = 'inc';
    ui.segmented({
      label: '家用电器对比（220 V）',
      options: Object.entries(APPS).map(([value, a]) => ({ value, label: a.name.replace(' ', '') })),
      value: app,
      onChange: (v) => { app = v; refreshApp(); },
    });
    const appNote = ui.note('');
    const appPlot = ui.plot({
      title: '额定功率对比（W）',
      height: 150, xMin: 0, xMax: 4, yMin: -330, yMax: 2150,
      draw(p) {
        Object.entries(APPS).forEach(([k, a], i) => {
          const x = i + 0.5;
          const on = k === app;
          p.line([[x, 0], [x, Math.max(a.P, 12)]], on ? a.color : 'rgba(255,255,255,.28)', on ? 30 : 24);
          p.text(x, Math.max(a.P, 12) + 70, `${a.P} W`, on ? '#fff' : 'rgba(255,255,255,.6)', 'center');
          p.text(x, -230, a.name, on ? a.color : 'rgba(255,255,255,.6)', 'center');
        });
      },
    });

    function refreshApp() {
      const a = APPS[app];
      const I = a.P / 220;
      const Req = (220 * 220) / a.P;
      const month = (a.P / 1000) * a.hours * 30;
      appNote.set(`<b>${a.name}</b>：P = ${a.P} W，I = P/U ≈ ${I < 1 ? (I * 1000).toFixed(0) + ' mA' : I.toFixed(1) + ' A'}，等效电阻 U²/P ≈ ${Req >= 1000 ? (Req / 1000).toFixed(1) + ' kΩ' : Req.toFixed(0) + ' Ω'}。<br>工作 1 小时耗电 ${(a.P / 1000).toFixed(3)} 度；每天 ${a.hours} 小时，一个月约 ${month.toFixed(1)} 度、电费约 ${(month * PRICE).toFixed(1)} 元。<br>${a.text}`);
      appPlot.redraw();
    }

    const glowC = new THREE.Color();
    function refresh() {
      const I = R > 0 ? U / R : 0;
      const P = U * I;
      read.set('I', I);
      read.set('P', P);
      amm.userData.setValue(I);
      electrons.speed = -Math.min(I * 0.55, 5);
      // 晶格：电场加速度 ∝ U，碰撞频率 ∝ √R → 漂移速度 ∝ U/R = I
      lat.accel = (0.35 * U) / Math.sqrt(R);
      lat.rate = 1.2 * Math.sqrt(R);
      lat.sparkPeak = clamp(0.2 + P / 60, 0.2, 1.3);
      lbBat.element.textContent = `电源 U = ${U.toFixed(1)} V`;
      lbCoil.element.textContent = `镍铬电热丝 R = ${R.toFixed(1)} Ω`;
      state.set(`I = U/R = ${U.toFixed(1)}/${R.toFixed(1)} = <b>${I.toFixed(2)} A</b>，P = UI = I²R = <b>${P.toFixed(1)} W</b>：电热丝每秒把 ${P.toFixed(1)} J 电能变成热。` +
        (P > 60 ? '<br>功率很大，温度会升到发红发亮。' : P < 3 && U > 0 ? '<br>功率较小，温度只会微微升高。' : ''));
    }
    refresh();
    refreshApp();

    let sampleAcc = 0;
    return {
      update(dt, t) {
        const P = R > 0 ? (U * U) / R : 0;
        if (dt > 0) {
          // 热平衡：吸收电功率，向外散热（对流 + 辐射）
          const T0 = T_AMB + 273.15;
          // 小步长积分，保证稳定
          const n = Math.ceil(dt / 0.02);
          for (let i = 0; i < n; i++) {
            const tk = temp + 273.15;
            const l = K_CONV * (temp - T_AMB) + K_RAD * (tk ** 4 - T0 ** 4);
            temp += ((P - l) / HEAT_C) * (dt / n);
          }
          energy += P * dt;
          time += dt;
          sampleAcc += dt;
          if (sampleAcc >= 0.1) { sampleAcc = 0; scope.push([temp]); }
        }
        // 外观：颜色、光晕、灯光
        const glow = clamp((temp - 430) / 750, 0, 1);
        const warm = clamp((temp - 150) / 350, 0, 1);
        heatColor(Math.max(glow, warm * 0.3), glowC);
        coilMat.emissive.copy(glowC);
        coilMat.emissiveIntensity = warm * 0.6 + glow * 2.6;
        halos.forEach((h) => { h.material.opacity = glow * 0.9; h.scale.setScalar(1.4 + glow * 1.6); });
        heatLight.intensity = glow * 8;
        column.scale.y = Math.max(0.02, clamp(temp / 1000, 0, 1) * (TH - 0.1));
        lbTemp.element.textContent = `${temp.toFixed(0)} ℃`;
        // 晶格振动幅度 ∝ 绝对温度（夸张）
        lat.amp = 0.03 + 0.11 * clamp((temp + 273) / 1200, 0, 1.2);

        // 热气上升
        const hot = clamp((temp - 40) / 500, 0, 1);
        const nVis = Math.round(NHEAT * hot);
        for (let i = 0; i < NHEAT; i++) {
          const s = heatSeeds[i];
          s.age += dt;
          if (s.age > s.life) { s.age = 0; s.x = (Math.random() * 2 - 1) * 1.3; }
          if (i >= nVis) { heatDots.hide(i); continue; }
          const k = s.age / s.life;
          heatDots.setAt(i, s.x + Math.sin(t * 3 + i) * 0.08, CY + COIL_R + 0.1 + k * 1.5, s.z, (1 - k) * (0.6 + hot * 0.6));
        }
        heatDots.commit();

        electrons.update(dt);
        lat.update(dt, t);
        amm.userData.update(dt);

        read.set('T', temp);
        read.set('t', time);
        setSI(read, 'W', energy, 'J');
        read.set('kwh', energy / 3.6e6, (energy / 3.6e6).toFixed(energy / 3.6e6 < 0.01 ? 6 : 4));
      },
    };
  },
};
