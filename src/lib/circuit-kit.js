// 「电路」组各章共用的小工具：SI 单位格式化、实例化小球、闪光池、金属晶格碰撞模拟、导线辅助函数。
// 只被 resistance / seriesparallel / power / battery / capacitor / semiconductor 使用。
import * as THREE from 'three';
import { COLOR, glowSprite, wire, roundedPath, clamp } from './kit.js';

/* ---------------- 数值格式化 ---------------- */
const PREFIX = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'μ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];

/** 把数值拆成「数字 + 带词头的单位」，如 0.00177 s → { num: '1.77', unit: 'ms' } */
export function siParts(v, unit = '', sig = 3) {
  if (!isFinite(v)) return { num: '∞', unit };
  if (v === 0) return { num: '0', unit };
  const a = Math.abs(v);
  let f = 1e-15, p = 'f';
  for (const [ff, pp] of PREFIX) if (a >= ff * 0.9995) { f = ff; p = pp; break; }
  const x = v / f;
  const ax = Math.abs(x);
  const d = ax >= 99.95 ? Math.max(0, sig - 3) : ax >= 9.995 ? Math.max(0, sig - 2) : Math.max(0, sig - 1);
  return { num: x.toFixed(d), unit: p + unit };
}
export const fmtSI = (v, unit = '', sig = 3) => { const s = siParts(v, unit, sig); return `${s.num} ${s.unit}`.trim(); };
/** 读数卡片按 SI 词头显示（自动切换单位） */
export function setSI(read, key, v, unit, sig = 3) {
  const s = siParts(v, unit, sig);
  read.set(key, v, s.num);
  read.unit(key, s.unit);
}
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** 上标数字：sup(-8) → '⁻⁸' */
export const sup = (n) => String(n).split('').map((c) => SUP[c] ?? c).join('');

/** 可复现的伪随机数（mulberry32） */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- 导线辅助 ---------------- */
const toV = (p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2] ?? 0));
/** 去掉相邻重合点（roundedPath 遇到零长度线段会出 NaN） */
export function dedupe(points) {
  const out = [];
  for (const p of points) {
    const v = toV(p);
    if (!out.length || out[out.length - 1].distanceTo(v) > 1e-4) out.push(v);
  }
  return out;
}
/** 安全版 roundedPath */
export const pathOf = (points, corner = 0.25, closed = false) => roundedPath(dedupe(points), corner, closed);
/** 画一段导线并加入 group，返回 mesh */
export function addWire(group, points, opts = {}) {
  const pts = dedupe(points);
  if (pts.length < 2) return null;
  const w = wire(pts, { radius: 0.05, corner: 0.25, ...opts });
  group.add(w.mesh);
  return w.mesh;
}
/** 导线连接点（焊点） */
export function addJoint(group, pos, r = 0.085) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd0d0d6, metalness: 0.9, roughness: 0.25 }));
  m.position.copy(toV(pos));
  group.add(m);
  return m;
}
/**
 * 电子穿过灯泡的路径（世界坐标）：底座 a → 左支架 → 灯丝 → 右支架 → 底座 b。
 * pos 为 bulb() 的位置，s 为其缩放。
 */
export function bulbPath(pos, s = 1) {
  const P = (x, y) => new THREE.Vector3(pos.x + x * s, pos.y + y * s, pos.z);
  return [P(-0.12, -0.24), P(-0.22, 0.12), P(-0.22, 0.78), P(0.22, 0.78), P(0.22, 0.12), P(0.12, -0.24)];
}

/* ---------------- 实例化小球（可逐个上色、隐藏） ---------------- */
export class Dots {
  constructor(count, { r = 0.08, color = 0xffffff, emissive = null, emissiveIntensity = 1, roughness = 0.45, metalness = 0.1, segments = 14, opacity = 1 } = {}) {
    this.count = count;
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    if (emissive != null) { mat.emissive.setHex(emissive); mat.emissiveIntensity = emissiveIntensity; }
    this.material = mat;
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(r, segments, Math.max(6, segments >> 1)), mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.object = this.mesh;
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this._colorDirty = false;
    for (let i = 0; i < count; i++) this.setAt(i, 0, 0, 0, 0);
    this.commit();
  }
  setAt(i, x, y, z, s = 1) {
    this._p.set(x, y, z);
    this._s.setScalar(Math.max(s, 0));
    this._m.compose(this._p, this._q, this._s);
    this.mesh.setMatrixAt(i, this._m);
  }
  hide(i) { this.setAt(i, 0, -999, 0, 0); }
  setColor(i, c) {
    this._c.set(c);
    this.mesh.setColorAt(i, this._c);
    this._colorDirty = true;
  }
  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this._colorDirty && this.mesh.instanceColor) { this.mesh.instanceColor.needsUpdate = true; this._colorDirty = false; }
  }
}

