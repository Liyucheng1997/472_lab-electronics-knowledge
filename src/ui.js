// 右侧面板中的交互控件。每次切换章节都会新建一个 UI 实例，控件依次追加到“动手试试”卡片里。

const fmtNum = (v, digits) => {
  if (!isFinite(v)) return '—';
  const a = Math.abs(v);
  if (digits != null) return v.toFixed(digits);
  if (Number.isInteger(v)) return String(v);
  if (a >= 1000) return v.toFixed(0);
  if (a >= 100) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  return v.toPrecision(3);
};

export class UI {
  constructor(controlsEl, extrasEl) {
    this.root = controlsEl; // 控件卡片
    this.extras = extrasEl; // 读数 / 示波器 / 图例放这里
    this.cleanups = [];
  }

  _row(cls = '') {
    const row = document.createElement('div');
    row.className = 'ctl ' + cls;
    this.root.appendChild(row);
    this.root.closest('.card')?.classList.remove('empty');
    return row;
  }

  /** 滑块 { label, min, max, step, value, unit, digits, format(v)=>string, onInput(v) } */
  slider({ label, min = 0, max = 1, step = 0.01, value = 0, unit = '', digits, format, onInput }) {
    const row = this._row('ctl-slider');
    row.innerHTML = `<div class="ctl-head"><span class="ctl-label"></span><span class="ctl-val tabular"></span></div><input type="range">`;
    row.querySelector('.ctl-label').textContent = label;
    const input = row.querySelector('input');
    const out = row.querySelector('.ctl-val');
    Object.assign(input, { min, max, step, value });
    const show = () => {
      const v = parseFloat(input.value);
      out.textContent = format ? format(v) : `${fmtNum(v, digits)} ${unit}`.trim();
      const p = ((v - min) / (max - min)) * 100;
      input.style.setProperty('--p', p + '%');
    };
    input.addEventListener('input', () => { show(); onInput?.(parseFloat(input.value)); });
    show();
    return {
      get value() { return parseFloat(input.value); },
      set(v, fire = false) { input.value = v; show(); if (fire) onInput?.(parseFloat(input.value)); },
      el: row,
    };
  }

  /** 分段控件 { label, options:[{value,label}], value, onChange(v) } */
  segmented({ label, options, value, onChange }) {
    const row = this._row('ctl-seg');
    if (label) {
      const l = document.createElement('div');
      l.className = 'ctl-label';
      l.textContent = label;
      row.appendChild(l);
    }
    const seg = document.createElement('div');
    seg.className = 'seg';
    row.appendChild(seg);
    let cur = value ?? options[0].value;
    const btns = options.map((o) => {
      const b = document.createElement('button');
      b.textContent = o.label;
      b.onclick = () => { if (cur === o.value) return; cur = o.value; sync(); onChange?.(cur); };
      seg.appendChild(b);
      return [o.value, b];
    });
    const sync = () => btns.forEach(([v, b]) => b.classList.toggle('on', v === cur));
    sync();
    return {
      get value() { return cur; },
      set(v, fire = false) { cur = v; sync(); if (fire) onChange?.(cur); },
      el: row,
    };
  }

  /** 开关 { label, value, onChange(bool) } */
  toggle({ label, value = false, onChange }) {
    const row = this._row('ctl-toggle');
    row.innerHTML = `<span class="ctl-label"></span><button class="switch" role="switch"><i></i></button>`;
    row.querySelector('.ctl-label').textContent = label;
    const sw = row.querySelector('.switch');
    let on = !!value;
    const sync = () => { sw.classList.toggle('on', on); sw.setAttribute('aria-checked', on); };
    sw.onclick = () => { on = !on; sync(); onChange?.(on); };
    sync();
    return {
      get value() { return on; },
      set(v, fire = false) { on = !!v; sync(); if (fire) onChange?.(on); },
      el: row,
    };
  }

