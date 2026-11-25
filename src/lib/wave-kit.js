// 电磁波与通信组（emwave / spectrum / antenna / radio / telephone）共用的积木。
// 只依赖 kit.js 的只读接口；所有可每帧更新的对象都预分配缓冲区，update 中不新建几何体/材质。
import * as THREE from 'three';
import { COLOR, glowSprite, clamp } from './kit.js';

/* ---------------- 物理常数 ---------------- */
export const C_LIGHT = 299792458; // 光速 m/s
export const H_PLANCK = 6.62607015e-34; // 普朗克常数 J·s
export const EV = 1.602176634e-19; // 1 eV = 1.602e-19 J

/* ---------------- 数字格式化（返回 [数字文本, 单位]） ---------------- */
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** 科学计数法：3.00×10⁸ */
export function sci(v, digits = 2) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0';
  let e = Math.floor(Math.log10(Math.abs(v)));
  let m = v / Math.pow(10, e);
  if (Math.abs(+m.toFixed(digits)) >= 10) { m /= 10; e += 1; }
  if (e === 0) return m.toFixed(digits);
  return `${m.toFixed(digits)}×10${String(e).split('').map((c) => SUP[c]).join('')}`;
}
/** 三位有效数字 */
export function num3(v) {
  const a = Math.abs(v);
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  return v.toFixed(2);
}
function pickUnit(v, table) {
  const a = Math.abs(v);
  for (const [u, s] of table) if (a >= s * 0.9995) return [num3(v / s), u];
  const [u, s] = table[table.length - 1];
  return [num3(v / s), u];
}
export function fmtLength(m) {
  if (m >= 1e5) return [sci(m / 1e3, 1), 'km'];
  if (m < 1e-15) return [sci(m, 2), 'm'];
  return pickUnit(m, [['km', 1e3], ['m', 1], ['cm', 1e-2], ['mm', 1e-3], ['μm', 1e-6], ['nm', 1e-9], ['pm', 1e-12], ['fm', 1e-15]]);
}
export function fmtFreq(hz) {
  if (hz >= 1e15) return [sci(hz, 2), 'Hz'];
  return pickUnit(hz, [['THz', 1e12], ['GHz', 1e9], ['MHz', 1e6], ['kHz', 1e3], ['Hz', 1]]);
}
export function fmtEnergyEV(ev) {
  if (ev < 1e-6) return [sci(ev, 2), 'eV'];
  return pickUnit(ev, [['GeV', 1e9], ['MeV', 1e6], ['keV', 1e3], ['eV', 1], ['meV', 1e-3], ['μeV', 1e-6]]);
}
export function fmtTime(s) {
  if (s < 1e-12) return [sci(s, 2), 's'];
  return pickUnit(s, [['s', 1], ['ms', 1e-3], ['μs', 1e-6], ['ns', 1e-9], ['ps', 1e-12]]);
}
/** 光子能量（eV）：E = hf */
export const photonEV = (f) => (H_PLANCK * f) / EV;

/* ---------------- 文字精灵（会测量文字宽度，中文不会被裁切） ---------------- */
export function makeTextSprite(text, { size = 0.3, color = '#ffffff', bg = null, weight = 600, depthTest = true, opacity = 1 } = {}) {
  const font = `${weight} 64px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`;
  const cv = document.createElement('canvas');
  let g = cv.getContext('2d');
  g.font = font;
  const tw = Math.ceil(g.measureText(text).width);
  const pad = bg ? 34 : 12;
  cv.width = tw + pad * 2;
  cv.height = 96;
  g = cv.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(2, 2, cv.width - 4, cv.height - 4, 44);
    g.fill();
  }
  g.font = font;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, cv.width / 2, cv.height / 2 + 3);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest, depthWrite: false, opacity });
  const sp = new THREE.Sprite(mat);
  sp.scale.set((size * cv.width) / cv.height, size, 1);
  return sp;
}

