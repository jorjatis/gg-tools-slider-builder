/*! v-sb — menú de burbujas (requiere sliderBuilder-core.js) */
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
  /**
   * Menú de burbujas: pista con scroll horizontal (dedo nativo, ratón arrastrando) y
   * flechas en los extremos si no caben. Se inserta en `parent` antes de `before`.
   */
  Slider.prototype.makeMenu = function (parent, before) {
    var self = this;
    var m = { shown: false };
    m.el = el('nav', 'v-sb-menu', { 'aria-label': 'Navegación del slider' });
    m.track = el('div', 'v-sb-menu__track');
    var prev = el('button', 'v-sb-menu__arrow v-sb-menu__arrow--prev', { type: 'button', 'aria-label': 'Ver anteriores', tabindex: '-1' });
    var next = el('button', 'v-sb-menu__arrow v-sb-menu__arrow--next', { type: 'button', 'aria-label': 'Ver siguientes', tabindex: '-1' });
    prev.innerHTML = SVG_PREV;
    next.innerHTML = SVG_NEXT;
    m.el.appendChild(prev);
    m.el.appendChild(m.track);
    m.el.appendChild(next);
    var page = function (dir) {
      m.track.scrollBy({ left: dir * m.track.clientWidth * 0.7, behavior: reducedMotion() ? 'instant' : 'smooth' });
    };
    prev.addEventListener('click', function () { page(-1); });
    next.addEventListener('click', function () { page(1); });
    m.track.addEventListener('scroll', function () { self.menuArrows(); }, { passive: true });
    m.btns = this.items.map(function (item, i) {
      var b = el('button', 'v-sb-menu__btn', { type: 'button' });
      b.textContent = labelOf(item, i);
      b.addEventListener('click', function () { self.goTo(i); });
      m.track.appendChild(b);
      return b;
    });
    this.menuDrag(m);
    parent.insertBefore(m.el, before);
    this.generated.push(m.el);
    return m;
  };

  /** Arrastrar el menú con ratón / lápiz. Un arrastre no activa el botón donde se suelta. */
  Slider.prototype.menuDrag = function (m) {
    var t = m.track;
    var d = null;
    t.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      d = { id: e.pointerId, x: e.clientX, left: t.scrollLeft, moved: false };
    });
    t.addEventListener('pointermove', function (e) {
      if (!d || e.pointerId !== d.id) return;
      var dx = e.clientX - d.x;
      if (!d.moved) {
        if (Math.abs(dx) < 5) return;
        d.moved = true;
        m.el.classList.add('is-dragging');
        try { t.setPointerCapture(d.id); } catch (err) { /* noop */ }
      }
      e.preventDefault();
      t.scrollLeft = d.left - dx;
    });
    var end = function () {
      if (!d) return;
      var moved = d.moved;
      try { t.releasePointerCapture(d.id); } catch (err) { /* noop */ }
      d = null;
      m.el.classList.remove('is-dragging');
      if (moved) {
        var stop = function (ev) { ev.stopPropagation(); ev.preventDefault(); };
        t.addEventListener('click', stop, true);
        setTimeout(function () { t.removeEventListener('click', stop, true); }, 0);
      }
    };
    t.addEventListener('pointerup', end);
    t.addEventListener('pointercancel', end);
  };

  /** Flechas del menú: solo si los items no caben; ocultas al inicio / final. */
  Slider.prototype.menuArrows = function () {
    (this.menus || []).forEach(function (m) {
      var t = m.track;
      var max = t.scrollWidth - t.clientWidth;
      m.el.classList.toggle('has-overflow', max > 1);
      m.el.classList.toggle('at-start', t.scrollLeft <= 1);
      m.el.classList.toggle('at-end', t.scrollLeft >= max - 1);
    });
  };

  /** Mantiene visible (centrado) el elemento activo de cada menú al mover el slider. */
  Slider.prototype.menuReveal = function (i) {
    var self = this;
    this.menus.forEach(function (m) {
      var t = m.track;
      var b = m.btns[i];
      if (!b || t.scrollWidth <= t.clientWidth + 1) return;
      var max = t.scrollWidth - t.clientWidth;
      var left = M.clamp(b.offsetLeft - (t.clientWidth - b.offsetWidth) / 2, 0, max);
      if (Math.abs(left - t.scrollLeft) < 1) return;
      t.scrollTo({ left: left, behavior: m.shown && !reducedMotion() ? 'smooth' : 'instant' });
      m.shown = true;
    });
    this.menuArrows();
  };

  SB.module('menu', {
    applies: function (o) { return o.menu; },
    build: function (s) {
      var o = s.o;
      var root = s.root;
      var legacyTop = !s.topEl && s.fs && root.querySelector('.v-sb-top');
      var outer = s.topEl || legacyTop;
      if (outer) {
        outer.classList.add('v-sb-top', 'v-sb-top--' + (s.topEl ? o.topMode : 'inline'));
        s.menus.push(s.makeMenu(outer, null));
      }
      if (!outer || (s.topEl && o.menuInside)) {
        s.menus.push(s.makeMenu(s.stage.parentNode, s.stage));
      }
    },
    afterLayout: function (s) { s.menuArrows(); },
    render: function (s, first) {
      s.menus.forEach(function (m) {
        m.btns.forEach(function (b, k) {
          b.classList.toggle('is-active', k === first);
          b.setAttribute('aria-current', k === first ? 'true' : 'false');
        });
      });
      s.menuReveal(first);
    }
  });
})(typeof window !== 'undefined' ? window.SliderBuilder : globalThis.SliderBuilder);
