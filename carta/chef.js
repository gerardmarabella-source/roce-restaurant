/* ROCE · Ayuda del chef: cuéntale qué te apetece (texto libre o respondiendo a unas preguntas) y propone un menú con lo que hay en la carta.
   Funciona en el propio navegador (sin enviar nada a ningún servidor): lee los ingredientes y alérgenos de menu.js y respeta tus filtros. */
(function () {
  'use strict';
  function start() {
    var A = window.CARTA_API; if (!A) return;
    var T = {
      es: {
        btn: 'Ayuda', h: 'Ayuda', p: 'Cuéntame qué te apetece y te preparo una propuesta con lo que hay en la carta.',
        ph: 'Ej: algo ligero con aguacate y un zumo', ex_h: 'Ideas', ex: ['Algo ligero y fresco', 'Tengo mucha hambre', 'Algo dulce', 'Un zumo para despertar', 'Vegetariano sin gluten', 'Con pollo, sin cebolla'],
        q_what: 'Cuéntame qué te apetece', q_when: '¿Para cuándo?', opt: 'opcional', when: [['breakfast', 'Desayuno'], ['lunch', 'Comida'], ['drink', 'Solo bebida']],
        q_hunger: '¿Cuánta hambre tienes?', hunger: [['light', 'Poca'], ['normal', 'Normal'], ['hungry', 'Mucha']],
        q_taste: '¿Dulce o salado?', taste: [['sweet', 'Dulce'], ['salty', 'Salado'], ['', 'Me da igual']],
        go: 'Recomiéndame', again: 'Otra propuesta', close: 'Cerrar', edit: 'Cambiar respuestas',
        filters: 'Respeto tus filtros activos', filters_edit: 'Cambiar filtros', hint: 'Escribe lo que te apetece o responde a las preguntas.',
        none: 'No he encontrado nada que encaje con tus filtros. Prueba a quitar alguno.', total: 'Total aproximado', see: 'Ver en la carta',
        slots: { starter: 'Para picar', main: 'Plato principal', light: 'Plato ligero', side: 'Acompañamiento', breakfast: 'Para desayunar', sweet: 'Algo dulce', drink: 'Para beber' },
        r_has: 'Lleva ', r_light: 'Ligero y fresco', r_hungry: 'Para ir con hambre', r_sweet: 'Dulce', r_protein: 'Con proteína', r_veg: 'Sin carne ni pescado', al_has: 'Alérgenos:', al_none: 'Sin alérgenos declarados.', r_pend: 'Los alérgenos de esta bebida los confirma el equipo.',
        miss: function (x) { return 'No encuentro «' + x + '» en esta parte de la carta; te propongo lo más parecido.'; },
        note: 'Propuesta orientativa. Comprueba los alérgenos con nuestro equipo.', res_h: 'Tu propuesta'
      },
      en: {
        btn: 'Help', h: 'Help', p: 'Tell me what you fancy and I will put together a suggestion from our menu.',
        ph: 'E.g. something light with avocado and a juice', ex_h: 'Ideas', ex: ['Something light and fresh', 'I am very hungry', 'Something sweet', 'A juice to wake up', 'Vegetarian gluten-free', 'With chicken, no onion'],
        q_what: 'Tell me what you fancy', q_when: 'When?', opt: 'optional', when: [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['drink', 'Just a drink']],
        q_hunger: 'How hungry are you?', hunger: [['light', 'A little'], ['normal', 'Normal'], ['hungry', 'Very']],
        q_taste: 'Sweet or savoury?', taste: [['sweet', 'Sweet'], ['salty', 'Savoury'], ['', 'Either']],
        go: 'Suggest', again: 'Another suggestion', close: 'Close', edit: 'Change answers',
        filters: 'Respecting your active filters', filters_edit: 'Change filters', hint: 'Type what you fancy or answer the questions.',
        none: 'I found nothing that fits your filters. Try removing one.', total: 'Approx. total', see: 'See on the menu',
        slots: { starter: 'To share', main: 'Main dish', light: 'Light dish', side: 'Side', breakfast: 'For breakfast', sweet: 'Something sweet', drink: 'To drink' },
        r_has: 'Contains ', r_light: 'Light and fresh', r_hungry: 'For a big appetite', r_sweet: 'Sweet', r_protein: 'With protein', r_veg: 'No meat or fish', al_has: 'Allergens:', al_none: 'No declared allergens.', r_pend: 'Our team confirms the allergens of this drink.',
        miss: function (x) { return 'I cannot find "' + x + '" in this part of the menu; here is the closest.'; },
        note: 'Indicative suggestion. Please check allergens with our team.', res_h: 'Your suggestion'
      }
    };
    var st = { when: '', hunger: '', taste: '', text: '', seed: 0, result: null };
    var $ = function (id) { return document.getElementById(id); };
    var esc = A.esc, norm = A.norm;
    var t = function (k) { return T[A.L()][k]; };

    /* ── Catálogo ── */
    var KIND = { 'tostadas': 'toast', 'acai & yogur': 'sweet', 'sandwiches': 'sandwich', 'starters': 'starter', 'pokes': 'bowl', 'platos roce': 'main', 'acompanamientos': 'side', 'extras': 'extra', 'cafes': 'coffee', 'tes & infusiones': 'tea', 'smoothies': 'smoothie', 'zumos naturales': 'juice' };
    var DRINK = ['juice', 'smoothie', 'coffee', 'tea'];
    function catalogue() {
      var out = [];
      A.D.sections.forEach(function (s, si) {
        if (s.soon) return;
        s.groups.forEach(function (g, gi) {
          g.blocks.forEach(function (b, bi) {
            var kind = KIND[norm(b.title.es)] || 'other';
            if (kind === 'extra') return;
            b.items.forEach(function (it, n) { out.push({ it: it, blk: b, sec: s.id, kind: kind, id: 'it-c' + si + gi + bi + '-' + n }); });
          });
        });
      });
      return out;
    }
    function ev(it, blk, FF) {
      var a = A.analyze(it, blk), hide = false, pend = false;
      if (FF.al.length) { if ((it.al || []).some(function (x) { return FF.al.indexOf(x) !== -1; })) hide = true; else if (blk.alPending) pend = true; }
      FF.diet.forEach(function (k) { var v = a.dt[k]; if (v === 'n') hide = true; else if (v !== 'y') pend = true; });
      if (FF.ing.length) { if (FF.ing.some(function (k) { return a.ing.indexOf(k) !== -1; })) hide = true; else if (blk.alPending && !a.text) pend = true; }
      return { hide: hide, pend: pend };
    }

    /* ── Entender lo que escribes ── */
    function parse(text) {
      var n = ' ' + norm(text) + ' ', diets = [], excl = [], wants = [], f = {};
      n = n.replace(/\b(sin|without|no)\s+(gluten|lactosa|lacteos|leche|dairy)\b/g, function (m, a, w) { diets.push(w === 'gluten' ? 'gf' : 'lf'); return ' '; });
      n = n.replace(/\b(sin|without)\s+([a-z]+)/g, function (m, a, x) {
        A.ING.forEach(function (g) { var en = norm(g.en).split(/\s*\/\s*/); if (g.re.test(x) || en.indexOf(x) !== -1) excl.push(g.k); });
        return ' ';
      });
      if (/gluten.?free|celiac|celiaco/.test(n)) diets.push('gf');
      if (/dairy.?free|lactose|lactosa/.test(n)) diets.push('lf');
      if (/vegetarian/.test(n)) diets.push('veg');
      if (/vegan/.test(n)) diets.push('vegan');
      if (/pescetarian|pescatarian/.test(n)) diets.push('pesc');
      A.ING.forEach(function (g) {
        var en = norm(g.en).split(/\s*\/\s*/).filter(function (w) { return w.length > 2; });
        if (excl.indexOf(g.k) === -1 && (g.re.test(n) || en.some(function (w) { return new RegExp('\\b' + w + '\\b').test(n); }))) wants.push(g.k);
      });
      f.light = /ligero|fresco|light|sano|fresh|healthy/.test(n); f.hungry = /hambre|contundente|mucho|grande|hungry|big|hearty/.test(n);
      f.sweet = /dulce|postre|sweet|dessert/.test(n); f.salty = /salado|savou?ry|salty/.test(n); f.protein = /proteina|protein/.test(n);
      f.juice = /zumo|jugo|juice/.test(n); f.smoothie = /smoothie|batido/.test(n); f.coffee = /cafe|coffee|latte|espresso/.test(n); f.tea = /\bte\b|infusion|matcha|tea\b/.test(n);
      f.drinkAny = f.juice || f.smoothie || f.coffee || f.tea || /bebida|beber|drink|refresc/.test(n);
      f.food = /comer|plato|tostada|desayun|comida|brunch|hambre|sandwich|bowl|poke|ensalada|cenar|almorz|lunch|breakfast|eat|dish/.test(n);
      f.breakfast = /desayun|tostada|acai|breakfast|manana|morning/.test(n);
      var words = n.split(/[^a-z]+/).filter(function (w) { return w.length >= 5; });
      return { diets: diets, excl: excl, wants: wants, f: f, words: words };
    }

    /* ── Proponer ── */
    function propose(seed) {
      var P = parse(st.text), G = A.F(), f = P.f;
      var FF = { al: G.al, diet: G.diet.concat(P.diets.filter(function (d) { return G.diet.indexOf(d) === -1; })), ing: (G.ing.m === 'sin' ? G.ing.k : []).concat(P.excl) };
      var wants = P.wants.concat(G.ing.m === 'con' ? G.ing.k : []);
      var hungry = st.hunger === 'hungry' || (!st.hunger && f.hungry), light = st.hunger === 'light' || (!st.hunger && f.light);
      var sweet = st.taste === 'sweet' || (!st.taste && f.sweet), salty = st.taste === 'salty' || (!st.taste && f.salty);
      var cat = catalogue().map(function (c) { var e = ev(c.it, c.blk, FF); c.hide = e.hide; c.pend = e.pend; return c; }).filter(function (c) { return !c.hide; });
      var foodWants = wants.some(function (k) { return cat.some(function (c) { return DRINK.indexOf(c.kind) === -1 && A.analyze(c.it, c.blk).ing.indexOf(k) !== -1; }); });
      var when = st.when || (f.drinkAny && !f.food && !f.light && !f.hungry && !foodWants ? 'drink' : f.breakfast ? 'breakfast' : 'lunch');
      var missing = {};
      function score(c, kinds) {
        var a = A.analyze(c.it, c.blk), s = 0, txt = norm([c.it.name, c.it.es, c.it.tag && c.it.tag.es].join(' '));
        wants.forEach(function (k) { if (a.ing.indexOf(k) !== -1) s += 4; });
        P.words.forEach(function (w) { if (txt.indexOf(w) !== -1) s += 1; });
        if (f.protein && a.ing.some(function (k) { return ['pollo', 'ternera', 'pato', 'salmon', 'atun', 'huevo', 'falafel', 'queso'].indexOf(k) !== -1; })) s += 2;
        if (light && ['bowl', 'starter', 'toast', 'sweet'].indexOf(c.kind) !== -1) s += 2;
        if (hungry && ['main', 'sandwich'].indexOf(c.kind) !== -1) s += 2;
        if (sweet && (c.kind === 'sweet' || c.kind === 'smoothie' || c.kind === 'juice')) s += 2;
        if (salty && ['sweet', 'smoothie'].indexOf(c.kind) === -1) s += 1;
        if (c.pend) s -= 2;
        return s;
      }
      var used = {};
      function pick(kinds, label, n, off) {
        var cands = cat.filter(function (c) { return kinds.indexOf(c.kind) !== -1 && !used[c.id]; }).map(function (c) { c.s = score(c, kinds); return c; });
        if (!cands.length) return null;
        cands.sort(function (a, b) { return b.s - a.s || String(a.it.name).localeCompare(String(b.it.name)); });
        var top = cands[0].s, pool = top > 0 ? cands.filter(function (c) { return c.s >= top - 1; }) : cands.slice(0, 4);
        pool = pool.slice(0, 4);
        var out = [];
        for (var i = 0; i < (n || 1) && pool.length; i++) { var c = pool.splice((seed + (off || 0) + i) % pool.length, 1)[0]; used[c.id] = 1; out.push(c); }
        return { label: label, items: out };
      }
      var slots = [], drinkKinds = f.juice ? ['juice'] : f.smoothie ? ['smoothie'] : f.coffee ? ['coffee'] : f.tea ? ['tea'] : (sweet ? ['smoothie', 'juice'] : DRINK);
      if (when === 'drink') { var d = pick(drinkKinds.length < 4 && !f.drinkAny ? DRINK : drinkKinds, 'drink', 3, 0); if (d) slots.push(d); }
      else {
        if (when === 'breakfast') {
          if (sweet) slots.push(pick(['sweet'], 'sweet', 1, 0)); else slots.push(pick(['toast', 'sandwich'], 'breakfast', 1, 0));
          if (hungry) slots.push(pick(sweet ? ['toast'] : ['sweet'], sweet ? 'breakfast' : 'sweet', 1, 1));
        } else {
          if (sweet && !hungry) slots.push(pick(['sweet'], 'sweet', 1, 0));
          else if (light) slots.push(pick(['bowl', 'starter'], 'light', 1, 0));
          else if (hungry) { slots.push(pick(['starter'], 'starter', 1, 0)); slots.push(pick(['main', 'sandwich', 'bowl'], 'main', 1, 0)); slots.push(pick(['side'], 'side', 1, 0)); }
          else slots.push(pick(['main', 'bowl', 'sandwich'], 'main', 1, 0));
        }
        slots.push(pick(drinkKinds, 'drink', 1, 1));
      }
      slots = slots.filter(function (s) { return s && s.items.length; });
      var picked = []; slots.forEach(function (s) { picked = picked.concat(s.items); });
      wants.forEach(function (k) { if (!picked.some(function (c) { return A.analyze(c.it, c.blk).ing.indexOf(k) !== -1; })) missing[k] = 1; });
      var miss = Object.keys(missing).map(function (k) { var g = A.ING.filter(function (x) { return x.k === k; })[0]; return g ? A.tx(g) : k; });
      return { slots: slots, miss: miss, FF: FF, wants: wants, light: light, hungry: hungry, sweet: sweet };
    }
    function price(c) { var p = c.it.price; return Array.isArray(p) ? p[0] : (p || 0); }
    function reason(c, R) {
      var a = A.analyze(c.it, c.blk), has = R.wants.filter(function (k) { return a.ing.indexOf(k) !== -1; }).map(function (k) { return A.tx(A.ING.filter(function (x) { return x.k === k; })[0]).toLowerCase(); });
      if (has.length) return t('r_has') + has.join(', ');
      if (c.kind === 'sweet' || (R.sweet && (c.kind === 'smoothie' || c.kind === 'juice'))) return t('r_sweet');
      if (R.light && ['bowl', 'starter', 'toast'].indexOf(c.kind) !== -1) return t('r_light');
      if (R.hungry && ['main', 'sandwich'].indexOf(c.kind) !== -1) return t('r_hungry');
      var tg = c.it.tag && A.tx(c.it.tag); return tg || '';
    }
    function allergenLine(c) {
      var al = c.it.al || [];
      if (!al.length) return c.blk.alPending ? '' : '<p class="cv-pl-al">' + esc(t('al_none')) + '</p>';
      return '<p class="cv-pl-al"><b>' + esc(t('al_has')) + '</b> ' + al.map(function (n) { return '<span class="cv-al">' + n + '</span> ' + esc(A.tx(A.D.allergens[n - 1])); }).join(' · ') + '</p>';
    }
    function pendTxt(c) { return c.pend ? t('r_pend') : '';
    }

    /* ── Pantalla ── */
    function chips(key, list) { return '<div class="cv-opts" data-q="' + key + '">' + list.map(function (o) { return '<button type="button" class="cv-opt" data-v="' + o[0] + '" aria-pressed="' + (st[key] === o[0]) + '"><i></i>' + esc(o[1]) + '</button>'; }).join('') + '</div>'; }
    function step(n, title, body, optional) {
      return '<section class="cv-step"><div class="cv-step-h"><span class="cv-step-n">' + n + '</span><h3>' + esc(title) + (optional ? ' <small>' + esc(t('opt')) + '</small>' : '') + '</h3></div>' + body + '</section>';
    }
    function form() {
      var G = A.F(), n = G.al.length + G.diet.length + G.ing.k.length;
      return '<h2 id="cvChefTitle">' + esc(t('h')) + '</h2><p class="cv-chef-p">' + esc(t('p')) + '</p>' +
        step(1, t('q_what'), '<textarea id="cvChefText" rows="2" placeholder="' + esc(t('ph')) + '">' + esc(st.text) + '</textarea>' +
          '<div class="cv-ideas">' + t('ex').map(function (x) { return '<button type="button" class="cv-chip" data-ex="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>') +
        step(2, t('q_when'), chips('when', t('when')), true) +
        step(3, t('q_hunger'), chips('hunger', t('hunger')), true) +
        step(4, t('q_taste'), chips('taste', t('taste')), true) +
        (n ? '<p class="cv-fs-note">' + esc(t('filters')) + ' · <button type="button" class="cv-link" id="cvChefFilters">' + esc(t('filters_edit')) + '</button></p>' : '');
    }
    function results() {
      var R = st.result, total = 0, idx = 0;
      var h = '<h2 id="cvChefTitle">' + esc(t('res_h')) + '</h2>';
      if (!R.slots.length) return h + '<p>' + esc(t('none')) + '</p>';
      if (R.miss.length) h += '<p class="cv-fs-note">' + esc(t('miss')(R.miss.join(', '))) + '</p>';
      h += '<ul class="cv-pick-list">';
      R.slots.forEach(function (s) {
        s.items.forEach(function (c) {
          total += price(c);
          h += '<li class="cv-slot-' + s.label + '"><p class="cv-pl-slot"><span class="cv-pl-n">' + (++idx) + '</span>' + esc(t('slots')[s.label]) + '</p><div class="cv-pl-top"><b>' + esc((c.it.code && c.it.code !== c.it.name ? c.it.code + ' ' : '') + c.it.name) + '</b><span>' + esc(A.money(c.it.price)) + '</span></div>' +
            (c.it.es ? '<p class="cv-pl-desc">' + esc(A.tx({ es: c.it.es, en: c.it.en })) + '</p>' : '') +
            (reason(c, R) ? '<p class="cv-pl-why">' + esc(reason(c, R)) + '</p>' : '') + (pendTxt(c) ? '<p class="cv-fs-note">' + esc(pendTxt(c)) + '</p>' : '') + allergenLine(c) +
            '<button type="button" class="cv-link" data-go="' + c.sec + '|' + c.id + '">' + esc(t('see')) + ' →</button></li>';
        });
      });
      h += '</ul><p class="cv-pl-total">' + esc(t('total')) + ': <b>' + esc(A.money(Math.round(total * 100) / 100)) + '</b></p><p class="cv-fs-note">' + esc(t('note')) + '</p>';
      return h;
    }
    function paint() {
      var d = $('cvChef'); $('cvChefBtnLabel').textContent = t('btn');
      $('cvChefBody').innerHTML = st.result ? results() : form();
      $('cvChefClose').textContent = st.result ? t('edit') : t('close');
      $('cvChefGo').textContent = st.result ? t('again') : t('go');
    }
    function open() { st.result = null; paint(); var d = $('cvChef'); if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
    function close() { var d = $('cvChef'); if (d.close) d.close(); else d.removeAttribute('open'); }
    function run(again) {
      var ta = $('cvChefText'); if (ta) st.text = ta.value;
      if (!st.result && !st.text.trim() && !st.when && !st.hunger && !st.taste) { var n = $('cvChefBody').querySelector('p'); if (n) n.textContent = t('hint'); return; }
      st.seed = again ? st.seed + 1 : 0; st.result = propose(st.seed); paint(); $('cvChef').scrollTop = 0; var b = $('cvChefBody'); if (b) b.scrollTop = 0;
    }

    $('cvChefBtn').addEventListener('click', open);
    $('cvChefClose').addEventListener('click', function () { if (st.result) { st.result = null; paint(); } else close(); });
    $('cvChefGo').addEventListener('click', function () { run(!!st.result); });
    $('cvChef').addEventListener('click', function (e) {
      if (e.target === this) { close(); return; }
      var o = e.target.closest('.cv-opt'), x = e.target.closest('[data-ex]'), g = e.target.closest('[data-go]');
      if (o) { var k = o.parentNode.dataset.q; st[k] = st[k] === o.dataset.v && o.dataset.v !== '' ? '' : o.dataset.v; var ta = $('cvChefText'); if (ta) st.text = ta.value; paint(); }
      else if (x) { var ta2 = $('cvChefText'); st.text = x.dataset.ex; ta2.value = st.text; ta2.focus(); }
      else if (g) { var p = g.dataset.go.split('|'); close(); A.goTo(p[0], p[1]); }
      else if (e.target.id === 'cvChefFilters') { close(); A.openFilters(); }
    });
    document.addEventListener('roce:lang', function () { if ($('cvChef').open) { st.result = null; } paint(); });
    paint();
  }
  if (window.CARTA_API) start(); else document.addEventListener('carta:ready', start, { once: true });
})();