/* ---------------- 标签集合（统一移除，防止 CSS 标签残留） ---------------- */
export class LabelSet {
  constructor(ctx, parent) {
    this.ctx = ctx;
    this.parent = parent;
    this.list = [];
  }
  add(text, pos, cls = '', parent = this.parent) {
    const l = this.ctx.label(text, { cls });
    if (Array.isArray(pos)) l.position.set(pos[0], pos[1], pos[2]);
    else l.position.copy(pos);
    parent.add(l);
    this.list.push(l);
    return l;
  }
  clear() {
    this.list.forEach((l) => l.parent?.remove(l));
    this.list = [];
  }
}

/* ---------------- 可每帧更新的“发光粗线”（管状，平行移动标架，不会扭曲） ---------------- */
export class TubeLine {
  /**
   * new TubeLine(maxPoints, { radius, radial, color, opacity, additive, vertexColors })
   * 用 setPoint(i,x,y,z) 写中心线，再 commit(n)。vertexColors 时可 setColor(i, r,g,b)。
   */
  constructor(maxPoints, { radius = 0.03, radial = 6, color = 0xffffff, opacity = 1, additive = false, vertexColors = false } = {}) {
    this.max = maxPoints;
    this.radial = radial;
    this.radius = radius;
    const nv = maxPoints * radial;
    this.pts = new Float32Array(maxPoints * 3);
    this.rs = new Float32Array(maxPoints).fill(1);
    this.pos = new Float32Array(nv * 3);
    this.geo = new THREE.BufferGeometry();
    const pa = new THREE.BufferAttribute(this.pos, 3);
    pa.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', pa);
    if (vertexColors) {
      this.col = new Float32Array(nv * 3).fill(1);
      this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    }
    const nIdx = (maxPoints - 1) * radial * 6;
    const idx = nv > 65535 ? new Uint32Array(nIdx) : new Uint16Array(nIdx);
    let k = 0;
    for (let i = 0; i < maxPoints - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * radial + j, b = i * radial + ((j + 1) % radial);
        const c = (i + 1) * radial + j, d = (i + 1) * radial + ((j + 1) % radial);
        idx[k++] = a; idx[k++] = c; idx[k++] = b;
        idx[k++] = b; idx[k++] = c; idx[k++] = d;
      }
    }
    this.geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geo.setDrawRange(0, 0);
    this.material = new THREE.MeshBasicMaterial({
      color, vertexColors, transparent: opacity < 1 || additive, opacity,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !additive && opacity >= 1, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
    this.object = this.mesh;
    this.cos = new Float32Array(radial);
    this.sin = new Float32Array(radial);
    for (let j = 0; j < radial; j++) { this.cos[j] = Math.cos((j / radial) * Math.PI * 2); this.sin[j] = Math.sin((j / radial) * Math.PI * 2); }
    this.n = 0;
  }
  setPoint(i, x, y, z, rScale = 1) {
    this.pts[i * 3] = x; this.pts[i * 3 + 1] = y; this.pts[i * 3 + 2] = z;
    this.rs[i] = rScale;
  }
  setColor(i, r, g, b) {
    if (!this.col) return;
    const R = this.radial;
    for (let j = 0; j < R; j++) { const o = (i * R + j) * 3; this.col[o] = r; this.col[o + 1] = g; this.col[o + 2] = b; }
  }
  commitColors() { if (this.col) this.geo.attributes.color.needsUpdate = true; }
  commit(n = this.n) {
    n = Math.min(n, this.max);
    this.n = n;
    if (n < 2) { this.geo.setDrawRange(0, 0); return; }
    const P = this.pts, out = this.pos, R = this.radial, rad = this.radius;
    // 初始法向：与第一段切线不平行的任意方向
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
      let tx = P[i1 * 3] - P[i0 * 3], ty = P[i1 * 3 + 1] - P[i0 * 3 + 1], tz = P[i1 * 3 + 2] - P[i0 * 3 + 2];
      let tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      if (i === 0) {
        // 取与切线最不平行的坐标轴叉乘
        const ax = Math.abs(tx), ay = Math.abs(ty), az = Math.abs(tz);
        let rx = 0, ry = 0, rz = 0;
        if (az <= ax && az <= ay) rz = 1; else if (ay <= ax) ry = 1; else rx = 1;
        nx = ty * rz - tz * ry; ny = tz * rx - tx * rz; nz = tx * ry - ty * rx;
      } else {
        // 平行移动：去掉法向在新切线上的分量
        const d = nx * tx + ny * ty + nz * tz;
        nx -= d * tx; ny -= d * ty; nz -= d * tz;
      }
      let nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-6) {
        const ax = Math.abs(tx), ay = Math.abs(ty), az = Math.abs(tz);
        let rx = 0, ry = 0, rz = 0;
        if (az <= ax && az <= ay) rz = 1; else if (ay <= ax) ry = 1; else rx = 1;
        nx = ty * rz - tz * ry; ny = tz * rx - tx * rz; nz = tx * ry - ty * rx;
        nl = Math.hypot(nx, ny, nz) || 1;
      }
      nx /= nl; ny /= nl; nz /= nl;
      // 副法向 b = t × n
      const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
      const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
      const r = rad * this.rs[i];
      for (let j = 0; j < R; j++) {
        const c = this.cos[j] * r, s = this.sin[j] * r;
        const o = (i * R + j) * 3;
        out[o] = px + nx * c + bx * s;
        out[o + 1] = py + ny * c + by * s;
        out[o + 2] = pz + nz * c + bz * s;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.setDrawRange(0, (n - 1) * R * 6);
  }
}

/* ---------------- 一组矢量箭头（InstancedMesh：箭杆 + 箭头各一个） ---------------- */
export class ArrowField {
  constructor(count, color, { radius = 0.028, headLength = 0.16, headRadius = 0.07, emissive = 0.8, opacity = 1 } = {}) {
    this.count = count;
    this.hl = headLength;
    this.group = new THREE.Group();
    this.object = this.group;
    this.material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, roughness: 0.4, transparent: opacity < 1, opacity });
    const sg = new THREE.CylinderGeometry(radius, radius, 1, 8);
    sg.translate(0, 0.5, 0);
    const hg = new THREE.ConeGeometry(headRadius, headLength, 12);
    hg.translate(0, headLength / 2, 0);
    this.shafts = new THREE.InstancedMesh(sg, this.material, count);
    this.heads = new THREE.InstancedMesh(hg, this.material, count);
    for (const m of [this.shafts, this.heads]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      this.group.add(m);
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < count; i++) this.hide(i);
    this.commit();
  }
  hide(i) {
    this.shafts.setMatrixAt(i, this._zero);
    this.heads.setMatrixAt(i, this._zero);
  }
  set(i, ox, oy, oz, vx, vy, vz) {
    const len = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (len < 0.02) { this.hide(i); return; }
    const hl = Math.min(this.hl, len * 0.5);
    const sl = Math.max(len - hl, 1e-4);
    this._d.set(vx / len, vy / len, vz / len);
    this._q.setFromUnitVectors(this._up, this._d);
    this._p.set(ox, oy, oz);
    this._s.set(1, sl, 1);
    this._m.compose(this._p, this._q, this._s);
    this.shafts.setMatrixAt(i, this._m);
    this._p.set(ox + this._d.x * sl, oy + this._d.y * sl, oz + this._d.z * sl);
    const hs = hl / this.hl;
    this._s.set(hs, hs, hs);
    this._m.compose(this._p, this._q, this._s);
    this.heads.setMatrixAt(i, this._m);
  }
  commit() {
    this.shafts.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
  }
}

