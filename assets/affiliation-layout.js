(() => {
  const list = document.querySelector('.hero-affiliations .affiliations-list');
  if (!list) return;
  const entries = [...list.children];
  const ns = 'http://www.w3.org/2000/svg';
  const contactPaths = new Map(entries.map(el => {
    const svg = document.createElementNS(ns, 'svg');
    svg.classList.add('affiliation-contact');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS(ns, 'path');
    svg.append(path); el.append(svg);
    return [el, path];
  }));
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
  let chasePaused = false;
  let origin = { left: 0, top: 0 }, focused = false, pressing = false;
  let aim = { held: null, responses: new Map() }, aimedAt = null;
  function clearMotion() {
    cancelAnimationFrame(animation);
    animation = 0;
    bodies.forEach(b => {
      b.x = b.y = b.outline = b.drive = b.contact = 0;
      b.el.style.removeProperty('--contact-opacity');
      contactPaths.get(b.el).setAttribute('d', '');
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
    aim = { held: null, responses: new Map() }; aimedAt = null;
    list.classList.toggle('has-proximity', playful.matches);
    const box = list.getBoundingClientRect();
    origin = { left: box.left, top: box.top };
    bodies = playful.matches ? entries.map(el => {
      const r = el.getBoundingClientRect();
      return { el, left: r.left - box.left, top: r.top - box.top,
        width: r.width, height: r.height, x: 0, y: 0, outline: 0, drive: 0, contact: 0 };
    }) : [];
    pointer = null;
  }
  const inside = (p, b, x = 0, y = 0, inset = 0) => p.x >= b.left + x + inset && p.x <= b.left + x + b.width - inset && p.y >= b.top + y + inset && p.y <= b.top + y + b.height - inset;
  // Update each tile only from real pointer movement, never from tile motion.
  function chooseAim(client) {
    const p = { x: client.x - origin.left, y: client.y - origin.top };
    const now = typeof client.time === 'number' ? client.time : lastTime;
    const held = aim.held && inside(p, aim.held, aim.held.x, aim.held.y, -8)
      ? aim.held : bodies.find(b => inside(p, b, b.x, b.y, Math.min(12, b.height * .32, b.width * .15)));
    const responses = new Map();
    bodies.forEach(b => {
      if (b === held) return;
      const left = b.left + b.x, top = b.top + b.y;
      const distance = Math.hypot(Math.max(left - p.x, 0, p.x - left - b.width), Math.max(top - p.y, 0, p.y - top - b.height));
      const previous = aim.responses.get(b);
      if (distance >= (previous ? 110 : 90)) return;
      let direction = previous ? previous.direction : Math.sign(left + b.width / 2 - p.x);
      let vertical = previous ? previous.vertical : Math.sign(top + b.height / 2 - p.y);
      let directionAt = previous ? previous.directionAt : client;
      let changedAt = previous ? previous.changedAt : now;
      if (!direction) direction = left + b.width / 2 < list.clientWidth / 2 ? 1 : -1;
      if (previous && now - changedAt >= 220) {
        if (Math.abs(client.y - directionAt.y) >= 24) {
          if (p.y < top - 12) vertical = 1;
          else if (p.y > top + b.height + 12) vertical = -1;
        }
        if (Math.abs(client.x - directionAt.x) >= 48) {
          const oldDirection = direction;
          if (direction > 0 && p.x > left + b.width + 20) direction = -1;
          else if (direction < 0 && p.x < left - 20) direction = 1;
          if (direction !== oldDirection) { directionAt = client; changedAt = now; }
        }
      }
      responses.set(b, { direction, vertical, directionAt, changedAt });
    });
    aim = { held: held || null, responses };
    aimedAt = client;
  }
  function tick(time) {
    animation = 0;
    if (!playful.matches || focused || pressing || chasePaused) return;
    const dt = Math.min(40, lastTime ? time - lastTime : 16);
    lastTime = time;
    const alpha = 1 - Math.exp(-dt / 70);
    // One shared interpolation keeps every collision constraint intact, while
    // this smaller home step gives non-active tiles an independent slow return.
    const homeStep = (1 - Math.exp(-dt / 850)) / alpha;
    const p = pointer && { x: pointer.x - origin.left, y: pointer.y - origin.top };
    const hovered = p && aim.held;
    const targets = bodies.map(b => {
      const left = b.left + b.x, top = b.top + b.y;
      const held = b === hovered;
      const response = p && !held ? aim.responses.get(b) : null;
      const distance = response ? Math.hypot(Math.max(left - p.x, 0, p.x - left - b.width), Math.max(top - p.y, 0, p.y - top - b.height)) : 1000;
      const strength = response ? Math.pow(Math.max(0, 1 - distance / 90), 2) : 0;
      const requestedDrive = response ? response.direction * strength : 0;
      b.drive = held || !response ? 0 : b.drive + (requestedDrive - b.drive) * (1 - Math.exp(-dt / 90));
      const restingAtBarrier = response && !strength;
      return { b, held,
        left: held || restingAtBarrier ? left : strength ? left + b.drive * 36 : left - b.x * homeStep,
        y: held || restingAtBarrier ? b.y : strength ? Math.max(-3, Math.min(3, b.y + response.vertical * .6 * strength)) : b.y * (1 - homeStep),
        border: 0, contacts: [], force: b.drive };
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
      // Symmetric contact resolution avoids a winning-side flip when two tiles
      // push in opposite directions. Hovered links stay fixed for selection.
      const projectPair = i => {
        const a = row[i], b = row[i + 1];
        const overlap = a.left + a.b.width + gap - b.left;
        if (overlap <= 0) return;
        const wa = a.held ? 0 : 1, wb = b.held ? 0 : 1;
        const mass = wa + wb;
        if (mass) { a.left -= overlap * wa / mass; b.left += overlap * wb / mass; }
      };
      for (let pass = 0; pass < 32; pass++) {
        row.forEach(t => { if (!t.held) t.left = Math.max(0, Math.min(wall - t.b.width, t.left)); });
        if (pass % 2) { for (let i = last - 1; i >= 0; i--) projectPair(i); }
        else { for (let i = 0; i < last; i++) projectPair(i); }
      }
      // Show the actual meeting edges, including a stationary tile being pushed.
      for (let i = 0; i < last; i++) {
        const a = row[i], b = row[i + 1];
        const affected = Math.abs(a.left - a.b.left) + Math.abs(b.left - b.b.left) > .5;
        if (!affected || b.left - a.left - a.b.width > gap + .6) continue;
        const top = Math.max(a.b.top + a.y, b.b.top + b.y);
        const bottom = Math.min(a.b.top + a.y + a.b.height, b.b.top + b.y + b.b.height);
        if (bottom <= top) continue;
        a.contacts.push({ side: 'right', center: (top + bottom) / 2 - a.b.top - a.y, length: bottom - top });
        b.contacts.push({ side: 'left', center: (top + bottom) / 2 - b.b.top - b.y, length: bottom - top });
      }
    });
    let moving = false;
    targets.forEach(t => {
      const b = t.b, x = t.left - b.left;
      const oldX = b.x, oldY = b.y;
      b.x += (x - b.x) * alpha;
      b.y += (t.y - b.y) * alpha;
      const displaced = Math.hypot(b.x, b.y);
      if (p && !t.held && Math.abs(t.force) > .01 && displaced > .15) {
        const px = Math.max(0, Math.min(b.width, p.x - b.left - b.x));
        const py = Math.max(0, Math.min(b.height, p.y - b.top - b.y));
        const edges = [px, b.width - px, py, b.height - py];
        const side = ['left', 'right', 'top', 'bottom'][edges.indexOf(Math.min(...edges))];
        t.contacts.push({ side, center: side === 'left' || side === 'right' ? py : px, length: 20 });
      }
      t.border = Math.max(Math.min(1, displaced / 1.5), t.contacts.length ? 1 : 0);
      b.outline += (t.border - b.outline) * alpha;
      const contact = t.contacts.length ? 1 : 0;
      b.contact += (contact - b.contact) * alpha;
      if (t.contacts.length) {
        const paths = t.contacts.map(c => {
          const vertical = c.side === 'left' || c.side === 'right';
          const limit = vertical ? b.height : b.width;
          const start = Math.max(4, c.center - c.length / 2);
          const end = Math.min(limit - 4, c.center + c.length / 2);
          if (end <= start) return '';
          // Match the inset outline, preserving the entry's original hit area.
          const edge = c.side === 'left' || c.side === 'top' ? .5 : vertical ? b.width + 9.5 : b.height + 3.5;
          return vertical ? `M${edge},${start + 2}V${end + 2}` : `M${start + 5},${edge}H${end + 5}`;
        });
        contactPaths.get(b.el).setAttribute('d', paths.join(' '));
      }
      b.el.style.setProperty('--contact-opacity', b.contact.toFixed(3));
      if (Math.abs(b.x - oldX) + Math.abs(b.y - oldY) + Math.abs(t.border - b.outline) + Math.abs(contact - b.contact) > .001) moving = true;
      b.el.style.setProperty('--nudge-x', b.x.toFixed(3) + 'px');
      b.el.style.setProperty('--nudge-y', b.y.toFixed(3) + 'px');
      b.el.style.setProperty('--proximity-outline', b.outline.toFixed(3));
    });
    if (moving) animation = requestAnimationFrame(tick);
  }
  function animate() { if (chasePaused) return; if (!animation) { lastTime = 0; animation = requestAnimationFrame(tick); } }
  window.addEventListener('pointermove', event => {
    if (!playful.matches || focused || chasePaused || event.pointerType === 'touch') return;
    const p = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    const near = p.x >= origin.left - 100 && p.x <= origin.left + list.clientWidth + 100 && p.y >= origin.top - 100 && p.y <= origin.top + list.clientHeight + 100;
    const displaced = bodies.some(b => Math.abs(b.x) + Math.abs(b.y) > .05);
    if (!near && !pointer && !animation && !displaced) return;
    if (near && (!pointer || !aimedAt || Math.hypot(p.x - aimedAt.x, p.y - aimedAt.y) >= 6)) chooseAim(p);
    if (!near) { aim = { held: null, responses: new Map() }; aimedAt = null; }
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
  window.addEventListener('hero-chase-state', event => {
    const active = !!event.detail?.active;
    if (active === chasePaused) return;
    chasePaused = active; pointer = null; pressing = false;
    aim = { held: null, responses: new Map() }; aimedAt = null;
    pauseMotion();
    if (!active) animate();
  });
  playful.addEventListener('change', schedule);
  mobile.addEventListener('change', schedule);


})();