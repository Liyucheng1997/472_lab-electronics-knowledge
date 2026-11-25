// 「电荷与电场」「电流」几章共用的小工具：科学计数法格式化、可隐藏的读数卡、3D 拖拽、带电小球、轨迹线。
import * as THREE from 'three';
import { COLOR, textTexture, glowSprite } from './kit.js';

export const MINUS = '−';
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (n) => String(n).split('').map((c) => SUP[c] ?? c).join('');

/**
 * 数字 → 易读字符串。介于 plainMin 与 plainMax 之间直接写小数，否则写成 a.bc×10ⁿ。
 * digits：有效数字位数 - 1（默认 2 → 3 位有效数字）
 */
export function sci(v, digits = 2, { plainMin = 1e-2, plainMax = 1e4 } = {}) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  const sign = v < 0 ? MINUS : '';
  if (a >= plainMin && a < plainMax) {
    const dec = Math.max(0, Math.min(5, digits - Math.floor(Math.log10(a))));
    return sign + a.toFixed(dec);
  }
  let e = Math.floor(Math.log10(a));
  let m = a / Math.pow(10, e);
  if (+m.toFixed(digits) >= 10) { m /= 10; e += 1; }
  return `${sign}${m.toFixed(digits)}×10${sup(e)}`;
}

/** 带正负号的数字：+1.5 / −1.5 / 0.0 */
export function signed(v, d = 1) {
  if (Math.abs(v) < 0.5 * Math.pow(10, -d)) return (0).toFixed(d);
  return (v > 0 ? '+' : MINUS) + Math.abs(v).toFixed(d);
}

/**
 * 与 ctx.view 相同，但立即按当前视口宽高比把相机拉远到能看全 halfWidth（ctx.view 只在窗口尺寸变化时才适配，
 * 切换模式时直接调用它不会马上生效）。
 */
export function viewFit(ctx, pos, target, halfWidth) {
  const cam = ctx.camera;
  const dir = new THREE.Vector3(pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]);
  const base = dir.length();
  const hTan = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * (cam.aspect || 1);
  const dist = Math.max(base, halfWidth / hTan);
  dir.multiplyScalar(dist / base);
  ctx.view(pos, target, halfWidth); // 记录原始距离，窗口尺寸变化时引擎仍会重新适配
  cam.position.set(target[0] + dir.x, target[1] + dir.y, target[2] + dir.z);
  ctx.controls.update();
}

/** 修改 ctx.label 标签的文字和颜色类（只在变化时才写 DOM） */
export function setLabel(label, text, cls) {
  const el = label.element;
  if (text != null && el.textContent !== text) el.textContent = text;
  if (cls != null) {
    const c = 'l3d ' + cls;
    if (el.className !== c) el.className = c;
  }
}

/** 显示 / 隐藏一个控件行（ui 返回的 el 或按钮元素） */
export function showEl(el, on) {
  if (el) el.style.display = on ? '' : 'none';
}

/** 与 ui.readouts 相同，但额外返回读数卡片的容器元素 el，便于按模式显示/隐藏 */
export function readoutsEl(ui, list) {
  const r = ui.readouts(list);
  const el = ui.extras ? ui.extras.lastElementChild : null;
  return { set: r.set, unit: r.unit, el };
}

/**
 * 在 3D 画面里拖动物体。
 * new Dragger(ctx, { targets: [obj...], pick(raycaster) → Vector3|null, onDrag(obj, point), onStart(obj), onEnd(obj) })
 * pick：把鼠标射线换算成拖动目标位置（例如与某个平面或曲面的交点）。
 * 记得在章节 dispose 里调用 dragger.dispose()。
 */
