import * as THREE from 'three';
import { COLOR, CSSCOLOR, ParticleCloud, glowSprite, stageFloor, wire, damp, clamp, lerp, V } from '../lib/kit.js';
import { readoutsEl, showEl, signed, sci, viewFit, setLabel } from '../lib/basics-kit.js';

const GA = Math.PI * (3 - Math.sqrt(5));
const E_PER_NC = 6.242e9; // 1 nC ≈ 6.24×10⁹ 个电子的电量
const frac = (x) => x - Math.floor(x);
/** 二进制反序数（van der Corput 序列）：取前 k 个时在序号上均匀散开，用来“均匀地”挑位置 */
const rad2 = (i) => { let u = 0, f = 0.5; i = Math.floor(i); while (i > 0) { u += (i & 1) * f; i >>= 1; f *= 0.5; } return u; };

/** 球面上均匀分布的 n 个方向（斐波那契点） */
function fibSphere(n, rot = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = GA * i + rot;
    out.push(V(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  return out;
}
/** 朝向 +z（镜头）的半球上的 n 个方向 */
function fibHemi(n, rot = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const z = 0.15 + 0.85 * ((i + 0.5) / n);
    const r = Math.sqrt(1 - z * z);
    const a = GA * i + rot;
    out.push(V(Math.cos(a) * r, Math.sin(a) * r, z));
  }
  return out;
}
/** 与球面相切的一个小偏移（让“配对电子”紧挨着正电荷） */
function besides(dir, amount) {
  const t = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0)).normalize();
  return dir.clone().addScaledVector(t, amount).normalize();
}

/**
 * 导体中的电荷分布模型。
 * slots：电子可以待的位置。paired = 紧挨着一个正离子（电子待在这里时该处呈电中性）；extra = 额外位置（多出来的电子待的地方）。
 * key：沿“极化方向”的坐标（-1..1），pCont > 0 时电子偏爱 key 小的一侧；u：均匀分布用的序号（0..1）。
 * 给定电子总数 Ne 与极化强度 pCont，算出哪些位置有电子，再把电子平滑地挪过去。
 */
class ChargeSystem {
  constructor(slots, getPos) {
    this.slots = slots;
    this.getPos = getPos;
    this.pairedIdx = [];
    this.extraIdx = [];
    slots.forEach((s, i) => (s.paired ? this.pairedIdx : this.extraIdx).push(i));
    this.nPaired = this.pairedIdx.length;
    this.max = slots.length;
    this.occ = new Uint8Array(this.max);
    this.taken = new Uint8Array(this.max);
    this.eSlot = new Int16Array(this.max).fill(-1);
    this.ePos = Array.from({ length: this.max }, () => new THREE.Vector3());
    this.Ne = 0;
    this._key = null;
    this._tmp = new THREE.Vector3();
    this.reset();
  }
  reset() {
    this.Ne = 0;
    this.eSlot.fill(-1);
    for (const s of this.pairedIdx) { this.eSlot[this.Ne] = s; this.getPos(s, this.ePos[this.Ne]); this.Ne++; }
    this._key = null;
  }
  /** 多出来的电子数（负数表示缺电子） */
  get X() { return this.Ne - this.nPaired; }
  layout(pCont) {
    const X = this.X;
    const P = Math.round(Math.abs(pCont));
    const w = Math.round(clamp(Math.abs(pCont) / 2.5, 0, 1) * 8) / 8;
    const sg = pCont >= 0 ? 1 : -1;
    const key = `${X}|${P}|${w}|${sg}`;
    if (key === this._key) return;
    this._key = key;
    // A：多余电子（占 extra 位置）；B：空出来的正离子（paired 位置没有电子）。A − B = X
    let A, B;
    if (X >= 0) { B = Math.max(0, P - X); A = B + X; } else { A = Math.max(0, P + X); B = A - X; }
    A = Math.min(A, this.extraIdx.length);
    B = Math.min(B, this.nPaired);
    const sl = this.slots;
    const e = (i) => w * sg * sl[i].key + (1 - w) * (2 * sl[i].u - 1);
    this.occ.fill(0);
    const pi = this.pairedIdx.slice().sort((a, b) => e(b) - e(a));
    for (let k = B; k < pi.length; k++) this.occ[pi[k]] = 1;
    const ex = this.extraIdx.slice().sort((a, b) => e(a) - e(b));
    for (let k = 0; k < A; k++) this.occ[ex[k]] = 1;
    this._assign();
  }
  _assign() {
    const taken = this.taken;
    taken.fill(0);
    const homeless = [];
    for (let i = 0; i < this.Ne; i++) {
      const s = this.eSlot[i];
      if (s >= 0 && this.occ[s] && !taken[s]) taken[s] = 1;
      else homeless.push(i);
    }
    for (const i of homeless) {
      let best = -1, bd = Infinity;
      for (let s = 0; s < this.max; s++) {
        if (!this.occ[s] || taken[s]) continue;
        const d = this.getPos(s, this._tmp).distanceToSquared(this.ePos[i]);
        if (d < bd) { bd = d; best = s; }
      }
      this.eSlot[i] = best;
      if (best >= 0) taken[best] = 1;
    }
  }
  add(p) {
    if (this.Ne >= this.max) return;
    const i = this.Ne++;
    this.eSlot[i] = -1;
    this.ePos[i].copy(p);
    this._key = null;
  }
  removeNearest(p) {
    if (this.Ne <= 0) return;
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.Ne; i++) {
      const d = this.ePos[i].distanceToSquared(p);
      if (d < bd) { bd = d; best = i; }
    }
    const last = this.Ne - 1;
    this.eSlot[best] = this.eSlot[last];
    this.ePos[best].copy(this.ePos[last]);
    this.eSlot[last] = -1;
    this.Ne--;
    this._key = null;
  }
  step(dt, cloud, rate = 5) {
    const k = 1 - Math.exp(-rate * dt);
    for (let i = 0; i < this.max; i++) {
      if (i < this.Ne) {
        const s = this.eSlot[i];
        if (s >= 0) this.ePos[i].lerp(this.getPos(s, this._tmp), k);
        const p = this.ePos[i];
        cloud.setAt(i, p.x, p.y, p.z, 1);
      } else cloud.setAt(i, 0, -50, 0, 0);
    }
    cloud.commit();
  }
  /** 满足 filter 的那些位置上的净电荷（单位：一个“电荷点”） */
  netIn(filter) {
    let q = 0;
    for (const i of this.pairedIdx) if (filter(i)) q += 1 - this.occ[i];
    for (const i of this.extraIdx) if (filter(i)) q -= this.occ[i];
    return q;
  }
}

