/* Contenido y modal de la wiki. Cada entrada: { key?: opción del panel, name, text }. `x` = código. */
(function (g) {
  'use strict';

  var WIKI = [
    {
      id: 'empezar', title: 'Cómo funciona', items: [
        { name: 'En tres pasos', text: 'Elige una configuración por defecto, ajusta las opciones del panel y pulsa «Exportar código». La vista previa es el slider real, con el mismo código que se exporta.' },
        { name: 'Configuraciones por defecto', text: 'Puntos de partida ya montados. Al elegir una se cambian todas las opciones del slider que estás editando, pero se conservan su nombre, su ID y los textos de sus items. Puede cambiar el número de items; los que sobran vuelven si eliges otra con más.' },
        { name: 'Guardado automático', text: 'Todo se guarda en este navegador mientras trabajas y sigue ahí al volver. No se sincroniza con otros navegadores ni ordenadores.' },
        { name: 'Restablecer', text: 'Borra todos los sliders y vuelve al inicial. Pide confirmación y no se puede deshacer.' }
      ]
    },
    {
      id: 'sliders', title: 'Sliders e items', items: [
        { name: 'Varios sliders', text: 'Con «+ Añadir» pones otro en la misma página. Cada uno tiene sus opciones y sus items. El panel edita el que esté seleccionado, desde su pestaña o desde su etiqueta en la vista previa.' },
        { name: 'Ordenar y eliminar', text: 'Arrastra una pestaña para cambiar el orden. La × de su esquina la elimina, si hay más de un slider.' },
        { name: 'Items', text: 'Con + y − añades o quitas el último. Cada item tiene color, título, texto y botón ↗ para decidir si es un enlace. Arrástralos desde los puntos de la izquierda para ordenarlos.' },
        { name: 'Clicks y arrastre', text: 'Un click abre el enlace del item y no mueve el slider. Si arrastras, el enlace no se abre. En la vista previa los enlaces solo muestran un aviso.' }
      ]
    },
    {
      id: 'tipo', title: 'Tipo', items: [
        { key: 'mode', name: 'Carrusel / Pantalla completa', text: 'Carrusel es el slider típico, de izquierda a derecha. Pantalla completa fija una sección a todo el alto (100dvh) y el scroll de la página va pasando los slides.' },
        { key: 'name', name: 'Nombre', text: 'Para identificar el slider en las pestañas y la vista previa. También se exporta como `aria-label`, el nombre que leen los lectores de pantalla.' },
        { key: 'id', name: 'ID del slider', text: 'El `id` del HTML exportado, con el que lo inicializa el script. Si dos sliders coinciden, al segundo se le añade un número.' }
      ]
    },
    {
      id: 'layout', title: 'Tamaño y layout', items: [
        { key: 'sizing', name: 'Ancho de item', text: '«Por vista» reparte el ancho entre los items visibles. «Fijo» da a cada item los mismos píxeles, sin pasar nunca del ancho del contenedor.' },
        { key: 'perView', name: 'Items por vista', text: 'Cuántos items enteros se ven a la vez.' },
        { key: 'itemWidth', name: 'Ancho fijo', text: 'Píxeles de cada item cuando el ancho es «Fijo».' },
        { key: 'gap', name: 'Separación', text: 'Espacio entre items. En pantalla completa es 0 por defecto y solo aparece si los slides miden menos del 100 %.' },
        { key: 'peek', name: 'Asomar laterales', text: 'Qué parte de un item vecino se ve. A la izquierda asoma solo el siguiente; centrado asoman el anterior y el siguiente.' },
        { key: 'align', name: 'Posición del item', text: '«Izquierda» alinea el item activo al inicio; «Centrado» lo lleva al medio. Con snap de 2 o más se centra el grupo.' }
      ]
    },
    {
      id: 'movimiento', title: 'Snap y movimiento', items: [
        { key: 'step', name: 'Scroll snapping', text: 'De cuántos en cuántos avanza. Con «Libre» se queda donde lo sueltes y las flechas avanzan lo que se ve en pantalla.' },
        { key: 'loop', name: 'Infinito', text: 'Al llegar al final vuelve al principio sin salto. Las flechas nunca se desactivan. Solo en carrusel.' },
        { key: 'drag', name: 'Arrastrar', text: 'Mover el slider con el dedo o el ratón. Un gesto corto y rápido pasa al siguiente; uno corto y lento vuelve a su sitio.' },
        { key: 'speed', name: 'Velocidad', text: 'Duración de la animación. Con 0 el cambio es instantáneo. Si la persona tiene activado «reducir movimiento» en su sistema, no se anima.' },
        { key: 'autoplay', name: 'Autoplay', text: 'Avanza solo cada X segundos y se pausa con el ratón o el foco encima. Sin infinito, al final vuelve al primero. Solo en carrusel.' }
      ]
    },
    {
      id: 'fullscreen', title: 'Pantalla completa', items: [
        { key: 'fsTransition', name: 'Transición', text: '«Salto» cambia al instante según el scroll. «Paso» avanza un slide por gesto, con animación. «Scroll real» mueve los slides con el scroll y solo encaja si falta menos de un 10 % para uno.' },
        { key: 'fsWidth', name: 'Ancho de cada slide', text: 'Con menos del 100 % asoman los slides de los lados.' },
        { key: 'fsLength', name: 'Scroll por slide', text: 'Cuánto hay que bajar para pasar de un slide a otro, en alto de pantalla: 100 dvh es una pantalla entera. Se nota sobre todo en «Salto» y «Scroll real».' },
        { name: 'Entrar y salir', text: 'En «Paso», al entrar te quedas en el primer slide, o en el último si vienes de abajo. Hace falta otro gesto para avanzar. Tras el último, la página sigue con normalidad.' }
      ]
    },
    {
      id: 'navegacion', title: 'Navegación', items: [
        { key: 'arrows', name: 'Flechas', text: 'Botones anterior y siguiente. Se desactivan al inicio y al final, salvo en infinito. También funcionan las flechas del teclado con el foco en el slider.' },
        { key: 'arrowsPos', name: 'Posición de flechas', text: 'Dentro (sobre los items), fuera (a los lados, reservando espacio) o abajo, junto al indicador.' },
        { key: 'arrowStyle', name: 'Estilo de flechas', text: 'Círculo, cuadrado o mínimo, sin fondo.' },
        { key: 'dots', name: 'Indicador inferior', text: 'Puntos, líneas o contador «1 / 5». Puntos y líneas se pueden pulsar.' },
        { key: 'menu', name: 'Menú superior (burbujas)', text: 'Un botón por item con su título. Si no caben, se desliza y salen flechas en los extremos. El activo se mantiene a la vista.' },
        { key: 'menuPos', name: 'Dónde va el menú', text: 'Solo en pantalla completa. «Fijo en la página» se ancla arriba y la sección queda debajo. «Fijo y transparente» flota sobre los slides. «Arriba, sin fijar» solo lleva a cada slide. «Dentro de la sección» va arriba a la derecha.' },
        { key: 'menuAlsoInside', name: 'Y también dentro de la sección', text: 'Con «Arriba, sin fijar», añade un segundo menú sobre los slides.' },
        { key: 'shadows', name: 'Sombras de borde', text: 'Degradado en los lados que indica que hay más items. Desaparece al inicio y al final; en infinito está siempre en ambos.' }
      ]
    },
    {
      id: 'efectos', title: 'Efectos', items: [
        { key: 'effects', name: 'Resto de items', text: 'Qué les pasa a los items no destacados: transparencia, escala o escala de grises. Se pueden combinar.' },
        { key: 'effectOn', name: 'Se activa con', text: '«Hover» destaca el item bajo el ratón (no en táctil). «Item activo» destaca el del snap actual.' },
        { key: 'dim', name: 'Opacidad del resto', text: 'Cuanto más bajo, más transparentes los demás.' },
        { key: 'scale', name: 'Escala del destacado', text: 'Con hover, el elegido crece. Con item activo, los demás se encogen en la misma proporción.' }
      ]
    },
    {
      id: 'responsive', title: 'Responsive', items: [
        { key: 'when', name: '¿Cuándo es slider?', text: '«Siempre» lo mantiene aunque quepan todos. «Si no caben» lo muestra en fila, sin controles, cuando hay sitio. «Según pantalla» usa columnas en pantallas grandes y slider por debajo del ancho elegido.' },
        { key: 'staticAlign', name: 'Si caben, alinear', text: 'Dónde se colocan los items cuando no hace falta slider.' },
        { key: 'below', name: 'Es slider hasta', text: 'Ancho máximo, incluido, en el que es slider. Por encima se ve en columnas.' },
        { key: 'columns', name: 'Columnas en pantallas grandes', text: 'Cuántas columnas hay por encima de ese ancho; lo que no cabe baja a otra fila.' },
        { key: 'perViewMobile', name: 'Items por vista en móvil', text: 'Cuántos items enteros se ven en móvil. «Igual» usa los de desktop.' },
        { key: 'mobileBp', name: 'Se considera móvil hasta', text: 'Ancho máximo, incluido, en el que se aplica la opción anterior.' },
        { name: 'Pantallas', text: 'Desktop 1366, Desktop S 1025, Tablet 769, Mobile 699, Mobile S 360 y Mobile XS 320 px. Los botones sobre la vista previa usan estos mismos anchos.' }
      ]
    },
    {
      id: 'exportar', title: 'Exportar', items: [
        { name: 'HTML', text: 'El menú superior, si va fuera del slider, el slider y el script con sus opciones. Solo se escriben las que cambian respecto a las de por defecto.' },
        { name: 'CSS y JS', text: 'En `<style>` y `<script>`, sin comentarios. Solo se incluye lo que usa tu configuración: en el JS, el núcleo y los módulos de arrastre, menú, pantalla completa o autoplay; en el CSS, los bloques de las opciones activas.' },
        { name: 'Todo en uno', text: 'CSS en una línea, HTML y scripts, para pegarlo de una vez. Los `.js` se enlazan con `src`; marca «Incluir todo el JS» para llevar el código dentro.' },
        { name: 'Descargar .zip', text: '`index.html`, `sliderBuilder.css` y los `.js` necesarios.' },
        { name: 'Colocar el menú', text: 'El menú exportado (`.v-sb-top`) va donde quieras. Para que pueda fijarse, ponlo en un contenedor que llegue hasta la sección; en una caja pequeña se quedará en ella.' },
        { name: 'Convivir con otro código', text: 'El JS va encapsulado y solo crea `window.SliderBuilder`. Las clases y variables CSS empiezan por `v-sb`. Carga siempre `sliderBuilder-core.js` antes que los módulos.' },
        { name: 'Controlarlo desde JS', text: '`elemento.sbSlider` ofrece `next()`, `prev()`, `goTo(i)`, `getState()`, `refresh()` y `destroy()`. El elemento emite `sb:change` y `sb:layout`.' }
      ]
    }
  ];

  function node(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function rich(text) {
    var p = node('p');
    text.split('`').forEach(function (part, i) { p.appendChild(i % 2 ? node('code', '', part) : document.createTextNode(part)); });
    return p;
  }

  /** Sin tildes ni mayúsculas, para buscar. */
  function plain(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function mount() {
    var dialog = document.querySelector('#wiki-dialog');
    var nav = document.querySelector('#wiki-nav');
    var body = document.querySelector('#wiki-body');
    var search = document.querySelector('#wiki-search');
    var empty = document.querySelector('#wiki-empty');

    var sections = WIKI.map(function (sec) {
      var el = node('section', 'wiki__section');
      el.id = 'wiki-' + sec.id;
      el.appendChild(node('h3', '', sec.title));
      var dl = node('div', 'wiki__list');
      var rows = sec.items.map(function (it) {
        var row = node('article', 'wiki__item');
        row.appendChild(node('h4', '', it.name));
        row.appendChild(rich(it.text));
        dl.appendChild(row);
        return { el: row, hay: plain(sec.title + ' ' + it.name + ' ' + it.text) };
      });
      el.appendChild(dl);
      body.insertBefore(el, empty);
      var link = node('button', 'wiki__link', sec.title);
      link.type = 'button';
      link.addEventListener('click', function () {
        body.scrollTo({ top: el.offsetTop - body.offsetTop, behavior: 'instant' });
        mark(link);
      });
      nav.appendChild(link);
      return { el: el, rows: rows, link: link };
    });

    function mark(link) {
      sections.forEach(function (s) {
        if (s.link === link) s.link.setAttribute('aria-current', 'true'); else s.link.removeAttribute('aria-current');
      });
    }

    function current() {
      var shown = sections.filter(function (s) { return !s.el.hidden; });
      if (!shown.length) return mark(null);
      var top = body.scrollTop + body.offsetTop + 24;
      var cur = shown[0];
      shown.forEach(function (s) { if (s.el.offsetTop <= top) cur = s; });
      if (body.scrollTop + body.clientHeight >= body.scrollHeight - 2 && body.scrollTop > 0) cur = shown[shown.length - 1];
      mark(cur.link);
    }

    function filter() {
      var words = plain(search.value).split(/\s+/).filter(Boolean);
      var total = 0;
      sections.forEach(function (s) {
        var n = 0;
        s.rows.forEach(function (r) {
          var ok = words.every(function (w) { return r.hay.indexOf(w) !== -1; });
          r.el.hidden = !ok;
          if (ok) n++;
        });
        s.el.hidden = s.link.hidden = !n;
        total += n;
      });
      empty.hidden = total > 0;
      body.scrollTop = 0;
      current();
    }

    body.addEventListener('scroll', current, { passive: true });
    search.addEventListener('input', filter);
    document.querySelector('#btn-help').addEventListener('click', function () {
      search.value = '';
      dialog.showModal();
      filter();
      search.focus();
    });
    dialog.querySelector('[data-close-wiki]').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  }

  g.SBWiki = { sections: WIKI };
  if (typeof document !== 'undefined') mount();
})(typeof window !== 'undefined' ? window : globalThis);