export class Dragger {
  constructor(ctx, { targets = [], pick, onDrag, onStart, onEnd } = {}) {
    this.ctx = ctx;
    this.targets = targets;
    this.pick = pick;
    this.active = null;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    const el = ctx.renderer.domElement;
    this.el = el;
    const setNdc = (e) => {
      const r = el.getBoundingClientRect();
      this.ndc.set(((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1, -((e.clientY - r.top) / Math.max(1, r.height)) * 2 + 1);
      this.ray.setFromCamera(this.ndc, ctx.camera);
    };
    const isVisible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    this._down = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      setNdc(e);
      const cands = this.targets.filter(isVisible);
      if (!cands.length) return;
      const hits = this.ray.intersectObjects(cands, true);
      if (!hits.length) return;
      let o = hits[0].object;
      while (o && !cands.includes(o)) o = o.parent;
      if (!o) return;
      this.active = o;
      ctx.controls.enabled = false; // 捕获阶段先于 OrbitControls 执行，让它这次不转动镜头
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* 忽略 */ }
      el.style.cursor = 'grabbing';
      onStart?.(o);
    };
    this._move = (e) => {
      setNdc(e);
      if (!this.active) {
        const cands = this.targets.filter(isVisible);
        const over = cands.length && this.ray.intersectObjects(cands, true).length > 0;
        el.style.cursor = over ? 'grab' : '';
        return;
      }
      const p = this.pick?.(this.ray);
      if (p) onDrag?.(this.active, p);
    };
    this._up = (e) => {
      if (!this.active) return;
      const o = this.active;
      this.active = null;
      ctx.controls.enabled = true;
      try { el.releasePointerCapture(e.pointerId); } catch (_) { /* 忽略 */ }
      el.style.cursor = '';
      onEnd?.(o);
    };
    el.addEventListener('pointerdown', this._down, { capture: true });
    el.addEventListener('pointermove', this._move);
    el.addEventListener('pointerup', this._up);
    el.addEventListener('pointercancel', this._up);
  }
  dispose() {
    const el = this.el;
    el.removeEventListener('pointerdown', this._down, { capture: true });
    el.removeEventListener('pointermove', this._move);
    el.removeEventListener('pointerup', this._up);
    el.removeEventListener('pointercancel', this._up);
    el.style.cursor = '';
    this.ctx.controls.enabled = true;
  }
}

/** 射线与水平/竖直平面求交的便捷函数 */
export function rayPlane(ray, plane, out = new THREE.Vector3()) {
  return ray.ray.intersectPlane(plane, out);
}

const _gray = new THREE.Color(0x8a8a96);
const _tmpC = new THREE.Color();
/**
 * 带电小球：颜色、+/− 符号、光晕随电量变化。
 * const b = chargeBall({ r }); b.userData.setQ(q, qMax)
 */
export function chargeBall({ r = 0.4, segments = 40 } = {}) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a8a96, emissive: 0x000000, roughness: 0.3, metalness: 0.25 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, segments, Math.round(segments * 0.7)), mat);
  g.add(mesh);
  const glow = glowSprite(0xffffff, r * 5, 0.5);
  g.add(glow);
  const signMat = new THREE.SpriteMaterial({ map: textTexture('+'), transparent: true, depthTest: false, depthWrite: false });
  const sign = new THREE.Sprite(signMat);
  sign.scale.set(r * 1.5, r * 1.5, 1);
  sign.renderOrder = 10;
  g.add(sign);
  g.userData.mesh = mesh;
  g.userData.setQ = (q, qMax = 1) => {
    const t = Math.min(1, Math.abs(q) / qMax);
    if (Math.abs(q) < 1e-9) {
      mat.color.copy(_gray);
      mat.emissive.setHex(0x000000);
      glow.visible = false;
      signMat.map = textTexture('0', { color: '#d8d8e0' });
    } else {
      const c = q > 0 ? COLOR.proton : COLOR.electron;
      _tmpC.setHex(c);
      mat.color.copy(_gray).lerp(_tmpC, 0.35 + 0.65 * Math.sqrt(t));
      mat.emissive.setHex(c);
      mat.emissiveIntensity = 0.15 + 0.75 * t;
      glow.visible = true;
      glow.material.color.setHex(c);
      glow.material.opacity = 0.2 + 0.55 * t;
      glow.scale.setScalar(r * (3.2 + 2.8 * t));
      signMat.map = textTexture(q > 0 ? '+' : MINUS);
    }
    signMat.needsUpdate = true;
  };
  g.userData.setQ(1);
  return g;
}

/**
 * 轨迹线：固定长度的环形缓冲，push(p) 追加一个点，reset() 清空。
 */
export class Trail {
  constructor(max = 120, { color = 0xffffff, opacity = 0.6 } = {}) {
    this.max = max;
    this.n = 0;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setDrawRange(0, 0);
    this.object = new THREE.Line(this.geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    this.object.frustumCulled = false;
  }
  reset() { this.n = 0; this.geo.setDrawRange(0, 0); }
  push(p) {
    if (this.n < this.max) {
      this.pos[this.n * 3] = p.x; this.pos[this.n * 3 + 1] = p.y; this.pos[this.n * 3 + 2] = p.z;
      this.n++;
    } else {
      this.pos.copyWithin(0, 3);
      const i = (this.max - 1) * 3;
      this.pos[i] = p.x; this.pos[i + 1] = p.y; this.pos[i + 2] = p.z;
    }
    this.geo.setDrawRange(0, this.n);
    this.geo.attributes.position.needsUpdate = true;
  }
}
