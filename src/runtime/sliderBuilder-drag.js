/*! v-sb — arrastre con ratón y dedo (requiere sliderBuilder-core.js) */
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
  /** Retoma el movimiento que un pointerdown pudo interrumpir (click sin arrastre). */
  Slider.prototype.resume = function () {
    if (this.fs) {
      if (this.o.fsTransition === 'scrub') this.follow(this.fsLock !== null ? this.fsLock : this.fsMetrics().f);
      else if (this.pos !== this.fsIdx) this.animateTo(this.fsIdx);
    } else if (this.pos !== this.target) {
      this.animateTo(this.target);
    }
  };

  /* ---------------- arrastre ---------------- */

  Slider.prototype.onDown = function (e) {
    if (this.isStatic) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest && e.target.closest('input,textarea,select,[data-sb-nodrag]')) return;
    var interrupted = !!(this.anim || this.followRaf);
    this.stopAnim();
    this.dragMoved = false;
    var anchor = this.o.loop ? this.loopAnchor() : this.points[M.nearest(this.points, this.pos)];
    if (this.fs) anchor = this.fsIdx;
    this.ptr = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, startPos: this.pos, anchor: anchor,
      lastX: e.clientX, lastT: now(), v: 0, dragging: false, interrupted: interrupted
    };
  };

  Slider.prototype.onMove = function (e) {
    var p = this.ptr;
    if (!p || e.pointerId !== p.id) return;
    var dx = e.clientX - p.x0;
    var dy = e.clientY - p.y0;
    if (!p.dragging) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) { this.ptr = null; if (p.interrupted) this.resume(); return; }
      p.dragging = true;
      this.dragMoved = true;
      this.root.classList.add('v-sb--dragging');
      try { this.viewport.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }
    e.preventDefault();
    var t = now();
    var dt = t - p.lastT;
    if (dt > 0) {
      var vi = -(e.clientX - p.lastX) / this.unit / dt;
      p.v = 0.7 * vi + 0.3 * p.v;
    }
    p.lastX = e.clientX;
    p.lastT = t;
    var raw = p.startPos - dx / this.unit;
    if (this.o.loop) {
      var k = Math.floor(raw / this.n);
      if (k !== 0) {
        raw -= k * this.n; p.startPos -= k * this.n; p.anchor -= k * this.n; this.target -= k * this.n;
      }
      this.pos = raw;
    } else {
      this.pos = M.rubber(raw, 0, this.maxPos);
    }
    this.render();
  };

  Slider.prototype.onUp = function (e, cancelled) {
    var p = this.ptr;
    if (!p || (e.pointerId !== undefined && e.pointerId !== p.id)) return;
    this.ptr = null;
    if (!p.dragging) { if (p.interrupted) this.resume(); return; }
    var self = this;
    this.root.classList.remove('v-sb--dragging');
    try { this.viewport.releasePointerCapture(p.id); } catch (err) { /* noop */ }
    setTimeout(function () { self.dragMoved = false; }, 60);
    if (now() - p.lastT > 90) p.v = 0;
    var target = M.releaseTarget({
      points: this.points, loop: this.o.loop, free: this.o.step === 0 && !this.fs,
      anchor: p.anchor, pos: cancelled ? p.anchor : this.pos, velocity: cancelled ? 0 : p.v,
      unit: this.unit, step: this.step, maxPos: this.maxPos, threshold: Math.min(60, this.unit * 0.15)
    });
    if (this.fs) return this.fsGo(Math.round(target));
    this.animateTo(target, this.o.step === 0 ? Math.max(this.o.speed, 500) : this.o.speed);
  };

  SB.module('drag', {
    applies: function (o) { return o.drag; },
    bind: function (s) {
      var self = s;
      s.root.classList.add('v-sb--draggable');
      s.on(s.viewport, 'pointerdown', function (e) { self.onDown(e); });
      s.on(s.viewport, 'pointermove', function (e) { self.onMove(e); });
      s.on(s.viewport, 'pointerup', function (e) { self.onUp(e); });
      s.on(s.viewport, 'pointercancel', function (e) { self.onUp(e, true); });
      s.on(s.viewport, 'lostpointercapture', function (e) { if (self.ptr && self.ptr.dragging) self.onUp(e); });
      // Un arrastre nunca dispara el click del item (links, botones…).
      s.on(s.viewport, 'click', function (e) {
        if (self.dragMoved) { e.preventDefault(); e.stopPropagation(); self.dragMoved = false; }
      }, { capture: true });
      s.on(s.viewport, 'dragstart', function (e) { e.preventDefault(); });
    }
  });
})(typeof window !== 'undefined' ? window.SliderBuilder : globalThis.SliderBuilder);
