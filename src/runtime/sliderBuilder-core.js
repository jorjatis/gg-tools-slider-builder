/*!
 * v-sb — núcleo. Sin dependencias ni imports/exports.
 * Módulos opcionales (cárgalos después, solo los que uses):
 *   sliderBuilder-drag.js · sliderBuilder-menu.js · sliderBuilder-fullscreen.js · sliderBuilder-autoplay.js
 *
 * Uso:
 *   <div class="v-sb" data-sb data-sb-per-view="3" data-sb-step="1" data-sb-loop="false">
 *     <div class="v-sb-viewport">
 *       <div class="v-sb-track">
 *         <article class="v-sb-item" data-sb-label="Uno">…</article>
 *       </div>
 *     </div>
 *   </div>
 *   <script src="sliderBuilder-core.js" defer></script>
 *
 * Se inicializa solo en todos los [data-sb]. API opcional: window.SliderBuilder.
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Matemática pura (sin DOM) — testeable en Node
   * ------------------------------------------------------------------ */
  var M = {
    EPS: 1e-3,

    clamp: function (v, min, max) {
      return Math.min(max, Math.max(min, v));
    },

    mod: function (a, n) {
      if (n <= 0) return 0;
      var r = ((a % n) + n) % n;
      return r > n - 1e-6 ? 0 : r;
    },

    /**
     * Items "efectivos" en pantalla: los enteros más lo que asoman los laterales.
     * peek es la fracción de item que se ve (0.25 = un cuarto). Centrado asoma por
     * los dos lados; alineado a la izquierda, solo por la derecha.
     */
    effectivePerView: function (perView, peek, align) {
      return perView + M.clamp(peek || 0, 0, 0.9) * (align === 'center' ? 2 : 1);
    },

    /** Ancho de cada item. o: {sizing, perView, itemWidth, gap, peek, width} */
    itemWidth: function (o) {
      var inner = Math.max(1, o.width - 2 * (o.peek || 0));
      if (o.sizing === 'fixed') return Math.max(1, Math.min(o.itemWidth, inner));
      var p = Math.max(0.1, o.perView);
      return Math.max(1, (inner - o.gap * (p - 1)) / p);
    },

    contentWidth: function (n, w, gap) {
      return n <= 0 ? 0 : n * w + (n - 1) * gap;
    },

    /** ¿Caben todos los items sin necesidad de slider? */
    fits: function (n, w, gap, width) {
      return M.contentWidth(n, w, gap) <= width + 0.5;
    },

    /** Posición máxima (en unidades de item) para alineación al inicio sin bucle. */
    maxPos: function (n, w, gap, inner) {
      var unit = w + gap;
      if (unit <= 0) return 0;
      return Math.max(0, (M.contentWidth(n, w, gap) - inner) / unit);
    },

    /** Paso efectivo: el elegido, o lo que se ve en pantalla si es libre (0). */
    stepSize: function (step, visible) {
      return step > 0 ? step : Math.max(1, Math.floor(visible + 1e-6));
    },

    /**
     * Puntos de snap en unidades de item.
     * o: {n, step, align, loop, maxPos, visible}
     */
    snapPoints: function (o) {
      var s = M.stepSize(o.step, o.visible || 1);
      var pts = [];
      var p;
      if (o.n <= 0) return [0];
      if (o.loop || o.align === 'center') {
        for (p = 0; p < o.n; p += s) pts.push(p);
        return pts;
      }
      for (p = 0; p < o.maxPos - M.EPS; p += s) pts.push(p);
      if (pts.length && o.maxPos - pts[pts.length - 1] < 0.15 && pts.length > 1) pts.pop();
      pts.push(o.maxPos);
      return pts;
    },

    nearest: function (pts, pos) {
      var best = 0;
      for (var i = 1; i < pts.length; i++) {
        if (Math.abs(pts[i] - pos) < Math.abs(pts[best] - pos)) best = i;
      }
      return best;
    },

    /** Índice del mayor punto <= pos (para ir a un item concreto sin bucle). */
    floorPoint: function (pts, pos) {
      var idx = 0;
      for (var i = 0; i < pts.length; i++) if (pts[i] <= pos + M.EPS) idx = i;
      return idx;
    },

    /** Distancia más corta en un anillo de n elementos. */
    shortestDelta: function (from, to, n) {
      var d = M.mod(to - from, n);
      if (d > n / 2) d -= n;
      return d;
    },

    /** Efecto goma al arrastrar más allá de los límites. */
    rubber: function (pos, min, max) {
      if (pos < min) return min + (pos - min) * 0.3;
      if (pos > max) return max + (pos - max) * 0.3;
      return pos;
    },

    /**
     * Destino al soltar un arrastre.
     * o: {points, loop, free, anchor, pos, velocity (items/ms), unit (px),
     *     step, maxPos, threshold (px)}
     * Un gesto corto pero decidido (> threshold o flick) avanza al menos un paso.
     */
    releaseTarget: function (o) {
      var moved = o.pos - o.anchor;
      var momentum = o.velocity * 220;
      var flick = Math.abs(moved * o.unit) > o.threshold || Math.abs(o.velocity * o.unit) > 0.35;
      if (o.free) {
        var free = o.pos + M.clamp(momentum, -4, 4);
        return o.loop ? free : M.clamp(free, 0, o.maxPos);
      }
      // Con snap, la inercia suma como mucho medio paso: no se salta páginas.
      var projected = o.pos + M.clamp(momentum, -o.step / 2, o.step / 2);
      if (o.loop) {
        var s = o.step;
        var k = flick ? Math.round((projected - o.anchor) / s) : Math.round(moved / s);
        if (flick && k === 0 && moved !== 0) k = moved > 0 ? 1 : -1;
        return o.anchor + k * s;
      }
      var startIdx = M.nearest(o.points, o.anchor);
      var idx;
      if (flick) {
        idx = M.nearest(o.points, projected);
        if (moved > 0 && idx <= startIdx) idx = startIdx + 1;
        if (moved < 0 && idx >= startIdx) idx = startIdx - 1;
      } else {
        idx = M.nearest(o.points, o.pos);
      }
      return o.points[M.clamp(idx, 0, o.points.length - 1)];
    },

    /** Progreso 0..1 de una sección fija (pin) según el scroll. */
    progress: function (rectTop, sectionHeight, viewHeight) {
      var total = sectionHeight - viewHeight;
      if (total <= 0) return 0;
      return M.clamp(-rectTop / total, 0, 1);
    },

    /**
     * Índice con histéresis: con avanzar un poco (t) ya salta al siguiente.
     * f = posición continua (0..n-1).
     */
    stepIndex: function (f, current, n, t) {
      if (f > current + t) current = Math.floor(f - t) + 1;
      else if (f < current - t) current = Math.ceil(f + t) - 1;
      return M.clamp(current, 0, Math.max(0, n - 1));
    },

    /** Índices reales activos dado un pos. */
    activeIndexes: function (pos, n, count, loop) {
      var out = [];
      if (n <= 0) return out;
      var start = Math.round(pos);
      start = loop ? M.mod(start, n) : M.clamp(start, 0, n - 1);
      for (var j = 0; j < Math.max(1, count); j++) {
        var i = start + j;
        if (loop) out.push(M.mod(i, n));
        else if (i < n) out.push(i);
      }
      return out;
    },

    /** Página activa (para puntos). */
    activePage: function (pts, pos, n, step, loop) {
      if (loop) {
        var p = Math.floor(M.mod(Math.round(pos), n) / step);
        return M.clamp(p, 0, pts.length - 1);
      }
      return M.nearest(pts, pos);
    }
  };

  /* ------------------------------------------------------------------ *
   * Opciones declarativas (data-sb-*)
   * ------------------------------------------------------------------ */
  var DEFAULTS = {
    mode: 'carousel',        // carousel | fullscreen
    sizing: 'perview',       // perview | fixed
    perView: 3,
    perViewMobile: 1,        // items por vista en móvil (0 = igual que perView)
    mobileBp: 699,
    itemWidth: 280,
    gap: 16,
    peek: 0,                 // fracción de item que asoma del anterior/siguiente (0.25)
    align: 'start',          // start | center
    step: 1,                 // 0 = libre (sin snap)
    loop: false,
    arrows: true,
    arrowsPos: 'inside',     // inside | outside | bottom
    arrowStyle: 'circle',    // circle | square | minimal
    dots: 'dots',            // none | dots | lines | fraction
    menu: false,
    shadows: true,
    effect: '',              // "dim scale gray"
    effectOn: 'hover',       // hover | active
    autoDisable: true,       // si cabe, no es slider
    below: 0,                // slider solo con ancho de pantalla <= below (0 = siempre)
    columns: 3,              // columnas cuando no es slider por breakpoint
    speed: 450,
    autoplay: 0,             // ms, 0 = desactivado
    drag: true,
    fsTransition: 'step',    // jump | step | scrub
    fsLength: 100,           // dvh de scroll por slide
    fsWidth: 100,            // % de ancho de cada slide en pantalla completa
    top: '',                 // selector del menú anexo (fuera del slider), p. ej. '#mi-menu'
    topMode: 'sticky',       // menú anexo: sticky (fijo, la sección debajo) | overlay (fijo, transparente
                             // encima de los slides) | anchor (no se fija: solo enlaces a cada slide)
    menuInside: false        // con menú anexo, mostrar también el menú dentro de la sección
  };

  function toDataKey(key) {
    return 'sb' + key.charAt(0).toUpperCase() + key.slice(1);
  }

  /**
   * Opciones finales: valores por defecto < atributos data-sb-* < objeto de opciones.
   * Admite ambos estilos: declarativo en el HTML o SliderBuilder.init('#id', {…}).
   */
  /** Valores por defecto según el modo (a pantalla completa no hay separación). */
  function defaultsFor(mode) {
    var d = {};
    Object.keys(DEFAULTS).forEach(function (k) { d[k] = DEFAULTS[k]; });
    d.mode = mode || DEFAULTS.mode;
    if (d.mode === 'fullscreen') d.gap = 0;
    return d;
  }

  function parseOptions(dataset, options) {
    var o = {};
    dataset = dataset || {};
    options = options || {};
    Object.keys(DEFAULTS).forEach(function (key) {
      var def = DEFAULTS[key];
      var raw = Object.prototype.hasOwnProperty.call(options, key) ? options[key] : dataset[toDataKey(key)];
      if (raw === undefined || raw === null) { o[key] = def; return; }
      if (typeof raw === typeof def) { o[key] = raw; return; }
      if (Array.isArray(raw)) raw = raw.join(' ');
      if (typeof def === 'boolean') o[key] = raw === '' || raw === 'true' || raw === '1';
      else if (typeof def === 'number') {
        var num = parseFloat(raw);
        o[key] = isNaN(num) ? def : num;
      } else o[key] = String(raw);
    });
    o.step = Math.max(0, Math.round(o.step));
    o.columns = Math.max(1, Math.round(o.columns));
    if (o.mode === 'fullscreen') {
      o.loop = false;
      var gapGiven = Object.prototype.hasOwnProperty.call(options, 'gap') || dataset.sbGap !== undefined;
      if (!gapGiven) o.gap = 0;
    }
    return o;
  }

  /* ------------------------------------------------------------------ *
   * DOM helpers
   * ------------------------------------------------------------------ */
  var SVG_PREV = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var SVG_NEXT = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function now() {
    return global.performance && performance.now ? performance.now() : Date.now();
  }

  function reducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function labelOf(item, i) {
    if (item.dataset.sbLabel) return item.dataset.sbLabel;
    var h = item.querySelector('h1,h2,h3,h4,h5,h6');
    return h ? h.textContent.trim() : 'Item ' + (i + 1);
  }

  /* ------------------------------------------------------------------ *
   * Slider
   * ------------------------------------------------------------------ */
  function Slider(root, options) {
    if (root.sbSlider) return root.sbSlider;
    this.root = root;
    this.o = parseOptions(root.dataset, options);
    this.fs = this.o.mode === 'fullscreen';
    if (this.fs && !MODULES.fullscreen) {
      warn('falta sliderBuilder-fullscreen.js: se muestra como carrusel');
      this.fs = false;
    }
    var self = this;
    this.mods = ORDER.map(function (name) { return MODULES[name]; }).filter(function (m) {
      return m && (!m.applies || m.applies(self.o, self));
    });
    ORDER.forEach(function (name) {
      var want = NEEDS[name] && NEEDS[name](self.o);
      if (want && !MODULES[name]) warn('falta sliderBuilder-' + name + '.js');
    });
    this.viewport = root.querySelector('.v-sb-viewport');
    this.track = root.querySelector('.v-sb-track');
    if (!this.viewport || !this.track) throw new Error('Slider: faltan .v-sb-viewport / .v-sb-track');
    this.items = Array.prototype.filter.call(this.track.children, function (c) {
      return c.classList.contains('v-sb-item');
    });
    this.n = this.items.length;
    this.pos = 0;
    this.target = 0;
    this.clones = [];
    this.cloneSets = 0;
    this.cloneBefore = 0;
    this.points = [0];
    this.isStatic = true;
    this.staticReason = '';
    this.fsIdx = 0;
    this.fsLock = null;
    this.lastIndex = -1;
    this.paused = false;
    this.ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    root.sbSlider = this;
    this.build();
    this.bind();
    this.layout();
    this.hook('init');
    root.classList.add('v-sb--ready');
  }

  /** Llama al hook `name` de cada módulo activo. */
  Slider.prototype.hook = function (name, arg) {
    for (var i = 0; i < this.mods.length; i++) if (this.mods[i][name]) this.mods[i][name](this, arg);
  };

  Slider.prototype.on = function (target, type, fn, opts) {
    opts = opts || {};
    if (this.ac) opts.signal = this.ac.signal;
    target.addEventListener(type, fn, opts);
  };

  Slider.prototype.build = function () {
    var self = this;
    var o = this.o;
    var root = this.root;
    root.classList.add('v-sb');
    // Ganchos para el CSS (también cuando las opciones llegan por objeto).
    root.setAttribute('data-sb-arrows-pos', o.arrowsPos);
    root.setAttribute('data-sb-arrow-style', o.arrowStyle);
    root.setAttribute('data-sb-effect-on', o.effectOn);
    if (o.effect) root.setAttribute('data-sb-effect', o.effect);
    if (this.fs) root.classList.add('v-sb--fs');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-roledescription', 'carrusel');
    if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');

    this.items.forEach(function (item, i) {
      item.dataset.sbIndex = String(i);
      item.setAttribute('role', 'group');
      item.setAttribute('aria-roledescription', 'slide');
      item.setAttribute('aria-label', (i + 1) + ' de ' + self.n);
    });

    // Stage: envuelve el viewport para posicionar flechas y sombras.
    this.stage = el('div', 'v-sb-stage');
    this.viewport.parentNode.insertBefore(this.stage, this.viewport);
    this.stage.appendChild(this.viewport);
    this.generated = [this.stage];

    if (o.shadows) {
      this.shadowStart = el('span', 'v-sb-shadow v-sb-shadow--start', { 'aria-hidden': 'true' });
      this.shadowEnd = el('span', 'v-sb-shadow v-sb-shadow--end', { 'aria-hidden': 'true' });
      this.stage.appendChild(this.shadowStart);
      this.stage.appendChild(this.shadowEnd);
    }

    this.controls = el('div', 'v-sb-controls');
    this.stage.parentNode.insertBefore(this.controls, this.stage.nextSibling);
    this.generated.push(this.controls);

    if (o.arrows) {
      this.prevBtn = el('button', 'v-sb-arrow v-sb-arrow--prev', { type: 'button', 'aria-label': 'Anterior' });
      this.nextBtn = el('button', 'v-sb-arrow v-sb-arrow--next', { type: 'button', 'aria-label': 'Siguiente' });
      this.prevBtn.innerHTML = SVG_PREV;
      this.nextBtn.innerHTML = SVG_NEXT;
      if (o.arrowsPos === 'bottom') {
        var group = el('div', 'v-sb-arrows');
        group.appendChild(this.prevBtn);
        group.appendChild(this.nextBtn);
        this.controls.appendChild(group);
      } else {
        this.stage.appendChild(this.prevBtn);
        this.stage.appendChild(this.nextBtn);
      }
    }

    if (o.dots !== 'none') {
      this.dotsEl = el('div', 'v-sb-dots v-sb-dots--' + o.dots);
      this.controls.insertBefore(this.dotsEl, this.controls.firstChild);
    }

    this.menus = [];
    if (o.top) this.topEl = document.querySelector(o.top);
    this.hook('build');

    this.live = el('div', 'v-sb-sr', { 'aria-live': 'polite', 'aria-atomic': 'true' });
    root.appendChild(this.live);
    this.generated.push(this.live);

  };

  Slider.prototype.bind = function () {
    var self = this;
    var o = this.o;
    if (this.prevBtn) this.on(this.prevBtn, 'click', function () { self.prev(); });
    if (this.nextBtn) this.on(this.nextBtn, 'click', function () { self.next(); });

    this.on(this.root, 'keydown', function (e) {
      if (self.isStatic) return;
      var t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); self.next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); self.prev(); }
    });

    // Al llegar con el TECLADO (Tab) a un item fuera de vista, lo traemos.
    // Con ratón / dedo nunca: un click no debe mover el slider.
    this.on(this.root, 'pointerdown', function () { self.pointerFocus = true; }, { capture: true });
    this.on(this.root, 'keydown', function () { self.pointerFocus = false; }, { capture: true });
    this.on(this.track, 'focusin', function (e) {
      self.viewport.scrollLeft = 0;
      if (self.isStatic || self.fs || self.pointerFocus) return;
      var visible = true;
      try { visible = e.target.matches(':focus-visible'); } catch (err) { /* navegador antiguo */ }
      if (!visible) return;
      var item = e.target.closest && e.target.closest('.v-sb-item');
      if (!item || item.classList.contains('v-sb-clone')) return;
      var i = +item.dataset.sbIndex;
      if (self.activeSet.indexOf(i) === -1) self.goTo(i);
    });

    // Solo recalculamos si cambia el ancho (en móvil la barra de URL cambia el alto
    // constantemente y no debe provocar saltos).
    var schedule = function () {
      if (self.raf) return;
      self.raf = requestAnimationFrame(function () {
        self.raf = 0;
        var key = self.viewport.clientWidth + 'x' + global.innerWidth + 'x' + (self.topEl ? self.topEl.offsetHeight : 0);
        if (key === self.layoutKey) return;
        self.layoutKey = key;
        self.layout();
        self.hook('resize');
      });
    };
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(schedule);
      this.ro.observe(this.root);
      if (this.topEl) this.ro.observe(this.topEl);
    }
    this.on(global, 'resize', schedule);
    this.hook('bind');

  };

  /* ---------------- layout ---------------- */

  Slider.prototype.layout = function () {
    var o = this.o;
    var n = this.n;
    var W = this.viewport.clientWidth;
    var vw = global.innerWidth;
    if (!W) return;
    this.hook('beforeLayout');
    var perView = o.perViewMobile > 0 && vw <= o.mobileBp ? o.perViewMobile : o.perView;
    var gap = o.gap;
    var reason = '';

    if (n === 0) reason = 'empty';
    else if (o.below > 0 && vw > o.below) reason = 'breakpoint';
    else if (!this.fs && o.autoDisable) {
      var w0 = M.itemWidth({ sizing: o.sizing, perView: perView, itemWidth: o.itemWidth, gap: gap, peek: 0, width: W });
      if (M.fits(n, w0, gap, W)) { reason = 'fits'; this.staticWidth = w0; }
    }

    this.root.style.setProperty('--v-sb-gap', gap + 'px');

    if (reason) return this.setStatic(reason, W);
    this.setSlider();

    var peek = 0;
    var pv = M.effectivePerView(perView, o.sizing === 'fixed' ? 0 : o.peek, o.align);
    var w = this.fs ? W * M.clamp(o.fsWidth, 10, 100) / 100 :
      M.itemWidth({ sizing: o.sizing, perView: pv, itemWidth: o.itemWidth, gap: gap, peek: 0, width: W });
    var unit = w + gap;
    var inner = W - 2 * peek;
    var groupN = this.fs ? 1 : Math.max(1, o.step);
    var groupW = Math.min(W, groupN * w + (groupN - 1) * gap);
    var align = this.fs && o.fsWidth >= 100 ? 'start' : o.align;

    this.W = W;
    this.w = w;
    this.unit = unit;
    this.visible = inner / unit;
    this.step = this.fs ? 1 : M.stepSize(o.step, this.visible);
    this.offset = align === 'center' ? (W - groupW) / 2 : peek;
    this.align = align;
    this.maxPos = M.maxPos(n, w, gap, inner);
    this.points = M.snapPoints({
      n: n, step: this.fs ? 1 : o.step, align: align, loop: o.loop, maxPos: this.maxPos, visible: this.visible
    });
    if (this.fs) this.points = this.items.map(function (_, i) { return i; });
    if (align === 'center' || this.fs) this.maxPos = this.points[this.points.length - 1];

    this.ensureClones(o.loop ? Math.ceil(W / (n * unit)) + 1 : 0);
    var all = this.allItems();
    for (var i = 0; i < all.length; i++) all[i].style.width = w + 'px';

    if (o.loop) {
      this.pos = M.mod(this.pos, n);
    } else {
      this.pos = M.clamp(this.pos, 0, this.maxPos);
      if (o.step > 0 || this.fs) this.pos = this.points[M.nearest(this.points, this.pos)];
    }
    this.target = this.pos;
    this.renderDots();
    this.lastIndex = -1;
    this.render();
    this.hook('afterLayout');
    this.emit('sb:layout');
  };

  Slider.prototype.setStatic = function (reason, W) {
    var o = this.o;
    this.stopAnim();
    this.isStatic = true;
    this.staticReason = reason;
    this.ensureClones(0);
    this.root.classList.add('v-sb--static');
    this.root.classList.remove('v-sb--slider');
    this.root.dataset.sbState = 'static-' + reason;
    this.track.style.transform = '';
    var w;
    if (reason === 'fits') w = this.staticWidth;
    else {
      var cols = Math.min(o.columns, Math.max(1, this.n));
      w = (W - o.gap * (cols - 1)) / cols;
    }
    this.items.forEach(function (item) {
      item.style.width = Math.floor(w * 100) / 100 + 'px';
      item.classList.remove('is-active');
      item.removeAttribute('aria-hidden');
    });
    this.points = [0];
    this.activeSet = this.items.map(function (_, i) { return i; });
    this.emit('sb:layout');
  };

  Slider.prototype.setSlider = function () {
    this.isStatic = false;
    this.staticReason = '';
    this.root.classList.remove('v-sb--static');
    this.root.classList.add('v-sb--slider');
    this.root.dataset.sbState = 'slider';
  };

  Slider.prototype.allItems = function () {
    return this.cloneBeforeEls.concat(this.items, this.cloneAfterEls);
  };

  Slider.prototype.ensureClones = function (sets) {
    if (!this.cloneBeforeEls) { this.cloneBeforeEls = []; this.cloneAfterEls = []; }
    if (sets === this.cloneSets) return;
    this.cloneBeforeEls.concat(this.cloneAfterEls).forEach(function (c) { c.remove(); });
    this.cloneBeforeEls = [];
    this.cloneAfterEls = [];
    var self = this;
    var make = function (item) {
      var c = item.cloneNode(true);
      c.classList.add('v-sb-clone');
      c.classList.remove('is-active');
      c.removeAttribute('id');
      c.setAttribute('aria-hidden', 'true');
      c.querySelectorAll('[id]').forEach(function (x) { x.removeAttribute('id'); });
      c.querySelectorAll('a,button,input,select,textarea,[tabindex]').forEach(function (x) { x.setAttribute('tabindex', '-1'); });
      return c;
    };
    for (var s = 0; s < sets; s++) {
      var first = this.track.firstChild;
      var frag = document.createDocumentFragment();
      this.items.forEach(function (item) { var c = make(item); self.cloneBeforeEls.push(c); frag.appendChild(c); });
      this.track.insertBefore(frag, first);
      this.items.forEach(function (item) { var c = make(item); self.cloneAfterEls.push(c); self.track.appendChild(c); });
    }
    // Orden correcto de los clones previos (insertamos sets al principio).
    this.cloneBeforeEls = Array.prototype.filter.call(this.track.children, function (c) {
      return c.classList.contains('v-sb-clone') && self.cloneBeforeEls.indexOf(c) !== -1;
    });
    this.cloneSets = sets;
    this.cloneBefore = sets * this.n;
  };

  /* ---------------- render ---------------- */

  Slider.prototype.render = function () {
    if (this.isStatic) return;
    var x = this.offset - (this.pos + this.cloneBefore) * this.unit;
    this.track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';

    var o = this.o;
    var atStart = !o.loop && this.pos <= M.EPS;
    var atEnd = !o.loop && this.pos >= this.maxPos - M.EPS;
    this.root.classList.toggle('v-sb--at-start', atStart);
    this.root.classList.toggle('v-sb--at-end', atEnd);
    if (this.prevBtn) this.prevBtn.disabled = atStart;
    if (this.nextBtn) this.nextBtn.disabled = atEnd;

    var idx = Math.round(this.pos);
    if (idx === this.lastIndex) return;
    this.lastIndex = idx;

    var count = this.fs ? 1 : Math.max(1, o.step);
    var active = M.activeIndexes(this.pos, this.n, count, o.loop);
    this.activeSet = active;
    var all = this.allItems();
    for (var i = 0; i < all.length; i++) {
      var on = active.indexOf(+all[i].dataset.sbIndex) !== -1;
      all[i].classList.toggle('is-active', on);
    }

    var page = M.activePage(this.points, this.pos, this.n, this.step, o.loop);
    this.page = page;
    if (this.dotBtns) {
      this.dotBtns.forEach(function (b, k) {
        b.classList.toggle('is-active', k === page);
        b.setAttribute('aria-current', k === page ? 'true' : 'false');
      });
    }
    if (this.fractionEl) this.fractionEl.textContent = (page + 1) + ' / ' + this.points.length;
    this.hook('render', active[0]);
  };

  Slider.prototype.renderDots = function () {
    if (!this.dotsEl) return;
    var self = this;
    var count = this.points.length;
    if (this.dotCount === count) return;
    this.dotCount = count;
    this.dotsEl.innerHTML = '';
    this.dotBtns = null;
    this.fractionEl = null;
    if (this.o.dots === 'fraction') {
      this.fractionEl = el('span', 'v-sb-fraction', { 'aria-hidden': 'true' });
      this.dotsEl.appendChild(this.fractionEl);
      return;
    }
    this.dotBtns = this.points.map(function (_, k) {
      var b = el('button', 'v-sb-dot', { type: 'button', 'aria-label': 'Ir a la página ' + (k + 1) });
      b.addEventListener('click', function () { self.goToPage(k); });
      self.dotsEl.appendChild(b);
      return b;
    });
  };

  /* ---------------- movimiento ---------------- */

  Slider.prototype.stopAnim = function () {
    if (this.anim) cancelAnimationFrame(this.anim);
    if (this.followRaf) cancelAnimationFrame(this.followRaf);
    this.anim = 0;
    this.followRaf = 0;
  };

  Slider.prototype.animateTo = function (target, duration) {
    var self = this;
    var o = this.o;
    this.stopAnim();
    if (o.loop) {
      // Mantiene el destino en [0, n) desplazando ambos extremos.
      var k = Math.floor(target / this.n);
      if (k !== 0) { target -= k * this.n; this.pos -= k * this.n; }
    }
    this.target = target;
    var from = this.pos;
    var dur = duration === undefined ? o.speed : duration;
    if (reducedMotion()) dur = 0;
    if (dur <= 0 || Math.abs(target - from) < 1e-4) {
      this.pos = target;
      this.render();
      this.settle();
      return;
    }
    var t0 = now();
    var tick = function () {
      var t = Math.min(1, (now() - t0) / dur);
      var e = 1 - Math.pow(1 - t, 3);
      self.pos = from + (target - from) * e;
      self.render();
      if (t < 1) self.anim = requestAnimationFrame(tick);
      else { self.anim = 0; self.settle(); }
    };
    this.anim = requestAnimationFrame(tick);
  };

  Slider.prototype.settle = function () {
    if (this.o.loop) {
      var p = M.mod(this.pos, this.n);
      if (Math.abs(p - Math.round(p)) < 1e-3) p = M.mod(Math.round(p), this.n);
      if (p !== this.pos) { this.pos = p; this.lastIndex = -1; this.render(); }
      this.target = this.pos;
    }
    var index = this.activeSet ? this.activeSet[0] : 0;
    if (index !== this.lastEmitted) {
      this.lastEmitted = index;
      if (this.live) this.live.textContent = 'Slide ' + (index + 1) + ' de ' + this.n;
      this.emit('sb:change');
    }
  };

  Slider.prototype.loopAnchor = function () {
    var base = this.target;
    return base + Math.round((this.pos - base) / this.step) * this.step;
  };

  Slider.prototype.next = function () { this.move(1); };
  Slider.prototype.prev = function () { this.move(-1); };

  Slider.prototype.move = function (dir) {
    if (this.isStatic) return;
    if (this.fs) return this.fsGo(this.fsIdx + dir);
    if (this.o.loop) return this.animateTo(this.loopAnchor() + dir * this.step);
    var idx = M.nearest(this.points, this.target);
    idx = M.clamp(idx + dir, 0, this.points.length - 1);
    this.animateTo(this.points[idx]);
  };

  Slider.prototype.goToPage = function (k) {
    if (this.isStatic) return;
    k = M.clamp(k, 0, this.points.length - 1);
    if (this.fs) return this.fsGo(this.points[k]);
    var p = this.points[k];
    if (this.o.loop) p = this.pos + M.shortestDelta(this.pos, p, this.n);
    this.animateTo(p);
  };

  /** Va al item real i (0-based). */
  Slider.prototype.goTo = function (i) {
    if (this.isStatic) return;
    i = M.clamp(Math.round(i), 0, this.n - 1);
    if (this.fs) return this.fsGo(i);
    if (this.o.loop) return this.animateTo(this.pos + M.shortestDelta(this.pos, i, this.n));
    this.animateTo(this.points[M.floorPoint(this.points, i)]);
  };

  /* ---------------- utilidades ---------------- */

  Slider.prototype.emit = function (type) {
    var detail = this.getState();
    var ev;
    try { ev = new CustomEvent(type, { detail: detail, bubbles: true }); } catch (err) {
      ev = document.createEvent('CustomEvent'); ev.initCustomEvent(type, true, false, detail);
    }
    this.root.dispatchEvent(ev);
  };

  Slider.prototype.getState = function () {
    return {
      isStatic: this.isStatic,
      staticReason: this.staticReason,
      pos: this.pos,
      index: this.activeSet ? this.activeSet[0] : 0,
      active: (this.activeSet || []).slice(),
      page: this.page || 0,
      pages: this.isStatic ? 1 : this.points.length,
      count: this.n,
      itemWidth: this.w,
      clones: this.cloneBeforeEls ? this.cloneBeforeEls.length + this.cloneAfterEls.length : 0
    };
  };

  Slider.prototype.refresh = function () { this.layout(); };

  Slider.prototype.destroy = function () {
    this.stopAnim();
    this.hook('destroy');
    if (this.ac) this.ac.abort();
    if (this.ro) this.ro.disconnect();
    this.ensureClones(0);
    var parent = this.stage.parentNode;
    parent.insertBefore(this.viewport, this.stage);
    this.generated.forEach(function (g) { g.remove(); });
    this.track.style.transform = '';
    this.items.forEach(function (item) { item.style.width = ''; item.classList.remove('is-active'); });
    this.root.classList.remove('v-sb--ready', 'v-sb--static', 'v-sb--slider', 'v-sb--at-start', 'v-sb--at-end', 'v-sb--draggable', 'v-sb--fs');
    delete this.root.sbSlider;
  };

  /* ------------------------------------------------------------------ *
   * Módulos: cada archivo sliderBuilder-*.js se registra con SliderBuilder.module()
   * ------------------------------------------------------------------ */
  var MODULES = {};
  var ORDER = ['drag', 'menu', 'fullscreen', 'autoplay'];
  /** Qué opciones necesitan cada módulo (para avisar si falta). */
  var NEEDS = {
    drag: function (o) { return o.drag; },
    menu: function (o) { return o.menu; },
    fullscreen: function (o) { return o.mode === 'fullscreen'; },
    autoplay: function (o) { return o.autoplay > 0 && o.mode !== 'fullscreen'; }
  };

  function warn(msg) {
    if (global.console && console.warn) console.warn('[v-sb] ' + msg);
  }

  /* ------------------------------------------------------------------ *
   * Auto-init declarativo
   * ------------------------------------------------------------------ */
  var instances = [];

  function initAll(scope) {
    var list = (scope || document).querySelectorAll('[data-sb]');
    Array.prototype.forEach.call(list, function (root) {
      if (!root.sbSlider) instances.push(new Slider(root));
    });
    return instances;
  }

  global.SliderBuilder = {
    version: '1.0.0',
    Slider: Slider,
    /** SliderBuilder.init('#mi-slider', { perView: 3, loop: true }) */
    init: function (target, options) {
      var root = typeof target === 'string' ? document.querySelector(target) : target;
      if (!root) throw new Error('SliderBuilder.init: no existe ' + target);
      if (root.sbSlider) return root.sbSlider;
      var s = new Slider(root, options);
      instances.push(s);
      return s;
    },
    initAll: initAll,
    instances: instances,
    parseOptions: parseOptions,
    defaults: DEFAULTS,
    defaultsFor: defaultsFor,
    math: M,
    /** Registra un módulo: { applies(o), build, bind, beforeLayout, afterLayout, render, init, resize, destroy } */
    module: function (name, def) { MODULES[name] = def; if (ORDER.indexOf(name) === -1) ORDER.push(name); },
    modules: MODULES,
    _: { el: el, now: now, reducedMotion: reducedMotion, labelOf: labelOf, SVG_PREV: SVG_PREV, SVG_NEXT: SVG_NEXT }
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { initAll(); });
    else setTimeout(function () { initAll(); }, 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
