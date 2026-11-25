import * as THREE from 'three';
import { COLOR, CSSCOLOR, bulb, switchPart, Flow, stageFloor, disposeTree, clamp, lerp, V } from '../lib/kit.js';
import { Dots, SparkPool, addWire, bulbPath, pathOf, fmtSI } from '../lib/circuit-kit.js';

const TOP = 3.4; // 外电路顶部导线高度
const SW_X = -1.1, BULB_X = 1.05, BS = 0.85;
const ACCEL = 600; // 演示时间加速倍数（只用于容量消耗）
const C_ZN = 0xdfe6f0, C_CU2 = 0x2fe0c0, C_K = 0xc58cff, C_CL = 0x7be08a, C_NH4 = 0xc58cff, C_LI = 0xc58cff;

const CELLS = {
  daniell: {
    name: '锌铜原电池', cap: 1000,
    emf: (soc) => (soc <= 0 ? 0 : 1.1 - 0.01285 * Math.log((2 - soc) / Math.max(soc, 1e-3))),
    r: () => 2.0,
  },
  dry: {
    name: '锌锰干电池', cap: 1000,
    emf: (soc) => (soc <= 0 ? 0.9 : 1.55 - 0.25 * (1 - soc) - 0.35 * (1 - soc) ** 4),
    r: (soc) => 0.3 + 1.2 * (1 - soc) ** 2,
  },
  li: {
    name: '锂离子电池', cap: 4000,
    emf: (soc) => 3.0 + 0.6 * (1 - Math.exp(-12 * soc)) + 0.6 * soc * soc,
    r: () => 0.08,
  },
};

