// “电与磁”一组章节共用的工具：毕奥–萨伐尔数值磁场、磁感线追踪、沿磁感线流动的箭头、
// 条形磁铁磁场模型、磁极对、局部重建与面板显隐等。只被 magnetism / motor / induction / generator / transformer 使用。
import * as THREE from 'three';
import { faceLabel, COLOR, disposeTree, textSprite } from './kit.js';

/** 真空磁导率 μ0（T·m/A） */
export const MU0 = 4 * Math.PI * 1e-7;

/** 清空一个子 Group：先摘掉其中的 HTML 标签（CSS2DObject），再释放几何体/材质 */
export function clearGroup(g) {
  const labels = [];
  g.traverse((o) => { if (o.isCSS2DObject) labels.push(o); });
  for (const l of labels) l.parent?.remove(l);
  disposeTree(g);
  g.clear();
}

/** 取 ui 刚刚追加到“读数区”的那个元素（用于按模式显示/隐藏某组读数或图表） */
export function lastPanelEl(ui) {
  return ui.extras ? ui.extras.lastElementChild : null;
}
/** 显示 / 隐藏面板中的某个元素 */
export function setShown(el, on) {
  if (el) el.style.display = on ? '' : 'none';
}

/* ---------------- 毕奥–萨伐尔：由导线折线算磁场 ---------------- */

/** 点列 → 线段数组 Float64Array [ax,ay,az,bx,by,bz, ...]（电流沿点列顺序） */
export function pathSegments(points, closed = false) {
  const m = points.length;
  const n = closed ? m : m - 1;
  const segs = new Float64Array(Math.max(0, n) * 6);
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % m];
    const k = i * 6;
    segs[k] = a.x; segs[k + 1] = a.y; segs[k + 2] = a.z;
    segs[k + 3] = b.x; segs[k + 4] = b.y; segs[k + 5] = b.z;
  }
  return segs;
}

/**
 * 一组直线段电流在 p 点产生的磁场（精确的有限长直导线公式），
 * 结果以 μ0·I/(4π) 为单位（长度单位的倒数）。乘上 μ0·I/(4π) 即为特斯拉。
 */
export function biotSavart(segs, p, out, soft = 1e-9) {
  let bx = 0, by = 0, bz = 0;
  const px = p.x, py = p.y, pz = p.z;
  for (let i = 0, n = segs.length; i < n; i += 6) {
    const ux = segs[i] - px, uy = segs[i + 1] - py, uz = segs[i + 2] - pz;
    const vx = segs[i + 3] - px, vy = segs[i + 4] - py, vz = segs[i + 5] - pz;
    const lu = Math.sqrt(ux * ux + uy * uy + uz * uz);
    const lv = Math.sqrt(vx * vx + vy * vy + vz * vz);
    const luv = lu * lv;
    const den = luv * (luv + ux * vx + uy * vy + uz * vz) + soft;
    const f = (lu + lv) / den;
    bx += (uy * vz - uz * vy) * f;
    by += (uz * vx - ux * vz) * f;
    bz += (ux * vy - uy * vx) * f;
  }
  return out.set(bx, by, bz);
}

/**
 * 从 seed 出发沿磁场方向追踪一条磁感线（RK2，步长固定）。
 * 磁感线是闭合曲线：绕回起点附近就闭合；跑出 bound 则再反向追踪并拼接。
 * fieldFn(p, out) 写入 p 点磁场。opts: step, maxSteps, bound, plane('xy' 时强制 z=0), stop(p)
 * 返回 Vector3 数组（方向 = 磁场方向）
 */
