/* ROCE · Nombres de marca: «Coffee, Bakery & Kitchen» y «Restaurant & Cocktails» se escriben siempre igual (con sus comas y su &)
   y con la letra y las mayúsculas de la marca, aparezcan donde aparezcan (textos fijos, traducciones o avisos que se pintan después).
   Cada vez que cambia el texto de la página se vuelven a marcar; no toca scripts, formularios ni títulos. */
(function () {
  var RE = /coffee\s*,?\s*bakery\s*(?:&amp;|&|y|and|,)\s*kitchen|restaurant\s*(?:&amp;|&|y|and)\s*cocktails/gi;
  var SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|TITLE|NOSCRIPT|CODE|PRE|SVG)$/;
  function canon(s) { return /^coffee/i.test(s) ? 'Coffee, Bakery & Kitchen' : 'Restaurant & Cocktails'; }
  function walk(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || n.nodeValue.length < 18) return NodeFilter.FILTER_REJECT;
        RE.lastIndex = 0; if (!RE.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        for (var p = n.parentNode; p && p !== root.parentNode; p = p.parentNode) {
          if (p.nodeType === 1 && (SKIP.test(p.nodeName) || p.classList.contains('brand-name') || p.isContentEditable)) return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var list = [], n; while ((n = w.nextNode())) list.push(n);
    list.forEach(function (t) {
      var txt = t.nodeValue, frag = document.createDocumentFragment(), last = 0, m;
      RE.lastIndex = 0;
      while ((m = RE.exec(txt))) {
        if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
        var s = document.createElement('span'); s.className = 'brand-name'; s.textContent = canon(m[0]); frag.appendChild(s);
        last = m.index + m[0].length;
      }
      if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
      t.parentNode.replaceChild(frag, t);
    });
  }
  var raf = 0;
  function run() { raf = 0; if (document.body) walk(document.body); }
  function sched() { if (!raf) raf = requestAnimationFrame(run); }
  function start() { run(); new MutationObserver(sched).observe(document.body, { childList: true, subtree: true, characterData: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
