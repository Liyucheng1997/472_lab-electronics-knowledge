import * as THREE from 'three';
import { COLOR, CSSCOLOR, wire, stageFloor, glowSprite, clamp, V } from '../lib/kit.js';
import {
  TubeLine, RingPool, LabelSet, rod, radioTower, person, makeTextSprite,
  C_LIGHT, fmtLength, num3,
} from '../lib/wave-kit.js';

const FC = 5.0; // 画面中载波的频率（Hz），真实载波被大大放慢
const CVR = 3.6; // 画面中电磁波的速度（格/秒）
const RB_X0 = -13.4, RB_X1 = -8.5; // 三条波形带的水平范围
const RB_Y = [6.5, 5.15, 3.8]; // 音频 / 载波 / 已调波
const RB_A = 0.42;
const RB_SPAN = 2.6; // 波形带显示的时间跨度（秒）
const NRB = 520;
const NTW = 440;
const TOWER = new THREE.Vector3(-6.3, 0, 0);
const TOWER_H = 7;
const RADIO = new THREE.Vector3(6.4, 0.8, 0.6);

const BANDS = {
  am: {
    name: '调幅 AM', unit: 'kHz', min: 520, max: 1620, bw: 4.5, L: 200e-6, mult: 1e3, digits: 0,
    stations: [{ id: 'A', f: 639 }, { id: 'B', f: 1008 }, { id: 'C', f: 1404 }],
  },
  fm: {
    name: '调频 FM', unit: 'MHz', min: 87, max: 108, bw: 0.09, L: 0.1e-6, mult: 1e6, digits: 1,
    stations: [{ id: 'A', f: 97.4 }, { id: 'B', f: 91.5 }, { id: 'C', f: 103.9 }],
  },
};

// 三个电台播放的“节目”（画面时间 τ 的函数，−1..1）
const progA = (tau, fa) => Math.sin(2 * Math.PI * fa * tau);
const progB = (tau) => Math.sin(2 * Math.PI * 0.5 * tau) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.13 * tau));
const progC = (tau) => (Math.sin(2 * Math.PI * 0.85 * tau) > 0 ? 0.7 : -0.7) * (Math.sin(2 * Math.PI * 0.25 * tau) > -0.2 ? 1 : 0);

