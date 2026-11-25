// 可复用的 3D 积木：粒子、箭头、导线、流动电子、电池、电阻、灯泡、磁铁、线圈、指南针、场线……
// 所有章节共用同一套颜色约定，保证全站看起来是一个系统。
import * as THREE from 'three';

/* ---------------- 颜色约定 ---------------- */
export const COLOR = {
  electron: 0x4da3ff, // 电子 / 负电荷
  proton: 0xff5a4f, // 质子 / 正电荷
  neutron: 0x8e8e96, // 中子
  efield: 0xffcc33, // 电场 E
  bfield: 0x3ddc97, // 磁场 B
  current: 0xff9f0a, // 电流方向（约定的正电荷流向）
  copper: 0xc87533, // 铜导线
  ion: 0xd0d4dc, // 金属离子晶格
  hole: 0xff8fa3, // 半导体空穴
  magnetN: 0xe8453c, // 磁铁 N 极
  magnetS: 0x3c6fe8, // 磁铁 S 极
  signal: 0x64d2ff, // 信号 / 声音
  wave: 0xbf8cff, // 载波
};
export const hex = (c) => '#' + c.toString(16).padStart(6, '0');
export const CSSCOLOR = Object.fromEntries(Object.entries(COLOR).map(([k, v]) => [k, hex(v)]));

/* ---------------- 小工具 ---------------- */
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
/** 帧率无关的平滑趋近 */
export const damp = (cur, target, rate, dt) => lerp(cur, target, 1 - Math.exp(-rate * dt));
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** 释放一棵子树的几何体和材质（重建局部模型前调用），共享贴图不会被释放 */
export function disposeTree(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      for (const k in m) { const v = m[k]; if (v && v.isTexture && !v.userData?.shared) v.dispose(); }
      m.dispose();
    });
  });
}

/** 0..1 → 暗红 → 橙 → 黄白（温度/亮度色） */
export function heatColor(t, target = new THREE.Color()) {
  t = clamp(t, 0, 1);
  const stops = [
    [0, 0x2a0a06], [0.3, 0x9a1d0a], [0.55, 0xff5a1a], [0.8, 0xffb347], [1, 0xfff4d6],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      return target.setHex(c0).lerp(new THREE.Color(c1), (t - t0) / (t1 - t0));
    }
  }
  return target.setHex(0xfff4d6);
}

/* ---------------- 贴图（全站共享，不随章节销毁） ---------------- */
let _glowTex = null;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,.55)');
  grd.addColorStop(0.6, 'rgba(255,255,255,.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  _glowTex = new THREE.CanvasTexture(cv);
  _glowTex.userData.shared = true;
  return _glowTex;
}

