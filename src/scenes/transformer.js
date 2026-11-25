import * as THREE from 'three';
import { COLOR, CSSCOLOR, coil, wire, bulb, ArrowFlow, Flow, ParticleCloud, stageFloor, textSprite, glowSprite, heatColor, V, clamp } from '../lib/kit.js';
import { LineFlow, clearGroup, lastPanelEl, setShown } from '../lib/magnet-kit.js';

const F_VIS = 0.5; // 画面中交流电的频率（Hz），真实为 50 Hz，放慢 100 倍
const R_LOAD = 484; // “220 V 100 W”灯泡的电阻（Ω）
const R_LINE = 5; // 输电线路电阻（Ω），约相当于 50 km 导线
const U_GEN = 10.5; // 发电机出口电压（kV）
const BARS = [10, 35, 110, 220, 500, 1000]; // 常见输电电压等级（kV）
const LIMB_X = 3.0; // 铁芯左右两柱中心

/** 圆柱连接 a、b 两点 */
function cylBetween(a, b, r, mat) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.divideScalar(len));
  return m;
}

export default {
  id: 'transformer',
  group: 'magnet',
  title: '变压器与输电',
  subtitle: '<i>U</i><sub>1</sub>/<i>U</i><sub>2</sub> = <i>N</i><sub>1</sub>/<i>N</i><sub>2</sub>',
  summary: '变压器用电磁感应升降交流电压；高压输电让电能跨越千里而损耗很小。',
  lead: '变压器由一个铁芯和绕在上面的两个线圈组成，两个线圈之间<b>没有导线相连</b>，能量完全靠铁芯中交变的磁场传过去。改变两边的匝数比，就能把交流电压升高或降低。切到「远距离输电」，看看为什么发电厂要把电压升到几十万伏再送出去。',
  formulas: [
    { expr: '<span class="frac"><span><i>U</i><sub>1</sub></span><span><i>U</i><sub>2</sub></span></span> = <span class="frac"><span><i>N</i><sub>1</sub></span><span><i>N</i><sub>2</sub></span></span>', desc: '理想变压器：初级、次级电压（V）之比等于两个线圈的匝数之比。<i>N</i><sub>2</sub> &gt; <i>N</i><sub>1</sub> 升压，<i>N</i><sub>2</sub> &lt; <i>N</i><sub>1</sub> 降压。' },
    { expr: '<i>P</i><sub>1</sub> = <i>P</i><sub>2</sub>，<span class="frac"><span><i>I</i><sub>1</sub></span><span><i>I</i><sub>2</sub></span></span> = <span class="frac"><span><i>N</i><sub>2</sub></span><span><i>N</i><sub>1</sub></span></span>', desc: '理想变压器不消耗能量：输入功率 = 输出功率（W）。所以电压升高几倍，电流就减小几倍。' },
    { expr: '<i>P</i><sub>损</sub> = <i>I</i><sup>2</sup><i>R</i> = <span class="frac"><span><i>P</i><sup>2</sup></span><span><i>U</i><sup>2</sup></span></span><i>R</i>', desc: '输电线上的发热损耗（W）。<i>P</i> 为输送功率，<i>U</i> 为输电电压，<i>R</i> 为线路电阻。电压提高 10 倍，损耗降为 1/100。' },
  ],
  sections: [
    {
      title: '变压器的结构',
      html: `<p>变压器由三部分组成：</p>
      <ul><li><b>铁芯</b>：用很多片涂了绝缘漆的薄硅钢片叠成的闭合框，作用是把磁场“关”在里面、引导到另一个线圈；</li>
      <li><b>初级线圈（原线圈）</b>：接交流电源，匝数 <i>N</i><sub>1</sub>；</li>
      <li><b>次级线圈（副线圈）</b>：接用电器，匝数 <i>N</i><sub>2</sub>。</li></ul>
      <p>注意两个线圈之间<b>没有任何导线连接</b>，电能是通过铁芯中的磁场“隔空”传过去的。所以变压器还能起到电气隔离的作用，提高安全性。</p>`,
    },
    {
      title: '工作原理：电生磁，磁又生电',
      html: `<p>① 初级线圈通入交流电，电流的大小和方向不断变化，在铁芯中产生<b>交变的磁通量</b>（画面中绿色箭头在铁芯里来回反转）；</p>
      <p>② 这个变化的磁通量几乎全部穿过次级线圈，于是次级线圈中产生感应电动势（电磁感应）；</p>
      <p>③ 两个线圈中磁通量的变化率相同，每一匝线圈产生的电动势都一样，所以电压与匝数成正比：<i>U</i><sub>1</sub>/<i>U</i><sub>2</sub> = <i>N</i><sub>1</sub>/<i>N</i><sub>2</sub>。</p>
      <p>拖动 <i>N</i><sub>1</sub>、<i>N</i><sub>2</sub> 滑块，线圈的圈数会跟着变，灯泡的亮度随 <i>U</i><sub>2</sub> 变化。示波器中可以看到：<i>u</i><sub>2</sub> 与 <i>u</i><sub>1</sub> 同步变化，而磁通量 <i>Φ</i> 比电压落后四分之一周期——因为电压取决于磁通量变化的<b>快慢</b>。</p>`,
    },
    {
      title: '为什么变压器只能用交流电？',
      html: `<p>打开「换成直流电源」试试：直流电的电流恒定，铁芯中的磁通量不变，次级线圈中就不会产生感应电动势，灯泡不亮（只在接通的一瞬间闪一下）。</p>
      <div class="warn">直流电接到变压器上非常危险：没有了交变磁场产生的“反电动势”，初级线圈中的电流只受导线电阻限制，会变得很大，线圈迅速发热甚至烧毁。</div>
      <p>这正是 19 世纪末“电流之战”中<b>交流电</b>胜出的关键原因：交流电可以方便地用变压器升压、降压，适合远距离输送。</p>
      <p><b>手机充电器</b>里也有变压器，不过现代充电器是“开关电源”：先把交流电变成直流，再用晶体管以每秒几万到几十万次的频率开关，产生高频交流电送进一个很小的磁芯变压器降压，最后再整流成 5~20 V 直流。频率越高，所需的铁芯越小，所以现在的充电器比过去轻巧得多。</p>`,
    },
    {
      title: '能量守恒：升压就降流',
      html: `<p>理想变压器不消耗能量，<i>P</i><sub>1</sub> = <i>P</i><sub>2</sub>，即 <i>U</i><sub>1</sub><i>I</i><sub>1</sub> = <i>U</i><sub>2</sub><i>I</i><sub>2</sub>。所以电压升高几倍，电流就减小几倍——变压器能“变”电压，但不能凭空产生能量。</p>
      <p>实际变压器的效率很高，大型电力变压器可达 99% 以上。少量的损耗来自：</p>
      <ul><li><b>铜损</b>：线圈导线有电阻，电流通过时发热；</li>
      <li><b>铁损</b>：交变磁场在铁芯中感应出旋涡状的电流（<b>涡流</b>）而发热，铁芯反复磁化也要消耗能量（磁滞损耗）。用互相绝缘的薄硅钢片叠成铁芯，就是为了切断涡流的通路。</li></ul>
      <p>变压器工作时发出的“嗡嗡”声，是硅钢片在交变磁场中每秒伸缩 100 次（磁致伸缩）引起的振动。</p>`,
    },
    {
      title: '为什么要高压输电？',
      html: `<p>发电厂往往远离城市，电能要经过几百甚至上千公里的导线输送。导线有电阻，电流通过时会发热损耗：<i>P</i><sub>损</sub> = <i>I</i><sup>2</sup><i>R</i>。</p>
      <p>输送的功率 <i>P</i> = <i>UI</i> 一定时，电压越高，电流越小。损耗与电流的<b>平方</b>成正比，所以电压提高到 10 倍，电流降到 1/10，损耗就降到 <b>1/100</b>！</p>
      <p>切换到「远距离输电」，把输电电压从 10 kV 拖到 500 kV：低电压时导线电流巨大，烧得通红，近一半的电能变成了热；高电压时损耗几乎可以忽略。</p>
      <p>所以电网的流程是：发电厂（约 10~20 kV）→ <b>升压变压器</b> → 高压输电（110~1000 kV）→ 变电站逐级<b>降压</b>（220 kV → 110 kV → 10 kV）→ 小区变压器降到 380 V / 220 V → 你家。</p>`,
    },
    {
      title: '中国的特高压电网',
      html: `<p>我国的能源分布很不均衡：煤炭、水力、风能、太阳能主要在西部和北部，用电大户却在东部沿海。为了“西电东送”，我国建成了世界上规模最大、电压等级最高的<b>特高压</b>电网：</p>
      <ul><li>1000 kV 特高压交流输电；</li>
      <li>±800 kV、±1100 kV 特高压直流输电，其中昌吉—古泉线路长约 3300 km，能输送 1200 万千瓦。</li></ul>
      <p>超长距离输电常用<b>直流</b>：交流输电在长导线上还有电容、电感带来的额外损耗和稳定性问题，直流没有。但发电和用电都是交流，所以两端还要建“换流站”，用大功率电力电子器件进行交直流转换，升降压仍然要靠变压器。</p>
      <div class="tip">一个常见误解：高压线“电压高所以危险”，而家用电“电压低所以安全”。实际上 220 V 同样足以致命；高压线危险在于它周围很远的距离内就可能放电，所以要远离，更不能在下面放风筝、钓鱼。</div>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.setBloom(0.6, 0.45, 0.8);

    const st = { mode: 'xf', U1: 110, N1: 200, N2: 400, dc: false, Ut: Math.log10(110 / 10), P: 10 };
    const addLabel = (parent, text, cls, x, y, z) => {
      const l = ctx.label(text, { cls });
      l.position.set(x, y, z);
      parent.add(l);
      return l;
    };

    /* ======================= 变压器 ======================= */
    const xfG = new THREE.Group();
    scene.add(xfG);
    xfG.add(stageFloor({ y: -3.4 }));
    // 叠片铁芯：9 片硅钢片
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x7d828c, metalness: 0.7, roughness: 0.42, emissive: COLOR.bfield, emissiveIntensity: 0 });
    {
      const plates = 9, th = 0.13, gap = 0.025;
      const total = plates * th + (plates - 1) * gap;
      const gLimb = new THREE.BoxGeometry(1.0, 5.0, th);
      const gYoke = new THREE.BoxGeometry(5.0, 1.0, th);
      for (let i = 0; i < plates; i++) {
        const z = -total / 2 + th / 2 + i * (th + gap);
        for (const [geo, x, y] of [[gLimb, -LIMB_X, 0], [gLimb, LIMB_X, 0], [gYoke, 0, 2.0], [gYoke, 0, -2.0]]) {
          const m = new THREE.Mesh(geo, coreMat);
          m.position.set(x, y, z);
          xfG.add(m);
        }
      }
      // 底座
      const base = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.3, 2.4), new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6 }));
      base.position.set(0, -2.65, 0);
      xfG.add(base);
    }
    // 铁芯中的磁通（铁芯表面前后两层箭头，Φ>0 表示“左柱向上、右柱向下”的顺时针方向）
    const fluxLines = [];
    for (const z of [0.78, -0.78]) {
      const pts = [];
      const cx = LIMB_X, cy = 2.0, rr = 0.5;
      const add = (x, y) => pts.push(V(x, y, z));
      // 圆角矩形（顺时针：左下 → 左上 → 右上 → 右下）
      const seg = 10;
      const corner = (ox, oy, a0) => { for (let i = 0; i <= seg; i++) { const a = a0 - (i / seg) * (Math.PI / 2); add(ox + rr * Math.cos(a), oy + rr * Math.sin(a)); } };
      corner(-cx + rr, cy - rr, Math.PI); // 左上角：从 (−cx, ·) 转到 (·, cy)
      corner(cx - rr, cy - rr, Math.PI / 2); // 右上角
      corner(cx - rr, -cy + rr, 0); // 右下角
      corner(-cx + rr, -cy + rr, -Math.PI / 2); // 左下角
      pts.push(pts[0].clone());
      fluxLines.push(pts);
    }
    const flux = new LineFlow(fluxLines, { opacity: 0.7, spacing: 0.75, arrowSize: 0.3, speed: 0 });
    flux.lines.visible = false;
    xfG.add(flux.object);

    // 线圈组（匝数变化时重建）
    const priG = new THREE.Group(), secG = new THREE.Group();
    priG.position.set(-LIMB_X, 0, 0);
    priG.rotation.z = -Math.PI / 2; // 线圈轴沿 y；引线朝 −x（外侧）
    secG.position.set(LIMB_X, 0, 0);
    secG.rotation.z = Math.PI / 2; // 引线朝 +x
    xfG.add(priG, secG);
    const CR = 0.95, CL = 2.4, LEAD = 0.8;
    let priFlow = null, secFlow = null, priE = null, secE = null;
    function buildCoil(g, N) {
      clearGroup(g);
      const turns = Math.max(2, Math.round(N / 40));
      const c = coil({ radius: CR, turns, length: CL, wire: Math.min(0.07, (CL / turns) * 0.36), leads: LEAD });
      g.add(c.mesh);
      const af = new ArrowFlow(c.curve, { count: Math.min(60, 8 + turns * 3), size: 0.2, speed: 0 });
      const ef = new Flow(c.curve, { count: Math.min(120, 16 + turns * 6), r: 0.05, speed: 0 });
      g.add(af.object, ef.object);
      return [af, ef];
    }
    function rebuildCoils() {
      [priFlow, priE] = buildCoil(priG, st.N1);
      [secFlow, secE] = buildCoil(secG, st.N2);
      lbPri.element.textContent = `初级线圈 N₁ = ${st.N1} 匝`;
      lbSec.element.textContent = `次级线圈 N₂ = ${st.N2} 匝`;
    }
    // 引线末端（世界坐标）：初级 (−X−CR−LEAD, ±CL/2)，次级 (X+CR+LEAD, ∓CL/2)
    const pe = -LIMB_X - CR - LEAD, se = LIMB_X + CR + LEAD;
    // 交流电源
    const src = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.7, 0.9), new THREE.MeshStandardMaterial({ color: 0x24242a, roughness: 0.5, metalness: 0.3 }));
    src.position.set(-6.4, 0, 0);
    xfG.add(src);
    const srcSym = textSprite('~', { size: 0.9, color: '#ffcc33' });
    srcSym.position.set(-6.4, 0.1, 0.48);
    xfG.add(srcSym);
    xfG.add(wire([V(pe, CL / 2, 0), V(-5.4, CL / 2, 0), V(-5.4, 0.5, 0), V(-5.85, 0.5, 0)], { radius: 0.05, corner: 0.2 }).mesh);
    xfG.add(wire([V(pe, -CL / 2, 0), V(-5.4, -CL / 2, 0), V(-5.4, -0.5, 0), V(-5.85, -0.5, 0)], { radius: 0.05, corner: 0.2 }).mesh);
    // 负载灯泡
    const lamp = bulb({ scale: 1.2 });
    lamp.position.set(6.4, -0.85, 0);
    xfG.add(lamp);
    const sock = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.7), new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6 }));
    sock.position.set(6.4, -1.35, 0);
    xfG.add(sock);
    xfG.add(wire([V(se, CL / 2, 0), V(5.4, CL / 2, 0), V(5.4, -1.3, 0), V(5.95, -1.3, 0)], { radius: 0.05, corner: 0.2 }).mesh);
    xfG.add(wire([V(se, -CL / 2, 0), V(se, -2.1, 0), V(7.2, -2.1, 0), V(7.2, -1.3, 0), V(6.85, -1.3, 0)], { radius: 0.05, corner: 0.2 }).mesh);

    const lbPri = addLabel(xfG, '初级线圈', 'orange small', -LIMB_X, -2.05 + 0.0, 1.5);
    const lbSec = addLabel(xfG, '次级线圈', 'orange small', LIMB_X, -2.05, 1.5);
    addLabel(xfG, '铁芯（硅钢片叠成）', 'small', 0, 2.95, 0);
    addLabel(xfG, '交变磁通 Φ', 'green small', 0, 1.0, 0.9);
    const lbSrc = addLabel(xfG, '交流电源 U₁', 'yellow small', -6.4, 1.25, 0);
    const lbLamp = addLabel(xfG, '灯泡（220 V 100 W）', 'small', 6.4, 0.65, 0);
    rebuildCoils();

    /* ======================= 远距离输电 ======================= */
    const gridG = new THREE.Group();
    scene.add(gridG);
    gridG.add(stageFloor({ radius: 17, y: -2 }));
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x9aa0ac, metalness: 0.7, roughness: 0.4 });
    const bldMat = new THREE.MeshStandardMaterial({ color: 0x5b616e, roughness: 0.7 });
    const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); gridG.add(m); return m; };
    // 发电厂：厂房 + 烟囱 + 冷却塔
    box(2.6, 1.6, 2.2, bldMat, -11.2, -1.2, 0);
    {
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 3.4, 16), new THREE.MeshStandardMaterial({ color: 0xb8b2a8, roughness: 0.7 }));
      ch.position.set(-12.0, -0.3, -0.7);
      gridG.add(ch);
      const prof = [];
      for (let i = 0; i <= 16; i++) { const t = i / 16; prof.push(new THREE.Vector2(0.95 - 0.45 * Math.sin(t * Math.PI * 0.85) + 0.05 * t, t * 2.6)); }
      const tower = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), new THREE.MeshStandardMaterial({ color: 0xcfcac0, roughness: 0.8, side: THREE.DoubleSide }));
      tower.position.set(-10.0, -2, -1.4);
      gridG.add(tower);
    }
    const steam = [];
    for (let i = 0; i < 6; i++) {
      const s = glowSprite(0xffffff, 1.2, 0);
      gridG.add(s);
      steam.push({ s, ph: i / 6 });
    }
    // 升压变压器
    box(1.2, 1.0, 1.4, bldMat, -8.2, -1.5, 0);
    const bush = (x, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x9c6b4f, roughness: 0.5 })); m.position.set(x, -0.75, z); gridG.add(m); };
    const PH = [{ y: 1.2, z: -1.2 }, { y: 1.2, z: 1.2 }, { y: 1.8, z: 0.7 }]; // 三相导线在塔上的挂点
    const BZ = [-0.45, 0.45, 0]; // 变压器套管位置
    for (const z of BZ) { bush(-8.2, z); bush(9.4, z); }
    // 输电塔
    const TX = [-5, -1, 3, 7];
    for (const x of TX) {
      const legs = [];
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const a = V(x + sx * 0.55, -2, sz * 0.55), b = V(x + sx * 0.12, 2.1, sz * 0.12);
        gridG.add(cylBetween(a, b, 0.04, towerMat));
        legs.push([a, b]);
      }
      for (const t of [0.25, 0.55, 0.8]) {
        const ring = legs.map(([a, b]) => a.clone().lerp(b, t));
        for (let i = 0; i < 4; i++) gridG.add(cylBetween(ring[i], ring[(i + 1) % 4], 0.025, towerMat));
        if (t < 0.6) for (let i = 0; i < 4; i++) gridG.add(cylBetween(ring[i], legs[(i + 1) % 4][0].clone().lerp(legs[(i + 1) % 4][1], t + 0.3), 0.02, towerMat));
      }
      gridG.add(cylBetween(V(x, 1.5, -1.4), V(x, 1.5, 1.4), 0.05, towerMat));
      gridG.add(cylBetween(V(x, 2.1, -0.2), V(x, 2.1, 0.9), 0.05, towerMat));
      gridG.add(cylBetween(V(x, 2.1, 0), V(x, 2.6, 0), 0.03, towerMat));
      for (const p of PH) gridG.add(cylBetween(V(x, p.y, p.z), V(x, p.y + (p.y > 1.5 ? 0.3 : 0.3), p.z), 0.05, new THREE.MeshStandardMaterial({ color: 0x7fb2d8, roughness: 0.3, metalness: 0.1 })));
    }
    // 降压变电站 + 围栏
    box(1.4, 1.0, 1.6, bldMat, 9.4, -1.5, 0);
    box(0.08, 0.6, 3.2, towerMat, 8.4, -1.7, 0);
    box(0.08, 0.6, 3.2, towerMat, 10.4, -1.7, 0);
    // 民居
    const winMats = [];
    const houses = [[11.6, -1.3], [12.9, 0.2], [11.7, 1.6]];
    for (const [x, z] of houses) {
      box(1.1, 0.9, 1.0, new THREE.MeshStandardMaterial({ color: 0xd9cbb4, roughness: 0.8 }), x, -1.55, z);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.6, 4), new THREE.MeshStandardMaterial({ color: 0x9a4a3a, roughness: 0.7 }));
      roof.rotation.y = Math.PI / 4;
      roof.position.set(x, -0.8, z);
      gridG.add(roof);
      const wm = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd27a, emissiveIntensity: 0 });
      winMats.push(wm);
      for (const dx of [-0.25, 0.25]) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.25), wm);
        w.position.set(x + dx, -1.5, z + 0.505);
        gridG.add(w);
      }
    }
    gridG.add(wire([V(10.1, -1.2, 0), V(11.0, -1.0, 0), V(11.6, -1.15, -1.0)], { radius: 0.02, color: 0x777777, corner: 0.2 }).mesh);
    gridG.add(wire([V(11.0, -1.0, 0), V(12.6, -1.05, 0.4)], { radius: 0.02, color: 0x777777 }).mesh);
    gridG.add(wire([V(11.0, -1.0, 0), V(11.6, -1.1, 1.2)], { radius: 0.02, color: 0x777777 }).mesh);

    // 三相输电线（带下垂）
    const lineMats = [];
    const lineCurves = [];
    PH.forEach((p, k) => {
      const anchors = [V(-8.2, -0.5, BZ[k]), ...TX.map((x) => V(x, p.y, p.z)), V(9.4, -0.5, BZ[k])];
      const pts = [];
      for (let i = 0; i < anchors.length - 1; i++) {
        const a = anchors[i], b = anchors[i + 1];
        const span = a.distanceTo(b);
        const sag = (i === 0 || i === anchors.length - 2) ? 0.12 : 0.06 * span;
        for (let j = i === 0 ? 0 : 1; j <= 14; j++) {
          const t = j / 14;
          const q = a.clone().lerp(b, t);
          q.y -= sag * 4 * t * (1 - t);
          pts.push(q);
        }
      }
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const mat = new THREE.MeshStandardMaterial({ color: 0x8a8f99, metalness: 0.8, roughness: 0.35, emissive: 0x000000, emissiveIntensity: 1 });
      lineMats.push(mat);
      gridG.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 320, 0.035, 6, false), mat));
      lineCurves.push({ curve, len: curve.getLength() });
    });
    // 沿导线流动的“电流”粒子（越往后越小：能量沿途损耗）
    const PER = 26;
    const pc = new ParticleCloud(PER * 3, { color: COLOR.current, r: 0.09, emissive: 1.8 });
    gridG.add(pc.mesh);
    const pu = Array.from({ length: PER * 3 }, (_, i) => (i % PER) / PER);

    addLabel(gridG, `发电厂 ${U_GEN} kV`, 'small', -11.2, 0.2, 1.2);
    addLabel(gridG, '升压变压器', 'yellow small', -8.2, -0.05, 1.3);
    addLabel(gridG, '降压变电站', 'yellow small', 9.4, -0.05, 1.5);
    addLabel(gridG, '用户 220 V', 'small', 12.3, 0.2, 1.6);
    const lbLine = addLabel(gridG, '', 'orange', 1.0, 3.2, 0);
    const lbHeat = addLabel(gridG, '', 'red small', -3.0, 0.35, 1.3);

    /* ======================= 面板 ======================= */
    ui.segmented({
      label: '演示',
      options: [{ value: 'xf', label: '变压器原理' }, { value: 'grid', label: '远距离输电' }],
      value: st.mode,
      onChange: (v) => setMode(v),
    });
    const sU1 = ui.slider({ label: '初级电压 U₁（有效值）', min: 0, max: 240, step: 5, value: st.U1, unit: 'V', digits: 0, onInput: (v) => { st.U1 = v; } });
    const sN1 = ui.slider({ label: '初级匝数 N₁', min: 50, max: 1000, step: 50, value: st.N1, unit: '匝', digits: 0, onInput: (v) => { if (v !== st.N1) { st.N1 = v; rebuildCoils(); } } });
    const sN2 = ui.slider({ label: '次级匝数 N₂', min: 50, max: 1000, step: 50, value: st.N2, unit: '匝', digits: 0, onInput: (v) => { if (v !== st.N2) { st.N2 = v; rebuildCoils(); } } });
    const tDC = ui.toggle({ label: '换成直流电源', value: false, onChange: (v) => { st.dc = v; dcPulse = 1; } });
    const sUt = ui.slider({
      label: '输电电压 U', min: 0, max: 2, step: 0.01, value: st.Ut,
      format: (v) => `${Math.round(10 * Math.pow(10, v))} kV`,
      onInput: (v) => { st.Ut = v; plot.redraw(); },
    });
    const sP = ui.slider({ label: '输送功率 P', min: 1, max: 15, step: 1, value: st.P, unit: 'MW', digits: 0, onInput: (v) => { st.P = v; plot.redraw(); } });
    const note = ui.note('');
    const roX = ui.readouts([
      { key: 'u1', label: '初级电压 U₁', unit: 'V', digits: 0 },
      { key: 'u2', label: '次级电压 U₂', unit: 'V', digits: 1 },
      { key: 'p', label: '功率 P₁ = P₂', unit: 'W', digits: 1 },
      { key: 'i1', label: '初级电流 I₁', unit: 'A', digits: 3 },
      { key: 'i2', label: '次级电流 I₂', unit: 'A', digits: 3 },
      { key: 'k', label: '变压比 N₁:N₂', unit: '', digits: 2 },
    ]);
    const roXEl = lastPanelEl(ui);
    const scope = ui.scope({
      title: '电压与磁通（放慢 100 倍）',
      height: 120, yMin: -1.2, yMax: 1.2, window: 300,
      series: [{ label: 'u₁', color: CSSCOLOR.efield }, { label: 'Φ', color: CSSCOLOR.bfield }, { label: 'u₂', color: CSSCOLOR.signal }],
    });
    const scopeEl = lastPanelEl(ui);
    const roG = ui.readouts([
      { key: 'u', label: '输电电压 U', unit: 'kV', digits: 0 },
      { key: 'i', label: '线路电流 I', unit: 'A', digits: 0 },
      { key: 'loss', label: '线路损耗 P损', unit: 'kW', digits: 1 },
      { key: 'pct', label: '损耗占比', unit: '%', digits: 2 },
      { key: 'out', label: '送到用户', unit: 'MW', digits: 2 },
    ]);
    const roGEl = lastPanelEl(ui);
    const lossPct = (Ukv) => (100 * st.P * 1e6 * R_LINE) / Math.pow(Ukv * 1e3, 2);
    const xOf = (Ukv) => (Math.log10(Ukv / 10) / 2) * 5;
    const plot = ui.plot({
      title: '输送相同功率时，线路损耗占比',
      height: 160, xMin: -0.45, xMax: 5.45, yMin: 0, yMax: 80,
      xLabel: '输电电压（对数刻度）', yLabel: '损耗 / 输送功率 (%)',
      series: [{ label: '常见电压等级', color: '#ff9f0a' }, { label: '当前', color: '#ffffff' }],
      draw(p) {
        const c = p.ctx;
        for (const u of BARS) {
          const x = xOf(u), val = Math.min(80, lossPct(u));
          c.fillStyle = 'rgba(255,159,10,.75)';
          const x0 = p.X(x - 0.17), x1 = p.X(x + 0.17);
          c.fillRect(x0, p.Y(val), x1 - x0, p.Y(0) - p.Y(val));
          const pct = lossPct(u);
          p.text(x, Math.min(74, val) + 3, pct >= 10 ? pct.toFixed(0) + '%' : pct >= 1 ? pct.toFixed(1) + '%' : pct.toFixed(2) + '%', 'rgba(255,255,255,.8)', 'center');
          p.text(x, 1.5, `${u}`, 'rgba(255,255,255,.45)', 'center');
        }
        p.fn((x) => Math.min(80, lossPct(10 * Math.pow(10, (x / 5) * 2))), 'rgba(255,255,255,.35)', 1.2, 120, [3, 3]);
        const U = 10 * Math.pow(10, st.Ut);
        p.vline(xOf(U), 'rgba(255,255,255,.5)');
        p.dot(xOf(U), Math.min(80, lossPct(U)), '#ffffff', 5);
      },
    });
    const plotEl = lastPanelEl(ui);
    ui.legend([
      { color: CSSCOLOR.bfield, label: '铁芯中的磁通' },
      { color: CSSCOLOR.current, label: '电流方向' },
      { color: CSSCOLOR.electron, label: '电子' },
    ]);

    const views = {
      xf: [[1.2, 3.0, 14.5], [0.2, -0.3, 0], 7.8],
      grid: [[0, 8, 21.5], [0, 0.2, 0], 14],
    };
    function setMode(m) {
      st.mode = m;
      xfG.visible = m === 'xf';
      gridG.visible = m === 'grid';
      const v = views[m];
      ctx.view(v[0], v[1], v[2]);
      for (const el of [sU1.el, sN1.el, sN2.el, tDC.el, roXEl, scopeEl]) setShown(el, m === 'xf');
      for (const el of [sUt.el, sP.el, roGEl, plotEl]) setShown(el, m === 'grid');
      lastNote = '';
      if (m === 'grid') plot.redraw();
    }

    /* ======================= 动画 ======================= */
    let ph = 0; // 交流相位
    let dcPulse = 0; // 切换直流时的瞬态
    let lastNote = '';
    const setNote = (h) => { if (h !== lastNote) { lastNote = h; note.set(h); } };
    const heat = new THREE.Color();
    const tmp = V();
    setMode('xf');

    return {
      update(dt, t) {
        if (st.mode === 'xf') {
          ph += 2 * Math.PI * F_VIS * dt;
          const k = st.N2 / st.N1;
          const U2 = st.dc ? 0 : st.U1 * k;
          const I2 = U2 / R_LOAD;
          const P2 = U2 * I2;
          const I1 = st.dc ? NaN : (st.U1 > 0 ? P2 / st.U1 : 0);
          const s = Math.sin(ph), c = Math.cos(ph);
          // 电流（与电压同相）、磁通（落后 90°）
          let iN, phiN, u2N;
          dcPulse = Math.max(0, dcPulse - dt * 2.5);
          if (st.dc) {
            iN = st.U1 > 0 ? 1 : 0;
            phiN = st.U1 > 0 ? 0.85 : 0;
            u2N = dcPulse * dcPulse;
          } else {
            iN = s;
            phiN = -c;
            u2N = s;
          }
          const on = st.U1 > 0;
          // 初级：电流顺曲线方向时铁芯左柱磁场向上（Φ 正方向）；次级电流的磁场与之相反
          const spd = on ? 1.6 : 0;
          priFlow.speed = spd * iN;
          priE.speed = -spd * iN;
          priFlow.object.visible = on;
          const secOn = on && !st.dc;
          secFlow.speed = secOn ? -spd * u2N : 0;
          secE.speed = secOn ? spd * u2N : 0;
          secFlow.object.visible = secOn || dcPulse > 0.05;
          priFlow.update(dt); priE.update(dt); secFlow.update(dt); secE.update(dt);
          flux.speed = on ? 1.4 * phiN : 0;
          flux.setStrength(on ? 0.35 + 0.65 * Math.abs(phiN) : 0);
          flux.object.visible = on;
          flux.update(dt);
          coreMat.emissiveIntensity = on ? 0.12 * Math.abs(phiN) : 0;
          lamp.userData.setLevel(st.dc ? dcPulse * 0.6 : U2 / 220);

          roX.set('u1', st.U1);
          roX.set('u2', U2);
          roX.set('p', P2);
          roX.set('i1', st.dc ? 0 : I1, st.dc ? (on ? '很大!' : '0') : undefined);
          roX.set('i2', I2);
          roX.set('k', st.N1 / st.N2, `${st.N1}:${st.N2}`);
          const Uref = Math.max(st.U1, st.U1 * k, 1) * 1.1;
          if (dt > 0) {
            scope.push(st.dc
              ? [on ? st.U1 / Uref : 0, phiN * 0.8, 0.9 * u2N]
              : [(st.U1 / Uref) * s, 0.8 * phiN * (on ? 1 : 0), ((st.U1 * k) / Uref) * s]);
          }
          lbSrc.element.textContent = st.dc ? `直流电源 U₁ = ${st.U1} V` : `交流电源 U₁ = ${st.U1} V`;
          lbLamp.element.textContent = `灯泡（220 V 100 W） U₂ = ${U2.toFixed(0)} V`;
          setNote(st.dc
            ? '<b>直流电</b>：铁芯中的磁通量恒定不变，次级线圈中没有感应电动势，灯泡不亮（只在接通瞬间闪一下）。初级线圈中电流只受导线电阻限制，会严重发热！'
            : st.U1 === 0
              ? '电源电压为 0。'
              : `${k > 1 ? '<b>升压</b>变压器' : k < 1 ? '<b>降压</b>变压器' : '匝数相同：电压不变（隔离变压器）'}：U₂ = U₁ × N₂/N₁ = ${st.U1} × ${st.N2}/${st.N1} ≈ <b>${U2.toFixed(0)} V</b>。电压${k > 1 ? '升高' : '降低'}了，电流就相应${k > 1 ? '减小' : '增大'}，功率不变。${U2 > 260 ? '<br><b style="color:#ff8a80">电压远超灯泡额定值 220 V，灯泡会被烧坏！</b>' : ''}`);
        } else {
          const Ukv = 10 * Math.pow(10, st.Ut);
          const I = (st.P * 1e6) / (Ukv * 1e3); // A
          const loss = I * I * R_LINE; // W
          const frac = Math.min(0.95, loss / (st.P * 1e6));
          // 粒子：速度表示电流大小，越往后越小表示能量沿途损耗
          const speed = 0.7 + 6 * Math.sqrt(I / 1500);
          for (let ph3 = 0; ph3 < 3; ph3++) {
            const { curve, len } = lineCurves[ph3];
            for (let j = 0; j < PER; j++) {
              const idx = ph3 * PER + j;
              pu[idx] = (pu[idx] + (speed * dt) / len) % 1;
              curve.getPointAt(pu[idx], tmp);
              pc.setAt(idx, tmp.x, tmp.y, tmp.z, 1.25 - pu[idx] * frac * 1.15);
            }
          }
          pc.commit();
          const hl = clamp(Math.sqrt(frac) * 1.25, 0, 1);
          heatColor(hl, heat);
          for (const m of lineMats) {
            m.emissive.copy(hl > 0.05 ? heat : heat.setRGB(0, 0, 0));
            m.emissiveIntensity = hl * 2.2;
          }
          for (const wm of winMats) wm.emissiveIntensity = 1.6 * (1 - frac);
          // 蒸汽
          for (const s of steam) {
            const u = (t * 0.25 + s.ph) % 1;
            s.s.position.set(-10.0 + u * 0.8, 0.7 + u * 2.4, -1.4);
            s.s.scale.setScalar(0.8 + u * 1.8);
            s.s.material.opacity = 0.28 * Math.sin(u * Math.PI);
          }
          lbLine.element.textContent = `线路电流 I = ${I >= 100 ? I.toFixed(0) : I.toFixed(1)} A`;
          lbHeat.element.textContent = frac > 0.05 ? `导线发热严重！损耗 ${(frac * 100).toFixed(0)}%` : '';
          lbHeat.visible = frac > 0.05;
          roG.set('u', Ukv);
          roG.set('i', I);
          if (loss >= 1e6) { roG.unit('loss', 'MW'); roG.set('loss', loss / 1e6, (loss / 1e6).toFixed(2)); }
          else { roG.unit('loss', 'kW'); roG.set('loss', loss / 1e3); }
          roG.set('pct', frac * 100);
          roG.set('out', st.P * (1 - frac));
          setNote(`发电厂输出 <b>${st.P} MW</b>，经升压变压器升到 <b>${Ukv.toFixed(0)} kV</b>，线路电流 I = P/U ≈ <b>${I.toFixed(0)} A</b>，导线（电阻 ${R_LINE} Ω）发热损耗 I²R ≈ <b>${loss >= 1e6 ? (loss / 1e6).toFixed(2) + ' MW' : (loss / 1e3).toFixed(1) + ' kW'}</b>，占 ${(frac * 100).toFixed(frac < 0.01 ? 3 : 1)}%。${Ukv < 60 ? '电压太低，电流太大，大量电能白白变成了热！' : '电压越高，电流越小，损耗越少。'}`);
        }
      },
    };
  },
};
