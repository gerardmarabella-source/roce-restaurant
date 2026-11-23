/* ROCE · Alto real de la pantalla visible.
   En el iPhone nuevo (Safari 26) 100dvh se queda unos 36 px corto (el navegador descuenta la barra flotante) y las portadas a pantalla completa
   dejaban franjas arriba y abajo y cuadrados más pequeños de lo debido. Un elemento fijo mide siempre el alto visible: se guarda en --vh
   y las páginas usan var(--vh, 100dvh). */
(function () {
  var d = document.documentElement, p = document.createElement('div');
  p.setAttribute('aria-hidden', 'true');
  p.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100%;visibility:hidden;pointer-events:none';
  d.appendChild(p);
  function set() { var h = p.offsetHeight; if (h > 200) d.style.setProperty('--vh', h + 'px'); }
  set();
  addEventListener('resize', set); addEventListener('orientationchange', set); addEventListener('pageshow', set);
  document.addEventListener('DOMContentLoaded', set);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', set);
})();
