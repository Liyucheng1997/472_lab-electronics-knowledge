import * as THREE from 'three';
import { COLOR, CSSCOLOR, ParticleCloud, Flow, battery, coil, wire, roundedPath, stageFloor, glowSprite, clamp, V } from '../lib/kit.js';
import { TubeLine, RingPool, LabelSet, rod, person, makeTextSprite, num3 } from '../lib/wave-kit.js';

/* ---------------- 固定电话的布局 ---------------- */
const AXIS_Y = 1.45; // 话筒 / 听筒的轴线高度
const MIC_X = -8.2, EAR_X = 8.2;
const DEV_R = 0.7, DEV_LEN = 1.3;
const LOOP_X = 7.45, LOOP_TOP = 2.75, LOOP_BOT = 0.35;
const RIB_Y = 3.65, RIB_X0 = -7.1, RIB_X1 = 7.1, NRIB = 360;
const U_BAT = 48; // 交换局电源电压（V）
const R_FEED = 400; // 交换局馈电电阻（Ω）
const R_MIC = 100; // 碳粒话筒静态电阻（Ω）
const R_PER_KM = 180; // 0.5 mm 双绞铜线的环路电阻（Ω/km）
const ALPHA = 1.0; // 线路衰减（dB/km，约 1 kHz）
const V_LINE = 2e8; // 电信号沿线传播速度（m/s）
const DELAY_PER_KM = 0.08; // 画面中的延迟（秒/千米，慢放）

/* ---------------- 移动电话的布局 ---------------- */
const HEX_R = 2.3;
const CELL_COLORS = [0x3f6fa8, 0xa8743f, 0x3d9c62, 0x8a5fc0, 0xb04a62, 0x3f9c9c, 0x9c9c3f];

/** 半剖开的圆柱外壳（只保留背面一半，好看见内部），轴沿 x */
function halfShell(color = 0x9aa0ad) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide });
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(DEV_R, DEV_R, DEV_LEN, 40, 1, true, Math.PI / 2, Math.PI), m);
  shell.rotation.z = Math.PI / 2;
  g.add(shell);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd0d4dc, metalness: 0.8, roughness: 0.25 });
  for (const s of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(DEV_R, 0.03, 8, 48, Math.PI), rimMat);
    rim.rotation.y = Math.PI / 2;
    rim.rotation.x = -Math.PI / 2; // 半圈朝后（z<0）
    rim.position.x = (s * DEV_LEN) / 2;
    g.add(rim);
  }
  return { group: g, material: m };
}
function backCap(x, color = 0x8a909c) {
  const c = new THREE.Mesh(new THREE.CircleGeometry(DEV_R, 32, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide }));
  c.rotation.y = Math.PI / 2;
  c.position.x = x;
  return c;
}
function disk(radius, thick, color, opts = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thick, 40), new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.35, ...opts }));
  m.rotation.z = Math.PI / 2;
  return m;
}
function partTag(text, pos, color = '#c8ccd6') {
  const s = makeTextSprite(text, { size: 0.2, color, bg: 'rgba(18,18,24,0.7)' });
  s.position.copy(pos);
  return s;
}

/** 碳粒话筒剖面（声音从 -x 方向来） */
function carbonMic() {
  const g = new THREE.Group();
  g.add(halfShell(0x6f7686).group);
  g.add(backCap(DEV_LEN / 2));
  const dia = new THREE.Group();
  dia.add(disk(0.6, 0.03, 0xd8dbe2, { metalness: 0.9, roughness: 0.2 }));
  const front = disk(0.44, 0.05, 0x2a2a2e);
  front.position.x = 0.04;
  dia.add(front);
  dia.position.x = -0.55;
  g.add(dia);
  const back = disk(0.46, 0.16, 0x1e1e22);
  back.position.x = 0.4;
  g.add(back);
  const N = 120;
  const gran = new ParticleCloud(N, { color: 0x45454c, r: 0.05, emissive: 0.2, segments: 8 });
  gran.mesh.material.emissive.setHex(0xff9f0a);
  g.add(gran.mesh);
  const seeds = [];
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.4;
    seeds.push([Math.random(), Math.cos(a) * r, Math.sin(a) * r - 0.05]);
  }
  // 后面的两个接线柱
  const post = new THREE.MeshStandardMaterial({ color: 0xd0d0d6, metalness: 0.9, roughness: 0.25 });
  for (const y of [0.3, -0.3]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 12), post);
    p.rotation.z = Math.PI / 2;
    p.position.set(DEV_LEN / 2 + 0.1, y, 0);
    g.add(p);
  }
  g.add(partTag('振膜', new THREE.Vector3(-0.62, 0.95, 0)));
  g.add(partTag('碳粒', new THREE.Vector3(-0.05, -0.95, 0.1), '#ffb44d'));
  g.add(partTag('电极', new THREE.Vector3(0.45, 0.95, 0)));
  /** p: 声压（−1..1），正值把振膜推向碳粒 */
  g.userData.set = (p) => {
    const xd = -0.55 + 0.09 * p;
    dia.position.x = xd;
    const x0 = xd + 0.08, x1 = 0.31;
    for (let i = 0; i < N; i++) {
      const [u, y, z] = seeds[i];
      gran.setAt(i, x1 - (x1 - x0) * u, y, z);
    }
    gran.commit();
    gran.mesh.material.emissiveIntensity = 0.05 + 0.75 * clamp((p + 1) / 2, 0, 1) ** 2;
  };
  g.userData.set(0);
  return g;
}