const _textTex = new Map();
/** 画有文字的贴图（缓存），用于 +、−、N、S 等小符号 */
export function textTexture(text, { color = '#ffffff', weight = 700, bg = null, font = 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif' } = {}) {
  const key = `${text}|${color}|${weight}|${bg}`;
  if (_textTex.has(key)) return _textTex.get(key);
  const w = Math.max(128, 64 * [...text].length);
  const h = 128;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(4, 4, w - 8, h - 8, 56);
    g.fill();
  }
  g.fillStyle = color;
  g.font = `${weight} 92px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 6);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.shared = true;
  tex.userData.aspect = w / h;
  _textTex.set(key, tex);
  return tex;
}

/** 始终面向镜头的文字小图（比 HTML 标签便宜，适合大量 +/− 符号） */
export function textSprite(text, { size = 0.3, color = '#ffffff', bg = null, depthTest = true } = {}) {
  const tex = textTexture(text, { color, bg });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(size * tex.userData.aspect, size, 1);
  return sp;
}

/** 贴在物体表面的文字（平面贴花），不会像 Sprite 那样斜看时插进物体里 */
export function faceLabel(text, { size = 0.4, color = '#ffffff' } = {}) {
  const tex = textTexture(text, { color });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size * tex.userData.aspect, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })
  );
  return m;
}

/** 辉光光晕 */
export function glowSprite(color, size = 1, opacity = 0.9) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.setScalar(size);
  return sp;
}

/* ---------------- 粒子 ---------------- */
/**
 * 带电粒子小球。kind: 'electron' | 'proton' | 'neutron' | 'hole' | 'ion' 或直接给颜色数字
 * opts: r 半径, glow 是否带光晕, sign 是否显示 +/− 符号
 */
export function particle(kind = 'electron', { r = 0.12, glow = true, sign = false, emissive = 0.9 } = {}) {
  const color = typeof kind === 'number' ? kind : COLOR[kind] ?? 0xffffff;
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(r, 24, 16),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, roughness: 0.35, metalness: 0.1 })
  );
  g.add(mesh);
  if (glow) g.add(glowSprite(color, r * 5, 0.55));
  if (sign) {
    const ch = kind === 'electron' ? '−' : kind === 'proton' || kind === 'hole' ? '+' : '';
    if (ch) {
      const s = textSprite(ch, { size: r * 1.6, color: '#ffffff', depthTest: false });
      s.renderOrder = 10;
      g.add(s);
    }
  }
  g.userData.mesh = mesh;
  return g;
}

/**
 * 大量相同粒子：InstancedMesh。用 setAt(i, x, y, z) 摆放，最后 commit()。
 */
export class ParticleCloud {
  constructor(count, { color = COLOR.electron, r = 0.06, emissive = 1.2, segments = 12 } = {}) {
    this.count = count;
    this.mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(r, segments, Math.max(6, segments >> 1)),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, roughness: 0.4 }),
      count
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this._m = new THREE.Matrix4();
    this._s = new THREE.Vector3(1, 1, 1);
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
  }
  setAt(i, x, y, z, scale = 1) {
    this._p.set(x, y, z);
    this._s.setScalar(scale);
    this._m.compose(this._p, this._q, this._s);
    this.mesh.setMatrixAt(i, this._m);
  }
  setColorAt(i, color) {
    this.mesh.setColorAt(i, color);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ---------------- 箭头 ---------------- */
/** 粗箭头（矢量）。arrow.set(origin, vec) 设定起点和矢量；长度=矢量长度 */
export class Arrow extends THREE.Group {
  constructor(color = 0xffffff, { radius = 0.035, headLength = 0.22, headRadius = 0.09, emissive = 0.6, opacity = 1 } = {}) {
    super();
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, roughness: 0.4, transparent: opacity < 1, opacity });
    this.material = mat;
    this.shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 12), mat);
    this.head = new THREE.Mesh(new THREE.ConeGeometry(headRadius, headLength, 16), mat);
    this.headLength = headLength;
    this.add(this.shaft, this.head);
    this._up = new THREE.Vector3(0, 1, 0);
  }
  set(origin, vec) {
    const len = vec.length();
    this.position.copy(origin);
    if (len < 1e-4) { this.visible = false; return this; }
    this.visible = true;
    const hl = Math.min(this.headLength, len * 0.5);
    const sl = Math.max(len - hl, 1e-4);
    this.shaft.scale.set(1, sl, 1);
    this.shaft.position.set(0, sl / 2, 0);
    this.head.scale.set(hl / this.headLength, hl / this.headLength, hl / this.headLength);
    this.head.position.set(0, sl + hl / 2, 0);
    this.quaternion.setFromUnitVectors(this._up, vec.clone().divideScalar(len));
    return this;
  }
  setColor(c) { this.material.color.set(c); this.material.emissive.set(c); }
}

/* ---------------- 导线与电流 ---------------- */
/** 折线 → 圆角路径（导线拐角处圆滑），返回 THREE.CurvePath */
export function roundedPath(points, corner = 0.3, closed = false) {
  const pts = points.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(...p)));
  const path = new THREE.CurvePath();
  const n = pts.length;
  if (n < 2) return path;
  const get = (i) => pts[(i + n) % n];
  const cornerPts = [];
  for (let i = 0; i < n; i++) {
    const isEnd = !closed && (i === 0 || i === n - 1);
    if (isEnd) { cornerPts.push({ a: pts[i], b: pts[i], c: pts[i] }); continue; }
    const p = get(i), prev = get(i - 1), next = get(i + 1);
    const d1 = prev.clone().sub(p), d2 = next.clone().sub(p);
    const r = Math.min(corner, d1.length() / 2, d2.length() / 2);
    cornerPts.push({ a: p.clone().add(d1.normalize().multiplyScalar(r)), b: p, c: p.clone().add(d2.normalize().multiplyScalar(r)) });
  }
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const cur = cornerPts[i], nxt = cornerPts[(i + 1) % n];
    if (i > 0 || closed) {
      if (cur.a.distanceTo(cur.c) > 1e-5) path.add(new THREE.QuadraticBezierCurve3(cur.a, cur.b, cur.c));
    }
    if (cur.c.distanceTo(nxt.a) > 1e-5) path.add(new THREE.LineCurve3(cur.c, nxt.a));
  }
  return path;
}

/**
 * 导线：wire(points 或 curve, { radius, color, closed, corner, opacity })
 * 返回 { mesh, curve, length }
 */
export function wire(pointsOrCurve, { radius = 0.06, color = COLOR.copper, closed = false, corner = 0.3, opacity = 1, metalness = 0.85, roughness = 0.3, segments } = {}) {
  const curve = pointsOrCurve.getPointAt ? pointsOrCurve : roundedPath(pointsOrCurve, corner, closed);
  const length = curve.getLength();
  const seg = segments ?? Math.max(32, Math.round(length * 24));
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, seg, radius, 12, closed),
    new THREE.MeshStandardMaterial({ color, metalness, roughness, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 })
  );
  return { mesh, curve, length };
}

/**
 * 沿路径流动的粒子（电子流 / 电流箭头）。
 * new Flow(curve, { count, color, r, speed(单位/秒，负数反向), jitter(横向抖动) })
 * 每帧 flow.update(dt)。flow.speed 可随时改。
 */
export class Flow {
  constructor(curve, { count = 40, color = COLOR.electron, r = 0.06, speed = 1, jitter = 0, emissive = 1.4, closed = true } = {}) {
    this.curve = curve;
    this.length = curve.getLength();
    this.count = count;
    this.speed = speed;
    this.jitter = jitter;
    this.closed = closed;
    this.offset = 0;
    this.cloud = new ParticleCloud(count, { color, r, emissive });
    this.object = this.cloud.mesh;
    this.seeds = Array.from({ length: count }, () => [Math.random() * 6.28, Math.random() * 6.28, Math.random()]);
    this._t = 0;
    this.update(0);
  }
  update(dt) {
    this._t += dt;
    this.offset += (this.speed * dt) / this.length;
    const p = new THREE.Vector3();
    for (let i = 0; i < this.count; i++) {
      let u = (i / this.count + this.offset) % 1;
      if (u < 0) u += 1;
      this.curve.getPointAt(u, p);
      if (this.jitter) {
        const s = this.seeds[i];
        p.x += Math.sin(this._t * 7 + s[0]) * this.jitter;
        p.y += Math.sin(this._t * 9 + s[1]) * this.jitter;
        p.z += Math.cos(this._t * 8 + s[0]) * this.jitter;
      }
      this.cloud.setAt(i, p.x, p.y, p.z);
    }
    this.cloud.commit();
  }
}

/** 沿路径排列的小箭头（表示电流方向），update(dt) 让它们流动 */
export class ArrowFlow {
  constructor(curve, { count = 12, color = COLOR.current, size = 0.14, speed = 0.6, offsetY = 0 } = {}) {
    this.curve = curve;
    this.length = curve.getLength();
    this.count = count;
    this.speed = speed;
    this.offset = 0;
    const geo = new THREE.ConeGeometry(size * 0.55, size * 1.4, 12);
    geo.rotateX(Math.PI / 2); // 尖端朝 +z
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1 }), count);
    this.mesh.frustumCulled = false;
    this.object = this.mesh;
    this.offsetY = offsetY;
    this._m = new THREE.Matrix4();
    this.update(0);
  }
  update(dt) {
    this.offset += (this.speed * dt) / this.length;
    const p = new THREE.Vector3(), t = new THREE.Vector3(), target = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < this.count; i++) {
      let u = (i / this.count + this.offset) % 1;
      if (u < 0) u += 1;
      this.curve.getPointAt(u, p);
      this.curve.getTangentAt(u, t);
      if (this.speed < 0) t.negate();
      p.y += this.offsetY;
      target.copy(p).add(t);
      // Matrix4.lookAt(eye, target) 的 z 轴 = eye - target，这里让 z 轴沿切线方向
      this._m.lookAt(target, p, Math.abs(t.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : up);
      this._m.setPosition(p);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ---------------- 电路元件 ---------------- */
/** 电池（竖直，+ 极朝上）。userData.top / bottom 为两极接线点（局部坐标） */
export function battery({ height = 1.6, radius = 0.38, label = true } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 40),
    new THREE.MeshStandardMaterial({ color: 0x1f1f24, metalness: 0.3, roughness: 0.45 })
  );
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.005, radius * 1.005, height * 0.42, 40),
    new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.6, roughness: 0.35 })
  );
  band.position.y = height * 0.29;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.32, radius * 0.32, 0.12, 24),
    new THREE.MeshStandardMaterial({ color: 0xd8d8de, metalness: 0.9, roughness: 0.2 })
  );
  cap.position.y = height / 2 + 0.06;
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 0.04, 32),
    new THREE.MeshStandardMaterial({ color: 0xd8d8de, metalness: 0.9, roughness: 0.2 })
  );
  base.position.y = -height / 2 - 0.02;
  g.add(body, band, cap, base);
  if (label) {
    const p = textSprite('+', { size: 0.42, color: '#ff6b5e' });
    p.position.set(0, height * 0.29, radius + 0.05);
    const m = textSprite('−', { size: 0.42, color: '#7fb8ff' });
    m.position.set(0, -height * 0.3, radius + 0.05);
    g.add(p, m);
  }
  g.userData.top = new THREE.Vector3(0, height / 2 + 0.12, 0);
  g.userData.bottom = new THREE.Vector3(0, -height / 2 - 0.04, 0);
  return g;
}

/** 色环电阻（沿 x 轴）。userData.left/right 为接线点 */
export function resistor({ length = 1.2, radius = 0.2, color = 0xd9c7a1 } = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const pts = [];
  const L = length / 2;
  for (let i = 0; i <= 24; i++) {
    const x = -L + (length * i) / 24;
    const t = Math.abs(x) / L;
    const r = radius * (t > 0.7 ? 1.12 - (t - 0.7) * 0.6 : t > 0.45 ? 0.9 + (t - 0.45) * 0.88 : 0.9);
    pts.push(new THREE.Vector2(Math.max(r, 0.02), x));
  }
  const geo = new THREE.LatheGeometry(pts, 32);
  geo.rotateZ(-Math.PI / 2);
  const body = new THREE.Mesh(geo, bodyMat);
  g.add(body);
  const bands = [0x8b4513, 0x111111, 0xff3b30, 0xc9a227];
  bands.forEach((c, i) => {
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.93, radius * 0.93, length * 0.06, 32),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })
    );
    b.rotation.z = Math.PI / 2;
    b.position.x = -L * 0.45 + i * L * 0.25 + (i === 3 ? L * 0.15 : 0);
    g.add(b);
  });
  g.userData.left = new THREE.Vector3(-L, 0, 0);
  g.userData.right = new THREE.Vector3(L, 0, 0);
  g.userData.body = body;
  return g;
}

/** 灯泡（竖直，底座朝下）。bulb.userData.setLevel(0..1) 控制亮度。userData.a/b 为底部两接线点 */
export function bulb({ scale = 1 } = {}) {
  const g = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, emissive: 0xffc46b, emissiveIntensity: 0, depthWrite: false });
  const prof = [];
  for (let i = 0; i <= 30; i++) {
    const a = -Math.PI * 0.32 + (Math.PI * 1.32 * i) / 30;
    prof.push(new THREE.Vector2(Math.max(0.001, Math.cos(a) * 0.55), 0.75 + Math.sin(a) * 0.55));
  }
  prof.unshift(new THREE.Vector2(0.24, 0.12));
  const glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), glassMat);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.2, 0.36, 32),
    new THREE.MeshStandardMaterial({ color: 0xbfc3c9, metalness: 0.9, roughness: 0.25 })
  );
  base.position.y = -0.06;
  // 灯丝：小螺旋
  const fpts = [];
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const x = -0.22 + t * 0.44;
    fpts.push(new THREE.Vector3(x, 0.78 + Math.sin(t * Math.PI * 16) * 0.035, Math.cos(t * Math.PI * 16) * 0.035));
  }
  const filMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20, emissive: 0x000000, roughness: 0.6 });
  const fil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fpts), 200, 0.012, 6), filMat);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x9a9aa0, metalness: 0.8, roughness: 0.3 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.66, 6), legMat);
    leg.position.set(s * 0.22, 0.45, 0);
    g.add(leg);
  }
  const halo = glowSprite(0xffc46b, 2.4, 0);
  halo.position.y = 0.78;
  const light = new THREE.PointLight(0xffc46b, 0, 8, 1.6);
  light.position.y = 0.78;
  g.add(glass, base, fil, halo, light);
  g.scale.setScalar(scale);
  const tmp = new THREE.Color();
  g.userData.setLevel = (v) => {
    v = clamp(v, 0, 1.4);
    heatColor(Math.min(1, 0.15 + v * 0.85), tmp);
    filMat.emissive.copy(v > 0.02 ? tmp : new THREE.Color(0));
    filMat.emissiveIntensity = 0.5 + v * 3;
    glassMat.emissiveIntensity = v * 0.35;
    halo.material.opacity = Math.min(1, v * 0.9);
    halo.scale.setScalar(1.2 + v * 2.2);
    light.intensity = v * 6;
  };
  g.userData.a = new THREE.Vector3(-0.12 * scale, -0.24 * scale, 0);
  g.userData.b = new THREE.Vector3(0.12 * scale, -0.24 * scale, 0);
  g.userData.setLevel(0);
  return g;
}

/** 开关（沿 x 轴，两端接线点 userData.left/right），userData.set(closed) */
export function switchPart({ length = 1 } = {}) {
  const g = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(length * 1.1, 0.08, 0.4), baseMat);
  base.position.y = -0.1;
  const metal = new THREE.MeshStandardMaterial({ color: 0xd0d0d6, metalness: 0.9, roughness: 0.25 });
  const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.18, 16), metal);
  postL.position.set(-length / 2, 0, 0);
  const postR = postL.clone();
  postR.position.x = length / 2;
  const lever = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(length, 0.04, 0.08), metal);
  bar.position.x = length / 2;
  lever.add(bar);
  lever.position.set(-length / 2, 0.08, 0);
  g.add(base, postL, postR, lever);
  let target = 0, cur = 0;
  g.userData.set = (closed) => { target = closed ? 0 : 0.6; };
  g.userData.update = (dt) => { cur = damp(cur, target, 10, dt); lever.rotation.z = cur; };
  g.userData.left = new THREE.Vector3(-length / 2, 0.08, 0);
  g.userData.right = new THREE.Vector3(length / 2, 0.08, 0);
  return g;
}

/**
 * 指针式电表（电流表 A / 电压表 V / 灵敏电流计 G）。表盘朝 +z。
 * meter({ symbol:'A', max:3, zeroCenter:false, size:1 })；meter.userData.setValue(v)；userData.update(dt) 让指针平滑转动
 */
export function meter({ symbol = 'A', max = 1, zeroCenter = false, size = 1, unit = '' } = {}) {
  const g = new THREE.Group();
  const W = 1.3 * size, H = 1.0 * size, D = 0.35 * size;
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, D),
    new THREE.MeshStandardMaterial({ color: 0x2b2b31, roughness: 0.5, metalness: 0.2 })
  );
  g.add(box);
  // 表盘贴图
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 400;
  const c = cv.getContext('2d');
  c.fillStyle = '#f4f1e8';
  c.beginPath(); c.roundRect(0, 0, 512, 400, 40); c.fill();
  const cx = 256, cy = 330, R = 230;
  const a0 = Math.PI * 1.2, a1 = Math.PI * 1.8;
  c.strokeStyle = '#222'; c.lineWidth = 4;
  c.beginPath(); c.arc(cx, cy, R, a0, a1); c.stroke();
  c.fillStyle = '#222';
  c.font = '600 30px system-ui, sans-serif';
  c.textAlign = 'center';
  const ticks = 10;
  for (let i = 0; i <= ticks * 5; i++) {
    const a = a0 + ((a1 - a0) * i) / (ticks * 5);
    const big = i % 5 === 0;
    const r1 = R - (big ? 34 : 18);
    c.lineWidth = big ? 4 : 2;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    c.stroke();
    if (big && (i / 5) % 2 === 0) {
      const v = zeroCenter ? -max + (2 * max * i) / (ticks * 5) : (max * i) / (ticks * 5);
      const txt = Math.abs(v) < 1e-9 ? '0' : +v.toFixed(2) + '';
      c.fillText(txt, cx + Math.cos(a) * (R - 62), cy + Math.sin(a) * (R - 62) + 10);
    }
  }
  c.font = '700 84px Georgia, serif';
  c.fillStyle = symbol === 'V' ? '#1b5fbf' : symbol === 'G' ? '#2a7a3c' : '#b8321f';
  c.fillText(symbol, cx, cy - 40);
  if (unit) { c.font = '500 26px system-ui'; c.fillStyle = '#555'; c.fillText(unit, cx, cy + 4); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.88, H * 0.84), new THREE.MeshBasicMaterial({ map: tex, color: 0x9a9a9a }));
  face.position.z = D / 2 + 0.001;
  g.add(face);
  // 指针：绕表盘中心下方的轴转
  const fw = W * 0.88, fh = H * 0.84;
  const pivotY = -fh / 2 + (70 / 400) * fh;
  const needleLen = (R / 512) * fw * 0.95;
  const pivot = new THREE.Group();
  pivot.position.set(0, pivotY, D / 2 + 0.01);
  const needle = new THREE.Mesh(
    new THREE.BoxGeometry(0.018 * size, needleLen, 0.01),
    new THREE.MeshBasicMaterial({ color: 0xc0281b })
  );
  needle.position.y = needleLen / 2;
  pivot.add(needle);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * size, 0.04 * size, 0.02, 16), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  hub.rotation.x = Math.PI / 2;
  pivot.add(hub);
  g.add(pivot);
  const half = (a1 - a0) / 2; // 0.3π
  let target = 0, cur = 0;
  const angleOf = (v) => {
    const t = zeroCenter ? clamp(v / max, -1.08, 1.08) : clamp(v / max, -0.04, 1.08) * 2 - 1;
    return -t * half;
  };
  g.userData.setValue = (v) => { target = angleOf(v); };
  g.userData.update = (dt) => { cur = damp(cur, target, 9, dt); pivot.rotation.z = cur; };
  cur = target = angleOf(0);
  pivot.rotation.z = cur;
  // 两个接线柱
  const postMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d6, metalness: 0.9, roughness: 0.25 });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * size, 0.06 * size, 0.14 * size, 16), postMat);
    p.position.set(s * W * 0.32, H / 2 + 0.07 * size, 0);
    g.add(p);
  }
  g.userData.left = new THREE.Vector3(-W * 0.32, H / 2 + 0.14 * size, 0);
  g.userData.right = new THREE.Vector3(W * 0.32, H / 2 + 0.14 * size, 0);
  return g;
}

/* ---------------- 磁 ---------------- */
/** 条形磁铁（沿 x 轴，N 极在 +x） */
export function barMagnet({ length = 3, size = 0.6 } = {}) {
  const g = new THREE.Group();
  const half = length / 2;
  const mk = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15 });
  const n = new THREE.Mesh(new THREE.BoxGeometry(half, size, size), mk(COLOR.magnetN));
  n.position.x = half / 2;
  const s = new THREE.Mesh(new THREE.BoxGeometry(half, size, size), mk(COLOR.magnetS));
  s.position.x = -half / 2;
  g.add(n, s);
  // N/S 字母贴在前、后、上、下四个面
  for (const [ch, x] of [['N', half * 0.62], ['S', -half * 0.62]]) {
    for (let k = 0; k < 4; k++) {
      const f = faceLabel(ch, { size: size * 0.7 });
      const a = (k * Math.PI) / 2;
      const holder = new THREE.Group();
      holder.rotation.x = a;
      f.position.set(x, 0, size / 2 + 0.004);
      holder.add(f);
      g.add(holder);
    }
  }
  return g;
}

/**
 * 螺旋线圈（沿 x 轴）。返回 { mesh, curve }
 * coil({ radius, turns, length, wire, color })
 */
export function coil({ radius = 1, turns = 10, length = 2, wire: wr = 0.05, color = COLOR.copper, leads = 0 } = {}) {
  const pts = [];
  const N = turns * 48;
  if (leads) pts.push(new THREE.Vector3(-length / 2, -radius - leads, 0));
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = t * turns * Math.PI * 2 - Math.PI / 2;
    pts.push(new THREE.Vector3(-length / 2 + t * length, Math.sin(a) * radius, Math.cos(a) * radius));
  }
  if (leads) pts.push(new THREE.Vector3(length / 2, -radius - leads, 0));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, N * 2, wr, 8, false),
    new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.3 })
  );
  return { mesh, curve };
}

/** 小指南针。compass.userData.point(vec3) 让 N 极（红）在 xz 平面内指向 vec 方向；userData.update(dt) 平滑转动 */
export function compass({ r = 0.32 } = {}) {
  const g = new THREE.Group();
  const disk = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 0.04, 32),
    new THREE.MeshStandardMaterial({ color: 0x2c2c32, roughness: 0.5, metalness: 0.3 })
  );
  const needle = new THREE.Group();
  const nMat = new THREE.MeshStandardMaterial({ color: COLOR.magnetN, emissive: COLOR.magnetN, emissiveIntensity: 0.4 });
  const sMat = new THREE.MeshStandardMaterial({ color: 0xe8e8ee, emissive: 0x666666, emissiveIntensity: 0.2 });
  const north = new THREE.Mesh(new THREE.ConeGeometry(r * 0.22, r * 0.9, 4), nMat);
  north.rotation.z = -Math.PI / 2;
  north.position.x = r * 0.45;
  const south = new THREE.Mesh(new THREE.ConeGeometry(r * 0.22, r * 0.9, 4), sMat);
  south.rotation.z = Math.PI / 2;
  south.position.x = -r * 0.45;
  needle.add(north, south);
  needle.position.y = 0.06;
  g.add(disk, needle);
  let target = 0, cur = 0;
  g.userData.point = (v) => { if (v.x * v.x + v.z * v.z > 1e-10) target = Math.atan2(-v.z, v.x); };
  g.userData.update = (dt) => {
    let d = target - cur;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    cur += d * (1 - Math.exp(-8 * dt));
    needle.rotation.y = cur;
  };
  return g;
}

/* ---------------- 场线 ---------------- */
/** 点电荷系在 p 处的电场（k=1 的相对单位） */
export function fieldAt(charges, p, out = new THREE.Vector3()) {
  out.set(0, 0, 0);
  const d = new THREE.Vector3();
  for (const c of charges) {
    d.subVectors(p, c.pos);
    const r2 = Math.max(d.lengthSq(), 1e-4);
    out.addScaledVector(d, c.q / (r2 * Math.sqrt(r2)));
  }
  return out;
}

/** 点电荷系的电势（k=1） */
export function potentialAt(charges, p) {
  let v = 0;
  for (const c of charges) v += c.q / Math.max(p.distanceTo(c.pos), 0.05);
  return v;
}

/**
 * 追踪电场线。charges: [{ pos: Vector3, q }]
 * opts: perCharge 每个电荷发出的线数（会按电量缩放）, plane: null|'xy'|'xz'（只在平面内发线）, step, maxSteps, bound
 * 返回 Vector3 数组的数组
 */
export function traceFieldLines(charges, { perCharge = 16, plane = null, step = 0.04, maxSteps = 900, bound = 14, startR = 0.18 } = {}) {
  const lines = [];
  const anyPos = charges.some((c) => c.q > 0);
  const sources = charges.filter((c) => (anyPos ? c.q > 0 : c.q < 0));
  const E = new THREE.Vector3();
  for (const src of sources) {
    const n = Math.max(4, Math.round(perCharge * Math.abs(src.q)));
    const dirs = [];
    if (plane) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.001;
        dirs.push(plane === 'xy' ? V(Math.cos(a), Math.sin(a), 0) : V(Math.cos(a), 0, Math.sin(a)));
      }
    } else {
      const ga = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2;
        const rr = Math.sqrt(1 - y * y);
        dirs.push(V(Math.cos(ga * i) * rr, y, Math.sin(ga * i) * rr));
      }
    }
    const sign = anyPos ? 1 : -1;
    for (const d of dirs) {
      const p = src.pos.clone().addScaledVector(d, startR);
      const line = [p.clone()];
      for (let s = 0; s < maxSteps; s++) {
        fieldAt(charges, p, E);
        const len = E.length();
        if (len < 1e-6) break;
        // RK2
        const mid = p.clone().addScaledVector(E, (sign * step * 0.5) / len);
        fieldAt(charges, mid, E);
        p.addScaledVector(E, (sign * step) / E.length());
        line.push(p.clone());
        if (p.length() > bound) break;
        let hit = false;
        for (const c of charges) if (c !== src && p.distanceTo(c.pos) < startR * 0.8) hit = true;
        if (hit) break;
      }
      if (line.length > 2) lines.push(line);
    }
  }
  return lines;
}

/**
 * 场线 → 一个 Group（细线 + 沿线的小箭头表示方向）
 * opts: color, opacity, arrows（每条线箭头数）, arrowSize
 */
export function fieldLinesObject(lines, { color = COLOR.efield, opacity = 0.75, arrows = 2, arrowSize = 0.12, reverse = false } = {}) {
  const g = new THREE.Group();
  const positions = [];
  for (const l of lines) {
    for (let i = 0; i < l.length - 1; i++) positions.push(l[i].x, l[i].y, l[i].z, l[i + 1].x, l[i + 1].y, l[i + 1].z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  g.add(new THREE.LineSegments(geo, mat));
  if (arrows > 0) {
    const cones = [];
    for (const l of lines) {
      if (l.length < 8) continue;
      for (let k = 1; k <= arrows; k++) {
        const i = Math.floor((l.length * k) / (arrows + 1));
        const a = l[i], b = l[Math.min(i + 1, l.length - 1)];
        const dir = b.clone().sub(a);
        if (reverse) dir.negate();
        if (dir.lengthSq() < 1e-10) continue;
        cones.push([a, dir.normalize()]);
      }
    }
    if (cones.length) {
      const cg = new THREE.ConeGeometry(arrowSize * 0.45, arrowSize, 8);
      const im = new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: Math.min(1, opacity + 0.2) }), cones.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V(0, 1, 0), one = V(1, 1, 1);
      cones.forEach(([p, d], i) => { q.setFromUnitVectors(up, d); m.compose(p, q, one); im.setMatrixAt(i, m); });
      g.add(im);
    }
  }
  return g;
}

/* ---------------- 舞台 ---------------- */
/** 深色圆形地台 + 淡网格，让物体有“落脚点” */
export function stageFloor({ radius = 16, y = -2.5, grid = true } = {}) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 64),
    new THREE.MeshStandardMaterial({ color: 0x15151b, roughness: 0.95, metalness: 0 })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = y;
  g.add(disc);
  if (grid) {
    const gh = new THREE.GridHelper(radius * 2, Math.round(radius * 2), 0x2a2a33, 0x1e1e26);
    gh.position.y = y + 0.002;
    gh.material.transparent = true;
    gh.material.opacity = 0.55;
    g.add(gh);
  }
  return g;
}

/** 由点数组生成一条线（可每帧 setPoints 更新） */
export class Polyline {
  constructor(maxPoints, { color = 0xffffff, opacity = 1 } = {}) {
    this.max = maxPoints;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(maxPoints * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setDrawRange(0, 0);
    this.object = new THREE.Line(this.geo, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
    this.object.frustumCulled = false;
  }
  setPoints(pts) {
    const n = Math.min(pts.length, this.max);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      this.pos[i * 3] = p.x ?? p[0];
      this.pos[i * 3 + 1] = p.y ?? p[1];
      this.pos[i * 3 + 2] = p.z ?? p[2];
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
  }
  /** 用函数 f(i) 填充 [x,y,z] */
  fill(n, f) {
    n = Math.min(n, this.max);
    for (let i = 0; i < n; i++) {
      const [x, y, z] = f(i);
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
  }
}
