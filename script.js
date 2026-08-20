// Las piezas del logo (R, O, C, E, ®) caen con gravedad, cada una se puede
// arrastrar y lanzar por separado (física propia, sin librerías).
function initLogoGravity() {
  const stage = document.getElementById('physicsStage');
  if (!stage) return;
  const pieces = Array.from(stage.querySelectorAll('.phys-piece'));
  if (!pieces.length) return;

  const allLoaded = pieces.every((el) => el.complete && el.offsetWidth > 0);
  if (!allLoaded) {
    let remaining = pieces.length;
    pieces.forEach((el) => {
      if (el.complete) { remaining -= 1; return; }
      el.addEventListener('load', () => {
        remaining -= 1;
        if (remaining <= 0) initLogoGravity();
      }, { once: true });
    });
    if (remaining > 0) return;
  }

  const GRAVITY = 2400; // px/s²
  const FLOOR_RESTITUTION = 0.3;
  const WALL_RESTITUTION = 0.35;
  const SETTLE_VELOCITY = 60;
  const MAX_DT = 0.05; // clamp so a slow/late frame can't move things too far
  const CAPTION_RESERVE = 0.24; // leave room at the bottom for the address text

  function stageSize() {
    const r = stage.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  let { w: stageW, h: stageH } = stageSize();

  const items = pieces.map((el, i) => {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const slot = stageW / pieces.length;
    return {
      el, w, h,
      x: slot * i + (slot - w) / 2,
      y: -h - 60 - i * (h * 1.6),
      vx: 0, vy: 0,
      angle: Math.random() * 14 - 7,
      angularVel: 0,
      dragging: false,
      grabDX: 0, grabDY: 0,
      history: [],
    };
  });

  function render(item) {
    item.el.style.transform = `translate(${item.x}px, ${item.y}px) rotate(${item.angle}deg)`;
  }

  // A single "what's being dragged" reference, with move/up listeners on
  // window rather than per-element pointerId tracking — robust against
  // automated/synthetic input where down/up pointerIds don't always match.
  let activeItem = null;

  items.forEach((item) => {
    item.el.style.cursor = 'grab';
    item.el.addEventListener('pointerdown', (e) => {
      activeItem = item;
      item.dragging = true;
      item.vx = 0;
      item.vy = 0;
      item.angularVel = 0;
      item.history = [];
      const stageRect = stage.getBoundingClientRect();
      item.grabDX = e.clientX - stageRect.left - item.x;
      item.grabDY = e.clientY - stageRect.top - item.y;
      item.el.style.cursor = 'grabbing';
      item.el.style.zIndex = '5';
      e.preventDefault();
    });
  });

  window.addEventListener('pointermove', (e) => {
    if (!activeItem) return;
    const stageRect = stage.getBoundingClientRect();
    const now = performance.now();
    const margin = 120; // allow a little overdrag past the edges, but bounded
    activeItem.x = Math.max(-margin, Math.min(stageW + margin - activeItem.w, e.clientX - stageRect.left - activeItem.grabDX));
    activeItem.y = Math.max(-margin, Math.min(stageH + margin - activeItem.h, e.clientY - stageRect.top - activeItem.grabDY));
    activeItem.history.push({ x: activeItem.x, y: activeItem.y, t: now });
    if (activeItem.history.length > 5) activeItem.history.shift();
    render(activeItem);
  });

  function release() {
    if (!activeItem) return;
    const item = activeItem;
    item.dragging = false;
    item.el.style.cursor = 'grab';
    const h = item.history;
    if (h.length >= 2) {
      const first = h[0];
      const last = h[h.length - 1];
      const dt = Math.max((last.t - first.t) / 1000, 0.001);
      item.vx = (last.x - first.x) / dt;
      item.vy = (last.y - first.y) / dt;
    }
    activeItem = null;
  }

  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('blur', release);

  window.addEventListener('resize', () => {
    ({ w: stageW, h: stageH } = stageSize());
  });
  // Dispatched by initArchScroll whenever it resizes the arch on scroll —
  // separate from 'resize' so the two don't trigger each other in a loop.
  window.addEventListener('archresize', () => {
    ({ w: stageW, h: stageH } = stageSize());
  });

  let last = performance.now();

  function tick() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;

    items.forEach((item) => {
      if (item.dragging) return;

      item.vy += GRAVITY * dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.angle += item.angularVel * dt;
      item.angularVel *= 0.985;

      const floor = stageH - item.h - stageH * CAPTION_RESERVE;
      if (item.y > floor) {
        item.y = floor;
        if (Math.abs(item.vy) > SETTLE_VELOCITY) {
          item.vy = -item.vy * FLOOR_RESTITUTION;
          item.angularVel += item.vx * 0.05;
        } else {
          item.vy = 0;
        }
        item.vx *= 0.82;
      }

      if (item.x < 0) {
        item.x = 0;
        item.vx = -item.vx * WALL_RESTITUTION;
      } else if (item.x + item.w > stageW) {
        item.x = stageW - item.w;
        item.vx = -item.vx * WALL_RESTITUTION;
      }

      render(item);
    });

    setTimeout(tick, 1000 / 60);
  }
  tick();
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Progreso 0→1 de una sección "pin-and-scroll": el wrapper es mucho más
// alto que el viewport, y su hijo .xxx-sticky queda fijo (position:
// sticky) mientras se recorre esa altura extra — así el contenido
// permanece en pantalla en vez de desplazarse con el resto de la página.
function pinnedProgress(wrapper) {
  const range = wrapper.offsetHeight - window.innerHeight;
  const scrolledInto = -wrapper.getBoundingClientRect().top;
  return range > 0 ? Math.min(Math.max(scrolledInto / range, 0), 1) : 0;
}

// El arco crece con el scroll hasta ocupar toda la pantalla (como en
// brutal.restaurant) — el badge de apertura sólo aparece al final de ese
// recorrido, cuando ya está a pantalla completa.
function initArchScroll() {
  const wrapper = document.getElementById('heroWrapper');
  const archFrame = document.querySelector('.arch-frame');
  const caption = document.getElementById('archCaption');
  const badge = document.getElementById('heroInfo');
  if (!wrapper || !archFrame) return;

  function baseSize() {
    return {
      w: Math.min(680, window.innerWidth * 0.88),
      h: Math.min(window.innerHeight * 0.64, 560),
    };
  }

  function update() {
    const raw = pinnedProgress(wrapper);
    // El arco llega a pantalla completa en el primer 80% del recorrido;
    // el 20% restante es scroll "muerto" a propósito, para que se quede
    // fijo a pantalla completa un momento antes de soltar al manifiesto.
    const ACTIVE_SPAN = 0.8;
    const activeRaw = Math.min(raw / ACTIVE_SPAN, 1);
    const progress = activeRaw * activeRaw; // ease-in: sutil al principio, más notable después
    const base = baseSize();
    // A pantalla completa de verdad al final del recorrido.
    archFrame.style.width = `${base.w + (window.innerWidth - base.w) * progress}px`;
    archFrame.style.height = `${base.h + (window.innerHeight - base.h) * progress}px`;
    // El arco pierde su forma curva al llegar a pantalla completa.
    const radius = 22 * (1 - progress);
    archFrame.style.borderRadius = `50% 50% 0 0 / ${radius}% ${radius}% 0 0`;
    if (caption) caption.style.opacity = String(1 - Math.min(progress * 1.6, 1));
    if (badge) badge.style.opacity = String(Math.max((raw - 0.75) / 0.25, 0));
    window.dispatchEvent(new Event('archresize'));
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

// Las palabras de "todo empieza con un ROCE" caen una a una, ligadas al
// scroll (no a un temporizador): la sección queda fija en pantalla
// mientras cada palabra ocupa su propio tramo del recorrido.
function initManifestoFall() {
  const wrapper = document.getElementById('manifestoWrapper');
  const words = wrapper ? Array.from(wrapper.querySelectorAll('.fall-word')) : [];
  if (!wrapper || !words.length) return;

  const DROP = 650;
  // Pesos del tramo de scroll de cada palabra — el logo (última) tiene un
  // tramo mucho más ancho, así que baja más despacio que el resto. Las
  // palabras normales suben de 1 a 1.6 (más despacio); la altura del
  // wrapper se compensa para que el logo no pierda su duración absoluta.
  const weights = words.map((_, i) => (i === words.length - 1 ? 3.1 : 1.6));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  // La caída ocupa solo el primer 80% del recorrido del wrapper — el 20%
  // restante es scroll "muerto" a propósito, para que el manifiesto ya
  // asentado se quede fijo un momento antes de soltar a experiencia.
  const ACTIVE_SPAN = 0.8;
  const segments = [];
  let acc = 0;
  weights.forEach((w) => {
    segments.push([(acc / totalWeight) * ACTIVE_SPAN, ((acc + w) / totalWeight) * ACTIVE_SPAN]);
    acc += w;
  });

  function update() {
    const overall = pinnedProgress(wrapper);
    words.forEach((word, i) => {
      const [segStart, segEnd] = segments[i];
      const local = Math.min(Math.max((overall - segStart) / (segEnd - segStart), 0), 1);
      // Lineal a propósito: con un ease-out el movimiento se "termina" de
      // ver mucho antes de que el scroll acabe, dejando un tramo donde no
      // pasa nada — con progreso lineal el trayecto se nota todo el rato.
      word.style.transform = `translateY(${(1 - local) * -DROP}px)`;
      // Opacidad ligada al mismo progreso: garantiza que la palabra/logo
      // sea invisible hasta que su tramo de scroll haya empezado de
      // verdad, sin depender de que el clipping/stacking sea perfecto.
      word.style.opacity = local;
    });
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

// Cada tarjeta de "Experiencia" entra deslizándose desde un lado (alternando
// izquierda/derecha), su posición ligada directamente al scroll — no a un
// disparador de una sola vez.
function initPillarsReveal() {
  const wrapper = document.getElementById('pillarsWrapper');
  const cards = wrapper ? Array.from(wrapper.querySelectorAll('.pillar-card')) : [];
  if (!wrapper || !cards.length) return;

  const DIST = 130;

  function update() {
    const overall = pinnedProgress(wrapper);
    const n = cards.length;
    cards.forEach((card, i) => {
      const segStart = i / n;
      const segEnd = (i + 1) / n;
      const local = Math.min(Math.max((overall - segStart) / (segEnd - segStart), 0), 1);
      // Lineal a propósito (igual que el manifiesto): con ease-out la
      // tarjeta se coloca casi del todo en el primer tercio del tramo y
      // luego se queda quieta el resto, dando sensación de entrada rara.
      const dir = i % 2 === 0 ? -1 : 1;
      card.style.transform = `translateX(${(1 - local) * dir * DIST}px)`;
      card.style.opacity = String(0.1 + local * 0.9);
    });
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

// "Reserva tu mesa": el fondo rojo se expande hasta cubrir toda la
// pantalla, el título crece "desde atrás" y, al final, el botón cae de
// golpe como un misil que rebota al aterrizar (una sola vez).
function initReserveReveal() {
  const wrapper = document.getElementById('reserveWrapper');
  const bg = document.getElementById('reserveBg');
  const title = document.getElementById('reserveTitle');
  const cta = document.getElementById('reserveCta');
  if (!wrapper || !bg || !title || !cta) return;

  let bounced = false;
  let maxProgress = 0; // una vez revelado, no vuelve atrás si subes el scroll

  function update() {
    maxProgress = Math.max(maxProgress, pinnedProgress(wrapper));
    const overall = maxProgress;

    // El fondo es un círculo que crece hasta cubrir toda la pantalla.
    // En móvil, +30% adicional solo para esta fase (fondo rojo), sin tocar
    // título/botón ni el escritorio.
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    const bgLocal = Math.min(overall / (isMobile ? 0.45 * 1.3 : 0.45), 1);
    bg.style.transform = `scale(${easeOutCubic(bgLocal) * 3})`;

    // El título aparece agrandándose, como si emergiera desde atrás.
    const titleLocal = Math.min(Math.max((overall - 0.28) / 0.32, 0), 1);
    const titleEased = easeOutCubic(titleLocal);
    title.style.opacity = String(titleEased);
    title.style.transform = `scale(${0.25 + titleEased * 0.75})`;

    // El botón cae como un misil una única vez, al llegar a este punto.
    // A partir de aquí (overall ~0.65) el resto del scroll del wrapper es
    // recorrido "muerto" a propósito: la pantalla roja se queda fija un
    // momento antes de soltar a la siguiente sección.
    if (overall > 0.65 && !bounced) {
      bounced = true;
      cta.classList.add('bounce-in');
    }
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

// Widget de newsletter fijo y permanente (reaparece en cada visita — no se
// guarda que se cerró). Sin backend todavía, así que el envío solo confirma
// visualmente — falta conectarlo a un servicio real (Mailchimp, Brevo,
// etc.) para guardar los emails de verdad.
function initNewsletterWidget() {
  const widget = document.getElementById('newsletterWidget');
  const closeBtn = document.getElementById('newsletterClose');
  const form = document.getElementById('newsletterForm');
  const body = document.getElementById('newsletterBody');
  if (!widget || !closeBtn || !form || !body) return;

  closeBtn.addEventListener('click', () => {
    widget.classList.add('is-hidden');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    body.innerHTML = '<p class="newsletter-thanks">¡Gracias! Te avisaremos antes de la apertura.</p>';
  });
}

function whenStageIsLaidOut(callback, attempts = 0) {
  const stage = document.getElementById('physicsStage');
  const rect = stage && stage.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) {
    callback();
  } else if (attempts < 20) {
    setTimeout(() => whenStageIsLaidOut(callback, attempts + 1), 50);
  }
}

// El botón "Reservar" del header salta directo al tramo de la sección de
// reserva donde el fondo rojo, el título y el botón ya están desplegados,
// en vez de al principio del recorrido fijado (que arrancaría en blanco).
function initReserveJumpLink() {
  const link = document.querySelector('a[href="#contacto"]');
  const wrapper = document.getElementById('reserveWrapper');
  if (!link || !wrapper) return;

  link.addEventListener('click', (e) => {
    e.preventDefault();
    const range = wrapper.offsetHeight - window.innerHeight;
    const target = wrapper.offsetTop + range * 0.8;
    window.scrollTo({ top: target, behavior: 'smooth' });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  whenStageIsLaidOut(initLogoGravity);
  initArchScroll();
  initManifestoFall();
  initPillarsReveal();
  initReserveReveal();
  initReserveJumpLink();
  initNewsletterWidget();
});