/** 电磁式听筒剖面（声音向 +x 方向发出） */
function earpiece() {
  const g = new THREE.Group();
  g.add(halfShell(0x6f7686).group);
  g.add(backCap(-DEV_LEN / 2));
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.3 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.86, 0.3), mat(0x9a9aa2));
  base.position.x = -0.42;
  const north = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.16, 0.24), mat(COLOR.magnetN));
  north.position.set(-0.04, 0.3, 0);
  const south = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.16, 0.24), mat(COLOR.magnetS));
  south.position.set(-0.04, -0.3, 0);
  g.add(base, north, south);
  const coils = [];
  for (const y of [0.3, -0.3]) {
    const c = coil({ radius: 0.16, turns: 7, length: 0.42, wire: 0.022 });
    c.mesh.position.set(-0.02, y, 0);
    g.add(c.mesh);
    coils.push(c.mesh.material);
  }
  const dia = disk(0.6, 0.025, 0x3a3d44, { metalness: 0.85, roughness: 0.3 });
  dia.position.x = 0.47;
  g.add(dia);
  const glows = [];
  for (const y of [0.3, -0.3]) {
    const s = glowSprite(COLOR.bfield, 0.55, 0);
    s.position.set(0.36, y, 0.05);
    g.add(s);
    glows.push(s);
  }
  const post = new THREE.MeshStandardMaterial({ color: 0xd0d0d6, metalness: 0.9, roughness: 0.25 });
  for (const y of [0.3, -0.3]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 12), post);
    p.rotation.z = Math.PI / 2;
    p.position.set(-DEV_LEN / 2 - 0.1, y, 0);
    g.add(p);
  }
  g.add(partTag('铁膜片', new THREE.Vector3(0.6, 0.95, 0)));
  g.add(partTag('线圈 + 磁铁', new THREE.Vector3(-0.1, -0.98, 0.1), '#ffb44d'));
  /** i: 信号电流（−1..1） */
  g.userData.set = (i) => {
    dia.position.x = 0.47 - 0.07 * i;
    for (const s of glows) s.material.opacity = Math.min(0.9, Math.abs(i) * 0.9);
    for (const m of coils) { m.emissive.setHex(COLOR.current); m.emissiveIntensity = Math.abs(i) * 0.6; }
  };
  g.userData.set(0);
  return g;
}

function phoneModel(color = 0x2b2d33) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.82, 0.07), new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.3 }));
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x0a2a40, emissive: 0x2f8fd6, emissiveIntensity: 0.6 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.7), screenMat);
  screen.position.z = 0.036;
  g.add(body, screen);
  g.userData.screen = screenMat;
  return g;
}

function miniStation(height, mat, panelMat) {
  const g = new THREE.Group();
  g.add(rod([0, 0, 0], [0, height, 0], 0.05, mat, 8));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.04), panelMat);
    p.position.set(Math.cos(a) * 0.12, height - 0.2, Math.sin(a) * 0.12);
    p.rotation.y = -a + Math.PI / 2;
    g.add(p);
  }
  return g;
}

