// Empaqueta el runtime (núcleo + módulos + CSS) como strings para que el constructor
// pueda exportarlo incluso abriendo index.html con file://.
// Genera también versiones sin comentarios para el código exportado.
const fs = require('fs');
const path = require('path');

const MODULES = ['core', 'drag', 'menu', 'fullscreen', 'autoplay'];

/** Quita comentarios de JS respetando strings ('…', "…", `…`). */
function stripJs(src) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += n; i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { const end = src.indexOf('*/', i + 2); i = end === -1 ? src.length : end + 2; continue; }
    out += c;
    i++;
  }
  return tidy(out);
}

function stripCss(src) {
  return tidy(src.replace(/\/\*[\s\S]*?\*\//g, ''));
}

/** Parte el CSS en bloques según sus marcas @if: [{ when, css }] (sin comentarios). */
function splitCss(src) {
  const parts = src.split(/\/\* @if ([^*]+?) \*\//).slice(1);
  const out = [];
  for (let i = 0; i < parts.length; i += 2) {
    const css = stripCss(parts[i + 1]);
    if (css.trim()) out.push({ when: parts[i].trim(), css });
  }
  return out;
}

/** Sin espacios finales ni líneas vacías. */
function tidy(src) {
  return src.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim()).join('\n') + '\n';
}

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, 'src/runtime', f), 'utf8').replace(/\r\n/g, '\n');

function build() {
  const css = read('sliderBuilder.css');
  const modules = {};
  MODULES.forEach((name) => {
    const src = read('sliderBuilder-' + name + '.js');
    modules[name] = { src, min: stripJs(src) };
  });
  const assets = { order: MODULES, modules, css, cssParts: splitCss(css) };
  const out =
    '/* Archivo generado por scripts/build-assets.js — no editar a mano. */\n' +
    '(function (g) {\n' +
    '  g.SB_ASSETS = ' + JSON.stringify(assets) + ';\n' +
    "})(typeof window !== 'undefined' ? window : globalThis);\n";
  // Solo si cambia: los tests en paralelo lo leen mientras otro proceso lo genera.
  const file = path.join(root, 'src/runtime/assets.js');
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== out) fs.writeFileSync(file, out);
  return out;
}

const out = build();
if (require.main === module) console.log('assets.js generado (' + (out.length / 1024).toFixed(1) + ' KB)');

module.exports = { stripJs, stripCss, splitCss, MODULES };
