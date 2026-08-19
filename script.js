// El logo real cae con gravedad y se puede arrastrar y lanzar con el
// puntero (física propia, sin librerías): rebota suave contra el suelo y
// las paredes del arco.
function initLogoGravity() {
  const stage = document.getElementById('physicsStage');
  const logo = document.getElementById('physLogo');
  if (!stage || !logo) return;

  if (!logo.complete || logo.offsetWidth === 0) {
    logo.addEventListener('load', () => initLogoGravity(), { once: true });
    return;
  }

  const GRAVITY = 2400; // px/s²
  const FLOOR_RESTITUTION = 0.3;
  const WALL_RESTITUTION = 0.35;
  const SETTLE_VELOCITY = 60;
  const MAX_DT = 0.05; // clamp so a slow/late frame can't move things too far

  function stageSize() {
    const r = stage.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  let { w: stageW, h: stageH } = stageSize();

  const w = logo.offsetWidth;
  const h = logo.offsetHeight;
  const item = {
    el: logo, w, h,
    x: (stageW - w) / 2,
    y: -h - 40,
    vx: 0, vy: 0,
    angle: -6,
    angularVel: 0,
    dragging: false,
    grabDX: 0, grabDY: 0,
    history: [],
  };

  function render() {
    item.el.style.transform = `translate(${item.x}px, ${item.y}px) rotate(${item.angle}deg)`;
  }

  item.el.style.cursor = 'grab';
  item.el.addEventListener('pointerdown', (e) => {
    item.dragging = true;
    item.vx = 0;
    item.vy = 0;
    item.angularVel = 0;
    item.history = [];
    const stageRect = stage.getBoundingClientRect();
    item.grabDX = e.clientX - stageRect.left - item.x;
    item.grabDY = e.clientY - stageRect.top - item.y;
    item.el.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('pointermove', (e) => {
    if (!item.dragging) return;
    const stageRect = stage.getBoundingClientRect();
    const now = performance.now();
    const margin = 120; // allow a little overdrag past the edges, but bounded
    item.x = Math.max(-margin, Math.min(stageW + margin - item.w, e.clientX - stageRect.left - item.grabDX));
    item.y = Math.max(-margin, Math.min(stageH + margin - item.h, e.clientY - stageRect.top - item.grabDY));
    item.history.push({ x: item.x, y: item.y, t: now });
    if (item.history.length > 5) item.history.shift();
    render();
  });

  function release() {
    if (!item.dragging) return;
    item.dragging = false;
    item.el.style.cursor = 'grab';
    const h2 = item.history;
    if (h2.length >= 2) {
      const first = h2[0];
      const last = h2[h2.length - 1];
      const dt = Math.max((last.t - first.t) / 1000, 0.001);
      item.vx = (last.x - first.x) / dt;
      item.vy = (last.y - first.y) / dt;
    }
  }

  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('blur', release);

  window.addEventListener('resize', () => {
    ({ w: stageW, h: stageH } = stageSize());
  });

  let last = performance.now();

  function tick() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;

    if (!item.dragging) {
      item.vy += GRAVITY * dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.angle += item.angularVel * dt;
      item.angularVel *= 0.985;

      const floor = stageH - item.h - stageH * 0.16; // leave room for the caption
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

      render();
    }

    setTimeout(tick, 1000 / 60);
  }
  tick();
}

// El texto sobre el arco se desvanece a medida que el arco sale de escena.
function initArchFade() {
  const arch = document.getElementById('archStage');
  const caption = document.getElementById('archCaption');
  if (!arch || !caption) return;

  function update() {
    const rect = arch.getBoundingClientRect();
    const progress = 1 - Math.min(Math.max(-rect.top / (rect.height * 0.6), 0), 1);
    caption.style.opacity = progress;
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
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
  initArchFade();
});