function makeDialTexture(band) {
  const cv = document.createElement('canvas');
  cv.width = 640; cv.height = 180;
  const g = cv.getContext('2d');
  g.fillStyle = '#f3ead2';
  g.fillRect(0, 0, 640, 180);
  g.strokeStyle = '#3a2f22';
  g.fillStyle = '#3a2f22';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(30, 110); g.lineTo(610, 110); g.stroke();
  const X = (f) => 30 + ((f - band.min) / (band.max - band.min)) * 580;
  const step = band.unit === 'kHz' ? 100 : 2;
  g.font = '600 26px system-ui, sans-serif';
  g.textAlign = 'center';
  for (let f = Math.ceil(band.min / step) * step; f <= band.max; f += step) {
    const x = X(f);
    g.beginPath(); g.moveTo(x, 110); g.lineTo(x, 90); g.stroke();
    if ((band.unit === 'kHz' && f % 200 === 0) || (band.unit === 'MHz' && f % 4 === 0)) g.fillText(String(f), x, 78);
  }
  for (const s of band.stations) {
    const x = X(s.f);
    g.fillStyle = '#c0281b';
    g.beginPath(); g.arc(x, 140, 15, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.font = '700 22px system-ui, sans-serif';
    g.fillText(s.id, x, 148);
  }
  g.fillStyle = '#3a2f22';
  g.font = '700 26px system-ui, sans-serif';
  g.textAlign = 'left';
  g.fillText(band.name.split(' ')[1] + ' · ' + band.unit, 30, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRadio() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 0.9), wood);
  g.add(body);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.35, 0.02), new THREE.MeshStandardMaterial({ color: 0x3b2a20, roughness: 0.7 }));
  trim.position.z = 0.451;
  g.add(trim);
  // 喇叭：网罩 + 纸盆
  const grill = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.56, 40), new THREE.MeshStandardMaterial({ color: 0xc9b48a, metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide }));
  grill.position.set(-0.6, 0, 0.465);
  g.add(grill);
  const cone = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.22, 36, 1, true), new THREE.MeshStandardMaterial({ color: 0x5a554c, roughness: 0.8, side: THREE.DoubleSide }));
  paper.rotation.x = -Math.PI / 2;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.5 }));
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.0;
  cone.add(paper, cap);
  cone.position.set(-0.6, 0, 0.36);
  g.add(cone);
  // 刻度盘 + 指针
  const dialMat = new THREE.MeshBasicMaterial({ color: 0xd0d0d0 });
  const dial = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.34), dialMat);
  dial.position.set(0.6, 0.3, 0.465);
  g.add(dial);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.3, 0.01), new THREE.MeshBasicMaterial({ color: 0xd0281b }));
  needle.position.set(0.6, 0.3, 0.475);
  g.add(needle);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.3, roughness: 0.4 }));
  knob.rotation.x = Math.PI / 2;
  knob.position.set(0.85, -0.32, 0.5);
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.13, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  mark.position.set(0, 0.07, 0.065);
  const knobG = new THREE.Group();
  knobG.position.copy(knob.position);
  knob.position.set(0, 0, 0);
  knobG.add(knob, mark);
  g.add(knobG);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x3ddc97, emissive: 0x3ddc97, emissiveIntensity: 0.2 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), lampMat);
  lamp.position.set(0.25, -0.32, 0.47);
  g.add(lamp);
  // 拉杆天线
  const steel = new THREE.MeshStandardMaterial({ color: 0xd8dbe2, metalness: 0.9, roughness: 0.2 });
  const aBase = new THREE.Vector3(1.05, 0.75, -0.2), aTip = new THREE.Vector3(1.75, 3.6, -0.2);
  g.add(rod(aBase, aTip, 0.03, steel, 8));
  const tipBall = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), steel);
  tipBall.position.copy(aTip);
  g.add(tipBall);
  g.userData = { cone, dialMat, needle, knobG, lampMat, aTip, speaker: new THREE.Vector3(-0.6, 0, 0.5) };
  return g;
}

function makeMic() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.6, roughness: 0.35 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.06, 24), dark);
  base.position.y = 0.03;
  g.add(base, rod([0, 0, 0], [0, 1.32, 0], 0.025, dark));
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.32, 16), dark);
  handle.position.set(0, 1.42, 0);
  handle.rotation.z = 0.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), new THREE.MeshStandardMaterial({ color: 0xb8bcc6, metalness: 0.8, roughness: 0.35 }));
  head.position.set(-0.12, 1.6, 0);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 8), new THREE.MeshBasicMaterial({ color: 0x555555, wireframe: true }));
  mesh.position.copy(head.position);
  g.add(handle, head, mesh);
  g.userData.head = head.position.clone();
  return g;
}

function box(w, h, d, color) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 }));
}