export function traceLine(fieldFn, seed, { step = 0.05, maxSteps = 3000, bound = 10, plane = null, stop = null, minLoop = 24 } = {}) {
  const B = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const run = (sgn) => {
    const p = seed.clone();
    const pts = [p.clone()];
    let prevD = Infinity;
    for (let s = 0; s < maxSteps; s++) {
      fieldFn(p, B);
      if (plane === 'xy') B.z = 0;
      let l = B.length();
      if (!(l > 1e-12)) break;
      mid.copy(p).addScaledVector(B, (sgn * step * 0.5) / l);
      if (plane === 'xy') mid.z = 0;
      fieldFn(mid, B);
      if (plane === 'xy') B.z = 0;
      l = B.length();
      if (!(l > 1e-12)) break;
      p.addScaledVector(B, (sgn * step) / l);
      if (plane === 'xy') p.z = 0;
      if (s > minLoop) {
        const d = p.distanceTo(seed);
        if (d < step * 4) {
          if (d > prevD) { pts.push(seed.clone()); return { pts, closed: true }; }
          prevD = d;
        } else prevD = Infinity;
      }
      pts.push(p.clone());
      if (p.length() > bound || (stop && stop(p))) return { pts, closed: false };
    }
    return { pts, closed: false };
  };
  const f = run(1);
  if (f.closed) return f.pts;
  const b = run(-1);
  if (b.closed) return b.pts.reverse();
  b.pts.reverse();
  b.pts.pop(); // 去掉重复的起点
  return b.pts.concat(f.pts);
}

/** 把一组曲线绕某坐标轴旋转复制（利用轴对称，把一个截面的磁感线变成立体的） */
export function revolveLines(lines, angles, axis = 'x') {
  const ax = axis === 'x' ? new THREE.Vector3(1, 0, 0) : axis === 'y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  const out = [];
  const q = new THREE.Quaternion();
  for (const a of angles) {
    q.setFromAxisAngle(ax, a);
    for (const l of lines) out.push(l.map((p) => p.clone().applyQuaternion(q)));
  }
  return out;
}

/** 圆（点列，首尾相同）：圆心 c，在由单位向量 u、v 张成的平面内，点 = c + r(u cosφ + v sinφ)，φ 递增方向即点列方向 */
export function circlePoints(c, r, u, v, n = 96) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector3(
      c.x + r * (u.x * Math.cos(a) + v.x * Math.sin(a)),
      c.y + r * (u.y * Math.cos(a) + v.y * Math.sin(a)),
      c.z + r * (u.z * Math.cos(a) + v.z * Math.sin(a)),
    ));
  }
  return pts;
}

/* ---------------- 沿磁感线流动的箭头 ---------------- */
/**
 * 一组磁感线：细线 + 沿线移动的小圆锥（指示磁场方向）。
 * new LineFlow(lines, { color, opacity, arrowSize, spacing, speed, speedScale(i, line) })
 * speed 为正：箭头顺着点列方向；为负：整体反向（电流反向时磁场反向）。speed = 0 时箭头静止。
 * setStrength(0..1) 调亮度（0 时整组隐藏）。
 */
export class LineFlow {
  constructor(lines, { color = COLOR.bfield, opacity = 0.6, arrowSize = 0.18, spacing = 1.0, speed = 0, speedScale = null } = {}) {
    this.object = new THREE.Group();
    this.baseOpacity = opacity;
    const pos = [];
    for (const l of lines) {
      for (let i = 0; i < l.length - 1; i++) pos.push(l[i].x, l[i].y, l[i].z, l[i + 1].x, l[i + 1].y, l[i + 1].z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    this.lines = new THREE.LineSegments(geo, this.lineMat);
    this.object.add(this.lines);

    this.items = [];
    lines.forEach((l, li) => {
      if (l.length < 2) return;
      const cum = new Float32Array(l.length);
      for (let i = 1; i < l.length; i++) cum[i] = cum[i - 1] + l[i].distanceTo(l[i - 1]);
      const len = cum[l.length - 1];
      if (len < spacing * 0.4) return;
      const tr = { pts: l, cum, len, k: speedScale ? speedScale(li, l) : 1 };
      const n = Math.max(1, Math.round(len / spacing));
      for (let j = 0; j < n; j++) this.items.push({ tr, s0: (j / n) * len });
    });
    const cg = new THREE.ConeGeometry(arrowSize * 0.4, arrowSize, 10);
    this.coneMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: Math.min(1, opacity + 0.3), depthWrite: false });
    this.cones = new THREE.InstancedMesh(cg, this.coneMat, Math.max(1, this.items.length));
    this.cones.count = this.items.length;
    this.cones.frustumCulled = false;
    this.object.add(this.cones);

    this.speed = speed;
    this.offset = 0;
    this.dir = 1;
    this._p = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._m = new THREE.Matrix4();
    this._s = new THREE.Vector3(1, 1, 1);
    this._up = new THREE.Vector3(0, 1, 0);
    this.update(0);
  }