/* ---------------- 大批线段（一次绘制，可每帧重写，可带亮度渐变） ---------------- */
export class LineBatch {
  constructor(maxSegments, { color = 0xffffff, opacity = 1, additive = false } = {}) {
    this.max = maxSegments;
    this.pos = new Float32Array(maxSegments * 6);
    this.col = new Float32Array(maxSegments * 6);
    this.geo = new THREE.BufferGeometry();
    const pa = new THREE.BufferAttribute(this.pos, 3);
    pa.setUsage(THREE.DynamicDrawUsage);
    const ca = new THREE.BufferAttribute(this.col, 3);
    ca.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', pa);
    this.geo.setAttribute('color', ca);
    this.geo.setDrawRange(0, 0);
    this.base = new THREE.Color(color);
    this.material = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false,
    });
    this.object = new THREE.LineSegments(this.geo, this.material);
    this.object.frustumCulled = false;
    this.n = 0;
  }
  begin() { this.n = 0; }
  seg(x1, y1, z1, x2, y2, z2, b1 = 1, b2 = b1) {
    if (this.n >= this.max) return;
    const o = this.n * 6, P = this.pos, C = this.col, c = this.base;
    P[o] = x1; P[o + 1] = y1; P[o + 2] = z1; P[o + 3] = x2; P[o + 4] = y2; P[o + 5] = z2;
    C[o] = c.r * b1; C[o + 1] = c.g * b1; C[o + 2] = c.b * b1;
    C[o + 3] = c.r * b2; C[o + 4] = c.g * b2; C[o + 5] = c.b * b2;
    this.n++;
  }
  end() {
    this.geo.setDrawRange(0, this.n * 2);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

/* ---------------- 向外扩散的圆环（波前 / 声波） ---------------- */
export class RingPool {
  /**
   * new RingPool(count, { color, plane:'xy'|'xz'|'yz', arc:[a0,a1], speed, maxR, r0, opacity, drift })
   * emit(strength) 发出一个环；update(dt) 推进。drift：圆环沿平面法向前进的速度（声波“往前走”）
   */
  constructor(count, { color = COLOR.signal, plane = 'xy', arc = [0, Math.PI * 2], speed = 2, maxR = 8, r0 = 0.05, opacity = 0.8, drift = 0, segments = 96, additive = true } = {}) {
    this.group = new THREE.Group();
    this.object = this.group;
    if (plane === 'xz') this.group.rotation.x = -Math.PI / 2;
    else if (plane === 'yz') this.group.rotation.y = Math.PI / 2;
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const a = arc[0] + ((arc[1] - arc[0]) * i) / segments;
      pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
    }
    this.geo = new THREE.BufferGeometry().setFromPoints(pts);
    this.speed = speed;
    this.maxR = maxR;
    this.r0 = r0;
    this.opacity = opacity;
    this.drift = drift;
    this.rings = [];
    for (let i = 0; i < count; i++) {
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
      const line = new THREE.Line(this.geo, mat);
      line.visible = false;
      line.frustumCulled = false;
      this.group.add(line);
      this.rings.push({ line, age: 0, s: 0, alive: false });
    }
  }
  emit(strength = 1) {
    let r = this.rings.find((x) => !x.alive);
    if (!r) r = this.rings.reduce((a, b) => (a.age > b.age ? a : b));
    r.alive = true;
    r.age = 0;
    r.s = clamp(strength, 0, 1.5);
    r.line.visible = true;
    this._place(r);
  }
  _place(r) {
    const R = this.r0 + this.speed * r.age;
    r.line.scale.set(R, R, 1);
    r.line.position.z = this.drift * r.age;
    const f = 1 - R / this.maxR;
    r.line.material.opacity = this.opacity * r.s * Math.max(0, f) * Math.min(1, r.age * 6 + 0.2);
  }
  update(dt) {
    for (const r of this.rings) {
      if (!r.alive) continue;
      r.age += dt;
      if (this.r0 + this.speed * r.age >= this.maxR) { r.alive = false; r.line.visible = false; continue; }
      this._place(r);
    }
  }
  clear() { for (const r of this.rings) { r.alive = false; r.line.visible = false; } }
}

