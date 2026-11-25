import * as THREE from 'three';
import { COLOR, CSSCOLOR, battery, bulb, switchPart, Flow, stageFloor, disposeTree, V } from '../lib/kit.js';
import { addWire, addJoint, bulbPath, pathOf, fmtSI } from '../lib/circuit-kit.js';

const BS = 0.9; // 灯泡缩放
const BAT_X = -5.2;

export default {
  id: 'seriesparallel',
  group: 'circuit',
  title: '串联与并联',
  subtitle: '一条路 vs 多条路',
  summary: '串联电路只有一条路，断一处全灭；并联电路有多条路，各走各的互不影响。',
  lead: '把三只灯泡分别串联、并联、混联到同一个电源上，每只灯泡旁都有自己的开关。蓝色电子流的快慢代表该处电流大小，灯的亮度按实际功率变化。断开某个开关，看看其他灯会怎样。',
  formulas: [
    { expr: '串联：<i>R</i> = <i>R</i><sub>1</sub> + <i>R</i><sub>2</sub> + <i>R</i><sub>3</sub>，<i>I</i> 处处相等，<i>U</i> = <i>U</i><sub>1</sub> + <i>U</i><sub>2</sub> + <i>U</i><sub>3</sub>', desc: '串联电路总电阻等于各电阻之和；电流只有一条路，处处相同；总电压按电阻大小分配到各元件上（分压）。' },
    { expr: '并联：<span class="frac"><span>1</span><span><i>R</i></span></span> = <span class="frac"><span>1</span><span><i>R</i><sub>1</sub></span></span> + <span class="frac"><span>1</span><span><i>R</i><sub>2</sub></span></span> + <span class="frac"><span>1</span><span><i>R</i><sub>3</sub></span></span>，<i>U</i> 处处相等，<i>I</i> = <i>I</i><sub>1</sub> + <i>I</i><sub>2</sub> + <i>I</i><sub>3</sub>', desc: '并联电路各支路两端电压都等于电源电压；干路电流等于各支路电流之和（分流）；总电阻比任何一个支路电阻都小。' },
  ],
  sections: [
    {
      title: '串联：只有一条路',
      html: `<p>把元件<b>首尾相连</b>排成一串，电流只有<b>一条路径</b>可走，这就是串联。</p>
      <ul><li><b>电流处处相等</b>：电荷不会在半路堆积或消失，每秒流过每只灯的电荷量都一样。画面里三只灯中电子流动的速度完全相同。</li>
      <li><b>总电阻 = 各电阻之和</b>：电子要依次穿过每一个“障碍”，R = R₁ + R₂ + R₃，所以串联的灯越多，电流越小，每只都越暗。</li>
      <li><b>分压</b>：电源电压按电阻比例分给各元件，U₁ : U₂ = R₁ : R₂。把某只灯的电阻调大，它分到的电压更多、反而更亮（串联中 P = I²R，电流相同时电阻大的功率大）。</li></ul>
      <div class="warn">串联的致命弱点：<b>断一处，全都断</b>。断开任意一个开关，整条路被切断，三只灯同时熄灭。</div>`,
    },
    {
      title: '并联：多条路，各走各的',
      html: `<p>把元件的两端<b>分别接在同样的两点</b>之间，电流在分岔点分成几路，汇合点再合起来，这就是并联。</p>
      <ul><li><b>各支路电压相等</b>：每只灯都直接接在电源两端，都分到完整的电源电压 U。</li>
      <li><b>分流</b>：每条支路电流 Iₖ = U / Rₖ，电阻越小的支路电流越大；干路电流 I = I₁ + I₂ + I₃。看画面：干路（电池所在的导线）里的电子流得最快。</li>
      <li><b>总电阻变小</b>：1/R = 1/R₁ + 1/R₂ + 1/R₃。多开一条路，就像多开一条车道，总的阻碍反而减小。两只 10 Ω 并联只有 5 Ω。</li></ul>
      <p>断开其中一个开关，只有那一路的灯熄灭，其他灯<b>亮度不变</b>——因为它们两端的电压仍是电源电压。</p>`,
    },
    {
      title: '混联与计算方法',
      html: `<p>「混联」模式中，灯 L1 在干路上，L2 和 L3 并联后再与 L1 串联。计算时先把并联部分化简成一个等效电阻：</p>
      <div class="eq"><i>R</i><sub>并</sub> = <i>R</i><sub>2</sub><i>R</i><sub>3</sub> / (<i>R</i><sub>2</sub> + <i>R</i><sub>3</sub>)，<i>R</i><sub>总</sub> = <i>R</i><sub>1</sub> + <i>R</i><sub>并</sub></div>
      <p>然后 I = U / R总，L1 两端电压 U₁ = I·R₁，并联部分电压 U并 = I·R并，再按 I₂ = U并/R₂、I₃ = U并/R₃ 分流。</p>
      <p>试试：断开 S3，L2 会<b>变亮</b>、L1 会<b>变暗</b>。因为并联部分的电阻变大，分到的电压变多，而总电流变小了。复杂电路都可以这样一层层化简。</p>
      <div class="tip">这里把电源看作理想电源（没有内阻），灯丝电阻也当作固定值。真实灯丝的电阻会随温度升高而变大。</div>`,
    },
    {
      title: '家里的电器为什么都是并联？',
      html: `<p>家庭电路中，所有插座、电灯都是<b>并联</b>在火线和零线之间的：</p>
      <ul><li>每个电器都能得到相同的 <b>220 V</b> 额定电压，正常工作；</li>
      <li>每个电器可以<b>单独开关</b>，关掉电视不会让冰箱停电；</li>
      <li>一个电器坏了（断路），其他电器照常使用。</li></ul>
      <p>代价是：开的电器越多，并联支路越多，干路总电流越大。总电流太大时导线会过热，所以干路上装有<b>空气开关（断路器）</b>或保险丝，电流超标时自动切断。</p>
      <p>开关则必须与它控制的电器<b>串联</b>，而且要接在火线上——这样关上开关后，灯座上就不带电了，换灯泡更安全。</p>`,
    },
    {
      title: '圣诞彩灯的故事',
      html: `<p>老式的圣诞树小彩灯是几十只小灯泡<b>串联</b>起来的：每只灯只需要几伏电压，串起来正好接在市电上。缺点也很明显——只要一只灯丝烧断，整串灯全灭，你得一只只去找坏的那只。</p>
      <p>后来的彩灯在每只灯泡里加了一根“分流丝”：灯丝完好时它不导通；灯丝一断，它两端电压骤升、绝缘层被击穿而导通，相当于自动把坏灯短接，其余灯泡继续亮（只是稍微亮一点）。</p>
      <p>现在的 LED 灯带则大多采用<b>串并结合</b>：几颗 LED 串成一组，许多组再并联，兼顾电压匹配和可靠性。</p>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.view([0, 0.8, 13.6], [-0.3, 0.4, 0], 6.3);
    ctx.setBloom(0.7, 0.5, 0.78);
    scene.add(stageFloor({ y: -3.8 }));

    const root = new THREE.Group();
    scene.add(root);

    // 状态
    let mode = 'series';
    let U = 6;
    const R = [10, 10, 10];
    const closed = [true, true, true];

    let bulbs = [], switches = [], bulbLabels = [], flows = [], lbTrunk = null, lbBat = null;

    /** 一个“开关 + 灯泡”单元，沿 +x 方向，中心 (x, y) */
    function unit(x, y, k) {
      const sw = switchPart({ length: 0.8 });
      sw.position.set(x - 0.75, y - 0.08, 0);
      sw.userData.set(closed[k]);
      root.add(sw);
      const bp = V(x + 0.45, y + 0.24 * BS, 0);
      const b = bulb({ scale: BS });
      b.position.copy(bp);
      root.add(b);
      const a = V(bp.x - 0.12 * BS, y, 0), bb = V(bp.x + 0.12 * BS, y, 0);
      addWire(root, [V(x - 1.4, y), V(x - 1.15, y)]);
      addWire(root, [V(x - 0.35, y), a]);
      addWire(root, [bb, V(x + 1.4, y)]);
      const sl = ctx.label(`S${k + 1}`, { cls: 'small dim' });
      sl.position.set(x - 0.75, y - 0.42, 0);
      root.add(sl);
      const lb = ctx.label('', { cls: 'small' });
      lb.position.set(x + 0.45, y + 1.75, 0);
      root.add(lb);
      bulbs[k] = b;
      switches[k] = sw;
      bulbLabels[k] = lb;
      return {
        inP: V(x - 1.4, y), outP: V(x + 1.4, y),
        path: [V(x - 1.4, y), V(x - 1.15, y), V(x - 0.35, y), ...bulbPath(bp, BS), V(x + 1.4, y)],
      };
    }

    function addFlow(points, current) {
      const curve = pathOf(points, 0.2);
      const len = curve.getLength();
      const f = new Flow(curve, { count: Math.max(8, Math.round(len * 3.2)), color: COLOR.electron, r: 0.06, speed: 0, jitter: 0.012 });
      root.add(f.object);
      flows.push({ f, current });
      return f;
    }

    function addBattery(y) {
      const bat = battery({ height: 1.8, radius: 0.42 });
      bat.position.set(BAT_X, y, 0);
      root.add(bat);
      lbBat = ctx.label('', { cls: 'yellow' });
      lbBat.position.set(BAT_X - 1.35, y, 0);
      root.add(lbBat);
      return { top: bat.userData.top.clone().add(bat.position), bot: bat.userData.bottom.clone().add(bat.position) };
    }

    function build() {
      disposeTree(root);
      root.clear();
      bulbs = []; switches = []; bulbLabels = []; flows = [];
      lbTrunk = ctx.label('', { cls: 'small blue' });
      root.add(lbTrunk);

      if (mode === 'series') {
        const T = 2.2, B = -2.2, RX = 5.2;
        const bat = addBattery(0);
        const us = [unit(-2.8, T, 0), unit(0.2, T, 1), unit(3.2, T, 2)];
        addWire(root, [bat.top, V(BAT_X, T), us[0].inP]);
        addWire(root, [us[0].outP, us[1].inP]);
        addWire(root, [us[1].outP, us[2].inP]);
        addWire(root, [us[2].outP, V(RX, T), V(RX, B), V(BAT_X, B), bat.bot]);
        // 约定电流方向：+ 极 → L1 → L2 → L3 → − 极（电子速度取负）
        addFlow([bat.top, V(BAT_X, T), ...us[0].path, ...us[1].path, ...us[2].path, V(RX, T), V(RX, B), V(BAT_X, B), bat.bot], 'I');
        lbTrunk.position.set(0, B - 0.45, 0);
      } else if (mode === 'parallel') {
        const XL = -2.2, XR = 2.2, ys = [2.6, 0.6, -1.4], BOT = -2.8;
        const bat = addBattery(0);
        const us = ys.map((y, k) => unit(0, y, k));
        addWire(root, [bat.top, V(BAT_X, ys[0]), V(XL, ys[0])]);
        addWire(root, [V(XL, ys[0]), V(XL, ys[2])]);
        addWire(root, [V(XR, ys[0]), V(XR, ys[2])]);
        addWire(root, [V(XR, ys[2]), V(XR, BOT), V(BAT_X, BOT), bat.bot]);
        ys.forEach((y, k) => {
          addWire(root, [V(XL, y), us[k].inP]);
          addWire(root, [us[k].outP, V(XR, y)]);
          addJoint(root, V(XL, y));
          addJoint(root, V(XR, y));
          addFlow([V(XL, ys[0]), V(XL, y), ...us[k].path, V(XR, y), V(XR, ys[2])], k);
        });
        addFlow([V(XR, ys[2]), V(XR, BOT), V(BAT_X, BOT), bat.bot, bat.top, V(BAT_X, ys[0]), V(XL, ys[0])], 'I');
        lbTrunk.position.set(-1.5, BOT - 0.45, 0);
      } else {
        // 混联：L1 在干路，L2 ∥ L3
        const T = 2.4, Y3 = 0.0, XL = -0.4, XR = 4.0, BOT = -2.4;
        const bat = addBattery(0);
        const u1 = unit(-2.6, T, 0);
        const u2 = unit(1.8, T, 1);
        const u3 = unit(1.8, Y3, 2);
        addWire(root, [bat.top, V(BAT_X, T), u1.inP]);
        addWire(root, [u1.outP, u2.inP]);
        addWire(root, [V(XL, T), V(XL, Y3), u3.inP]);
        addWire(root, [u2.outP, V(XR, T), V(XR, Y3)]);
        addWire(root, [u3.outP, V(XR, Y3), V(XR, BOT), V(BAT_X, BOT), bat.bot]);
        addJoint(root, V(XL, T));
        addJoint(root, V(XR, Y3));
        addFlow([V(XL, T), ...u2.path, V(XR, T), V(XR, Y3)], 1);
        addFlow([V(XL, T), V(XL, Y3), ...u3.path, V(XR, Y3)], 2);
        addFlow([V(XR, Y3), V(XR, BOT), V(BAT_X, BOT), bat.bot, bat.top, V(BAT_X, T), ...u1.path, V(XL, T)], 'I');
        lbTrunk.position.set(0, BOT - 0.45, 0);
      }
      refresh();
    }

    /* ---------- 面板 ---------- */
    ui.segmented({
      label: '连接方式',
      options: [{ value: 'series', label: '串联' }, { value: 'parallel', label: '并联' }, { value: 'mixed', label: '混联' }],
      value: mode,
      onChange: (v) => { mode = v; build(); },
    });
    ui.slider({ label: '电源电压 U', min: 1.5, max: 12, step: 0.5, value: U, unit: 'V', digits: 1, onInput: (v) => { U = v; refresh(); } });
    [0, 1, 2].forEach((k) => ui.slider({ label: `灯 L${k + 1} 的电阻 R${k + 1}`, min: 2, max: 30, step: 1, value: R[k], unit: 'Ω', digits: 0, onInput: (v) => { R[k] = v; refresh(); } }));
    [0, 1, 2].forEach((k) => ui.toggle({ label: `开关 S${k + 1} 闭合（控制 L${k + 1}）`, value: true, onChange: (v) => { closed[k] = v; switches[k]?.userData.set(v); refresh(); } }));
    const note = ui.note('');
    const read = ui.readouts([
      { key: 'R', label: '总电阻 R', unit: 'Ω' },
      { key: 'I', label: '干路电流 I', unit: 'A' },
      { key: 'P', label: '总功率 P', unit: 'W' },
    ]);
    ui.legend([
      { color: CSSCOLOR.electron, label: '电子（流得越快 = 电流越大）' },
    ]);

    /** 按当前模式求解电路：返回各灯电流、电压和总电流 */
    function solve() {
      const I = [0, 0, 0], Uk = [0, 0, 0];
      let Itot = 0, Rtot = Infinity;
      if (mode === 'series') {
        Rtot = closed.every(Boolean) ? R[0] + R[1] + R[2] : Infinity;
        if (closed.every(Boolean)) {
          Itot = U / Rtot;
          for (let k = 0; k < 3; k++) { I[k] = Itot; Uk[k] = Itot * R[k]; }
        }
      } else if (mode === 'parallel') {
        let G = 0;
        for (let k = 0; k < 3; k++) if (closed[k]) { I[k] = U / R[k]; Uk[k] = U; G += 1 / R[k]; }
        Itot = I[0] + I[1] + I[2];
        Rtot = G > 0 ? 1 / G : Infinity;
      } else {
        let G = 0;
        if (closed[1]) G += 1 / R[1];
        if (closed[2]) G += 1 / R[2];
        const Rp = G > 0 ? 1 / G : Infinity;
        Rtot = closed[0] ? R[0] + Rp : Infinity;
        if (closed[0] && G > 0) {
          Itot = U / Rtot;
          const Up = Itot * Rp;
          I[0] = Itot; Uk[0] = Itot * R[0];
          if (closed[1]) { I[1] = Up / R[1]; Uk[1] = Up; }
          if (closed[2]) { I[2] = Up / R[2]; Uk[2] = Up; }
        }
      }
      return { I, Uk, Itot, Rtot };
    }

    function refresh() {
      const { I, Uk, Itot, Rtot } = solve();
      for (let k = 0; k < 3; k++) {
        const P = I[k] * Uk[k];
        bulbs[k]?.userData.setLevel(Math.min(1.25, Math.pow(P / 5, 0.6)));
        if (bulbLabels[k]) bulbLabels[k].element.textContent = `L${k + 1}：${I[k].toFixed(2)} A · ${Uk[k].toFixed(1)} V · ${P.toFixed(1)} W`;
      }
      const k = 2.4; // 画面速度系数：单位/秒 每安培
      for (const { f, current } of flows) {
        const i = current === 'I' ? Itot : I[current];
        f.speed = -Math.min(i * k, 6);
      }
      read.set('R', Rtot, isFinite(Rtot) ? Rtot.toFixed(Rtot < 10 ? 2 : 1) : '∞');
      read.set('I', Itot, Itot.toFixed(2));
      read.set('P', U * Itot, (U * Itot).toFixed(1));
      if (lbBat) lbBat.element.textContent = `电源 ${U.toFixed(1)} V`;
      if (lbTrunk) lbTrunk.element.textContent = `干路电流 I = ${fmtSI(Itot, 'A')}`;

      let msg = '';
      const open = closed.map((c, i) => (c ? null : `S${i + 1}`)).filter(Boolean);
      if (mode === 'series') {
        msg = open.length
          ? `<b>${open.join('、')} 断开</b>：串联电路只有一条路，一处断开，整个电路都没有电流，三只灯<b>全部熄灭</b>。`
          : `<b>串联</b>：电流处处相等 I = U/(R₁+R₂+R₃) = ${U.toFixed(1)}/${Rtot.toFixed(0)} = ${Itot.toFixed(2)} A。电压按电阻分配：${Uk.map((u) => u.toFixed(1)).join(' + ')} = ${U.toFixed(1)} V。`;
      } else if (mode === 'parallel') {
        msg = open.length === 3
          ? '三个开关都断开了，没有任何通路。'
          : `<b>并联</b>：每只灯都分到完整的 ${U.toFixed(1)} V。干路电流 = 各支路电流之和：${I.map((i) => i.toFixed(2)).join(' + ')} = ${Itot.toFixed(2)} A。${open.length ? `<br>${open.join('、')} 断开只影响它自己那一路，其他灯亮度不变。` : ''}`;
      } else {
        msg = !closed[0]
          ? '<b>S1 在干路上</b>：它一断开，整个电路都没电了。'
          : !closed[1] && !closed[2]
            ? 'L2、L3 所在的两条支路都断开，干路也就没有电流了。'
            : `<b>混联</b>：L2、L3 并联部分的等效电阻 R并 = ${(Rtot - R[0]).toFixed(2)} Ω，与 L1 串联后总电阻 ${Rtot.toFixed(2)} Ω。L1 上的电压 ${Uk[0].toFixed(2)} V，并联部分电压 ${Math.max(Uk[1], Uk[2]).toFixed(2)} V。`;
      }
      note.set(msg);
    }

    build();

    return {
      update(dt) {
        for (const { f } of flows) f.update(dt);
        for (const s of switches) s.userData.update(dt);
      },
    };
  },
};
