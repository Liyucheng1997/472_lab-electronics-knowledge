# 章节编写规范

每个章节是 `src/scenes/<id>.js`，默认导出一个对象。**参考实现：`atom.js`、`ohm.js`，动手前先通读这两个文件和 `src/lib/kit.js`、`src/ui.js`、`src/engine.js`。**

```js
import * as THREE from 'three';
import { COLOR, CSSCOLOR, /* ... */ } from '../lib/kit.js';

export default {
  id: 'ohm',                 // 与文件名、chapters.js 一致，不要改
  group: 'circuit',          // basics | circuit | magnet | wave，不要改
  title: '欧姆定律',
  subtitle: 'I = U / R',     // 视口左上角和首页卡片上的短副标题（公式或一句话，≤12 字）
  summary: '首页卡片上的一句话介绍（≤40 字）',
  lead: '面板顶部导语，2~3 句，说清楚本章讲什么、画面里能看到什么、怎么玩',
  formulas: [ { expr: 'HTML 公式', desc: '每个符号的含义和单位' } ],
  sections: [ { title: '小节标题', html: '<p>…</p>' } ],  // 4~6 节，前两节默认展开
  setup(ctx) { /* 搭场景、建控件 */ return { update(dt, t) {}, dispose() {} }; },
};
```

## 公式 HTML
- 变量用 `<i>`，上下标 `<sup>` `<sub>`，分数 `<span class="frac"><span>分子</span><span>分母</span></span>`。
- 例：`<i>F</i> = <i>k</i><span class="frac"><span><i>q</i><sub>1</sub><i>q</i><sub>2</sub></span><span><i>r</i><sup>2</sup></span></span>`

## sections 正文 HTML
可用：`<p> <ul> <ol> <li> <b> <table><tr><th><td>`，提示框 `<div class="tip">…</div>`，警示框 `<div class="warn">…</div>`，独立公式行 `<div class="eq">…</div>`。
内容要求：**原理讲解要清晰、详细、准确**，面向零基础的中学生和成年人。每章至少包含：①这个现象/概念是什么 ②背后的物理原理（为什么）③关键公式与单位 ④生活中的应用或例子 ⑤一个常见误区或有趣的事实。引用画面：“拖动滑块看看…”“画面中黄色的线是…”。

## ctx（setup 的参数）
- `ctx.scene` / `ctx.camera` / `ctx.controls`(OrbitControls) / `ctx.renderer` / `ctx.THREE`
- `ctx.view(pos[3], target[3], halfWidth)`：设镜头。halfWidth = 场景主要内容的水平半宽，窄屏时会自动后退保证看全。**务必传 halfWidth。**
- `ctx.setBloom(strength, radius, threshold)`：辉光，默认 (0.55, 0.45, 0.82)。发光物体用 emissive。
- `ctx.label(text, { cls })`：返回 CSS2DObject（HTML 标签，跟随 3D 位置），`.position.set()` 后 add 到 scene 或某个 group。改文字：`label.element.textContent = …`。cls 可组合：`small` `big` `plain` `dim` `blue` `red` `yellow` `green` `orange` `purple` `cyan`。
- 引擎每次切章节会自动清空场景、释放资源、清掉标签、复位相机；默认已有半球光 + 两盏方向光 + 环境反射，深色背景 #0d0d11。
- `update(dt, t)`：dt 已乘过播放速度（0.25×~2×，暂停时 dt=0），**所有动画都必须基于 dt 或 t**，不要用 Date.now / performance.now。