  update(dt) {
    this.offset += this.speed * dt;
    if (this.speed > 0) this.dir = 1;
    else if (this.speed < 0) this.dir = -1;
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i], tr = it.tr;
      let s = (it.s0 + this.offset * tr.k) % tr.len;
      if (s < 0) s += tr.len;
      const cum = tr.cum;
      let lo = 0, hi = cum.length - 1;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (cum[m] <= s) lo = m; else hi = m;
      }
      const a = tr.pts[lo], b = tr.pts[hi];
      const seg = cum[hi] - cum[lo];
      const f = seg > 1e-9 ? (s - cum[lo]) / seg : 0;
      this._p.lerpVectors(a, b, f);
      this._d.subVectors(b, a);
      const dl = this._d.length();
      if (dl < 1e-9) this._d.set(0, 1, 0);
      else this._d.multiplyScalar(this.dir / dl);
      this._q.setFromUnitVectors(this._up, this._d);
      this._m.compose(this._p, this._q, this._s);
      this.cones.setMatrixAt(i, this._m);
    }
    this.cones.instanceMatrix.needsUpdate = true;
  }

  /** 0..1：磁场强弱（亮度）。0 时整组隐藏 */
  setStrength(s) {
    this.object.visible = s > 0.002;
    const k = Math.min(1, Math.max(0, s));
    this.lineMat.opacity = this.baseOpacity * (0.25 + 0.75 * k);
    this.coneMat.opacity = Math.min(1, (this.baseOpacity + 0.3) * (0.35 + 0.65 * k));
  }

  /** 箭头大小倍数 */
  setArrowScale(s) {
    this._s.setScalar(s);
  }
}

/* ---------------- 条形磁铁的磁场（磁荷模型） ---------------- */
/**
 * 条形磁铁（沿 x 轴，N 极在 +x）外部磁场：两端各放一个“磁荷”。
 * 返回 { field(p,out), lines }，lines 为若干条外部磁感线（方向 N → S），已绕 x 轴旋转复制。
 */