export default {
  id: 'radio',
  group: 'wave',
  title: '无线电广播',
  subtitle: '声音 → 电 → 电磁波 → 声音',
  summary: '把声音“装”到高频载波上发射出去，收音机再从空中挑出一个电台，把声音“卸”下来。',
  lead: '左边：歌声被麦克风变成音频电信号，调制器把它“装”到高频载波上，由发射塔变成电磁波发出。右边：收音机的天线收到空中所有电台的信号，调谐电路只挑出一个频率，检波后推动喇叭发声。试着切换调幅/调频，转动调谐旋钮找电台。',
  formulas: [
    { expr: '<i>f</i> = <span class="frac"><span>1</span><span>2π√(<i>LC</i>)</span></span>', desc: '调谐电路（LC 回路）的谐振频率 f（Hz）。L 为线圈电感（亨利 H），C 为可变电容（法拉 F）。转动调谐旋钮就是在改变 C。' },
    { expr: '<i>s</i>(<i>t</i>) = [1 + <i>m</i>·<i>a</i>(<i>t</i>)]·sin(2π<i>f</i><sub>c</sub><i>t</i>)', desc: '调幅（AM）：载波的振幅随声音信号 a(t) 变化。m 为调制深度（0~100%），f<sub>c</sub> 为载波频率。' },
    { expr: '<i>f</i><sub>瞬时</sub> = <i>f</i><sub>c</sub> + Δ<i>f</i>·<i>a</i>(<i>t</i>)', desc: '调频（FM）：载波的频率随声音信号变化，振幅不变。Δf 为最大频偏（FM 广播为 75 kHz）。' },
    { expr: '<i>λ</i> = <span class="frac"><span><i>c</i></span><span><i>f</i></span></span>', desc: '载波波长（m）。中波 1 MHz → 300 m；调频 100 MHz → 3 m。' },
  ],
  sections: [
    {
      title: '为什么不能直接发射声音？',
      html: `<p>麦克风把声音变成的电信号叫<b>音频信号</b>，频率只有 20 Hz ~ 20 kHz。能不能把它直接接到天线上发出去？不行，原因有两个：</p>
      <ol><li><b>天线会长得离谱。</b>天线长度要和波长相当（约半个波长）。1 kHz 电磁波的波长是 c/f = 300 千米，天线得有 150 千米长！</li>
      <li><b>所有电台会挤成一团。</b>大家播的都是 20 Hz~20 kHz 的声音，如果都直接发射，接收机根本无法区分，听到的是所有电台混在一起的噪音。</li></ol>
      <p>解决办法：每个电台用一个自己专属的<b>高频载波</b>（画面中的紫色波），把声音“装”在载波上发射，这个过程叫<b>调制</b>。载波频率高，天线就短；各电台的载波频率不同，就像不同的车道，互不干扰。</p>`,
    },
    {
      title: '调幅 AM 与调频 FM',
      html: `<p>看画面左上的三条波形：青色是音频信号，紫色是载波，下面是调制后的波。</p>
      <ul><li><b>调幅（AM）</b>：载波的<b>振幅（高低）</b>跟着声音变化，波形的“外轮廓”（青色虚线）就是声音的形状。中波广播用调幅，频率 535~1605 kHz（我国 531~1602 kHz）。</li>
      <li><b>调频（FM）</b>：载波的振幅不变，<b>疏密（频率）</b>跟着声音变化：声音信号高时波变密，低时变疏。调频广播的频率是 88~108 MHz。</li></ul>
      <table><tr><th></th><th>调幅 AM</th><th>调频 FM</th></tr>
      <tr><td>抗干扰</td><td>差：雷电、电器火花会叠加到振幅上，听到“噼啪”声</td><td>好：接收机把振幅削平，只看频率</td></tr>
      <tr><td>音质</td><td>一般（带宽窄，约 9 kHz）</td><td>好，可传立体声（带宽约 200 kHz）</td></tr>
      <tr><td>传播距离</td><td>远：中波能沿地面绕射，夜间能被电离层反射到上千千米外</td><td>近：几十千米，基本直线传播</td></tr></table>
      <p>打开「空中干扰」，分别在 AM 和 FM 下看看收音机输出的波形（示波器绿色）有什么不同。</p>`,
    },
    {
      title: '收音机怎样挑出一个电台？',
      html: `<p>空中同时有成百上千个电台的电磁波，它们全都在收音机天线里感应出微弱的电流。收音机靠一个由线圈（L）和可变电容（C）组成的<b>调谐电路</b>来挑选：</p>
      <div class="eq">f = 1 / (2π√LC)</div>
      <p>这个电路像一个秋千，只对一个频率发生<b>谐振</b>：频率正好等于 f 的信号被放大得很强，其他频率几乎通不过。转动调谐旋钮就是在改变电容 C，从而改变谐振频率。读数里能看到调到每个电台需要多大的电容。</p>
      <p>拖动「收音机调谐」滑块：对准电台 A、B、C 时，绿灯亮、喇叭发出清晰的声音；调到两个电台之间，只剩“沙沙”的噪声。</p>`,
    },
    {
      title: '检波：把声音“卸”下来',
      html: `<p>选出电台后，还要把声音从载波上取下来，这叫<b>解调</b>（对调幅也叫<b>检波</b>）。</p>
      <ul><li>调幅：用一个二极管只保留波的上半部分，再用电容滤掉高频的“毛刺”，剩下的就是振幅的轮廓——原来的声音信号。最早的矿石收音机只用一块方铅矿晶体和一根细针当二极管，甚至不需要电池！</li>
      <li>调频：用鉴频器把“频率的快慢变化”转换成电压的高低变化。</li></ul>
      <p>最后，声音信号经放大后送进喇叭：电流通过喇叭里的线圈，线圈在磁铁的磁场中受力前后振动，带动纸盆推动空气，声音就出来了（画面中喇叭纸盆在前后振动，青色的圈是声波）。</p>`,
    },
    {
      title: '从马可尼到 5G',
      html: `<ul><li>1895 年，意大利青年<b>马可尼</b>用无线电波把电报信号传出了 2 千米；1901 年他的信号跨越了大西洋。几乎同时，俄国的波波夫也做出了无线电接收机。</li>
      <li>1906 年圣诞夜，费森登用调幅方式第一次通过无线电播送了音乐和讲话。</li>
      <li>1933 年，阿姆斯特朗发明了调频，大大降低了噪声。</li></ul>
      <p>此后，电视把图像也调制到载波上；今天的 Wi-Fi、蓝牙、4G/5G 同样是“调制—发射—接收—解调”这一套，只是把声音换成了 0 和 1 的数字信号，调制方式也复杂得多（同时改变振幅和相位）。</p>
      <div class="tip">有趣的事实：收音机里调到两个电台之间听到的“沙沙”声，有大约 1% 来自宇宙大爆炸留下的微波背景辐射。</div>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.view([-1.8, 4.6, 22.5], [-1.8, 3.0, 0], 12.6);
    ctx.setBloom(0.7, 0.45, 0.72);
    scene.add(stageFloor({ y: 0, radius: 19 }));
    const labels = new LabelSet(ctx, scene);

    let mode = 'am';
    let audioHz = 600, depth = 0.7, noiseOn = false;
    let tuneF = BANDS.am.stations[0].f;
    let tLocal = 0;

    /* ---------- 发射端 ---------- */
    const singer = person({ color: 0xc77d5a });
    singer.position.set(-13.6, 0, 0);
    scene.add(singer);
    const mouth = singer.userData.mouth.clone().add(singer.position);
    const voice = new RingPool(10, { color: COLOR.signal, plane: 'xy', arc: [-0.7, 0.7], speed: 1.0, maxR: 1.15, opacity: 0.9 });
    voice.object.position.copy(mouth);
    scene.add(voice.object);

    const mic = makeMic();
    mic.position.set(-12.1, 0, 0);
    scene.add(mic);
    const modBox = box(1.2, 0.9, 0.9, 0x2c3140);
    modBox.position.set(-9.8, 0.45, 0);
    scene.add(modBox);
    const modSign = makeTextSprite('调制器', { size: 0.26, color: '#ffffff' });
    modSign.position.set(-9.8, 0.55, 0.55);
    scene.add(modSign);
    const oscBox = box(0.9, 0.7, 0.7, 0x3a2c48);
    oscBox.position.set(-9.8, 0.35, -1.7);
    scene.add(oscBox);
    const oscSign = makeTextSprite('振荡器（载波）', { size: 0.2, color: '#d4adff' });
    oscSign.position.set(-9.8, 0.95, -1.7);
    scene.add(oscSign);
    const oscLamp = glowSprite(COLOR.wave, 0.7, 0.8);
    oscLamp.position.set(-9.8, 0.4, -1.3);
    scene.add(oscLamp);
    const cableOpt = { radius: 0.035, color: 0x222228, metalness: 0.2, roughness: 0.6, corner: 0.2 };
    scene.add(wire([V(-12.1, 0.06, 0.15), V(-10.6, 0.06, 0.15), V(-10.4, 0.3, 0.15)], cableOpt).mesh);
    scene.add(wire([V(-9.8, 0.3, -1.35), V(-9.8, 0.3, -0.45)], cableOpt).mesh);
    scene.add(wire([V(-9.2, 0.3, 0), V(TOWER.x - 0.7, 0.06, 0), V(TOWER.x - 0.4, 0.06, 0)], cableOpt).mesh);

    const tower = radioTower({ height: TOWER_H, base: 1.3 });
    tower.position.copy(TOWER);
    scene.add(tower);
    const towerTop = tower.userData.top.clone().add(TOWER);

    // 三条波形带（背板 + 发光线）
    const panelMat = new THREE.MeshBasicMaterial({ color: 0x15151c, transparent: true, opacity: 0.75, depthWrite: false });
    for (const y of RB_Y) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(RB_X1 - RB_X0 + 0.5, 1.18), panelMat);
      p.position.set((RB_X0 + RB_X1) / 2, y, -0.12);
      scene.add(p);
    }
    const rbAudio = new TubeLine(NRB, { radius: 0.03, color: COLOR.signal });
    const rbCarrier = new TubeLine(NRB, { radius: 0.025, color: COLOR.wave });
    const rbMod = new TubeLine(NRB, { radius: 0.03, color: 0xd9b8ff });
    const envTop = new TubeLine(NRB, { radius: 0.012, color: COLOR.signal, opacity: 0.55, additive: true });
    const envBot = new TubeLine(NRB, { radius: 0.012, color: COLOR.signal, opacity: 0.55, additive: true });
    scene.add(rbAudio.object, rbCarrier.object, rbMod.object, envTop.object, envBot.object);
    // 从“已调波”指向发射塔的箭头线
    {
      const pts = [new THREE.Vector3(RB_X1 + 0.3, RB_Y[2], 0), new THREE.Vector3(TOWER.x - 0.9, RB_Y[2] + 0.4, 0)];
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xd9b8ff, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.6 }));
      l.computeLineDistances();
      scene.add(l);
    }

    /* ---------- 空中的电磁波 ---------- */
    const radio = makeRadio();
    radio.position.copy(RADIO);
    scene.add(radio);
    const RU = radio.userData;
    const antTip = RU.aTip.clone().add(RADIO);
    const pathA = towerTop.clone(), pathB = antTip.clone();
    const pathLen = pathA.distanceTo(pathB);
    const pathN = new THREE.Vector3(-(pathB.y - pathA.y), pathB.x - pathA.x, 0).normalize();
    const travel = new TubeLine(NTW, { radius: 0.035, color: COLOR.wave });
    scene.add(travel.object);
    const emRings = new RingPool(28, { color: COLOR.wave, plane: 'xy', speed: CVR, maxR: 15, opacity: 0.3 });
    emRings.object.position.copy(towerTop);
    scene.add(emRings.object);

    // 远处的另外两个电台
    const others = [];
    for (const [i, pos, h] of [[1, new THREE.Vector3(-1.2, 0, -9), 4.6], [2, new THREE.Vector3(3.8, 0, -11.5), 4.0]]) {
      const t = radioTower({ height: h, base: 0.9 });
      t.position.copy(pos);
      scene.add(t);
      const rp = new RingPool(10, { color: COLOR.wave, plane: 'xy', speed: CVR, maxR: 9, opacity: 0.14 });
      rp.object.position.copy(pos).setY(h);
      scene.add(rp.object);
      const sprites = {};
      for (const m of ['am', 'fm']) {
        const st = BANDS[m].stations[i];
        const sp = makeTextSprite(`电台 ${st.id} · ${st.f} ${BANDS[m].unit}`, { size: 0.42, color: '#d4adff', bg: 'rgba(20,20,28,0.75)' });
        sp.position.copy(pos).setY(h + 0.9);
        scene.add(sp);
        sprites[m] = sp;
      }
      others.push({ tower: t, rings: rp, sprites, phase: i * 0.37 });
    }

    // 喇叭发出的声波 + 听众
    const speakerPos = RU.speaker.clone().add(RADIO);
    const sound = new RingPool(16, { color: COLOR.signal, plane: 'xy', speed: 1.2, maxR: 1.9, opacity: 0.95, drift: 1.1, r0: 0.35 });
    sound.object.position.copy(speakerPos);
    scene.add(sound.object);
    const listener = person({ color: 0x5d8a6e });
    listener.position.set(9.7, 0, 1.6);
    listener.rotation.y = Math.PI * 0.82;
    scene.add(listener);

    /* ---------- 标签 ---------- */
    labels.add('麦克风', [-12.2, 2.15, 0], 'small');
    labels.add('音频信号（声音 → 电）', [RB_X0 + 1.4, RB_Y[0] + 0.78, 0], 'cyan small');
    labels.add('高频载波', [RB_X0 + 0.9, RB_Y[1] + 0.78, 0], 'purple small');
    const lbMod = labels.add('', [RB_X0 + 1.5, RB_Y[2] + 0.78, 0], 'purple small');
    const lbTower = labels.add('', [TOWER.x, TOWER_H + 1.0, 0], '');
    labels.add('电磁波以光速传播', [0.2, 6.6, 0], 'small purple');
    labels.add('收音机：调谐 → 检波 → 放大 → 喇叭', [RADIO.x, -0.55, 1.2], 'small');

    /* ---------- 面板 ---------- */
    ui.segmented({
      label: '调制方式',
      options: [{ value: 'am', label: '调幅 AM' }, { value: 'fm', label: '调频 FM' }],
      value: mode,
      onChange: (v) => { mode = v; applyMode(); },
    });
    ui.slider({ label: '声音的音调（频率）', min: 200, max: 2000, step: 10, value: audioHz, unit: 'Hz', digits: 0, onInput: (v) => { audioHz = v; refresh(); } });
    const sDepth = ui.slider({
      label: '调制深度', min: 0, max: 1, step: 0.01, value: depth,
      format: (v) => (mode === 'am' ? `${Math.round(v * 100)} %` : `频偏 ±${Math.round(v * 75)} kHz`),
      onInput: (v) => { depth = v; refresh(); },
    });
    const toTune = (v) => { const b = BANDS[mode]; return b.min + (v / 1000) * (b.max - b.min); };
    const fromTune = (f) => { const b = BANDS[mode]; return ((f - b.min) / (b.max - b.min)) * 1000; };
    const sTune = ui.slider({
      label: '收音机调谐（旋钮）', min: 0, max: 1000, step: 1, value: fromTune(tuneF),
      format: (v) => { const b = BANDS[mode]; return `${toTune(v).toFixed(b.digits)} ${b.unit}`; },
      onInput: (v) => { tuneF = toTune(v); refresh(); },
    });
    ui.buttons(['A', 'B', 'C'].map((id, i) => ({ label: `调到电台 ${id}`, onClick: () => sTune.set(fromTune(BANDS[mode].stations[i].f), true) })));
    ui.toggle({ label: '空中干扰（雷电、电火花）', value: false, onChange: (v) => { noiseOn = v; refresh(); } });
    const note = ui.note('');
    const read = ui.readouts([
      { key: 'f', label: '电台 A 载波', unit: 'kHz' },
      { key: 'l', label: '载波波长 λ', unit: 'm' },
      { key: 'tune', label: '收音机调到', unit: 'kHz' },
      { key: 'C', label: '调谐电容 C', unit: 'pF' },
      { key: 's', label: '信号强度', unit: '%' },
    ]);
    const scope = ui.scope({
      title: '示波器（慢放）', height: 130, yMin: -1.4, yMax: 1.4, window: 260,
      series: [
        { label: '麦克风音频', color: CSSCOLOR.signal },
        { label: '发射的已调波', color: '#bf8cff' },
        { label: '收音机输出', color: CSSCOLOR.bfield },
      ],
    });
    ui.legend([
      { color: CSSCOLOR.signal, label: '声音 / 音频信号' },
      { color: CSSCOLOR.wave, label: '载波 / 电磁波' },
    ]);

    const fa = () => 0.3 + (0.9 * (audioHz - 200)) / 1800; // 画面中的音频频率（Hz）
    const respOf = (f0) => { const b = BANDS[mode]; return 1 / Math.sqrt(1 + Math.pow((tuneF - f0) / b.bw, 2)); };

    function applyMode() {
      const b = BANDS[mode];
      tuneF = b.stations[0].f;
      sTune.set(fromTune(tuneF));
      sDepth.set(depth);
      const old = RU.dialMat.map;
      RU.dialMat.map = makeDialTexture(b);
      RU.dialMat.needsUpdate = true;
      old?.dispose();
      for (const o of others) { o.sprites.am.visible = mode === 'am'; o.sprites.fm.visible = mode === 'fm'; }
      lbMod.element.textContent = mode === 'am' ? '已调波：调幅 AM（振幅随声音变）' : '已调波：调频 FM（疏密随声音变）';
      lbTower.element.textContent = `发射塔 · 电台 A ${b.stations[0].f} ${b.unit}`;
      envTop.object.visible = envBot.object.visible = mode === 'am';
      refresh();
    }

    function refresh() {
      const b = BANDS[mode];
      const fA = b.stations[0].f;
      read.set('f', 0, fA.toFixed(b.digits)); read.unit('f', b.unit);
      const [lv, lu] = fmtLength(C_LIGHT / (fA * b.mult));
      read.set('l', 0, lv); read.unit('l', lu);
      read.set('tune', 0, tuneF.toFixed(b.digits)); read.unit('tune', b.unit);
      const w = 2 * Math.PI * tuneF * b.mult;
      read.set('C', 0, num3((1 / (w * w * b.L)) * 1e12));
      const rs = b.stations.map((s) => respOf(s.f));
      const best = rs.indexOf(Math.max(...rs));
      const Rmax = rs[best];
      read.set('s', 0, (Rmax * 100).toFixed(0));
      // 指针、旋钮
      const u = (tuneF - b.min) / (b.max - b.min);
      RU.needle.position.x = 0.6 + ((30 + u * 580) / 640 - 0.5) * 1.15;
      RU.knobG.rotation.z = -u * Math.PI * 1.6;
      let msg;
      if (Rmax > 0.85) {
        const st = b.stations[best];
        const what = best === 0 ? `你在麦克风前唱的 ${audioHz} Hz 的声音` : best === 1 ? '电台 B 的音乐节目' : '电台 C 的“嘀嘀”报时信号';
        msg = `已调准<b>电台 ${st.id}（${st.f} ${b.unit}）</b>：调谐电路谐振，喇叭里传出${what}。`;
        if (noiseOn) msg += mode === 'am' ? '<br>空中干扰叠加在<b>振幅</b>上，调幅收音机把它当成声音一起放了出来——“噼啪”声明显。' : '<br>干扰只改变了振幅，调频收音机先把振幅削平再看频率，<b>噪声几乎听不到</b>。';
      } else if (Rmax > 0.3) {
        msg = '接近一个电台，但没有调准：声音很弱，还夹着噪声。继续转动旋钮。';
      } else {
        msg = '这个频率上没有电台：调谐电路选不出任何信号，喇叭里只有“沙沙”的噪声。';
      }
      msg += mode === 'am' ? '<br>调幅：载波的<b>振幅</b>随声音变化（看已调波的青色轮廓）。' : '<br>调频：载波的<b>疏密</b>随声音变化，振幅始终不变。';
      note.set(msg);
    }
    applyMode();

    // 信号（画面时间 τ）
    const audio = (tau) => progA(tau, fa());
    const modulated = (tau) => {
      if (mode === 'am') return ((1 + depth * audio(tau)) / (1 + depth)) * Math.sin(2 * Math.PI * FC * tau);
      const kf = 0.45 * depth;
      return Math.sin(2 * Math.PI * FC * tau - ((FC * kf) / fa()) * Math.cos(2 * Math.PI * fa() * tau));
    };
    const envelope = (tau) => (mode === 'am' ? (1 + depth * audio(tau)) / (1 + depth) : 1);

    let lastVoice = 0, lastCarrier = 0, lastOut = 0, impulse = 0;
    const tauD = pathLen / CVR; // 从发射塔到收音机的时间
    return {
      update(dt, t) {
        tLocal += dt;
        const T = tLocal;
        const b = BANDS[mode];
        // 波形带：右端 = 现在
        for (let i = 0; i < NRB; i++) {
          const u = i / (NRB - 1);
          const x = RB_X0 + u * (RB_X1 - RB_X0);
          const tau = T - (1 - u) * RB_SPAN;
          const av = audio(tau);
          rbAudio.setPoint(i, x, RB_Y[0] + RB_A * av, 0);
          rbCarrier.setPoint(i, x, RB_Y[1] + RB_A * Math.sin(2 * Math.PI * FC * tau), 0);
          rbMod.setPoint(i, x, RB_Y[2] + RB_A * modulated(tau), 0);
          if (mode === 'am') {
            const e = envelope(tau);
            envTop.setPoint(i, x, RB_Y[2] + RB_A * e, 0.01);
            envBot.setPoint(i, x, RB_Y[2] - RB_A * e, 0.01);
          }
        }
        rbAudio.commit(NRB); rbCarrier.commit(NRB); rbMod.commit(NRB);
        if (mode === 'am') { envTop.commit(NRB); envBot.commit(NRB); }

        // 从塔顶到收音机天线的传播波
        for (let i = 0; i < NTW; i++) {
          const s = i / (NTW - 1);
          const tau = T - (s * pathLen) / CVR;
          let w = 0.4 * modulated(tau);
          if (noiseOn && s > 0.35 && Math.random() < 0.06) w += (Math.random() - 0.5) * 0.9;
          travel.setPoint(i, pathA.x + (pathB.x - pathA.x) * s + pathN.x * w, pathA.y + (pathB.y - pathA.y) * s + pathN.y * w, pathA.z + (pathB.z - pathA.z) * s);
        }
        travel.commit(NTW);

        // 塔顶的波前圈：每个载波周期一圈，亮度 = 包络
        const cyc = Math.floor(T * FC);
        if (cyc !== lastCarrier) { lastCarrier = cyc; emRings.emit(0.35 + 0.65 * envelope(T)); }
        emRings.update(dt);
        for (const o of others) {
          const c2 = Math.floor((T + o.phase) * 1.2);
          if (c2 !== o.last) { o.last = c2; o.rings.emit(1); }
          o.rings.update(dt);
          o.tower.userData.update(t + o.phase * 3);
        }
        tower.userData.update(t);
        oscLamp.material.opacity = 0.45 + 0.4 * Math.abs(Math.sin(2 * Math.PI * FC * T));

        // 歌手的声波：每个音频周期一圈
        const vc = Math.floor(T * fa());
        if (vc !== lastVoice) { lastVoice = vc; voice.emit(0.9); }
        voice.update(dt);

        // 收音机：调谐 → 解调
        const tr = T - tauD;
        const rs = b.stations.map((s) => respOf(s.f));
        const Rmax = Math.max(...rs);
        const prog = [audio(tr) * depth, progB(tr) * 0.8, progC(tr) * 0.8];
        let out = 0;
        for (let i = 0; i < 3; i++) out += rs[i] * rs[i] * prog[i];
        const hiss = (Math.random() * 2 - 1) * (mode === 'fm' ? 0.7 : 0.35) * Math.pow(1 - Rmax, 1.5);
        out += hiss;
        if (noiseOn) {
          impulse *= Math.exp(-dt * 18);
          if (Math.random() < dt * 3) impulse = (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.5);
          const crackle = impulse + (Math.random() - 0.5) * 0.25;
          out += mode === 'am' ? crackle * (0.3 + 0.7 * Rmax) : crackle * 0.05;
        }
        out = clamp(out, -1.35, 1.35);
        RU.cone.position.z = 0.36 + out * 0.07;
        RU.lampMat.emissiveIntensity = 0.15 + 2.2 * Math.pow(Rmax, 3);
        // 喇叭声波：调准时随节目节拍发出，失谐时零星的噪声圈
        const best = rs.indexOf(Rmax);
        const beat = best === 0 ? fa() : best === 1 ? 0.5 : 0.85;
        const oc = Math.floor(tr * beat);
        if (Rmax > 0.3 && oc !== lastOut) { lastOut = oc; sound.emit(Rmax * Rmax * (best === 0 ? 0.3 + depth : 1)); }
        if (Math.random() < dt * 6 * (1 - Rmax)) sound.emit(0.25);
        sound.update(dt);

        scope.push([audio(T), modulated(T), out]);
      },
    };
  },
};
