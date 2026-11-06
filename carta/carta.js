/* ROCE · Carta digital: hojas (Brunch / Bebidas / Bakery) que se cambian como las de una carpeta, lista tipográfica,
   filtro de alérgenos y ES/EN. Sin cookies ni rastreo. */
(function () {
  'use strict';
  var D = window.CARTA;
  var UI = {
    es: { allergies: 'Alergias', al_leg: 'Alérgenos', filters: 'Filtros', f_h: 'Filtra la carta', f_p: 'Marca alérgenos, tipo de dieta o ingredientes y te mostramos solo lo que encaja.', diet_h: 'Tipo de dieta', al_t: 'Alérgenos (ocultamos los platos que los llevan)', ing_h: 'Ingredientes', clear: 'Quitar todo', clear_sec: 'Borrar', done: 'Ver carta', without: 'Sin', with_: 'Con', pending: 'Consúltalo con el equipo', soon: 'Muy pronto', soon_p: 'Estamos preparando esta carta.',
      b_al: 'Sin alérgenos', b_diet: 'Dieta', diet_note: 'La dieta y los ingredientes son orientativos según lo que figura en la carta. Si tienes dudas, pregunta al equipo.',
      note: 'Si tienes alguna alergia o intolerancia, avisa a nuestro equipo antes de pedir. Pueden existir trazas de otros alérgenos. Los alérgenos de las bebidas los confirma el equipo.', remove: 'Quitar filtros', next: 'Sigue bajando para ver', menu: 'Carta', menu_btn: 'Menú', close: 'Cerrar', cats: 'Categorías' },
    en: { allergies: 'Allergies', al_leg: 'Allergens', filters: 'Filters', f_h: 'Filter the menu', f_p: 'Tick allergens, diet or ingredients and we will show only what fits.', diet_h: 'Diet', al_t: 'Allergens (we hide dishes containing them)', ing_h: 'Ingredients', clear: 'Clear all', clear_sec: 'Clear', done: 'See menu', without: 'Without', with_: 'With', pending: 'Ask our team', soon: 'Coming soon', soon_p: 'We are preparing this menu.',
      b_al: 'Without allergens', b_diet: 'Diet', diet_note: 'Diet and ingredients are indicative, based on what the menu lists. If in doubt, ask our team.',
      note: 'If you have any allergy or intolerance, please tell our team before ordering. Traces of other allergens may be present. Allergens in drinks are confirmed by our team.', remove: 'Clear filters', next: 'Keep scrolling to see', menu: 'Menu', menu_btn: 'Menu', close: 'Close', cats: 'Categories' }
  };
  var DIETS = [
    { k: 'veg', es: 'Vegetariano', en: 'Vegetarian' }, { k: 'vegan', es: 'Vegano', en: 'Vegan' }, { k: 'pesc', es: 'Pescetariano', en: 'Pescatarian' },
    { k: 'gf', es: 'Sin gluten', en: 'Gluten-free' }, { k: 'lf', es: 'Sin lácteos', en: 'Dairy-free' }
  ];
  var ING = [
    { k: 'pollo', es: 'Pollo', en: 'Chicken', re: /\bpollo\b/ }, { k: 'ternera', es: 'Ternera / vacuno', en: 'Beef', re: /ternera|\bvaca\b|entrecot|pastrami|costilla/ },
    { k: 'pato', es: 'Pato', en: 'Duck', re: /\bpato\b|magret/ }, { k: 'bacon', es: 'Bacon', en: 'Bacon', re: /bacon/ }, { k: 'jamon', es: 'Jamón', en: 'Ham', re: /jamon/ },
    { k: 'cecina', es: 'Cecina', en: 'Cured beef', re: /cecina/ }, { k: 'salmon', es: 'Salmón', en: 'Salmon', re: /salmon/ }, { k: 'atun', es: 'Atún', en: 'Tuna', re: /\batun\b|ventresca/ },
    { k: 'huevo', es: 'Huevo', en: 'Egg', re: /huevo/ }, { k: 'queso', es: 'Queso', en: 'Cheese', re: /queso|burrata|cottage|cheddar|\bedam\b|\bfeta\b|parmesano/ },
    { k: 'yogur', es: 'Yogur / kéfir', en: 'Yogurt / kefir', re: /yogur|kefir/ }, { k: 'aguacate', es: 'Aguacate', en: 'Avocado', re: /aguacate|guacamole/ },
    { k: 'tomate', es: 'Tomate', en: 'Tomato', re: /tomate/ }, { k: 'cebolla', es: 'Cebolla', en: 'Onion', re: /cebolla/ }, { k: 'pepino', es: 'Pepino', en: 'Cucumber', re: /pepino/ },
    { k: 'hummus', es: 'Hummus', en: 'Hummus', re: /hummus/ }, { k: 'berenjena', es: 'Berenjena', en: 'Aubergine', re: /berenjena/ }, { k: 'calabacin', es: 'Calabacín', en: 'Courgette', re: /calabacin/ },
    { k: 'rucula', es: 'Rúcula', en: 'Rocket', re: /rucula/ }, { k: 'espinaca', es: 'Espinaca', en: 'Spinach', re: /espinaca/ }, { k: 'apio', es: 'Apio', en: 'Celery', re: /\bapio\b/ },
    { k: 'ajo', es: 'Ajo', en: 'Garlic', re: /\bajo\b/ }, { k: 'sesamo', es: 'Sésamo', en: 'Sesame', re: /sesamo/ }, { k: 'quinoa', es: 'Quinoa', en: 'Quinoa', re: /quinoa/ },
    { k: 'arroz', es: 'Arroz', en: 'Rice', re: /arroz/ }, { k: 'falafel', es: 'Falafel', en: 'Falafel', re: /falafel/ }, { k: 'remolacha', es: 'Remolacha', en: 'Beetroot', re: /remolacha/ },
    { k: 'mango', es: 'Mango', en: 'Mango', re: /\bmango\b/ }, { k: 'platano', es: 'Plátano', en: 'Banana', re: /platano/ }, { k: 'pina', es: 'Piña', en: 'Pineapple', re: /\bpina\b/ },
    { k: 'manzana', es: 'Manzana', en: 'Apple', re: /manzana/ }, { k: 'coco', es: 'Coco', en: 'Coconut', re: /\bcoco\b/ }, { k: 'cacahuete', es: 'Cacahuete', en: 'Peanut', re: /cacahuete/ },
    { k: 'granola', es: 'Granola', en: 'Granola', re: /granola/ }, { k: 'miel', es: 'Miel', en: 'Honey', re: /\bmiel\b/ }, { k: 'jengibre', es: 'Jengibre', en: 'Ginger', re: /jengibre/ }
  ];
  var RE = {
    meat: /pollo|\bpato\b|magret|costilla|bacon|jamon|cecina|ternera|\bvaca\b|entrecot|pastrami|filete|chorizo/, fish: /salmon|\batun\b|ventresca|pescado|anchoa/,
    dairy: /queso|burrata|cottage|cheddar|\bedam\b|\bfeta\b|parmesano|yogur|kefir|mantequilla|leche|\bnata\b/, egg: /huevo|holandesa|mayonesa|\bmayo\b/, honey: /\bmiel\b/
  };
  var L = 'es';
  try { L = localStorage.getItem('roce_lang') || (/^en/i.test(navigator.language || '') ? 'en' : 'es'); } catch (e) {}
  /* Filtros activos: alérgenos a evitar, tipo de dieta e ingredientes (sin / con) */
  var F = { al: [], diet: [], ing: { m: 'sin', k: [] } };
  try { var s0 = JSON.parse(sessionStorage.getItem('roce_carta_f') || 'null'); if (s0) F = { al: s0.al || [], diet: s0.diet || [], ing: s0.ing || { m: 'sin', k: [] } }; } catch (e) {}
  var cur = (location.hash || '').replace('#', '');
  cur = { brunch: 'kitchen', bebidas: 'coffee' }[cur] || cur;   // enlaces antiguos
  var landing = !D.sections.some(function (s) { return s.id === cur; });   // el QR abre primero el menú; desde ahí se elige la carta
  if (landing) cur = 'kitchen';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var tx = function (o) { return o == null ? '' : typeof o === 'string' ? o : (o[L] || o.es || ''); };
  var ui = function (k) { return UI[L][k]; };
  function money(p) {
    if (p == null || p === '') return '';
    if (Array.isArray(p)) return p.map(money).join(' / ');
    if (typeof p === 'string') return p;
    return p.toFixed(2).replace('.', ',') + ' €';
  }
  function als(arr) { return arr && arr.length ? '<span class="cv-als" aria-label="' + esc(ui('allergies')) + '">' + arr.map(function (n) { return '<span class="cv-al" title="' + esc(tx(D.allergens[n - 1])) + '">' + n + '</span>'; }).join('') + '</span>' : ''; }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  /* Ingredientes (por texto) y dietas (por texto + alérgenos). y = cumple, n = no, u = sin datos (bebidas sin alérgenos confirmados). `diet: [...]` en menu.js lo fuerza a mano. */
  function analyze(it, blk) {
    if (it._a) return it._a;
    var txt = norm([it.name, it.es, (it.variants || []).map(function (v) { return v.name + ' ' + v.es; }).join(' ')].join(' '));
    var al = it.al || [], known = !blk.alPending || !!it.es, yn = function (b) { return b ? 'y' : 'n'; };
    var meat = RE.meat.test(txt), fish = RE.fish.test(txt), dairy = RE.dairy.test(txt);
    var dt = {
      veg: known ? yn(!meat && !fish) : 'u', pesc: known ? yn(!meat) : 'u',
      vegan: known ? yn(!meat && !fish && !dairy && !RE.egg.test(txt) && !RE.honey.test(txt) && al.indexOf(3) === -1 && al.indexOf(7) === -1) : 'u',
      gf: blk.alPending ? 'u' : yn(al.indexOf(1) === -1), lf: blk.alPending ? 'u' : yn(al.indexOf(7) === -1 && !dairy)
    };
    if (Array.isArray(it.diet)) DIETS.forEach(function (d) { dt[d.k] = it.diet.indexOf(d.k) !== -1 ? 'y' : 'n'; });
    it._a = { dt: dt, ing: ING.filter(function (g) { return g.re.test(txt); }).map(function (g) { return g.k; }), text: !!it.es };
    return it._a;
  }
  function attrs(it, blk) {
    var a = analyze(it, blk), dt = DIETS.map(function (d) { return d.k + ':' + a.dt[d.k]; }).join(',');
    return ' data-al="' + (it.al || []).join(',') + '" data-dt="' + dt + '" data-ing="' + a.ing.join(',') + '"' + (blk.alPending ? ' data-pending="1"' : '') + (a.text ? ' data-text="1"' : '');
  }
  var secById = function (id) { return D.sections.filter(function (s) { return s.id === id; })[0]; };

  /* ── Platos y listas ── */
  function item(it, blk, n) {
    var dup = it.code && it.code === it.name;
    var h = '<li class="cv-item" id="it-' + blk._id + '-' + n + '"' + attrs(it, blk) + '><div class="cv-i-main"><div class="cv-i-top"><span class="cv-i-name">' +
      (it.code && !dup ? '<em>' + esc(it.code) + '</em>' : '') + esc(it.name) + (it.note ? ' <small>' + esc(tx(it.note)) + '</small>' : '') + als(it.al) +
      (blk.alPending ? '<span class="cv-pend">' + esc(ui('pending')) + '</span>' : '') + '</span><span class="cv-price">' + money(it.price) + '</span></div>';
    if (it.es) h += '<p class="cv-i-desc">' + esc(tx({ es: it.es, en: it.en })) + '</p>';
    if (it.tag) h += '<p class="cv-i-desc cv-i-tag">' + esc(tx(it.tag)) + '</p>';
    if (it.variants) h += '<ul class="cv-variants">' + it.variants.map(function (v) { return '<li><b>' + esc(v.name) + '</b><span>' + esc(tx({ es: v.es, en: v.en })) + '</span>' + als(v.al) + '</li>'; }).join('') + '</ul>';
    h += '</div>' + (it.img ? '<img class="cv-thumb" loading="lazy" src="' + esc(it.img) + '" alt="">' : '') + '</li>';
    return h;
  }
  function extras(b) {
    if (!b.extras) return '';
    return '<div class="cv-extras"><h4>' + esc(tx(b.extras.title)) + '</h4><ul>' + b.extras.list.map(function (e) {
      return '<li><span>' + esc(tx(e[0])) + '</span><span class="cv-price">' + esc(money(e[1])) + '</span></li>';
    }).join('') + '</ul></div>';
  }
  function cat(id, b) {
    b._id = id;
    return '<section class="cv-cat" id="' + id + '"><button type="button" class="cv-cat-h" aria-expanded="true" data-toggle="' + id + '"><span class="cv-cat-t"><h3>' + esc(tx(b.title)) + '</h3>' +
      (b.note ? '<small>' + esc(tx(b.note)) + '</small>' : '') + '</span><svg class="cv-chev" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button>' +
      '<div class="cv-cat-body"><ul class="cv-items">' + b.items.map(function (i, n) { return item(i, b, n); }).join('') + '</ul>' + extras(b) + '</div></section>';
  }
  // el título vertical se adapta a su longitud (así cabe entero aunque sea largo: COFFEE & MATCHA)
  function spineStyle(s) { var n = tx(s.title).length, len = Math.max(4.6, n * 0.64); return '--len:' + len.toFixed(1) + (n > 8 ? ';--sp:8svh' : ''); }
  function page(s, si) {
    var h = '<article class="cv-paper is-' + s.color + '" id="pg-' + s.id + '" data-sec="' + s.id + '"' + (s.id === cur ? '' : ' hidden') + '><div class="cv-paper-in"><h1 class="cv-sr">' + esc(tx(s.title)) + '</h1>';
    var body = '';
    if (s.soon) body += '<div class="cv-soon"><b>' + esc(ui('soon')) + '</b><p>' + esc(s.desc ? tx(s.desc) : ui('soon_p')) + '</p></div>';
    else s.groups.forEach(function (g, gi) {
      var same = tx(g.title) === tx(s.title);
      body += '<div class="cv-group">';
      if (!same || g.note) body += '<div class="cv-gh">' + (same ? '' : '<h2>' + esc(tx(g.title)) + '</h2>') + (g.note ? '<span>' + esc(tx(g.note)) + '</span>' : '') + '</div>';
      g.blocks.forEach(function (b, bi) { var id = 'c' + si + gi + bi; body += cat(id, b); });
      body += '</div>';
    });
    return h + body + '</div><div class="cv-spine" aria-hidden="true" style="' + spineStyle(s) + '"><span><i>' + esc(tx(s.title)) + '</i></span></div></article>';
  }

  function render() {
    document.documentElement.lang = L;
    $('cvAlLabel').textContent = ui('filters'); $('cvMenuLabel').textContent = ui('menu_btn'); $('cvCloseLabel').textContent = ui('close');
    $('cvDisclaimer').textContent = ui('note');
    $('cvSheetTitle').textContent = ui('f_h'); $('cvSheetText').textContent = ui('f_p'); $('cvAlClear').textContent = ui('clear'); $('cvAlDone').textContent = ui('done');
    $('cvDietH').textContent = ui('diet_h'); $('cvAlH').textContent = ui('al_t'); $('cvIngH').textContent = ui('ing_h');
    ['cvDietClear', 'cvAlClearSec', 'cvIngClear'].forEach(function (id) { $(id).textContent = ui('clear_sec'); }); $('cvDietNote').textContent = ui('diet_note');
    $('cvSections').innerHTML = D.sections.map(page).join('');
    buildSheet(); applyFilter(); endFlip(); sheetState(); measure(); onScroll(); paintNext();
  }

  /* ── Cambiar de hoja: la hoja se abre / se cierra como en una carpeta ── */
  var flipping = null;
  function endFlip() {
    if (!flipping) return;
    clearTimeout(flipping.t);
    [].forEach.call(document.querySelectorAll('.cv-paper'), function (p) { p.classList.remove('flip-away', 'flip-in'); p.hidden = p.dataset.sec !== cur; });
    flipping = null;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function sheetState(keep) {
    var s = secById(cur);
    document.documentElement.setAttribute('data-sheet', s.color);
    [].forEach.call(document.querySelectorAll('.cv-paper'), function (p) { p.hidden = p.dataset.sec !== cur && p.dataset.sec !== keep; });
  }
  function setSheet(id) {
    endFlip();
    if (id === cur) return;
    var idx = function (x) { return D.sections.map(function (s) { return s.id; }).indexOf(x); };
    var from = $('pg-' + cur), to = $('pg-' + id), forward = idx(id) > idx(cur), old = cur;
    window.scrollTo({ top: 0, behavior: 'instant' });
    cur = id; sheetState(old); measure();
    try { history.replaceState(null, '', '#' + id); } catch (e) {}
    current = ''; onScroll(); paintNext();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { endFlip(); return; }
    (forward ? from : to).classList.add(forward ? 'flip-away' : 'flip-in');
    flipping = { t: setTimeout(endFlip, 1000) };
  }

  /* ── Seguir bajando al final = pasar a la hoja siguiente ── */
  function nextSheet() { var ids = D.sections.map(function (s) { return s.id; }), i = ids.indexOf(cur); return i >= 0 && i < ids.length - 1 ? D.sections[i + 1] : null; }
  function paintNext() {
    var n = nextSheet(), p = $('cvNext'); if (!p) return;
    p.hidden = !n;
  }
  function prevSheet() { var ids = D.sections.map(function (s) { return s.id; }), i = ids.indexOf(cur); return i > 0 ? D.sections[i - 1] : null; }
  var over = { acc: 0, t: 0, y0: null, lock: false, dir: 0, edgeDir: 0, edgeT: 0, atEdge: false };
  function atBottom() { return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 3; }
  function atTop() { return window.scrollY <= 1; }
  // color de temperatura: azul (frío) → amarillo → rojo (caliente)
  function heat(t) {
    var S = [[50, 110, 255], [40, 215, 240], [255, 220, 60], [255, 140, 40], [255, 40, 40]], x = Math.min(0.9999, Math.max(0, t)) * (S.length - 1), i = Math.floor(x), f = x - i;
    return 'rgb(' + [0, 1, 2].map(function (k) { return Math.round(S[i][k] + (S[i + 1][k] - S[i][k]) * f); }).join(',') + ')';
  }
  var overTimer = 0;
  function overBar(v, dir) {
    var pct = Math.min(100, Math.max(0, Math.round(v))), p = pct + '%', b = $((dir || over.dir) < 0 ? 'cvTopFill' : 'cvNextBar');
    if (b) { b.style.width = p; b.style.background = heat(pct / 100); }
    clearTimeout(overTimer); if (v > 0) overTimer = setTimeout(function () { over.acc = 0; over.dir = 0; var d = $('cvNextBar'), u = $('cvTopFill'); if (d) d.style.width = '0%'; if (u) u.style.width = '0%'; }, 900);
  }
  function overReset() { over.acc = 0; over.dir = 0; clearTimeout(overTimer); var d = $('cvNextBar'), u = $('cvTopFill'); if (d) d.style.width = '0%'; if (u) u.style.width = '0%'; }
  function blocked() { return over.lock || !$('cvMenu').hidden || !!document.querySelector('dialog[open]'); }
  function overGo(dir) {
    var n = dir > 0 ? nextSheet() : prevSheet(); if (!n) return;
    over.lock = true; overReset(); setSheet(n.id); setTimeout(function () { over.lock = false; }, 1300);
  }
  // dir 1 = seguir bajando al final → hoja siguiente · dir -1 = seguir subiendo arriba del todo → hoja anterior (siempre llegas a lo alto)
  function overPush(d, need, dir) {
    var ok = dir > 0 ? (atBottom() && nextSheet()) : (atTop() && prevSheet());
    if (blocked() || !ok) { over.edgeDir = 0; overReset(); return; }
    var now = Date.now();
    // el empujón con el que llegas al borde (y su inercia) no cuenta: hay que quedarse en el borde y volver a insistir
    if (over.edgeDir !== dir) { over.edgeDir = dir; over.edgeT = now; }
    if (now - over.edgeT < (dir > 0 ? 350 : 600)) { over.t = now; return; }
    if (now - over.t > 700 || over.dir !== dir) over.acc = 0; over.t = now; over.dir = dir;
    over.acc += d; overBar(over.acc * 100 / need, dir);
    if (over.acc >= need) overGo(dir);
  }
  window.addEventListener('wheel', function (e) { if (e.deltaY > 0) overPush(e.deltaY, 450, 1); else if (e.deltaY < 0) overPush(-e.deltaY, 600, -1); }, { passive: true });
  window.addEventListener('touchstart', function (e) { over.y0 = e.touches[0].clientY; over.edgeStart = atBottom() ? 1 : atTop() ? -1 : 0; }, { passive: true });
  window.addEventListener('touchmove', function (e) {
    if (over.y0 == null || blocked()) return;
    var dy = over.y0 - e.touches[0].clientY;
    if (dy > 0 && over.edgeStart === 1 && atBottom() && nextSheet()) { over.acc = dy; over.dir = 1; overBar(dy * 100 / 150); if (dy >= 150) { over.y0 = null; overGo(1); } }
    else if (dy < 0 && over.edgeStart === -1 && atTop() && prevSheet()) { over.dir = -1; overBar(-dy * 100 / 190, -1); if (-dy >= 190) { over.y0 = null; overGo(-1); } }
    else overReset();
  }, { passive: true });
  window.addEventListener('touchend', function () { over.y0 = null; overReset(); }, { passive: true });
  window.addEventListener('keydown', function (e) {
    if (['ArrowDown', 'PageDown', ' ', 'End'].indexOf(e.key) !== -1 && atBottom()) overPush(80, 320, 1);
    else if (['ArrowUp', 'PageUp', 'Home'].indexOf(e.key) !== -1 && atTop()) overPush(80, 360, -1);
  });

  /* ── Filtros: alérgenos + dieta + ingredientes ── */
  var presentIng = null;
  function ingPresent() {
    if (presentIng) return presentIng;
    var seen = {};
    D.sections.forEach(function (s) { s.groups.forEach(function (g) { g.blocks.forEach(function (b) { b.items.forEach(function (i) { analyze(i, b).ing.forEach(function (k) { seen[k] = 1; }); }); }); }); });
    presentIng = ING.filter(function (g) { return seen[g.k]; });
    return presentIng;
  }
  function buildSheet() {
    $('cvDietList').innerHTML = DIETS.map(function (d) {
      return '<button type="button" class="cv-pick" data-d="' + d.k + '" aria-pressed="' + (F.diet.indexOf(d.k) !== -1) + '"><i class="cv-radio"></i><span>' + esc(tx(d)) + '</span></button>';
    }).join('');
    $('cvAlList').innerHTML = D.allergens.map(function (a) {
      return '<button type="button" class="cv-pick" data-n="' + a.n + '" aria-pressed="' + (F.al.indexOf(a.n) !== -1) + '"><i class="cv-radio"></i><span>' + esc(tx(a)) + '</span><span class="cv-al">' + a.n + '</span></button>';
    }).join('');
    $('cvIngMode').innerHTML = ['sin', 'con'].map(function (m) { return '<button type="button" data-m="' + m + '" aria-pressed="' + (F.ing.m === m) + '">' + esc(m === 'sin' ? ui('without') : ui('with_')) + '</button>'; }).join('');
    $('cvIngList').innerHTML = ingPresent().map(function (g) {
      return '<button type="button" class="cv-chip" data-i="' + g.k + '" aria-pressed="' + (F.ing.k.indexOf(g.k) !== -1) + '">' + esc(tx(g)) + '</button>';
    }).join('');
  }
  function dtOf(el) { var o = {}; (el.dataset.dt || '').split(',').forEach(function (p) { var x = p.split(':'); o[x[0]] = x[1]; }); return o; }
  function applyFilter() {
    var n = F.al.length + F.diet.length + F.ing.k.length;
    document.body.classList.toggle('has-filter', n > 0);
    [].forEach.call(document.querySelectorAll('.cv-item'), function (el) {
      var al = (el.dataset.al || '').split(',').filter(Boolean).map(Number), hide = false, pend = false;
      if (F.al.length) { if (al.some(function (x) { return F.al.indexOf(x) !== -1; })) hide = true; else if (el.dataset.pending) pend = true; }
      var dt = dtOf(el);
      F.diet.forEach(function (k) { if (dt[k] === 'n') hide = true; else if (dt[k] !== 'y') pend = true; });
      if (F.ing.k.length) {
        var ing = (el.dataset.ing || '').split(',').filter(Boolean), hit = F.ing.k.some(function (k) { return ing.indexOf(k) !== -1; });
        if (F.ing.m === 'sin') { if (hit) hide = true; else if (el.dataset.pending && !el.dataset.text) pend = true; }
        else if (!hit) hide = true;
      }
      el.classList.toggle('is-hidden', hide);
      el.classList.toggle('is-pending', !hide && pend);
    });
    [].forEach.call(document.querySelectorAll('.cv-cat'), function (b) {
      b.classList.toggle('is-hidden', !!b.querySelector('.cv-item') && !b.querySelector('.cv-item:not(.is-hidden)'));
    });
    [].forEach.call(document.querySelectorAll('.cv-group'), function (g) { g.classList.toggle('is-hidden', !!g.querySelector('.cv-cat') && !g.querySelector('.cv-cat:not(.is-hidden)')); });
    var c = $('cvAlCount'); c.textContent = n; c.hidden = !n;
    $('cvDietClear').disabled = !F.diet.length; $('cvAlClearSec').disabled = !F.al.length; $('cvIngClear').disabled = !F.ing.k.length;
    var f = $('cvFilter'), parts = [];
    if (F.al.length) parts.push(ui('b_al') + ': <b>' + F.al.map(function (x) { return esc(tx(D.allergens[x - 1])); }).join(', ') + '</b>');
    if (F.diet.length) parts.push(ui('b_diet') + ': <b>' + F.diet.map(function (k) { return esc(tx(DIETS.filter(function (d) { return d.k === k; })[0])); }).join(', ') + '</b>');
    if (F.ing.k.length) parts.push((F.ing.m === 'sin' ? ui('without') : ui('with_')) + ': <b>' + F.ing.k.map(function (k) { return esc(tx(ING.filter(function (g) { return g.k === k; })[0])); }).join(', ') + '</b>');
    if (n) { f.hidden = false; f.innerHTML = '<span>' + parts.join(' · ') + '</span><button type="button" id="cvFilterOff">' + esc(ui('remove')) + '</button>'; $('cvFilterOff').onclick = function () { setF({ al: [], diet: [], ing: { m: F.ing.m, k: [] } }); }; }
    else f.hidden = true;
    try { sessionStorage.setItem('roce_carta_f', JSON.stringify(F)); } catch (e) {}
  }
  function setF(x) { F = x; buildSheet(); applyFilter(); }
  function toggle(arr, v) { var i = arr.indexOf(v); return i === -1 ? arr.concat(v) : arr.filter(function (y) { return y !== v; }); }

  /* ── Altura de la barra fija + pestaña activa según el scroll ── */
  function measure() { document.documentElement.style.setProperty('--bar', document.getElementById('top').offsetHeight + 'px'); }
  var ticking = false, current = '';
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var line = document.getElementById('top').offsetHeight + 40, id = '';
      [].forEach.call(document.querySelectorAll('#pg-' + cur + ' .cv-cat:not(.is-hidden)'), function (s) { if (s.getBoundingClientRect().top <= line) id = s.id; });
      if (!id) { var f = document.querySelector('#pg-' + cur + ' .cv-cat:not(.is-hidden)'); id = f ? f.id : ''; }
      current = id;
      var c = id ? $(id) : null;
      $('cvCrumb').textContent = tx(secById(cur).title) + (c ? ' / ' + c.querySelector('h3').textContent : '');
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { measure(); onScroll(); });

  /* ── Eventos ── */
  function openCat(c) { if (c.classList.contains('is-closed')) { c.classList.remove('is-closed'); c.querySelector('.cv-cat-h').setAttribute('aria-expanded', 'true'); } }
  $('cvSections').addEventListener('click', function (e) {
    var b = e.target.closest('[data-toggle]'); if (!b) return;
    var c = $(b.dataset.toggle), open = c.classList.toggle('is-closed') === false;
    b.setAttribute('aria-expanded', String(open));
  });

  /* ── Menú de navegación a pantalla completa ── */
  function renderMenu() {
    var h = '<ul class="cv-m-list">' + D.sections.map(function (s) {
      return '<li><button type="button" class="cv-m-sheet' + (s.id === cur ? ' is-on' : '') + '" data-sec="' + s.id + '" style="--c:var(--' + s.color + ')"><span>' + esc(tx(s.title)) + '</span><span class="cv-m-side">' + (s.soon ? '<small>' + esc(ui('soon')) + '</small>' : '') + '</span></button></li>';
    }).join('') + '</ul>';
    $('cvMenuBody').innerHTML = h;
  }
  function openMenu() { renderMenu(); $('cvMenu').hidden = false; document.body.style.overflow = 'hidden'; $('cvMenuBtn').setAttribute('aria-expanded', 'true'); $('cvMenu').scrollTop = 0; $('cvMenuClose').focus(); }
  function closeMenu() { landing = false; if ($('cvMenu').hidden) return; $('cvMenu').hidden = true; document.body.style.overflow = ''; $('cvMenuBtn').setAttribute('aria-expanded', 'false'); }
  function openAl() { var d = $('cvSheet'); if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  $('cvMenuBtn').addEventListener('click', openMenu);
  $('cvMenuClose').addEventListener('click', closeMenu);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  $('cvMenuBody').addEventListener('click', function (e) {
    var s = e.target.closest('.cv-m-sheet'), c = e.target.closest('a.cv-m-cat'), al = e.target.closest('#cvMenuAl');
    if (s) { closeMenu(); setSheet(s.dataset.sec); }
    else if (c) { e.preventDefault(); closeMenu(); var t = $(c.dataset.cat); if (t) { openCat(t); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
    else if (al) { closeMenu(); openAl(); }
  });
  $('cvAlBtn').addEventListener('click', openAl);
  $('cvAlDone').addEventListener('click', function () { $('cvSheet').close ? $('cvSheet').close() : $('cvSheet').removeAttribute('open'); });
  $('cvAlClear').addEventListener('click', function () { setF({ al: [], diet: [], ing: { m: F.ing.m, k: [] } }); });
  $('cvSheet').addEventListener('click', function (e) {
    if (e.target === this) { this.close(); return; }
    var cl = e.target.closest('[data-clear]');
    if (cl) { var w = cl.dataset.clear; setF({ al: w === 'al' ? [] : F.al, diet: w === 'diet' ? [] : F.diet, ing: { m: F.ing.m, k: w === 'ing' ? [] : F.ing.k } }); return; }
    var d = e.target.closest('[data-d]'), n = e.target.closest('[data-n]'), i = e.target.closest('[data-i]'), m = e.target.closest('[data-m]');
    if (d) setF({ al: F.al, diet: toggle(F.diet, d.dataset.d), ing: F.ing });
    else if (n) setF({ al: toggle(F.al, +n.dataset.n), diet: F.diet, ing: F.ing });
    else if (i) setF({ al: F.al, diet: F.diet, ing: { m: F.ing.m, k: toggle(F.ing.k, i.dataset.i) } });
    else if (m) setF({ al: F.al, diet: F.diet, ing: { m: m.dataset.m, k: F.ing.k } });
  });
  document.addEventListener('roce:lang', function () {
    var l = window.ROCE_I18N && window.ROCE_I18N.getLang();
    if (l && l !== L) { L = l; current = ''; render(); }
  });
  function goTo(secId, itemId) {
    closeMenu();
    if (secId !== cur) setSheet(secId);
    setTimeout(function () {
      var el = $(itemId); if (!el) return;
      var c = el.closest('.cv-cat'); if (c) openCat(c);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('is-flash'); void el.offsetWidth; el.classList.add('is-flash');
      setTimeout(function () { el.classList.remove('is-flash'); }, 2600);
    }, 80);
  }
  window.CARTA_API = { D: D, ING: ING, DIETS: DIETS, RE: RE, F: function () { return F; }, L: function () { return L; }, tx: tx, esc: esc, money: money, als: als, norm: norm, analyze: analyze, goTo: goTo, openFilters: openAl };
  render();
  if (landing) openMenu();
  document.dispatchEvent(new Event('carta:ready'));
})();