export function barMagnetField({ length = 3, size = 0.6, faceSeeds = [0.12, 0.26], sideSeeds = [0.1, 0.45], angles = [0, Math.PI / 3, (2 * Math.PI) / 3], bound = 9, step = 0.05 } = {}) {
  const hx = length / 2, hy = size / 2;
  const xN = hx - size * 0.4, xS = -xN;
  const d = new THREE.Vector3();
  const field = (p, out) => {
    out.set(0, 0, 0);
    d.set(p.x - xN, p.y, p.z);
    let r2 = Math.max(d.lengthSq(), 1e-4);
    out.addScaledVector(d, 1 / (r2 * Math.sqrt(r2)));
    d.set(p.x - xS, p.y, p.z);
    r2 = Math.max(d.lengthSq(), 1e-4);
    out.addScaledVector(d, -1 / (r2 * Math.sqrt(r2)));
    return out;
  };
  const inside = (p) => Math.abs(p.x) < hx + 0.01 && Math.abs(p.y) < hy + 0.01;
  const seeds = [];
  for (const f of faceSeeds) for (const s of [-1, 1]) seeds.push(new THREE.Vector3(hx + 0.03, s * f * size * 1.6, 0));
  for (const f of sideSeeds) for (const s of [-1, 1]) seeds.push(new THREE.Vector3(hx - 0.05 - f * size, s * (hy + 0.03), 0));
  const plane = [];
  for (const sd of seeds) {
    // 只向前追踪：从 N 极出发，绕到 S 极（进入磁铁）为止
    const B = new THREE.Vector3(), mid = new THREE.Vector3();
    const p = sd.clone();
    const pts = [p.clone()];
    for (let s = 0; s < 2400; s++) {
      field(p, B);
      let l = B.length();
      if (!(l > 1e-12)) break;
      mid.copy(p).addScaledVector(B, (step * 0.5) / l);
      mid.z = 0;
      field(mid, B);
      l = B.length();
      p.addScaledVector(B, step / l);
      p.z = 0;
      pts.push(p.clone());
      if (p.length() > bound || inside(p)) break;
    }
    if (pts.length > 4) plane.push(pts);
  }
  // 轴线上的一条
  plane.push([new THREE.Vector3(hx + 0.03, 0, 0), new THREE.Vector3(bound, 0, 0)]);
  plane.push([new THREE.Vector3(-bound, 0, 0), new THREE.Vector3(-hx - 0.03, 0, 0)]);
  const lines = revolveLines(plane, angles, 'x');
  return { field, lines, xN, xS };
}

/**
 * 条形磁铁（磁极间距 Lp，等效“磁荷”磁通 phi0 = Br·A）穿过同轴单匝圆线圈（半径 a）的磁通量。
 * u = 线圈位置 − 磁铁中心（沿轴，N 极朝 +u），返回沿 +u 方向的磁通。
 * 推导：磁荷模型 + 磁铁内部 μ0M 的贡献，结果连续光滑。
 */
export function magnetLoopFlux(u, a, Lp, phi0) {
  const s1 = u + Lp / 2, s2 = u - Lp / 2;
  return (phi0 / 2) * (s1 / Math.sqrt(s1 * s1 + a * a) - s2 / Math.sqrt(s2 * s2 + a * a));
}
/** 上式对 u 的导数 dΦ/du */
export function magnetLoopFluxDeriv(u, a, Lp, phi0) {
  const s1 = u + Lp / 2, s2 = u - Lp / 2, a2 = a * a;
  return (phi0 / 2) * a2 * (1 / Math.pow(s1 * s1 + a2, 1.5) - 1 / Math.pow(s2 * s2 + a2, 1.5));
}

/* ---------------- 磁极对（电动机 / 发电机） ---------------- */
/**
 * 左 N 右 S 的一对磁极（中间是沿 +x 的匀强磁场），下方有铁轭相连。
 * polePair({ gap, width, height, depth })；返回 Group
 */
export function polePair({ gap = 4.4, width = 1.5, height = 3.4, depth = 3.6 } = {}) {
  const g = new THREE.Group();
  const mk = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.2 });
  const n = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mk(COLOR.magnetN));
  n.position.x = -gap / 2 - width / 2;
  const s = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mk(COLOR.magnetS));
  s.position.x = gap / 2 + width / 2;
  const yokeH = 0.6;
  const yoke = new THREE.Mesh(
    new THREE.BoxGeometry(gap + width * 2, yokeH, depth),
    new THREE.MeshStandardMaterial({ color: 0x55565e, roughness: 0.5, metalness: 0.6 })
  );
  yoke.position.y = -height / 2 - yokeH / 2;
  g.add(n, s, yoke);
  const tn = faceLabel('N', { size: 0.9 });
  tn.position.set(n.position.x, 0.2, depth / 2 + 0.004);
  const ts = faceLabel('S', { size: 0.9 });
  ts.position.set(s.position.x, 0.2, depth / 2 + 0.004);
  const tn2 = faceLabel('N', { size: 0.9 });
  tn2.rotation.x = -Math.PI / 2;
  tn2.position.set(n.position.x, height / 2 + 0.004, 0);
  const ts2 = faceLabel('S', { size: 0.9 });
  ts2.rotation.x = -Math.PI / 2;
  ts2.position.set(s.position.x, height / 2 + 0.004, 0);
  g.add(tn, ts, tn2, ts2);
  g.userData.bottom = -height / 2 - yokeH;
  return g;
}