## ctx.ui（右侧面板控件，按调用顺序排列）
- `ui.slider({ label, min, max, step, value, unit, digits, format, onInput })` → `{ value, set(v, fire) }`
- `ui.segmented({ label, options:[{value,label}], value, onChange })`（选项 2~4 个，每个 ≤5 字）
- `ui.toggle({ label, value, onChange })`
- `ui.button({ label, onClick, primary })` / `ui.buttons([...])`（主要按钮最多一个）
- `ui.note(html)` → `{ set(html) }`：控件卡片里的一段说明，适合显示“当前状态解释”
- `ui.readouts([{ key, label, unit, digits }])` → `{ set(key, value, text?) }`：实时读数小卡片（每行最多 3 个，总数 ≤6）
- `ui.legend([{ color: CSSCOLOR.electron, label: '电子' }])`：颜色图例
- `ui.scope({ title, height, yMin, yMax, window, series:[{label,color}] })` → `{ push([v1,v2]) }`：滚动示波器，每帧 push
- `ui.plot({ title, height, xMin,xMax,yMin,yMax, xLabel,yLabel, series, draw(p) })` → `{ redraw(), opts }`：静态坐标图，draw 里用 `p.line(pts,color,width,dash)` `p.fn(f,color,width,n,dash)` `p.dot(x,y,color,r)` `p.text(x,y,str,color,align)` `p.vline(x)` `p.hline(y)`；参数变了调 `redraw()`
- 示波器/图表画布背景是深色（#111115），线条用明亮色。

## kit.js 积木（`src/lib/kit.js`，**只读，不要修改**——其他人在并行使用它。你自己组内多章复用的工具放到 `src/lib/<group>-kit.js`，如 `src/lib/wave-kit.js`）
- 颜色：`COLOR.electron/proton/neutron/efield/bfield/current/copper/ion/hole/magnetN/magnetS/signal/wave`，CSS 字符串版 `CSSCOLOR.*`。**全站颜色约定：电子蓝、正电荷红、电场黄、磁场绿、约定电流方向橙。**
- `particle(kind, {r, glow, sign})` 带电粒子小球；`ParticleCloud(count, {color, r})` 大量同色粒子（InstancedMesh，`setAt(i,x,y,z,scale)` + `commit()`）
- `Arrow(color, opts)`：`.set(origin, vec)` 画矢量箭头（力、场强、速度）
- `roundedPath(points, corner, closed)` 圆角折线曲线；`wire(pointsOrCurve, {radius, color, closed})` → `{mesh, curve, length}` 导线
- `Flow(curve, {count, color, r, speed, jitter})` 沿曲线流动的粒子（电子流），`update(dt)`，`speed` 可改、负数反向
- `ArrowFlow(curve, {count, color, size, speed})` 沿曲线流动的小箭头（电流方向）
- 元件：`battery()` `resistor()` `bulb()`(userData.setLevel(0..1)) `switchPart()`(userData.set(closed)/update(dt)) `meter({symbol:'A'|'V'|'G', max, zeroCenter})`(userData.setValue/update) `barMagnet()` `coil({radius,turns,length})` → `{mesh,curve}`，`compass()`(userData.point(vec)/update(dt))
- 场：`fieldAt(charges,p)` `potentialAt(charges,p)` `traceFieldLines(charges,{perCharge,plane})` `fieldLinesObject(lines,{color,arrows})`
- 其他：`textSprite(text,{size,color})` 面向镜头的文字小图、`glowSprite(color,size,opacity)` 光晕、`heatColor(t, color)` 温度色、`stageFloor({y})` 地台、`Polyline(max,{color})` 可每帧更新的线（`setPoints` / `fill(n, i=>[x,y,z])`）、`disposeTree(obj)` 重建局部模型前释放、`damp` `lerp` `clamp` `V`

## 质量要求
1. **3D 模型要能清楚地“演示原理”**，不是摆个静物：要有动画（电子流动、场线、力箭头、波动、转动……），参数改变时画面要有明显、正确的变化。尺度和速度可以夸张，但要在讲解里说明。
2. 每章 2~5 个有意义的交互控件 + 实时读数，数值要按真实公式计算（单位正确）。
3. 关键部件用 `ctx.label` 标注（中文），一个画面 3~8 个标签，避免重叠。
4. 性能：粒子用 InstancedMesh（ParticleCloud/Flow），不要每帧新建几何体/材质；每帧更新几何体用 Polyline 或预分配 BufferAttribute。`update` 里尽量复用 Vector3。
5. 局部重建（切换模式时）先 `disposeTree(group)` 再 `group.clear()`。
6. 文件内不要用 `document.querySelector` 操作页面其他部分，只用 ctx/ui。
7. 写完运行 `npx vite build` 确保无语法/导入错误。只改自己负责的章节文件和自己的 `src/lib/<group>-kit.js`。
