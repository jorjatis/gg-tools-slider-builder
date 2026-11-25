/*! v-sb — autoplay (requiere sliderBuilder-core.js) */
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
  SB.module('autoplay', {
    applies: function (o, s) { return o.autoplay > 0 && !s.fs; },
    bind: function (s) {
      var self = s;
      var o = s.o;
      var pause = function () { self.paused = true; };
      var resume = function () { self.paused = false; };
      s.on(s.root, 'mouseenter', pause);
      s.on(s.root, 'mouseleave', resume);
      s.on(s.root, 'focusin', pause);
      s.on(s.root, 'focusout', resume);
      s.autoTimer = setInterval(function () {
        if (self.paused || self.isStatic || self.ptr || document.hidden) return;
        var last = self.points.length - 1;
        if (!o.loop && M.activePage(self.points, self.target, self.n, self.step, false) >= last) self.goToPage(0);
        else self.next();
      }, o.autoplay);
    },
    destroy: function (s) { clearInterval(s.autoTimer); }
  });
})(typeof window !== 'undefined' ? window.SliderBuilder : globalThis.SliderBuilder);