/* ---------------- 闪光池（碰撞火花、复合闪光） ---------------- */
export class SparkPool {
  constructor(n = 30, { color = 0xffb347, size = 0.5 } = {}) {
    this.group = new THREE.Group();
    this.object = this.group;
    this.items = [];
    this.size = size;
    for (let i = 0; i < n; i++) {
      const s = glowSprite(color, size, 0);
      s.visible = false;
      this.group.add(s);
      this.items.push({ s, life: 0, max: 0.3, size, peak: 1 });
    }
    this.next = 0;
  }
  spawn(x, y, z, { size, life = 0.3, peak = 1, color } = {}) {
    const it = this.items[this.next];
    this.next = (this.next + 1) % this.items.length;
    it.s.position.set(x, y, z);
    it.life = it.max = life;
    it.size = size ?? this.size;
    it.peak = peak;
    it.s.visible = true;
    it.s.material.opacity = peak;
    it.s.scale.setScalar(it.size * 0.8);
    if (color != null) it.s.material.color.set(color);
  }
  update(dt) {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      if (it.life <= 0) { it.s.visible = false; continue; }
      const k = it.life / it.max;
      it.s.material.opacity = it.peak * k;
      it.s.scale.setScalar(it.size * (1.4 - 0.6 * k));
    }
  }
}

/* ---------------- 金属晶格中的电子碰撞（Drude 模型示意） ---------------- */
/**
 * 一块金属的放大视图：离子排成晶格并热振动，自由电子在电场中加速、与离子碰撞后方向被打乱。
 * 参数（可随时改）：
 *   amp     离子振动幅度（随温度变大）
 *   rate    电子靠近离子时每秒发生碰撞的概率（与电阻率相关）
 *   accel   电场给电子的加速度（+x 方向）
 *   vth     碰撞后电子的随机速度大小
 *   sparkSize / sparkPeak 碰撞闪光的大小、亮度（越亮 = 交给晶格的能量越多）
 */
