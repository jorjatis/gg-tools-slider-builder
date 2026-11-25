/* Constructor: panel de opciones, vista previa y exportación. */
(function () {
  'use strict';

  var P = window.SBPresets;
  var G = window.SBGenerator;
  var STORE = 'v-sb-builder:v1';

  var isCarousel = function (c) { return c.mode === 'carousel'; };
  var isFs = function (c) { return c.mode === 'fullscreen'; };
  var has = function (fx) { return function (c) { return c.effects.indexOf(fx) !== -1; }; };

  var FS_HINTS = {
    jump: 'Cada tramo de scroll cambia de slide al instante, sin animación.',
    step: 'Con un poco de scroll va directo al siguiente o al anterior.',
    scrub: 'El scroll mueve los slides de verdad; al soltar se centra en el más cercano.'
  };

  /* Esquema declarativo de controles. */
  var SCHEMA = [
    {
      title: 'Tipo', open: true, fields: [
        {
          key: 'mode', type: 'seg', options: [['carousel', 'Carrusel'], ['fullscreen', 'Pantalla completa']],
          apply: function (v) {
            if (v === state.cfg.mode) return;
            if (v === 'fullscreen') setMany({ mode: v, gap: 0 });
            else setMany({ mode: v, gap: state.cfg.gap || 16 });
          }
        },
        { key: 'name', label: 'Nombre', type: 'text', placeholder: function () { return 'Slider ' + (state.active + 1); } },
        { key: 'id', label: 'ID del slider', type: 'text', hint: function (c) { return 'Se exporta como #' + G.slug(c.id) + '.'; } }
      ]
    },
    {
      title: 'Tamaño y layout', open: true, fields: [
        { key: 'sizing', label: 'Ancho de item', type: 'seg', options: [['perview', 'Por vista'], ['fixed', 'Fijo (px)']], show: isCarousel },
        { key: 'perView', label: 'Items por vista', type: 'range', min: 1, max: 6, step: 1, show: function (c) { return isCarousel(c) && c.sizing === 'perview'; } },
        { key: 'itemWidth', label: 'Ancho de item', type: 'range', min: 120, max: 640, step: 10, unit: 'px', show: function (c) { return isCarousel(c) && c.sizing === 'fixed'; } },
        { key: 'gap', label: 'Separación', type: 'range', min: 0, max: 64, step: 1, unit: 'px', show: function (c) { return isCarousel(c) || c.fsWidth < 100; } },
        { key: 'peek', label: 'Asomar laterales', type: 'range', min: 0, max: 0.5, step: 0.05, show: function (c) { return isCarousel(c) && c.sizing === 'perview'; }, format: function (v) { return v ? Math.round(v * 100) + ' % de item' : 'No'; }, hint: function (c) { return c.peek ? (c.align === 'center' ? 'Asoma el anterior y el siguiente.' : 'Asoma el siguiente.') : ''; } },
        { key: 'align', label: 'Posición del item', type: 'seg', options: [['start', 'Izquierda'], ['center', 'Centrado']], show: function (c) { return isCarousel(c) || c.fsWidth < 100; } },
      ]
    },
    {
      title: 'Snap y movimiento', open: true, show: isCarousel, fields: [
        { key: 'step', label: 'Scroll snapping', type: 'seg', num: true, options: [[0, 'Libre'], [1, '1'], [2, '2'], [3, '3'], [4, '4']], hint: 'Cuántos items avanza cada gesto. «Libre» = sin snap.' },
        { key: 'loop', label: 'Infinito', type: 'toggle' },
        { key: 'drag', label: 'Arrastrar (dedo / ratón)', type: 'toggle' },
        { key: 'speed', label: 'Velocidad', type: 'range', min: 0, max: 1200, step: 50, unit: 'ms' },
        { key: 'autoplay', label: 'Autoplay', type: 'range', min: 0, max: 8000, step: 500, format: function (v) { return v ? (v / 1000) + ' s' : 'Off'; } }
      ]
    },
    {
      title: 'Pantalla completa', open: true, show: isFs, fields: [
        { key: 'fsTransition', label: 'Transición', type: 'seg', options: [['jump', 'Salto'], ['step', 'Paso'], ['scrub', 'Scroll real']], hint: function (c) { return FS_HINTS[c.fsTransition]; } },
        { key: 'fsWidth', label: 'Ancho de cada slide', type: 'range', min: 55, max: 100, step: 1, unit: '%', hint: 'Por debajo de 100% se ven los slides de los lados.' },
        { key: 'fsLength', label: 'Scroll por slide', type: 'range', min: 40, max: 200, step: 10, unit: 'dvh' },
        { key: 'drag', label: 'Arrastrar (dedo / ratón)', type: 'toggle' },
        { key: 'speed', label: 'Velocidad', type: 'range', min: 0, max: 1200, step: 50, unit: 'ms', show: function (c) { return c.fsTransition === 'step'; } }
      ]
    },
    {
      title: 'Navegación', fields: [
        { key: 'arrows', label: 'Flechas', type: 'toggle' },
        { key: 'arrowsPos', label: 'Posición de flechas', type: 'seg', options: [['inside', 'Dentro'], ['outside', 'Fuera'], ['bottom', 'Abajo']], show: function (c) { return c.arrows; } },
        { key: 'arrowStyle', label: 'Estilo de flechas', type: 'seg', options: [['circle', 'Círculo'], ['square', 'Cuadrado'], ['minimal', 'Mínimo']], show: function (c) { return c.arrows; } },
        { key: 'dots', label: 'Indicador inferior', type: 'seg', options: [['none', 'No'], ['dots', 'Puntos'], ['lines', 'Líneas'], ['fraction', '1 / 5']] },
        { key: 'menu', label: 'Menú superior (burbujas)', type: 'toggle' },
        {
          key: 'menuPos', label: 'Dónde va el menú', type: 'choices',
          options: [
            ['sticky', 'Fijo en la página', 'Va donde lo pongas; al bajar se fija arriba y la sección queda debajo.'],
            ['overlay', 'Fijo y transparente', 'Igual, pero encima de los slides, que ocupan el 100% de alto.'],
            ['anchor', 'Arriba, sin fijar', 'Un menú aparte que solo lleva a cada slide; no se fija.', { key: 'menuAlsoInside', label: 'Y también dentro de la sección' }],
            ['inside', 'Dentro de la sección', 'Arriba a la derecha, sobre los slides.']
          ],
          show: function (c) { return isFs(c) && c.menu; }
        },
        { key: 'shadows', label: 'Sombras de borde', type: 'toggle' }
      ]
    },
    {
      title: 'Efectos', fields: [
        { key: 'effects', label: 'Resto de items', type: 'chips', options: [['dim', 'Transparencia'], ['scale', 'Escala'], ['gray', 'Escala de grises']] },
        { key: 'effectOn', label: 'Se activa con', type: 'seg', options: [['hover', 'Hover'], ['active', 'Item activo']], show: function (c) { return c.effects.length > 0; } },
        { key: 'dim', label: 'Opacidad del resto', type: 'range', min: 0.1, max: 0.9, step: 0.05, show: has('dim') },
        { key: 'scale', label: 'Escala del destacado', type: 'range', min: 1, max: 1.2, step: 0.01, show: has('scale') }
      ]
    },
    {
      title: 'Responsive', fields: [
        {
          key: 'when', label: '¿Cuándo es slider?', type: 'seg',
          options: [['always', 'Siempre'], ['fits', 'Si no caben'], ['small', 'Según pantalla']],
          hideOption: function (c, v) { return v === 'fits' && !isCarousel(c); },
          get: whenOf,
          apply: function (v) {
            if (v === 'always') setMany({ below: 0, autoDisable: false });
            else if (v === 'fits') setMany({ below: 0, autoDisable: true });
            else setMany({ below: state.cfg.below || 699, autoDisable: true });
          },
          hint: function (c) {
            var w = whenOf(c);
            return w === 'always' ? 'Siempre con controles, aunque quepan todos los items.'
              : w === 'fits' ? 'Si todos los items caben, se muestran en fila, sin flechas ni puntos.'
                : 'Por encima de ' + c.below + ' px se muestra en columnas.';
          }
        },
        { key: 'staticAlign', label: 'Si caben, alinear a la', type: 'seg', options: [['start', 'Izquierda'], ['center', 'Centro']], show: function (c) { return whenOf(c) === 'fits'; } },
        { key: 'below', label: 'Es slider hasta', type: 'bp', show: function (c) { return whenOf(c) === 'small'; } },
        { key: 'columns', label: 'Columnas cuando no es slider', type: 'range', min: 1, max: 6, step: 1, show: function (c) { return whenOf(c) === 'small'; } },
        { key: 'perViewMobile', label: 'Items por vista en móvil', type: 'range', min: 0, max: 4, step: 1, show: function (c) { return isCarousel(c) && c.sizing === 'perview'; }, format: function (v) { return v ? v : 'Igual'; }, hint: function (c) { return c.perViewMobile ? '' : 'Los mismos que en desktop.'; } },
        { key: 'mobileBp', label: 'Se considera móvil hasta', type: 'bp', show: function (c) { return isCarousel(c) && c.sizing === 'perview' && c.perViewMobile > 0; } }
      ]
    },
  ];

  /** Cuándo es slider: siempre, solo si no caben, o solo en pantallas pequeñas. */
  function whenOf(c) {
    if (c.below > 0) return 'small';
    return isCarousel(c) && c.autoDisable ? 'fits' : 'always';
  }

  /* Breakpoints habituales: [nombre, px, variable $screen-*] */
  var BPS = [
    ['Desktop', 1366, 'md'],
    ['Desktop S', 1025, 'sm'],
    ['Tablet', 769, 'ms'],
    ['Mobile', 699, 'xs'],
    ['Mobile S', 360, 'xxs'],
    ['Mobile XS', 320, 'xxxs']
  ];
  var DEVICES = BPS;

  /* ---------------- estado ---------------- */

  var saved = load();
  var state = {
    sliders: saved.sliders,
    active: saved.active,
    cfg: saved.sliders[saved.active],
    width: +(localStorage.getItem(STORE + ':width') || 1366),
    states: {},
    scrollY: 0
  };

  /** Admite el formato actual ({sliders, active}) y el antiguo (una sola config). */
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (raw && Array.isArray(raw.sliders) && raw.sliders.length) {
        var sliders = raw.sliders.map(function (c) { return P.normalize(c); });
        return { sliders: sliders, active: Math.min(sliders.length - 1, Math.max(0, raw.active | 0)) };
      }
      if (raw && typeof raw === 'object') return { sliders: [P.normalize(raw)], active: 0 };
    } catch (e) { /* ignore */ }
    return { sliders: [P.applyPreset('classic')], active: 0 };
  }

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ sliders: state.sliders, active: state.active }));
      localStorage.setItem(STORE + ':width', String(state.width));
    } catch (e) { /* ignore */ }
  }

  function currentId() { return G.ids(state.sliders)[state.active]; }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  function h(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  /** Varios cambios de una vez (un solo repintado). */
  function setMany(obj) {
    Object.keys(obj).forEach(function (k) { state.cfg[k] = obj[k]; });
    markPreset('');
    sync();
    save();
    schedulePreview();
  }

  function set(key, value, opts) {
    state.cfg[key] = value;
    if (!(opts && opts.keepPreset)) markPreset('');
    if (key === 'id' || key === 'name') renderSliders();
    sync();
    save();
    schedulePreview();
  }

  /* ---------------- controles ---------------- */

  var bindings = []; // {field, section, el, update()}

  function fmt(f, v) {
    if (f.format) return f.format(v);
    var s = Math.round(v * 100) / 100;
    return s + (f.unit ? ' ' + f.unit : '');
  }

  function fieldEl(f) {
    var id = 'f-' + f.key + '-' + Math.random().toString(36).slice(2, 6);
    var wrap = h('div', { class: 'field', 'data-field': f.key });
    var label = h('label', { class: 'field__label', for: id }, [h('span', { text: f.label || '' })]);
    var hint = h('p', { class: 'field__hint' });
    var update;

    if (f.type === 'range') {
      var out = h('output');
      label.appendChild(out);
      var input = h('input', { type: 'range', id: id, min: f.min, max: f.max, step: f.step, 'aria-label': f.label });
      input.addEventListener('input', function () { set(f.key, parseFloat(input.value)); });
      var nudge = function (dir) {
        set(f.key, stepValue(state.cfg[f.key], dir, f.step, f.min, f.max));
      };
      wrap.append(label, rangeRow(input, f.label, nudge));
      update = function (c) { input.value = c[f.key]; out.textContent = fmt(f, c[f.key]); };
    } else if (f.type === 'toggle') {
      wrap.classList.add('field--row');
      var cb = h('input', { type: 'checkbox', id: id, role: 'switch' });
      cb.addEventListener('change', function () { set(f.key, cb.checked); });
      wrap.append(label, h('span', { class: 'switch' }, [cb, h('span')]));
      update = function (c) { cb.checked = !!c[f.key]; };
    } else if (f.type === 'seg') {
      var seg = h('div', { class: 'seg', role: 'group', 'aria-label': f.label || f.key });
      var btns = f.options.map(function (o) {
        var b = h('button', { type: 'button', 'data-value': o[0], text: o[1] });
        b.addEventListener('click', function () { if (f.apply) f.apply(o[0]); else set(f.key, o[0]); });
        seg.appendChild(b);
        return b;
      });
      if (f.label) wrap.appendChild(h('div', { class: 'field__label' }, [h('span', { text: f.label })]));
      wrap.appendChild(seg);
      update = function (c) {
        var v = f.get ? f.get(c) : c[f.key];
        btns.forEach(function (b, i) {
          b.setAttribute('aria-pressed', String(f.options[i][0] === v));
          b.hidden = !!(f.hideOption && f.hideOption(c, f.options[i][0]));
        });
      };
    } else if (f.type === 'choices') {
      var list = h('div', { class: 'choices', role: 'radiogroup', 'aria-label': f.label });
      var extras = [];
      var cbs = f.options.map(function (o) {
        var b = h('div', { role: 'radio', tabindex: '0', 'data-value': o[0], class: 'choice' },
          [h('strong', { text: o[1] }), h('span', { text: o[2] })]);
        b.addEventListener('click', function (e) {
          if (e.target.closest('.choice__extra')) return;
          if (state.cfg[f.key] !== o[0]) set(f.key, o[0]);
        });
        b.addEventListener('keydown', function (e) {
          if ((e.key === 'Enter' || e.key === ' ') && e.target === b) { e.preventDefault(); set(f.key, o[0]); }
        });
        // Opción extra (interruptor) que solo aparece dentro de la tarjeta elegida
        if (o[3]) {
          var xid = id + '-' + o[3].key;
          var cb = h('input', { type: 'checkbox', role: 'switch', id: xid });
          cb.addEventListener('change', function () { set(o[3].key, cb.checked); });
          var extra = h('label', { class: 'choice__extra', for: xid, 'data-field': o[3].key },
            [h('span', { text: o[3].label }), h('span', { class: 'switch' }, [cb, h('span')])]);
          b.appendChild(extra);
          extras.push({ el: extra, input: cb, key: o[3].key, value: o[0] });
        }
        list.appendChild(b);
        return b;
      });
      wrap.append(h('div', { class: 'field__label' }, [h('span', { text: f.label })]), list);
      update = function (c) {
        cbs.forEach(function (b, i) { b.setAttribute('aria-checked', String(f.options[i][0] === c[f.key])); });
        extras.forEach(function (x) { x.el.hidden = c[f.key] !== x.value; x.input.checked = !!c[x.key]; });
      };
    } else if (f.type === 'chips') {
      var chips = h('div', { class: 'chips', role: 'group', 'aria-label': f.label });
      var cbtns = f.options.map(function (o) {
        var b = h('button', { type: 'button', 'data-value': o[0], text: o[1] });
        b.addEventListener('click', function () {
          var list = state.cfg[f.key].slice();
          var i = list.indexOf(o[0]);
          if (i === -1) list.push(o[0]); else list.splice(i, 1);
          set(f.key, list);
        });
        chips.appendChild(b);
        return b;
      });
      wrap.append(h('div', { class: 'field__label' }, [h('span', { text: f.label })]), chips);
      update = function (c) {
        cbtns.forEach(function (b, i) { b.setAttribute('aria-pressed', String(c[f.key].indexOf(f.options[i][0]) !== -1)); });
      };
    } else if (f.type === 'text') {
      var t = h('input', { type: 'text', id: id, autocomplete: 'off' });
      t.addEventListener('input', function () { set(f.key, t.value); });
      wrap.append(label, t);
      update = function (c) {
        if (document.activeElement !== t) t.value = c[f.key];
        if (f.placeholder) t.placeholder = f.placeholder(c);
      };
    } else if (f.type === 'color') {
      wrap.classList.add('field--row');
      var col = h('input', { type: 'color', id: id });
      col.addEventListener('input', function () { set(f.key, col.value); });
      wrap.append(label, col);
      update = function (c) { col.value = c[f.key]; };
    } else if (f.type === 'bp') {
      var sel = h('select', { id: id, 'aria-label': f.label });
      BPS.forEach(function (b) {
        sel.appendChild(h('option', { value: b[1], text: b[0] + ' · ' + b[1] + ' px', title: '$screen-' + b[2] }));
      });
      sel.appendChild(h('option', { value: 'custom', text: 'Personalizado…' }));
      var num = h('input', { type: 'number', min: 1, max: 4000, step: 1, placeholder: 'px', 'aria-label': 'Ancho personalizado en px' });
      sel.addEventListener('change', function () {
        if (sel.value === 'custom') { num.hidden = false; num.focus(); return; }
        set(f.key, +sel.value);
      });
      num.addEventListener('input', function () { var v = parseInt(num.value, 10); if (v > 0) set(f.key, v); });
      wrap.append(label, h('div', { class: 'bp' }, [sel, num]));
      update = function (c) {
        var v = c[f.key];
        var named = BPS.some(function (b) { return b[1] === v; });
        if (document.activeElement !== sel) sel.value = named ? String(v) : 'custom';
        num.hidden = named && document.activeElement !== num;
        if (document.activeElement !== num) num.value = v || '';
      };
    }

    wrap.appendChild(hint);
    return {
      field: f, el: wrap, update: function (c) {
        update(c);
        var text = typeof f.hint === 'function' ? f.hint(c) : f.hint;
        hint.textContent = text || '';
        hint.hidden = !text;
      }
    };
  }

  /** Suma / resta un paso respetando límites y sin errores de coma flotante. */
  function stepValue(v, dir, step, min, max) {
    var dec = (String(step).split('.')[1] || '').length;
    var next = Math.round((v + dir * step) / step) * step;
    return +Math.min(max, Math.max(min, next)).toFixed(dec);
  }

  /** [-] [====o====] [+] */
  function rangeRow(input, label, nudge) {
    var minus = h('button', { type: 'button', class: 'step-btn', 'aria-label': 'Restar a ' + label, text: '−' });
    var plus = h('button', { type: 'button', class: 'step-btn', 'aria-label': 'Sumar a ' + label, text: '+' });
    holdRepeat(minus, function () { nudge(-1); });
    holdRepeat(plus, function () { nudge(1); });
    return h('div', { class: 'range-row' }, [minus, input, plus]);
  }

  /** Click = un paso; mantener pulsado = repetir. */
  function holdRepeat(btn, fn) {
    var t1, t2;
    var stop = function () { clearTimeout(t1); clearInterval(t2); };
    btn.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      fn();
      t1 = setTimeout(function () { t2 = setInterval(fn, 70); }, 380);
    });
    ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(function (ev) { btn.addEventListener(ev, stop); });
    btn.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
  }

  function renderControls() {
    var root = $('#controls');
    root.innerHTML = '';
    bindings = [];
    SCHEMA.forEach(function (sec) {
      var det = h('details', { class: 'block', open: sec.open ? true : false });
      det.appendChild(h('summary', null, [h('h2', { class: 'block__title', text: sec.title })]));
      var fields = h('div', { class: 'fields' });
      sec.fields.forEach(function (f) {
        var b = fieldEl(f);
        bindings.push(b);
        fields.appendChild(b.el);
      });
      det.appendChild(fields);
      root.appendChild(det);
      bindings.push({ section: sec, el: det, update: function () {} });
    });
  }

  function sync() {
    var c = state.cfg;
    bindings.forEach(function (b) {
      if (b.section) { b.el.hidden = b.section.show ? !b.section.show(c) : false; return; }
      b.update(c);
      b.el.hidden = b.field.show ? !b.field.show(c) : false;
    });
    renderItemsMeta();
  }

  /* ---------------- presets ---------------- */

  function renderPresets() {
    var root = $('#presets');
    root.innerHTML = '';
    P.PRESETS.forEach(function (p) {
      var b = h('button', { type: 'button', class: 'preset', 'data-preset': p.id }, [h('strong', { text: p.name }), h('span', { text: p.desc })]);
      b.addEventListener('click', function () {
        var c = P.applyPreset(p.id);
        c.id = state.cfg.id;
        c.name = state.cfg.name;
        c.items = itemsForPreset(c.items.length);
        c.pool = c.items.__pool;
        state.sliders[state.active] = c;
        state.cfg = c;
        markPreset(p.id);
        renderItems();
        sync();
        save();
        schedulePreview();
      });
      root.appendChild(b);
    });
    markPreset(state.cfg.preset);
  }

  /**
   * Items al cambiar de preset: tantos como pida el preset. Se conservan los del usuario
   * y los que sobran se guardan (pool) para recuperarlos si vuelves a un preset con más.
   */
  function itemsForPreset(count) {
    var cur = state.cfg.items;
    var pool = cur.concat((state.cfg.pool || []).slice(cur.length));
    var offset = state.active * 3;
    while (pool.length < count) {
      var it = P.makeItem(pool.length + offset);
      it.color = P.PALETTE[(pool.length + offset) % P.PALETTE.length];
      pool.push(it);
    }
    var items = pool.slice(0, count);
    Object.defineProperty(items, '__pool', { value: pool, enumerable: false });
    return items;
  }

  function markPreset(id) {
    state.cfg.preset = id || '';
    document.querySelectorAll('.preset').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.preset === id);
    });
  }

  /* ---------------- varios sliders ---------------- */

  function renderSliders() {
    var root = $('#sliders');
    root.innerHTML = '';
    var idList = G.ids(state.sliders);
    var many = state.sliders.length > 1;
    state.sliders.forEach(function (c, i) {
      var main = h('button', {
        type: 'button', class: 'slider-tab__main', 'aria-pressed': String(i === state.active),
        title: '#' + idList[i] + ' · arrastra para ordenar'
      }, [h('span', { class: 'grip', 'aria-hidden': 'true', html: GRIP }), sliderName(i)]);
      main.addEventListener('click', function () { select(i, { scroll: true }); });
      var tab = h('div', { class: 'slider-tab' + (i === state.active ? ' is-active' : ''), 'data-index': i }, [main]);
      if (many) {
        var del = h('button', { type: 'button', class: 'slider-tab__del', 'aria-label': 'Eliminar ' + sliderName(i), title: 'Eliminar', text: '×' });
        del.addEventListener('click', function () { askRemoveSlider(i); });
        tab.appendChild(del);
      }
      root.appendChild(tab);
    });
    var add = h('button', { type: 'button', class: 'slider-add', id: 'slider-add', text: '+ Añadir' });
    add.addEventListener('click', addSlider);
    root.appendChild(add);
  }

  function sliderName(i) {
    var n = (state.sliders[i].name || '').trim();
    return n || 'Slider ' + (i + 1);
  }

  function select(i, opts) {
    if (i < 0 || i >= state.sliders.length) return;
    state.active = i;
    // Desde el panel llevamos la vista previa hasta ese slider; desde la vista previa no.
    if (opts && opts.scroll && state.sliders.length > 1) state.scrollSlot = i;
    state.cfg = state.sliders[i];
    markPreset(state.cfg.preset);
    renderSliders();
    renderItems();
    sync();
    save();
    setStatus(state.states[currentId()]);
    schedulePreview();
  }

  function addSlider() {
    var n = state.sliders.length;
    var c = P.applyPreset('classic');
    var taken = G.ids(state.sliders);
    var k = n + 1;
    while (taken.indexOf('slider-' + k) !== -1) k++;
    c.id = 'slider-' + k;
    c.items = P.makeItemsFrom(6, n * 3);
    state.sliders.push(c);
    select(n, { scroll: true });
  }

  function moveSlider(from, to) {
    var cfg = state.cfg;
    state.sliders.splice(to, 0, state.sliders.splice(from, 1)[0]);
    state.active = state.sliders.indexOf(cfg);
    renderSliders();
    save();
    schedulePreview();
  }

  function moveItem(from, to) {
    var items = state.cfg.items;
    items.splice(to, 0, items.splice(from, 1)[0]);
    renderItems();
    set('items', items, { keepPreset: true });
  }

  /* ---------------- ordenar arrastrando ---------------- */

  var GRIP = '<svg viewBox="0 0 10 16" width="8" height="13" aria-hidden="true"><g fill="currentColor"><circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/></g></svg>';
  var MOVE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 2l3 3h-2v6h6V9l3 3-3 3v-2h-6v6h2l-3 3-3-3h2v-6H5v2l-3-3 3-3v2h6V5H9z" fill="currentColor"/></svg>';

  /**
   * Ordenar arrastrando (ratón y dedo). Mientras arrastras, el elemento flota con un
   * icono de mover a la izquierda y una sombra marca dónde va a caer.
   * opts: { items: selector, handle?: selector, axis: 'y' | 'wrap', onSort(from, to) }
   */
  function sortable(container, opts) {
    var children = function () {
      return Array.prototype.filter.call(container.children, function (c) { return c.matches(opts.items); });
    };
    container.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var el = e.target.closest(opts.items);
      if (!el || el.parentNode !== container) return;
      if (opts.handle && !e.target.closest(opts.handle)) return;
      if (opts.ignore && e.target.closest(opts.ignore)) return;
      if (e.target.closest('input, textarea, select')) return;
      var x0 = e.clientX;
      var y0 = e.clientY;
      var d = null;
      var move = function (ev) {
        if (!d) {
          if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 6) return;
          d = start(el, ev);
        }
        ev.preventDefault();
        d.ghost.style.transform = 'translate(' + (ev.clientX - d.offX) + 'px,' + (ev.clientY - d.offY) + 'px)';
        place(d, ev.clientX, ev.clientY);
      };
      var up = function () {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        if (d) finish(d);
      };
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });

    function start(el, ev) {
      var r = el.getBoundingClientRect();
      var ph = document.createElement(el.tagName);
      ph.className = 'sort-placeholder';
      ph.style.width = r.width + 'px';
      ph.style.height = r.height + 'px';
      var ghost = el.cloneNode(true);
      ghost.removeAttribute('id');
      ghost.classList.add('sort-ghost');
      ghost.style.width = r.width + 'px';
      ghost.style.height = r.height + 'px';
      ghost.appendChild(h('span', { class: 'sort-ghost__icon', html: MOVE }));
      document.body.appendChild(ghost);
      var from = children().indexOf(el);
      container.insertBefore(ph, el);
      el.style.display = 'none';
      document.body.classList.add('is-sorting');
      return { el: el, ph: ph, ghost: ghost, from: from, offX: ev.clientX - r.left, offY: ev.clientY - r.top };
    }

    function place(d, x, y) {
      var others = children().filter(function (c) { return c !== d.el; });
      for (var i = 0; i < others.length; i++) {
        var r = others[i].getBoundingClientRect();
        var before = opts.axis === 'y'
          ? y < r.top + r.height / 2
          : y < r.top || (y <= r.bottom && x < r.left + r.width / 2);
        if (before) {
          if (others[i].previousElementSibling !== d.ph) container.insertBefore(d.ph, others[i]);
          return;
        }
      }
      var last = others[others.length - 1];
      if (last && last.nextElementSibling !== d.ph) container.insertBefore(d.ph, last.nextSibling);
    }

    function finish(d) {
      var seq = Array.prototype.filter.call(container.children, function (c) {
        return c === d.ph || (c.matches(opts.items) && c !== d.el);
      });
      var to = seq.indexOf(d.ph);
      container.replaceChild(d.el, d.ph);
      d.el.style.display = '';
      d.ghost.remove();
      document.body.classList.remove('is-sorting');
      // El click que llega tras soltar no debe seleccionar nada.
      var stop = function (ev) { ev.stopPropagation(); ev.preventDefault(); };
      container.addEventListener('click', stop, true);
      setTimeout(function () { container.removeEventListener('click', stop, true); }, 0);
      if (to !== d.from) opts.onSort(d.from, to);
    }
  }

  function askRemoveSlider(i) {
    confirmDialog('¿Eliminar «' + sliderName(i) + '»?', 'Se borrarán sus opciones y sus items. No se puede deshacer.', 'Eliminar')
      .then(function (ok) { if (ok) removeSlider(i); });
  }

  function removeSlider(i) {
    if (state.sliders.length < 2) return;
    var cfg = state.cfg;
    state.sliders.splice(i, 1);
    var next = state.sliders.indexOf(cfg);
    select(next === -1 ? Math.max(0, Math.min(i, state.sliders.length - 1)) : next);
  }

  /** Diálogo de confirmación propio (no el confirm() del navegador). */
  function confirmDialog(title, text, action) {
    var d = $('#confirm-dialog');
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    $('#confirm-ok').textContent = action || 'Aceptar';
    d.returnValue = '';
    d.showModal();
    $('#confirm-cancel').focus();
    return new Promise(function (resolve) {
      d.addEventListener('close', function () { resolve(d.returnValue === 'ok'); }, { once: true });
    });
  }

  /* ---------------- items ---------------- */

  function renderItems() {
    var list = $('#items');
    list.innerHTML = '';
    state.cfg.items.forEach(function (it, i) {
      var color = h('input', { type: 'color', value: it.color, 'aria-label': 'Color del item ' + (i + 1) });
      color.addEventListener('input', function () { it.color = color.value; set('items', state.cfg.items, { keepPreset: true }); });
      var title = h('input', { type: 'text', value: it.title, 'aria-label': 'Título del item ' + (i + 1) });
      title.addEventListener('input', function () { it.title = title.value; set('items', state.cfg.items, { keepPreset: true }); });
      var text = h('input', { type: 'text', class: 'item__text', value: it.text, 'aria-label': 'Texto del item ' + (i + 1) });
      text.addEventListener('input', function () { it.text = text.value; set('items', state.cfg.items, { keepPreset: true }); });
      var link = h('button', { type: 'button', class: 'icon-btn', title: 'Es un enlace (click)', 'aria-label': 'Enlace en item ' + (i + 1), 'aria-pressed': String(it.link), text: '↗' });
      link.addEventListener('click', function () { it.link = !it.link; link.setAttribute('aria-pressed', String(it.link)); set('items', state.cfg.items, { keepPreset: true }); });
      var del = h('button', { type: 'button', class: 'icon-btn', title: 'Eliminar', 'aria-label': 'Eliminar item ' + (i + 1), text: '✕' });
      del.addEventListener('click', function () { removeItem(i); });
      var grip = h('span', { class: 'item__grip', title: 'Arrastra para ordenar', 'aria-hidden': 'true', html: GRIP });
      list.appendChild(h('li', { class: 'item' }, [
        grip,
        color,
        h('div', { class: 'item__inputs' }, [title, text]),
        h('div', { class: 'item__actions' }, [link, del])
      ]));
    });
    renderItemsMeta();
  }

  function renderItemsMeta() {
    var n = state.cfg.items.length;
    $('#items-count').textContent = String(n);
    $('#item-remove').disabled = n <= 1;
    $('#item-add').disabled = n >= 30;
  }

  function addItem() {
    if (state.cfg.items.length >= 30) return;
    state.cfg.items.push(P.makeItem(state.cfg.items.length));
    renderItems();
    set('items', state.cfg.items, { keepPreset: true });
  }

  function removeItem(i) {
    if (state.cfg.items.length <= 1) return;
    state.cfg.items.splice(i === undefined ? state.cfg.items.length - 1 : i, 1);
    renderItems();
    set('items', state.cfg.items, { keepPreset: true });
  }

  /* ---------------- vista previa ---------------- */

  var frame = $('#frame');
  var iframe = $('#preview');
  var canvas = $('#canvas');
  var timer;

  function schedulePreview(resetScroll) {
    if (resetScroll) state.scrollY = 0;
    clearTimeout(timer);
    timer = setTimeout(renderPreview, 120);
  }

  function renderPreview() {
    // La posición se lee del propio iframe: el evento de scroll llega un fotograma
    // tarde y, si la vista previa se recargaba antes, se perdía y volvía arriba.
    try { if (iframe.contentWindow && iframe.contentDocument.body) state.scrollY = iframe.contentWindow.scrollY; } catch (e) { /* file:// */ }
    var slot = state.scrollSlot;
    state.scrollSlot = null;
    iframe.srcdoc = G.previewDoc(state.sliders, state.active, slot != null ? { slot: slot } : { y: state.scrollY });
  }

  function fitFrame() {
    var availW = canvas.clientWidth - 32;
    var availH = canvas.clientHeight - 32;
    var w = state.width;
    var scale = Math.min(1, availW / w);
    frame.style.width = Math.round(w * scale) + 'px';
    frame.style.height = availH + 'px';
    iframe.style.width = w + 'px';
    iframe.style.height = Math.round(availH / scale) + 'px';
    iframe.style.transform = scale < 1 ? 'scale(' + scale + ')' : '';
    $('#width-out').textContent = w + ' px' + (scale < 1 ? ' · ' + Math.round(scale * 100) + '%' : '');
    $('#width').value = w;
    document.querySelectorAll('#devices button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(+b.dataset.width === w));
    });
  }

  function renderDevices() {
    var root = $('#devices');
    DEVICES.forEach(function (d) {
      var b = h('button', { type: 'button', 'data-width': d[1], text: d[0], title: d[1] + ' px · $screen-' + d[2] });
      b.addEventListener('click', function () { setWidth(d[1]); });
      root.appendChild(b);
    });
    var wr = $('#width');
    wr.parentNode.replaceChild(rangeRow(wr.cloneNode(true), 'ancho de la vista previa', function (dir) {
      setWidth(stepValue(state.width, dir, 10, 320, 1600));
    }), wr);
    $('#width').addEventListener('input', function (e) { setWidth(+e.target.value); });
  }

  function setWidth(w) {
    state.width = w;
    fitFrame();
    save();
  }

  function setStatus(s) {
    var el = $('#status');
    if (!s) { el.dataset.kind = ''; el.textContent = 'Cargando…'; return; }
    var prefix = state.sliders.length > 1 ? 'Slider ' + (state.active + 1) + ' · ' : '';
    if (s.isStatic) {
      el.dataset.kind = 'static';
      el.textContent = prefix + (s.staticReason === 'fits' ? 'Sin slider · los items caben'
        : s.staticReason === 'breakpoint' ? 'Sin slider · columnas por encima de ' + state.cfg.below + 'px'
          : 'Sin items');
    } else {
      el.dataset.kind = 'slider';
      el.textContent = prefix + 'Slider activo · ' + (s.page + 1) + ' / ' + s.pages;
    }
  }

  window.addEventListener('message', function (e) {
    if (e.source !== iframe.contentWindow || !e.data) return;
    if (e.data.type === 'v-sb-state') {
      state.states[e.data.id] = e.data.state;
      if (e.data.id === currentId()) setStatus(e.data.state);
    } else if (e.data.type === 'v-sb-select') select(e.data.index);
    else if (e.data.type === 'v-sb-scrolled') state.scrollY = e.data.y;
  });

  /* ---------------- exportación ---------------- */

  var dialog = $('#export-dialog');
  var tab = 'html';
  var FILES = {
    html: function () { return G.exportHTML(state.sliders); },
    css: function () { return G.exportCSS(state.sliders); },
    js: function () { return G.exportJS(state.sliders); },
    single: function () { return G.exportAll(state.sliders, { inlineJs: $('#inline-js').checked }); }
  };

  function showTab(t) {
    tab = t;
    var code = FILES[t]();
    $('#export-code').textContent = code;
    $('#export-meta').textContent = (new Blob([code]).size / 1024).toFixed(1) + ' KB · JS: ' +
      G.modulesFor(state.sliders).map(function (m) { return 'sliderBuilder-' + m + '.js'; }).join(', ');
    $('#inline-js-wrap').hidden = t !== 'single';
    document.querySelectorAll('#export-tabs .tab').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.tab === t));
    });
  }

  function download(name, type, content) {
    var url = URL.createObjectURL(new Blob([content], { type: type + ';charset=utf-8' }));
    var a = h('a', { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    // Un <dialog> abierto tapa todo lo demás: el toast tiene que vivir dentro.
    var host = dialog.open ? dialog : document.body;
    if (t.parentNode !== host) host.appendChild(t);
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }

  function bindExport() {
    $('#btn-export').addEventListener('click', function () { showTab(tab); dialog.showModal(); });
    dialog.querySelector('[data-close]').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
    document.querySelectorAll('#export-tabs .tab').forEach(function (b) {
      b.addEventListener('click', function () { showTab(b.dataset.tab); });
    });
    $('#inline-js').addEventListener('change', function () { showTab(tab); });
    $('#btn-download').addEventListener('click', function () {
      var zip = window.SBZip.create(G.exportFiles(state.sliders));
      var url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
      var a = h('a', { href: url, download: 'sliderBuilder.zip' });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast('Descargado sliderBuilder.zip');
    });
    $('#btn-copy').addEventListener('click', function () {
      var text = FILES[tab]();
      var btn = $('#btn-copy');
      var done = function (msg) {
        btn.textContent = msg;
        btn.classList.add('is-done');
        toast(msg);
        setTimeout(function () { btn.textContent = 'Copiar'; btn.classList.remove('is-done'); }, 1600);
      };
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
        .then(function () { done('Copiado ✓'); })
        .catch(function () {
          var r = document.createRange(); r.selectNodeContents($('#export-code'));
          var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
          done('Seleccionado: pulsa Ctrl+C');
        });
    });
  }

  /* ---------------- init ---------------- */

  $('#item-add').addEventListener('click', addItem);
  sortable($('#sliders'), { items: '.slider-tab', ignore: '.slider-tab__del', axis: 'wrap', onSort: moveSlider });
  sortable($('#items'), { items: '.item', handle: '.item__grip', axis: 'y', onSort: moveItem });
  $('#item-remove').addEventListener('click', function () { removeItem(); });
  $('#btn-reset').addEventListener('click', function () {
    confirmDialog('¿Restablecer todo?', 'Se borrarán todos los sliders, sus opciones y sus items, y volverás a la configuración inicial. No se puede deshacer.', 'Restablecer')
      .then(function (ok) { if (ok) resetAll(); });
  });

  function resetAll() {
    state.sliders = [P.applyPreset('classic')];
    state.active = 0;
    state.cfg = state.sliders[0];
    state.states = {};
    markPreset('classic');
    renderSliders();
    renderItems();
    sync();
    save();
    schedulePreview(true);
  }

  renderSliders();
  renderPresets();
  renderControls();
  renderItems();
  renderDevices();
  bindExport();
  sync();
  fitFrame();
  renderPreview();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fitFrame).observe(canvas);
  else window.addEventListener('resize', fitFrame);

  // Acceso para tests / depuración.
  window.SBApp = { schema: SCHEMA, state: state, set: set, select: select, addSlider: addSlider, moveSlider: moveSlider, moveItem: moveItem, addItem: addItem, removeItem: removeItem, preview: iframe };
})();