const PAIRS = {
  glass: { rod: '玻璃棒', cloth: '丝绸', donor: 'rod', rodSign: 1 },
  rubber: { rod: '橡胶棒', cloth: '毛皮', donor: 'cloth', rodSign: -1 },
};

export default {
  id: 'static',
  group: 'basics',
  title: '摩擦起电与静电感应',
  subtitle: '电子的“搬家”',
  summary: '摩擦让电子从一个物体搬到另一个物体；带电体靠近导体，导体里的电子会重新排队。',
  lead: '物体带电，本质上都是电子换了地方：摩擦时电子从一种材料跑到另一种材料上；带电体靠近金属时，金属里的自由电子会被吸过去或推开。三个实验依次看：摩擦起电、静电感应、验电器。',
  formulas: [
    { expr: '<i>Q</i> = <i>n e</i>', desc: '物体的带电量 Q（库仑 C）= 转移的电子个数 n × 元电荷 e（1.602×10<sup>−19</sup> C）。1 nC（纳库）≈ 62 亿个电子。' },
    { expr: '<i>Q</i><sub>1</sub> + <i>Q</i><sub>2</sub> = 常量', desc: '电荷守恒：摩擦前两个物体都不带电，摩擦后一个带 +Q、一个带 −Q，总和仍然是 0。' },
  ],
  sections: [
    {
      title: '摩擦为什么会起电？',
      html: `<p>所有物体都由原子组成，原子里有带正电的原子核和带负电的电子。平时正负电荷一样多，物体<b>不显电性</b>。画面里每个红点（正电荷）旁边都配着一个蓝点（电子），表示这一小块是中性的。</p>
      <p>不同材料的原子“抓”电子的本领不一样。两种材料紧密接触、互相摩擦时，接触面上大量原子挨得极近，<b>抓得松</b>的一方就把一部分电子“交”给<b>抓得紧</b>的一方：</p>
      <ul><li>玻璃棒与丝绸摩擦：玻璃失去电子带<b>正电</b>，丝绸得到电子带<b>负电</b></li>
      <li>橡胶棒与毛皮摩擦：毛皮失去电子带<b>正电</b>，橡胶棒得到电子带<b>负电</b></li></ul>
      <p>把常见材料按“越容易失去电子越靠前”排成一列，就是<b>摩擦起电序列</b>（大致顺序）：</p>
      <div class="eq">人手、兔毛 → 玻璃 → 头发 → 尼龙 → 羊毛 → 丝绸 → 纸 → 棉 → 琥珀 → 橡胶 → 聚酯 → 塑料袋（聚乙烯）→ PVC、特氟龙</div>
      <p>序列里任意两种材料摩擦，<b>靠前的带正电，靠后的带负电</b>，相隔越远带电越多。摩擦本身并不“制造”电荷，只是让接触更充分、让更多原子有机会交换电子。</p>`,
    },
    {
      title: '电荷守恒：只搬家，不凭空产生',
      html: `<p>点「摩擦几下」，看右边的读数：棒上少了多少电子，布上就多了多少电子。<b>两者电量大小相等、符号相反，总和始终为 0</b>。</p>
      <p>这就是<b>电荷守恒定律</b>：电荷既不能被创造，也不能被消灭，只能从一个物体转移到另一个物体，或者从物体的一部分转移到另一部分。它是自然界最严格的定律之一，至今没有发现任何例外。</p>
      <p>注意：能搬家的只有<b>电子</b>。质子被紧紧锁在原子核里，摩擦根本动不了它。所以“带正电”的意思其实是“<b>缺了电子</b>”。</p>
      <div class="tip">实际一根摩擦过的玻璃棒大约带 10 nC 的电，也就是多出或缺少约 6×10<sup>10</sup> 个电子。听起来很多，但棒上的原子总数大约是 10<sup>24</sup> 个——每 100 亿个原子里才有一个丢了电子！画面里每个点代表约 1 nC。</div>`,
    },
    {
      title: '带电棒为什么能吸起纸屑？',
      html: `<p>纸屑本身不带电，为什么也会被吸过去？因为带电棒靠近时，纸屑里的分子会发生<b>极化</b>：分子中的电子云被稍稍拉向（或推离）棒，于是纸屑靠近棒的一面出现<b>异种电荷</b>，远离的一面出现<b>同种电荷</b>。</p>
      <p>异种电荷离棒更近，吸引力比排斥力大（电力随距离增大迅速变弱），所以总效果是<b>吸引</b>。无论棒带正电还是负电，都能吸起纸屑。</p>
      <p>有时纸屑碰到棒以后又会“跳开”：接触时它从棒上分到了同种电荷，同种电荷相互排斥。</p>`,
    },
    {
      title: '静电感应与感应起电',
      html: `<p>金属里有大量<b>自由电子</b>，可以在整块金属里随意移动。带电棒靠近金属球时（切到「静电感应」）：</p>
      <ul><li>带<b>正电</b>的棒把自由电子吸到<b>近端</b>，远端因缺电子而带正电</li>
      <li>带<b>负电</b>的棒把自由电子推到<b>远端</b>，近端因缺电子而带正电</li></ul>
      <p>规律是“<b>近端异号、远端同号</b>”，而且两端电量相等，球整体仍不带电。这叫<b>静电感应</b>。</p>
      <p>利用它可以不接触就让导体带电（<b>感应起电</b>）：①带电棒靠近 → ②把球接地，远端的同号电荷被“导走”（或者电子从大地补进来）→ ③先断开接地线 → ④再移走带电棒。球最终带上了与棒<b>相反</b>的电荷，而棒自己的电一点没少。点「自动演示」看全过程。</p>`,
    },
    {
      title: '验电器：看见“看不见的电”',
      html: `<p>金箔验电器由金属球、金属杆和底部两片极薄的金箔组成，它们连成一个导体，装在玻璃瓶里挡风。</p>
      <ul><li><b>靠近</b>：带电棒靠近金属球，静电感应让电荷在导体内重新分布，金箔带上同种电荷而互相排斥、张开；棒一移开，金箔又合拢</li>
      <li><b>接触</b>：棒碰一下金属球，一部分电荷转移到验电器上，移开后金箔<b>保持张开</b>。带电越多，张角越大</li>
      <li><b>判断电性</b>：先让验电器带上已知的正电，再拿未知带电体靠近——张角变大说明它也带正电；张角先变小（甚至合拢）说明它带负电</li></ul>
      <p>试试：在「验电器」里用玻璃棒「接触金属球」，然后把上方的材料换成「橡胶·毛皮」，慢慢把橡胶棒移近，观察金箔先合拢、再张开。</p>`,
    },
    {
      title: '闪电、冬天的“电一下”与防静电',
      html: `<p><b>冬天为什么容易被电？</b>空气干燥时，人走路、脱毛衣、在座椅上摩擦，身上可以积累几千甚至上万伏的静电（电量其实很小）。手指靠近门把手时，空气被击穿产生<b>电火花</b>，“啪”的一下。潮湿的天气里，物体表面有一层薄薄的水膜能把电荷悄悄导走，所以夏天很少被电。</p>
      <p><b>闪电</b>是规模最大的静电放电：雷雨云里冰晶和水滴互相碰撞摩擦，电荷分离，云底积累大量负电，对地电压可达上亿伏，一次闪电转移的电荷约 5~20 C。</p>
      <ul><li>加油站要求先摸“静电释放球”，防止火花点燃油气</li>
      <li>电子厂工人戴防静电手环，因为几百伏的静电就能击穿芯片</li>
      <li>复印机、激光打印机、静电除尘、静电喷涂反而是<b>利用</b>静电的技术</li></ul>
      <div class="warn">常见误区：“摩擦产生了电”。其实电荷早就在物体里，摩擦只是把电子从一个物体搬到另一个物体，正负电荷的总量始终不变。</div>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.setBloom(0.55, 0.4, 0.86);
    const FLOOR = -2.2;
    scene.add(stageFloor({ y: FLOOR }));

    let mode = 'rub';
    let pair = 'glass';
    const P = () => PAIRS[pair];

    /* ---------- 共用材质与零件 ---------- */
    const mats = {
      glass: new THREE.MeshStandardMaterial({ color: 0x7f97ab, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x2c2c33, roughness: 0.8, metalness: 0.05 }),
      silk: new THREE.MeshStandardMaterial({ color: 0x9c9384, roughness: 1, metalness: 0, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
      fur: new THREE.MeshStandardMaterial({ color: 0x6b4420, roughness: 1, metalness: 0, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
      metal: new THREE.MeshStandardMaterial({ color: 0xb9bec8, metalness: 0.85, roughness: 0.28 }),
      dimMetal: new THREE.MeshStandardMaterial({ color: 0x4c525c, metalness: 0.6, roughness: 0.42, envMapIntensity: 0.45 }),
      acrylic: new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.1, transparent: true, opacity: 0.3, depthWrite: false }),
      dark: new THREE.MeshStandardMaterial({ color: 0x34343b, roughness: 0.7 }),
    };
    const ROD_R = 0.16;
    const rodMeshes = [];
    function makeRod(len) {
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(ROD_R, ROD_R, len, 32), mats.glass);
      m.rotation.z = Math.PI / 2;
      g.add(m);
      rodMeshes.push(m);
      return g;
    }
    /** 棒上的净电荷点（模式 2、3 用） */
    function makeRodDots(n, x0, x1) {
      const c = new ParticleCloud(n, { color: COLOR.proton, r: 0.06, emissive: 1.3 });
      c.home = [];
      for (let i = 0; i < n; i++) {
        const x = lerp(x0, x1, (i + 0.5) / n);
        const a = (frac(i * 0.618 + 0.2) * 2 - 1) * 1.2;
        const r = ROD_R + 0.03;
        c.home.push(V(x, r * Math.sin(a), r * Math.cos(a)));
      }
      return c;
    }
    function showRodDots(c, q) {
      const n = Math.round(Math.abs(q));
      const col = q >= 0 ? COLOR.proton : COLOR.electron;
      c.mesh.material.color.setHex(col);
      c.mesh.material.emissive.setHex(col);
      c.home.forEach((p, i) => c.setAt(i, p.x, p.y, p.z, i < n ? 1 : 0));
      c.commit();
    }
    const mkLabel = (text, cls, parent, x, y, z = 0) => {
      const l = ctx.label(text, { cls });
      l.position.set(x, y, z);
      parent.add(l);
      return l;
    };
    const spark = glowSprite(0xfff1c2, 1.4, 0);
    scene.add(spark);
    let sparkLife = 0;
    const flash = (p) => { spark.position.copy(p); sparkLife = 1; };

    /* =====================================================
       模式 1：摩擦起电
       ===================================================== */
    const g1 = new THREE.Group();
    scene.add(g1);
    const UP_Y = 1.0, DOWN_Y = -0.95, RUB_X = 0.8, PARK_X = 3.95;
    const rod1 = makeRod(5.2);
    rod1.position.set(-0.6, UP_Y, 0);
    g1.add(rod1);
    const cloth = new THREE.Group();
    const clothMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.5, 40, 1, true), mats.silk);
    clothMesh.rotation.z = Math.PI / 2;
    cloth.add(clothMesh);
    // 毛皮的“绒毛”
    const fuzz = (() => {
      const n = 360, pos = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) {
        const x = (Math.random() * 2 - 1) * 0.74, a = Math.random() * Math.PI * 2;
        const r0 = 0.36, r1 = 0.36 + 0.06 + Math.random() * 0.08;
        pos.set([x, Math.sin(a) * r0, Math.cos(a) * r0, x + (Math.random() - 0.5) * 0.04, Math.sin(a) * r1, Math.cos(a) * r1], i * 6);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xb07a45, transparent: true, opacity: 0.7 }));
    })();
    fuzz.visible = false;
    cloth.add(fuzz);
    cloth.position.set(PARK_X, UP_Y, 0);
    g1.add(cloth);

    const NB1 = 12, NX1 = 8;
    function makeSites(x0, x1, r, n, shift) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const x = lerp(x0, x1, (i + 0.5) / n);
        const a = (frac(i * 0.618 + shift) * 2 - 1) * 1.25;
        out.push({ x, a, r });
      }
      return out;
    }
    const cyl = (x, a, r) => V(x, r * Math.sin(a), r * Math.cos(a));
    function buildOwner(obj, x0, x1, r) {
      const plusSites = makeSites(x0, x1, r + 0.02, NB1, 0.05);
      const plus = new ParticleCloud(NB1, { color: COLOR.proton, r: 0.055, emissive: 0.9 });
      plusSites.forEach((s, i) => { const p = cyl(s.x, s.a, s.r); plus.setAt(i, p.x, p.y, p.z); });
      plus.commit();
      obj.add(plus.mesh);
      const slots = plusSites.map((s) => ({ p: cyl(s.x + 0.02, s.a + 0.42, s.r), used: false, base: true }));
      makeSites(x0 + 0.05, x1 - 0.05, r + 0.05, NX1, 0.37).forEach((s) => slots.push({ p: cyl(s.x, s.a, s.r), used: false, base: false }));
      return { obj, slots };
    }
    const owners = {
      rod: buildOwner(rod1, 0.45, 2.35, ROD_R),
      cloth: buildOwner(cloth, -0.62, 0.62, 0.36),
    };
    const eCloud1 = new ParticleCloud(NB1 * 2, { color: COLOR.electron, r: 0.06, emissive: 1.6 });
    g1.add(eCloud1.mesh);
    const electrons1 = Array.from({ length: NB1 * 2 }, () => ({ owner: 'rod', slot: null, t: 1, from: V(), pos: V() }));
    const tgt = V();
    const worldOf = (owner, slot, out) => out.copy(slot.p).add(owners[owner].obj.position);

    function resetRub(animate = false) {
      for (const k in owners) owners[k].slots.forEach((s) => (s.used = false));
      electrons1.forEach((e, i) => {
        const owner = i < NB1 ? 'rod' : 'cloth';
        const slot = owners[owner].slots[i % NB1];
        slot.used = true;
        if (animate) { e.from.copy(e.pos); e.t = 0; } else e.t = 1;
        e.owner = owner;
        e.slot = slot;
        if (!animate) worldOf(owner, slot, e.pos);
      });
    }
    const rodQ1 = () => NB1 - electrons1.reduce((n, e) => n + (e.owner === 'rod' ? 1 : 0), 0);
    function transferOne() {
      const donor = P().donor, acc = donor === 'rod' ? 'cloth' : 'rod';
      const cand = electrons1.filter((e) => e.owner === donor && e.t >= 1);
      const free = owners[acc].slots.filter((s) => !s.used && !s.base);
      if (!cand.length || !free.length) return false;
      const e = cand[Math.floor(Math.random() * cand.length)];
      const s = free[Math.floor(Math.random() * free.length)];
      e.slot.used = false;
      s.used = true;
      e.from.copy(e.pos);
      e.owner = acc;
      e.slot = s;
      e.t = 0;
      return true;
    }

    // 纸屑
    const NBITS = 18;
    const paperMats = [0xb8b8b2, 0xc9b27a, 0x8fa9c2, 0xc28d9c].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide }));
    const bitGeo = new THREE.PlaneGeometry(0.2, 0.14);
    bitGeo.rotateX(-Math.PI / 2);
    const bits = [];
    for (let i = 0; i < NBITS; i++) {
      const m = new THREE.Mesh(bitGeo, paperMats[i % paperMats.length]);
      const home = V(lerp(-0.15, 1.75, frac(i * 0.618 + 0.13)), FLOOR + 0.012, (frac(i * 0.414 + 0.7) * 2 - 1) * 0.7);
      m.position.copy(home);
      m.rotation.y = i * 1.7;
      g1.add(m);
      bits.push({ m, home, lift: 0, wait: 0, delay: frac(i * 0.37) * 0.5, rx: (frac(i * 0.29) - 0.5) * 2.4, ry: i * 1.7, rz: (frac(i * 0.53) - 0.5) * 2 });
    }

    const lbRod1 = mkLabel('', 'small', rod1, -1.7, 0.45);
    const lbCloth = mkLabel('', 'small', cloth, 0, 0.66);
    const lbFlow = mkLabel('', 'small yellow', g1, RUB_X, 1.95);
    mkLabel('纸屑（不带电）', 'small dim', g1, 0.8, FLOOR + 0.3, 1.0);

    let rubLeft = 0, xferTimer = 0, clothBase = PARK_X, amp = 0, phase = 0, nearPaper = false;

    /* =====================================================
       模式 2：静电感应（金属球）
       ===================================================== */
    const g2 = new THREE.Group();
    scene.add(g2);
    const SPH = V(1.7, 0.1, 0), SR = 1.15;
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(SR, 64, 48), mats.dimMetal);
    sphere.position.copy(SPH);
    g2.add(sphere);
    {
      const h = SPH.y - SR - FLOOR;
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, h, 24), mats.acrylic);
      stand.position.set(SPH.x, FLOOR + h / 2, 0);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.12, 40), mats.dark);
      base.position.set(SPH.x, FLOOR + 0.06, 0);
      g2.add(stand, base);
    }
    const NI2 = 30, NX2 = 24;
    const ionDirs = fibSphere(NI2, 0);
    const exDirs = fibSphere(NX2, 1.1);
    const slots2 = [];
    const slotPos2 = [];
    const ions2 = new ParticleCloud(NI2, { color: COLOR.proton, r: 0.065, emissive: 0.9 });
    ionDirs.forEach((d, i) => {
      const p = SPH.clone().addScaledVector(d, SR + 0.035);
      ions2.setAt(i, p.x, p.y, p.z);
      slotPos2.push(SPH.clone().addScaledVector(besides(d, 0.1), SR + 0.035));
      slots2.push({ paired: true, key: d.x, u: rad2(i) });
    });
    ions2.commit();
    exDirs.forEach((d, i) => {
      slotPos2.push(SPH.clone().addScaledVector(d, SR + 0.06));
      slots2.push({ paired: false, key: d.x, u: rad2(i) + 0.01 });
    });
    const cs2 = new ChargeSystem(slots2, (s, out) => out.copy(slotPos2[s]));
    const eCloud2 = new ParticleCloud(cs2.max, { color: COLOR.electron, r: 0.065, emissive: 1.6 });
    g2.add(ions2.mesh, eCloud2.mesh);

    const rod2 = makeRod(4.6);
    const dots2 = makeRodDots(10, 0.8, 2.15);
    rod2.add(dots2.mesh);
    g2.add(rod2);
    let rodQ2 = 10, d2 = 3;

    // 接地线
    const attach = SPH.clone().addScaledVector(V(0.62, -0.78, 0).normalize(), SR);
    const GX = SPH.x + 2.3, GY = -1.65;
    const gw = wire([attach, V(attach.x + 0.8, attach.y - 0.25, 0), V(GX, attach.y - 0.25, 0), V(GX, GY, 0)], { radius: 0.035, corner: 0.25 });
    g2.add(gw.mesh);
    const groundCurve = gw.curve;
    {
      [0.7, 0.46, 0.22].forEach((w, i) => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.12), mats.metal);
        bar.position.set(GX, GY - 0.03 - i * 0.12, 0);
        g2.add(bar);
      });
    }
    const transits = Array.from({ length: 8 }, () => ({ on: false, u: 0, dir: 1 }));
    const tCloud = new ParticleCloud(8, { color: COLOR.electron, r: 0.075, emissive: 1.8 });
    g2.add(tCloud.mesh);
    let grounded = false, groundTimer = 0;

    const lbRod2 = mkLabel('', 'small', rod2, -0.9, 0.45);
    const lbNear = mkLabel('', 'small', g2, SPH.x - 0.95, SPH.y + SR + 0.2);
    const lbFar = mkLabel('', 'small', g2, SPH.x + 0.95, SPH.y + SR + 0.2);
    mkLabel('金属球（导体）', 'small dim', g2, SPH.x, FLOOR + 0.35, 1.0);
    mkLabel('大地', 'small dim', g2, GX + 0.65, GY - 0.12);
    const lbWire = mkLabel('接地线', 'small orange', g2, GX + 0.6, attach.y - 0.05);

    /* =====================================================
       模式 3：金箔验电器
       ===================================================== */
    const g3 = new THREE.Group();
    scene.add(g3);
    const X0 = 1.0, BALL = V(X0, 2.25, 0), BR = 0.38, HINGE_Y = -0.45, LEAF_L = 1.15;
    {
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.25, 1.7), new THREE.MeshStandardMaterial({ color: 0x5a3d26, roughness: 0.8 }));
      base.position.set(X0, FLOOR + 0.125, 0);
      const jarMat = new THREE.MeshStandardMaterial({ color: 0x8fa6b8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 2.6, 48, 1, false), jarMat);
      jar.position.set(X0, -0.65, 0);
      const stopper = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.4, 32), mats.dark);
      stopper.position.set(X0, 0.8, 0);
      const rodM = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.9 - HINGE_Y, 16), mats.metal);
      rodM.position.set(X0, (1.9 + HINGE_Y) / 2, 0);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 48, 32), mats.dimMetal);
      ball.position.copy(BALL);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.06), mats.metal);
      bar.position.set(X0, HINGE_Y, 0);
      g3.add(base, jar, stopper, rodM, ball, bar);
    }
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffc94a, emissive: 0x6b4a00, emissiveIntensity: 0.35, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide });
    const leafGeo = new THREE.BoxGeometry(0.26, LEAF_L, 0.006);
    leafGeo.translate(0, -LEAF_L / 2, 0);
    const pivots = [-1, 1].map((s) => {
      const pv = new THREE.Group();
      pv.position.set(X0 + s * 0.035, HINGE_Y, 0);
      pv.add(new THREE.Mesh(leafGeo, leafMat));
      g3.add(pv);
      return pv;
    });
    // 验电器上的电荷位置：金属球 8 个正离子 + 10 个额外位置，每片金箔 3 个正离子 + 4 个额外位置
    const slots3 = [];
    const slotDef3 = []; // { pivot: null | Group, p: Vector3（局部或世界坐标） }
    const ballIons = new ParticleCloud(8, { color: COLOR.proton, r: 0.05, emissive: 0.9 });
    fibHemi(8, 0.3).forEach((d, i) => {
      const p = BALL.clone().addScaledVector(d, BR + 0.025);
      ballIons.setAt(i, p.x, p.y, p.z);
      slotDef3.push({ pivot: null, p: BALL.clone().addScaledVector(besides(d, 0.22), BR + 0.025), leaf: false });
      slots3.push({ paired: true, key: -1 + (1 - d.y) * 0.1, u: rad2(i) });
    });
    ballIons.commit();
    g3.add(ballIons.mesh);
    fibHemi(10, 1.9).forEach((d, i) => {
      slotDef3.push({ pivot: null, p: BALL.clone().addScaledVector(d, BR + 0.05), leaf: false });
      slots3.push({ paired: false, key: -1 + (1 - d.y) * 0.1, u: rad2(i) });
    });
    pivots.forEach((pv, li) => {
      const ionsL = new ParticleCloud(3, { color: COLOR.proton, r: 0.045, emissive: 0.9 });
      [-0.3, -0.62, -0.94].forEach((y, k) => {
        ionsL.setAt(k, -0.06, y, 0.03);
        slotDef3.push({ pivot: pv, p: V(0.06, y, 0.03), leaf: true });
        slots3.push({ paired: true, key: 0.3 + (-y / LEAF_L) * 0.7, u: rad2(li * 4 + k) + 0.02 });
      });
      ionsL.commit();
      pv.add(ionsL.mesh);
      [-0.15, -0.46, -0.78, -1.06].forEach((y, k) => {
        slotDef3.push({ pivot: pv, p: V(0, y, 0.05), leaf: true });
        slots3.push({ paired: false, key: 0.3 + (-y / LEAF_L) * 0.7, u: rad2(li * 4 + k) + 0.02 });
      });
    });
    pivots.forEach((pv) => pv.updateWorldMatrix(true, false));
    const cs3 = new ChargeSystem(slots3, (s, out) => {
      const d = slotDef3[s];
      out.copy(d.p);
      if (d.pivot) d.pivot.localToWorld(out);
      return out;
    });
    const eCloud3 = new ParticleCloud(cs3.max, { color: COLOR.electron, r: 0.05, emissive: 1.6 });
    g3.add(eCloud3.mesh);
    const rod3 = makeRod(4.6);
    const dots3 = makeRodDots(10, 0.8, 2.15);
    rod3.add(dots3.mesh);
    g3.add(rod3);
    let rodQ3 = 10, d3 = 3, theta = 0.05, contact = 0;

    const lbRod3 = mkLabel('', 'small', rod3, -0.9, 0.45);
    mkLabel('金属球', 'small dim', g3, X0 + 0.85, BALL.y + 0.3);
    mkLabel('绝缘塞', 'small dim', g3, X0 + 0.95, 0.85);
    mkLabel('两片金箔', 'small dim', g3, X0 + 1.75, -0.9);
    const lbLeaf = mkLabel('', 'small yellow', g3, X0, -1.72, 1.3);

    /* =====================================================
       面板
       ===================================================== */
    ui.segmented({
      label: '实验',
      options: [{ value: 'rub', label: '摩擦起电' }, { value: 'induce', label: '静电感应' }, { value: 'scope', label: '验电器' }],
      value: mode,
      onChange: (v) => setMode(v),
    });
    ui.segmented({
      label: '棒和摩擦物',
      options: [{ value: 'glass', label: '玻璃·丝绸' }, { value: 'rubber', label: '橡胶·毛皮' }],
      value: pair,
      onChange: (v) => setPair(v),
    });
    const rubBtns = ui.buttons([
      { label: '摩擦几下', primary: true, onClick: () => { nearPaper = false; paperT.set(false); rubLeft = 1.9; xferTimer = 0.25; } },
      { label: '复原', onClick: () => { rubLeft = 0; resetRub(true); } },
    ]);
    const paperT = ui.toggle({ label: '把棒靠近纸屑', value: false, onChange: (v) => { nearPaper = v; if (v) rubLeft = 0; } });
    let distCm = 15;
    const distS = ui.slider({ label: '带电棒与金属球的距离', min: 1, max: 25, step: 0.5, value: distCm, unit: 'cm', digits: 1, onInput: (v) => (distCm = v) });
    const groundT = ui.toggle({ label: '金属球接地', value: false, onChange: (v) => setGround(v) });
    let demo = null;
    const indBtns = ui.buttons([
      { label: '自动演示：感应起电', onClick: () => startDemo() },
      { label: '复原', onClick: () => { demo = null; setGround(false); groundT.set(false); cs2.reset(); transits.forEach((tr) => (tr.on = false)); } },
    ]);
    const scopeBtns = ui.buttons([
      { label: '接触金属球', onClick: () => { if (!contact) contact = 1; } },
      { label: '用手摸一下（放电）', onClick: () => dischargeScope() },
      { label: '换一根新棒', onClick: () => { rodQ3 = 10 * P().rodSign; showRodDots(dots3, rodQ3); } },
    ]);
    const note = ui.note('');
    const ro1 = readoutsEl(ui, [
      { key: 'rod', label: '棒的电荷', unit: 'nC' },
      { key: 'cloth', label: '布/毛皮的电荷', unit: 'nC' },
      { key: 'n', label: '转移的电子', unit: '个' },
    ]);
    const ro2 = readoutsEl(ui, [
      { key: 'rod', label: '棒的电荷', unit: 'nC' },
      { key: 'net', label: '金属球净电荷', unit: 'nC' },
      { key: 'near', label: '近端感应电荷', unit: 'nC' },
    ]);
    const ro3 = readoutsEl(ui, [
      { key: 'rod', label: '棒的电荷', unit: 'nC' },
      { key: 'net', label: '验电器净电荷', unit: 'nC' },
      { key: 'ang', label: '金箔张角', unit: '°' },
    ]);
    ui.legend([
      { color: CSSCOLOR.proton, label: '正电荷（缺电子的原子）' },
      { color: CSSCOLOR.electron, label: '电子（−），每点约 1 nC' },
    ]);

    function setGround(v) {
      grounded = v;
      gw.mesh.visible = v;
      lbWire.visible = v;
    }
    setGround(false);

    function setMode(m) {
      mode = m;
      g1.visible = m === 'rub';
      g2.visible = m === 'induce';
      g3.visible = m === 'scope';
      showEl(rubBtns[0].parentElement, m === 'rub');
      showEl(paperT.el, m === 'rub');
      showEl(distS.el, m !== 'rub');
      showEl(groundT.el, m === 'induce');
      showEl(indBtns[0].parentElement, m === 'induce');
      showEl(scopeBtns[0].parentElement, m === 'scope');
      showEl(ro1.el, m === 'rub');
      showEl(ro2.el, m === 'induce');
      showEl(ro3.el, m === 'scope');
      if (m === 'rub') viewFit(ctx, [0.4, 1.1, 8.4], [0.4, -0.35, 0], 4.6);
      else if (m === 'induce') viewFit(ctx, [0.6, 1.0, 10.5], [0.6, -0.1, 0], 5.8);
      else viewFit(ctx, [-0.6, 0.9, 9.6], [-0.6, 0.15, 0], 5.4);
      lastNote = '';
    }

    function setPair(p) {
      pair = p;
      rodMeshes.forEach((m) => (m.material = p === 'glass' ? mats.glass : mats.rubber));
      clothMesh.material = p === 'glass' ? mats.silk : mats.fur;
      fuzz.visible = p === 'rubber';
      rubLeft = 0;
      resetRub(false);
      rodQ2 = 10 * P().rodSign;
      rodQ3 = 10 * P().rodSign;
      showRodDots(dots2, rodQ2);
      showRodDots(dots3, rodQ3);
      lastNote = '';
    }

    function startDemo() {
      cs2.reset();
      transits.forEach((tr) => (tr.on = false));
      setGround(false);
      groundT.set(false);
      demo = { t: 0, i: 0 };
    }
    const DEMO = [
      { at: 0, fn: () => { distS.set(25); distCm = 25; } },
      { at: 0.6, fn: () => { distS.set(4); distCm = 4; } },
      { at: 3.6, fn: () => { setGround(true); groundT.set(true); } },
      { at: 7.2, fn: () => { setGround(false); groundT.set(false); } },
      { at: 8.6, fn: () => { distS.set(25); distCm = 25; } },
    ];
    let demoStep = '';

    function dischargeScope() {
      const top = BALL.clone().add(V(0, BR, 0));
      while (cs3.X > 0) cs3.removeNearest(top);
      while (cs3.X < 0) cs3.add(top);
      flash(top);
    }

    /* ---------- 状态说明 ---------- */
    let lastNote = '';
    const setNote = (h) => { if (h !== lastNote) { lastNote = h; note.set(h); } };
    const cache = {};
    const setRO = (ro, key, text) => { const k = ro === ro1 ? 'a' + key : ro === ro2 ? 'b' + key : 'c' + key; if (cache[k] !== text) { cache[k] = text; ro.set(key, null, text); } };

    /* ---------- 每帧：模式 1 ---------- */
    const stick = V();
    function updRub(dt, t) {
      rod1.position.y = damp(rod1.position.y, nearPaper ? DOWN_Y : UP_Y, 3, dt);
      const rodUp = Math.abs(rod1.position.y - UP_Y) < 0.08;
      const rubbing = rubLeft > 0 && rodUp;
      clothBase = damp(clothBase, rubbing ? RUB_X : PARK_X, 3.2, dt);
      const onRod = Math.abs(clothBase - RUB_X) < 0.15;
      amp = damp(amp, rubbing && onRod ? 0.55 : 0, 6, dt);
      phase += dt * 11;
      cloth.position.set(clothBase + amp * Math.sin(phase), UP_Y, 0);
      if (rubbing && onRod && amp > 0.35) {
        rubLeft -= dt;
        xferTimer -= dt;
        if (xferTimer <= 0) { transferOne(); xferTimer = 0.42; }
      }
      lbFlow.visible = rubbing && onRod;

      // 电子
      electrons1.forEach((e, i) => {
        worldOf(e.owner, e.slot, tgt);
        if (e.t < 1) {
          e.t = Math.min(1, e.t + dt * 1.4);
          const s = e.t * e.t * (3 - 2 * e.t);
          e.pos.lerpVectors(e.from, tgt, s);
          e.pos.y += Math.sin(Math.PI * s) * 0.35;
          e.pos.z += Math.sin(Math.PI * s) * 0.3;
        } else e.pos.copy(tgt);
        eCloud1.setAt(i, e.pos.x, e.pos.y, e.pos.z, e.t < 1 ? 1.35 : 1);
      });
      eCloud1.commit();

      // 纸屑
      const q = rodQ1();
      const rodNear = rod1.position.y < DOWN_Y + 0.3;
      const nAtt = rodNear && q !== 0 ? Math.min(NBITS, Math.ceil((Math.abs(q) / NX1) * NBITS)) : 0;
      bits.forEach((b, i) => {
        if (i < nAtt) {
          b.wait += dt;
          if (b.wait > b.delay) b.lift = Math.min(1, b.lift + dt * 2.2);
        } else {
          b.wait = 0;
          b.lift = Math.max(0, b.lift - dt * 2.6);
        }
        const s = 1 - Math.pow(1 - b.lift, 3);
        stick.set(b.home.x, rod1.position.y - ROD_R - 0.035 + Math.sin(t * 7 + i) * 0.012, b.home.z * 0.12);
        b.m.position.lerpVectors(b.home, stick, s);
        b.m.rotation.set(b.rx * s, b.ry, b.rz * s);
      });

      // 文字
      const p = P();
      const nTr = Math.abs(q);
      setLabel(lbRod1, `${p.rod} · ${signed(q, 0)} nC`, 'small ' + (q > 0 ? 'red' : q < 0 ? 'blue' : ''));
      setLabel(lbCloth, `${p.cloth} · ${signed(-q, 0)} nC`, 'small ' + (q < 0 ? 'red' : q > 0 ? 'blue' : ''));
      setLabel(lbFlow, p.donor === 'rod' ? `电子：${p.rod} → ${p.cloth}` : `电子：${p.cloth} → ${p.rod}`);
      setRO(ro1, 'rod', signed(q, 0));
      setRO(ro1, 'cloth', signed(-q, 0));
      setRO(ro1, 'n', nTr ? '≈' + sci(nTr * E_PER_NC, 1) : '0');

      const donorName = p.donor === 'rod' ? p.rod : p.cloth, accName = p.donor === 'rod' ? p.cloth : p.rod;
      if (rubbing && onRod) setNote(`摩擦让两种材料紧密接触：<b>${donorName}</b>对电子束缚较弱，一部分电子跑到了<b>${accName}</b>上（看蓝点跳过去）。`);
      else if (nearPaper && q === 0) setNote('棒还没有带电，纸屑纹丝不动。先关掉这个开关，点「摩擦几下」。');
      else if (nearPaper) setNote(`带电的${p.rod}吸起了<b>不带电</b>的纸屑：纸屑中的电荷被“极化”，靠近棒的一面出现异种电荷，吸引大于排斥。带电越多，吸起的纸屑越多。`);
      else if (nTr >= NX1) setNote(`已经转移了 ${nTr} 份电子：${p.rod}带 <b>${signed(q, 0)} nC</b>，${p.cloth}带 <b>${signed(-q, 0)} nC</b>，总和仍是 0。再摩擦也难以更多——实际中电荷会通过空气和手悄悄漏走。打开「把棒靠近纸屑」试试。`);
      else if (nTr > 0) setNote(`${p.rod}${q > 0 ? '失去' : '得到'}了电子，带<b>${q > 0 ? '正' : '负'}电</b>（${signed(q, 0)} nC）；${p.cloth}${q > 0 ? '得到' : '失去'}同样多的电子，带${q > 0 ? '负' : '正'}电。两者总电荷为 0——<b>电荷守恒</b>。多摩擦几下，或者打开「把棒靠近纸屑」。`);
      else setNote(`${p.rod}和${p.cloth}一开始都<b>不带电</b>：每个红点（正电荷）旁边都配着一个蓝点（电子）。点「摩擦几下」开始。`);
    }

    /* ---------- 每帧：模式 2 ---------- */
    const tp = V();
    function updInduce(dt) {
      if (demo) {
        demo.t += dt;
        while (demo.i < DEMO.length && demo.t >= DEMO[demo.i].at) { DEMO[demo.i].fn(); demo.i++; }
        demoStep = demo.i;
        if (demo.t > 11) demo = null;
      }
      d2 = damp(d2, distCm / 5, 3, dt);
      rod2.position.set(SPH.x - SR - d2 - 2.3, SPH.y, 0);
      const pC = Math.sign(rodQ2) * 0.8 * Math.abs(rodQ2) / (1 + (d2 / 1.1) ** 2);

      // 接地：电子在大地与球之间流动，直到球的电势为 0（这里用“抵消远端电荷”近似）
      if (grounded) {
        const want = Math.round(pC);
        let inbound = 0, active = 0;
        transits.forEach((tr) => { if (tr.on) { active++; if (tr.dir < 0) inbound++; } });
        groundTimer -= dt;
        if (groundTimer <= 0 && active < transits.length) {
          const eff = cs2.X + inbound;
          const slot = transits.find((tr) => !tr.on);
          if (eff < want) { slot.on = true; slot.dir = -1; slot.u = 1; groundTimer = 0.22; }
          else if (eff > want && cs2.Ne > 0) { cs2.removeNearest(attach); slot.on = true; slot.dir = 1; slot.u = 0; groundTimer = 0.22; }
        }
      }
      transits.forEach((tr, i) => {
        if (tr.on) {
          tr.u += tr.dir * dt * 0.9;
          if (tr.dir < 0 && tr.u <= 0) { tr.on = false; cs2.add(attach); }
          else if (tr.dir > 0 && tr.u >= 1) tr.on = false;
        }
        if (tr.on) {
          groundCurve.getPointAt(clamp(tr.u, 0, 1), tp);
          tCloud.setAt(i, tp.x, tp.y, tp.z + 0.06, 1);
        } else tCloud.setAt(i, 0, -50, 0, 0);
      });
      tCloud.commit();
      cs2.layout(pC);
      cs2.step(dt, eCloud2, 4);

      const p = P();
      const net = -cs2.X;
      const near = cs2.netIn((i) => slots2[i].key < 0);
      const far = cs2.netIn((i) => slots2[i].key >= 0);
      setLabel(lbRod2, `${p.rod} · ${signed(rodQ2, 0)} nC`, 'small ' + (rodQ2 > 0 ? 'red' : 'blue'));
      setLabel(lbNear, `近端 ${signed(near, 0)}`, 'small ' + (near > 0 ? 'red' : near < 0 ? 'blue' : 'dim'));
      setLabel(lbFar, `远端 ${signed(far, 0)}`, 'small ' + (far > 0 ? 'red' : far < 0 ? 'blue' : 'dim'));
      setRO(ro2, 'rod', signed(rodQ2, 0));
      setRO(ro2, 'net', signed(net, 0));
      setRO(ro2, 'near', signed(near, 0));

      const Pn = Math.round(Math.abs(pC));
      const rodPos = rodQ2 > 0;
      let h;
      if (demo && demoStep <= 1) h = '<b>① 准备：</b>金属球不带电，自由电子（蓝）均匀分布，每个都与一个正电荷（红）配对。';
      else if (demo && demoStep === 2) h = `<b>② 带电棒靠近：</b>球里的自由电子被${rodPos ? '吸到近端' : '推到远端'}，近端出现${rodPos ? '负' : '正'}电荷，远端出现${rodPos ? '正' : '负'}电荷，但总量仍为 0。`;
      else if (demo && demoStep === 3) h = `<b>③ 接地：</b>${rodPos ? '电子从大地沿导线流进球里，中和远端的正电荷' : '远端多余的电子沿导线流入大地'}。`;
      else if (demo && demoStep === 4) h = '<b>④ 先断开接地线：</b>流进（或流出）的电子再也回不去了。';
      else if (demo && demoStep === 5) h = `<b>⑤ 移走带电棒：</b>金属球带上了与棒相反的<b>${net < 0 ? '负' : '正'}电</b>（${signed(net, 0)} nC），并均匀分布在球面上。这就是<b>感应起电</b>，棒上的电荷一点没少。`;
      else if (grounded && Pn > 0) h = `接地后，${rodPos ? '电子从大地流进了金属球，远端的正电荷被中和' : '远端多余的电子流进了大地'}，球的净电荷变成 ${signed(net, 0)} nC。试试：先关掉接地，再把棒移远。`;
      else if (net !== 0 && Pn === 0) h = `金属球带上了 <b>${signed(net, 0)} nC</b> 的电，电荷<b>均匀</b>分布在球面上（同种电荷互相排斥，尽量离得远）。点「复原」重新开始。`;
      else if (Pn > 0) h = `<b>静电感应：</b>金属里的自由电子被带电棒${rodPos ? '吸引到近端' : '排斥到远端'}。近端出现<b>异种</b>电荷、远端出现<b>同种</b>电荷，球整体仍是 ${signed(net, 0)} nC。棒越近，分离得越多。`;
      else h = '拖动滑块让带电棒靠近金属球，或者点「自动演示：感应起电」看完整过程。';
      setNote(h);
    }

    /* ---------- 每帧：模式 3 ---------- */
    const contactPt = BALL.clone().add(V(-BR, 0, 0));
    function updScope(dt) {
      const target = contact === 1 ? 0 : distCm / 5;
      d3 = damp(d3, target, contact ? 5 : 3, dt);
      if (contact === 1 && d3 < 0.03) {
        // 接触：两个导体分享电荷（这里按 6:4 分配），总量守恒
        const qs = -cs3.X;
        const total = rodQ3 + qs;
        const newQs = clamp(Math.round(total * 0.4), -10, 10);
        rodQ3 = total - newQs;
        const dX = -newQs - cs3.X;
        for (let k = 0; k < dX; k++) cs3.add(contactPt);
        for (let k = 0; k < -dX; k++) cs3.removeNearest(contactPt);
        showRodDots(dots3, rodQ3);
        flash(contactPt);
        contact = 2;
      } else if (contact === 2 && Math.abs(d3 - target) < 0.1) contact = 0;
      rod3.position.set(BALL.x - BR - d3 - 2.3, BALL.y, 0);
      const pC = Math.sign(rodQ3) * 0.6 * Math.abs(rodQ3) / (1 + (d3 / 0.9) ** 2);

      pivots.forEach((pv, i) => { pv.rotation.z = (i === 0 ? -1 : 1) * theta; pv.updateWorldMatrix(true, false); });
      cs3.layout(pC);
      cs3.step(dt, eCloud3, 4);
      const qLeaf = cs3.netIn((i) => slotDef3[i].leaf);
      const thT = THREE.MathUtils.degToRad(4 + 50 * (1 - Math.exp(-Math.abs(qLeaf) / 3)));
      theta = damp(theta, thT, 3, dt);

      const p = P();
      const net = -cs3.X;
      setLabel(lbRod3, `${p.rod} · ${signed(rodQ3, 0)} nC`, 'small ' + (rodQ3 > 0 ? 'red' : rodQ3 < 0 ? 'blue' : ''));
      setLabel(lbLeaf, Math.abs(qLeaf) > 0 ? `金箔带 ${signed(qLeaf, 0)} nC：同种电荷相斥 → 张开` : '金箔不带电 → 合拢');
      setRO(ro3, 'rod', signed(rodQ3, 0));
      setRO(ro3, 'net', signed(net, 0));
      setRO(ro3, 'ang', (THREE.MathUtils.radToDeg(theta) * 2).toFixed(0));

      const Pn = Math.round(Math.abs(pC));
      let h;
      if (contact) h = '带电棒<b>接触</b>金属球：两个导体连成一体，电荷在它们之间重新分配（一部分电荷转移到验电器上）。';
      else if (net !== 0 && Pn > 0) h = `验电器已带 <b>${signed(net, 0)} nC</b>，现在又有${rodQ3 > 0 ? '正' : '负'}电棒靠近：同号时金箔张得更开；异号时金箔先合拢、再反向张开。这就是用验电器<b>判断电性</b>的方法。`;
      else if (net !== 0) h = `验电器带了 <b>${signed(net, 0)} nC</b> 的电，电荷分布在金属球、金属杆和金箔上，金箔<b>保持张开</b>。换另一种棒靠近试试，或者「用手摸一下」放电。`;
      else if (Pn > 0) h = `<b>没有接触</b>，金箔也张开了：${rodQ3 > 0 ? '正电棒把电子吸到了金属球上，金箔因缺电子带正电' : '负电棒把电子推到了金箔上，金箔带负电'}。这是静电感应，棒一移开金箔就合拢。`;
      else h = '拖动滑块让带电棒靠近金属球（静电感应），或者点「接触金属球」让验电器带电。';
      setNote(h);
    }

    resetRub(false);
    setPair('glass');
    setMode('rub');
    cs2.layout(0);
    cs3.layout(0);

    return {
      update(dt, t) {
        if (mode === 'rub') updRub(dt, t);
        else if (mode === 'induce') updInduce(dt);
        else updScope(dt);
        if (sparkLife > 0) {
          sparkLife = Math.max(0, sparkLife - dt * 2.5);
          spark.material.opacity = sparkLife;
          spark.scale.setScalar(0.6 + (1 - sparkLife) * 1.6);
        }
      },
      dispose() {
        for (const k in mats) mats[k].dispose();
      },
    };
  },
};