export default {
  id: 'telephone',
  group: 'wave',
  title: '电话',
  subtitle: '声音 ⇄ 电流',
  summary: '话筒把声音变成变化的电流，听筒再把电流变回声音；手机则把声音变成 0 和 1，用电磁波和光纤传递。',
  lead: '「固定电话」：A 的声音压动话筒里的碳粒，电阻随声音变化，线路电流跟着起伏；电流传到 B 的听筒，电磁铁吸动铁膜片，声音又出来了。「移动电话」：声音被数字化成 0 和 1，经无线电波、基站和光纤网络送到对方。',
  formulas: [
    { expr: '<i>I</i> = <span class="frac"><span><i>U</i></span><span><i>R</i><sub>馈</sub> + <i>R</i><sub>线</sub> + <i>R</i><sub>话筒</sub>(<i>t</i>)</span></span>', desc: '线路电流 I（A）。U 为交换局电源电压（约 48 V），话筒电阻随声音变化，电流就随声音起伏。' },
    { expr: '衰减(dB) = <i>α</i> · <i>L</i>', desc: '铜线越长，信号越弱。α 约 1 dB/km（0.5 mm 双绞线、1 kHz），L 为线路长度（km）。每衰减 20 dB，幅度变为 1/10。' },
    { expr: '<i>t</i> = <span class="frac"><span><i>L</i></span><span><i>v</i></span></span>', desc: '传输时延（s）。电信号在电缆中约 2×10⁸ m/s，光在光纤中也约 2×10⁸ m/s（光速的 2/3）。' },
    { expr: '码率 = 采样率 × 位数', desc: '数字电话的码率（bit/s）：传统数字电话每秒采样 8000 次、每次 8 位 → 64 kbit/s；手机用语音压缩编码，只需约 12 kbit/s。' },
  ],
  sections: [
    {
      title: '电话做了什么？声 → 电 → 声',
      html: `<p>声音是空气的振动，跑不了多远就会消失。电话的思路是：把声音的振动“翻译”成电流的变化，让电流沿导线跑到远处，再“翻译”回声音。整个过程是两次<b>能量转换</b>：</p>
      <ol><li><b>话筒</b>（送话器）：声能 → 电信号。声音越响，电流变化越大；音调越高，电流变化越快。</li>
      <li><b>导线</b>：传送变化的电流。</li>
      <li><b>听筒</b>（受话器）：电信号 → 声能。</li></ol>
      <p>注意，导线里传的不是声音本身，而是一个形状和声音一模一样的<b>电流波形</b>（画面中沿线传播的青色波）。看示波器：说话的声音、线路上的电流、对方听到的声音，三条曲线形状相同。</p>`,
    },
    {
      title: '碳粒话筒和电磁听筒是怎么工作的？',
      html: `<p><b>碳粒话筒</b>（左边剖面）：薄金属振膜后面的小盒子里装满了碳粒。声波的“压—松”推动振膜：压紧时碳粒挤得更紧、接触更好，电阻变小，电流变大；放松时电阻变大，电流变小（画面中碳粒被压紧时会发亮）。电池提供能量，话筒只是像“阀门”一样按声音调节电流。</p>
      <p><b>电磁听筒</b>（右边剖面）：永久磁铁上绕着线圈，前面是一片薄铁膜片。磁铁本来就把膜片吸住一点；话音电流流过线圈时，电磁铁的吸力时强时弱，膜片就跟着前后振动，推动空气发出声音。</p>
      <div class="tip">动手看看：调高「响度」，碳粒被压得更厉害、电流起伏更大，听筒的膜片振得更猛；调高「音调」，所有东西都振动得更快。</div>`,
    },
    {
      title: '贝尔与交换机',
      html: `<p>1876 年，<b>贝尔</b>获得了电话专利，并对助手说出了第一句电话：“沃森先生，请过来，我想见你。”（同一天，格雷也为类似发明提交了申请，这段公案至今仍有争议。）1878 年，爱迪生等人改进出的碳粒话筒让声音更响亮，这种话筒用了将近一百年。</p>
      <p>如果每两部电话之间都拉一对线，100 部电话就要 4950 对线！于是有了<b>交换机</b>：所有电话都只连到交换局，打电话时由交换机把你的线和对方的线接通。最早是接线员用插头手工接线，后来变成了自动交换机，再后来变成了计算机控制的程控交换机。交换局同时给每条线路提供约 48 V 的直流电（画面中的电池），所以停电时老式座机照样能用。</p>
      <p>为什么每部电话都要<b>既有话筒又有听筒</b>？因为通话是双向的：你说话时你的话筒工作、对方的听筒工作；对方说话时反过来。</p>`,
    },
    {
      title: '模拟信号与数字信号',
      html: `<p>固定电话线上传的是<b>模拟信号</b>：电流连续变化，形状“模仿”声音。缺点是：线路越长，信号越弱（拖动「距离」看看衰减和到达音量），混进去的噪声也会被一起放大，永远去不掉。</p>
      <p>手机用的是<b>数字信号</b>（切换到「移动电话」，看手机上方的小屏）：</p>
      <ol><li><b>采样</b>：每秒测量声音波形 8000 次（橙色竖线）；</li>
      <li><b>量化</b>：把每次测得的值四舍五入到最接近的一个台阶；</li>
      <li><b>编码</b>：把台阶编号写成二进制 0 和 1。</li></ol>
      <p>0 和 1 只要分得清就行，即使在路上变弱、沾上噪声，也能在每一站被完美地“重新整理”（再生），所以数字电话打到地球另一边，声音也和隔壁一样清楚。</p>`,
    },
    {
      title: '手机网络：蜂窝与频率复用',
      html: `<p>无线电频率是有限的资源，一座城市几百万人同时打电话，怎么够用？答案是<b>蜂窝网络</b>：把地面分成许多六边形的小区，每个小区中央立一座<b>基站</b>，只负责附近的手机，发射功率也很小。</p>
      <p>画面中颜色相同的蜂窝使用同一组频率——它们隔得足够远，信号互不干扰，于是同一个频率可以在城市里重复使用很多次，这就是<b>频率复用</b>。小区越小，容量越大，所以市区基站很密。</p>
      <p>打电话时：手机 A → 无线电波 → 基站 A → 光纤 → 核心网（交换中心）→ 光纤 → 基站 B → 无线电波 → 手机 B。你走到另一个小区时，网络会自动把通话“交接”给新基站（切换）。</p>
      <p><b>5G</b> 用更高的频率（如 3.5 GHz、毫米波）、更多的天线和更小的小区，速度比 4G 快约 10 倍，无线部分的延迟可低至 1 毫秒。</p>
      <div class="warn">常见误区：“打电话时手机直接和对方手机通信。”其实两部手机之间几乎全程走的是地面上的光纤，无线电波只负责手机到附近基站的那几百米到几千米。</div>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.setBloom(0.65, 0.45, 0.75);
    const floor = stageFloor({ y: -0.02, radius: 18 });
    scene.add(floor);

    let mode = 'fixed';
    let pitch = 300, loud = 0.8, distPos = 200;
    let tLocal = 0, readTimer = 0;

    const fp = () => 0.7 + (1.5 * (pitch - 100)) / 900; // 画面中的音调（Hz）
    const env = (tau) => loud * (0.55 + 0.45 * Math.sin(2 * Math.PI * 0.35 * tau));
    const voice = (tau) => {
      const w = 2 * Math.PI * fp() * tau;
      return (env(tau) * (Math.sin(w) + 0.45 * Math.sin(2 * w + 0.8) + 0.2 * Math.sin(3 * w + 1.6))) / 1.45;
    };
    const distOf = (pos) => (mode === 'fixed' ? 0.5 + (pos / 1000) * 29.5 : Math.pow(10, (pos / 1000) * 3.3));
    const distKm = () => distOf(distPos);

    /* =================== 固定电话 =================== */
    const fixedG = new THREE.Group();
    scene.add(fixedG);
    const fLabels = new LabelSet(ctx, fixedG);
    const pA = person({ color: 0xc77d5a });
    pA.position.set(-11.2, 0, 0);
    const pB = person({ color: 0x5d8a6e });
    pB.position.set(11.2, 0, 0);
    pB.rotation.y = Math.PI;
    fixedG.add(pA, pB);
    const mic = carbonMic();
    mic.position.set(MIC_X, AXIS_Y, 0);
    const ear = earpiece();
    ear.position.set(EAR_X, AXIS_Y, 0);
    fixedG.add(mic, ear);
    const mouthRings = new RingPool(10, { color: COLOR.signal, plane: 'xy', arc: [-0.6, 0.6], speed: 1.6, maxR: 2.1, opacity: 0.9 });
    mouthRings.object.position.copy(pA.userData.mouth).add(pA.position);
    const earRings = new RingPool(10, { color: COLOR.signal, plane: 'xy', arc: [-0.6, 0.6], speed: 1.6, maxR: 2.1, opacity: 0.9, r0: 0.2 });
    earRings.object.position.set(EAR_X + DEV_LEN / 2 - 0.1, AXIS_Y, 0);
    fixedG.add(mouthRings.object, earRings.object);

    // 线路：上线经交换机，下线串着电源
    const wOpt = { radius: 0.045, corner: 0.3 };
    const t1 = AXIS_Y + 0.3, t2 = AXIS_Y - 0.3;
    fixedG.add(wire([V(-LOOP_X - 0.05, t1, 0), V(-LOOP_X, t1, 0), V(-LOOP_X, LOOP_TOP, 0), V(LOOP_X, LOOP_TOP, 0), V(LOOP_X, t1, 0), V(LOOP_X + 0.05, t1, 0)], wOpt).mesh);
    fixedG.add(wire([V(-LOOP_X - 0.05, t2, 0), V(-LOOP_X, t2, 0), V(-LOOP_X, LOOP_BOT, 0), V(-0.62, LOOP_BOT, 0)], wOpt).mesh);
    fixedG.add(wire([V(0.62, LOOP_BOT, 0), V(LOOP_X, LOOP_BOT, 0), V(LOOP_X, t2, 0), V(LOOP_X + 0.05, t2, 0)], wOpt).mesh);
    const bat = battery({ height: 1.1, radius: 0.26 });
    bat.rotation.z = -Math.PI / 2;
    bat.position.set(0, LOOP_BOT, 0);
    fixedG.add(bat);
    const exch = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0x2c3140, roughness: 0.45, metalness: 0.3 }));
    exch.position.set(0, LOOP_TOP, 0);
    fixedG.add(exch);
    const exLamp = glowSprite(COLOR.bfield, 0.5, 0.8);
    exLamp.position.set(0.55, LOOP_TOP + 0.15, 0.42);
    fixedG.add(exLamp);
    const loopCurve = roundedPath([V(-LOOP_X, LOOP_TOP, 0), V(LOOP_X, LOOP_TOP, 0), V(LOOP_X, LOOP_BOT, 0), V(-LOOP_X, LOOP_BOT, 0)], 0.3, true);
    const electrons = new Flow(loopCurve, { count: 120, color: COLOR.electron, r: 0.06, speed: 1.2 });
    fixedG.add(electrons.object);
    const ribbon = new TubeLine(NRIB, { radius: 0.035, color: COLOR.signal });
    fixedG.add(ribbon.object);
    {
      const base = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(RIB_X0, RIB_Y, 0), V(RIB_X1, RIB_Y, 0)]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 }));
      fixedG.add(base);
    }
    fLabels.add('话筒（碳粒送话器）', [MIC_X, AXIS_Y + 1.35, 0], 'small');
    fLabels.add('听筒（电磁受话器）', [EAR_X, AXIS_Y + 1.35, 0], 'small');
    fLabels.add('交换机', [0, LOOP_TOP + 0.75, 0], 'small dim');
    fLabels.add('交换局电源 48 V', [0, LOOP_BOT - 0.55, 0.3], 'small yellow');
    const lbLine = fLabels.add('', [0, RIB_Y + 0.65, 0], 'cyan small');
    fLabels.add('A 说话', [-11.2, 2.25, 0], 'small dim');
    fLabels.add('B 听', [11.2, 2.25, 0], 'small dim');

    /* =================== 移动电话 =================== */
    const mobileG = new THREE.Group();
    scene.add(mobileG);
    const mLabels = new LabelSet(ctx, mobileG);
    const hexCenter = (q, r) => new THREE.Vector3(HEX_R * Math.sqrt(3) * (q + r / 2), 0, HEX_R * 1.5 * r);
    const hexFillMats = CELL_COLORS.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.2, depthWrite: false }));
    const hexGray = new THREE.MeshBasicMaterial({ color: 0x3a3a46, transparent: true, opacity: 0.2, depthWrite: false });
    const hexGeo = new THREE.CircleGeometry(HEX_R * 0.97, 6);
    hexGeo.rotateZ(Math.PI / 6);
    hexGeo.rotateX(-Math.PI / 2);
    const hexes = [];
    const outlinePos = [];
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc6, metalness: 0.7, roughness: 0.35 });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0xe8e8ee, roughness: 0.5 });
    let towerA = null, towerB = null;
    for (let q = -2; q <= 2; q++) {
      for (let r = -2; r <= 2; r++) {
        if (Math.abs(q + r) > 2) continue;
        const c = hexCenter(q, r);
        const grp = (((q + 3 * r) % 7) + 7) % 7;
        const m = new THREE.Mesh(hexGeo, hexFillMats[grp]);
        m.position.set(c.x, 0.01, c.z);
        mobileG.add(m);
        hexes.push({ mesh: m, grp });
        for (let k = 0; k < 6; k++) {
          const a0 = Math.PI / 6 + (k * Math.PI) / 3, a1 = a0 + Math.PI / 3;
          outlinePos.push(c.x + Math.cos(a0) * HEX_R, 0.02, c.z - Math.sin(a0) * HEX_R, c.x + Math.cos(a1) * HEX_R, 0.02, c.z - Math.sin(a1) * HEX_R);
        }
        if (q === 0 && r === 0) continue; // 中央放核心网
        const isA = q === -2 && r === 1, isB = q === 2 && r === -1;
        const st = miniStation(isA || isB ? 2.4 : 1.3, poleMat, panelMat);
        st.position.set(c.x, 0, c.z);
        mobileG.add(st);
        if (isA) towerA = c.clone();
        if (isB) towerB = c.clone();
      }
    }
    {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(outlinePos, 3));
      mobileG.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x8a90a0, transparent: true, opacity: 0.45 })));
    }
    // 核心网
    const core = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.4), new THREE.MeshStandardMaterial({ color: 0x23262f, metalness: 0.4, roughness: 0.4 }));
    core.position.set(0, 0.7, 0);
    mobileG.add(core);
    const coreLights = [];
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.02), new THREE.MeshStandardMaterial({ color: COLOR.signal, emissive: COLOR.signal, emissiveIntensity: 0.6 }));
      s.position.set(0, 0.35 + i * 0.25, 0.71);
      mobileG.add(s);
      coreLights.push(s.material);
    }
    // 光纤（埋在地面）
    const fiberPts = (from) => [V(from.x, 0.06, from.z), V(from.x * 0.5, 0.06, from.z), V(0, 0.06, 0)];
    for (const tw of [towerA, towerB]) {
      const w = wire(fiberPts(tw), { radius: 0.05, color: 0xffc46b, metalness: 0.1, roughness: 0.4, corner: 0.6 });
      w.mesh.material.emissive.setHex(0xff9f0a);
      w.mesh.material.emissiveIntensity = 0.7;
      mobileG.add(w.mesh);
    }
    // 两部手机
    const phA = phoneModel(0x2b2d33), phB = phoneModel(0x3a2b2d);
    const posA = towerA.clone().add(V(-1.3, 0.9, 0.9));
    const posB = towerB.clone().add(V(1.3, 0.9, 0.9));
    phA.position.copy(posA);
    phB.position.copy(posB);
    mobileG.add(phA, phB);
    // 数据包路径
    const pathPts = [
      posA.clone().add(V(0, 0.5, 0)), towerA.clone().add(V(0, 2.4, 0)), towerA.clone().add(V(0, 0.1, 0)),
      V(towerA.x * 0.5, 0.1, towerA.z), V(0, 0.15, 0), V(towerB.x * 0.5, 0.1, towerB.z),
      towerB.clone().add(V(0, 0.1, 0)), towerB.clone().add(V(0, 2.4, 0)), posB.clone().add(V(0, 0.5, 0)),
    ];
    const pathAB = roundedPath(pathPts, 0.35, false);
    const pathBA = roundedPath(pathPts.slice().reverse().map((p) => p.clone().add(V(0, 0.18, 0.12))), 0.35, false);
    const lenAB = pathAB.getLength();
    // 第 7 个点（塔 B 顶）在路径上的位置比例，用来判断“数据包到达基站 B”
    const fracOf = (path, idx, pts) => {
      let acc = 0;
      for (let i = 1; i <= idx; i++) acc += pts[i].distanceTo(pts[i - 1]);
      let tot = 0;
      for (let i = 1; i < pts.length; i++) tot += pts[i].distanceTo(pts[i - 1]);
      return acc / tot;
    };
    const uTowerB = fracOf(pathAB, 7, pathPts);
    const NPK = 30;
    const pkAB = new ParticleCloud(NPK, { color: COLOR.signal, r: 0.11, emissive: 1.8 });
    const pkBA = new ParticleCloud(NPK, { color: 0x7dffb0, r: 0.09, emissive: 1.6 });
    mobileG.add(pkAB.mesh, pkBA.mesh);
    const packets = [
      { cloud: pkAB, path: pathAB, list: Array.from({ length: NPK }, () => ({ u: 0, on: false })), timer: 0 },
      { cloud: pkBA, path: pathBA, list: Array.from({ length: NPK }, () => ({ u: 0, on: false })), timer: 0.15 },
    ];
    const ringA = new RingPool(10, { color: COLOR.wave, plane: 'xz', speed: 2.2, maxR: 2.2, opacity: 0.8 });
    ringA.object.position.copy(posA).add(V(0, 0.45, 0));
    const ringB = new RingPool(10, { color: COLOR.wave, plane: 'xz', speed: 2.2, maxR: 2.2, opacity: 0.8 });
    ringB.object.position.copy(towerB).add(V(0, 2.3, 0));
    const ringA2 = new RingPool(10, { color: COLOR.wave, plane: 'xz', speed: 2.2, maxR: 2.2, opacity: 0.5 });
    ringA2.object.position.copy(towerA).add(V(0, 2.3, 0));
    const ringB2 = new RingPool(10, { color: COLOR.wave, plane: 'xz', speed: 2.2, maxR: 2.2, opacity: 0.5 });
    ringB2.object.position.copy(posB).add(V(0, 0.45, 0));
    mobileG.add(ringA.object, ringB.object, ringA2.object, ringB2.object);

    // 数字化小屏：采样 → 量化 → 编码
    const DP = new THREE.Vector3(posA.x + 0.4, 3.6, posA.z);
    const DPW = 3.2, DPH = 1.2, NS = 16, NDW = 140;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(DPW + 0.3, DPH + 0.9), new THREE.MeshBasicMaterial({ color: 0x14141b, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    panel.position.copy(DP).add(V(0, -0.25, -0.02));
    mobileG.add(panel);
    const dWave = new TubeLine(NDW, { radius: 0.018, color: COLOR.signal });
    mobileG.add(dWave.object);
    const stemGeo = new THREE.BoxGeometry(0.03, 1, 0.03);
    stemGeo.translate(0, 0.5, 0);
    const stems = new THREE.InstancedMesh(stemGeo, new THREE.MeshStandardMaterial({ color: COLOR.current, emissive: COLOR.current, emissiveIntensity: 0.8 }), NS);
    stems.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    stems.frustumCulled = false;
    const dots = new ParticleCloud(NS, { color: COLOR.current, r: 0.045, emissive: 1.5 });
    mobileG.add(stems, dots.mesh);
    const bitSprites = [];
    for (let i = 0; i < 6; i++) {
      let s = '';
      for (let k = 0; k < 24; k++) { s += Math.random() < 0.5 ? '0' : '1'; if (k % 8 === 7 && k < 23) s += ' '; }
      const sp = makeTextSprite(s, { size: 0.28, color: '#ffb44d' });
      sp.position.copy(DP).add(V(0, -DPH / 2 - 0.4, 0));
      sp.visible = i === 0;
      mobileG.add(sp);
      bitSprites.push(sp);
    }
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
    const Z_AXIS = new THREE.Vector3(0, 0, 1);

    mLabels.add('手机 A', posA.clone().add(V(-0.2, -0.95, 0.5)), 'small');
    mLabels.add('手机 B', posB.clone().add(V(0.2, -0.95, 0.5)), 'small');
    mLabels.add('基站', towerB.clone().add(V(0, 3.0, 0)), 'small purple');
    mLabels.add('核心网（交换中心）', [0, 1.95, 0], 'small cyan');
    mLabels.add('光纤', [towerA.x * 0.45, 0.4, towerA.z + 0.5], 'small orange');
    mLabels.add('数字化：采样 → 量化 → 编码成 0/1', DP.clone().add(V(0, DPH / 2 + 0.35, 0)), 'small');
    mLabels.add('同色蜂窝 = 同一组频率（频率复用）', [5.2, 0.3, 6.6], 'small dim');

    /* =================== 面板 =================== */
    ui.segmented({
      label: '电话类型',
      options: [{ value: 'fixed', label: '固定电话' }, { value: 'mobile', label: '移动电话' }],
      value: mode,
      onChange: (v) => { mode = v; applyMode(); },
    });
    ui.slider({ label: '说话的音调', min: 100, max: 1000, step: 10, value: pitch, unit: 'Hz', digits: 0, onInput: (v) => { pitch = v; refresh(); } });
    ui.slider({ label: '响度', min: 0.1, max: 1, step: 0.01, value: loud, format: (v) => `${Math.round(v * 100)} %`, onInput: (v) => { loud = v; refresh(); } });
    const sDist = ui.slider({
      label: '通话距离（线路长度）', min: 0, max: 1000, step: 1, value: distPos,
      format: (v) => { const d = distOf(v); return `${d >= 100 ? d.toFixed(0) : d.toFixed(1)} km`; },
      onInput: (v) => { distPos = v; refresh(); },
    });
    const tElec = ui.toggle({ label: '显示线路中的电子', value: true, onChange: (v) => (electrons.object.visible = v) });
    const tReuse = ui.toggle({
      label: '频率复用着色', value: true,
      onChange: (v) => hexes.forEach((h) => (h.mesh.material = v ? hexFillMats[h.grp] : hexGray)),
    });
    const note = ui.note('');
    const read = ui.readouts([
      { key: 'd', label: '距离', unit: 'km' },
      { key: 't', label: '传输时延', unit: 'μs' },
      { key: 'v', label: '到达音量', unit: '%' },
      { key: 'k', label: '信号形式', unit: '' },
      { key: 'i', label: '线路电流 / 码率', unit: 'mA' },
    ]);
    const scope = ui.scope({
      title: '示波器（慢放）', height: 125, yMin: -1.2, yMax: 1.2, window: 260,
      series: [
        { label: '说话的声音', color: CSSCOLOR.signal },
        { label: '线路上的信号', color: CSSCOLOR.current },
        { label: '对方听到的', color: CSSCOLOR.bfield },
      ],
    });
    ui.legend([
      { color: CSSCOLOR.signal, label: '声音 / 话音信号' },
      { color: CSSCOLOR.electron, label: '电子' },
      { color: CSSCOLOR.wave, label: '无线电波' },
    ]);

    // 固定电话的物理量
    const lineR = () => R_PER_KM * distKm();
    const attTotal = () => Math.pow(10, (-ALPHA * distKm()) / 20);
    const currentNow = (p) => U_BAT / (R_FEED + lineR() + R_MIC * (1 - 0.35 * p));
    // 移动电话的端到端时延（ms）：编解码 40 + 空口 2×10 + 核心网 5 + 光纤（绕行系数 1.3，光在光纤中 200 km/ms）
    const mobileDelayMs = () => 65 + (distKm() * 1.3) / 200;

    function applyMode() {
      fixedG.visible = mode === 'fixed';
      mobileG.visible = mode === 'mobile';
      tElec.el.style.display = mode === 'fixed' ? '' : 'none';
      tReuse.el.style.display = mode === 'mobile' ? '' : 'none';
      sDist.set(distPos);
      scope.clear();
      if (mode === 'fixed') ctx.view([0, 3.4, 17.5], [0, 1.6, 0], 12.3);
      else ctx.view([0, 11.5, 15], [0, 0.6, 0.3], 10.6);
      refresh();
    }

    function refresh() {
      const d = distKm();
      read.set('d', 0, d >= 100 ? d.toFixed(0) : d.toFixed(1));
      if (mode === 'fixed') {
        const delay = (d * 1000) / V_LINE;
        read.set('t', 0, num3(delay * 1e6)); read.unit('t', 'μs');
        const att = attTotal();
        read.set('v', 0, att >= 0.1 ? (att * 100).toFixed(0) : (att * 100).toFixed(1));
        read.set('k', 0, '模拟');
        read.unit('i', 'mA');
        const I0 = currentNow(0);
        lbLine.element.textContent = `线路上的话音电流：越传越弱（${d.toFixed(1)} km 衰减 ${(ALPHA * d).toFixed(1)} dB）`;
        let msg = `线路电阻 ${num3(lineR())} Ω，静态电流约 ${num3(I0 * 1000)} mA。话筒电阻随声音在 ${num3(R_MIC * 0.65)}~${num3(R_MIC * 1.35)} Ω 之间变化，电流就跟着起伏（画面夸大了起伏）。`;
        msg += att < 0.1 ? '<br><b>信号衰减到不足 1/10，对方几乎听不见</b>——长途线路必须每隔一段加装放大器（中继器），而放大器会把线路噪声一起放大。' : `<br>传到对方时幅度还剩 ${(att * 100).toFixed(0)}%。`;
        note.set(msg);
      } else {
        const ms = mobileDelayMs();
        read.set('t', 0, ms.toFixed(0)); read.unit('t', 'ms');
        read.set('v', 0, '100');
        read.set('k', 0, '数字');
        read.set('i', 0, '12.2'); read.unit('i', 'kbps');
        note.set(`距离 ${d >= 100 ? d.toFixed(0) : d.toFixed(1)} km：光纤上只需约 ${((d * 1.3) / 200).toFixed(1)} ms，大部分时延花在语音编码和无线接入上，总共约 ${ms.toFixed(0)} ms（人耳察觉不到 150 ms 以内的延迟）。数字信号在每个节点都被“再生”，所以距离再远，到达音量和清晰度都不变。`);
      }
    }
    applyMode();

    let lastMouth = 0, lastEar = 0, bitTimer = 0, bitIdx = 0;
    return {
      update(dt, t) {
        tLocal += dt;
        const T = tLocal;
        const v = voice(T);
        if (mode === 'fixed') {
          const d = distKm();
          const Dv = DELAY_PER_KM * d; // 画面里的总延迟（秒）
          const attT = attTotal();
          mic.userData.set(v);
          // 沿线传播的话音电流：越往右越晚、越弱
          for (let i = 0; i < NRIB; i++) {
            const u = i / (NRIB - 1);
            const att = Math.pow(10, (-ALPHA * d * u) / 20);
            ribbon.setPoint(i, RIB_X0 + u * (RIB_X1 - RIB_X0), RIB_Y + 0.42 * att * voice(T - u * Dv), 0);
          }
          ribbon.commit(NRIB);
          const recv = attT * voice(T - Dv);
          ear.userData.set(recv * 1.2);
          // 电子：电流越大跑得越快（夸大显示）
          const mid = Math.pow(10, (-ALPHA * d * 0.5) / 20) * voice(T - 0.5 * Dv);
          electrons.speed = 1.2 * (1 + 0.7 * mid) * Math.min(1, currentNow(0) / 0.04 + 0.3);
          electrons.update(dt);
          // 声波圈
          const mc = Math.floor(T * fp());
          if (mc !== lastMouth) { lastMouth = mc; mouthRings.emit(env(T)); }
          const ec = Math.floor((T - Dv) * fp());
          if (ec !== lastEar) { lastEar = ec; earRings.emit(env(T - Dv) * attT * 1.2); }
          mouthRings.update(dt);
          earRings.update(dt);
          exLamp.material.opacity = 0.5 + 0.3 * Math.sin(t * 3);
          scope.push([v, mid, recv]);
          readTimer += dt;
          if (readTimer > 0.12) { readTimer = 0; read.set('i', 0, num3(currentNow(v) * 1000)); }
        } else {
          const d = distKm();
          const speed = 5.5 / (1 + d / 600);
          // 数据包：A 说话时 A→B 多，B 偶尔回应
          const talkA = env(T) / Math.max(loud, 0.1) > 0.45;
          for (let pi = 0; pi < packets.length; pi++) {
            const pk = packets[pi];
            pk.timer -= dt;
            const want = pi === 0 ? talkA : !talkA;
            if (pk.timer <= 0 && want) {
              pk.timer = 0.28;
              const free = pk.list.find((p) => !p.on);
              if (free) { free.on = true; free.u = 0; (pi === 0 ? ringA : ringB2).emit(1); }
            }
            for (let i = 0; i < NPK; i++) {
              const p = pk.list[i];
              if (p.on) {
                const before = p.u;
                p.u += (speed * dt) / lenAB;
                if (before < uTowerB && p.u >= uTowerB) (pi === 0 ? ringB : ringA2).emit(1);
                if (p.u >= 1) p.on = false;
              }
              if (p.on) {
                pk.path.getPointAt(Math.min(p.u, 1), _p);
                pk.cloud.setAt(i, _p.x, _p.y, _p.z, 1);
              } else pk.cloud.setAt(i, 0, -50, 0, 0);
            }
            pk.cloud.commit();
          }
          for (const r of [ringA, ringB, ringA2, ringB2]) r.update(dt);
          phA.userData.screen.emissiveIntensity = 0.4 + (talkA ? 0.5 : 0.1);
          phB.userData.screen.emissiveIntensity = 0.4 + (talkA ? 0.1 : 0.5);
          coreLights.forEach((m, i) => (m.emissiveIntensity = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * 6 + i * 1.3))));
          // 数字化小屏
          const span = 2.0;
          for (let i = 0; i < NDW; i++) {
            const u = i / (NDW - 1);
            dWave.setPoint(i, DP.x - DPW / 2 + u * DPW, DP.y + 0.5 * DPH * voice(T - (1 - u) * span), DP.z + 0.01);
          }
          dWave.commit(NDW);
          const Ts = span / NS;
          const tLast = Math.floor(T / Ts) * Ts;
          const levels = 8;
          let qNow = 0;
          for (let k = 0; k < NS; k++) {
            const tau = tLast - k * Ts;
            const u = 1 - (T - tau) / span;
            const qv = Math.round(clamp(voice(tau), -1, 1) * (levels / 2)) / (levels / 2);
            if (k === 0) qNow = qv;
            const x = DP.x - DPW / 2 + u * DPW;
            const h = 0.5 * DPH * qv;
            _p.set(x, DP.y, DP.z + 0.02);
            _s.set(1, Math.abs(h) < 1e-3 ? 1e-3 : Math.abs(h), 1);
            _q.setFromAxisAngle(Z_AXIS, h < 0 ? Math.PI : 0);
            _m.compose(_p, _q, _s);
            stems.setMatrixAt(k, _m);
            dots.setAt(k, x, DP.y + h, DP.z + 0.03, u < 0 ? 0 : 1);
          }
          stems.instanceMatrix.needsUpdate = true;
          dots.commit();
          bitTimer += dt;
          if (bitTimer > 0.35) { bitTimer = 0; bitSprites[bitIdx].visible = false; bitIdx = (bitIdx + 1) % bitSprites.length; bitSprites[bitIdx].visible = true; }
          // 示波器：对方听到的声音延迟 = 数据包走完全程的时间
          const Dm = lenAB / speed;
          scope.push([v, qNow, voice(T - Dm)]);
        }
      },
    };
  },
};
