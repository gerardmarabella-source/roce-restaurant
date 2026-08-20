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

// El arco crece con el scroll (como en brutal.restaurant) — cuanto más
// bajas, más grande y más pantalla libre para arrastrar las letras. El
// texto de dirección se desvanece al mismo ritmo.
function initArchScroll() {
  const wrapper = document.getElementById('heroWrapper');
  const archFrame = document.querySelector('.arch-frame');
  const caption = document.getElementById('archCaption');
  if (!wrapper || !archFrame) return;

  function baseSize() {
    return {
      w: Math.min(680, window.innerWidth * 0.88),
      h: Math.min(window.innerHeight * 0.64, 560),
    };
  }

  function maxSize() {
    return {
      w: Math.min(window.innerWidth * 0.98, 1400),
      h: Math.min(window.innerHeight * 0.98, 1100),
    };
  }

  function update() {
    // El wrapper es mucho más alto que el viewport; .hero-sticky queda
    // fijo (position: sticky) mientras se recorre esa altura extra, así
    // que el arco permanece en pantalla en vez de desplazarse con el resto.
    const range = wrapper.offsetHeight - window.innerHeight;
    const scrolledInto = -wrapper.getBoundingClientRect().top;
    const raw = range > 0 ? Math.min(Math.max(scrolledInto / range, 0), 1) : 0;
    const progress = raw * raw; // ease-in: sutil al principio, más notable después
    const base = baseSize();
    const max = maxSize();
    archFrame.style.width = `${base.w + (max.w - base.w) * progress}px`;
    archFrame.style.height = `${base.h + (max.h - base.h) * progress}px`;
    if (caption) caption.style.opacity = String(1 - progress);
    window.dispatchEvent(new Event('archresize'));
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

// Las palabras del manifiesto caen del cielo (como con gravedad) cuando
// la sección entra en la pantalla al hacer scroll.
function initManifestoFall() {
  const section = document.getElementById('manifestoSection');
  if (!section || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          section.classList.add('in-view');
          observer.unobserve(section);
        }
      });
    },
    { threshold: 0.3 }
  );
  observer.observe(section);
}

// Widget de newsletter fijo: sin backend todavía, así que el envío solo
// confirma visualmente — falta conectarlo a un servicio real (Mailchimp,
// Brevo, etc.) para guardar los emails de verdad.
function initNewsletterWidget() {
  const widget = document.getElementById('newsletterWidget');
  const closeBtn = document.getElementById('newsletterClose');
  const form = document.getElementById('newsletterForm');
  const body = document.getElementById('newsletterBody');
  if (!widget || !closeBtn || !form || !body) return;

  if (localStorage.getItem('roce-newsletter-dismissed') === '1') {
    widget.classList.add('is-hidden');
    return;
  }

  closeBtn.addEventListener('click', () => {
    widget.classList.add('is-hidden');
    localStorage.setItem('roce-newsletter-dismissed', '1');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    body.innerHTML = '<p class="newsletter-thanks">¡Gracias! Te avisaremos antes de la apertura.</p>';
    localStorage.setItem('roce-newsletter-dismissed', '1');
    setTimeout(() => widget.classList.add('is-hidden'), 2200);
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

document.addEventListener('DOMContentLoaded', () => {
  whenStageIsLaidOut(initLogoGravity);
  initArchScroll();
  initManifestoFall();
  initNewsletterWidget();
});