export default {
  id: 'battery',
  group: 'circuit',
  title: '电池：化学能变电能',
  subtitle: '氧化还原反应',
  summary: '电池把氧化还原反应拆成两半：负极失电子、正极得电子，电子只能绕道外电路。',
  lead: '电池里发生的是氧化还原反应：负极材料失去电子，正极材料得到电子。电池巧妙地把两处隔开，电子只能经过外面的导线和灯泡才能过去。切换三种电池，开合开关、调节负载，看离子和电子如何各走各的路。',
  formulas: [
    { expr: 'Zn → Zn<sup>2+</sup> + 2e<sup>−</sup>　|　Cu<sup>2+</sup> + 2e<sup>−</sup> → Cu', desc: '锌铜原电池：负极锌被氧化（失电子），正极溶液中的铜离子被还原（得电子）。总反应 Zn + Cu²⁺ → Zn²⁺ + Cu，电动势约 1.10 V。' },
    { expr: '<i>I</i> = <span class="frac"><span><i>E</i></span><span><i>R</i> + <i>r</i></span></span>，<i>U</i> = <i>E</i> − <i>Ir</i>', desc: '闭合电路欧姆定律：E 为电动势（V），r 为电池内阻（Ω），R 为外电路电阻，U 为路端电压（电池两极间实际电压）。' },
    { expr: '容量 <i>Q</i> = <i>I</i> · <i>t</i>，1 mAh = 3.6 C', desc: '电池容量表示它能放出的总电荷量。4000 mAh 的手机电池，以 400 mA 放电约能用 10 小时。' },
  ],
  sections: [
    {
      title: '电池是怎样产生电流的？',
      html: `<p>把一块锌直接丢进硫酸铜溶液里，锌表面会长出红色的铜，溶液蓝色变淡：锌原子把电子直接“递”给了铜离子，能量全变成了热。</p>
      <p><b>原电池</b>的妙处，是把这个反应<b>拆成两半</b>、分开进行：</p>
      <ul><li><b>负极（锌片）</b>：锌原子失去 2 个电子，变成 Zn²⁺ 离子溶入溶液——这叫<b>氧化</b>。画面中银白色小球从锌片上脱离。</li>
      <li><b>正极（铜片）</b>：溶液中的 Cu²⁺ 离子从铜片上得到 2 个电子，变成铜原子沉积下来——这叫<b>还原</b>。青色小球游向铜片并“落”在上面。</li></ul>
      <p>锌片上多出来的电子要到达铜片，只能走<b>外电路</b>：经过导线、开关、灯泡——灯就亮了。时间一长，锌片会越来越薄，铜片越来越厚。</p>`,
    },
    {
      title: '为什么电子从锌流向铜？',
      html: `<p>不同金属“抓住”电子的本领不同。锌比铜<b>活泼</b>，更容易失去电子；铜离子则更“想要”电子。这种差异形成了两极之间的电势差，叫做<b>电动势 E</b>，单位伏特。</p>
      <p>锌铜原电池的标准电动势是 <b>1.10 V</b>：铜电极的标准电势 +0.34 V，锌电极 −0.76 V，两者之差就是 1.10 V。换用不同的电极材料，电动势就不同——这是<b>金属活动性顺序</b>的电学体现。</p>
      <p><b>盐桥</b>（装有 KCl 凝胶的 U 形管）也必不可少：左边不断产生 Zn²⁺、右边不断消耗 Cu²⁺，如果不补充离子，两边溶液很快就会带上电，反应立刻停止。盐桥里的 Cl⁻（绿色）向锌一侧移动、K⁺（紫色）向铜一侧移动，保持两边电中性，让电路形成<b>闭合回路</b>：外电路靠电子导电，溶液和盐桥里靠离子导电。</p>`,
    },
    {
      title: '电动势、内阻与开关',
      html: `<p>断开开关试试：电路中没有电流，灯熄灭、离子也不再定向移动——但两极之间的<b>电压依然存在</b>，用电压表测得的就是电动势 E。电池就像一个“电荷水泵”，泵本身随时准备好了，只是管道没接通。</p>
      <p>闭合开关后，电流也要穿过电池<b>内部</b>（溶液、电极），这部分电阻叫<b>内阻 r</b>。于是：</p>
      <div class="eq"><i>I</i> = <i>E</i> / (<i>R</i> + <i>r</i>)，　<i>U</i> = <i>E</i> − <i>Ir</i></div>
      <p>负载电阻 R 越小，电流越大，内阻上“损失”的电压越多，路端电压 U 越低。把「负载电阻」调到最小看看。</p>
      <div class="warn">常见误区：“电池里储存着电子”。其实电池里电子的总数并不会减少，它储存的是<b>化学能</b>。电池“没电”，是能反应的物质（锌、铜离子）用完了。</div>`,
    },
    {
      title: '干电池和容量 mAh',
      html: `<p>遥控器里常用的 1.5 V <b>干电池</b>本质也是锌参与的原电池，只是把溶液做成了不会洒出来的<b>糊状</b>：</p>
      <ul><li><b>负极</b>：锌筒（外壳本身）。用久的旧电池锌皮会被“吃”穿，甚至漏液。</li>
      <li><b>正极</b>：中央的碳棒和周围的二氧化锰（MnO₂），MnO₂ 负责接收电子。</li>
      <li><b>电解质</b>：氯化铵（NH₄Cl）糊。碱性电池则换成氢氧化钾，容量更大。</li></ul>
      <p><b>容量</b>常用毫安时（mAh）表示：1000 mAh 意味着以 100 mA 放电能持续约 10 小时。注意干电池放电过程中电动势会逐渐降低、内阻逐渐增大，所以快没电时灯会越来越暗。</p>
      <p>画面中为了能看到电量变化，时间被加速了 600 倍。</p>`,
    },
    {
      title: '手机里的锂离子电池',
      html: `<p>锂离子电池是一种<b>可充电</b>电池，被称为“摇椅电池”——锂离子在两极之间来回摇摆：</p>
      <ul><li><b>负极</b>：石墨。碳原子排成一层层的平面，锂可以“嵌”在层与层之间。</li>
      <li><b>正极</b>：钴酸锂（LiCoO₂）等层状金属氧化物。</li>
      <li><b>隔膜</b>：布满微孔的塑料薄膜，只让 Li⁺ 离子通过，不让电子通过，防止两极直接接触短路。</li></ul>
      <p><b>放电</b>时，Li⁺ 从石墨层间出来，穿过电解液和隔膜进入正极；同时电子从负极经外电路（点亮灯泡）流到正极。<b>充电</b>时充电器用更高的电压把这一切“倒推”回去：Li⁺ 回到石墨，电子被压回负极。切换到「锂离子」再选「充电」观察。</p>
      <p>手机电池电压约 3.7 V（充满 4.2 V），能量密度是干电池的好几倍。充电时先以较大电流快充，接近充满时电流逐渐减小（恒流—恒压充电），这就是为什么“充到 80% 很快，最后 20% 很慢”。</p>`,
    },
    {
      title: '从伏打电堆说起',
      html: `<p>1780 年代，意大利医生伽伐尼发现，用两种不同金属接触青蛙腿，蛙腿会抽搐，他认为这是“动物电”。物理学家<b>伏打</b>（Volta）不同意：他认为电来自两种不同的金属。</p>
      <p>1800 年，伏打把锌片、浸过盐水的布片、铜片一层层叠起来，造出了<b>伏打电堆</b>——人类第一个能持续提供电流的装置。从此，人们才能做稳定电流的实验，电磁学由此起步。电压的单位“伏特”就是为纪念他而命名的。</p>
      <p>1836 年，英国化学家<b>丹尼尔</b>改进出了本章画面中的锌铜原电池（丹尼尔电池），电压稳定，曾被用于早期的电报系统。</p>
      <div class="tip">动手试试：在柠檬里插一枚镀锌钉和一枚铜币，就是一个约 0.9 V 的水果电池。几个串联起来，能点亮一只小 LED。</div>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.view([0, 1.4, 13.6], [0, 0.9, 0], 5.4);
    ctx.setBloom(0.75, 0.5, 0.75);
    scene.add(stageFloor({ y: -2.4 }));

    const root = new THREE.Group();
    scene.add(root);

    let type = 'daniell';
    let closed = true;
    let Rload = 5;
    let charging = false;
    let soc = 1;

    let bulbObj = null, sw = null, charger = null, flow = null, lbBulb = null, lbOpen = null;
    let cell = null; // 当前电池的动画对象 { update(dt, t, I), setSoc(soc) }

    const sparks = new SparkPool(24, { color: 0xffb070, size: 0.35 });
    scene.add(sparks.group);

    const glass = () => new THREE.MeshStandardMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
    const metal = (color, rough = 0.3) => new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: rough });
    const addLabel = (text, pos, cls = 'small') => { const l = ctx.label(text, { cls }); l.position.copy(pos); root.add(l); return l; };

    /* ---------- 外电路（三种电池共用）：负极 → 开关 → 灯泡 → 正极 ---------- */
    function external({ neg, negRoute, pos, posRoute, negIn, posIn }) {
      addWire(root, [neg, ...negRoute, V(SW_X - 0.45, TOP)], { radius: 0.055 });
      sw = switchPart({ length: 0.9 });
      sw.position.set(SW_X, TOP - 0.08, 0);
      sw.userData.set(closed);
      root.add(sw);
      const bp = V(BULB_X, TOP + 0.24 * BS, 0);
      addWire(root, [V(SW_X + 0.45, TOP), V(bp.x - 0.12 * BS, TOP)], { radius: 0.055 });
      addWire(root, [V(bp.x + 0.12 * BS, TOP), ...posRoute, pos], { radius: 0.055 });
      bulbObj = bulb({ scale: BS });
      bulbObj.position.copy(bp);
      root.add(bulbObj);
      // 充电器（锂电池充电时代替灯泡）
      charger = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.55), new THREE.MeshStandardMaterial({ color: 0x2a2d35, roughness: 0.5, metalness: 0.2 }));
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshStandardMaterial({ color: 0x3ddc97, emissive: 0x3ddc97, emissiveIntensity: 2 }));
      led.position.set(0.35, 0.15, 0.28);
      charger.add(box, led);
      charger.position.set(BULB_X, TOP + 0.35, 0);
      charger.visible = false;
      root.add(charger);
      const curve = pathOf([negIn, neg, ...negRoute, V(SW_X - 0.45, TOP), V(SW_X + 0.45, TOP), ...bulbPath(bp, BS), ...posRoute, pos, posIn], 0.25);
      flow = new Flow(curve, { count: Math.round(curve.getLength() * 3.2), color: COLOR.electron, r: 0.06, speed: 0, jitter: 0.01 });
      root.add(flow.object);
      lbBulb = addLabel('', V(BULB_X, TOP + 1.75, 0), 'small yellow');
      lbOpen = addLabel('', V(SW_X, TOP + 0.55, 0), 'small dim');
      addLabel('开关', V(SW_X, TOP - 0.45, 0), 'small dim');
    }

    /* ---------- 锌铜原电池 ---------- */
    function buildDaniell() {
      const BX = 2.6, BY = -0.2, BH = 2.8, BR = 1.25, LIQ_TOP = 0.5, LIQ_BOT = BY - BH / 2 + 0.03;
      for (const s of [-1, 1]) {
        const wall = new THREE.Mesh(new THREE.CylinderGeometry(BR, BR * 0.96, BH, 48, 1, true), glass());
        wall.position.set(s * BX, BY, 0);
        const bottom = new THREE.Mesh(new THREE.CircleGeometry(BR * 0.96, 48), glass());
        bottom.rotation.x = -Math.PI / 2;
        bottom.position.set(s * BX, BY - BH / 2, 0);
        const lh = LIQ_TOP - LIQ_BOT;
        const liq = new THREE.Mesh(
          new THREE.CylinderGeometry(BR * 0.955, BR * 0.93, lh, 48),
          new THREE.MeshStandardMaterial({ color: s < 0 ? 0xcfd8e6 : 0x2f7dff, transparent: true, opacity: s < 0 ? 0.14 : 0.32, roughness: 0.1, depthWrite: false })
        );
        liq.position.set(s * BX, LIQ_BOT + lh / 2, 0);
        liq.renderOrder = -1;
        root.add(wall, bottom, liq);
      }
      const PLATE_H = 3.0, PLATE_Y = 0.35, PLATE_T = 0.18;
      const zn = new THREE.Mesh(new THREE.BoxGeometry(PLATE_T, PLATE_H, 0.9), metal(0x9aa3ad, 0.45));
      zn.position.set(-BX, PLATE_Y, 0);
      const cu = new THREE.Mesh(new THREE.BoxGeometry(PLATE_T, PLATE_H, 0.9), metal(COLOR.copper, 0.35));
      cu.position.set(BX, PLATE_Y, 0);
      root.add(zn, cu);
      // 盐桥
      const bridgePts = [V(-1.85, -0.6), V(-1.85, 1.75), V(1.85, 1.75), V(1.85, -0.6)];
      const bridgeCurve = pathOf(bridgePts, 0.6);
      const bridge = new THREE.Mesh(
        new THREE.TubeGeometry(bridgeCurve, 120, 0.2, 16, false),
        new THREE.MeshStandardMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.28, roughness: 0.2, depthWrite: false })
      );
      root.add(bridge);
      const kFlow = new Flow(bridgeCurve, { count: 16, color: C_K, r: 0.065, speed: 0, jitter: 0.06 });
      const clFlow = new Flow(bridgeCurve, { count: 16, color: C_CL, r: 0.065, speed: 0, jitter: 0.06 });
      clFlow.offset = 0.5 / 16;
      root.add(kFlow.object, clFlow.object);

      // Zn²⁺：从锌片表面溶出
      const NZ = 30;
      const znDots = new Dots(NZ, { r: 0.075, color: C_ZN, emissive: 0x7d8aa0, emissiveIntensity: 0.6, segments: 10 });
      root.add(znDots.mesh);
      const zs = Array.from({ length: NZ }, () => ({ on: false, p: V(), v: V(), age: 0 }));
      let zNext = 0, zAcc = 0;
      // Cu²⁺：在溶液中游荡，按电流大小被“抓”到铜片上
      const NC = 26;
      const cuDots = new Dots(NC, { r: 0.075, color: C_CU2, emissive: C_CU2, emissiveIntensity: 0.7, segments: 10 });
      root.add(cuDots.mesh);
      const randCu = (p) => {
        for (let k = 0; k < 20; k++) {
          const a = Math.random() * Math.PI * 2, rr = 0.25 + Math.sqrt(Math.random()) * 0.85;
          p.set(BX + Math.cos(a) * rr, LIQ_BOT + 0.15 + Math.random() * (LIQ_TOP - LIQ_BOT - 0.3), Math.sin(a) * rr * 0.9);
          if (Math.abs(p.x - BX) > 0.3) break;
        }
        return p;
      };
      const cs = Array.from({ length: NC }, () => ({ p: randCu(V()), v: V(), st: 0, tgt: V(), grow: 1 }));
      let cAcc = 0;
      const plateT = { zn: PLATE_T, cu: PLATE_T };

      addLabel('负极 锌片：Zn − 2e⁻ → Zn²⁺（氧化）', V(-BX, -2.05, 0), 'small');
      addLabel('正极 铜片：Cu²⁺ + 2e⁻ → Cu（还原）', V(BX, -2.05, 0), 'small');
      addLabel('ZnSO₄ 溶液', V(-BX - 0.62, -1.25, 0.9), 'small dim');
      addLabel('CuSO₄ 溶液', V(BX + 0.62, -1.25, 0.9), 'small cyan');
      addLabel('盐桥（KCl）', V(0, 2.2, 0), 'small purple');

      external({
        neg: V(-BX, PLATE_Y + PLATE_H / 2), negRoute: [V(-BX, TOP)],
        pos: V(BX, PLATE_Y + PLATE_H / 2), posRoute: [V(BX, TOP)],
        negIn: V(-BX, -0.6), posIn: V(BX, -0.6),
      });

      const tmp = V();
      return {
        setSoc(s) {
          plateT.zn = PLATE_T * (0.25 + 0.75 * s);
          plateT.cu = PLATE_T * (1 + 0.6 * (1 - s));
          zn.scale.x = plateT.zn / PLATE_T;
          cu.scale.x = plateT.cu / PLATE_T;
        },
        update(dt, t, I) {
          const ionSpeed = clamp(I * 3, 0, 3);
          kFlow.speed = ionSpeed * 0.8;
          clFlow.speed = -ionSpeed * 0.8;
          kFlow.update(dt); clFlow.update(dt);
          // 生成 Zn²⁺
          zAcc += I * 30 * dt;
          while (zAcc >= 1) {
            zAcc -= 1;
            const z = zs[zNext];
            zNext = (zNext + 1) % NZ;
            const side = Math.random() < 0.5 ? -1 : 1;
            z.on = true; z.age = 0;
            z.p.set(-BX + side * (plateT.zn / 2 + 0.07), -1.0 + Math.random() * 1.35, (Math.random() * 2 - 1) * 0.38);
            z.v.set(side * (0.45 + Math.random() * 0.3), (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.3);
            sparks.spawn(z.p.x, z.p.y, z.p.z, { size: 0.3, peak: 0.6, life: 0.25, color: 0xc8d6ff });
          }
          for (let i = 0; i < NZ; i++) {
            const z = zs[i];
            if (!z.on) { znDots.hide(i); continue; }
            if (dt > 0) {
              z.age += dt;
              z.v.x += (Math.random() - 0.5) * dt * 2.5;
              z.v.y += (Math.random() - 0.5) * dt * 2.5;
              z.v.z += (Math.random() - 0.5) * dt * 2.5;
              z.v.multiplyScalar(1 - dt * 0.8);
              z.p.addScaledVector(z.v, dt);
              const dx = z.p.x + BX, dz = z.p.z, rr = Math.hypot(dx, dz);
              if (rr > 1.1) { z.p.x = -BX + (dx / rr) * 1.1; z.p.z = (dz / rr) * 1.1; z.v.x *= -0.5; z.v.z *= -0.5; }
              if (Math.abs(dx) < plateT.zn / 2 + 0.07 && Math.abs(dz) < 0.47) { z.p.x = -BX + Math.sign(dx || 1) * (plateT.zn / 2 + 0.07); z.v.x *= -0.5; }
              z.p.y = clamp(z.p.y, LIQ_BOT + 0.1, LIQ_TOP - 0.08);
              if (z.age > 8) z.on = false;
            }
            const sc = z.age > 7 ? Math.max(0, 8 - z.age) : Math.min(1, z.age * 4);
            znDots.setAt(i, z.p.x, z.p.y, z.p.z, sc);
          }
          znDots.commit();
          // Cu²⁺ 沉积
          cAcc += I * 30 * dt;
          while (cAcc >= 1) {
            cAcc -= 1;
            const free = cs.filter((c) => c.st === 0);
            if (!free.length) break;
            const c = free[(Math.random() * free.length) | 0];
            c.st = 1;
            const side = c.p.x < BX ? -1 : 1;
            c.tgt.set(BX + side * (plateT.cu / 2 + 0.06), clamp(c.p.y, LIQ_BOT + 0.2, LIQ_TOP - 0.15), clamp(c.p.z, -0.4, 0.4));
          }
          for (let i = 0; i < NC; i++) {
            const c = cs[i];
            if (dt > 0) {
              if (c.st === 0) {
                c.v.x += (Math.random() - 0.5) * dt * 2; c.v.y += (Math.random() - 0.5) * dt * 2; c.v.z += (Math.random() - 0.5) * dt * 2;
                c.v.multiplyScalar(1 - dt * 0.9);
                c.p.addScaledVector(c.v, dt);
                const dx = c.p.x - BX, dz = c.p.z, rr = Math.hypot(dx, dz);
                if (rr > 1.1) { c.p.x = BX + (dx / rr) * 1.1; c.p.z = (dz / rr) * 1.1; c.v.multiplyScalar(-0.5); }
                if (Math.abs(dx) < plateT.cu / 2 + 0.08 && Math.abs(dz) < 0.47) { c.p.x = BX + Math.sign(dx || 1) * (plateT.cu / 2 + 0.08); c.v.x *= -0.5; }
                c.p.y = clamp(c.p.y, LIQ_BOT + 0.1, LIQ_TOP - 0.08);
                c.grow = Math.min(1, c.grow + dt * 2);
              } else {
                tmp.subVectors(c.tgt, c.p);
                const d = tmp.length();
                const step = (0.9 + ionSpeed * 0.4) * dt;
                if (d <= step) {
                  sparks.spawn(c.tgt.x, c.tgt.y, c.tgt.z, { size: 0.4, peak: 0.9, life: 0.35, color: 0xff9a50 });
                  randCu(c.p);
                  c.st = 0; c.grow = 0; c.v.set(0, 0, 0);
                } else c.p.addScaledVector(tmp, step / d);
              }
            }
            cuDots.setAt(i, c.p.x, c.p.y, c.p.z, c.grow);
          }
          cuDots.commit();
        },
      };
    }

    /* ---------- 锌锰干电池（横放剖面） ---------- */
    function sector(rIn, rOut, len, color, opts = {}) {
      const a0 = Math.PI, a1 = Math.PI * 2.5; // 缺口朝向 +y、+z（正对镜头的上前方）
      const sh = new THREE.Shape();
      if (rIn <= 0) {
        sh.moveTo(0, 0);
        sh.lineTo(Math.cos(a0) * rOut, Math.sin(a0) * rOut);
        sh.absarc(0, 0, rOut, a0, a1, false);
        sh.lineTo(0, 0);
      } else {
        sh.moveTo(Math.cos(a0) * rOut, Math.sin(a0) * rOut);
        sh.absarc(0, 0, rOut, a0, a1, false);
        sh.lineTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn);
        sh.absarc(0, 0, rIn, a1, a0, true);
        sh.closePath();
      }
      const geo = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false, curveSegments: 40 });
      geo.translate(0, 0, -len / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.7, metalness: opts.metal ?? 0.05, side: THREE.DoubleSide }));
      m.rotation.y = Math.PI / 2;
      return m;
    }
    function buildDry() {
      const CY = 0.3, LEN = 3.4, h = LEN / 2;
      const g = new THREE.Group();
      g.position.y = CY;
      root.add(g);
      g.add(sector(1.0, 1.06, LEN, 0x2c6fd6, { rough: 0.5 }));
      g.add(sector(0.9, 1.0, LEN, 0x9aa3ad, { metal: 0.8, rough: 0.35 }));
      g.add(sector(0.8, 0.9, LEN, 0xd8cfa8));
      g.add(sector(0.2, 0.8, LEN - 0.1, 0x2a2622, { rough: 0.95 }));
      const rodLen = LEN + 0.1;
      const rod = sector(0, 0.2, rodLen, 0x4a4c53, { rough: 0.6 });
      rod.position.x = 0.05;
      g.add(rod);
      const bottom = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.06, 0.06, 48), metal(0x9aa3ad, 0.35));
      bottom.rotation.z = Math.PI / 2;
      bottom.position.x = -h - 0.03;
      const capM = metal(0xd9b45a, 0.25);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 32), capM);
      cap.rotation.z = Math.PI / 2;
      cap.position.x = h + 0.12;
      const seal = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.05, 48), new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.8 }));
      seal.rotation.z = Math.PI / 2;
      seal.position.x = h + 0.01;
      g.add(bottom, cap, seal);

      // 剖面上的离子（贴在两个切面上运动）
      const NI = 40;
      const dots = new Dots(NI, { r: 0.06, color: 0xffffff, emissive: 0x555566, emissiveIntensity: 0.6, segments: 10 });
      for (let i = 0; i < NI; i++) dots.setColor(i, i < 20 ? C_ZN : C_NH4);
      g.add(dots.mesh);
      const ions = Array.from({ length: NI }, (_, i) => ({ on: false, kind: i < 20 ? 'zn' : 'nh4', face: 0, x: 0, r: 0, age: 0 }));
      let accZ = 0, accN = 0;
      const place = (i, it, s) => {
        const off = 0.02;
        if (it.face === 0) dots.setAt(i, it.x, off, it.r, s);
        else dots.setAt(i, it.x, it.r, off, s);
      };
      const spawn = (kind) => {
        const it = ions.find((o) => !o.on && o.kind === kind);
        if (!it) return;
        it.on = true; it.age = 0; it.face = Math.random() < 0.5 ? 0 : 1;
        it.x = -h + 0.2 + Math.random() * (LEN - 0.4);
        it.r = kind === 'zn' ? 0.88 : 0.84;
      };

      addLabel('锌筒（负极，被逐渐消耗）', V(-0.9, CY - 1.4, 0.6), 'small');
      addLabel('碳棒 + 铜帽（正极）', V(2.1, CY + 0.75, 0), 'small');
      addLabel('二氧化锰 + 炭粉', V(-0.4, CY + 0.55, 0.55), 'small dim');
      addLabel('糊状电解质 NH₄Cl', V(0.5, CY - 0.25, 1.3), 'small dim');

      external({
        neg: V(-h - 0.06, CY), negRoute: [V(-2.6, CY), V(-2.6, TOP)],
        pos: V(h + 0.22, CY), posRoute: [V(2.6, TOP), V(2.6, CY)],
        negIn: V(-h + 0.6, CY, -0.35), posIn: V(h - 0.6, CY, -0.08),
      });

      return {
        setSoc() {},
        update(dt, t, I) {
          accZ += I * 22 * dt;
          accN += I * 22 * dt;
          while (accZ >= 1) { accZ -= 1; spawn('zn'); }
          while (accN >= 1) { accN -= 1; spawn('nh4'); }
          for (let i = 0; i < NI; i++) {
            const it = ions[i];
            if (!it.on) { dots.hide(i); continue; }
            it.age += dt;
            if (it.kind === 'zn') {
              // Zn²⁺ 从锌筒内壁溶出，进入电解质糊
              it.r = Math.max(0.81, it.r - dt * 0.05);
              it.x += Math.sin(t * 3 + i) * dt * 0.05;
              if (it.age > 3) { it.on = false; dots.hide(i); continue; }
              place(i, it, Math.min(1, it.age * 4) * (it.age > 2.5 ? (3 - it.age) * 2 : 1));
            } else {
              // NH₄⁺ 向碳棒方向迁移，在正极附近参与还原反应
              it.r -= dt * 0.32;
              it.x += Math.sin(t * 2.3 + i * 1.7) * dt * 0.06;
              if (it.r <= 0.23) {
                const wx = it.x, wy = it.face === 0 ? 0.02 : 0.23, wz = it.face === 0 ? 0.23 : 0.02;
                sparks.spawn(wx, CY + wy, wz, { size: 0.3, peak: 0.8, life: 0.3, color: 0xffb070 });
                it.on = false; dots.hide(i); continue;
              }
              place(i, it, Math.min(1, it.age * 4));
            }
          }
          dots.commit();
        },
      };
    }

    /* ---------- 锂离子电池（剖面） ---------- */
    function buildLi() {
      const CY = 0.3, W = 4.4, Hh = 2.6, D = 1.2;
      const g = new THREE.Group();
      g.position.y = CY;
      root.add(g);
      const caseGeo = new THREE.BoxGeometry(W + 0.3, Hh + 0.2, D);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(caseGeo), new THREE.LineBasicMaterial({ color: 0x7a8396, transparent: true, opacity: 0.7 }));
      caseGeo.dispose();
      const elec = new THREE.Mesh(new THREE.BoxGeometry(W, Hh, D - 0.05), new THREE.MeshStandardMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.07, depthWrite: false }));
      g.add(edges, elec);
      const cuFoil = new THREE.Mesh(new THREE.BoxGeometry(0.12, Hh, 1.05), metal(COLOR.copper, 0.35));
      cuFoil.position.x = -2.2;
      const alFoil = new THREE.Mesh(new THREE.BoxGeometry(0.12, Hh, 1.05), metal(0xc9ced6, 0.3));
      alFoil.position.x = 2.2;
      g.add(cuFoil, alFoil);
      const gMat = new THREE.MeshStandardMaterial({ color: 0x3d4048, roughness: 0.8 });
      const cMat = new THREE.MeshStandardMaterial({ color: 0x4a5f9a, roughness: 0.6 });
      const sheetGeoA = new THREE.BoxGeometry(1.8, 0.05, 1.0);
      const sheetGeoC = new THREE.BoxGeometry(1.8, 0.08, 1.0);
      const rows = 6, gap = 0.42, y0 = -1.05;
      for (let k = 0; k < rows; k++) {
        const a = new THREE.Mesh(sheetGeoA, gMat);
        a.position.set(-1.2, y0 + k * gap, 0);
        const c = new THREE.Mesh(sheetGeoC, cMat);
        c.position.set(1.2, y0 + k * gap, 0);
        g.add(a, c);
      }
      const sep = new THREE.Mesh(new THREE.BoxGeometry(0.05, Hh, 1.05), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, roughness: 0.6, depthWrite: false }));
      g.add(sep);

      // 嵌锂位置
      const slotsA = [], slotsC = [];
      for (let k = 0; k < rows - 1; k++) for (let i = 0; i < 8; i++) {
        const y = y0 + gap / 2 + k * gap;
        slotsA.push(V(-2.0 + i * 0.22, y, 0.15));
        slotsC.push(V(0.4 + i * 0.22, y, 0.15));
      }
      const NL = 30;
      const liDots = new Dots(NL, { r: 0.085, color: C_LI, emissive: C_LI, emissiveIntensity: 1.1, segments: 12 });
      g.add(liDots.mesh);
      const occA = new Array(slotsA.length).fill(-1), occC = new Array(slotsC.length).fill(-1);
      const li = [];
      for (let i = 0; i < NL; i++) {
        const s = Math.floor((i * slotsA.length) / NL);
        occA[s] = i;
        li.push({ side: 0, slot: s, moving: false, from: slotsA[s].clone(), to: V(), u: 0 });
      }
      const pickFree = (occ) => {
        const free = [];
        occ.forEach((o, i) => { if (o < 0) free.push(i); });
        return free.length ? free[(Math.random() * free.length) | 0] : -1;
      };
      let cool = 0;
      const pos = V();

      addLabel('石墨负极：锂嵌在碳层之间', V(-1.2, CY - 1.65, 0), 'small');
      addLabel('钴酸锂正极', V(1.2, CY - 1.65, 0), 'small');
      addLabel('隔膜：只让 Li⁺ 通过', V(0, CY + 1.62, 0.3), 'small dim');
      addLabel('Li⁺', V(-0.25, CY + 0.15, 0.7), 'small purple');

      external({
        neg: V(-2.2, CY + Hh / 2), negRoute: [V(-2.2, TOP)],
        pos: V(2.2, CY + Hh / 2), posRoute: [V(2.2, TOP)],
        negIn: V(-2.2, CY + 0.2), posIn: V(2.2, CY + 0.2),
      });

      return {
        setSoc() {},
        update(dt) {
          // 让负极中的锂数量跟随电量（含正在途中的）
          cool -= dt;
          let inA = 0;
          for (const l of li) if ((l.moving ? l.toSide : l.side) === 0) inA++;
          const target = Math.round(NL * soc);
          if (cool <= 0 && inA !== target) {
            const fromSide = inA > target ? 0 : 1;
            const cands = li.filter((l) => !l.moving && l.side === fromSide);
            if (cands.length) {
              const l = cands[(Math.random() * cands.length) | 0];
              const occTo = fromSide === 0 ? occC : occA;
              const s = pickFree(occTo);
              if (s >= 0) {
                (fromSide === 0 ? occA : occC)[l.slot] = -1;
                occTo[s] = li.indexOf(l);
                l.from.copy((fromSide === 0 ? slotsA : slotsC)[l.slot]);
                l.to.copy((fromSide === 0 ? slotsC : slotsA)[s]);
                l.slot = s; l.toSide = 1 - fromSide; l.moving = true; l.u = 0;
                cool = 0.05;
              }
            }
          }
          for (let i = 0; i < NL; i++) {
            const l = li[i];
            if (l.moving) {
              l.u += dt / 1.4;
              if (l.u >= 1) { l.u = 1; l.moving = false; l.side = l.toSide; }
              const e = l.u * l.u * (3 - 2 * l.u);
              pos.lerpVectors(l.from, l.to, e);
              pos.y += Math.sin(Math.PI * l.u) * 0.18 * (i % 2 ? 1 : -1);
              pos.z = lerp(0.15, 0.4, Math.sin(Math.PI * l.u));
            } else {
              pos.copy((l.side === 0 ? slotsA : slotsC)[l.slot]);
            }
            liDots.setAt(i, pos.x, pos.y, pos.z, 1);
          }
          liDots.commit();
        },
      };
    }

    function build() {
      disposeTree(root);
      root.clear();
      if (type === 'daniell') cell = buildDaniell();
      else if (type === 'dry') cell = buildDry();
      else cell = buildLi();
      cell.setSoc(soc);
      if (segChg) segChg.el.style.display = type === 'li' ? '' : 'none';
    }

    /* ---------- 面板 ---------- */
    ui.segmented({
      label: '电池类型',
      options: [{ value: 'daniell', label: '锌铜电池' }, { value: 'dry', label: '干电池' }, { value: 'li', label: '锂离子' }],
      value: type,
      onChange: (v) => { type = v; soc = 1; charging = false; segChg?.set('dis'); build(); },
    });
    const segChg = ui.segmented({
      label: '锂电池工作状态',
      options: [{ value: 'dis', label: '放电' }, { value: 'chg', label: '充电' }],
      value: 'dis',
      onChange: (v) => { charging = v === 'chg'; },
    });
    ui.toggle({ label: '开关闭合', value: closed, onChange: (v) => { closed = v; sw?.userData.set(v); } });
    ui.slider({ label: '负载（灯泡）电阻 R', min: 1, max: 20, step: 0.5, value: Rload, unit: 'Ω', digits: 1, onInput: (v) => { Rload = v; } });
    ui.button({ label: '换一节新电池', onClick: () => { soc = 1; cell?.setSoc(soc); } });
    const note = ui.note('');
    const read = ui.readouts([
      { key: 'E', label: '电动势 E', unit: 'V', digits: 2 },
      { key: 'U', label: '路端电压 U', unit: 'V', digits: 2 },
      { key: 'I', label: '电流 I', unit: 'A' },
      { key: 'Q', label: '剩余容量', unit: 'mAh', digits: 0 },
      { key: 'pct', label: '剩余电量', unit: '%', digits: 0 },
    ]);
    ui.legend([
      { color: CSSCOLOR.electron, label: '电子 e⁻' },
      { color: '#dfe6f0', label: 'Zn²⁺' },
      { color: '#2fe0c0', label: 'Cu²⁺' },
      { color: '#c58cff', label: 'K⁺ / NH₄⁺ / Li⁺' },
      { color: '#7be08a', label: 'Cl⁻' },
    ]);

    build();

    let noteKey = '';
    return {
      update(dt, t) {
        const c = CELLS[type];
        const E = c.emf(soc), r = c.r(soc);
        let I = 0, U = E;
        const isChg = type === 'li' && charging;
        if (closed && isChg) {
          const Ich = soc >= 0.999 ? 0 : soc < 0.85 ? 2 : 0.05 + (2 * (1 - soc)) / 0.15;
          I = -Ich;
          U = E + Ich * r;
          soc = Math.min(1, soc + (Ich * dt * ACCEL) / (c.cap * 3.6));
        } else if (closed && soc > 0) {
          I = E / (Rload + r);
          U = E - I * r;
          soc = Math.max(0, soc - (I * dt * ACCEL) / (c.cap * 3.6));
        }
        cell.setSoc(soc);
        cell.update(dt, t, Math.abs(I));
        sw.userData.update(dt);
        flow.speed = (I >= 0 ? 1 : -1) * clamp(Math.abs(I) * 3, 0, 4);
        flow.update(dt);
        sparks.update(dt);
        const Pb = I > 0 ? I * I * Rload : 0;
        bulbObj.visible = !isChg;
        charger.visible = isChg;
        bulbObj.userData.setLevel(Math.min(1.2, Math.sqrt(Pb / 1.2)));
        lbBulb.element.textContent = isChg ? `充电器：I = ${fmtSI(-I, 'A')}` : `灯泡：I = ${fmtSI(I, 'A')}，P = ${fmtSI(Pb, 'W')}`;
        lbOpen.element.textContent = closed ? '' : `断路：I = 0，但两极间仍有 ${E.toFixed(2)} V 电压`;
        lbOpen.visible = !closed;

        read.set('E', E);
        read.set('U', U);
        const s = fmtSI(Math.abs(I), 'A').split(' ');
        read.set('I', I, (I < 0 ? '−' : '') + s[0]);
        read.unit('I', s[1] ?? 'A');
        read.set('Q', soc * c.cap);
        read.set('pct', soc * 100);

        const key = `${type}|${closed}|${isChg}|${soc <= 0 ? 0 : soc >= 0.999 ? 2 : 1}`;
        if (key !== noteKey) {
          noteKey = key;
          let msg;
          if (!closed) msg = `<b>开关断开</b>：外电路不通，电子无路可走，两极的反应也随之停止。但电池两极之间<b>依然有 ${E.toFixed(2)} V 的电动势</b>——这正是电压表在断路时测到的值。`;
          else if (soc <= 0 && !isChg) msg = '<b>电池耗尽</b>：能发生反应的物质用完了，电动势下降、电流停止。点「换一节新电池」。';
          else if (isChg) msg = soc >= 0.999 ? '<b>已充满</b>：充电器停止充电。' : `<b>充电中</b>：充电器以高于电池电动势的电压把电子“压回”负极，Li⁺ 穿过隔膜回到石墨层间储存起来。${soc > 0.85 ? '接近充满，进入恒压阶段，电流逐渐减小。' : '目前是恒流快充阶段。'}`;
          else if (type === 'daniell') msg = '<b>放电中</b>：锌片失去电子溶解成 Zn²⁺；电子经导线流向铜片，溶液中的 Cu²⁺ 在铜片上得到电子析出铜。盐桥中的离子移动使两边溶液保持电中性。（时间加速 600 倍）';
          else if (type === 'dry') msg = '<b>放电中</b>：锌筒被氧化成 Zn²⁺ 放出电子，电子经外电路到达碳棒，正极的 MnO₂ 与 NH₄⁺ 在那里接收电子。电量越少，电动势越低、内阻越大。（时间加速 600 倍）';
          else msg = '<b>放电中</b>：锂离子离开石墨层，穿过隔膜嵌入正极；电子则经外电路从负极流向正极，点亮灯泡。（时间加速 600 倍）';
          note.set(msg);
        }
      },
    };
  },
};
