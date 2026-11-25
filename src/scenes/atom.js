import * as THREE from 'three';
import { COLOR, CSSCOLOR, particle, ParticleCloud, textSprite, glowSprite, V, disposeTree } from '../lib/kit.js';

const ELEMENTS = {
  H: { name: '氢', p: 1, n: 0, shells: [1] },
  C: { name: '碳', p: 6, n: 6, shells: [2, 4] },
  Cu: { name: '铜', p: 29, n: 35, shells: [2, 8, 18, 1] },
};
const SHELL_R = [1.7, 2.7, 3.7, 4.8];

export default {
  id: 'atom',
  group: 'basics',
  title: '原子与电荷',
  subtitle: '电的源头',
  summary: '一切物质都由原子组成，原子里的质子带正电、电子带负电——电就从这里开始。',
  lead: '电不是一种“东西”，而是物质本身的一种属性——电荷。原子核里的质子带正电，绕核运动的电子带负电，两者电量相等、符号相反。',
  formulas: [
    { expr: '<i>e</i> = 1.602 × 10<sup>−19</sup> C', desc: '元电荷：一个电子（或质子）所带电量的大小。任何带电体的电量都是它的整数倍。' },
    { expr: '<i>Q</i> = (<i>N</i><sub>质子</sub> − <i>N</i><sub>电子</sub>) · <i>e</i>', desc: '一个原子（或物体）的净电荷 = 质子数与电子数之差 × 元电荷。相等时呈电中性。' },
  ],
  sections: [
    {
      title: '原子的结构',
      html: `<p>原子由<b>原子核</b>和核外<b>电子</b>组成。原子核又由带正电的<b>质子</b>和不带电的<b>中子</b>组成。</p>
      <ul><li>质子：带 +1 个元电荷，质量约为电子的 1836 倍</li><li>中子：不带电，质量和质子差不多</li><li>电子：带 −1 个元电荷，非常轻，在核外高速运动</li></ul>
      <p>正常的原子里，质子数 = 电子数，正负电荷刚好抵消，所以整体不带电（<b>电中性</b>）。</p>
      <div class="tip">真实的原子核比画面里小得多：如果把原子放大成一座足球场，原子核只有场地中央的一颗黄豆大小。打开「真实比例」看看。</div>`,
    },
    {
      title: '电子到底怎么“绕”核？',
      html: `<p>画面中的圆形轨道来自玻尔在 1913 年提出的<b>行星模型</b>，便于理解“电子分层排布”。</p>
      <p>量子力学告诉我们，电子并没有确定的轨道，只能说它在某处出现的<b>概率</b>有多大，这种概率分布就像一团云，叫做<b>电子云</b>。切换到「电子云」视图可以看到：越靠近核的壳层越致密，外层越稀疏。</p>
      <p>电子按能量分层：第 1 层最多 2 个，第 2 层最多 8 个，第 3 层最多 18 个……</p>`,
    },
    {
      title: '为什么金属能导电？',
      html: `<p>看铜原子：它最外层只有<b>1 个电子</b>，离原子核很远，又被内层 28 个电子“挡住”了核的吸引力，所以束缚得很松。</p>
      <p>当无数铜原子挤在一起形成金属晶体时，这些最外层电子就脱离了各自的原子，在整块金属里自由游荡，形成“<b>自由电子海</b>”。剩下的铜离子（带正电）排列成整齐的晶格。</p>
      <p>只要给金属两端加上电压，这片电子海就会整体朝一个方向漂移——这就是<b>电流</b>。切换到「金属晶体」看看。</p>
      <p>而塑料、橡胶、玻璃中的电子被牢牢束缚在原子或化学键里，无法自由移动，所以是<b>绝缘体</b>。</p>`,
    },
    {
      title: '离子：失去或得到电子',
      html: `<p>用「拿走一个电子」「加一个电子」试试：</p>
      <ul><li>失去电子 → 电子比质子少 → 带正电，叫<b>正离子</b>（阳离子），如 Cu²⁺、Na⁺</li>
      <li>得到电子 → 电子比质子多 → 带负电，叫<b>负离子</b>（阴离子），如 Cl⁻</li></ul>
      <p>注意：日常生活中物体带电，几乎都是<b>电子</b>的转移造成的。质子被锁在原子核里，靠摩擦、接触这些手段根本搬不动它。</p>`,
    },
    {
      title: '电荷的基本规律',
      html: `<ol><li><b>同种电荷相互排斥，异种电荷相互吸引。</b>正是电子与原子核之间的吸引力把原子“粘”在一起。</li>
      <li><b>电荷守恒：</b>电荷既不能被创造，也不能被消灭，只能从一个物体转移到另一个物体，总量不变。</li>
      <li><b>电荷量子化：</b>电量总是元电荷 e 的整数倍，不存在“半个电子”的电量。</li></ol>
      <p>电量的单位是<b>库仑（C）</b>。1 库仑大约相当于 6.24 × 10¹⁸ 个电子的电量——这是个巨大的数字，一道闪电大约只转移 5~20 库仑。</p>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.view([0, 3.5, 13], [0, 0, 0], 5.5);
    ctx.setBloom(0.7, 0.5, 0.75);

    const root = new THREE.Group();
    scene.add(root);

    // 背景星点，增加空间感
    {
      const n = 600, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 40);
        pos.set([v.x, v.y, v.z], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x5a6070, size: 0.12, sizeAttenuation: true })));
    }

    let mode = 'C';
    let view = 'orbit';
    let realScale = false;
    let extraE = 0; // 相对于中性原子多出 / 少掉的电子
    let items = []; // 需要动画的电子 { obj, r, speed, phase, q(quaternion) }
    let nucleus = null;
    let cloud = null;
    let metal = null;
    let labels = [];

    const read = ui.readouts([
      { key: 'p', label: '质子数', unit: '个' },
      { key: 'e', label: '电子数', unit: '个' },
      { key: 'q', label: '净电荷', unit: 'e' },
    ]);
    ui.legend([
      { color: CSSCOLOR.proton, label: '质子（+）' },
      { color: CSSCOLOR.neutron, label: '中子（不带电）' },
      { color: CSSCOLOR.electron, label: '电子（−）' },
    ]);

    function clear() {
      disposeTree(root);
      root.clear();
      labels.forEach((l) => l.parent?.remove(l));
      labels = [];
      items = [];
      nucleus = cloud = metal = null;
    }

    function addLabel(text, pos, cls = '') {
      const l = ctx.label(text, { cls });
      l.position.copy(pos);
      root.add(l);
      labels.push(l);
      return l;
    }

    function buildNucleus(el) {
      const g = new THREE.Group();
      const total = el.p + el.n;
      const nr = 0.17;
      const R = nr * Math.cbrt(total) * 1.05;
      const ga = Math.PI * (3 - Math.sqrt(5));
      const kinds = [];
      for (let i = 0; i < el.p; i++) kinds.push('proton');
      for (let i = 0; i < el.n; i++) kinds.push('neutron');
      // 打散质子中子
      for (let i = kinds.length - 1; i > 0; i--) {
        const j = Math.floor(((i * 7919) % 101) / 101 * (i + 1));
        [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
      }
      kinds.forEach((k, i) => {
        const t = total === 1 ? 0 : i / (total - 1);
        const rr = total === 1 ? 0 : R * Math.cbrt(1 - t * 0.98);
        const y = 1 - 2 * t;
        const s = Math.sqrt(Math.max(0, 1 - y * y));
        const p = particle(k, { r: nr, glow: false, sign: k === 'proton' && total < 20, emissive: k === 'proton' ? 0.55 : 0.02 });
        p.position.set(Math.cos(ga * i) * s * rr, y * rr, Math.sin(ga * i) * s * rr);
        g.add(p);
      });
      g.add(glowSprite(COLOR.proton, R * 7, 0.35));
      return { group: g, R };
    }

    function electronCount() {
      const el = ELEMENTS[mode];
      return Math.max(0, el.p + extraE);
    }

    function shellsFor(count) {
      // 按 2, 8, 18, 32 填充；铜的特殊排布 2-8-18-1 直接用
      const el = ELEMENTS[mode];
      const base = el.shells.slice();
      const out = [];
      let left = count;
      const caps = [2, 8, 18, 32];
      for (let i = 0; i < 4 && left > 0; i++) {
        const cap = i < base.length - 1 ? base[i] : caps[i];
        const k = Math.min(cap, left);
        out.push(k);
        left -= k;
      }
      return out;
    }

    function buildAtom() {
      clear();
      const el = ELEMENTS[mode];
      const nuc = buildNucleus(el);
      nucleus = nuc.group;
      root.add(nucleus);
      const ne = electronCount();
      const shells = shellsFor(ne);

      if (view === 'orbit') {
        let idx = 0;
        shells.forEach((k, si) => {
          const r = SHELL_R[si];
          for (let j = 0; j < k; j++) {
            // 每个电子一个倾斜轨道平面
            const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(
              ((idx * 47) % 180) * Math.PI / 180 * 0.9 + 0.3,
              ((idx * 83) % 360) * Math.PI / 180,
              0
            ));
            const ring = new THREE.Mesh(
              new THREE.TorusGeometry(r, 0.006, 4, 128),
              new THREE.MeshBasicMaterial({ color: COLOR.electron, transparent: true, opacity: si === shells.length - 1 && mode === 'Cu' ? 0.35 : 0.13 })
            );
            ring.quaternion.copy(tilt);
            ring.rotateX(Math.PI / 2);
            root.add(ring);
            const e = particle('electron', { r: 0.13, sign: true });
            root.add(e);
            items.push({ obj: e, r, speed: 2.4 / Math.pow(r, 1.2), phase: (j / k) * Math.PI * 2 + si, q: tilt });
            idx++;
          }
        });
      } else {
        // 电子云：按壳层半径做球壳概率分布
        const N = 5000;
        cloud = new THREE.Points(
          new THREE.BufferGeometry(),
          new THREE.PointsMaterial({ color: COLOR.electron, size: 0.05, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        const pos = new Float32Array(N * 3);
        const total = shells.reduce((a, b) => a + b, 0) || 1;
        for (let i = 0; i < N; i++) {
          let pick = Math.random() * total, si = 0;
          while (si < shells.length - 1 && pick > shells[si]) { pick -= shells[si]; si++; }
          const r = Math.abs(SHELL_R[si] + gauss() * 0.35 * (si + 1) * 0.6);
          const d = new THREE.Vector3().randomDirection().multiplyScalar(r);
          pos.set([d.x, d.y, d.z], i * 3);
        }
        cloud.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        root.add(cloud);
      }

      // 标签
      addLabel(`原子核：${el.p} 个质子 + ${el.n} 个中子`, V(0, -nuc.R - 0.55, 0), 'red small');
      if (shells.length) {
        const outer = SHELL_R[shells.length - 1];
        addLabel(mode === 'Cu' && shells[shells.length - 1] === 1 ? '最外层仅 1 个电子：束缚很弱，易成为自由电子' : `第 ${shells.length} 层电子`, V(outer * 0.72, outer * 0.75, 0), 'blue small');
      }
      if (realScale) {
        nucleus.scale.setScalar(0.04);
        addLabel('真实比例下，原子核小到几乎看不见（这里仍放大了约 1000 倍）', V(0, 1.2, 0), 'small dim');
      }

      // 读数
      read.set('p', el.p);
      read.set('e', ne);
      const q = el.p - ne;
      read.set('q', q, q > 0 ? '+' + q : q < 0 ? '−' + -q : '0');
      state.set(
        q === 0 ? `<b>${el.name}原子</b>：${el.p} 个质子、${ne} 个电子，正负电荷相等，整体<b>电中性</b>。`
          : q > 0 ? `<b>${el.name}正离子</b>：失去了 ${q} 个电子，电子比质子少，整体带<b>正电</b>。`
            : `<b>${el.name}负离子</b>：多出 ${-q} 个电子，电子比质子多，整体带<b>负电</b>。`
      );
    }

    function buildMetal() {
      clear();
      read.set('p', '—');
      read.set('e', '—');
      read.set('q', 0, '0');
      state.set('<b>铜晶体</b>：铜离子（Cu⁺，带正电）排成整齐的晶格，每个原子贡献出的最外层电子在晶格中自由乱窜，形成“电子海”。整体仍是电中性。');
      const g = new THREE.Group();
      const ions = [];
      const nx = 6, ny = 4, nz = 4, d = 1.3;
      const ionMesh = new ParticleCloud(nx * ny * nz, { color: 0xd87a6a, r: 0.3, emissive: 0.25, segments: 20 });
      let k = 0;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let l = 0; l < nz; l++) {
        const p = V((i - (nx - 1) / 2) * d, (j - (ny - 1) / 2) * d, (l - (nz - 1) / 2) * d);
        ions.push(p);
        ionMesh.setAt(k++, p.x, p.y, p.z);
      }
      ionMesh.commit();
      g.add(ionMesh.mesh);
      // + 号
      ions.forEach((p) => { const s = textSprite('+', { size: 0.34 }); s.position.copy(p); g.add(s); });
      const NE = nx * ny * nz;
      const eCloud = new ParticleCloud(NE, { color: COLOR.electron, r: 0.09, emissive: 1.6 });
      const half = V(((nx - 1) / 2) * d + 0.5, ((ny - 1) / 2) * d + 0.5, ((nz - 1) / 2) * d + 0.5);
      const es = Array.from({ length: NE }, () => ({
        p: V((Math.random() * 2 - 1) * half.x, (Math.random() * 2 - 1) * half.y, (Math.random() * 2 - 1) * half.z),
        v: new THREE.Vector3().randomDirection().multiplyScalar(2 + Math.random() * 2),
      }));
      g.add(eCloud.mesh);
      root.add(g);
      metal = { eCloud, es, half, ions };
      addLabel('铜离子 Cu⁺（固定在晶格上振动）', V(0, half.y + 0.7, 0), 'red small');
      addLabel('自由电子（无规则热运动）', V(half.x + 0.4, -half.y - 0.5, 0), 'blue small');
    }

    function gauss() {
      return Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random());
    }

    function rebuild() {
      if (mode === 'metal') buildMetal();
      else buildAtom();
      ionBtns.forEach((b) => (b.disabled = mode === 'metal'));
    }

    ui.segmented({
      label: '选择对象',
      options: [{ value: 'H', label: '氢' }, { value: 'C', label: '碳' }, { value: 'Cu', label: '铜' }, { value: 'metal', label: '金属晶体' }],
      value: mode,
      onChange: (v) => { mode = v; extraE = 0; rebuild(); },
    });
    ui.segmented({
      label: '电子的画法',
      options: [{ value: 'orbit', label: '轨道模型' }, { value: 'cloud', label: '电子云' }],
      value: view,
      onChange: (v) => { view = v; if (mode !== 'metal') rebuild(); },
    });
    const ionBtns = ui.buttons([
      { label: '拿走一个电子', onClick: () => { if (electronCount() > 0) { extraE--; rebuild(); } } },
      { label: '加一个电子', onClick: () => { if (extraE < 2) { extraE++; rebuild(); } } },
      { label: '复原', onClick: () => { extraE = 0; rebuild(); } },
    ]);
    ui.toggle({ label: '真实比例（原子核缩小）', value: false, onChange: (v) => { realScale = v; if (mode !== 'metal') rebuild(); } });
    const state = ui.note('');

    rebuild();

    const tmp = new THREE.Vector3();
    return {
      update(dt, t) {
        for (const it of items) {
          const a = t * it.speed + it.phase;
          tmp.set(Math.cos(a) * it.r, 0, Math.sin(a) * it.r).applyQuaternion(it.q);
          it.obj.position.copy(tmp);
        }
        if (nucleus) nucleus.rotation.y += dt * 0.3;
        if (cloud) cloud.rotation.y += dt * 0.15;
        if (metal) {
          const { es, half, eCloud, ions } = metal;
          es.forEach((e, i) => {
            e.p.addScaledVector(e.v, dt);
            for (const ax of ['x', 'y', 'z']) {
              if (e.p[ax] > half[ax]) { e.p[ax] = half[ax]; e.v[ax] *= -1; }
              if (e.p[ax] < -half[ax]) { e.p[ax] = -half[ax]; e.v[ax] *= -1; }
            }
            // 偶尔与离子“碰撞”而改变方向
            if (Math.random() < dt * 1.2) e.v.randomDirection().multiplyScalar(2 + Math.random() * 2);
            eCloud.setAt(i, e.p.x, e.p.y, e.p.z);
          });
          eCloud.commit();
          root.rotation.y += dt * 0.08;
        } else {
          root.rotation.y = 0;
        }
      },
    };
  },
};
