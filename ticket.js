/* Ticket de brunch (ROCE): papel de caja que asoma por el borde y, al tocarlo (o dejar el ratón encima), se "imprime" con el texto
   y enlaza a la carta (app.roce.es). Uso: <div class="roce-ticket" data-roce-ticket></div> + <script src="/ticket.js"></script> al final de la página.
   Cada página decide solo DÓNDE va el ticket (posición/margen) con su propio CSS sobre .roce-ticket. */
(function () {
  if (window.ROCE_TICKET) return;
  var CSS = "  /* Letra del ticket continua (sin saltos entre móvil, tablet y escritorio): crece con el ancho de pantalla, de 9 px a 12,5 px (el tamaño que ya tenía en escritorio). El papel mide siempre 30 caracteres y se ajusta a la letra. */\n  .roce-ticket { --rt-fs: clamp(9px, 2.9vw, 12.5px); position: relative; z-index: 6; color: #0a0a0a; width: max-content; font-family: ui-monospace, \"SF Mono\", Menlo, Consolas, \"Liberation Mono\", monospace; font-size: var(--rt-fs); }\n  .rt-ghost { visibility: hidden; pointer-events: none; box-sizing: border-box; width: calc(30ch + 2rem); padding: 0.8rem 1rem 1.05rem; }\n  .rt-paper { position: absolute; right: 0; bottom: 0; width: calc(30ch + 2rem); box-sizing: border-box; will-change: transform; backface-visibility: hidden; background: #fbfbfa; padding: 0.8rem 1rem 1.05rem; clip-path: polygon(0 0, 100% 0, 100.00% calc(100% - 3px), 96.67% calc(100% - 6px), 93.33% calc(100% - 4px), 90.00% calc(100% - 6px), 86.67% calc(100% - 6px), 83.33% calc(100% - 3px), 80.00% calc(100% - 3px), 76.67% calc(100% - 4px), 73.33% calc(100% - 6px), 70.00% calc(100% - 4px), 66.67% calc(100% - 1px), 63.33% calc(100% - 1px), 60.00% calc(100% - 6px), 56.67% calc(100% - 4px), 53.33% calc(100% - 3px), 50.00% calc(100% - 5px), 46.67% calc(100% - 4px), 43.33% calc(100% - 6px), 40.00% calc(100% - 1px), 36.67% calc(100% - 0px), 33.33% calc(100% - 3px), 30.00% calc(100% - 2px), 26.67% calc(100% - 1px), 23.33% calc(100% - 0px), 20.00% calc(100% - 4px), 16.67% calc(100% - 6px), 13.33% calc(100% - 5px), 10.00% calc(100% - 5px), 6.67% calc(100% - 0px), 3.33% calc(100% - 4px), 0.00% calc(100% - 3px));\n    transform: rotate(3deg); transform-origin: 100% 100%; transition: transform 0.35s cubic-bezier(.2,.8,.2,1); filter: drop-shadow(0 6px 12px rgba(0,0,0,0.5)); }\n  .roce-ticket.is-open .rt-paper { transform: rotate(-1deg); }\n  .rt-head { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; width: 100%; margin: 0; padding: 0; border: 0; background: none; color: inherit; cursor: pointer; text-align: left; font-family: ui-monospace, \"SF Mono\", Menlo, Consolas, \"Liberation Mono\", monospace; font-weight: 400; text-transform: uppercase; font-size: var(--rt-fs); line-height: 1.45; letter-spacing: -0.01em; white-space: pre; -webkit-tap-highlight-color: transparent; }\n  .rt-ghost .rt-head { cursor: default; }\n  .roce-ticket:not(.is-open) .rt-paper { cursor: pointer; -webkit-tap-highlight-color: transparent; }\n  .rt-arr { display: inline-block; transition: transform 0.3s ease; }\n  .roce-ticket.is-open .rt-arr { transform: rotate(180deg); }\n  .rt-body { overflow: hidden; font-family: ui-monospace, \"SF Mono\", Menlo, Consolas, \"Liberation Mono\", monospace; font-size: var(--rt-fs); line-height: 1.45; white-space: pre; letter-spacing: -0.01em; transition: max-height 0.28s ease; }\n  .rt-body .rt-l { display: block; min-height: 1.45em; }\n  .rt-body a { color: inherit; text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 2px; }\n  .rt-body .rt-go { display: block; margin-top: 0.8em; padding: 0.35em 0; }\n  .rt-body .rt-top { margin-top: 0.45rem; }\n  .rt-cur::after { content: \"\"; display: inline-block; width: 0.55em; height: 1em; margin-left: 1px; vertical-align: -0.12em; background: currentColor; animation: rtBlink 0.8s steps(1) infinite; }\n  @keyframes rtBlink { 50% { opacity: 0; } }\n  .rt-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }\n  @media (prefers-reduced-motion: reduce) { .rt-paper, .rt-arr, .rt-body { transition: none; } .rt-cur::after { animation: none; } }\n\n  /* Variante en diagonal (data-roce-ticket=\"side\"): en la esquina inferior derecha, ya inclinado en diagonal y entero a la vista; al abrirlo se endereza un poco y crece. */\n  .roce-ticket.is-side .rt-head { flex-direction: row-reverse; justify-content: flex-end; }\n  .roce-ticket.is-side .rt-paper { transform: rotate(8deg); transform-origin: 100% 100%; transition-duration: 0.5s; }\n  .roce-ticket.is-side.is-open .rt-paper { transform: translate(-0.3rem, -0.4rem) rotate(-2deg); }\n";
  var MARKUP = "<div class=\"rt-ghost\" aria-hidden=\"true\"><span class=\"rt-head\"><span>Brunch · Bakery · Coffee</span><span class=\"rt-arr\">↑</span></span></div>\n<div class=\"rt-paper\">\n  <button type=\"button\" class=\"rt-head rt-head-btn\" aria-expanded=\"false\"><span>Brunch · Bakery · Coffee</span><span class=\"rt-arr\" aria-hidden=\"true\">↑</span></button>\n  <div class=\"rt-body\" aria-live=\"off\"></div>\n</div>";
  function mount(box) {
    if (box.__rt) return; box.__rt = 1;
    box.classList.add('roce-ticket');
    box.innerHTML = MARKUP;
    if (box.getAttribute('data-roce-ticket') === 'side') { box.classList.add('is-side'); [].forEach.call(box.querySelectorAll('.rt-arr'), function (x) { x.textContent = '↖'; }); }
  var head = box.querySelector('.rt-head-btn'), body = box.querySelector('.rt-body');
    var W = 30, reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function lang() { return window.ROCE_I18N && window.ROCE_I18N.getLang ? window.ROCE_I18N.getLang() : 'es'; }
    function row(l, r, pc, pre) { return { t: l + new Array(Math.max(1, W - l.length - r.length) + 1).join(' ') + r, cut: l.length, pc: pc || 0, pre: pre || 0 }; }
    function lines() {
      var en = lang() === 'en';
      return [
        { t: new Array(W + 1).join('-'), fast: 1 },
        { t: 'ALL DAY KITCHEN', top: 1, pre: 300 },
        { t: '' },
        row(en ? 'Kitchen' : 'Cocina', 'healthy', 650, 200),
        row(en ? 'Coffee' : 'Café', 'specialty', 650, 200),
        row('Bakery', en ? 'not so healthy' : 'no tan healthy', 1100, 200),
        row('', en ? 'but really tasty ;)' : 'pero muy rico ;)', 0, 1100),
        { t: '' },
        { t: en ? 'Ground floor · No booking' : 'Planta baja · Sin reserva', pre: 250 },
        { t: 'Gran Vía Marqués del Túria, 16', pre: 120 }
      ];
    }
    var open = false, viaHover = false, timers = [], hoverT = 0, leaveT = 0, pointer = 'mouse';
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function print(instant) {
      clearTimers(); body.innerHTML = ''; body.style.maxHeight = '';
      var area = document.createElement('div'); area.className = 'rt-print'; body.appendChild(area);
      var go = document.createElement('a'); go.className = 'rt-go'; go.href = 'https://app.roce.es/'; go.textContent = lang() === 'en' ? 'See menu ↗' : 'Ver carta ↗'; body.appendChild(go);   // visible desde el primer toque, al pie del papel
      var L = lines(), K = 0.8, delay = 200, STEP = 32 * K;
      L.forEach(function (ln) {
        var el = document.createElement(ln.href ? 'a' : 'span'); el.className = 'rt-l' + (ln.top ? ' rt-top' : '');
        if (ln.href) el.href = ln.href;
        if (instant || reduce) { el.textContent = ln.t; area.appendChild(el); return; }
        delay += (ln.pre || 0) * K;
        if (!ln.t) { later(function () { area.appendChild(el); }, delay); delay += 260 * K; return; }
        later(function () { area.appendChild(el); el.classList.add('rt-cur'); }, delay);
        var step = ln.fast ? 10 : STEP, firstRight = -1;
        for (var q = ln.cut || 0; q < ln.t.length; q++) if (ln.cut != null && ln.t.charAt(q) !== ' ') { firstRight = q; break; }
        for (var k = 0; k < ln.t.length; k++) {
          if (ln.cut != null && k === firstRight && ln.pc) delay += ln.pc * K;       // pausa entre la palabra de la izquierda y la de la derecha
          var instantSpace = ln.cut != null && k >= ln.cut && k < firstRight;    // el hueco entre columnas no se "teclea"
          if (!instantSpace) delay += step;
          (function (n, d) { later(function () { el.textContent = ln.t.slice(0, n + 1); }, d); })(k, delay);
        }
        (function (d) { later(function () { el.classList.remove('rt-cur'); }, d + 60); })(delay);
        delay += 160 * K;
      });
    }
    function setOpen(v, instant) {
      if (v === open) return; open = v;
      box.classList.toggle('is-open', open); head.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) print(instant);
      else {
        clearTimers(); body.style.maxHeight = body.scrollHeight + 'px'; void body.offsetHeight; body.style.maxHeight = '0px';
        later(function () { if (!open) { body.innerHTML = ''; body.style.maxHeight = ''; } }, 300);
      }
    }
    // Ratón: al dejarlo encima un rato se abre y al salir se cierra. Táctil/teclado: toca para abrir o cerrar.
    box.addEventListener('pointerenter', function (e) { pointer = e.pointerType; if (e.pointerType !== 'mouse') return; clearTimeout(leaveT); clearTimeout(hoverT); if (!open) hoverT = setTimeout(function () { viaHover = true; setOpen(true); }, 350); });
    box.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'mouse') return; clearTimeout(hoverT); if (viaHover) { clearTimeout(leaveT); leaveT = setTimeout(function () { viaHover = false; setOpen(false); }, 250); } });
    box.addEventListener('pointerdown', function (e) { pointer = e.pointerType; });
    head.addEventListener('click', function () {
      clearTimeout(hoverT); clearTimeout(leaveT);
      if (pointer === 'mouse' && open && viaHover) { viaHover = false; return; }   // abierto con el ratón: un clic lo deja fijo
      viaHover = false; setOpen(!open);
    });
    // Cerrado, toda la tira de papel (también el margen blanco) abre el ticket, no solo la línea de texto.
    var paper = box.querySelector('.rt-paper');
    paper.addEventListener('click', function (e) { if (open || head.contains(e.target) || e.target.closest('a')) return; head.click(); });
    document.addEventListener('click', function (e) { if (open && !box.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) setOpen(false); });
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.addEventListener('click', function () { if (open) setTimeout(function () { clearTimers(); print(true); }, 60); }); });
    // Texto completo para lectores de pantalla y buscadores (el efecto de escritura es solo visual).
    var sr = document.createElement('p'); sr.className = 'rt-sr';
    sr.innerHTML = 'Brunch, Bakery, Coffee. All day kitchen. Planta baja, sin reserva. Gran Vía Marqués del Túria, 16. <a href="https://app.roce.es/">Ver carta</a>';
    box.appendChild(sr);
  
    // Texto completo para lectores de pantalla y buscadores (el efecto de escritura es solo visual).
    var sr = document.createElement('p'); sr.className = 'rt-sr';
    sr.innerHTML = 'Brunch, Bakery, Coffee. All day kitchen. Planta baja, sin reserva. Gran Vía Marqués del Túria, 16. <a href="https://app.roce.es/">Ver carta</a>';
    box.appendChild(sr);
  }
  function init() {
    // El CSS va al principio del <head> para que el de cada página (posición, margen…) tenga la última palabra.
    var st = document.createElement('style'); st.textContent = CSS; document.head.insertBefore(st, document.head.firstChild);
    [].slice.call(document.querySelectorAll('[data-roce-ticket]')).forEach(mount);
  }
  window.ROCE_TICKET = { mount: mount };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