export class LatticeSim {
  constructor({ nx = 11, ny = 4, nz = 3, d = 0.9, electrons = 60, ionR = 0.17, eR = 0.065, sparkColor = 0xffb347, sparks = 40, seed = 7 } = {}) {
    this.group = new THREE.Group();
    this.nx = nx; this.ny = ny; this.nz = nz; this.d = d;
    this.ionR = ionR;
    const N = nx * ny * nz;
    this.N = N;
    this.x0 = -((nx - 1) * d) / 2;
    this.y0 = -((ny - 1) * d) / 2;
    this.z0 = -((nz - 1) * d) / 2;
    this.half = new THREE.Vector3(-this.x0 + d / 2, -this.y0 + d * 0.5, -this.z0 + d * 0.5);
    const R = rng(seed);
    this.grid = new Float32Array(N * 3);
    this.jit = new Float32Array(N * 3);
    this.base = new Float32Array(N * 3);
    this.cur = new Float32Array(N * 3);
    this.phase = new Float32Array(N * 3);
    this.freq = new Float32Array(N);
    this.hash = [];
    this.scale = new Float32Array(N).fill(1);
    let k = 0;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let l = 0; l < nz; l++) {
      this.grid[k * 3] = this.x0 + i * d;
      this.grid[k * 3 + 1] = this.y0 + j * d;
      this.grid[k * 3 + 2] = this.z0 + l * d;
      for (let a = 0; a < 3; a++) { this.jit[k * 3 + a] = R() * 2 - 1; this.phase[k * 3 + a] = R() * Math.PI * 2; }
      this.freq[k] = 7 + R() * 4;
      this.hash.push(R());
      k++;
    }
    this.base.set(this.grid);
    this.cur.set(this.grid);
    this.ions = new Dots(N, { r: ionR, color: 0xffffff, roughness: 0.35, metalness: 0.45, segments: 20 });
    this.group.add(this.ions.mesh);
    this.M = electrons;
    this.elec = new Dots(electrons, { r: eR, color: COLOR.electron, emissive: COLOR.electron, emissiveIntensity: 1.7, segments: 10 });
    this.group.add(this.elec.mesh);
    this.es = [];
    for (let i = 0; i < electrons; i++) {
      const p = new THREE.Vector3((R() * 2 - 1) * this.half.x, (R() * 2 - 1) * this.half.y * 0.9, (R() * 2 - 1) * this.half.z * 0.9);
      const v = new THREE.Vector3().randomDirection().multiplyScalar(1.4);
      this.es.push({ p, v });
    }
    this.sparks = new SparkPool(sparks, { color: sparkColor, size: 0.55 });
    this.group.add(this.sparks.group);
    // 外框
    const bg = new THREE.BoxGeometry(this.half.x * 2, this.half.y * 2, this.half.z * 2);
    const eg = new THREE.EdgesGeometry(bg);
    bg.dispose();
    this.frame = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x6a7488, transparent: true, opacity: 0.55 }));
    this.group.add(this.frame);

    this.amp = 0.05;
    this.rate = 1;
    this.accel = 1;
    this.vth = 1.4;
    this.vmax = 3.2;
    this.sparkSize = 0.55;
    this.sparkPeak = 0.9;
    this.collisions = 0; // 累计碰撞次数
    this._n = new THREE.Vector3();
    this.setMaterial({});
  }

  /** colors: [主元素, 第二种元素]，mix: 第二种元素比例，disorder: 位置无序程度（0~1），scales: 两种离子的大小 */
  setMaterial({ colors = [0xc87533, 0x8fa6c8], mix = 0, disorder = 0, scales = [1, 1] }) {
    for (let i = 0; i < this.N; i++) {
      const sp = mix > 0 && this.hash[i] < mix ? 1 : 0;
      this.ions.setColor(i, colors[sp] ?? colors[0]);
      this.scale[i] = scales[sp] ?? 1;
      for (let a = 0; a < 3; a++) this.base[i * 3 + a] = this.grid[i * 3 + a] + this.jit[i * 3 + a] * disorder * this.d * 0.16;
    }
    this.ions.commit();
  }

  update(dt, t) {
    const { N, cur, base, phase, freq, amp } = this;
    for (let i = 0; i < N; i++) {
      const w = freq[i];
      cur[i * 3] = base[i * 3] + amp * Math.sin(t * w + phase[i * 3]);
      cur[i * 3 + 1] = base[i * 3 + 1] + amp * Math.sin(t * w * 1.13 + phase[i * 3 + 1]);
      cur[i * 3 + 2] = base[i * 3 + 2] + amp * Math.sin(t * w * 0.91 + phase[i * 3 + 2]);
      this.ions.setAt(i, cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2], this.scale[i]);
    }
    this.ions.commit();
    const { half, d, nx, ny, nz, x0, y0, z0 } = this;
    const n = this._n;
    const hitR = this.ionR + 0.06;
    for (let k = 0; k < this.M; k++) {
      const e = this.es[k];
      if (dt > 0) {
        e.v.x += this.accel * dt;
        const sp = e.v.length();
        if (sp > this.vmax) e.v.multiplyScalar(this.vmax / sp);
        e.p.addScaledVector(e.v, dt);
        // x 方向周期边界（电子从一端出去、另一端进来 = 持续的电流）
        if (e.p.x > half.x) e.p.x -= half.x * 2;
        else if (e.p.x < -half.x) e.p.x += half.x * 2;
        if (e.p.y > half.y) { e.p.y = half.y; e.v.y = -Math.abs(e.v.y); }
        if (e.p.y < -half.y) { e.p.y = -half.y; e.v.y = Math.abs(e.v.y); }
        if (e.p.z > half.z) { e.p.z = half.z; e.v.z = -Math.abs(e.v.z); }
        if (e.p.z < -half.z) { e.p.z = -half.z; e.v.z = Math.abs(e.v.z); }
        // 最近的离子
        const i = clamp(Math.round((e.p.x - x0) / d), 0, nx - 1);
        const j = clamp(Math.round((e.p.y - y0) / d), 0, ny - 1);
        const l = clamp(Math.round((e.p.z - z0) / d), 0, nz - 1);
        const idx = (i * ny + j) * nz + l;
        n.set(e.p.x - cur[idx * 3], e.p.y - cur[idx * 3 + 1], e.p.z - cur[idx * 3 + 2]);
        const dist = n.length();
        if (dist < d * 0.55 && Math.random() < this.rate * dt) {
          // 碰撞：速度方向被打乱，电子沿电场方向“攒下”的动能交给离子
          n.divideScalar(Math.max(dist, 1e-4));
          const gained = Math.max(0, e.v.x);
          e.v.randomDirection().multiplyScalar(this.vth * (0.7 + Math.random() * 0.6));
          if (e.v.dot(n) < 0) e.v.addScaledVector(n, -2 * e.v.dot(n));
          const sx = cur[idx * 3] + n.x * this.ionR, sy = cur[idx * 3 + 1] + n.y * this.ionR, sz = cur[idx * 3 + 2] + n.z * this.ionR;
          this.sparks.spawn(sx, sy, sz, { size: this.sparkSize * (0.7 + Math.min(gained, 3) * 0.25), peak: this.sparkPeak, life: 0.28 });
          this.collisions++;
        } else if (dist < hitR) {
          // 贴得太近：弹开，避免穿过离子
          n.divideScalar(Math.max(dist, 1e-4));
          const vn = e.v.dot(n);
          if (vn < 0) e.v.addScaledVector(n, -2 * vn);
          e.p.set(cur[idx * 3] + n.x * hitR, cur[idx * 3 + 1] + n.y * hitR, cur[idx * 3 + 2] + n.z * hitR);
        }
      }
      this.elec.setAt(k, e.p.x, e.p.y, e.p.z);
    }
    this.elec.commit();
    this.sparks.update(dt);
  }
}