/** 两磁极之间匀强磁场的直线磁感线（沿 +x） */
export function uniformFieldLines({ x0 = -2.2, x1 = 2.2, ys = [-1.1, -0.37, 0.37, 1.1], zs = [-1.4, -0.47, 0.47, 1.4], seg = 12 } = {}) {
  const lines = [];
  for (const y of ys) for (const z of zs) {
    const l = [];
    for (let i = 0; i <= seg; i++) l.push(new THREE.Vector3(x0 + ((x1 - x0) * i) / seg, y, z));
    lines.push(l);
  }
  return lines;
}

/* ---------------- 转子线圈（矩形）与换向器 / 滑环 ---------------- */
/**
 * 矩形线圈路径（转子局部坐标，转轴为 z）：两条长边在 x = ±w，沿 z 从 +h 到 −h。
 * 路径：引线 A → 长边 A（x=+w，前→后）→ 后短边 → 长边 B（x=−w，后→前）→ 引线 B。
 * leadA / leadB 为引线末端附加点（Vector3 数组，A 的按“从末端到线圈”顺序给出）。
 */
export function rotorCoilPoints({ w = 1.4, h = 1.6, leadA = [], leadB = [] } = {}) {
  return [
    ...leadA,
    new THREE.Vector3(w, 0, h),
    new THREE.Vector3(w, 0, -h),
    new THREE.Vector3(-w, 0, -h),
    new THREE.Vector3(-w, 0, h),
    ...leadB,
  ];
}

/** 换向器：两个半圆铜环（转子局部坐标，轴沿 z），A 半环在 +x 一侧，B 在 −x 一侧，缺口在 ±y */
export function splitRing({ r = 0.42, len = 0.5, gapAngle = 0.16 } = {}) {
  const g = new THREE.Group();
  const matA = new THREE.MeshStandardMaterial({ color: 0xd08a4a, metalness: 0.85, roughness: 0.28, emissive: 0xff9f0a, emissiveIntensity: 0 });
  const matB = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.85, roughness: 0.3, emissive: 0xff9f0a, emissiveIntensity: 0 });
  // CylinderGeometry 的 theta 从 +z 起算；绕 x 转 90° 后局部角 φ = θ − π/2（从 +x 起算，绕 z）
  const mkHalf = (start, mat) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24, 1, false, start, Math.PI - 2 * gapAngle), mat);
    m.rotation.x = Math.PI / 2;
    return m;
  };
  const a = mkHalf(gapAngle, matA); // φ ∈ (−π/2+g, π/2−g) → +x 一侧
  const b = mkHalf(Math.PI + gapAngle, matB); // −x 一侧
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.82, r * 0.82, len * 1.02, 24),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.7 })
  );
  core.rotation.x = Math.PI / 2;
  g.add(a, b, core);
  g.userData.matA = matA;
  g.userData.matB = matB;
  return g;
}

/** 电刷（小碳块），沿 x 方向压在环上；side = +1 在 +x 侧，−1 在 −x 侧 */
export function brush({ side = 1, r = 0.42 } = {}) {
  const g = new THREE.Group();
  const block = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.22, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x2f2f35, roughness: 0.8 })
  );
  block.position.x = side * (r + 0.14);
  const holder = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.08, 0.34),
    new THREE.MeshStandardMaterial({ color: 0xc0c0c8, metalness: 0.8, roughness: 0.3 })
  );
  holder.position.x = side * (r + 0.36);
  g.add(block, holder);
  g.userData.contact = new THREE.Vector3(side * (r + 0.4), 0, 0);
  return g;
}