/* ---------------- 几何小工具 ---------------- */
const _up = new THREE.Vector3(0, 1, 0);
/** 两点间的圆柱（杆、腿、支架） */
export function rod(a, b, radius, material, radial = 8) {
  const A = a.isVector3 ? a : new THREE.Vector3(...a);
  const B = b.isVector3 ? b : new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, radial), material);
  m.position.copy(A).addScaledVector(d, 0.5);
  if (len > 1e-6) m.quaternion.setFromUnitVectors(_up, d.normalize());
  return m;
}

/** 无线电发射塔（格构式铁塔 + 顶部天线 + 航空警示灯）。userData.top 塔顶（局部），userData.update(t) 闪灯 */
export function radioTower({ height = 6, base = 1.1, topW = 0.22, color = 0xc8ccd4, accent = 0xe8453c } = {}) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.35 });
  const red = new THREE.MeshStandardMaterial({ color: accent, metalness: 0.4, roughness: 0.45 });
  const H = height * 0.86;
  const corner = (w, y, sx, sz) => new THREE.Vector3(sx * w / 2, y, sz * w / 2);
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (const [sx, sz] of corners) g.add(rod(corner(base, 0, sx, sz), corner(topW, H, sx, sz), 0.04 * (height / 6), mat, 6));
  // 横撑与斜撑（细线）
  const pos = [];
  const levels = 7;
  for (let l = 0; l <= levels; l++) {
    const y0 = (H * l) / levels, y1 = (H * (l + 1)) / levels;
    const w0 = base + (topW - base) * (l / levels), w1 = base + (topW - base) * ((l + 1) / levels);
    for (let k = 0; k < 4; k++) {
      const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4];
      const a0 = corner(w0, y0, ax, az), b0 = corner(w0, y0, bx, bz);
      pos.push(a0.x, a0.y, a0.z, b0.x, b0.y, b0.z);
      if (l < levels) {
        const b1 = corner(w1, y1, bx, bz), a1 = corner(w1, y1, ax, az);
        pos.push(a0.x, a0.y, a0.z, b1.x, b1.y, b1.z);
        pos.push(b0.x, b0.y, b0.z, a1.x, a1.y, a1.z);
      }
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x9aa0aa, transparent: true, opacity: 0.8 })));
  // 红白相间的顶部天线杆
  const mastH = height - H;
  const segs = 4;
  for (let i = 0; i < segs; i++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, mastH / segs, 10), i % 2 ? mat : red);
    m.position.y = H + (mastH / segs) * (i + 0.5);
    g.add(m);
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 2 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), lampMat);
  lamp.position.y = height + 0.06;
  const halo = glowSprite(0xff3b30, 0.9, 0.8);
  halo.position.y = height + 0.06;
  g.add(lamp, halo);
  g.userData.top = new THREE.Vector3(0, height, 0);
  g.userData.update = (t) => {
    const on = Math.sin(t * 3) > 0 ? 1 : 0.15;
    lampMat.emissiveIntensity = 0.4 + on * 2;
    halo.material.opacity = 0.15 + on * 0.7;
  };
  return g;
}

