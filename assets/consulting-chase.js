(() => {
  const host = document.querySelector('.hero-main');
  const button = host && host.querySelector(':scope > .hero-actions a[href^="https://salmanyoussef.com"]');
  if (!button) return;
  const eligible = matchMedia('(min-width:681px) and (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
  let mode = 'idle', allowed = false, frame = 0, lastFrame = 0;
  let box, width = 0, height = 0, maxX = 0, maxY = 0, homeX = 0, homeY = 0;
  let x = 0, y = 0, vx = 0, vy = 0, goal = { x: 0, y: 0 };
  let pointer = null, pointerVX = 0, pointerVY = 0, lastPointerTime = 0;
  let routeUntil = 0, feint = 1, started = 0, lastInside = 0, cooldown = 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const clock = () => performance.now();
  function setMode(next) {
    const active = mode !== 'idle';
    mode = next;
    host.dataset.chaseMode = mode;
    button.classList.toggle('is-chasing', mode === 'chasing');
    button.classList.toggle('is-caught', mode === 'caught');
    button.classList.toggle('is-returning', mode === 'returning');
    if (active !== (mode !== 'idle')) window.dispatchEvent(new CustomEvent('hero-chase-state', { detail: { active: mode !== 'idle' } }));
  }
  function render() {
    button.style.setProperty('--chase-x', (x - homeX).toFixed(2) + 'px');
    button.style.setProperty('--chase-y', (y - homeY).toFixed(2) + 'px');
  }
  function stopFrame() { cancelAnimationFrame(frame); frame = 0; lastFrame = 0; }
  function reset() {
    stopFrame(); setMode('idle');
    x = homeX; y = homeY; vx = vy = 0;
    button.style.removeProperty('--chase-x'); button.style.removeProperty('--chase-y');
  }
  function measure() {
    reset();
    button.classList.toggle('chase-ready', eligible.matches);
    box = host.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    width = rect.width; height = rect.height;
    homeX = rect.left - box.left; homeY = rect.top - box.top;
    let arenaHeight = box.height;
    // Match the annotated area: the introduction through the first three
    // collaboration rows, excluding the portrait and the lower rows.
    const list = host.querySelector('.affiliations-list');
    if (list && list.children.length) {
      const entries = [...list.children];
      const tops = [...new Set(entries.map(e => e.offsetTop))].sort((a, b) => a - b);
      const third = tops[Math.min(2, tops.length - 1)];
      arenaHeight = Math.min(arenaHeight, list.getBoundingClientRect().top - box.top + third - tops[0] + Math.max(...entries.map(e => e.offsetHeight)) + 8);
    }
    maxX = Math.max(0, box.width - width);
    maxY = Math.max(0, arenaHeight - height);
    x = homeX; y = homeY;
    allowed = eligible.matches && maxX >= 50 && maxY >= 160;
    button.classList.toggle('chase-ready', allowed);
    pointer = null; pointerVX = pointerVY = 0;
  }
  function localPointer() { return pointer && { x: pointer.x - box.left, y: pointer.y - box.top }; }
  function insideArena(p, margin = 0) { return p && p.x >= -margin && p.y >= -margin && p.x <= maxX + width + margin && p.y <= maxY + height + margin; }
  function distance(p) { return p ? Math.hypot(Math.max(x - p.x, 0, p.x - x - width), Math.max(y - p.y, 0, p.y - y - height)) : 1000; }
  function inCore(p) { return p && p.x > x + width * .26 && p.x < x + width * .74 && p.y > y + height * .23 && p.y < y + height * .77; }
  function atEdge(p) {
    // Only a two-pixel band around the actual button outline can start play.
    if (!p || p.x < x - 2 || p.x > x + width + 2 || p.y < y - 2 || p.y > y + height + 2) return false;
    return Math.min(Math.abs(p.x - x), Math.abs(p.x - x - width), Math.abs(p.y - y), Math.abs(p.y - y - height)) <= 2;
  }
  function segmentDistance(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }
  function chooseRoute(now) {
    const p = localPointer();
    const predicted = p ? { x: p.x + pointerVX * .1, y: p.y + pointerVY * .1 } : { x: homeX, y: homeY };
    const centre = { x: x + width / 2, y: y + height / 2 };
    let best = -Infinity;
    for (let i = 0; i < 22; i++) {
      const candidate = i < 4 ? { x: i % 2 ? maxX : 0, y: i < 2 ? 0 : maxY } : { x: Math.random() * maxX, y: Math.random() * maxY };
      const end = { x: candidate.x + width / 2, y: candidate.y + height / 2 };
      const travel = Math.hypot(candidate.x - x, candidate.y - y);
      const clearance = segmentDistance(predicted, centre, end);
      const score = Math.hypot(end.x - predicted.x, end.y - predicted.y) + travel * .25 + Math.random() * 85 - Math.max(0, 115 - clearance) * 2.8 - (travel < 90 ? 220 : 0);
      if (score > best) { best = score; goal = candidate; }
    }
    routeUntil = now + 320 + Math.random() * 420;
    feint = Math.random() < .5 ? -1 : 1;
  }
  function wake() { if (!frame) frame = requestAnimationFrame(tick); }
  function returnHome() {
    if (mode === 'idle') return;
    setMode('returning'); vx = vy = 0; wake();
  }
  function catchButton() {
    stopFrame(); vx = vy = 0; setMode('caught'); render();
  }
  function tick(now) {
    frame = 0;
    if (!allowed || mode === 'idle' || mode === 'caught') return;
    const dt = Math.min(.035, lastFrame ? (now - lastFrame) / 1000 : 1 / 60);
    lastFrame = now;
    if (mode === 'returning') {
      const blend = 1 - Math.exp(-dt / .22);
      x += (homeX - x) * blend; y += (homeY - y) * blend;
      if (Math.hypot(x - homeX, y - homeY) < .35) { reset(); return; }
      render(); wake(); return;
    }
    const p = localPointer();
    if (insideArena(p, 20)) lastInside = now;
    else if (now - lastInside > 350) { returnHome(); return; }
    if (now > routeUntil || Math.hypot(goal.x - x, goal.y - y) < 65) chooseRoute(now);
    const threat = Math.max(0, 1 - distance(p) / 170);
    const gx = goal.x - x, gy = goal.y - y, gl = Math.hypot(gx, gy) || 1;
    let dx = gx / gl, dy = gy / gl;
    if (p) {
      const ax = x + width / 2 - p.x - pointerVX * .09;
      const ay = y + height / 2 - p.y - pointerVY * .09;
      const al = Math.hypot(ax, ay) || 1;
      const side = Math.sin(now / 150) * feint * threat * .65;
      dx += ax / al * threat * 1.6 - ay / al * side;
      dy += ay / al * threat * 1.6 + ax / al * side;
    }
    dx += Math.max(0, 1 - x / 55) * .7 - Math.max(0, 1 - (maxX - x) / 55) * .7;
    dy += Math.max(0, 1 - y / 55) * .7 - Math.max(0, 1 - (maxY - y) / 55) * .7;
    const length = Math.hypot(dx, dy) || 1;
    const speed = 340 + 560 * threat + Math.sin(now / 120) * 35;
    const turn = 1 - Math.exp(-dt / .065);
    vx += (dx / length * speed - vx) * turn;
    vy += (dy / length * speed - vy) * turn;
    const nx = x + vx * dt, ny = y + vy * dt;
    x = clamp(nx, 0, maxX); y = clamp(ny, 0, maxY);
    if (x !== nx) { vx *= -.6; routeUntil = 0; }
    if (y !== ny) { vy *= -.6; routeUntil = 0; }
    pointerVX *= Math.exp(-dt / .22); pointerVY *= Math.exp(-dt / .22);
    render(); wake();
  }
  window.addEventListener('pointermove', event => {
    if (!allowed || event.pointerType === 'touch') return;
    const now = clock(), previous = pointer;
    pointer = { x: event.clientX, y: event.clientY };
    const dt = clamp((now - lastPointerTime) / 1000, .008, .12);
    if (previous && now - lastPointerTime < 200) {
      pointerVX = clamp(pointerVX * .6 + (pointer.x - previous.x) / dt * .4, -1800, 1800);
      pointerVY = clamp(pointerVY * .6 + (pointer.y - previous.y) / dt * .4, -1800, 1800);
    }
    lastPointerTime = now;
    const p = localPointer();
    if (mode === 'caught') { if (!insideArena(p, 28)) returnHome(); return; }
    if (mode === 'returning') return;
    if (mode === 'chasing') {
      if (now - started > 140 && inCore(p)) catchButton();
      return;
    }
    const otherControl = event.target?.closest?.('a,button');
    if (event.target?.closest?.('.hero-affiliations') || (otherControl && otherControl !== button)) return;
    if (now < cooldown || button.matches(':focus-visible') || !atEdge(p)) return;
    started = lastInside = now; setMode('chasing'); chooseRoute(now); wake();
  }, { passive: true });
  button.addEventListener('pointerdown', () => { if (mode === 'chasing') catchButton(); });
  host.addEventListener('focusin', event => { if (event.target.matches(':focus-visible')) { cooldown = clock() + 2500; reset(); } });
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && mode !== 'idle') { cooldown = clock() + 2500; returnHome(); } });
  window.addEventListener('blur', () => { pointer = null; returnHome(); });
  document.documentElement.addEventListener('pointerleave', () => { pointer = null; returnHome(); });
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('scroll', measure, { passive: true });
  eligible.addEventListener('change', measure);
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(host);
  if (document.fonts) document.fonts.ready.then(measure);
  measure();
})();