  /** 按钮 { label, onClick, primary } 多个按钮可传数组到 buttons() */
  button({ label, onClick, primary = false }) {
    return this.buttons([{ label, onClick, primary }])[0];
  }

  buttons(list) {
    const row = this._row('ctl-btns');
    return list.map(({ label, onClick, primary }) => {
      const b = document.createElement('button');
      b.className = 'btn btn-sm' + (primary ? ' btn-primary' : '');
      b.textContent = label;
      b.onclick = () => onClick?.(b);
      row.appendChild(b);
      return b;
    });
  }

  /** 一段说明文字（HTML），放在控件卡片中 */
  note(html) {
    const row = this._row('ctl-note');
    row.innerHTML = html;
    return { set(h) { row.innerHTML = h; }, el: row };
  }

  /** 实时读数 [{ key, label, unit, digits }]，返回 { set(key, value, text?) } */
  readouts(list) {
    const box = document.createElement('div');
    box.className = 'readouts';
    const map = {};
    for (const r of list) {
      const t = document.createElement('div');
      t.className = 'stat';
      t.innerHTML = `<div class="stat-label"></div><div class="stat-val tabular"><b>—</b><span></span></div>`;
      t.querySelector('.stat-label').textContent = r.label;
      t.querySelector('span').textContent = r.unit || '';
      box.appendChild(t);
      map[r.key] = { el: t.querySelector('b'), unitEl: t.querySelector('span'), digits: r.digits };
    }
    this.extras.appendChild(box);
    return {
      set(key, value, text) {
        const m = map[key];
        if (!m) return;
        m.el.textContent = text ?? (typeof value === 'number' ? fmtNum(value, m.digits) : value);
      },
      unit(key, u) { if (map[key]) map[key].unitEl.textContent = u; },
    };
  }

  /** 图例 [{ color, label }] */
  legend(list) {
    const box = document.createElement('div');
    box.className = 'legend';
    for (const it of list) {
      const s = document.createElement('span');
      s.innerHTML = `<i style="background:${it.color}"></i>`;
      s.appendChild(document.createTextNode(it.label));
      box.appendChild(s);
    }
    this.extras.appendChild(box);
  }

  /**
   * 滚动示波器：{ title, height, yMin, yMax, window(采样点数), series:[{label,color}] }
   * 每帧调用 push([v1, v2, ...])
   */
  scope({ title = '示波器', height = 120, yMin = -1, yMax = 1, window: N = 240, series = [{ label: '', color: '#0a84ff' }] }) {
    const wrap = this._chartWrap(title, series);
    const canvas = wrap.canvas;
    const data = series.map(() => []);
    let range = [yMin, yMax];
    const draw = () => {
      const { c, w, h } = this._fitCanvas(canvas, height);
      this._grid(c, w, h, range);
      series.forEach((s, i) => {
        const arr = data[i];
        c.strokeStyle = s.color;
        c.lineWidth = 1.8;
        c.beginPath();
        arr.forEach((v, j) => {
          const x = (j / (N - 1)) * w;
          const y = h - ((v - range[0]) / (range[1] - range[0])) * h;
          j ? c.lineTo(x, y) : c.moveTo(x, y);
        });
        c.stroke();
      });
    };
    return {
      push(vals) {
        vals.forEach((v, i) => { data[i].push(v); if (data[i].length > N) data[i].shift(); });
        draw();
      },
      clear() { data.forEach((d) => (d.length = 0)); draw(); },
      setRange(a, b) { range = [a, b]; },
    };
  }