/** 简化的人形（胶囊身体 + 球头），脚底在 y=0，面朝 +x。userData.mouth 为嘴的位置（局部） */
export function person({ color = 0x8e9bb5, skin = 0xe8c4a6, scale = 1 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.75, 6, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
  );
  body.position.y = 0.66;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.55 }));
  head.position.y = 1.5;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), eyeMat);
    eye.position.set(0.21, 1.55, s * 0.08);
    g.add(eye);
  }
  g.add(body, head);
  g.scale.setScalar(scale);
  g.userData.mouth = new THREE.Vector3(0.24 * scale, 1.42 * scale, 0);
  g.userData.ear = new THREE.Vector3(0, 1.5 * scale, 0.24 * scale);
  return g;
}

/** 可见光波长（nm）→ 近似 RGB（0..1），超出 380–780 返回暗色 */
export function wavelengthRGB(nm, out = new THREE.Color()) {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490 && nm >= 440) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510 && nm >= 490) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580 && nm >= 510) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645 && nm >= 580) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 780 && nm >= 645) { r = 1; }
  let f = 1;
  if (nm >= 380 && nm < 420) f = 0.3 + (0.7 * (nm - 380)) / 40;
  else if (nm > 700 && nm <= 780) f = 0.3 + (0.7 * (780 - nm)) / 80;
  else if (nm < 380 || nm > 780) f = 0;
  return out.setRGB(r * f, g * f, b * f);
}
