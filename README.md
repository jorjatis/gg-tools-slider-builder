# Slider Builder

**Pruébalo:** https://ggtools-sliderbuilder.netlify.app

Constructor visual de sliders. Configuras el slider en el panel, lo ves en una vista previa con anchos de pantalla reales y exportas **HTML + CSS + JS declarativo** (sin imports ni exports).

## Cómo usarlo

Descarga el proyecto y abre `index.html` en el navegador: no hay que instalar nada.

Si vas a modificar el código del slider (`src/runtime/`), arranca con Node 18 o superior:

```
npm start
```

Se abre en http://localhost:5173 y regenera `src/runtime/assets.js`, que es de donde sale el código exportado. `npm run build` solo lo regenera.

## Estructura

| Ruta | Qué es |
| --- | --- |
| `src/runtime/sliderBuilder-core.js` + `sliderBuilder-{drag,menu,fullscreen,autoplay}.js` · `sliderBuilder.css` | El slider que se exporta: núcleo y módulos opcionales. Se inicializa con `SliderBuilder.init()` o solo en cada `[data-sb]`. |
| `src/builder/` | El constructor: presets, generador de código, UI. |
| `scripts/build-assets.js` | Empaqueta el runtime como texto para poder exportarlo. |

## Uso del código exportado

Todas las clases y variables CSS llevan el prefijo `v-sb` (`.v-sb`, `.v-sb-item`, `--v-sb-gap`…).

El export tiene cuatro pestañas:

- **HTML**: solo el slider y un `<script>` con sus opciones.
- **CSS**: `<style>` sin comentarios; solo los estilos del slider (y las variables de cada instancia que cambien).
- **JS**: `<script>` con la librería, sin comentarios.
- **Todo en uno**: `<style>` en una línea arriba, el HTML en medio y abajo los `<script src>` + las opciones. Con «Incluir todo el JS», el código va dentro.
- **Descargar .zip**: `index.html`, `sliderBuilder.css` y los `.js` necesarios enlazados con `src`.

```html
<div class="v-sb" id="slider-1" aria-label="Slider">
  <div class="v-sb-viewport">
    <div class="v-sb-track">
      <article class="v-sb-item" data-sb-label="Uno">…</article>
    </div>
  </div>
</div>

<script src="sliderBuilder-core.js"></script>
<script src="sliderBuilder-drag.js"></script>
<script>
  (function () {
    SliderBuilder.init('#slider-1', {
      perView: 2.4,
      align: 'center',
      loop: true
    });
  })();
</script>
```

- Solo se escriben las opciones que cambian respecto a los valores por defecto; con todo por defecto queda `SliderBuilder.init('#slider-1');`.
- La librería va en una IIFE (empieza por `;`) y solo expone `window.SliderBuilder`; las llamadas a `init` van en su propia IIFE. Puedes poner más código antes o después en el mismo `<script>`.
- Varios sliders en la misma página: un `init` por cada uno.
- También funciona el estilo declarativo: `<div class="v-sb" data-sb data-sb-loop="true">` se inicializa solo. Si usas ambos, el objeto manda.
- Pantalla completa con **menú anexo**: el HTML exporta por un lado el hueco del menú y por otro el slider. Pon el menú donde quieras de la página (por ejemplo bajo el título):

  ```html
  <div class="v-sb-top" id="slider-1-menu"></div>
  …tu contenido…
  <section class="v-sb" id="slider-1">…</section>
  ```

  Modos (`topMode`):
  - `sticky`: aparece donde lo pongas, se fija arriba al bajar, la sección queda justo debajo y al terminar sube con ella.
  - `overlay`: igual, pero transparente y encima de los slides, que ocupan el 100% de alto.
  - `anchor`: no se fija; solo lleva a cada slide. Con `menuInside: true` aparece además el menú dentro de la sección.

  Para que pueda fijarse, el menú tiene que estar en un contenedor que llegue hasta la sección (por ejemplo, directamente en el `<body>` o en el mismo contenedor que la sección).

### Opciones (objeto o atributo `data-sb-*`)

| Opción (`data-sb-…`) | Valores | Por defecto |
| --- | --- | --- |
| `mode` | `carousel` · `fullscreen` | `carousel` |
| `sizing` | `perview` · `fixed` | `perview` |
| `per-view` / `item-width` | items visibles / px | `3` / `280` |
| `per-view-mobile`, `mobile-bp` | items por vista en móvil (`0` = igual que `per-view`) y ancho móvil | `1`, `699` |
| `gap`, `peek` | px de separación (en `fullscreen`, `0` por defecto) / fracción de item que asoma (`0.25` = un cuarto; centrado asoma por los dos lados) | `16`, `0` |
| `align` | `start` · `center` | `start` |
| `step` | items por gesto, `0` = libre sin snap | `1` |
| `loop` | infinito | `false` |
| `arrows`, `arrows-pos`, `arrow-style` | `inside` · `outside` · `bottom` / `circle` · `square` · `minimal` | `true`, `inside` |
| `dots` | `none` · `dots` · `lines` · `fraction` | `dots` |
| `menu` | pestañas superiores con `data-sb-label` o el título del item | `false` |
| `shadows` | sombras de borde (inicio / final) | `true` |
| `effect`, `effect-on` | `dim scale gray` / `hover` · `active` | — , `hover` |
| `auto-disable` | si caben todos, no es slider | `true` |
| `below`, `columns` | slider solo con pantalla ≤ px; si no, columnas | `0`, `3` |
| `speed`, `autoplay`, `drag` | ms / ms (0 = off) / arrastre | `450`, `0`, `true` |
| `fs-transition` | `jump` (salto) · `step` (paso: un gesto = un episodio) · `scrub` (scroll real; solo encaja si falta < 10%) | `step` |
| `fs-length`, `fs-width` | dvh de scroll por slide / % de ancho del slide | `100`, `100` |
| `top`, `top-mode`, `menu-inside` | selector del hueco del menú anexo (`'#slider-1-menu'`) / `sticky` · `overlay` · `anchor` / con `anchor`, también el menú dentro de la sección | — , `sticky`, `false` |

API opcional: `el.sbSlider.next()`, `.prev()`, `.goTo(i)`, `.getState()`, `.destroy()`; eventos `sb:change` y `sb:layout`.

Breakpoints del constructor: Desktop 1366, Desktop S 1025, Tablet 769, Mobile 699, Mobile S 360, Mobile XS 320.

CSS: `sliderBuilder.css` se exporta por bloques (marcas `@if` en el fuente), solo con lo que usa la configuración.

Módulos: carga siempre `sliderBuilder-core.js` primero y después solo los que uses. Si falta uno, sale un aviso en la consola.
