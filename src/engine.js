// 3D 引擎：一个渲染器贯穿全站，切换章节时清空场景并调用新章节的 setup。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const BG = 0x0d0d11;

export class Engine {
  constructor(host) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setClearColor(BG, 1);
    host.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'label-layer';
    host.appendChild(this.labelRenderer.domElement);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 2000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    // 用户一旦动了镜头，就不再自动适配视口宽度
    this.controls.addEventListener('start', () => { this.fit = null; });

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.scene = null;
    this.composer = null;
    this.bloom = null;
    this.current = null; // { chapter, handle }
    this.timeScale = 1;
    this.paused = false;
    this.elapsed = 0;
    this.clock = new THREE.Clock();
    this.active = false;

    this._resize = () => this.resize();
    new ResizeObserver(this._resize).observe(host);
    document.addEventListener('visibilitychange', () => this.clock.getDelta());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) this.composer.setSize(w, h);
    if (this.bloom) this.bloom.resolution.set(w, h);
    this.current?.handle?.resize?.(w, h);
    this.applyFit();
  }

  /** 视口太窄时把相机沿视线往后拉，保证水平方向能看全 fitWidth 半宽的内容 */
  applyFit() {
    if (!this.fit) return;
    const { dir, base, halfWidth } = this.fit;
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hTan = Math.tan(vfov / 2) * this.camera.aspect;
    const need = halfWidth / hTan;
    const dist = Math.max(base, need);
    this.camera.position.copy(this.controls.target).addScaledVector(dir, dist);
    this.controls.update();
  }

  /** 卸载当前章节，释放全部 GPU 资源 */
  unload() {
    if (this.current) {
      try { this.current.handle?.dispose?.(); } catch (e) { console.error(e); }
    }
    if (this.scene) {
      this.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            for (const k in m) {
              const v = m[k];
              if (v && v.isTexture && v !== this.envMap && !v.userData?.shared) v.dispose();
            }
            m.dispose();
          }
        }
      });
    }
    this.labelRenderer.domElement.innerHTML = '';
    this.composer?.dispose?.();
    this.composer = null;
    this.scene = null;
    this.current = null;
  }

  load(chapter, ui) {
    this.unload();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);
    scene.environment = this.envMap;
    scene.environmentIntensity = 0.6;
    this.scene = scene;

    // 默认灯光
    const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x1a1a22, 0.9);
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(6, 10, 8);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 0.6);
    rim.position.set(-8, 4, -6);
    scene.add(hemi, key, rim);

    // 相机复位
    this.camera.fov = 45;
    this.camera.near = 0.05;
    this.camera.far = 2000;
    this.camera.position.set(0, 4, 12);
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = 2;
    this.controls.maxDistance = 60;
    this.controls.enablePan = true;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.6;
    this.camera.updateProjectionMatrix();

    // 后期：辉光
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.45, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.setSize(w, h);

    this.elapsed = 0;
    this.fit = null;
    const ctx = this.makeContext(ui);
    let handle = null;
    try {
      handle = chapter.setup(ctx) || {};
    } catch (e) {
      console.error(`[${chapter.id}] setup 失败`, e);
      handle = {};
    }
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.current = { chapter, handle };
    this.clock.getDelta();
    this.resize();

  }

  makeContext(ui) {
    const engine = this;
    return {
      THREE,
      scene: this.scene,
      camera: this.camera,
      controls: this.controls,
      renderer: this.renderer,
      ui,
      /** 设置辉光：strength 强度，threshold 亮度阈值（越低越多东西发光） */
      setBloom(strength = 0.55, radius = 0.45, threshold = 0.82) {
        engine.bloom.strength = strength;
        engine.bloom.radius = radius;
        engine.bloom.threshold = threshold;
      },
      /** 相机位置与注视点 */
      view(pos, target = [0, 0, 0], halfWidth = 0) {
        engine.camera.position.set(...pos);
        engine.controls.target.set(...target);
        engine.controls.update();
        engine.fit = null;
        if (halfWidth > 0) {
          const off = engine.camera.position.clone().sub(engine.controls.target);
          engine.fit = { dir: off.clone().normalize(), base: off.length(), halfWidth };
        }
      },
      /** 3D 空间中的文字标签（HTML），返回 CSS2DObject，可 .position.set()，可 .element.textContent 修改 */
      label(text, { cls = '', html = false } = {}) {
        const el = document.createElement('div');
        el.className = 'l3d ' + cls;
        if (html) el.innerHTML = text; else el.textContent = text;
        const obj = new CSS2DObject(el);
        obj.center.set(0.5, 0.5);
        return obj;
      },
      get time() { return engine.elapsed; },
    };
  }

  frame() {
    let dt = Math.min(this.clock.getDelta(), 0.05);
    if (!this.active || !this.scene) return;
    if (this.paused) dt = 0;
    dt *= this.timeScale;
    this.elapsed += dt;
    try {
      this.current?.handle?.update?.(dt, this.elapsed);
    } catch (e) {
      console.error(e);
      this.current.handle.update = null;
    }
    this.controls.update();
    this.composer.render();
    this.labelRenderer.render(this.scene, this.camera);
  }
}
