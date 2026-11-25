/* Configuración por defecto y presets del constructor. */
(function (g) {
  'use strict';

  var PALETTE = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'];

  var SAMPLE = [
    { title: 'Amanecer', text: 'Una historia que empieza con luz.' },
    { title: 'Océano', text: 'Profundidad, calma y movimiento.' },
    { title: 'Bosque', text: 'Senderos que se pierden entre árboles.' },
    { title: 'Desierto', text: 'El silencio también tiene ritmo.' },
    { title: 'Volcán', text: 'Energía contenida a punto de estallar.' },
    { title: 'Aurora', text: 'Colores que bailan en el cielo.' },
    { title: 'Glaciar', text: 'El tiempo, congelado en azul.' },
    { title: 'Ciudad', text: 'Luces, prisa y mil historias.' },
    { title: 'Montaña', text: 'Subir para ver más lejos.' },
    { title: 'Isla', text: 'Un punto en el mapa, un mundo entero.' }
  ];

  function makeItem(i) {
    var s = SAMPLE[i % SAMPLE.length];
    return { title: s.title, text: s.text, color: PALETTE[i % PALETTE.length], link: true };
  }

  function makeItems(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(makeItem(i));
    return out;
  }

  var DEFAULT_CONFIG = {
    name: '',
    id: 'slider-1',
    preset: 'classic',
    mode: 'carousel',
    // Layout
    sizing: 'perview',
    perView: 3,
    itemWidth: 280,
    gap: 16,
    peek: 0,
    align: 'start',
    // Snap / bucle
    step: 1,
    loop: false,
    speed: 450,
    autoplay: 0,
    drag: true,
    // Navegación
    arrows: true,
    arrowsPos: 'inside',
    arrowStyle: 'circle',
    dots: 'dots',
    menu: false,
    shadows: true,
    // Efectos
    effects: [],
    effectOn: 'hover',
    dim: 0.4,
    scale: 1.05,
    // Responsive
    autoDisable: true,
    below: 0,
    columns: 3,
    staticAlign: 'start',
    perViewMobile: 1,
    mobileBp: 699,
    // Pantalla completa
    fsTransition: 'step',
    fsLength: 100,
    fsWidth: 100,
    menuPos: 'sticky',
    menuAlsoInside: false,
    items: makeItems(6)
  };

  var PRESETS = [
    {
      id: 'classic', name: 'Clásico', desc: '3 por vista, flechas, puntos y sombras',
      config: {}
    },
    {
      id: 'center-loop', name: 'Centrado infinito', desc: 'Bucle con el activo en el centro',
      config: { perView: 2, peek: 0.2, align: 'center', loop: true, effects: ['dim', 'scale'], effectOn: 'active', dots: 'lines' }
    },
    {
      id: 'peek', name: 'Peek lateral', desc: 'Se asoma el anterior y el siguiente',
      config: { perView: 1, peek: 0.15, align: 'center', gap: 20, shadows: false, arrowsPos: 'bottom', dots: 'fraction' }
    },
    {
      id: 'hover-gallery', name: 'Galería hover', desc: 'Ancho fijo, scroll libre, foco al pasar',
      config: { sizing: 'fixed', itemWidth: 260, step: 0, effects: ['dim', 'scale'], effectOn: 'hover', dots: 'none', items: makeItems(10) }
    },
    {
      id: 'mobile-only', name: 'Columnas → slider móvil', desc: 'Grid en desktop, slider ≤ 699px',
      config: { below: 699, columns: 3, peek: 0.15, arrows: false, dots: 'dots' }
    },
    {
      id: 'auto-fit', name: 'Solo si no cabe', desc: '3 items: estáticos si caben, slider si no',
      config: { sizing: 'fixed', itemWidth: 300, autoDisable: true, staticAlign: 'center', items: makeItems(3) }
    },
    {
      id: 'tabs', name: 'Menú superior', desc: 'Uno por vista con navegación por pestañas',
      config: { perView: 1, menu: true, dots: 'none', arrowsPos: 'bottom', shadows: false }
    },
    {
      id: 'fs-episodes', name: 'Episodios a pantalla completa', desc: '100dvh pinneado, salta con un poco de scroll',
      config: { mode: 'fullscreen', fsTransition: 'step', menu: true, dots: 'dots', arrows: true, arrowsPos: 'bottom', items: makeItems(5) }
    },
    {
      id: 'fs-scrub', name: 'Episodios con peek', desc: 'Scroll real horizontal, snap al centro',
      config: { mode: 'fullscreen', fsTransition: 'scrub', fsWidth: 78, align: 'center', gap: 24, menu: true, dots: 'lines', arrows: false, effects: ['dim'], effectOn: 'active', items: makeItems(5) }
    },
    {
      id: 'fs-jump', name: 'Diapositivas (salto)', desc: 'Cambio instantáneo, sin animación',
      config: { mode: 'fullscreen', fsTransition: 'jump', menu: true, dots: 'fraction', arrows: true, arrowsPos: 'inside', items: makeItems(4) }
    }
  ];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function applyPreset(id) {
    var p = PRESETS.filter(function (x) { return x.id === id; })[0] || PRESETS[0];
    var cfg = clone(DEFAULT_CONFIG);
    var over = clone(p.config);
    Object.keys(over).forEach(function (k) { cfg[k] = over[k]; });
    cfg.preset = p.id;
    return cfg;
  }

  /** Mezcla una config guardada con los valores por defecto (robusto ante versiones). */
  function normalize(cfg) {
    var out = clone(DEFAULT_CONFIG);
    if (!cfg || typeof cfg !== 'object') return out;
    Object.keys(out).forEach(function (k) {
      if (cfg[k] !== undefined && typeof cfg[k] === typeof out[k]) out[k] = cfg[k];
    });
    if (!Array.isArray(out.items)) out.items = makeItems(6);
    // peek: fracción de item (0–0.5). Valores antiguos (px o %) se descartan.
    if (!(out.peek >= 0 && out.peek <= 0.5)) out.peek = 0;
    out.perView = Math.max(1, Math.round(out.perView));
    out.perViewMobile = Math.max(0, Math.round(out.perViewMobile));
    out.items = out.items.map(function (it, i) {
      var base = makeItem(i);
      it = it || {};
      return {
        title: typeof it.title === 'string' ? it.title : base.title,
        text: typeof it.text === 'string' ? it.text : base.text,
        color: /^#[0-9a-f]{3,8}$/i.test(it.color || '') ? it.color : base.color,
        link: it.link !== false
      };
    });
    return out;
  }

  /** Items con la paleta desplazada (para que cada slider nuevo se distinga). */
  function makeItemsFrom(n, offset) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var it = makeItem(i + offset);
      it.color = PALETTE[(i + offset) % PALETTE.length];
      out.push(it);
    }
    return out;
  }

  g.SBPresets = {
    makeItemsFrom: makeItemsFrom,
    PALETTE: PALETTE,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    PRESETS: PRESETS,
    makeItem: makeItem,
    makeItems: makeItems,
    applyPreset: applyPreset,
    normalize: normalize,
    clone: clone
  };
})(typeof window !== 'undefined' ? window : globalThis);
