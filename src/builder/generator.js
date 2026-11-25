/* Genera el código exportable (y la página de vista previa) a partir de una o varias configuraciones. */
(function (g) {
  'use strict';

  var ORDER = ['core', 'drag', 'menu', 'fullscreen', 'autoplay'];

  function assets() {
    var a = g.SB_ASSETS || {};
    return { modules: a.modules || {}, cssParts: a.cssParts || [] };
  }

  function list(x) { return Array.isArray(x) ? x : [x]; }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function slug(s) {
    return String(s || 'slider').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^(\d)/, 's-$1') || 'slider';
  }

  /** Ids únicos y válidos para cada slider. */
  function ids(sliders) {
    var used = {};
    return list(sliders).map(function (cfg) {
      var base = slug(cfg.id);
      var id = base;
      var k = 2;
      while (used[id]) id = base + '-' + k++;
      used[id] = true;
      return id;
    });
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  /* ---------------- opciones del runtime ---------------- */

  /** Todas las opciones del runtime relevantes para esta configuración. */
  function runtimeOptions(cfg, id) {
    var fs = cfg.mode === 'fullscreen';
    var o = { mode: cfg.mode };
    if (fs) {
      o.fsTransition = cfg.fsTransition;
      o.fsLength = cfg.fsLength;
      o.fsWidth = cfg.fsWidth;
      if (outerMenu(cfg)) {
        o.top = '#' + id + '-menu';
        o.topMode = cfg.menuPos;
        if (cfg.menuPos === 'anchor' && cfg.menuAlsoInside) o.menuInside = true;
      }
      o.align = cfg.fsWidth < 100 ? cfg.align : 'start';
      o.gap = cfg.fsWidth < 100 ? cfg.gap : 0; // a pantalla completa el gap por defecto es 0
    } else {
      o.sizing = cfg.sizing;
      if (cfg.sizing === 'fixed') o.itemWidth = cfg.itemWidth;
      else {
        o.perView = cfg.perView;
        o.perViewMobile = cfg.perViewMobile;
        if (cfg.perViewMobile > 0) o.mobileBp = cfg.mobileBp;
      }
      o.gap = cfg.gap;
      if (cfg.sizing !== 'fixed') o.peek = cfg.peek;
      o.align = cfg.align;
      o.step = cfg.step;
      o.loop = cfg.loop;
      o.autoDisable = cfg.autoDisable;
      o.autoplay = cfg.autoplay;
    }
    o.speed = cfg.speed;
    o.drag = cfg.drag;
    o.arrows = cfg.arrows;
    if (cfg.arrows) { o.arrowsPos = cfg.arrowsPos; o.arrowStyle = cfg.arrowStyle; }
    o.dots = cfg.dots;
    o.menu = cfg.menu;
    o.shadows = cfg.shadows;
    if (cfg.effects && cfg.effects.length) { o.effect = cfg.effects.join(' '); o.effectOn = cfg.effectOn; }
    o.below = cfg.below;
    if (cfg.below > 0) o.columns = cfg.columns;
    return o;
  }

  /** Solo las opciones que cambian respecto a los valores por defecto del runtime (según el modo). */
  function initOptions(cfg, id) {
    var all = runtimeOptions(cfg, id || slug(cfg.id));
    var SB = g.SliderBuilder;
    var defs = SB ? (SB.defaultsFor ? SB.defaultsFor(cfg.mode) : SB.defaults) : {};
    if (SB) defs.mode = SB.defaults.mode; // el modo se escribe siempre que no sea el de por defecto
    var out = {};
    Object.keys(all).forEach(function (k) { if (all[k] !== defs[k]) out[k] = all[k]; });
    return out;
  }

  function jsValue(v) {
    if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '\\x3c') + "'";
    return String(v);
  }

  /** Llamadas a init: sin opciones si todo está por defecto. */
  function initCalls(sliders) {
    var all = list(sliders);
    var idList = ids(all);
    return all.map(function (cfg, i) {
      var o = initOptions(cfg, idList[i]);
      var keys = Object.keys(o);
      if (!keys.length) return "    SliderBuilder.init('#" + idList[i] + "');";
      var body = '{\n' + keys.map(function (k) { return '      ' + k + ': ' + jsValue(o[k]); }).join(',\n') + '\n    }';
      return "    SliderBuilder.init('#" + idList[i] + "', " + body + ');';
    }).join('\n');
  }

  /** Encapsulado en una IIFE: convive con otros scripts (puedes añadir código antes o después). */
  function initScript(sliders) {
    return '<script>\n  (function () {\n' + initCalls(sliders) + '\n  })();\n</script>';
  }

  /* ---------------- HTML ---------------- */

  function itemHTML(item, i, cfg, ind) {
    var fs = cfg.mode === 'fullscreen';
    var tag = item.link ? 'a' : 'div';
    var href = item.link ? ' href="#' + slug(item.title) + '"' : '';
    var lines = [
      ind + '<article class="v-sb-item" data-sb-label="' + esc(item.title) + '">',
      ind + '  <' + tag + ' class="v-sb-card"' + href + ' style="--v-sb-card-bg: ' + esc(item.color) + '">',
      ind + '    <span class="v-sb-card__tag">' + (fs ? 'Episodio ' : '') + pad2(i + 1) + '</span>',
      ind + '    <h3 class="v-sb-card__title">' + esc(item.title) + '</h3>',
      ind + '    <p class="v-sb-card__text">' + esc(item.text) + '</p>'
    ];
    if (fs) lines.push(ind + '    <span class="v-sb-card__cta">' + (item.link ? 'Escuchar episodio →' : 'Episodio ' + (i + 1)) + '</span>');
    lines.push(ind + '  </' + tag + '>', ind + '</article>');
    return lines.join('\n');
  }

  /** El slider en sí: <div class="v-sb"> (o <section> a pantalla completa). */
  function sliderHTML(cfg, id) {
    id = id || slug(cfg.id);
    var fs = cfg.mode === 'fullscreen';
    var tag = fs ? 'section' : 'div';
    var ind = fs ? '        ' : '      ';
    var items = cfg.items.map(function (it, i) { return itemHTML(it, i, cfg, ind); }).join('\n');
    var label = esc((cfg.name || '').trim() || 'Slider');
    var out = '<' + tag + ' class="v-sb" id="' + id + '" aria-label="' + label + '">\n';
    if (fs) out += '  <div class="v-sb-pin">\n    <div class="v-sb-viewport">\n      <div class="v-sb-track">\n' + items + '\n      </div>\n    </div>\n  </div>\n';
    else out += '  <div class="v-sb-viewport">\n    <div class="v-sb-track">\n' + items + '\n    </div>\n  </div>\n';
    return out + '</' + tag + '>';
  }

  /** ¿Menú anexo fuera del slider? (pantalla completa con menú que no va dentro) */
  function outerMenu(cfg) {
    return cfg.mode === 'fullscreen' && cfg.menu && cfg.menuPos !== 'inside';
  }

  /** Hueco donde sliderBuilder-menu.js mete el menú de burbujas: ponlo donde quieras en la página. */
  function menuSlotHTML(id) {
    return '<div class="v-sb-top" id="' + id + '-menu"></div>';
  }

  function indent(s, pre) {
    return s.split('\n').map(function (l) { return l ? pre + l : l; }).join('\n');
  }

  /** Menú anexo (si lo hay) y, por separado, el slider. */
  function blockHTML(cfg, id, middle) {
    return [outerMenu(cfg) ? menuSlotHTML(id) : '', middle || '', sliderHTML(cfg, id)].filter(Boolean).join('\n\n');
  }

  function markup(sliders) {
    var all = list(sliders);
    var idList = ids(all);
    return all.map(function (cfg, i) { return blockHTML(cfg, idList[i]); }).join('\n\n');
  }

  /* ---------------- CSS ---------------- */

  var CARD_CSS = [
    '.v-sb-card {',
    '  position: relative; display: flex; flex-direction: column; justify-content: flex-end; gap: 6px;',
    '  height: var(--v-sb-card-h, 320px); padding: 24px; overflow: hidden;',
    '  border-radius: var(--v-sb-card-radius, 16px); color: #fff; text-decoration: none;',
    '  background: linear-gradient(145deg, var(--v-sb-card-bg), color-mix(in srgb, var(--v-sb-card-bg) 45%, #000));',
    '  -webkit-user-drag: none;',
    '}',
    '.v-sb-card::before {',
    '  content: ""; position: absolute; inset: auto -30% -40% auto; width: 70%; aspect-ratio: 1;',
    '  border-radius: 50%; background: rgba(255,255,255,.14);',
    '}',
    'a.v-sb-card:focus-visible { outline: 3px solid var(--v-sb-accent); outline-offset: 3px; }',
    '.v-sb-card__tag {',
    '  position: absolute; top: 18px; left: 18px; padding: 4px 10px; border-radius: 99px;',
    '  background: rgba(255,255,255,.2); font-size: 12px; font-weight: 600; letter-spacing: .04em;',
    '}',
    '.v-sb-card__title { margin: 0; font-size: 22px; line-height: 1.15; }',
    '.v-sb-card__text { margin: 0; font-size: 15px; opacity: .85; }'
  ].join('\n');

  var CARD_FS_CSS = [
    '.v-sb-card__cta { margin-top: 14px; font-weight: 600; }',
    '.v-sb--fs .v-sb-card { height: 100%; padding: clamp(24px, 6vw, 72px); padding-bottom: 96px; border-radius: var(--v-sb-card-radius-fs, 0); }',
    '.v-sb--fs .v-sb-card__title { font-size: clamp(32px, 6vw, 72px); max-width: 14ch; }',
    '.v-sb--fs .v-sb-card__text { font-size: clamp(16px, 1.6vw, 20px); max-width: 40ch; }',
    '.v-sb--fs .v-sb-card__tag { top: calc(24px + var(--v-sb-overlay-h, 0px)); left: clamp(24px, 6vw, 72px); }',
    '.v-sb--fs.v-sb--static .v-sb-card { min-height: 60vh; }'
  ].join('\n');

  var CARD_TOP_CSS = [
    '.v-sb-top { display: flex; justify-content: center; padding: 10px clamp(12px, 3vw, 32px); background: var(--v-sb-page-bg, #fff); border-bottom: 1px solid rgba(15,15,20,.08); }',
    '.v-sb-top .v-sb-menu { margin: 0; }'
  ].join('\n');

  /** Qué usa un slider, para llevarse solo los bloques de CSS que necesita (ver sliderBuilder.css). */
  function features(c) {
    var fs = c.mode === 'fullscreen';
    var f = { base: true };
    if (fs) f.fs = true;
    if (c.drag) f.drag = true;
    if (c.below > 0 || (!fs && c.autoDisable)) f['static'] = true;
    if (c.shadows) f.shadows = true;
    if (c.arrows) {
      f.arrows = true;
      f[c.arrowStyle] = true; // circle | square | minimal
      f[c.arrowsPos] = true;  // inside | outside | bottom
      if (c.arrowsPos !== 'bottom') f.side = true;
    }
    if (c.dots !== 'none') f[c.dots] = true; // dots | lines | fraction
    if (c.menu) {
      f.menu = true;
      if (fs) {
        f['menu-' + c.menuPos] = true; // sticky | overlay | anchor | inside
        if (outerMenu(c)) f['menu-top'] = true;
        if (c.menuPos === 'anchor' && c.menuAlsoInside) f['menu-inside'] = true;
      }
    }
    (c.effects || []).forEach(function (e) { f[e] = true; f[c.effectOn] = true; }); // dim | scale | gray, hover | active
    return f;
  }

  /** Condición de un bloque: "a&b|c" = (a y b) o c. */
  function matches(when, f) {
    return when.split('|').some(function (alt) {
      return alt.split('&').every(function (k) { return f[k.trim()]; });
    });
  }

  /** Variables de una instancia: solo las que difieren de los valores por defecto. */
  function instanceCSS(cfg, id) {
    var fs = cfg.mode === 'fullscreen';
    var vars = [
      ['--v-sb-dim', cfg.dim, 0.4],
      ['--v-sb-scale', cfg.scale, 1.05],
      ['--v-sb-static-justify', cfg.staticAlign === 'center' ? 'center' : 'flex-start', 'flex-start'],
      ['--v-sb-card-radius-fs', (fs && cfg.fsWidth < 100 ? 16 : 0) + 'px', '0px']
    ].filter(function (v) {
      if (v[0] === '--v-sb-dim' && cfg.effects.indexOf('dim') === -1) return false;
      if (v[0] === '--v-sb-scale' && cfg.effects.indexOf('scale') === -1) return false;
      return v[1] !== v[2];
    });
    if (!vars.length) return '';
    return '#' + id + ' {\n' + vars.map(function (v) { return '  ' + v[0] + ': ' + v[1] + ';'; }).join('\n') + '\n}';
  }

  /** Solo los estilos del slider (runtime + tarjetas + ajustes de cada instancia), sin comentarios. */
  function css(sliders) {
    var all = list(sliders);
    var idList = ids(all);
    var inst = all.map(function (cfg, i) { return instanceCSS(cfg, idList[i]); }).filter(Boolean).join('\n');
    var feats = all.map(features);
    var uses = function (when) { return feats.some(function (f) { return matches(when, f); }); };
    return assets().cssParts.filter(function (p) { return uses(p.when); }).map(function (p) { return p.css; }).join('') +
      CARD_CSS + '\n' +
      (uses('fs') ? CARD_FS_CSS + '\n' : '') +
      (uses('menu-top') ? CARD_TOP_CSS + '\n' : '') +
      (inst ? inst + '\n' : '');
  }

  /** CSS en una sola línea. */
  function minifyCss(src) {
    return src.replace(/\s+/g, ' ').replace(/\s*([{};,])\s*/g, '$1').replace(/;}/g, '}').trim();
  }

  /** Módulos que necesitan estos sliders (el núcleo siempre). */
  function modulesFor(sliders) {
    if (!sliders) return ORDER.slice();
    var all = list(sliders);
    var need = { core: true };
    all.forEach(function (c) {
      if (c.drag) need.drag = true;
      if (c.menu) need.menu = true;
      if (c.mode === 'fullscreen') need.fullscreen = true;
      if (c.mode !== 'fullscreen' && c.autoplay > 0) need.autoplay = true;
    });
    return ORDER.filter(function (m) { return need[m]; });
  }

  /** Código (sin comentarios) de un módulo; empieza por ';' para poder pegarse tras otro script. */
  function moduleCode(name) {
    var m = assets().modules[name];
    var src = m ? m.min : '';
    return src && src.charAt(0) !== ';' ? ';' + src : src;
  }

  /** Archivos .js que hacen falta: [{ name, content }]. Sin sliders: todos. */
  function jsFiles(sliders) {
    return modulesFor(sliders).map(function (m) { return { name: 'sliderBuilder-' + m + '.js', content: moduleCode(m) }; });
  }

  /** Todo el JS necesario concatenado (en orden: núcleo primero). */
  function js(sliders) {
    return jsFiles(sliders).map(function (f) { return f.content; }).join('');
  }

  /* ---------------- export ---------------- */

  function safeScript(s) { return s.replace(/<\/script/gi, '<\\/script'); }

  /** Pestaña HTML: el/los slider(s) + el script con sus opciones. */
  function exportHTML(sliders) {
    return markup(sliders) + '\n\n' + initScript(sliders) + '\n';
  }

  function exportCSS(sliders) {
    return '<style>\n' + css(sliders) + '</style>\n';
  }

  /** Pestaña JS: un <script> por módulo necesario (inline). */
  function exportJS(sliders) {
    return jsFiles(sliders).map(function (f) {
      return '<script>\n' + safeScript(f.content) + '</script>\n';
    }).join('\n');
  }

  function scriptTags(sliders, prefix) {
    return jsFiles(sliders).map(function (f) { return '<script src="' + (prefix || '') + f.name + '"></script>'; }).join('\n');
  }

  /** Todo en uno: <style> en una línea, el HTML y abajo el JS (con src, o inline) + las opciones. */
  function exportAll(sliders, opts) {
    return [
      '<style>' + minifyCss(css(sliders)) + '</style>',
      '',
      markup(sliders),
      '',
      opts && opts.inlineJs ? exportJS(sliders).trim() : scriptTags(sliders),
      initScript(sliders),
      ''
    ].join('\n');
  }

  /** index.html de la descarga: enlaza sliderBuilder.css y los .js necesarios. */
  function exportPage(sliders) {
    return [
      '<!doctype html>',
      '<html lang="es">',
      '<head>',
      '  <meta charset="utf-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1">',
      '  <title>Slider</title>',
      '  <link rel="stylesheet" href="sliderBuilder.css">',
      '</head>',
      '<body>',
      indent(markup(sliders), '  '),
      '',
      indent(scriptTags(sliders), '  '),
      indent(initScript(sliders), '  '),
      '</body>',
      '</html>',
      ''
    ].join('\n');
  }

  /** Archivos de la descarga .zip: index.html, sliderBuilder.css y los .js modulares que hagan falta. */
  function exportFiles(sliders) {
    return [
      { name: 'index.html', content: exportPage(sliders) },
      { name: 'sliderBuilder.css', content: css(sliders) }
    ].concat(jsFiles(sliders));
  }

  /* ---------------- página de ejemplo (vista previa y tests) ---------------- */

  function pageCSS(cfg) {
    return [
      'body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #18181b; background: #fff; }',
      '.demo-page { max-width: 1200px; margin: 0 auto; padding: 48px 24px; }',
      '.demo-text { max-width: 680px; margin: 0 auto; padding: 64px 24px; font-size: 18px; line-height: 1.65; color: #3f3f46; }',
      '.demo-text h1 { font-size: clamp(32px, 5vw, 52px); line-height: 1.05; margin: 8px 0 20px; color: #18181b; }',
      '.demo-kicker { margin: 0; font-size: 13px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #4f46e5; }',
      '.demo-hint { font-size: 14px; color: #71717a; }',
      '.demo-text--head { padding-bottom: 8px; }',
      '.demo-text--head + .v-sb-top + .demo-text, .demo-text--head + .demo-text { padding-top: 24px; }',
      '.demo-text--end { min-height: 100dvh; }'
    ].join('\n');
  }

  function fsDemo(cfg, id) {
    var head = [
      '<section class="demo-text demo-text--head">',
      '  <p class="demo-kicker">Especial multimedia</p>',
      '  <h1>Historias que suenan</h1>',
      '</section>'
    ].join('\n');
    var intro = [
      '<section class="demo-text">',
      '  <p>Zona de mockup: contenido normal de la página.' +
        (outerMenu(cfg) ? (cfg.menuPos === 'anchor'
          ? ' El menú de episodios está justo encima de este texto: son enlaces a cada episodio y no se fija al bajar.'
          : ' El menú de episodios está justo encima de este texto: al bajar se fija arriba, se queda sobre los episodios y se va con ellos al terminar.') : '') +
        ' La sección de episodios se queda fija a pantalla completa y el scroll va pasando de episodio en episodio.</p>',
      '  <p>Más texto de ejemplo para que haya recorrido antes de llegar a la sección. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>',
      '  <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.</p>',
      '  <p class="demo-hint">Sigue bajando ↓</p>',
      '</section>'
    ].join('\n');
    var outro = [
      '<section class="demo-text demo-text--end">',
      '  <h2>Fin de los episodios</h2>',
      '  <p>Al terminar el último episodio, la sección se libera y la página continúa con normalidad.</p>',
      '</section>'
    ].join('\n');
    return head + '\n' + blockHTML(cfg, id, intro) + '\n' + outro;
  }

  function demoBody(sliders, opts) {
    var all = list(sliders);
    var idList = ids(all);
    return all.map(function (cfg, i) {
      var label = opts.labels
        ? '<div class="pv-label"><button type="button" data-pv-select="' + i + '">' + esc((cfg.name || '').trim() || 'Slider ' + (i + 1)) + ' · #' + idList[i] + '</button>' +
          (i === opts.active ? '<span>editando</span>' : '<span>clic para editar</span>') + '</div>\n'
        : '';
      var cls = opts.labels ? ' pv-slot' + (i === opts.active ? ' is-editing' : '') : '';
      if (cfg.mode === 'fullscreen') {
        return '<div class="demo-fs' + cls + '" data-pv="' + i + '">\n' + label + fsDemo(cfg, idList[i]) + '\n</div>';
      }
      return '<main class="demo-page' + cls + '" data-pv="' + i + '">\n' + label + indent(blockHTML(cfg, idList[i]), '  ') + '\n</main>';
    }).join('\n');
  }

  /** Página completa con todo inline (lo que se ve en la vista previa). */
  function standalone(sliders, extra) {
    extra = extra || {};
    var all = list(sliders);
    return [
      '<!doctype html>',
      '<html lang="es">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>Slider</title>',
      '<style>\n' + css(all) + pageCSS(all[0]) + (extra.css || '') + '\n</style>',
      '</head>',
      '<body>',
      demoBody(all, extra),
      exportJS(all).trim(),
      initScript(all),
      extra.script ? '<script>\n' + safeScript(extra.script) + '\n</script>' : '',
      '</body>',
      '</html>',
      ''
    ].join('\n');
  }

  var PREVIEW_SCRIPT = [
    '(function(){',
    '  function post(root){ if(root.sbSlider) parent.postMessage({type:"v-sb-state", id:root.id, state:root.sbSlider.getState()}, "*"); }',
    '  function send(e){ parent.postMessage({type:"v-sb-state", id:e.target.id, state:e.detail}, "*"); }',
    '  document.addEventListener("sb:layout", send);',
    '  document.addEventListener("sb:change", send);',
    '  document.querySelectorAll(".v-sb").forEach(post);',
    '  var t=document.createElement("div"); t.id="v-sb-toast"; document.body.appendChild(t); var h;',
    '  document.addEventListener("click", function(e){',
    '    var sel=e.target.closest("[data-pv-select]");',
    '    if(sel){ parent.postMessage({type:"v-sb-select", index:+sel.dataset.pvSelect}, "*"); return; }',
    '    var a=e.target.closest("a"); if(!a) return; e.preventDefault();',
    '    var title=(a.querySelector("h3")||a).textContent.trim();',
    '    t.textContent="Click en: "+title; t.className="show"; clearTimeout(h); h=setTimeout(function(){t.className="";},1400);',
    '  });',
    '  window.addEventListener("message", function(e){ if(e.data&&e.data.type==="v-sb-scroll") window.scrollTo({top:e.data.y, behavior:"instant"}); });',
    '  window.addEventListener("scroll", function(){ parent.postMessage({type:"v-sb-scrolled", y:window.scrollY}, "*"); }, {passive:true});',
    '})();'
  ].join('\n');

  var PREVIEW_CSS = [
    '#v-sb-toast{position:fixed;left:50%;bottom:20px;transform:translate(-50%,20px);opacity:0;padding:10px 16px;border-radius:10px;background:#18181b;color:#fff;font:500 14px system-ui;pointer-events:none;transition:.25s;z-index:99}',
    '#v-sb-toast.show{opacity:1;transform:translate(-50%,0)}',
    '.pv-slot{position:relative;}',
    '.demo-page.pv-slot + .demo-page.pv-slot{padding-top:8px;}',
    '.pv-label{display:flex;align-items:center;gap:8px;margin:0 0 14px;font:500 12.5px system-ui;color:#71717a;}',
    '.demo-fs .pv-label{max-width:1200px;margin:24px auto 0;padding:0 24px;}',
    '.pv-label button{padding:4px 10px;border:1px solid #d6d6de;border-radius:99px;background:#fff;font:600 12.5px system-ui;color:#18181b;cursor:pointer;}',
    '.pv-slot.is-editing .pv-label button{background:#4f46e5;border-color:#4f46e5;color:#fff;}'
  ].join('\n');

  /** scroll: { y } para mantener la posición, o { slot } para ir a un slider. */
  function previewDoc(sliders, active, scroll) {
    var all = list(sliders);
    scroll = scroll || {};
    var go = scroll.slot != null
      ? 'var el=document.querySelector(\'[data-pv="' + (+scroll.slot) + '"]\'); if(el) el.scrollIntoView({block:"start"});'
      : (scroll.y ? 'window.scrollTo({top:' + (+scroll.y) + ', behavior:"instant"});' : '');
    return standalone(all, { css: '\n' + PREVIEW_CSS, script: PREVIEW_SCRIPT + '\n' + go, labels: all.length > 1, active: active || 0 });
  }

  g.SBGenerator = {
    esc: esc,
    slug: slug,
    ids: ids,
    runtimeOptions: runtimeOptions,
    initOptions: initOptions,
    initScript: initScript,
    sliderHTML: sliderHTML,
    menuSlotHTML: menuSlotHTML,
    markup: markup,
    css: css,
    js: js,
    jsFiles: jsFiles,
    modulesFor: modulesFor,
    features: features,
    matches: matches,
    exportPage: exportPage,
    exportFiles: exportFiles,
    exportHTML: exportHTML,
    exportCSS: exportCSS,
    exportJS: exportJS,
    exportAll: exportAll,
    minifyCss: minifyCss,
    standalone: standalone,
    previewDoc: previewDoc
  };
})(typeof window !== 'undefined' ? window : globalThis);
