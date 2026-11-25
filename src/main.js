import './styles/tokens.css';
import './styles/app.css';
import { Engine } from './engine.js';
import { UI } from './ui.js';
import { CHAPTERS, GROUPS, chapterById } from './chapters.js';

const ICONS = {
  atom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="1.8" fill="currentColor"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/></svg>',
  circuit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 7v10h16V7h-5M9 7H4"/><path d="M9 4.5v5M11.5 6v2"/><path d="m12 17 1.5-2 1.5 4 1.5-4 1.5 2"/></svg>',
  magnet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6 3h4v9a2 2 0 0 0 4 0V3h4v9a6 6 0 0 1-12 0z"/><path d="M6 7h4M14 7h4"/></svg>',
  wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0"/><path d="M12 3v2M12 19v2"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2 4 14h6.5L9 22l11-13h-7z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
};

const app = document.getElementById('app');
app.innerHTML = `
  <header class="topbar">
    <button class="icon-btn only-narrow" id="menuBtn" aria-label="目录">${ICONS.menu}</button>
    <a class="brand" href="#/"><span class="brand-ico">${ICONS.bolt}</span><span>什么是电</span></a>
    <nav class="crumbs" id="crumbs"></nav>
    <div class="top-actions">
      <button class="icon-btn" id="themeBtn" aria-label="切换深色模式"></button>
    </div>
  </header>
  <div class="main">
    <aside class="sidebar" id="sidebar"></aside>
    <div class="scrim" id="scrim"></div>
    <section class="home" id="home"></section>
    <section class="lesson" id="lesson" hidden>
      <div class="stage-col">
        <div class="viewport" id="viewport">
          <div class="vp-tag" id="vpTag"></div>
          <div class="vp-bar">
            <button class="vp-btn" id="playBtn" aria-label="暂停/播放"></button>
            <div class="vp-seg" id="speedSeg">
              <button data-s="0.25">0.25×</button><button data-s="0.5">0.5×</button><button data-s="1" class="on">1×</button><button data-s="2">2×</button>
            </div>
            <button class="vp-btn" id="resetBtn" aria-label="重置视角" title="重置">${ICONS.reset}</button>
            <button class="vp-btn" id="fullBtn" aria-label="全屏" title="全屏">${ICONS.full}</button>
          </div>
          <div class="vp-hint">拖动旋转 · 滚轮缩放 · 右键平移</div>
        </div>
        <div class="pager" id="pager"></div>
      </div>
      <aside class="panel" id="panel"></aside>
    </section>
  </div>
`;

const $ = (id) => document.getElementById(id);
const engine = new Engine($('viewport'));
let ui = null;
let currentId = null;

/* ---------------- 主题 ---------------- */
function syncThemeBtn() {
  const dark = document.documentElement.dataset.theme === 'dark';
  $('themeBtn').innerHTML = dark ? ICONS.sun : ICONS.moon;
}
$('themeBtn').onclick = () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  if (dark) document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
  syncThemeBtn();
};
syncThemeBtn();

/* ---------------- 侧栏 ---------------- */
function buildSidebar() {
  const sb = $('sidebar');
  let n = 0;
  sb.innerHTML = `<a class="nav-home" href="#/">${ICONS.bolt}<span>首页 · 学习路线</span></a>` +
    GROUPS.map((g) => {
      const items = CHAPTERS.filter((c) => c.group === g.id)
        .map((c) => { n++; return `<a class="nav-item" href="#/c/${c.id}" data-id="${c.id}"><span class="nav-num tabular">${String(n).padStart(2, '0')}</span><span class="nav-title">${c.title}</span></a>`; })
        .join('');
      return `<div class="nav-group"><div class="nav-group-title"><span class="gi">${ICONS[g.icon]}</span>${g.title}</div>${items}</div>`;
    }).join('');
}
buildSidebar();

const closeDrawer = () => document.body.classList.remove('drawer-open');
$('menuBtn').onclick = () => document.body.classList.toggle('drawer-open');
$('scrim').onclick = closeDrawer;

/* ---------------- 首页 ---------------- */
function buildHome() {
  let n = 0;
  $('home').innerHTML = `
    <div class="home-inner">
      <div class="hero">
        <div class="hero-kicker">交互式 3D 电学科普</div>
        <h1>什么是电？</h1>
        <p class="hero-sub">从一颗原子里的电子出发，一路走到电路、电动机、发电站，再到在空中飞驰的电磁波、收音机和电话。<br>每一章都是一个可以旋转、拖动、调参数的 3D 模型，旁边配有原理讲解和公式。</p>
        <div class="hero-actions">
          <a class="btn btn-primary btn-lg" href="#/c/${CHAPTERS[0].id}">从第一章开始</a>
          <a class="btn btn-lg" href="#path">浏览全部 ${CHAPTERS.length} 章</a>
        </div>
        <div class="hero-stats">
          <div><b class="tabular">${CHAPTERS.length}</b><span>个 3D 交互模型</span></div>
          <div><b class="tabular">${GROUPS.length}</b><span>大知识板块</span></div>
          <div><b>0</b><span>前置知识要求</span></div>
        </div>
      </div>
      <div id="path"></div>
      ${GROUPS.map((g, gi) => `
        <section class="home-group">
          <div class="hg-head">
            <span class="hg-ico">${ICONS[g.icon]}</span>
            <div><div class="hg-step">第 ${gi + 1} 部分</div><h2>${g.title}</h2><p>${g.desc}</p></div>
          </div>
          <div class="cards">
            ${CHAPTERS.filter((c) => c.group === g.id).map((c) => {
              n++;
              return `<a class="ch-card" href="#/c/${c.id}">
                <div class="ch-num tabular">${String(n).padStart(2, '0')}</div>
                <div class="ch-title">${c.title}</div>
                <div class="ch-sub">${c.subtitle || ''}</div>
                <p>${c.summary || ''}</p>
              </a>`;
            }).join('')}
          </div>
        </section>`).join('')}
      <footer class="home-foot">用 Three.js 制作 · 所有模型均为示意，部分尺度经过放大或减速以便观察</footer>
    </div>`;
}
buildHome();

