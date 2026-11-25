import * as THREE from 'three';
import { COLOR, CSSCOLOR, battery, resistor, meter, wire, Flow, ArrowFlow, heatColor, stageFloor, roundedPath, V } from '../lib/kit.js';

export default {
  id: 'ohm',
  group: 'circuit',
  title: '欧姆定律',
  subtitle: 'I = U / R',
  summary: '电压越大电流越大，电阻越大电流越小。电学里最重要的一条定律。',
  lead: '同一段导体中的电流，跟它两端的电压成正比，跟它的电阻成反比。拖动滑块，看电子流的快慢、电表指针和电阻发热如何一起变化。',
  formulas: [
    { expr: '<i>I</i> = <span class="frac"><span><i>U</i></span><span><i>R</i></span></span>', desc: '电流（安培 A）= 电压（伏特 V）÷ 电阻（欧姆 Ω）。也常写成 <i>U</i> = <i>IR</i>。' },
    { expr: '<i>P</i> = <i>UI</i> = <i>I</i><sup>2</sup><i>R</i> = <span class="frac"><span><i>U</i><sup>2</sup></span><span><i>R</i></span></span>', desc: '电阻消耗的电功率（瓦特 W），全部变成了热。' },
  ],
  sections: [
    {
      title: '三个量是什么关系？',
      html: `<p><b>电压 U</b> 是“推动力”：电池在正负极之间制造的电势差，驱使电荷流动。</p>
      <p><b>电阻 R</b> 是“阻碍”：电子在导体中前进时不断撞上振动的原子，被拖慢。</p>
      <p><b>电流 I</b> 是“结果”：单位时间内通过导线某个截面的电荷量。</p>
      <p>欧姆（Georg Ohm）在 1827 年通过实验发现：对于金属导体，<b>I 与 U 成正比</b>，比例系数就是 1/R。把 U-I 关系画成图，是一条过原点的直线，电阻越大，直线越“平”。</p>`,
    },
    {
      title: '水管类比',
      html: `<table><tr><th>电路</th><th>水路</th></tr>
      <tr><td>电压 U</td><td>水压差（水塔的高度差）</td></tr>
      <tr><td>电流 I</td><td>每秒流过的水量</td></tr>
      <tr><td>电阻 R</td><td>水管的狭窄程度</td></tr>
      <tr><td>电池</td><td>水泵：把水抬高</td></tr></table>
      <p>水压越大、水管越粗，水流就越大——电路也是同样的道理。不过类比总有局限：水会从破管流出来，电却不会从断开的导线“漏”出来。</p>`,
    },
    {
      title: '电表怎么接？',
      html: `<ul><li><b>电流表（A）串联</b>在电路中：让全部电流都从它身上流过才能测量。电流表自身电阻极小，几乎不影响电路。</li>
      <li><b>电压表（V）并联</b>在被测元件两端：测量两点之间的电势差。电压表自身电阻极大，几乎不分走电流。</li></ul>
      <div class="warn">千万不要把电流表直接接在电源两端——它的电阻几乎为零，会造成短路，电流巨大，烧坏电表和电源。</div>`,
    },
    {
      title: '电子其实走得很慢',
      html: `<p>画面里的电子跑得很快，这是为了方便观察。真实导线里，电子的<b>定向漂移速度</b>通常只有每秒零点几毫米，比蜗牛还慢！</p>
      <p>那为什么一按开关灯就亮？因为导线里本来就挤满了自由电子，电场以接近光速沿导线建立起来，全线的电子几乎<b>同时</b>开始移动——就像一根装满弹珠的管子，从一端推进一颗，另一端立刻就出来一颗。</p>`,
    },
    {
      title: '欧姆定律的适用范围',
      html: `<p>欧姆定律适用于金属导体和电解质溶液等<b>线性元件</b>。有些元件不满足：</p>
      <ul><li><b>灯丝</b>：温度升高后电阻变大，U-I 图是弯曲的</li>
      <li><b>二极管</b>：只让电流单向通过，正向电压超过阈值才导通</li>
      <li><b>气体放电</b>（日光灯、闪电）：电流与电压关系非常复杂</li></ul>
      <p>这些叫<b>非线性元件</b>，在「半导体与二极管」一章还会看到。</p>`,
    },
  ],

  setup(ctx) {
    const { scene, ui } = ctx;
    ctx.view([0, 1.2, 12.5], [0, 0.4, 0], 6);
    ctx.setBloom(0.6, 0.45, 0.8);
    scene.add(stageFloor({ y: -4 }));

    const L = -4, Rx = 4, T = 2.2, B = -2.2;
    // 电池（左侧竖放，+ 极朝上）
    const bat = battery({ height: 1.8, radius: 0.42 });
    bat.position.set(L, 0, 0);
    scene.add(bat);
    const batTop = bat.userData.top.clone().add(bat.position);
    const batBot = bat.userData.bottom.clone().add(bat.position);

    // 电阻（顶部中间）
    const res = resistor({ length: 1.8, radius: 0.28 });
    res.position.set(0, T, 0);
    scene.add(res);
    const resMat = res.userData.body.material;

    // 电流表（底部，串联）
    const amm = meter({ symbol: 'A', max: 10, size: 1.1 });
    const mPostY = amm.userData.left.y;
    amm.position.set(0, B - mPostY, 0);
    scene.add(amm);
    const aL = amm.userData.left.clone().add(amm.position);
    const aR = amm.userData.right.clone().add(amm.position);

    // 主回路（从 + 极出发，按约定电流方向：+ → 电阻 → 右侧 → 电流表 → − 极）
    // 导线分段画（让出电流表的位置）
    for (const seg of [
      [batTop, V(L, T), V(Rx, T), V(Rx, B), aR],
      [aL, V(L, B), batBot],
    ]) scene.add(wire(seg, { radius: 0.06, corner: 0.35 }).mesh);

    // 电子沿闭合回路运动：用闭合曲线（经过电池内部）
    const closedCurve = roundedPath([V(L, T), V(Rx, T), V(Rx, B), V(L, B)], 0.35, true);
    const electrons = new Flow(closedCurve, { count: 90, color: COLOR.electron, r: 0.075, speed: -1 });
    scene.add(electrons.object);
    const arrows = new ArrowFlow(closedCurve, { count: 16, color: COLOR.current, size: 0.2, speed: 1, offsetY: 0 });
    arrows.object.position.z = 0.35;
    scene.add(arrows.object);

    // 电压表（并联在电阻两端，在电阻上方）
    const vm = meter({ symbol: 'V', max: 15, size: 1.1 });
    vm.position.set(0, T + 2.0, 0);
    scene.add(vm);
    const vL = vm.userData.left.clone().add(vm.position);
    const vR = vm.userData.right.clone().add(vm.position);
    const leadMat = { radius: 0.03, color: 0x4b6fd6, metalness: 0.2, roughness: 0.5, corner: 0.2 };
    scene.add(wire([V(-1.25, T), V(-1.25, vL.y + 0.5), V(vL.x, vL.y + 0.5), vL], leadMat).mesh);
    scene.add(wire([V(1.25, T), V(1.25, vR.y + 0.5), V(vR.x, vR.y + 0.5), vR], leadMat).mesh);
    for (const x of [-1.25, 1.25]) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd0d0d6, metalness: 0.9, roughness: 0.25 }));
      dot.position.set(x, T, 0);
      scene.add(dot);
    }

    // 标签
    const lbBat = ctx.label('', { cls: 'yellow' });
    lbBat.position.set(L - 1.3, 0, 0);
    const lbRes = ctx.label('', { cls: 'orange' });
    lbRes.position.set(0, T - 0.75, 0.3);
    const lbA = ctx.label('电流表：串联', { cls: 'small dim' });
    lbA.position.set(0, B - 1.85, 0);
    const lbV = ctx.label('电压表：并联在电阻两端', { cls: 'small dim' });
    lbV.position.set(0, T + 3.05, 0);
    const lbHi = ctx.label('高电势', { cls: 'small red' });
    lbHi.position.set(-2.6, T + 0.4, 0);
    const lbLo = ctx.label('低电势', { cls: 'small blue' });
    lbLo.position.set(2.6, T + 0.4, 0);
    scene.add(lbBat, lbRes, lbA, lbV, lbHi, lbLo);

    // 面板
    let U = 6, R = 5;
    const sU = ui.slider({ label: '电源电压 U', min: 0, max: 12, step: 0.5, value: U, unit: 'V', digits: 1, onInput: (v) => { U = v; refresh(); } });
    const sR = ui.slider({ label: '电阻 R', min: 2, max: 20, step: 0.5, value: R, unit: 'Ω', digits: 1, onInput: (v) => { R = v; refresh(); } });
    ui.toggle({ label: '显示电子（实际运动方向）', value: true, onChange: (v) => (electrons.object.visible = v) });
    ui.toggle({ label: '显示电流方向（约定方向）', value: true, onChange: (v) => (arrows.object.visible = v) });
    ui.note('电子带负电，从电源<b>负极</b>出发流向正极；而“电流方向”是历史上约定的<b>正电荷</b>流动方向，从正极流向负极，两者正好相反。');
    const read = ui.readouts([
      { key: 'U', label: '电压 U', unit: 'V', digits: 1 },
      { key: 'I', label: '电流 I', unit: 'A', digits: 2 },
      { key: 'P', label: '功率 P', unit: 'W', digits: 1 },
    ]);
    ui.legend([
      { color: CSSCOLOR.electron, label: '电子' },
      { color: CSSCOLOR.current, label: '电流方向（+ → −）' },
    ]);
    const plot = ui.plot({
      title: 'U – I 图像（伏安特性）',
      height: 170, xMin: 0, xMax: 12, yMin: 0, yMax: 6,
      xLabel: '电压 U (V)', yLabel: '电流 I (A)',
      series: [{ label: `当前 R`, color: '#0a84ff' }, { label: '其他 R', color: 'rgba(255,255,255,.35)' }],
      draw(p) {
        for (const r of [2, 5, 10, 20]) {
          p.fn((u) => u / r, 'rgba(255,255,255,.22)', 1, 20, [4, 4]);
          const uEnd = Math.min(12, 6 * r);
          p.text(uEnd - 0.2, Math.min(6, uEnd / r) - 0.25, `${r}Ω`, 'rgba(255,255,255,.45)', 'right');
        }
        p.fn((u) => u / R, '#0a84ff', 2.5, 20);
        p.dot(U, U / R, '#ffffff', 5);
      },
    });

    function refresh() {
      const I = U / R;
      const P = U * I;
      read.set('U', U);
      read.set('I', I);
      read.set('P', P);
      amm.userData.setValue(I);
      vm.userData.setValue(U);
      electrons.speed = -Math.min(I, 6) * 0.9;
      arrows.speed = Math.min(I, 6) * 0.9;
      const heat = Math.min(1, Math.sqrt(P / 72));
      heatColor(heat * 0.9, resMat.emissive);
      resMat.emissiveIntensity = heat * 0.8;
      lbBat.element.textContent = `电源 U = ${U.toFixed(1)} V`;
      lbRes.element.textContent = `R = ${R.toFixed(1)} Ω  ·  I = ${I.toFixed(2)} A`;
      plot.redraw();
    }
    refresh();

    return {
      update(dt) {
        electrons.update(dt);
        arrows.update(dt);
        amm.userData.update(dt);
        vm.userData.update(dt);
      },
    };
  },
};
