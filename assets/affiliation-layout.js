(() => {
  const list = document.querySelector('.hero-affiliations .affiliations-list');
  if (!list) return;
  const entries = [...list.children];
  const mobile = matchMedia('(max-width:680px)');
  let queued = false;
  function layout() {
    queued = false;
    if (mobile.matches) {
      entries.forEach(e => e.style.removeProperty('--affiliation-row-inset'));
      measureBodies();
      return;
    }
    const rows = new Map();
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    entries.forEach(e => {
      const top = e.offsetTop;
      if (!rows.has(top)) rows.set(top, []);
      rows.get(top).push(e);
    });
    const measured = [...rows.values()].map(items => ({
      items,
      width: items.reduce((sum, e) => sum + e.offsetWidth, 0) + gap * (items.length - 1)
    }));
    const boundary = list.clientWidth;
    const extraGapLimit = parseFloat(getComputedStyle(document.documentElement).fontSize) * 2.5;
    measured.forEach(row => {
      const free = Math.max(0, boundary - row.width);
      const gaps = row.items.length - 1;
      const extra = gaps > 0 ? Math.min(extraGapLimit, free * .5 / gaps) : 0;
      const inset = Math.max(0, (free - extra * gaps) * .25);
      row.items.forEach((e, index) => e.style.setProperty('--affiliation-row-inset', (inset + index * extra) + 'px'));
    });
    measureBodies();
  }
  function schedule() {
    if (!queued) { queued = true; requestAnimationFrame(layout); }
  }
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(list);
  window.addEventListener('resize', schedule, { passive: true });
  if (document.fonts) document.fonts.ready.then(schedule);
  schedule();

  // Pointer play is optional; links retain normal touch and keyboard behaviour.
  const playful = matchMedia('(min-width:681px) and (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
  const section = list.closest('.hero-affiliations');
  let bodies = [], pointer = null, animation = 0, lastTime = 0;
  let origin = { left: 0, top: 0 }, focused = false, pressing = false;
  function clearMotion() {
    cancelAnimationFrame(animation);
    animation = 0;
    bodies.forEach(b => {
      b.x = b.y = b.outline = 0;
      b.el.style.removeProperty('--nudge-x');
      b.el.style.removeProperty('--nudge-y');
      b.el.style.removeProperty('--proximity-outline');
    });
  }
  // Hold links steady for clicking; after leaving, ease back home slowly.
  function pauseMotion() {
    cancelAnimationFrame(animation);
    animation = 0;
    lastTime = 0;
  }
  function measureBodies() {
    clearMotion();
    list.classList.toggle('has-proximity', playful.matches);
    const box = list.getBoundingClientRect();
    origin = { left: box.left, top: box.top };
    bodies = playful.matches ? entries.map(el => {
      const r = el.getBoundingClientRect();
      return { el, left: r.left - box.left, top: r.top - box.top,
        width: r.width, height: r.height, x: 0, y: 0, outline: 0 };
    }) : [];
    pointer = null;
  }
  const inside = (p, b, x = 0, y = 0, inset = 0) => p.x >= b.left + x + inset && p.x <= b.left + x + b.width - inset && p.y >= b.top + y + inset && p.y <= b.top + y + b.height - inset;
  function tick(time) {
    animation = 0;
    if (!playful.matches || focused || pressing) return;
    const dt = Math.min(40, lastTime ? time - lastTime : 16);
    lastTime = time;
    const alpha = 1 - Math.exp(-dt / 70);
    // One shared interpolation keeps every collision constraint intact, while
    // this smaller home step gives non-active tiles an independent slow return.
    const homeStep = (1 - Math.exp(-dt / 850)) / alpha;
    const p = pointer && { x: pointer.x - origin.left, y: pointer.y - origin.top };
    const hovered = p && bodies.find(b => inside(p, b, b.x, b.y, Math.min(12, b.height * .32, b.width * .15)));
    let nearest = null, nearestDistance = 90;
    if (p && !hovered) bodies.forEach(b => {
      const left = b.left + b.x, top = b.top + b.y;
      const distance = Math.hypot(Math.max(left - p.x, 0, p.x - left - b.width), Math.max(top - p.y, 0, p.y - top - b.height));
      if (distance < nearestDistance) { nearestDistance = distance; nearest = b; }
    });
    const targets = bodies.map(b => {
      const left = b.left + b.x, top = b.top + b.y;
      const held = b === hovered;
      const strength = b === nearest ? Math.pow(1 - nearestDistance / 90, 2) : 0;
      let direction = !strength ? 0 : Math.sign(left + b.width / 2 - p.x);
      if (strength && !direction) direction = left + b.width / 2 < list.clientWidth / 2 ? 1 : -1;
      return { b, held,
        left: held ? left : strength ? left + direction * 36 * strength : left - b.x * homeStep,
        y: held ? b.y : strength ? Math.max(-3, Math.min(3, b.y + Math.sign(top + b.height / 2 - p.y) * .6 * strength)) : b.y * (1 - homeStep),
        border: held ? 1 : strength, force: direction * strength };
    });
    const rows = [];
    targets.forEach(t => {
      let row = rows.find(r => Math.abs(r[0].b.top - t.b.top) < 3);
      if (!row) rows.push(row = []);
      row.push(t);
    });
    const wall = list.getBoundingClientRect().width;
    rows.forEach(row => {
      row.sort((a, b) => a.b.left - b.b.left);
      const last = row.length - 1;
      const gap = Math.min(12, ...row.slice(1).map((t, i) => t.b.left - row[i].b.left - row[i].b.width));
      const forward = () => { for (let i = 1; i <= last; i++) row[i].left = Math.max(row[i].left, row[i - 1].left + row[i - 1].b.width + gap); };
      const backward = () => { for (let i = last - 1; i >= 0; i--) row[i].left = Math.min(row[i].left, row[i + 1].left - row[i].b.width - gap); };
      const heldIndex = row.findIndex(t => t.held);
      if (heldIndex >= 0) {
        // Returning neighbours cannot dislodge the link being selected.
        for (let i = heldIndex - 1; i >= 0; i--) row[i].left = Math.min(row[i].left, row[i + 1].left - row[i].b.width - gap);
        for (let i = heldIndex + 1; i <= last; i++) row[i].left = Math.max(row[i].left, row[i - 1].left + row[i - 1].b.width + gap);
      } else if (row.reduce((sum, t) => sum + t.force, 0) >= 0) {
        row[0].left = Math.max(0, row[0].left); forward();
        row[last].left = Math.min(wall - row[last].b.width, row[last].left); backward();
      } else {
        row[last].left = Math.min(wall - row[last].b.width, row[last].left); backward();
        row[0].left = Math.max(0, row[0].left); forward();
      }
      row.forEach(t => { if (Math.abs(t.left - t.b.left) > .5 && Math.abs(t.left - t.b.left - t.b.x) > .5) t.border = Math.max(t.border, .65); });
    });
    let moving = false;
    targets.forEach(t => {
      const b = t.b, x = t.left - b.left;
      const oldX = b.x, oldY = b.y;
      b.x += (x - b.x) * alpha;
      b.y += (t.y - b.y) * alpha;
      b.outline += (t.border - b.outline) * alpha;
      if (Math.abs(b.x - oldX) + Math.abs(b.y - oldY) + Math.abs(t.border - b.outline) > .001) moving = true;
      b.el.style.setProperty('--nudge-x', b.x.toFixed(3) + 'px');
      b.el.style.setProperty('--nudge-y', b.y.toFixed(3) + 'px');
      b.el.style.setProperty('--proximity-outline', b.outline.toFixed(3));
    });
    if (moving) animation = requestAnimationFrame(tick);
  }
  function animate() { if (!animation) { lastTime = 0; animation = requestAnimationFrame(tick); } }
  window.addEventListener('pointermove', event => {
    if (!playful.matches || focused || event.pointerType === 'touch') return;
    const p = { x: event.clientX, y: event.clientY };
    const near = p.x >= origin.left - 100 && p.x <= origin.left + list.clientWidth + 100 && p.y >= origin.top - 100 && p.y <= origin.top + list.clientHeight + 100;
    const displaced = bodies.some(b => Math.abs(b.x) + Math.abs(b.y) > .05);
    if (!near && !pointer && !animation && !displaced) return;
    pointer = near ? p : null;
    animate();
  }, { passive: true });
  section.addEventListener('pointerdown', event => { if (event.target.closest('.hero-affiliation')) { pressing = true; pauseMotion(); } }, { capture: true });
  section.addEventListener('focusin', event => { focused = event.target.matches(':focus-visible'); if (focused) { pointer = null; pauseMotion(); } else animate(); });
  window.addEventListener('pointerup', () => { pressing = false; animate(); }, { passive: true });
  window.addEventListener('pointercancel', () => { pressing = false; animate(); }, { passive: true });
  section.addEventListener('focusout', () => { focused = false; animate(); });
  window.addEventListener('blur', () => { pressing = false; pointer = null; animate(); });
  document.documentElement.addEventListener('pointerleave', () => { pointer = null; animate(); });
  window.addEventListener('scroll', () => {
    pointer = null; animate();
    const r = list.getBoundingClientRect(); origin = { left: r.left, top: r.top };
  }, { passive: true });
  playful.addEventListener('change', schedule);
  mobile.addEventListener('change', schedule);


})();