/* ---------------- 章节 ---------------- */
function renderPanel(ch) {
  const idx = CHAPTERS.indexOf(ch);
  const group = GROUPS.find((g) => g.id === ch.group);
  const formulas = (ch.formulas || []).map((f) => `
    <div class="formula"><div class="f-expr">${f.expr}</div>${f.desc ? `<div class="f-desc">${f.desc}</div>` : ''}</div>`).join('');
  const sections = (ch.sections || []).map((s, i) => `
    <details class="card sec" ${i < 2 ? 'open' : ''}><summary>${s.title}</summary><div class="sec-body">${s.html}</div></details>`).join('');
  $('panel').innerHTML = `
    <div class="p-head">
      <div class="p-kicker">${group?.title || ''} · 第 ${idx + 1} 章</div>
      <h1>${ch.title}</h1>
      ${ch.lead ? `<p class="p-lead">${ch.lead}</p>` : ''}
    </div>
    <div class="card ctl-card empty"><div class="card-title">动手试试</div><div class="ctls" id="ctls"></div></div>
    <div class="extras" id="extras"></div>
    ${formulas ? `<div class="card"><div class="card-title">核心公式</div>${formulas}</div>` : ''}
    ${sections}
  `;
  const prev = CHAPTERS[idx - 1], next = CHAPTERS[idx + 1];
  $('pager').innerHTML = `
    ${prev ? `<a class="pg pg-prev" href="#/c/${prev.id}">${ICONS.left}<span><small>上一章</small>${prev.title}</span></a>` : '<span></span>'}
    ${next ? `<a class="pg pg-next" href="#/c/${next.id}"><span><small>下一章</small>${next.title}</span>${ICONS.right}</a>` : `<a class="pg pg-next" href="#/"><span><small>完成</small>回到首页</span>${ICONS.right}</a>`}
  `;
  $('vpTag').innerHTML = `<b>${ch.title}</b>${ch.subtitle ? `<span>${ch.subtitle}</span>` : ''}`;
  $('crumbs').innerHTML = `<span>${group?.title || ''}</span><i>/</i><b>${ch.title}</b>`;
}

function openChapter(id) {
  const ch = chapterById(id);
  if (!ch) return openHome();
  $('home').hidden = true;
  $('lesson').hidden = false;
  document.title = `${ch.title} · 什么是电`;
  document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('active', a.dataset.id === id));
  document.querySelector('.nav-home').classList.remove('active');
  if (currentId === id) return;
  currentId = id;
  ui?.dispose();
  renderPanel(ch);
  ui = new UI($('ctls'), $('extras'));
  engine.active = true;
  setPaused(false);
  engine.load(ch, ui);
  $('panel').scrollTop = 0;
  if (window.innerWidth < 900) window.scrollTo(0, 0);
  document.querySelector(`.nav-item[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
}

function openHome() {
  currentId = null;
  ui?.dispose();
  engine.active = false;
  engine.unload();
  $('lesson').hidden = true;
  $('home').hidden = false;
  document.title = '什么是电 · 3D 电学科普';
  $('crumbs').innerHTML = '';
  document.querySelectorAll('.nav-item').forEach((a) => a.classList.remove('active'));
  document.querySelector('.nav-home').classList.add('active');
}

function route() {
  closeDrawer();
  const h = location.hash;
  const m = h.match(/^#\/c\/([\w-]+)/);
  if (m) openChapter(m[1]);
  else if (h === '#path') { openHome(); document.getElementById('path')?.scrollIntoView({ behavior: 'smooth' }); }
  else openHome();
}
window.addEventListener('hashchange', route);

/* ---------------- 视口工具条 ---------------- */
function setPaused(p) {
  engine.paused = p;
  $('playBtn').innerHTML = p ? ICONS.play : ICONS.pause;
}
$('playBtn').onclick = () => setPaused(!engine.paused);
$('speedSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  engine.timeScale = parseFloat(b.dataset.s);
  $('speedSeg').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
});
$('resetBtn').onclick = () => {
  const id = currentId;
  currentId = null;
  if (id) openChapter(id);
};
$('fullBtn').onclick = () => {
  const vp = $('viewport');
  if (document.fullscreenElement) document.exitFullscreen();
  else vp.requestFullscreen?.();
};
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input,textarea')) return;
  if (e.code === 'Space' && currentId) { e.preventDefault(); setPaused(!engine.paused); }
  if (!currentId) return;
  const idx = CHAPTERS.findIndex((c) => c.id === currentId);
  if (e.key === 'ArrowRight' && e.altKey && CHAPTERS[idx + 1]) location.hash = `#/c/${CHAPTERS[idx + 1].id}`;
  if (e.key === 'ArrowLeft' && e.altKey && CHAPTERS[idx - 1]) location.hash = `#/c/${CHAPTERS[idx - 1].id}`;
});

route();
// 调试入口
window.__engine = engine;
// 调试：手动推进动画 sec 秒（后台标签页里 requestAnimationFrame 会被节流）
window.__adv = (sec = 1) => {
  const e = engine;
  const h = e.current?.handle;
  for (let i = 0; i < sec * 60; i++) { e.elapsed += 1 / 60; h?.update?.(1 / 60, e.elapsed); }
  e.controls.update();
  e.composer?.render();
  e.labelRenderer.render(e.scene, e.camera);
  return e.elapsed;
};
