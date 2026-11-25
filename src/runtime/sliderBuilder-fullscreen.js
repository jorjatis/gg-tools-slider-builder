/*! v-sb — pantalla completa con scroll (requiere sliderBuilder-core.js) */
(function (SB) {
  'use strict';
  if (!SB) return;
  var M = SB.math;
  var U = SB._;
  var el = U.el;
  var now = U.now;
  var reducedMotion = U.reducedMotion;
  var labelOf = U.labelOf;
  var SVG_PREV = U.SVG_PREV;
  var SVG_NEXT = U.SVG_NEXT;
  var global = window;
  var Slider = SB.Slider;
  /** Persigue suavemente un destino que cambia (scroll real en pantalla completa). */
  Slider.prototype.follow = function (target) {
    var self = this;
    this.followTarget = target;
    if (this.anim) { cancelAnimationFrame(this.anim); this.anim = 0; }
    if (reducedMotion()) { this.pos = target; this.render(); this.settle(); return; }
    if (this.followRaf) return;
    var last = now();
    var tick = function () {
      var t = now();
      var k = 1 - Math.exp(-(t - last) / 70);
      last = t;
      var d = self.followTarget - self.pos;
      if (Math.abs(d) < 5e-4) {
        self.pos = self.followTarget;
        self.followRaf = 0;
        self.render();
        self.settle();
        return;
      }
      self.pos += d * k;
      self.render();
      self.followRaf = requestAnimationFrame(tick);
    };
    this.followRaf = requestAnimationFrame(tick);
  };

  /* ---------------- pantalla completa (scroll pinned) ----------------
   * Clave anti-glitch: mientras la sección está fija (pinned) mover el scroll de la
   * página es invisible, así que los ajustes de scroll son INSTANTÁNEOS y la única
   * animación es la del track. Nunca peleamos con el dedo ni con la rueda:
   *  - jump:  el índice sale directamente del scroll, sin animación.
   *  - step:  rueda / swipe vertical se interceptan y pasan de uno en uno.
   *  - scrub: el track sigue al scroll (suavizado) y al terminar el scroll
   *           (scrollend: dedo levantado + inercia acabada) se centra.
   * ------------------------------------------------------------------ */

  Slider.prototype.fsMetrics = function () {
    var rect = this.root.getBoundingClientRect();
    var pinTop = this.pinTop || 0;
    var pinH = this.pin === this.root ? global.innerHeight - pinTop : this.pin.offsetHeight;
    var total = Math.max(0, this.root.offsetHeight - pinH);
    var prog = total > 0 ? M.clamp((pinTop - rect.top) / total, 0, 1) : 0;
    return { rect: rect, total: total, pinH: pinH, progress: prog, f: prog * Math.max(0, this.n - 1) };
  };

  /** ¿La sección está fija ocupando la pantalla? */
  Slider.prototype.fsEngaged = function () {
    var m = this.fsMetrics();
    var top = this.pinTop || 0;
    return m.rect.top <= top + 1 && m.rect.bottom >= top + m.pinH - 1;
  };

  Slider.prototype.fsY = function (i) {
    var m = this.fsMetrics();
    var top = m.rect.top + global.scrollY - (this.pinTop || 0);
    return Math.round(top + (this.n > 1 ? (i / (this.n - 1)) * m.total : 0));
  };

  Slider.prototype.fsScrollTo = function (y, smooth) {
    global.scrollTo({ top: y, behavior: smooth && !reducedMotion() ? 'smooth' : 'instant' });
    if (!this.hasScrollEnd) {
      var self = this;
      clearTimeout(this.fsTimer);
      this.fsTimer = setTimeout(function () { self.fsSettle(); }, smooth ? 900 : 120);
    }
  };

  /** Menú anexo: en modo sticky la sección se fija justo debajo de él. */
  Slider.prototype.fsMeasure = function () {
    var h = this.topEl ? this.topEl.offsetHeight : 0;
    this.pinTop = this.topEl && this.o.topMode === 'sticky' ? h : 0;
    this.root.style.setProperty('--v-sb-pin-top', this.pinTop + 'px');
    // En modo overlay el menú queda encima de los slides: el contenido se aparta.
    this.root.style.setProperty('--v-sb-overlay-h', (this.topEl && this.o.topMode === 'overlay' ? h : 0) + 'px');
  };

  /**
   * Menú anexo fijo (sticky / overlay): al terminar la sección sube con ella en vez de
   * quedarse fijo el resto de la página. Funciona esté donde esté el menú.
   */
  Slider.prototype.fsTopFollow = function () {
    var t = this.topEl;
    if (!t || this.o.topMode === 'anchor') return;
    var shift = 0;
    if (!this.isStatic) {
      var bottom = this.root.getBoundingClientRect().bottom;
      var limit = this.pinTop + (this.pin === this.root ? global.innerHeight - this.pinTop : this.pin.offsetHeight);
      shift = Math.min(0, bottom - limit);
      if (shift < 0) {
        // Solo si el menú está fijo arriba (no si aún está en su sitio, más abajo).
        var natural = t.getBoundingClientRect().top - (this.topShift || 0);
        if (natural > 0.5) shift = 0;
      }
    }
    if (shift !== (this.topShift || 0)) {
      this.topShift = shift;
      t.style.transform = shift ? 'translate3d(0,' + shift.toFixed(1) + 'px,0)' : '';
    }
  };

  /** Sincroniza sin animar (inicio y cambios de tamaño). */
  Slider.prototype.fsSync = function () {
    if (!this.fs || this.isStatic) return;
    var m = this.fsMetrics();
    var idx = this.fsLock !== null ? this.fsLock : Math.round(m.f);
    this.stopAnim();
    this.fsIdx = idx;
    // A menos de 1,5 px de un slide (redondeos) está en él.
    var exact = Math.abs(m.f - idx) * (m.total / Math.max(1, this.n - 1)) < 1.5;
    this.pos = this.o.fsTransition === 'scrub' && this.fsLock === null && !exact ? m.f : idx;
    this.target = idx;
    this.lastIndex = -1;
    this.wasEngaged = this.fsEngaged();
    this.render();
    this.settle();
  };

  /** En cada scroll (rAF). */
  Slider.prototype.fsUpdate = function () {
    if (this.fs) this.fsTopFollow();
    if (!this.fs || this.isStatic || (this.ptr && this.ptr.dragging)) return;
    var self = this;
    var m = this.fsMetrics();
    var tr = this.o.fsTransition;
    var idx;
    var engaged = this.fsEngaged();
    var slideH = m.total / Math.max(1, this.n - 1);
    var entering = engaged && !this.wasEngaged;
    this.wasEngaged = engaged;
    if (tr === 'step' && entering && this.fsLock === null) {
      // Recién entrados en la sección. Cerca del borde (rueda, inercia del dedo…) se queda
      // en el primer slide, o en el último si venimos de abajo; si caemos en medio (enlace,
      // barra de scroll) en el más cercano. La inercia que se cuela se absorbe un momento.
      var entry = m.f <= 0.6 ? 0 : (m.f >= this.n - 1.6 ? this.n - 1 : Math.round(m.f));
      this.fsIdx = entry;
      this.fsLock = entry;
      this.enterUntil = now() + 700;
      this.lastNav = now();
      this.wheelArmed = false;
      this.stopAnim();
      this.pos = entry;
      this.target = entry;
      this.render();
      this.settle();
      if (Math.abs(m.f - entry) * slideH > 1) this.fsScrollTo(this.fsY(entry), false);
    } else if (this.fsLock !== null) {
      // Scroll provocado por nosotros (o inercia que absorbemos): el destino ya está decidido.
      if (tr === 'scrub') this.follow(this.fsLock);
      else if (tr === 'step' && engaged && now() < (this.enterUntil || 0) && Math.abs(m.f - this.fsLock) * slideH > 2) {
        this.fsScrollTo(this.fsY(this.fsLock), false);
      }
    } else if (tr === 'scrub') {
      // A menos de 1px de un slide, consideramos que está exactamente en él.
      var near = Math.round(m.f);
      this.fsIdx = near;
      this.follow(Math.abs(m.f - near) * slideH < 1.5 ? near : m.f);
    } else {
      // En modo paso el scroll nativo (teclado, barra) solo cambia de slide al pasar la mitad:
      // los pequeños desplazamientos se recolocan de forma invisible al terminar.
      idx = Math.round(m.f);
      if (idx !== this.fsIdx) {
        this.fsIdx = idx;
        if (tr === 'jump') { this.stopAnim(); this.pos = idx; this.target = idx; this.render(); this.settle(); }
        else this.animateTo(idx);
      }
    }
    if (!this.hasScrollEnd) {
      clearTimeout(this.fsTimer);
      this.fsTimer = setTimeout(function () { self.fsSettle(); }, 180);
    }
  };

  /** Cuando el scroll termina de verdad. */
  Slider.prototype.fsSettle = function () {
    if (!this.fs || this.isStatic) return;
    var self = this;
    if (this.touching && !this.hasScrollEnd) {
      clearTimeout(this.fsTimer);
      this.fsTimer = setTimeout(function () { self.fsSettle(); }, 180);
      return;
    }
    // scrollend puede llegar antes que el rAF del último scroll: lo procesamos ya.
    if (this.fsRaf) { cancelAnimationFrame(this.fsRaf); this.fsRaf = 0; }
    this.fsUpdate();
    this.fsLock = null;
    var tr = this.o.fsTransition;
    if (tr === 'jump') return;
    var m = this.fsMetrics();
    var idx = tr === 'step' ? this.fsIdx : Math.round(m.f);
    if (m.progress <= 0 || m.progress >= 1) {
      if (tr === 'scrub') this.follow(m.f);
      return;
    }
    // Scroll real: se queda donde lo dejas; solo encaja si falta menos de un 10% para un slide.
    if (tr === 'scrub' && Math.abs(m.f - idx) > 0.1) {
      this.follow(m.f);
      return;
    }
    if (Math.abs(m.f - idx) * (m.total / Math.max(1, this.n - 1)) > 1) {
      // Sección fija → ajuste de scroll instantáneo e invisible.
      this.fsLock = idx;
      this.fsIdx = idx;
      if (tr === 'scrub') this.follow(idx);
      else if (this.pos !== idx) this.animateTo(idx);
      this.fsScrollTo(this.fsY(idx), false);
    }
  };

  /** Ir al slide i: desde flechas, puntos, menú, arrastre, rueda o swipe. */
  Slider.prototype.fsGo = function (i) {
    i = M.clamp(Math.round(i), 0, this.n - 1);
    var tr = this.o.fsTransition;
    var engaged = this.fsEngaged();
    this.fsIdx = i;
    this.fsLock = i;
    this.lastNav = now();
    if (tr === 'jump' || !engaged) {
      // Fuera de la sección la página se desplaza (visible); el slide ya está listo.
      this.stopAnim();
      this.pos = i;
      this.target = i;
      this.render();
      this.settle();
    } else if (tr === 'scrub') {
      this.follow(i);
    } else {
      this.animateTo(i);
    }
    this.fsScrollTo(this.fsY(i), !engaged);
  };

  /* Rueda (solo modo paso): un gesto = un slide. Ignora la inercia del trackpad. */
  Slider.prototype.fsWheel = function (e) {
    if (this.isStatic || e.ctrlKey) return;
    var d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : 0;
    if (!d) return;
    if (e.deltaMode === 1) d *= 40;
    var t = now();
    var abs = Math.abs(d);
    var lockMs = Math.max(250, this.o.speed * 0.7);
    // Gesto nuevo: tras una pausa, o una aceleración clara pasado el bloqueo
    // (la aceleración inicial del mismo gesto no cuenta).
    var gap = t - (this.wheelLast || 0);
    var decaying = abs < (this.wheelAbs || 0) * 0.8;
    var fresh = gap > 400 || (gap > 160 && !decaying) ||
      (abs > (this.wheelAbs || 0) * 1.6 + 4 && t - (this.lastNav || 0) > lockMs);
    this.wheelLast = t;
    this.wheelAbs = abs;
    // Mientras la rueda mueve la página fuera de la sección, ese gesto ya está "gastado":
    // al entrar hay que hacer un gesto nuevo para pasar de slide.
    if (!this.fsEngaged()) { this.wheelArmed = false; this.wheelAcc = 0; return; }
    if (fresh) { this.wheelArmed = true; this.wheelAcc = 0; }
    var dir = d > 0 ? 1 : -1;
    var out = (dir > 0 && this.fsIdx >= this.n - 1) || (dir < 0 && this.fsIdx <= 0);
    if (out) {
      // Dejamos salir de la sección, salvo con la inercia del gesto que nos trajo aquí.
      if (!fresh && t - (this.lastNav || 0) < 1200) e.preventDefault();
      return;
    }
    e.preventDefault();
    if (!this.wheelArmed || t - (this.lastNav || 0) < lockMs) return;
    this.wheelAcc = (this.wheelAcc || 0) + d;
    if (Math.abs(this.wheelAcc) < 24) return;
    this.wheelArmed = false;
    this.wheelAcc = 0;
    this.fsGo(this.fsIdx + dir);
  };

  /* Táctil: en modo paso un swipe vertical pasa de slide sin scroll nativo. */
  Slider.prototype.fsTouchStart = function (e) {
    this.touching = true;
    if (this.o.fsTransition !== 'step' || this.isStatic || !e.touches[0]) { this.tch = null; return; }
    this.tch = { x: e.touches[0].clientX, y: e.touches[0].clientY, mode: null, dx: 0, dy: 0 };
  };

  Slider.prototype.fsTouchMove = function (e) {
    var c = this.tch;
    if (!c || !e.touches[0]) return;
    c.dx = e.touches[0].clientX - c.x;
    c.dy = e.touches[0].clientY - c.y;
    if (c.mode === null) {
      if (Math.abs(c.dx) < 8 && Math.abs(c.dy) < 8) return;
      if (Math.abs(c.dx) > Math.abs(c.dy)) { c.mode = 'x'; return; }
      c.dir = c.dy < 0 ? 1 : -1;
      var out = (c.dir > 0 && this.fsIdx >= this.n - 1) || (c.dir < 0 && this.fsIdx <= 0);
      c.mode = !this.fsEngaged() || out ? 'native' : 'page';
    }
    if (c.mode === 'page' && e.cancelable) e.preventDefault();
  };

  Slider.prototype.fsTouchEnd = function (e) {
    this.touching = !!(e.touches && e.touches.length);
    var c = this.tch;
    this.tch = null;
    if (c && c.mode === 'page' && Math.abs(c.dy) > 30) this.fsGo(this.fsIdx + c.dir);
    else if (!this.hasScrollEnd) this.fsUpdate();
  };

  SB.module('fullscreen', {
    applies: function (o, s) { return s.fs; },
    build: function (s) {
      var o = s.o;
      var root = s.root;
      s.pin = root.querySelector('.v-sb-pin') || root;
      root.style.setProperty('--v-sb-fs-steps', String(Math.max(0, s.n - 1)));
      root.style.setProperty('--v-sb-fs-length', String(o.fsLength));
    },
    bind: function (s) {
      var self = s;
      var o = s.o;
      s.hasScrollEnd = 'onscrollend' in global;
      s.on(global, 'scroll', function () {
        self.fsTopFollow(); // en el mismo evento: el menú anexo no va un fotograma por detrás
        if (self.fsRaf) return;
        self.fsRaf = requestAnimationFrame(function () { self.fsRaf = 0; self.fsUpdate(); });
      }, { passive: true });
      if (s.hasScrollEnd) s.on(global, 'scrollend', function () { self.fsSettle(); });
      s.on(global, 'touchstart', function (e) { self.fsTouchStart(e); }, { passive: true });
      s.on(global, 'touchmove', function (e) { self.fsTouchMove(e); }, { passive: false });
      s.on(global, 'touchend', function (e) { self.fsTouchEnd(e); }, { passive: true });
      s.on(global, 'touchcancel', function (e) { self.fsTouchEnd(e); }, { passive: true });
      if (o.fsTransition === 'step') s.on(global, 'wheel', function (e) { self.fsWheel(e); }, { passive: false });
    },
    beforeLayout: function (s) { s.fsMeasure(); },
    init: function (s) { s.fsSync(); },
    resize: function (s) { s.fsSync(); },
    destroy: function (s) { clearTimeout(s.fsTimer); }
  });
})(typeof window !== 'undefined' ? window.SliderBuilder : globalThis.SliderBuilder);