  /**
   * 静态坐标图：{ title, height, xMin,xMax,yMin,yMax, xLabel, yLabel, series:[{label,color}], draw(p) }
   * draw 里用 p.line(points[[x,y]...], color, width) / p.dot(x,y,color,r) / p.text(x,y,str,color) / p.vline(x,color)
   */
  plot({ title = '', height = 150, xMin = 0, xMax = 1, yMin = 0, yMax = 1, xLabel = '', yLabel = '', series = [], draw }) {
    const wrap = this._chartWrap(title, series, xLabel, yLabel);
    const canvas = wrap.canvas;
    const self = this;
    const api = {
      opts: { xMin, xMax, yMin, yMax },
      redraw() {
        const { c, w, h } = self._fitCanvas(canvas, height);
        const o = api.opts;
        self._grid(c, w, h, [o.yMin, o.yMax]);
        const X = (x) => ((x - o.xMin) / (o.xMax - o.xMin)) * w;
        const Y = (y) => h - ((y - o.yMin) / (o.yMax - o.yMin)) * h;
        const p = {
          w, h, X, Y, ctx: c, opts: o,
          line(pts, color = '#0a84ff', width = 2, dash) {
            c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash || []);
            c.beginPath();
            pts.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y))));
            c.stroke(); c.setLineDash([]);
          },
          fn(f, color, width, n = 200, dash) {
            const pts = [];
            for (let i = 0; i <= n; i++) { const x = o.xMin + ((o.xMax - o.xMin) * i) / n; pts.push([x, f(x)]); }
            p.line(pts, color, width, dash);
          },
          dot(x, y, color = '#fff', r = 4) { c.fillStyle = color; c.beginPath(); c.arc(X(x), Y(y), r, 0, Math.PI * 2); c.fill(); },
          vline(x, color = 'rgba(255,255,255,.35)') { c.strokeStyle = color; c.lineWidth = 1; c.beginPath(); c.moveTo(X(x), 0); c.lineTo(X(x), h); c.stroke(); },
          hline(y, color = 'rgba(255,255,255,.35)') { c.strokeStyle = color; c.lineWidth = 1; c.beginPath(); c.moveTo(0, Y(y)); c.lineTo(w, Y(y)); c.stroke(); },
          text(x, y, s, color = 'rgba(255,255,255,.8)', align = 'left') { c.fillStyle = color; c.font = '11px ' + getComputedStyle(document.body).fontFamily; c.textAlign = align; c.fillText(s, X(x), Y(y)); },
        };
        draw?.(p);
      },
    };
    requestAnimationFrame(() => api.redraw());
    return api;
  }

  _chartWrap(title, series, xLabel = '', yLabel = '') {
    const box = document.createElement('div');
    box.className = 'chart';
    const head = document.createElement('div');
    head.className = 'chart-head';
    head.innerHTML = `<span class="chart-title"></span><span class="chart-keys"></span>`;
    head.querySelector('.chart-title').textContent = title;
    const keys = head.querySelector('.chart-keys');
    for (const s of series) {
      if (!s.label) continue;
      const k = document.createElement('span');
      k.innerHTML = `<i style="background:${s.color}"></i>`;
      k.appendChild(document.createTextNode(s.label));
      keys.appendChild(k);
    }
    const canvas = document.createElement('canvas');
    box.append(head, canvas);
    if (xLabel || yLabel) {
      const ax = document.createElement('div');
      ax.className = 'chart-axes';
      ax.innerHTML = `<span></span><span></span>`;
      ax.children[0].textContent = yLabel ? '纵轴：' + yLabel : '';
      ax.children[1].textContent = xLabel ? '横轴：' + xLabel : '';
      box.appendChild(ax);
    }
    this.extras.appendChild(box);
    return { canvas };
  }

  _fitCanvas(canvas, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 300;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.height = height + 'px';
    }
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, height);
    return { c, w, h: height };
  }

  _grid(c, w, h, [y0, y1]) {
    c.fillStyle = '#111115';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.07)';
    c.lineWidth = 1;
    for (let i = 1; i < 8; i++) { const x = (i / 8) * w; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let i = 1; i < 4; i++) { const y = (i / 4) * h; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    if (y0 < 0 && y1 > 0) {
      const y = h - ((0 - y0) / (y1 - y0)) * h;
      c.strokeStyle = 'rgba(255,255,255,.22)';
      c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
    }
  }

  dispose() {
    this.cleanups.forEach((f) => f());
  }
}
